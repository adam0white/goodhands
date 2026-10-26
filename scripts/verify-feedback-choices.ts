/** Actual entry-path Feedback control with isolated, mocked lab transport. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const baseline = process.argv.includes('--baseline');
const source = baseline ? execFileSync('git', ['show', '4df9928:src/ui/app.ts'], { encoding: 'utf8' }) : '';
const server = await createServer({
  plugins: baseline
    ? [
        {
          name: 'baseline-feedback-entry',
          enforce: 'pre',
          transform(code, id) {
            if (id.endsWith('/src/ui/app.ts')) return source;
            return code;
          },
        },
      ]
    : [],
  server: { host: '127.0.0.1', port: 48729, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
try {
  for (const viewport of [
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { value: false });
      localStorage.setItem('hf-lab-recording-off', '1');
    });
    const sends: unknown[] = [];
    let fail = false;
    await page.route('https://human.adamwhite.work/**', async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST',
            'access-control-allow-headers': 'content-type',
          },
        });
      if (route.request().method() !== 'POST') return route.abort();
      const data = route.request().postDataBuffer();
      assert.ok(data);
      sends.push(JSON.parse(gunzipSync(data).toString()));
      await route.fulfill({
        status: fail ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(fail ? { error: 'Mock outage' } : { id: 'mock-receipt' }),
        headers: { 'access-control-allow-origin': '*' },
      });
    });
    await page.goto('http://127.0.0.1:48729/');
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    const choices = page.locator('[data-feedback-choice]');
    assert.deepEqual(await choices.allTextContents(), ["I'm stopping", "I'm confused"]);
    await choices.first().click();
    assert.equal(await choices.first().getAttribute('aria-pressed'), 'true');
    assert.equal(sends.length, 0, 'selection must not send');
    const note = page.locator('.feedback-note textarea');
    await note.fill('Edited note stays exact.');
    await choices.last().click();
    assert.equal(await note.inputValue(), 'Edited note stays exact.');
    await choices.last().click();
    assert.equal(await choices.last().getAttribute('aria-pressed'), 'false');
    assert.equal(await note.inputValue(), 'Edited note stays exact.');
    await choices.first().click();
    await page.locator('[data-verdict="mixed"]').click();
    await page.locator('.feedback-name summary').click();
    await page.locator('[data-feedback-name]').fill('Tester');
    assert.equal(sends.length, 0);
    const submit = page.getByRole('button', { name: 'Submit', exact: true });
    await submit.scrollIntoViewIfNeeded();
    const box = await submit.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, 'reachable 44px Submit');
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'no horizontal overflow',
    );
    await submit.click();
    await page.getByText('Sent. Your note is stored.').waitFor({ timeout: 10000 });
    assert.equal(sends.length, 1, 'one explicit mocked send');
    const envelope = sends[0] as Record<string, unknown>;
    assert.equal(envelope.note, "I'm stopping\n\nVerdict: mixed\n\nEdited note stays exact.");
    assert.equal(envelope.name, 'Tester');
    assert.deepEqual(envelope.run, { feedbackOnly: true });
    await page.getByRole('button', { name: 'Back to the game' }).click();
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    const retryNote = page.locator('.feedback-note textarea');
    await retryNote.fill('Keep this note after failure.');
    fail = true;
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await page
      .getByText('Your feedback could not be sent. Your note is still here. Try Submit again.')
      .waitFor({ timeout: 10000 });
    assert.equal(await retryNote.inputValue(), 'Keep this note after failure.');
    await page.close();
  }
  console.log('CANDIDATE GREEN actual Feedback entry: 360x690 and 1280x800');
} finally {
  await browser.close();
  await server.close();
}
