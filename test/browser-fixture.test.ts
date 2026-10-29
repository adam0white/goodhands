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
  const networkRequests: {
    method?: string;
    path?: string;
    headers: Record<string, string | string[] | undefined>;
  }[] = [];
  const server = createServer((request, response) => {
    networkRequests.push({ method: request.method, path: request.url, headers: request.headers });
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
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/' && request.isNavigationRequest() && request.method() === 'GET') {
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Synthetic route control</title><link rel="icon" href="data:,">',
        });
        return;
      }
      if (request.method() !== 'GET' || !['/first', '/second'].includes(path))
        throw new Error(`Unexpected synthetic route: ${request.method()} ${path}`);
      const index = path === '/first' ? 0 : 1;
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
    // An intercepted document makes both held GETs same-origin. No document or favicon hits the server.
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const closed = gate();
    page.on('close', () => closed.resolve());
    const requests = page.evaluate(() =>
      Promise.allSettled(['/first', '/second'].map((path) => fetch(path))),
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
    expect(errors, JSON.stringify({ networkRequests })).toEqual([]);
    expect(completed).toBe(2);
    expect(networkRequests).toEqual([]);
  } finally {
    for (const entry of release) entry.resolve();
    await browser.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 30_000);
