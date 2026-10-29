/** Local UI and admission fixtures. These are not real shared-shelf or player journeys. */

import { mkdirSync, readdirSync } from 'node:fs';
import {
  acceptPersona,
  acceptPersonaBatch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { type BrowserContext, chromium, type Page, webkit } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ALLOCATION, CAST } from '../src/sim/cast.ts';
import { agencyTransfer } from '../src/sim/cast-chapter.ts';
import { ENGINE_VERSION } from '../src/sim/hf4.ts';
import { apply, newGame } from '../src/sim/index.ts';
import { verifyImport } from '../src/ui/export.ts';
import { pausedRun } from './paused-run.ts';

let server: ViteDevServer;
let local: string;
const origin = 'https://goodhands.adamwhite.work';
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  local = server.resolvedUrls!.local[0]!;
});
afterAll(async () => {
  await server?.close();
});

async function fixture(context: BrowserContext, reject: () => boolean, carry = false, lostReply = false) {
  const state = newGame(1);
  apply(state, { type: 'pause-cast' });
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.nermin.castId,
    castRevision: CAST.nermin.revision,
    branchId: 'simplify-fixture',
    parentRevision: null,
    source: { game: 'goodhands', build: 'fixture', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'nermin')),
      life: initialPersonaLife(CAST.nermin.castId, 'simplify-fixture', Date.now()),
    },
    limitations: [],
  });
  const secondParent = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.hatice.castId,
    castRevision: CAST.hatice.revision,
    branchId: 'simplify-second-fixture',
    parentRevision: null,
    source: { game: 'goodhands', build: 'fixture', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'hatice')),
      life: initialPersonaLife(CAST.hatice.castId, 'simplify-second-fixture', Date.now()),
    },
    limitations: [],
  });
  let backend = { heads: {} as Record<string, string>, revisions: [] as PersonaEnvelope[] };
  if (carry) {
    backend = acceptPersona(backend, parent);
    backend = acceptPersona(backend, secondParent);
  }
  let writes = 0;
  await context.exposeBinding('shelfFixtureReply', async (_source, data) => {
    const message = data as {
      type: string;
      action: string;
      id: string;
      envelopes?: PersonaEnvelope[];
      expectedHeads?: Record<string, string | null>;
    };
    const type = message.type === 'hf-persona-consent' ? 'hf-persona-consent-reply' : 'hf-persona-reply';
    if (message.action === 'putBatch') {
      for (const envelope of message.envelopes ?? []) expect(envelope.source.engine).toBe(ENGINE_VERSION);
      if (reject() && !lostReply)
        return { type, id: message.id, error: 'Shelf unavailable. Use a local file.' };
      backend = acceptPersonaBatch(backend, message.envelopes ?? [], message.expectedHeads);
      writes++;
      if (reject() && lostReply) return null; // The transaction committed; its reply was lost.
    }
    const available = writes ? secondParent : parent;
    const head = backend.revisions.find((p) => p.revision === backend.heads[available.castId]) ?? available;
    return {
      type,
      id: message.id,
      value:
        message.type === 'hf-persona-consent'
          ? true
          : message.action === 'prepareBatch'
            ? {
                expectedHeads: Object.fromEntries(
                  ALLOCATION.map((c) => [c.castId, backend.heads[c.castId] ?? null]),
                ),
                inputs: carry ? [preparePersonaLife(head, Date.now())] : [],
                blocked: [],
              }
            : true,
    };
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === 'POST' &&
      url.origin === 'https://human.adamwhite.work' &&
      url.pathname.startsWith('/lab/api/')
    )
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ id: 'local-stored-receipt', ok: true }),
      });
    if (route.request().method() === 'POST' && url.hostname.endsWith('adamwhite.work')) return route.abort();
    if (url.origin === origin && url.pathname === '/@vite/client')
      return route.fulfill({
        contentType: 'text/javascript',
        body: `
        // Fixtures need Vite CSS injection, but no development WebSocket on a routed HTTPS origin.
        const styles = new Map();
        export function updateStyle(id, css) { let style = styles.get(id); if (!style) { style = document.createElement('style'); styles.set(id, style); document.head.append(style); } style.textContent = css; }
        export function removeStyle(id) { styles.get(id)?.remove(); styles.delete(id); }
        export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, on() {}, send() {}, invalidate() {}, data: {} }; }
        export function injectQuery(url) { return url; }
        export class ErrorOverlay extends HTMLElement {}
      `,
      });
    if (url.origin === origin) {
      const response = await route.fetch({ url: `${local.replace(/\/$/, '')}${url.pathname}${url.search}` });
      return route.fulfill({ response });
    }
    if (url.origin === 'https://human.adamwhite.work' && url.pathname === '/lab/identity/')
      return route.fulfill({
        contentType: 'text/html',
        body: `<script>addEventListener('message', async e => {
        if (e.data?.type !== 'hf-persona-consent' && e.data?.type !== 'hf-persona-request') return;
        const result = await window.shelfFixtureReply(e.data);
        if (result === null) return;
        if (e.ports[0]) e.ports[0].postMessage(result); else e.source.postMessage(result, e.origin);
      });</script>`,
      });
    return route.continue();
  });
  return { writes: () => writes, heads: () => structuredClone(backend.heads) };
}
async function readable(page: Page, selector: string, min = 0) {
  const controls = page.locator(selector);
  expect(await controls.count()).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    if (!(await control.isVisible())) continue;
    await control.scrollIntoViewIfNeeded();
    const result = await control.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let last: Node | null = null;
      while (walker.nextNode()) if (walker.currentNode.textContent?.trim()) last = walker.currentNode;
      let lastLineVisible = true;
      if (last) {
        const range = document.createRange();
        range.selectNodeContents(last);
        const line = Array.from(range.getClientRects()).at(-1);
        if (line)
          lastLineVisible =
            line.bottom <= rect.bottom + 1 &&
            line.top >= rect.top - 1 &&
            el.contains(document.elementFromPoint(line.x + line.width / 2, line.y + line.height / 2));
      }
      return {
        lastLineVisible,
        size: Number.parseFloat(style.fontSize),
        height: rect.height,
        width: rect.width,
        fits: el.scrollWidth <= el.clientWidth + 1,
        hit: el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
      };
    });
    expect(result.size).toBeGreaterThanOrEqual(min);
    expect(result.fits).toBe(true);
    expect(result.hit).toBe(true);
    expect(result.lastLineVisible).toBe(true);
  }
}
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
] as const) {
  for (const [width, height] of [
    [360, 690],
    [820, 1180],
    [1180, 820],
    [1280, 800],
  ]) {
    it.skipIf(!!process.env.CI && name === 'webkit')(
      `${name} ${width}x${height}: ordinary controls, questions, offer and one-page Feedback`,
      async () => {
        const browser = await engine.launch({
          ...(name === 'chromium' ? { channel: process.env.HF_BROWSER_CHANNEL } : {}),
        });
        try {
          const context = await browser.newContext({ viewport: { width: width!, height: height! } });
          await fixture(context, () => false);
          const page = await context.newPage();
          page.setDefaultTimeout(8000);
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.clock.install();
          await page.clock.pauseAt(new Date());
          await page.goto(origin);
          await page.evaluate(() => document.fonts.ready);
          expect(await page.locator('[data-action="other-ways"]').count()).toBe(0);
          await page.getByRole('button', { name: 'Open the office', exact: true }).click();
          await page.getByTestId('office').waitFor();
          await page.locator('[data-action="info"]').click();
          expect(await page.locator('.info-panel').innerText()).toContain(
            'Agency fees help you pay the rent.',
          );
          await page.keyboard.press('Escape');
          await page.locator('[data-action="menu"]').click();
          const menu = page.locator('.menu-sheet');
          expect(await menu.locator('[data-pace-choice]').count()).toBe(4);
          expect(await menu.locator('[data-theme-choice]').count()).toBe(3);
          expect(await menu.getByRole('link', { name: 'People between games' }).getAttribute('href')).toBe(
            'https://human.adamwhite.work/lab/people/',
          );
          expect(await menu.locator('.debug-footer details').getAttribute('open')).toBeNull();
          expect(await menu.locator('[data-action="import"]').isVisible()).toBe(true);
          await menu.getByText('Debug', { exact: true }).click();
          expect(await menu.locator('[data-action="import"]').isVisible()).toBe(true);
          await menu.getByText('Debug', { exact: true }).click();
          await page.getByRole('button', { name: 'Resume', exact: true }).click();
          await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
          expect(await page.locator('.look').innerText()).toBe(
            'This applicant is waiting with an application form.',
          );
          await readable(page, '.candidate-actions button', width! >= 768 ? 17 : 13);
          await page.locator('[data-action="interview"]').click();
          await page.locator('[data-action="more-choices"]').click();
          await readable(page, '.scene-choices button', width! >= 768 ? 17 : 13);
          const capture = async (scene: string) => {
            const dir = process.env.GOODHANDS_QA_SHOTS;
            if (!dir || !((name === 'chromium' && width === 820) || (name === 'webkit' && width === 1180)))
              return;
            mkdirSync(dir, { recursive: true });
            if (readdirSync(dir).filter((f) => f.endsWith('.png')).length >= 12)
              throw new Error('Screenshot cap reached');
            await page.screenshot({ path: `${dir}/local-${name}-${width}-${scene}.png` });
          };
          await capture('questions');
          await page.locator('[data-choice="wage"]').click();
          expect(await page.locator('.exchange').innerText()).toContain('I need ₺');
          await readable(page, '.exchange [data-scene-line]:last-child');
          await page.locator('[data-action="info"]').click();
          expect(await page.locator('.info-panel').innerText()).toContain(
            'They distinguish what Nermin observed from what someone told her.',
          );
          await page.keyboard.press('Escape');
          // End the interview and use the actual offer controls.
          await page.locator('[data-choice="wait-bench"]').click();
          await page.locator('[data-choice="done"]').click();
          await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
          await page.locator('[data-action="place"]').click();
          await readable(page, '.vouch-controls button', width! >= 768 ? 17 : 13);
          await page.locator('[data-confirm-match]').click();
          await page.locator('[data-action="edit-terms"]').click();
          await readable(page, '.stepper', width! >= 768 ? 17 : 13);
          await readable(page, '[data-step], [data-day]');
          await capture('offer');
          await page.locator('[data-close]').click();
          await page.locator('[data-action="menu"]').click();
          // This control covers the Recording-off form through the real SDK preference.
          await page.locator('.recording-footer input[type="checkbox"]').uncheck();
          expect(await page.locator('.recording-footer input[type="checkbox"]').isChecked()).toBe(false);
          // The shelf fixture has no identity reply; let the SDK's normal fallback finish.
          await page.clock.runFor(2001);
          await page.getByRole('button', { name: 'Feedback', exact: true }).click();
          expect(await page.locator('.feedback-screen').count()).toBe(1);
          expect(await page.locator('.feedback-screen input[type="checkbox"]').count()).toBe(1);
          await page.locator('.feedback-screen textarea').fill('Local fixture QA; no ingestion.');
          await page.locator('.feedback-name summary').click();
          await page.locator('[data-feedback-name]').fill('Fixture');
          await readable(page, '.feedback-screen textarea, [data-feedback-name]');
          await page.setViewportSize({ width: width!, height: 450 });
          await readable(page, '.feedback-screen textarea, [data-feedback-name]');
          await readable(page, '.feedback-screen .lk-commit button');
          await page.getByRole('button', { name: 'Submit', exact: true }).click();
          await expect
            .poll(() => page.locator('.feedback-screen').innerText())
            .toContain('Sent. Your note is stored.');
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <= innerWidth &&
                document.documentElement.scrollHeight <= innerHeight,
            ),
          ).toBe(true);
          expect(errors).toEqual([]);
          // Gameplay and diagnostics are public without a query switch.
          await page.goto(origin);
          await page.locator('[data-action="menu"]').click();
          expect(await page.locator('[data-pace-choice]').count()).toBe(4);
          expect(await page.locator('.debug-footer details').getAttribute('open')).toBeNull();
        } finally {
          await browser.close();
        }
      },
      120_000,
    );
  }
}
for (const lostReply of [false, true])
  it(`a ${lostReply ? 'lost accepted' : 'rejected'} ordinary batch reply preserves the saved run and its owned receipts`, async () => {
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    try {
      const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });
      let rejected = false;
      const shelf = await fixture(context, () => rejected, true, lostReply);
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto(origin);
      await page.getByRole('button', { name: 'Open the office', exact: true }).click();
      await page
        .getByTestId('office')
        .waitFor()
        .catch(async (error) => {
          console.error('Batch-fixture opening diagnostic:', await page.locator('body').innerText());
          throw error;
        });
      const saved = () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('goodhands');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
          try {
            return await new Promise<unknown>((resolve, reject) => {
              const r = db.transaction('pages').objectStore('pages').get('run');
              r.onsuccess = async () => {
                const row = r.result;
                resolve(
                  row?.plain ??
                    (row?.blob
                      ? await new Response(
                          row.blob.stream().pipeThrough(new DecompressionStream('gzip')),
                        ).text()
                      : null),
                );
              };
              r.onerror = () => reject(r.error);
            });
          } finally {
            db.close();
          }
        });
      const before = await saved();
      const beforeHead = shelf.heads()[CAST.hatice.castId];
      expect(JSON.stringify(before)).toContain('simplify-fixture');
      await page.locator('[data-action="menu"]').click();
      rejected = true;
      await page.getByRole('button', { name: 'New game', exact: true }).click();
      await page.getByRole('button', { name: 'Start new game', exact: true }).click();
      if (lostReply) {
        await expect.poll(() => shelf.writes()).toBe(2);
        expect(shelf.heads()[CAST.hatice.castId]).not.toBe(beforeHead);
        await page.clock.runFor(3500);
      }
      await page
        .getByText('This month could not start because its people could not be loaded safely.', {
          exact: false,
        })
        .last()
        .waitFor();
      expect(await saved()).toEqual(before);
      expect(await page.locator('.menu-sheet').innerText()).not.toContain('Shelf unavailable');
      expect(await page.locator('[data-action="people"]').count()).toBe(0);
    } finally {
      await browser.close();
    }
  }, 60_000);

for (const pending of [false, true]) {
  it(`ordinary Resume continues a saved ${pending ? 'pending pause' : 'pause'} without lab tools`, async () => {
    const run = await pausedRun(pending);
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    try {
      const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });
      await fixture(context, () => false);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto(origin);
      await page.evaluate(async (run) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const r = indexedDB.open('goodhands', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('pages');
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('pages', 'readwrite');
          tx.objectStore('pages').put({ plain: JSON.stringify(run), at: Date.now() }, 'run');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      }, run);
      await page.goto(origin);
      await page.getByRole('button', { name: 'Resume', exact: true }).click({ timeout: 60000 });
      await page.getByTestId('office').waitFor();
      // Use an action available at the saved time, rather than an opening-only applicant.
      if (pending) await page.locator('[data-action="phone"]').click();
      else {
        await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
        await page.locator('[data-action="interview"]').click();
      }
      expect(await page.getByTestId('scene').count()).toBe(1);
      await page.locator('[data-action="menu"]').click();
      await page.getByRole('button', { name: 'Feedback', exact: true }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Keep a copy of this run ⤓', exact: true }).click();
      const stream = await (await download).createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const json = Buffer.concat(chunks).toString('utf8');
      const exported = JSON.parse(json);
      expect(exported).not.toHaveProperty('state');
      const decoded = verifyImport(json);
      expect(decoded.state.castPaused).toBe(false);
      expect(decoded.state.castPauseRequested).toBe(false);
      expect(exported.inputs.some((i: { input: { type: string } }) => i.input.type === 'resume-cast')).toBe(
        true,
      );
      expect(await page.locator('[data-action="people"]').count()).toBe(0);
    } catch (error) {
      console.error('Resume browser failure:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }, 120000);
}
