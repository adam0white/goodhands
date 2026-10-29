/** Local transport control: teardown must not release pending fixture requests to a real origin. */
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { expect, it } from 'vitest';
import { closeFixtureBrowser } from './browser-fixture.ts';

it('closes pages before removing interception while two fixture replies are pending', async () => {
  const gate = () => Promise.withResolvers<void>();
  const entered = [gate(), gate()] as const;
  const release = [gate(), gate()] as const;
  const escaped = gate();
  let networkRequests = 0;
  const server = createServer((_, response) => {
    networkRequests++;
    escaped.resolve();
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.end('Unexpected local network request');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local fixture server.');
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const context = await browser.newContext();
    let completed = 0;
    const errors: unknown[] = [];
    await context.route('**/*', async (route) => {
      const index = route.request().url().endsWith('/first') ? 0 : 1;
      entered[index].resolve();
      await release[index].promise;
      try {
        await route.fulfill({ body: 'Synthetic fixture response' });
        completed++;
      } catch (error) {
        errors.push(error);
        throw error;
      }
    });
    const page = await context.newPage();
    const closed = gate();
    page.on('close', () => closed.resolve());
    const requests = page.evaluate(
      (url) => Promise.allSettled(['/first', '/second'].map((path) => fetch(url + path))),
      `http://127.0.0.1:${address.port}`,
    );
    // Page closure can reject evaluate; observe it before beginning teardown.
    const settled = requests.catch(() => undefined);
    await Promise.all(entered.map((entry) => entry.promise));
    const closing = closeFixtureBrowser(browser);
    release[0].resolve();
    // Old unroute-first teardown forwards the second request. Correct teardown closes its page.
    await Promise.race([closed.promise, escaped.promise]);
    release[1].resolve();
    await closing;
    await settled;
    expect(errors).toEqual([]);
    expect(completed).toBe(2);
    expect(networkRequests).toBe(0);
  } finally {
    for (const entry of release) entry.resolve();
    await browser.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 30_000);
