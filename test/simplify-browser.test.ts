/** Local UI and admission fixtures. These are not real shared-shelf or player journeys. */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import {
  acceptPersona,
  acceptPersonaBatch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  portableWriteBlockers,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { type BrowserContext, chromium, type Page, webkit } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ALLOCATION, CAST } from '../src/sim/cast.ts';
import { agencyTransfer } from '../src/sim/cast-chapter.ts';
import { ENGINE_VERSION } from '../src/sim/hf4.ts';
import { apply, newGame } from '../src/sim/index.ts';
import { exportRun, type RunExport, verifyImport } from '../src/ui/export.ts';
import { closeFixtureBrowser, routeFixture } from './browser-fixture.ts';
import { pausedRun } from './paused-run.ts';

let server: ViteDevServer;
let local: string;
// Synthetic-only transport diagnostics. They do not replace navigation readiness or assertions.
const transport = new Map<
  string,
  { at: number; method: string; url: string; headers: Record<string, string> }
>();
const httpPending = new Map<string, { at: number; method: string; url: string }>();
const transportEvents: unknown[] = [];
let transportId = 0;
function trace(event: string, detail: unknown) {
  const entry = { at: Date.now(), event, detail };
  transportEvents.push(entry);
  if (transportEvents.length > 80) transportEvents.shift();
  if (process.env.GH_FIXTURE_DIAGNOSTICS) console.error('GH_TRANSPORT', JSON.stringify(entry));
}
async function fixtureReload(page: Page) {
  trace('reload-start', { url: page.url() });
  try {
    await page.reload();
    trace('reload-load', { url: page.url() });
  } catch (error) {
    try {
      const cache = `${server.config.cacheDir}/deps/_metadata.json`;
      const pending = {
        at: Date.now(),
        error: String(error),
        url: page.url(),
        pendingRoutes: [...transport.values()],
        pendingHttp: [...httpPending.values()],
        optimizer: existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : null,
        modules: [...server.moduleGraph.idToModuleMap.values()]
          .filter((m) => !m.transformResult)
          .map((m) => ({ url: m.url, id: m.id })),
        events: [...transportEvents],
        pageState: await Promise.race([
          page
            .evaluate(() => ({
              readyState: document.readyState,
              title: document.title,
              text: document.body?.textContent,
              scripts: [...document.scripts].map((s) => s.src),
            }))
            .catch((error) => ({ observationError: String(error) })),
          new Promise((resolve) => setTimeout(() => resolve({ observationTimedOut: true }), 500)),
        ]),
      };
      console.error('Synthetic reload failure before fixture teardown', JSON.stringify(pending));
    } catch (observationError) {
      console.error('Synthetic reload observation failed', {
        at: Date.now(),
        error: String(observationError),
      });
    }
    throw error;
  }
}
const origin = 'https://goodhands.adamwhite.work';
beforeAll(async () => {
  server = await createServer({
    // Keep the reader-certification fixture injectable while bundling its large HF dependencies.
    optimizeDeps: {
      exclude: ['@adam0white/lab-client'],
      include: [
        '@adam0white/human-framework/portable',
        '@adam0white/human-framework-legacy3',
        '@adam0white/lab-client > @adam0white/hf-legacy',
        '@adam0white/lab-client-legacy3 > @adam0white/human-framework',
      ],
    },
    plugins: [
      {
        name: 'synthetic-transport-diagnostics',
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            const id = String(++transportId);
            const item = { at: Date.now(), method: req.method ?? '', url: req.url ?? '' };
            httpPending.set(id, item);
            trace('http-start', item);
            res.on('finish', () => {
              trace('http-finish', { ...item, status: res.statusCode });
              httpPending.delete(id);
            });
            res.on('close', () => {
              trace('http-close', { ...item, finished: res.writableFinished });
              httpPending.delete(id);
            });
            next();
          });
        },
      },
    ],
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  });
  await server.listen();
  local = server.resolvedUrls!.local[0]!;
});
afterAll(async () => {
  if (httpPending.size || transport.size)
    console.error(
      'Synthetic Vite close with pending traffic',
      JSON.stringify({
        at: Date.now(),
        pendingHttp: [...httpPending.values()],
        pendingRoutes: [...transport.values()],
      }),
    );
  trace('server-close', { pendingHttp: [...httpPending.values()], pendingRoutes: [...transport.values()] });
  await server?.close();
});

async function fixture(context: BrowserContext, reject: () => boolean, carry = false, lostReply = false) {
  context.on('page', (page) => {
    page.on('framenavigated', (frame) =>
      trace('navigated', { url: frame.url(), main: frame === page.mainFrame() }),
    );
    page.on('domcontentloaded', () => trace('domcontentloaded', { url: page.url() }));
    page.on('load', () => trace('load', { url: page.url() }));
    page.on('requestfailed', (request) =>
      trace('requestfailed', { url: request.url(), failure: request.failure() }),
    );
    page.on('pageerror', (error) => trace('pageerror', String(error)));
    page.on('close', () => trace('page-close', { url: page.url() }));
  });
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
  const receivers: RunExport[] = [];
  // Synthetic admission observer. It sees committed host journals only; no
  // production certification or cross-origin ownership claim is made.
  await context.addInitScript(() => {
    const fixture = window as typeof window & { receivingPhases: Promise<string>[] };
    fixture.receivingPhases = [];
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'receiving' && (value.compressed || value.blob)) {
        this.transaction.addEventListener('error', (event) => {
          const target = event.target as IDBRequest;
          console.error('Journal transaction request failed', target.error?.name, target.error?.message);
        });
        fixture.receivingPhases.push(
          new Promise((resolve, reject) => {
            this.transaction.addEventListener('complete', () => {
              void new Response(
                (value.blob ?? new Blob([value.compressed]))
                  .stream()
                  .pipeThrough(new DecompressionStream('gzip')),
              )
                .text()
                .then((text) => resolve(JSON.parse(text).phase), reject);
            });
            this.transaction.addEventListener('abort', () => reject(new Error('Journal aborted')));
          }),
        );
      }
      return put.call(this, value, key);
    };
  });
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
      const persisted = await _source.page.evaluate(async () => {
        const modulePath = '/src/ui/store.ts';
        const storage = await (
          new Function('path', 'return import(path)') as (
            path: string,
          ) => Promise<typeof import('../src/ui/store.ts')>
        )(modulePath);
        const fixture = window as typeof window & { receivingPhases: Promise<string>[] };
        return { journal: await storage.readReceiving(), phases: await Promise.all(fixture.receivingPhases) };
      });
      expect(persisted.journal?.phase).toBe('sending');
      if (carry) expect(persisted.phases).toContain('prepared');
      expect(persisted.journal?.run.state).toBeTruthy();
      expect(persisted.journal?.run.continuity?.initialClaims).toEqual(message.envelopes ?? []);
      expect(persisted.journal?.expectedHeads).toEqual(message.expectedHeads);
      receivers.push(structuredClone(persisted.journal!.run));
      if (carry)
        expect(
          persisted.journal?.run.continuity?.chapter?.skipped?.map((p: { castId: string }) => p.castId),
        ).toContain(CAST.hulya.castId);
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
                blocked: carry
                  ? [{ castId: CAST.hulya.castId, reason: 'Synthetic unavailable person.' }]
                  : [],
              }
            : true,
    };
  });
  await routeFixture(context, async (route) => {
    const id = String(++transportId);
    const entry = {
      at: Date.now(),
      method: route.request().method(),
      url: route.request().url(),
      resourceType: route.request().resourceType(),
      navigation: route.request().isNavigationRequest(),
      headers: route.request().headers(),
      stage: 'routed',
      status: undefined as number | undefined,
    };
    transport.set(id, entry);
    trace('route-start', entry);
    try {
      const url = new URL(route.request().url());
      if (
        route.request().method() === 'POST' &&
        url.origin === 'https://human.adamwhite.work' &&
        url.pathname.startsWith('/lab/api/')
      )
        return await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ id: 'local-stored-receipt', ok: true }),
        });
      if (route.request().method() === 'POST' && url.hostname.endsWith('adamwhite.work'))
        return await route.abort();
      if (url.origin === origin && url.pathname === '/@vite/client')
        return await route.fulfill({
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
        entry.stage = 'fetching-vite';
        const response = await route.fetch({
          url: `${local.replace(/\/$/, '')}${url.pathname}${url.search}`,
        });
        entry.stage = 'fulfilling-vite';
        entry.status = response.status();
        if (carry && url.pathname.endsWith('/portable-readers.js')) {
          // Synthetic certifications for these in-memory transport fixtures only; not deployment evidence.
          const readers = Object.fromEntries(
            ALLOCATION.flatMap((person) => portableWriteBlockers(person.castId, 'goodhands')).map((game) => [
              game,
              { client: '0.5.7', perPersonSkips: true },
            ]),
          );
          const source = await response.text();
          const fixtureSource = source.replace(
            'export const PORTABLE_READERS = {};',
            `export const PORTABLE_READERS = ${JSON.stringify(readers)};`,
          );
          expect(fixtureSource).not.toBe(source);
          return await route.fulfill({ response, body: fixtureSource });
        }
        return await route.fulfill({ response });
      }
      if (url.origin === 'https://human.adamwhite.work' && url.pathname === '/lab/identity/')
        return await route.fulfill({
          contentType: 'text/html',
          body: `<script>addEventListener('message', async e => {
        if (e.data?.type !== 'hf-persona-consent' && e.data?.type !== 'hf-persona-request') return;
        const result = await window.shelfFixtureReply(e.data);
        if (result === null) return;
        if (e.ports[0]) e.ports[0].postMessage(result); else e.source.postMessage(result, e.origin);
      });</script>`,
        });
      return await route.continue();
    } catch (error) {
      console.error(
        'Synthetic route failure',
        JSON.stringify({
          ...entry,
          failedAt: Date.now(),
          error: String(error),
          failure: route.request().failure(),
          httpPending: [...httpPending.values()],
        }),
      );
      trace('route-error', { ...entry, error: String(error), failure: route.request().failure() });
      // Navigation/teardown can abort a routed Vite fetch. Ignore only an
      // already-handled route with an actual browser-reported request failure.
      if (
        error instanceof Error &&
        error.message.includes('Route is already handled') &&
        route.request().failure()
      )
        return;
      throw error;
    } finally {
      trace('route-end', entry);
      transport.delete(id);
    }
  });
  return {
    writes: () => writes,
    heads: () => structuredClone(backend.heads),
    receivers: () => structuredClone(receivers),
  };
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
          const consoleLines: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => consoleLines.push(`${message.type()}: ${message.text()}`));
          await page.clock.install();
          await page.clock.pauseAt(new Date());
          await page.goto(origin);
          await page.evaluate(() => document.fonts.ready);
          expect(await page.locator('[data-action="other-ways"]').count()).toBe(0);
          await page.getByRole('button', { name: 'Open the office', exact: true }).click();
          try {
            await page.getByTestId('office').waitFor();
          } catch (error) {
            console.error('Startup diagnostics', {
              errors,
              consoleLines,
              body: await page.locator('body').innerText(),
            });
            throw error;
          }
          await page.locator('[data-action="info"]').click();
          expect(await page.locator('.info-panel').innerText()).toContain(
            'Agency fees help you pay the rent.',
          );
          await page.keyboard.press('Escape');
          await page.locator('[data-action="menu"]').click();
          const menu = page.locator('.menu-sheet');
          expect(await menu.locator('[data-pace-choice]').count()).toBe(4);
          expect(await menu.locator('[data-theme-choice]').count()).toBe(3);
          expect(await menu.getByRole('link', { name: 'People across games' }).getAttribute('href')).toBe(
            'https://human.adamwhite.work/lab/people/',
          );
          expect(await menu.locator('.debug-footer details').getAttribute('open')).toBeNull();
          expect(await menu.locator('[data-open-saved]').isVisible()).toBe(true);
          await menu.getByText('Debug', { exact: true }).click();
          expect(await menu.locator('[data-open-saved]').isVisible()).toBe(true);
          await menu.getByText('Debug', { exact: true }).click();
          await menu.locator('[data-open-saved]').click();
          expect(await page.getByRole('button', { name: 'Replace saved month' }).isVisible()).toBe(true);
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
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
          await closeFixtureBrowser(browser);
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
      page.on('pageerror', (error) => console.error('Admission page error', error.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error('Admission console', msg.text());
      });
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
                    (row?.blob || row?.compressed
                      ? await new Response(
                          (row.blob ?? new Blob([row.compressed]))
                            .stream()
                            .pipeThrough(new DecompressionStream('gzip')),
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
      expect(verifyImport(before as string).state).toEqual(shelf.receivers()[0]?.state);
      const beforeHead = shelf.heads()[CAST.hatice.castId];
      expect(JSON.stringify(before)).toContain('simplify-fixture');
      await page.locator('[data-action="menu"]').click();
      rejected = true;
      await page.getByRole('button', { name: 'New game', exact: true }).click();
      await page.getByRole('button', { name: 'Start new game', exact: true }).click();
      if (lostReply) {
        await expect
          .poll(() => shelf.writes(), { timeout: 20000, message: 'Wait for the second shelf transaction' })
          .toBe(2)
          .catch(async (error) => {
            console.error('Batch transaction diagnostic:', await page.locator('body').innerText());
            throw error;
          });
        expect(shelf.heads()[CAST.hatice.castId]).not.toBe(beforeHead);
        await page.clock.runFor(3500);
      }
      await page
        .getByText('This month could not finish opening.', {
          exact: false,
        })
        .last()
        .waitFor();
      expect(await saved()).toEqual(before);
      expect(await page.locator('.menu-sheet').innerText()).not.toContain('Shelf unavailable');
      expect(await page.locator('[data-action="people"]').count()).toBe(0);
      await page.reload();
      await page.getByText('Whether its people were accepted is unknown.', { exact: false }).waitFor();
      expect(await saved()).toEqual(before);
      const artifact = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download the prepared month', exact: true }).click();
      const stream = await (await artifact).createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(chunk);
      const recovered = verifyImport(Buffer.concat(chunks).toString());
      expect(recovered.continuity.initialClaims?.length).toBe(1);
      expect(recovered.continuity.chapter?.skipped?.some((p) => p.castId === CAST.hulya.castId)).toBe(true);
    } finally {
      await closeFixtureBrowser(browser);
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
      await closeFixtureBrowser(browser);
    }
  }, 120000);
}

for (const mode of ['abort', 'cancel'] as const) {
  it(`synthetic receiving ${mode} leaves the native save and sends no shelf write`, async () => {
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    try {
      const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });
      const shelf = await fixture(context, () => false, true);
      await context.addInitScript((scenario) => {
        const state = window as typeof window & { receivingAttempt?: boolean; receivingPrepared?: boolean };
        addEventListener('unhandledrejection', (event) => event.preventDefault());
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, key) {
          const result = put.call(this, value, key);
          if (key === 'receiving' && !state.receivingAttempt) {
            state.receivingAttempt = true;
            if (scenario === 'abort') queueMicrotask(() => this.transaction.abort());
            else
              this.transaction.addEventListener('complete', () => {
                state.receivingPrepared = true;
                dispatchEvent(new Event('hf-persona-preference'));
              });
          }
          return result;
        };
      }, mode);
      const page = await context.newPage();
      await page.goto(origin);
      const sentinel = { syntheticOriginal: 'unchanged' };
      await page.evaluate(async (value) => {
        const store = await (
          new Function('return import("/src/ui/store.ts")') as () => Promise<
            typeof import('../src/ui/store.ts')
          >
        )();
        if (!(await store.put('run', value))) throw new Error('Could not seed synthetic native save.');
      }, sentinel);
      await page.getByRole('button', { name: 'Open the office', exact: true }).click();
      await expect
        .poll(
          () =>
            page.evaluate(() => (window as typeof window & { receivingAttempt?: boolean }).receivingAttempt),
          { timeout: 30000 },
        )
        .toBe(true);
      if (mode === 'cancel')
        await expect
          .poll(() =>
            page.evaluate(
              () => (window as typeof window & { receivingPrepared?: boolean }).receivingPrepared,
            ),
          )
          .toBe(true);
      await page.waitForTimeout(500);
      expect(shelf.writes()).toBe(0);
      const inspect = () =>
        page.evaluate(async () => {
          const store = await (
            new Function('return import("/src/ui/store.ts")') as () => Promise<
              typeof import('../src/ui/store.ts')
            >
          )();
          return { native: (await store.get('run'))?.value, journal: await store.readReceiving() };
        });
      const beforeReload = await inspect();
      expect(beforeReload.native).toEqual(sentinel);
      expect(beforeReload.journal?.phase ?? null).toBe(mode === 'cancel' ? 'prepared' : null);
      await page.reload();
      const afterReload = await inspect();
      expect(afterReload.native).toEqual(sentinel);
      expect(afterReload.journal?.phase ?? null).toBe(mode === 'cancel' ? 'prepared' : null);
      expect(shelf.writes()).toBe(0);
    } finally {
      await closeFixtureBrowser(browser);
    }
  }, 60_000);
}

for (const denial of ['open', 'capture'] as const) {
  it(`synthetic ${denial} storage denial permits replayable local play without native or shared writes`, async () => {
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    try {
      const context = await browser.newContext({ viewport: { width: 360, height: 690 } });
      const shelf = await fixture(context, () => false, true);
      await context.addInitScript((mode) => {
        const denied = () => sessionStorage.getItem('synthetic-deny-native') === '1';
        const open = IDBFactory.prototype.open;
        IDBFactory.prototype.open = function (...args) {
          if (mode === 'open' && args[0] === 'goodhands' && denied())
            throw new DOMException('Synthetic storage denial.', 'SecurityError');
          return open.apply(this, args);
        };
        const transaction = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
          if (mode === 'capture' && this.name === 'goodhands' && args[1] === 'readwrite' && denied())
            throw new DOMException('Synthetic capture denial.', 'SecurityError');
          return transaction.apply(this, args);
        };
      }, denial);
      const page = await context.newPage();
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto(origin);
      const sentinel = { syntheticOriginal: 'retained while storage denied' };
      await page.evaluate(async (value) => {
        const store = await (
          new Function('return import("/src/ui/store.ts")') as () => Promise<
            typeof import('../src/ui/store.ts')
          >
        )();
        if (!(await store.put('run', value))) throw new Error('Synthetic save setup failed.');
        sessionStorage.setItem('synthetic-deny-native', '1');
      }, sentinel);
      await page.reload();
      await page.getByRole('button', { name: 'Open the office', exact: true }).click();
      await page.getByTestId('office').waitFor();
      await page
        .getByText('This month stays in this tab because this browser cannot save.', { exact: false })
        .waitFor();
      expect(shelf.writes()).toBe(0);
      // Storage recovering does not authorize replacing data that was unreadable.
      await page.evaluate(() => sessionStorage.removeItem('synthetic-deny-native'));
      await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
      await page.locator('[data-action="interview"]').click();
      await page.locator('[data-action="more-choices"]').click();
      await page.locator('[data-choice="wage"]').click();
      await page.locator('[data-action="menu"]').click();
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download this run', exact: true }).click();
      const stream = await (await pending).createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(chunk);
      const json = Buffer.concat(chunks).toString();
      const decoded = verifyImport(json);
      expect(JSON.parse(json).state).toEqual(decoded.state);
      expect(decoded.inputs.length).toBeGreaterThan(0);
      expect(decoded.continuity.initialClaims).toEqual([]);
      await page.getByRole('button', { name: 'Open a saved month…', exact: true }).click();
      expect(await page.getByRole('button', { name: 'Replace saved month', exact: true }).count()).toBe(0);
      expect(await page.getByRole('link', { name: 'Play in this tab only', exact: true }).isVisible()).toBe(
        true,
      );
      expect(
        await page.getByRole('button', { name: 'Verify and import complete source archive' }).count(),
      ).toBe(0);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'What happens to these people next', exact: true }).click();
      expect(
        await page.getByText('Its people are not shared with other games.', { exact: false }).isVisible(),
      ).toBe(true);
      expect(await page.getByRole('button', { name: /Save people’s stories|Pause and save/ }).count()).toBe(
        0,
      );
      await page.evaluate(() => dispatchEvent(new Event('pagehide')));
      const retained = await page.evaluate(async () => {
        const store = await (
          new Function('return import("/src/ui/store.ts")') as () => Promise<
            typeof import('../src/ui/store.ts')
          >
        )();
        return { native: (await store.get('run'))?.value, journal: await store.readReceiving() };
      });
      expect(retained).toEqual({ native: sentinel, journal: null });
      expect(shelf.writes()).toBe(0);
    } finally {
      await closeFixtureBrowser(browser);
    }
  }, 60_000);
}

for (const phase of ['sending', 'acknowledged'] as const)
  it(`a retained ${phase} opening permits explicit fresh tab-only play without retrying claims`, async () => {
    // Synthetic lost transport reply and retained native journal, not a peer journey.
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    try {
      const context = await browser.newContext({ viewport: { width: 360, height: 690 } });
      const shelf = await fixture(context, () => phase === 'sending', true, true);
      const page = await context.newPage();
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto(origin);
      if (phase === 'sending') {
        await page.getByRole('button', { name: 'Open the office', exact: true }).click();
        await expect.poll(() => shelf.writes(), { timeout: 20000 }).toBe(1);
        await page.clock.runFor(3500);
        await page.getByText('This month could not finish opening.', { exact: false }).waitFor();
      } else {
        // Synthetic acknowledged journal and actual native compare-and-swap conflict.
        await page.evaluate(
          async ({ run, prior, changed }) => {
            const store = await (
              new Function('return import("/src/ui/store.ts")') as () => Promise<
                typeof import('../src/ui/store.ts')
              >
            )();
            await store.put('run', prior);
            const journal = {
              id: 'synthetic-accepted-conflict',
              phase: 'prepared' as const,
              run,
              expectedHeads: {},
              priorNative: await store.captureNative(),
              createdAt: 1,
            };
            await store.retainReceiving(journal);
            await store.retainReceiving({ ...journal, phase: 'sending' });
            await store.retainReceiving({ ...journal, phase: 'acknowledged' });
            await store.put('run', changed);
          },
          {
            run: exportRun(newGame(81), []),
            prior: exportRun(newGame(82), []),
            changed: exportRun(newGame(83), []),
          },
        );
      }
      await fixtureReload(page);
      if (phase === 'sending')
        await page.getByText('Whether its people were accepted is unknown.', { exact: false }).waitFor();
      else {
        await page.getByRole('button', { name: 'Resume the accepted month', exact: true }).click();
        await page
          .getByText(
            'This month could not resume. Your saved month is unchanged. Download the accepted month to keep it separately.',
            {
              exact: true,
            },
          )
          .waitFor();
      }
      const inspect = () =>
        page.evaluate(async () => {
          const store = await (
            new Function('return import("/src/ui/store.ts")') as () => Promise<
              typeof import('../src/ui/store.ts')
            >
          )();
          return { native: (await store.get('run'))?.value ?? null, journal: await store.readReceiving() };
        });
      const original = await inspect();
      if (phase === 'sending') expect(original.native).toBeNull();
      else expect(original.native).toEqual(exportRun(newGame(83), []));
      expect(original.journal?.phase).toBe(phase);
      if (phase === 'sending') expect(original.journal?.run.continuity?.initialClaims?.length).toBe(1);
      await page.getByRole('button', { name: 'Start a fresh month in this tab', exact: true }).click();
      await page.getByTestId('office').waitFor();
      await page.getByText('This fresh month stays in this tab.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
      await page.locator('[data-action="interview"]').click();
      await page.locator('[data-action="more-choices"]').click();
      await page.locator('[data-choice="wage"]').click();
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download this run', exact: true }).click();
      const chunks: Buffer[] = [];
      for await (const chunk of await (await pending).createReadStream()) chunks.push(chunk);
      const json = Buffer.concat(chunks).toString();
      const restored = verifyImport(json);
      expect(restored.state).toEqual(JSON.parse(json).state);
      expect(restored.inputs.length).toBeGreaterThan(0);
      expect(restored.continuity.initialClaims).toEqual([]);
      await page.getByRole('button', { name: 'What happens to these people next', exact: true }).click();
      expect(await page.getByRole('button', { name: /Save people’s stories|Pause and save/ }).count()).toBe(
        0,
      );
      await page.evaluate(() => dispatchEvent(new Event('pagehide')));
      expect(await inspect()).toEqual(original);
      expect(shelf.writes()).toBe(phase === 'sending' ? 1 : 0);
      await fixtureReload(page);
      await page.getByRole('button', { name: 'Start a fresh month in this tab', exact: true }).waitFor();
      expect(await inspect()).toEqual(original);
      expect(shelf.writes()).toBe(phase === 'sending' ? 1 : 0);
    } finally {
      await closeFixtureBrowser(browser);
    }
  }, 60_000);

it('shows the named unavailable person in the office after opening and reload', async () => {
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 690 } });
    await fixture(context, () => false, true);
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole('button', { name: 'Open the office', exact: true }).click();
    await page.getByTestId('office').waitFor({ timeout: 30000 });
    expect(
      await page
        .getByTestId('office')
        .getByText(/Hülya.*could not come to the office this month/)
        .isVisible(),
    ).toBe(true);
    expect(await page.locator('.unavailable').getAttribute('role')).toBeNull();
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'What happens to these people next', exact: true }).click();
    expect(await page.locator('[data-source-status]').innerText()).toContain('Hülya could not come');
    expect(await page.locator('.sheet-content').innerText()).not.toMatch(
      /Synthetic unavailable|local cast|shelf|chapter|checkpoint|edition/,
    );
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByTestId('office').waitFor({ timeout: 30000 });
    expect(
      await page
        .getByTestId('office')
        .getByText(/Hülya.*could not come to the office this month/)
        .isVisible(),
    ).toBe(true);
  } finally {
    await closeFixtureBrowser(browser);
  }
}, 90000);
