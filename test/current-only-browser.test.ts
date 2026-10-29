/** Local admission control; it does not use an owner profile or shared shelf. */
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, test } from 'vitest';

const old = {
  game: 'goodhands',
  version: 1,
  seed: 37,
  minute: 519,
  inputs: [
    { at: 510, input: { type: 'interview', candidate: 'sevda' } },
    { at: 510, input: { type: 'choose', scene: 'scene-1', choice: 'q-patient' } },
  ],
  fingerprint: 'ef02eb7b',
};
for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
]) {
  test(`native old month stays stored and cannot resume at ${viewport.width}`, async () => {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
    await server.listen();
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    try {
      const page = await browser.newPage({ viewport });
      const base = server.resolvedUrls!.local[0]!;
      await page.goto(base);
      await page.evaluate(`import('/src/ui/store.ts').then(({put}) => put('run', ${JSON.stringify(old)}))`);
      await page.reload();
      await page
        .getByText('This saved month uses an older version. Keep the saved month and start a new game.')
        .waitFor();
      expect(await page.getByRole('button', { name: 'Resume', exact: true }).count()).toBe(0);
      const stored = await page.evaluate(`import('/src/ui/store.ts').then(({get}) => get('run'))`);
      expect((stored as { value: unknown }).value).toEqual(old);
    } finally {
      await browser.close();
      await server.close();
    }
  });
}
