/** Synthetic browser fixture teardown only; no product lifecycle or shared-service receipt. */
import type { Browser } from 'playwright-core';

export async function closeFixtureBrowser(browser: Browser) {
  for (const context of browser.contexts()) {
    // Block outbound traffic and stop new page requests while interception is still installed.
    // Playwright can forward pending routes when interception is removed, even with wait.
    await context.setOffline(true);
    for (const page of context.pages()) await page.close();
    await context.unrouteAll({ behavior: 'wait' });
  }
  await browser.close();
}
