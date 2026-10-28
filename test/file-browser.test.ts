/** Synthetic native sentinel and complete file continuation. No owner browser data. */
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { apply } from '../src/sim/index.ts';
import { compactRun } from '../src/ui/export.ts';
import { pausedRun } from './paused-run.ts';

it('uses the full game in /file/ without native DB or Shelf, and retains ordinary native Resume', async () => {
  const run = await pausedRun();
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const owned = await chromium.launchServer({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const browser = await chromium.connect(owned.wsEndpoint());
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, acceptDownloads: true });
    await page.addInitScript(() => {
      (window as typeof window & { nativeFileCalls: number }).nativeFileCalls = 0;
      const original = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args: Parameters<IDBFactory['open']>) => {
        if (location.pathname.startsWith('/file/') && args[0] === 'goodhands') {
          (window as typeof window & { nativeFileCalls: number }).nativeFileCalls++;
          throw new Error('NATIVE DB IN FILE MODE');
        }
        return original(...args);
      };
      const post = window.postMessage.bind(window);
      window.postMessage = ((message: unknown, ...rest: unknown[]) => {
        if (location.pathname.startsWith('/file/') && JSON.stringify(message).includes('hf-persona'))
          throw new Error('SHELF IN FILE MODE');
        return Reflect.apply(post, window, [message, ...rest]);
      }) as typeof window.postMessage;
      localStorage.setItem('hf-lab-player', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      localStorage.setItem('hf-lab-recording-off', '1');
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const base = server.resolvedUrls!.local[0]!;
    await page.goto(base);
    expect(
      await page.evaluate(`import('/src/ui/store.ts').then(({put}) => put('run', ${JSON.stringify(run)}))`),
    ).toBe(true);
    await page.goto(`${base}file/`);
    await page.getByRole('button', { name: 'Choose a run file', exact: true }).waitFor();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.evaluate(() => {
      const fixture = window as typeof window & {
        heldFrames: FrameRequestCallback[];
        oldFrames?: FrameRequestCallback[];
      };
      fixture.heldFrames = [];
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        fixture.heldFrames.push(callback);
        return raf(callback);
      };
    });
    let first = true;
    for (const data of [run, compactRun(run)]) {
      if (!first) await page.setViewportSize({ width: 1280, height: 800 });
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Choose a run file', exact: true }).click();
      await (await chooser).setFiles({
        name: 'synthetic.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(data)),
      });
      await page.getByRole('button', { name: 'Resume file', exact: true }).waitFor();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download current run', exact: true }).click();
      const artifact = await download;
      const stream = await artifact.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(chunk);
      expect(JSON.parse(Buffer.concat(chunks).toString()).state).toEqual(run.state);
      await page.getByRole('button', { name: 'Resume file', exact: true }).click();
      await page.getByTestId('office').waitFor();
      await page.evaluate((first) => {
        const fixture = window as typeof window & {
          heldFrames: FrameRequestCallback[];
          oldFrames?: FrameRequestCallback[];
        };
        if (first) fixture.oldFrames = fixture.heldFrames.slice();
        else for (const callback of fixture.oldFrames ?? []) callback(performance.now() + 500);
      }, first);
      first = false;
      await page.locator('[data-action="menu"]').click();
      expect(await page.locator('[data-action="import"]').isVisible()).toBe(true);
      expect(await page.locator('[data-action="title"]').isVisible()).toBe(true);
      expect(await page.locator('[data-action="download"]').isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Download original file' }).isVisible()).toBe(true);
      const continuedDownload = page.waitForEvent('download');
      await page.locator('[data-action="download"]').evaluate((b: HTMLButtonElement) => b.click());
      const continued = await (await continuedDownload).createReadStream();
      const continuedChunks: Buffer[] = [];
      for await (const chunk of continued!) continuedChunks.push(chunk);
      const continuedRun = JSON.parse(Buffer.concat(continuedChunks).toString());
      expect(continuedRun.state).toEqual(apply(structuredClone(run.state), { type: 'resume-cast' }));
      expect(continuedRun.inputs).toEqual([
        ...run.inputs,
        { at: run.minute, input: { type: 'resume-cast' } },
      ]);
      const geometry = await page.locator('[data-pace-choice="automatic"]').evaluate((b) => {
        const rect = b.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(b);
        return {
          lines: range.getClientRects().length,
          fits: b.scrollWidth <= b.clientWidth,
          width: rect.width,
        };
      });
      expect(geometry.lines).toBe(1);
      expect(geometry.fits).toBe(true);

      await page.locator('[data-action="title"]').evaluate((b: HTMLButtonElement) => b.click());
    }
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(
      await page.evaluate(() => (window as typeof window & { nativeFileCalls: number }).nativeFileCalls),
    ).toBe(0);
    expect(await page.locator('iframe[title="Fictional person shelf"]').count()).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('hf-lab-recording-off'))).toBe('1');
    expect(errors).toEqual([]);
    // Native positive: actual row, ordinary Resume and pagehide still persist replayable state.
    await page.goto(base);
    expect(
      await page.evaluate("import('/src/ui/store.ts').then(async ({get}) => (await get('run'))?.value)"),
    ).toEqual(run);
    await page.getByRole('button', { name: 'Resume', exact: true }).click({ timeout: 5000 });
    await page.getByTestId('office').waitFor();
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(
      "import('/src/ui/store.ts').then(async ({get}) => (await get('run'))?.value)",
    );
    expect(saved).toMatchObject({
      inputs: [...run.inputs, { at: run.minute, input: { type: 'resume-cast' } }],
    });
    expect(errors).toEqual([]);
  } finally {
    await owned.kill();
    await server.close();
  }
}, 60_000);
