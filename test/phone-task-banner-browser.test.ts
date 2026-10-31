import { type Browser, chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

// Like the other browser tests, the channel comes from HF_BROWSER_CHANNEL (CI sets it to the installed Chrome).
/** The task line carries the Tuesday 08:00 deadline. Its last line must stay inside its box and reachable. */
it('shows the whole task line with its deadline at phone and desktop sizes', async () => {
  const server = await createServer({
    root: process.cwd(),
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  let browser: Browser | undefined;
  try {
    await server.listen();
    const address = server.httpServer!.address();
    const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    for (const [viewport, mobile] of [
      [{ width: 360, height: 690 }, true],
      [{ width: 1280, height: 800 }, false],
    ] as const) {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      // Only the local server may answer. Fonts and the lab service stay unreached.
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'),
      );
      const page = await context.newPage();
      await page.goto(origin);
      await page.getByRole('button', { name: 'Open the office', exact: true }).click();
      await page.locator('.task span').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const task = document.querySelector('.task')!;
        const span = document.querySelector('.task span')!;
        const range = document.createRange();
        range.selectNodeContents(span);
        const text = range.getBoundingClientRect();
        const box = task.getBoundingClientRect();
        const skip = document.querySelector('.until-event')!.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + 12, text.bottom - 3);
        return {
          text: span.textContent ?? '',
          textBottom: text.bottom,
          boxBottom: box.bottom,
          scrollable: task.scrollHeight > task.clientHeight + 1,
          skipOverlapsTask: skip.top < box.bottom - 1 && skip.left < box.right && skip.right > box.left,
          deadlineHit: !!hit && task.contains(hit),
          pageBottom: document.documentElement.scrollHeight <= innerHeight,
        };
      });
      expect(m.text).toContain('Tuesday 3 November, 08:00');
      expect(m.textBottom).toBeLessThanOrEqual(m.boxBottom + 0.5);
      expect(m.scrollable).toBe(false);
      expect(m.skipOverlapsTask).toBe(false);
      expect(m.deadlineHit).toBe(true);
      await context.close();
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}, 120000);
