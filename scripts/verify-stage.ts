/** Built phone stage acceptance, using replay-verified public imports for later scenes. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Locator } from 'playwright-core';
import { preview } from 'vite';
import { apply, type Input, newGame, view } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

const port = Number(process.argv[2] ?? 4492);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
const out = join(homedir(), 'code/scratch-intake2/goodhands-stage');
mkdirSync(out, { recursive: true });
const results: object[] = [];
try {
  const page = await browser.newPage({
    viewport: { width: 360, height: 690 },
    isMobile: true,
    hasTouch: true,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tap = async (selector: string) => page.locator(selector).click();
  const visible = async (locator: Locator) => {
    assert.ok(await locator.count());
    for (const element of await locator.all()) {
      const r = await element.boundingBox();
      assert.ok(
        r && r.x >= 0 && r.y >= 0 && r.x + r.width <= 360.5 && r.y + r.height <= 690.5,
        `Visible response: ${await element.textContent()} ${JSON.stringify(r)}`,
      );
      assert.ok(r.width >= 44 && r.height >= 44, '44px target');
    }
  };
  const fits = async (name: string) => {
    const result = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      strip: document.querySelector('.lk-strip')?.textContent,
      sheets: [...document.querySelectorAll('.lk-sheet')].filter((e) => e.getBoundingClientRect().height > 0)
        .length,
      scrollY,
    }));
    await page.screenshot({ path: `${out}/${name}.png` });
    results.push({ name, ...result });
    assert.ok(result.height <= 690, `${name}: page height ${result.height}`);
    assert.ok(result.width <= 360);
    assert.equal(result.scrollY, 0);
    assert.equal(result.sheets, 1);
    assert.match(result.strip ?? '', /Rent/);
    assert.match(result.strip ?? '', /waiting/);
    const geometry = await page
      .locator('.office-front, .lk-sheet:not([hidden])')
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
    assert.ok(geometry[0]!.bottom <= geometry[1]!.top + 0.5, `${name}: office never overlaps sheet`);
    await visible(page.locator('.bench-strip button'));
  };
  const open = async () => {
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole('button', { name: 'New month', exact: true }).click();
    await page.getByRole('button', { name: 'Open the office', exact: true }).click();
    await page.locator('.lk-stage').waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  let fixture = newGame(1);
  const send = (input: Input) => apply(fixture, input);
  const load = async () => {
    const run = compactRun(exportRun(fixture, fixture.inputs));
    verifyImport(JSON.stringify(run));
    await tap('[data-action="menu"]');
    const chooser = page.waitForEvent('filechooser');
    await tap('[data-action="import"]');
    await (await chooser).setFiles({
      name: 'fixture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(run)),
    });
    await page.waitForFunction(() => !document.querySelector('dialog.sheet'));
    await page.evaluate(() => document.fonts.ready);
  };
  await open();
  await fits('office');
  await tap('[data-action="city"]');
  await fits('city');
  await tap('[data-tab="Bench"]');
  await tap('[data-action="time"]');
  const inspectingClock = await page.locator('[data-time]').innerText();
  await page.waitForTimeout(1600);
  assert.notEqual(
    await page.locator('[data-time]').innerText(),
    inspectingClock,
    'Inspection leaves clock moving',
  );
  await tap('[data-close]');
  await page.getByRole('button', { name: 'Gül', exact: true }).click();
  await fits('candidate');
  await tap('[data-action="interview"]');
  await fits('interview');
  assert.match(
    (await page.locator('[data-speed]').getAttribute('aria-label')) ?? '',
    /held slow/,
    'Consequential interview holds the chosen speed slow',
  );
  await visible(page.locator('.lk-commit button'));
  await tap('[data-action="more-choices"]');
  await fits('all-questions');
  assert.ok(await page.locator('[data-choice="wage"]').count());
  await tap('[data-close]');
  assert.equal(await page.locator('dialog.sheet').count(), 0);
  // Presence and journey are public simulation facts, carried in the replayable import.
  send({ type: 'take-number', candidate: 'sevda' });
  await load();
  await page.getByRole('button', { name: 'Sevda · books', exact: true }).click();
  assert.equal(await page.locator('[data-action="interview"]').isDisabled(), true);
  assert.match(await page.locator('.candidate-card').innerText(), /home|office/i);
  await tap('[data-action="call-in"]');
  await fits('coming');
  assert.match(await page.locator('[data-waiting]').innerText(), /coming/);
  assert.equal(await page.locator('[data-action="interview"]').isDisabled(), true);
  send({ type: 'place', candidate: 'gul', family: 'arslans', vouch: [] });
  await load();
  await fits('negotiation');
  await visible(page.locator('[data-action="edit-terms"]'));
  await visible(page.locator('.lk-commit button'));
  assert.equal(await page.locator('[data-scene-side="worker"]').count(), 1);
  assert.equal(await page.locator('[data-scene-side="family"]').count(), 1);
  await tap('[data-action="edit-terms"]');
  await fits('terms');
  await visible(page.getByRole('button', { name: 'Say these terms to both sides' }));
  await page.locator('[data-term="wage"]').fill('0');
  await page.getByRole('button', { name: 'Say these terms to both sides' }).click();
  assert.match(await page.locator('.sheet-status').innerText(), /positive wage/);
  assert.equal(await page.locator('[data-term="wage"]').count(), 1);
  for (const [field, value] of [
    ['startHour', '8.01'],
    ['wage', '1000001'],
  ]) {
    await page.locator('[data-term="wage"]').fill('10000');
    await page.locator(`[data-term="${field}"]`).fill(value!);
    await page.getByRole('button', { name: 'Say these terms to both sides' }).click();
    assert.equal(await page.locator('[data-term="wage"]').count(), 1, 'Rejected proposal stays open');
  }
  await page.locator('[data-term="startHour"]').fill('8.5');
  await page.locator('[data-term="wage"]').fill('10000');
  await page.getByRole('button', { name: 'Say these terms to both sides' }).click();
  await fits('revised-negotiation');
  assert.match(await page.locator('.terms-summary').innerText(), /08:30/);
  // Household choices, nested Back, and returning focus to the opener.
  send({ type: 'close-scene', scene: view(fixture).scene!.id });
  await load();
  await tap('[data-tab="Families"]');
  await tap('[data-family="arslans"]');
  await tap('[data-phone-family]');
  await fits('household');
  await page.locator('[data-call-member]:not(:disabled)').first().click();
  await fits('household-topics');
  assert.equal(await page.locator('[data-call-topic]').count(), 4);
  await visible(page.locator('[data-call-topic]'));
  await tap('[data-close]');
  await page.locator('[data-call-member]:focus').waitFor();
  await page.locator('[data-call-member]:not(:disabled)').first().click();
  await tap('[data-call-topic="worker"]');
  await fits('household-call');
  await visible(page.locator('.lk-commit button'));
  // Save, export, and Continue are exercised through the built UI.
  await tap('[data-action="menu"]');
  const menuClock = await page.locator('[data-time]').innerText();
  await page.waitForTimeout(1600);
  assert.equal(await page.locator('[data-time]').innerText(), menuClock, 'System menu stops clock');
  await tap('[data-action="save"]');
  await page.getByText('Saved this month.', { exact: true }).waitFor();
  const download = page.waitForEvent('download');
  await tap('[data-action="download"]');
  const downloaded = await download;
  assert.equal(downloaded.suggestedFilename(), 'goodhands-run.json');
  await downloaded.saveAs(`${out}/download.json`);
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await fits('continued');
  // A ringing phone yields back to the exact interview after the call ends.
  const interrupt = newGame(1);
  apply(interrupt, { type: 'interview', candidate: 'sevda' });
  // Choosing real questions advances the game until the first caller arrives.
  for (const id of ['last-job', 'wage', 'hours', 'q-patient']) {
    const s = view(interrupt).scene;
    if (s?.choices.some((c) => c.id === id && !c.disabled))
      apply(interrupt, { type: 'choose', scene: s.id, choice: id });
  }
  // Use the live opening if its scheduled call has arrived; the deterministic call path is verified below by advancing an imported interview.
  const { advance } = await import('../src/sim/index.ts');
  advance(interrupt, 60);
  fixture = interrupt;
  await load();
  if (view(interrupt).phoneRinging) {
    const sceneId = view(interrupt).scene?.id;
    await tap('[data-action="phone"]');
    await fits('phone-interrupt');
    assert.match(await page.locator('.held-scene').innerText(), /waiting/);
    const finish = page.locator('[data-choice="finish"], [data-action="leave-scene"]');
    if (await finish.count()) await finish.first().click();
    assert.equal(await page.locator('[data-scene-id]').getAttribute('data-scene-id'), sceneId);
    await fits('interview-return');
  } else throw new Error('Phone fixture must ring during the interview');
  await page.setViewportSize({ width: 1200, height: 800 });
  const dock = await page
    .locator('.lk-scene, [data-content]')
    .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
  assert.ok(dock[0]!.right <= dock[1]!.x, 'Desktop sheet docks beside scene');
  await page.screenshot({ path: `${out}/desktop.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/summary.json`, JSON.stringify({ results, errors }, null, 2));
  console.log('Phone stage acceptance passed');
} finally {
  await browser.close();
  await server.close();
}
