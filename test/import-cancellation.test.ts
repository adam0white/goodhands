import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { pausedRun } from './paused-run.ts';

it('keeps the occupied native month when pagehide cancels a confirmed import during final validation', async () => {
  const run = await pausedRun(true);
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const ownedBrowser = await chromium.launchServer({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const browser = await chromium.connect(ownedBrowser.wsEndpoint());
    const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.getByRole('button', { name: 'Open the office', exact: true }).click();
    await page.getByTestId('office').waitFor();
    await page.locator('[data-action="menu"]').click();
    // Wait for the real native save made by the menu before taking its complete baseline.
    const nativeRun = () =>
      page.evaluate("import('/src/ui/store.ts').then(async ({get}) => (await get('run'))?.value)");
    await expect.poll(nativeRun).toBeTruthy();
    const original = await nativeRun();
    await page.evaluate(() => {
      const fixture = window as typeof window & { importHeld?: boolean; releaseImport?: () => void };
      window.confirm = () => {
        const digest = crypto.subtle.digest.bind(crypto.subtle);
        crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
          if (!fixture.importHeld) {
            fixture.importHeld = true;
            await new Promise<void>((resolve) => {
              fixture.releaseImport = resolve;
            });
          }
          return digest(...args);
        };
        return true;
      };
    });
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="import"]').click();
    await (await chooser).setFiles({
      name: 'confirmed-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(run)),
    });
    await page.waitForFunction(
      () => (window as typeof window & { importHeld?: boolean }).importHeld === true,
    );
    await page.evaluate(() => {
      dispatchEvent(new Event('pagehide'));
      (window as typeof window & { releaseImport?: () => void }).releaseImport?.();
    });
    // Let the actual digest/replay/IndexedDB continuation settle after the released gate.
    await page.waitForTimeout(1200);
    expect(await nativeRun()).toEqual(original);
  } finally {
    await ownedBrowser.kill();
    await server.close();
  }
}, 60_000);
