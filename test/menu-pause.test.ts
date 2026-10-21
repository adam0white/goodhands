import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(server.resolvedUrls?.local[0] ?? '');
  await page.getByRole('button', { name: 'New month', exact: true }).click();
  await page.getByRole('button', { name: 'Open the office', exact: true }).click();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

it('holds options and Game menu time, then resumes without adding an input', async () => {
  const clock = page.locator('[data-time]');
  const before = await clock.innerText();
  await page.locator('[data-action="time"]').click();
  await page.clock.runFor(6000);
  expect(await clock.innerText()).toBe(before);
  await page.keyboard.press('Escape');
  await page.clock.runFor(1000);
  expect(await clock.innerText()).not.toBe(before);
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  const held = await clock.innerText();
  await page.clock.runFor(6000);
  expect(await clock.innerText()).toBe(held);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this run', exact: true }).click();
  const stream = await (await pending).createReadStream();
  let json = '';
  for await (const chunk of stream) json += chunk.toString();
  const run = JSON.parse(json);
  expect(run.inputs).toEqual([]);
  await page.keyboard.press('Escape');
  await page.clock.runFor(1000);
  expect(await clock.innerText()).not.toBe(held);
});
