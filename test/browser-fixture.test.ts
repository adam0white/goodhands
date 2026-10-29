/** Local transport control: teardown must not release pending fixture requests to a real origin. */
import { createServer } from 'node:http';
import { type BrowserContext, chromium, type Route } from 'playwright-core';
import { expect, it } from 'vitest';
import { closeFixtureBrowser, FixtureRouteCancelled, routeFixture } from './browser-fixture.ts';

for (const firstDelivered of [false, true])
  it(`settles two held routes before closure (${firstDelivered ? 'first delivered' : 'both canceled'})`, async () => {
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
      let canceled = 0;
      const finished = [gate(), gate()] as const;
      const failed = new Set<string>();
      context.on('requestfailed', (request) => failed.add(new URL(request.url()).pathname));
      const errors: unknown[] = [];
      await routeFixture(context, async (route) => {
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
          if (error instanceof FixtureRouteCancelled) canceled++;
          else {
            errors.push(error);
            throw error;
          }
        } finally {
          finished[index].resolve();
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
      const settled = requests.catch((error) => {
        if (
          !page.isClosed() ||
          !(error instanceof Error) ||
          !error.message.includes('Target page, context or browser has been closed')
        )
          throw error;
        return null;
      });
      await Promise.all(entered.map((entry) => entry.promise));
      if (firstDelivered) {
        const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/first');
        release[0].resolve();
        expect(await (await response).text()).toBe('Synthetic fixture response');
        await finished[0].promise;
      }
      const originalClose = page.close.bind(page);
      page.close = async (...args) => {
        // Deterministic safety boundary: both real paused requests must be canceled before target closure.
        expect([...failed].sort()).toEqual(firstDelivered ? ['/second'] : ['/first', '/second']);
        return await originalClose(...args);
      };
      const closing = closeFixtureBrowser(browser);
      release[0].resolve();
      // Neither target closure nor interceptor removal may strand a still-paused request.
      await Promise.race([closed.promise, escaped.promise, closing]);
      release[1].resolve();
      await closing;
      await settled;
      await Promise.all(finished.map((entry) => entry.promise));
      expect(errors, JSON.stringify({ networkRequests })).toEqual([]);
      expect(completed).toBe(firstDelivered ? 1 : 0);
      expect(canceled).toBe(firstDelivered ? 1 : 2);
      expect(networkRequests).toEqual([]);
    } finally {
      for (const entry of release) entry.resolve();
      await browser.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }, 30_000);

// Scope: route-ownership error forwarding only. Synthetic Route objects are not SDK/game controls.
it('does not swallow an unexpected handler error or an unowned cancellation', async () => {
  let callback: ((route: Route) => Promise<void>) | undefined;
  const context = {
    route: async (_pattern: string, handler: (route: Route) => Promise<void>) => {
      callback = handler;
    },
  } as unknown as BrowserContext;
  for (const error of [new Error('Synthetic unexpected transport error'), new FixtureRouteCancelled()]) {
    await routeFixture(context, async () => {
      throw error;
    });
    if (!callback) throw new Error('Route handler missing.');
    await expect(callback({} as Route)).rejects.toBe(error);
  }
});
