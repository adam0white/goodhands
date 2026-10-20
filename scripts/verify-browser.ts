/** Built-preview phone acceptance. Run: node scripts/verify-browser.ts [port=4410]. Real clock only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { chromium, type Locator } from 'playwright-core';
import { preview } from 'vite';
import { fingerprint } from '../src/sim/index.ts';
import { compactRun, type RunExport, verifyImport } from '../src/ui/export.ts';

const started = performance.now();
const port = Number(process.argv[2] ?? 4410);
execFileSync(process.execPath, ['scripts/stamp-release.ts'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
const shots = 'scratch/shots';
mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 360, height: 690 },
    isMobile: true,
    hasTouch: true,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const bounds: Record<string, unknown> = {};
  const fits = async (label: string, locator: Locator, touch = false) => {
    assert.ok(await locator.count(), `${label} exists`);
    const boxes = await locator.evaluateAll((elements) =>
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return {
          text: element.textContent,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      }),
    );
    assert.ok(
      boxes.every((b) => b.x >= 0 && b.y >= 0 && b.right <= 360 && b.bottom <= 690),
      `${label}: ${JSON.stringify(boxes)}`,
    );
    if (touch)
      assert.ok(
        boxes.every((b) => b.width >= 44 && b.height >= 44),
        `${label} has 44px targets: ${JSON.stringify(boxes)}`,
      );
    bounds[label] = boxes;
  };
  const open = async () => {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByRole('button', { name: 'New month', exact: true }).click();
    await page.getByRole('button', { name: 'Open the office', exact: true }).click();
    await page.getByTestId('office').waitFor();
    await Promise.race([
      page.evaluate(() => document.fonts.ready.then(() => undefined)),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
  };
  await open();
  await fits('Task', page.getByTestId('task'));
  await fits('bench', page.getByTestId('bench'));
  await page.getByRole('button', { name: 'Task', exact: true }).click({ trial: true });
  for (const name of ['Gül', 'Sevda', 'Pınar']) {
    const candidate = page.getByRole('button', { name, exact: true });
    await fits(name, candidate, true);
    await candidate.click({ trial: true });
  }
  await page.screenshot({ path: `${shots}/01-office.png` });
  await page.getByRole('button', { name: 'Sevda', exact: true }).click();
  await page.getByRole('button', { name: /^Interview/ }).click();
  await page.getByTestId('scene').waitFor();
  await fits('scene', page.getByTestId('scene'));
  await fits('scene choices', page.getByTestId('scene-choice'), true);
  await fits('scene Task', page.getByTestId('task'));
  await fits('scene bench', page.getByTestId('bench'));
  await page.screenshot({ path: `${shots}/02-interview.png` });
  await page.getByTestId('scene-choice').first().click();
  await fits('answer scene', page.getByTestId('scene'));
  await fits('all answer controls', page.getByTestId('scene').getByRole('button'), true);
  await fits('answer choices', page.getByTestId('scene-choice'), true);
  await fits('answer Task', page.getByTestId('task'));
  await fits('answer bench', page.getByTestId('bench'));
  await page.screenshot({ path: `${shots}/03-answer.png` });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal overflow',
  );
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this run', exact: true }).click();
  await (await downloadEvent).saveAs(`${shots}/downloaded-run.json`);
  const run = JSON.parse(readFileSync(`${shots}/downloaded-run.json`, 'utf8')) as RunExport;
  for (const exported of [run, compactRun(run)]) {
    const imported = verifyImport(JSON.stringify(exported));
    assert.equal(fingerprint(imported.state), run.fingerprint, 'Downloaded and compact runs replay');
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('.sheet-status').filter({ hasText: 'Saved this month.' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/08-continue.png` });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByTestId('scene').waitFor();
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 690 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '34px';
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `No horizontal overflow at ${width}px and 200% text`,
    );
    await page.screenshot({ path: `${shots}/reflow-${width}-200.png`, fullPage: true });
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '17px';
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: `${shots}/14-dark.png` });
  assert.deepEqual(errors, []);
  const seconds = Math.round((performance.now() - started) / 10) / 100;
  writeFileSync(
    `${shots}/acceptance.json`,
    JSON.stringify({ viewport: [360, 690], realClock: true, seconds, bounds, errors }, null, 2),
  );
  console.log(`Phone acceptance passed in ${seconds}s. Evidence: ${shots}/`);
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
