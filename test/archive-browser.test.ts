import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { newGame } from '../src/sim/index.ts';
import { exportRun } from '../src/ui/export.ts';

it('verifies a complete archive in a worker and preserves the month on cancellation', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.getByRole('button', { name: 'Open the office' }).click();
    await page.getByTestId('office').waitFor();
    await page.locator('[data-action="menu"]').click();
    const download = async () => {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download this run' }).click();
      return JSON.parse(await readFile(await (await pending).path(), 'utf8')) as { seed: number };
    };
    const before = await download();
    await page.getByRole('button', { name: 'Verify and import complete source archive' }).click();
    const select = async () => {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Choose archive' }).click();
      await (await chooser).setFiles({
        name: 'archive.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(exportRun(newGame(7), []))),
      });
    };
    page.once('dialog', (dialog) => dialog.dismiss());
    await select();
    await page.getByText('Archive verified and ready to import.').waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Verify and import complete source archive' }).click();
    await select();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForTimeout(1000);
    expect(await download()).toEqual(before);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByTestId('office').waitFor();
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'Verify and import complete source archive' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await select();
    await page.getByText('The verified archive has loaded.').waitFor({ state: 'attached', timeout: 60000 });
    await page.getByTestId('office').waitFor();
    await page.locator('[data-action="menu"]').click();
    expect((await download()).seed).toBe(7);
  } finally {
    await browser.close();
    await server.close();
  }
}, 120_000);
