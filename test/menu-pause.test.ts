import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`${server.resolvedUrls?.local[0]}?lab=1`);
  await page.getByRole('button', { name: 'Lab tools', exact: true }).click();
  await page.getByRole('button', { name: 'People between games', exact: true }).click();
  await page.getByRole('button', { name: 'Start a fresh month without history', exact: true }).click();
}, 60_000); // Cold Vite/Chrome startup can exceed Vitest's default ten-second hook on CI.
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('holds the menu and information, then resumes without speed inputs', async () => {
  const clock = page.locator('[data-time]');
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  const held = await clock.innerText();
  await page.clock.runFor(6000);
  expect(await clock.innerText()).toBe(held);
  await page.getByRole('button', { name: 'Fast', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Information', exact: true }).click();
  await page.clock.runFor(3000);
  expect(await clock.innerText()).toBe(held);
  await page.keyboard.press('Escape');
  await page.clock.runFor(1000);
  expect(await clock.innerText()).not.toBe(held);
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await page.getByRole('button', { name: 'Feedback', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Keep a copy of this run ⤓', exact: true }).click();
  const stream = await (await pending).createReadStream();
  let json = '';
  for await (const chunk of stream) json += chunk.toString();
  expect(JSON.parse(json).inputs).toEqual([]);
});
it('expands interview questions inside the sheet and keeps the transcript', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
  await page.locator('[data-action="interview"]').click();
  await page.locator('[data-action="more-choices"]').click();
  expect(await page.locator('dialog').count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Fewer', exact: true }).isVisible()).toBe(true);
  await page.locator('[data-choice="wage"]').click();
  expect(await page.locator('[data-action="fewer-choices"]').count()).toBe(0);
  expect(await page.locator('.exchange [data-scene-line]').count()).toBeGreaterThan(1);
  const held = await page.locator('[data-time]').innerText();
  await page.clock.runFor(3000);
  expect(await page.locator('[data-time]').innerText()).toBe(held);
  expect(await page.locator('[data-pace]').innerText()).toContain('Gülce Aksoy is talking');
});
