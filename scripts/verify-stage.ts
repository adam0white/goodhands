/** Browser checks for the UI grammar. Later state imports stay replay verified. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { advance, apply, newGame, view } from '../src/sim/index.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';

const port = Number(process.argv[2] ?? 4492);
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
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto(`http://127.0.0.1:${port}/?lab=1`);
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
    await page.getByRole('button', { name: 'Lab tools', exact: true }).click();
    await page.getByRole('button', { name: 'People between games', exact: true }).click();
    await page.getByRole('button', { name: 'Start a fresh month without history', exact: true }).click();
    await fits('office');
    await page.getByRole('button', { name: 'Nanny applicant 01', exact: true }).click();
    await fits('candidate');
    assert.equal(await page.locator('.candidate-actions button').count(), 5);
    assert.equal(
      await page.locator('[data-action="references"]').getAttribute('aria-description'),
      'This takes about 15 minutes.',
    );
    await page.locator('[data-action="interview"]').click();
    await fits('interview');
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
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    await fits('feedback');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Keep a copy of this run ⤓', exact: true }).click();
    const stream = await (await pending).createReadStream();
    let json = '';
    for await (const chunk of stream) json += chunk.toString();
    const downloaded = verifyImport(json);
    assert.equal(downloaded.inputs.filter((i) => i.input.type === 'speed').length, 0);
    await page.keyboard.press('Escape');
    await page.locator('[data-action="info"]').click();
    await page.clock.runFor(3000);
    assert.equal(await page.locator('[data-time]').innerText(), held);
    await page.keyboard.press('Escape');
    // Fixture uses only public simulation actions; the import must replay unchanged.
    let fixture = newGame(1);
    for (let n = 0; n < 30 && !view(fixture).ended; n++) {
      const v = view(fixture);
      fixture = apply(
        fixture,
        v.dayCard
          ? { type: 'sleep' }
          : v.scene
            ? { type: 'close-scene', scene: v.scene.id }
            : { type: 'wait-for' },
      );
    }
    const run = exportRun(fixture, fixture.inputs);
    verifyImport(JSON.stringify(run));
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'To the title page', exact: true }).click();
    await page.getByRole('button', { name: 'Lab tools', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Load a playtest run', exact: true }).click();
    await (await chooser).setFiles({
      name: 'fixture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(run)),
    });
    await page.waitForTimeout(50);
    await fits('imported');
    // Two unpaid rents can end a month before the calendar's final day.
    const early = newGame(1);
    for (let n = 0; n < 2000 && !view(early).ended; n++) advance(early, 40000);
    assert.equal(view(early).dateLabel, 'Friday 13 November');
    const earlyRun = exportRun(early, []);
    verifyImport(JSON.stringify(earlyRun));
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'To the title page', exact: true }).click();
    await page.getByRole('button', { name: 'Lab tools', exact: true }).click();
    const earlyChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Load a playtest run', exact: true }).click();
    await (await earlyChooser).setFiles({
      name: 'early-ending.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(earlyRun)),
    });
    await page.locator('.review').waitFor();
    assert.equal(await page.locator('.topbar-label').innerText(), 'Month’s end · 13 Nov');
    await fits('early-ending');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`UI grammar verified; DOM assertions only`);
} finally {
  await browser.close();
  await server.close();
}
