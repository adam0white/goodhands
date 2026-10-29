/** Synthetic replacement race controls. Validation and complete replay run unchanged before each barrier. */
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { newGame } from '../src/sim/index.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';
import { closeFixtureBrowser } from './browser-fixture.ts';

for (const scenario of ['before-confirm', 'during-begin', 'back-during-begin', 'positive'] as const) {
  it(`replacement chooser ${scenario} respects selection through real validation`, async () => {
    const server = await createServer({
      plugins: [
        {
          name: 'synthetic-import-validation-barrier',
          transform(source, id) {
            if (id.endsWith('/src/ui/store.ts'))
              return (
                source.replace('export async function put(', 'async function actualPut(') +
                `
            export function put(...args) {
              const pending = actualPut(...args);
              (window.nativeSavePromises ??= []).push(pending);
              return pending;
            }
          `
              );
            if (!id.endsWith('/src/ui/export.ts')) return;
            return (
              source.replace(
                'export async function validateContinuity(',
                'async function actualValidateContinuity(',
              ) +
              `
            export async function validateContinuity(...args) {
              await actualValidateContinuity(...args);
              await window.replacementValidationGate?.();
            }
          `
            );
          },
        },
      ],
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
    });
    await server.listen();
    const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    try {
      const context = await browser.newContext();
      // All external requests are closed; these are local transport controls, not shared journeys.
      const localUrl = server.resolvedUrls?.local[0];
      if (!localUrl) throw new Error('No local fixture URL.');
      const local = new URL(localUrl);
      await context.route('**/*', async (route) => {
        if (new URL(route.request().url()).origin === local.origin) await route.continue();
        else await route.abort();
      });
      const page = await context.newPage();
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.addInitScript(() => {
        localStorage.setItem('hf-lab-recording-off', '1');
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onchange');
        if (!descriptor?.set) throw new Error('No native onchange setter.');
        const set = descriptor.set;
        Object.defineProperty(HTMLElement.prototype, 'onchange', {
          ...descriptor,
          set(handler) {
            set.call(
              this,
              typeof handler !== 'function'
                ? handler
                : function (this: HTMLInputElement, event: Event) {
                    const result = handler.call(this, event);
                    if (this.type === 'file')
                      (window as typeof window & { importCompletion?: Promise<unknown> }).importCompletion =
                        Promise.resolve(result);
                    return result;
                  },
            );
          },
        });
      });
      await page.goto(local.href);
      const original = exportRun(newGame(7), []);
      await page.evaluate(async (run) => {
        const store = await (
          new Function('return import("/src/ui/store.ts")') as () => Promise<
            typeof import('../src/ui/store.ts')
          >
        )();
        if (!(await store.put('run', run))) throw new Error('Synthetic native seed failed.');
      }, original);
      await page.reload();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.getByTestId('office').waitFor();
      await page.locator('[data-action="menu"]').click();
      const inspect = () =>
        page.evaluate(async () => {
          const store = await (
            new Function('return import("/src/ui/store.ts")') as () => Promise<
              typeof import('../src/ui/store.ts')
            >
          )();
          return { native: await store.captureNative(), journal: await store.readReceiving() };
        });
      const journal = {
        id: 'synthetic-cancel-journal',
        phase: 'prepared' as const,
        run: original,
        expectedHeads: {},
        priorNative: { value: original, token: null },
        createdAt: 1,
      };
      await page.evaluate(async (value) => {
        const store = await (
          new Function('return import("/src/ui/store.ts")') as () => Promise<
            typeof import('../src/ui/store.ts')
          >
        )();
        await store.retainReceiving(value);
      }, journal);
      const flushSaves = () =>
        page.evaluate(() =>
          Promise.all(
            (window as typeof window & { nativeSavePromises?: Promise<boolean>[] }).nativeSavePromises ?? [],
          ),
        );
      await flushSaves();
      const before = await inspect();
      let validations = 0;
      const stopAt = scenario === 'before-confirm' ? 1 : 2;
      await page.exposeBinding('replacementValidationGate', async () => {
        if (++validations === stopAt) {
          entered.resolve();
          await release.promise;
        }
      });
      let confirmations = 0;
      page.on('dialog', async (dialog) => {
        confirmations++;
        await dialog.accept();
      });
      await page.locator('[data-open-saved]').click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Replace saved month', exact: true }).click();
      const replacement = exportRun(newGame(23), []);
      await (await chooser).setFiles({
        name: 'synthetic.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(replacement)),
      });
      await entered.promise;
      expect(confirmations).toBe(scenario === 'before-confirm' ? 0 : 1);
      if (scenario !== 'positive')
        await page
          .getByRole('button', { name: scenario === 'back-during-begin' ? 'Back' : 'Cancel', exact: true })
          .click();
      release.resolve();
      await page.evaluate(
        () => (window as typeof window & { importCompletion?: Promise<unknown> }).importCompletion,
      );
      await flushSaves();
      const after = await inspect();
      expect(after.journal).toEqual(journal);
      if (scenario !== 'positive') {
        expect(confirmations).toBe(scenario === 'before-confirm' ? 0 : 1);
        expect(after).toEqual(before);
        expect(verifyImport(JSON.stringify(after.native.value)).state).toEqual(original.state);
      } else {
        await page.getByTestId('office').waitFor();
        const loaded = verifyImport(JSON.stringify(after.native.value));
        expect(loaded.state).toEqual(replacement.state);
        expect(loaded.inputs).toEqual(replacement.inputs);
        expect(loaded.state.seed).toBe(23);
      }
    } finally {
      release.resolve();
      await closeFixtureBrowser(browser);
      await server.close();
    }
  }, 60_000);
}
