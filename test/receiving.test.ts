import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { advance, newGame } from '../src/sim/index.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';

it('retains phases across reload and preserves a changed active save', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls!.local[0]!);
    const first = await page.evaluate(async () => {
      const path = '/src/ui/store.ts';
      const store = await (
        new Function('path', 'return import(path)') as (
          path: string,
        ) => Promise<typeof import('../src/ui/store.ts')>
      )(path);
      await store.put('run', { seed: 1 });
      const journal = {
        id: 'one',
        phase: 'prepared' as const,
        run: { seed: 2 } as never,
        expectedHeads: {},
        priorNative: await store.captureNative(),
        createdAt: 1,
      };
      await store.retainReceiving(journal);
      await store.retainReceiving({ ...journal, phase: 'sending' });
      let regressionRejected = false;
      try {
        await store.retainReceiving(journal);
      } catch {
        regressionRejected = true;
      }
      return regressionRejected;
    });
    expect(first).toBe(true);
    await page.reload();
    const result = await page.evaluate(async () => {
      const path = '/src/ui/store.ts';
      const store = await (
        new Function('path', 'return import(path)') as (
          path: string,
        ) => Promise<typeof import('../src/ui/store.ts')>
      )(path);
      const sending = await store.readReceiving();
      const discard = await store.discardReceiving('one');
      if (!sending) throw new Error('Journal missing after reload.');
      const acknowledged = { ...sending, phase: 'acknowledged' as const };
      await store.retainReceiving(acknowledged);
      await store.put('run', { seed: 3 });
      const promoted = await store.promoteReceiving(acknowledged);
      return {
        sending: sending.phase,
        discard,
        promoted,
        active: (await store.get('run'))?.value,
        retained: (await store.readReceiving())?.phase,
      };
    });
    expect(result).toEqual({
      sending: 'sending',
      discard: false,
      promoted: false,
      active: { seed: 3 },
      retained: 'acknowledged',
    });
    const fresh = await browser.newPage();
    await fresh.goto(server.resolvedUrls!.local[0]!);
    const fullRun = exportRun(newGame(4), []);
    const success = await fresh.evaluate(async (run) => {
      const path = '/src/ui/store.ts';
      const store = await (
        new Function('path', 'return import(path)') as (
          path: string,
        ) => Promise<typeof import('../src/ui/store.ts')>
      )(path);
      const journal = {
        id: 'two',
        phase: 'acknowledged' as const,
        run,
        expectedHeads: {},
        priorNative: await store.captureNative(),
        createdAt: 2,
      };
      await store.retainReceiving({ ...journal, phase: 'prepared' });
      let skipRejected = false;
      try {
        await store.retainReceiving(journal);
      } catch {
        skipRejected = true;
      }
      await store.retainReceiving({ ...journal, phase: 'sending' });
      await store.retainReceiving(journal);
      const mismatch = await store.promoteReceiving({ ...journal, createdAt: 3 });
      let checks = 0;
      const canceled = await store.promoteReceiving(journal, () => ++checks < 3);
      const afterCancel = {
        native: (await store.get('run'))?.value ?? null,
        journal: await store.readReceiving(),
      };
      const promoted = await store.promoteReceiving(journal);
      return {
        promoted,
        mismatch,
        canceled,
        checks,
        afterCancel,
        skipRejected,
        active: (await store.get('run'))?.value,
        journal: await store.readReceiving(),
      };
    }, fullRun);
    expect(success).toEqual({
      promoted: true,
      mismatch: false,
      canceled: false,
      checks: 3,
      afterCancel: {
        native: null,
        journal: {
          id: 'two',
          phase: 'acknowledged',
          run: fullRun,
          expectedHeads: {},
          priorNative: { value: null, token: null },
          createdAt: 2,
        },
      },
      skipRejected: true,
      active: fullRun,
      journal: null,
    });
    await fresh.reload();
    const restored = await fresh.evaluate(async () => {
      const store = await (
        new Function('return import("/src/ui/store.ts")') as () => Promise<
          typeof import('../src/ui/store.ts')
        >
      )();
      return (await store.get('run'))?.value;
    });
    expect(restored).toEqual(fullRun);
    const replayed = verifyImport(JSON.stringify(restored), { requireFull: true });
    const beforeAdvance = replayed.state.now;
    expect(advance(replayed.state, 10).now).toBe(beforeAdvance + 10);
    const failures = await page.evaluate(async (run) => {
      const path = '/src/ui/store.ts';
      const store = await (
        new Function('path', 'return import(path)') as (
          path: string,
        ) => Promise<typeof import('../src/ui/store.ts')>
      )(path);
      // This page has an acknowledged journal; use another database key state after clearing it directly.
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('goodhands', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('pages', 'readwrite');
        tx.objectStore('pages').delete('receiving');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
      const journal = {
        id: 'failure',
        phase: 'prepared' as const,
        run,
        expectedHeads: {},
        priorNative: await store.captureNative(),
        createdAt: 3,
      };
      const original = IDBDatabase.prototype.transaction;
      const abortNext = () => {
        IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
          const tx = original.apply(this, args);
          if (args[1] === 'readwrite') {
            IDBDatabase.prototype.transaction = original;
            queueMicrotask(() => tx.abort());
          }
          return tx;
        };
      };
      abortNext();
      let prepareRejected = false;
      try {
        await store.retainReceiving(journal);
      } catch {
        prepareRejected = true;
      }
      const afterPrepare = await store.readReceiving();
      await store.retainReceiving(journal);
      await store.retainReceiving({ ...journal, phase: 'sending' });
      const acknowledged = { ...journal, phase: 'acknowledged' as const };
      await store.retainReceiving(acknowledged);
      abortNext();
      let promotionRejected = false;
      try {
        await store.promoteReceiving(acknowledged);
      } catch {
        promotionRejected = true;
      }
      IDBDatabase.prototype.transaction = original;
      db.close();
      return {
        prepareRejected,
        afterPrepare,
        promotionRejected,
        retained: (await store.readReceiving())?.phase,
        active: (await store.get('run'))?.value,
      };
    }, fullRun);
    expect(failures).toEqual({
      prepareRejected: true,
      afterPrepare: null,
      promotionRejected: true,
      retained: 'acknowledged',
      active: { seed: 3 },
    });
    await fresh.close();
  } finally {
    await browser.close();
    await server.close();
  }
}, 120_000);

it('synthetic acknowledged recovery canceled after validation preserves both months', async () => {
  const needle = 'await validateContinuity(restored.continuity, restored.state, restored.inputs);';
  let injected = false;
  const server = await createServer({
    plugins: [
      {
        name: 'synthetic-recovery-gate',
        enforce: 'pre',
        transform(code, id) {
          if (!id.endsWith('/src/ui/app.ts')) return;
          if (code.split(needle).length !== 2) throw new Error('Recovery validation point changed.');
          injected = true;
          return code.replace(
            needle,
            `${needle}
          if (window.__holdRecovery) {
            window.__recoveryHeld = true;
            await new Promise(resolve => { window.__releaseRecovery = resolve; });
            window.__recoveryReleased = true;
          }`,
          );
        },
      },
    ],
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      (window as typeof window & { __holdRecovery: boolean }).__holdRecovery = true;
    });
    await page.goto(server.resolvedUrls!.local[0]!);
    const native = exportRun(newGame(31), []);
    const accepted = exportRun(newGame(32), []);
    const journal = await page.evaluate(
      async ({ native, accepted }) => {
        const store = await (
          new Function('return import("/src/ui/store.ts")') as () => Promise<
            typeof import('../src/ui/store.ts')
          >
        )();
        if (!(await store.put('run', native))) throw new Error('Could not save native month.');
        const prepared = {
          id: 'synthetic-recovery',
          phase: 'prepared' as const,
          run: accepted,
          expectedHeads: {},
          priorNative: await store.captureNative(),
          createdAt: 1,
        };
        await store.retainReceiving(prepared);
        await store.retainReceiving({ ...prepared, phase: 'sending' });
        const acknowledged = { ...prepared, phase: 'acknowledged' as const };
        await store.retainReceiving(acknowledged);
        return acknowledged;
      },
      { native, accepted },
    );
    await page.reload();
    await page.getByRole('button', { name: 'Resume the accepted month', exact: true }).click();
    await expect
      .poll(
        () => page.evaluate(() => (window as typeof window & { __recoveryHeld?: boolean }).__recoveryHeld),
        { timeout: 30000 },
      )
      .toBe(true);
    expect(injected).toBe(true);
    await page.evaluate(() => {
      dispatchEvent(new Event('hf-persona-preference'));
      (window as typeof window & { __releaseRecovery: () => void }).__releaseRecovery();
    });
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { __recoveryReleased?: boolean }).__recoveryReleased),
      )
      .toBe(true);
    await page.waitForTimeout(300);
    const saved = await page.evaluate(async () => {
      const store = await (
        new Function('return import("/src/ui/store.ts")') as () => Promise<
          typeof import('../src/ui/store.ts')
        >
      )();
      return { native: (await store.get('run'))?.value, journal: await store.readReceiving() };
    });
    expect(saved).toEqual({ native, journal });
    expect(await page.getByTestId('office').count()).toBe(0);
  } finally {
    await browser.close();
    await server.close();
  }
}, 120_000);
