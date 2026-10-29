/** Synthetic route lifetime only; no product lifecycle or shared-service receipt. */
import type { Browser, BrowserContext, Route } from 'playwright-core';

/** A reply was deliberately canceled by this fixture's acknowledged route.abort. */
export class FixtureRouteCancelled extends Error {
  constructor() {
    super('Synthetic fixture shutdown canceled this reply.');
  }
}
interface PendingRoute {
  route: Route;
  terminal?: Promise<unknown>;
  cancellation?: Promise<void>;
  cancelError?: FixtureRouteCancelled;
}
interface FixtureRoutes {
  closing: boolean;
  pending: Set<PendingRoute>;
}
const contexts = new WeakMap<BrowserContext, FixtureRoutes>();

/** Keep ownership of held replies until they finish or an explicit shutdown abort acknowledges. */
export async function routeFixture(context: BrowserContext, handler: (route: Route) => Promise<void>) {
  let routes = contexts.get(context);
  if (!routes) {
    routes = { closing: false, pending: new Set() };
    contexts.set(context, routes);
  }
  const owner = routes;
  await context.route('**/*', async (route) => {
    const pending: PendingRoute = { route };
    owner.pending.add(pending);
    const wrapped = new Proxy(route, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (['abort', 'fulfill', 'continue', 'fallback'].includes(String(key)))
          return async (...args: unknown[]) => {
            if (pending.cancellation) {
              await pending.cancellation;
              throw pending.cancelError;
            }
            // Record the actual terminal operation synchronously, before shutdown can race it.
            const result = value.apply(target, args) as Promise<unknown>;
            pending.terminal = result;
            return await result;
          };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    try {
      if (owner.closing) {
        pending.cancellation = route.abort('aborted');
        await pending.cancellation;
      } else await handler(wrapped);
    } catch (error) {
      if (!pending.cancelError || error !== pending.cancelError || !pending.cancellation) throw error;
      // Only this route's successful, explicit shutdown abort permits this one cancellation.
      await pending.cancellation;
    } finally {
      owner.pending.delete(pending);
    }
  });
}

export async function closeFixtureBrowser(browser: Browser) {
  try {
    for (const context of browser.contexts()) {
      const routes = contexts.get(context);
      if (routes) {
        routes.closing = true;
        const settled = [...routes.pending].map((pending) => {
          if (pending.terminal) return pending.terminal;
          // A failure that predates shutdown is not this fixture's cancellation to swallow.
          if (pending.route.request().failure()) return Promise.resolve();
          pending.cancelError = new FixtureRouteCancelled();
          const failed = context.waitForEvent('requestfailed', {
            predicate: (request) => request === pending.route.request(),
          });
          pending.cancellation = Promise.all([pending.route.abort('aborted'), failed]).then(() => undefined);
          return pending.cancellation;
        });
        // A page-close event or successful fulfill return does not prove a paused request was consumed.
        // Acknowledge every pending terminal action/abort before detaching its target/interception.
        await Promise.all(settled);
      }
      await context.setOffline(true);
      for (const page of context.pages()) await page.close();
      await context.unrouteAll({ behavior: 'wait' });
    }
  } finally {
    await browser.close();
  }
}
