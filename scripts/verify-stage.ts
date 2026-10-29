/** Browser checks for the UI grammar. Later state imports stay replay verified. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { advance, apply, newGame, view } from '../src/sim/index.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';

const phaseStart = performance.now();
const phase = (stage: string) =>
  console.log(JSON.stringify({ stage, milliseconds: Math.round(performance.now() - phaseStart) }));
const port = Number(process.argv[2] ?? 4492);
phase('prepare current opening import');
const current = newGame(1);
const currentRun = exportRun(current, current.inputs);
verifyImport(JSON.stringify(currentRun));
phase('prepare historical early ending');
const early = newGame(1, 4);
for (let n = 0; n < 2000 && !view(early).ended; n++) advance(early, 40000);
assert.equal(view(early).dateLabel, 'Friday 13 November');
const earlyRun = exportRun(early, []);
verifyImport(JSON.stringify(earlyRun));
phase('fixtures ready');
const server = await createServer({
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
try {
  for (const viewport of [
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ]) {
    phase(`viewport ${viewport.width}`);
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const NativeObserver = ResizeObserver;
      const active = new Set<ResizeObserver>();
      let mounts = 0;
      Object.assign(window, { stageProbe: () => ({ active: active.size, mounts }) });
      window.ResizeObserver = class extends NativeObserver {
        override observe(target: Element, options?: ResizeObserverOptions) {
          if (target.matches('.game')) {
            active.add(this);
            mounts++;
          }
          super.observe(target, options);
        }
        override disconnect() {
          active.delete(this);
          super.disconnect();
        }
      };
    });
    const lifecycle = () =>
      page.evaluate(() =>
        (window as unknown as { stageProbe: () => { active: number; mounts: number } }).stageProbe(),
      );
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByRole('button', { name: 'Open the office', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const fits = async (name: string) => {
      const geometry = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        innerHeight,
        innerWidth,
      }));
      assert.ok(geometry.height <= geometry.innerHeight, `${name}: page height ${geometry.height}`);
      assert.ok(geometry.width <= geometry.innerWidth, `${name}: page width ${geometry.width}`);
      assert.equal(await page.locator('[data-action="info"]').count(), 1);
      assert.equal(await page.locator('[data-action="menu"]').count(), 1);
      assert.equal(await page.locator('dialog dialog').count(), 0);
      // This regression uses DOM assertions; simplify QA owns the screenshot budget.
    };
    const hitTargets = async (selector: string) => {
      for (const control of await page.locator(selector).all()) {
        if (!(await control.isVisible())) continue;
        // Questions scroll inside the sheet; bring each target into its scrollport.
        await control.scrollIntoViewIfNeeded();
        const r = await control.boundingBox();
        if (!r || r.y < 0 || r.y + r.height > viewport.height) continue;
        assert.ok(r.height >= 44 && r.width >= 44, `44px: ${await control.textContent()}`);
        assert.ok(
          await control.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
          `unintercepted: ${await control.textContent()}`,
        );
      }
    };
    await fits('start');
    await hitTargets('[data-action="menu"]');
    if (viewport.width >= 900) {
      assert.ok(
        await page.locator('.menu-label').evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getClientRects().length === 1;
        }),
        'desktop Menu stays on one line',
      );
    }
    await page.getByRole('button', { name: 'Open the office', exact: true }).click();
    // Opening now awaits durable admission. Observe its actual mount before checking stage ownership.
    await page.getByTestId('office').waitFor();
    await fits('office');
    assert.deepEqual(await lifecycle(), { active: 1, mounts: 1 });
    const checkStage = async () => {
      // Resize observers report on the next rendering step, so let one pass before reading the bounds.
      await page.waitForTimeout(50);
      assert.ok(
        await page.locator('.game').evaluate((el) => {
          const scene = el.querySelector('.lk-scene')!.getBoundingClientRect();
          const style = (el as HTMLElement).style;
          return ['x', 'y', 'width', 'height'].every(
            (key) =>
              Math.abs(
                Number.parseFloat(style.getPropertyValue(`--lk-scene-${key}`)) -
                  scene[key as 'x' | 'y' | 'width' | 'height'],
              ) < 1,
          );
        }),
        'controller reports the actual scene bounds',
      );
      const canvas = await page.locator('#office').evaluate((el) => ({
        width: (el as HTMLCanvasElement).width,
        expected: Math.round(el.clientWidth * devicePixelRatio),
      }));
      assert.equal(canvas.width, canvas.expected, 'controller resize redraws the actual canvas');
      assert.equal(await page.locator('.game').getAttribute('data-sheet'), 'fit');
      assert.ok(await page.locator('.game').getAttribute('data-sheet-id'));
    };
    await checkStage();
    const historyLength = await page.evaluate(() => history.length);
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 40 });
    await page.waitForTimeout(50);
    await checkStage();
    await page.setViewportSize(viewport);
    await page.waitForTimeout(50);
    await checkStage();
    await page.getByRole('button', { name: 'Gülce Aksoy', exact: true }).click();
    await fits('candidate');
    assert.equal(await page.locator('.candidate-actions button').count(), 5);
    assert.equal(
      await page.locator('[data-action="references"]').getAttribute('aria-description'),
      'This takes about 15 minutes.',
    );
    await page.locator('[data-action="interview"]').click();
    await fits('interview');
    // A pace line that wraps moves the scene without resizing it. Keep it long through the menu and Feedback.
    const longPace = await page.addStyleTag({
      content: `[data-pace]::after { content: ' A much longer pace line wraps the state strip onto more lines at every width.'; }`,
    });
    const sceneName = await page.locator('[data-testid="scene"]').getAttribute('aria-label');
    const held = await page.locator('[data-time]').innerText();
    await page.clock.runFor(3000);
    assert.equal(await page.locator('[data-time]').innerText(), held);
    await page.locator('[data-action="more-choices"]').click();
    await fits('questions');
    await hitTargets('.scene-sheet button');
    await page.getByRole('button', { name: 'Fewer', exact: true }).click();
    await page.locator('[data-action="menu"]').click();
    await fits('menu');
    await page.clock.runFor(3000);
    assert.equal(await page.locator('[data-time]').innerText(), held);
    await page.getByRole('button', { name: 'Slow', exact: true }).click();
    await page.getByRole('button', { name: 'The day’s notes', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Close menu', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(
      await page
        .getByRole('button', { name: 'The day’s notes', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    await fits('feedback');
    assert.equal(await page.locator('.desk-sheet').isVisible(), false);
    assert.ok(sceneName);
    assert.equal(await page.getByRole('region', { name: sceneName, exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Close menu', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    await checkStage();
    await longPace.evaluate((el) => (el as Element).remove());
    await checkStage();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Keep a copy of this run ⤓', exact: true }).click();
    const stream = await (await pending).createReadStream();
    let json = '';
    for await (const chunk of stream) json += chunk.toString();
    const downloaded = verifyImport(json);
    assert.equal(downloaded.inputs.filter((i) => i.input.type === 'speed').length, 0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(
      await page.locator('[data-action="menu"]').evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await page.getByRole('button', { name: 'Close menu', exact: true }).count(), 0);
    assert.equal(await page.locator('.desk-sheet').isVisible(), true);
    await page.locator('[data-action="info"]').click();
    await page.clock.runFor(3000);
    assert.equal(await page.locator('[data-time]').innerText(), held);
    await page.keyboard.press('Escape');
    assert.deepEqual(await lifecycle(), { active: 1, mounts: 1 });
    // Reuse the publicly replayed current-edition opening import at both viewports.
    phase('import current opening');
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'To the title page', exact: true }).click();
    assert.equal((await lifecycle()).active, 0);
    await page.locator('[data-action="menu"]').click();
    page.on('dialog', (dialog) => void dialog.accept());
    await page.locator('[data-open-saved]').click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="import"]').click();
    await (await chooser).setFiles({
      name: 'fixture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(currentRun)),
    });
    await page.waitForTimeout(50);
    await fits('imported');
    // The natural two-rent calendar/date fixture is the historical edition 4.
    phase('import historical early ending');
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'To the title page', exact: true }).click();
    await page.locator('[data-action="menu"]').click();
    await page.locator('[data-open-saved]').click();
    const earlyChooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="import"]').click();
    await (await earlyChooser).setFiles({
      name: 'early-ending.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(earlyRun)),
    });
    await page.locator('.review').waitFor();
    assert.equal(await page.locator('.topbar-label').innerText(), 'Month’s end · 13 Nov');
    await fits('early-ending');
    phase('historical early ending imported');
    assert.equal((await lifecycle()).active, 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`UI grammar verified; DOM assertions only`);
} finally {
  await browser.close();
  await server.close();
}
