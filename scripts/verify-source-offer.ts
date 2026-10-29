/** Synthetic App wiring with named host-only arrival/rent overlays.
 * Actor changes use public transitions. Untouched opening files retain full/compact replay coverage.
 * The separately retained actual month proves full-length ending and cold reconstruction.
 * Fixture shelf only; no live journey or publication. */
import assert from 'node:assert/strict';
import { acceptPersona, type PersonaRequest, type PersonaShelfState } from '@adam0white/lab-client';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { newGame } from '../src/sim/index.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { compactRun, exportRun, validateContinuity, verifyImport } from '../src/ui/export.ts';

const phaseStart = performance.now();
function phase(stage: string) {
  console.log(JSON.stringify({ stage, milliseconds: Math.round(performance.now() - phaseStart) }));
}
const port = Number(process.argv[2] ?? 48837);
const server = await createServer({
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
  plugins: [
    {
      name: 'bounded-world-app-fixture',
      enforce: 'pre',
      transform(code, id) {
        if (id.split('?')[0]?.endsWith('/src/ui/app.ts'))
          return code.replace(
            '  const resumed = resumeForPlay(next, history);',
            "\n      const fixture = sessionStorage.getItem('goodhands-app-world-fixture');\n      sessionStorage.removeItem('goodhands-app-world-fixture');\n      if (fixture) {\n        // Synthetic App wiring only: move host arrival/rent conditions, never actor state.\n        next.cards.aylin.arrived = next.now + 1;\n        sim.advance(next, 1);\n        if (!next.cards.aylin.met) throw new Error('Synthetic public arrival did not meet Aylin.');\n        if (fixture === 'ended') {\n          next.cash = 0;\n          next.missedRent = 1;\n          next.rentDue = next.now + 1;\n          sim.advance(next, 1);\n          if (next.scene?.kind !== 'rent') throw new Error('Synthetic rent boundary did not open.');\n          sim.apply(next, {type:'choose',scene:next.scene.id,choice:'promise'});\n          if (!next.ended || !next.review) throw new Error('Ordinary rent choice did not end the fixture.');\n        }\n        history = structuredClone(next.inputs);\n      }\n" +
              '  const resumed = resumeForPlay(next, history);',
          );
      },
    },
  ],
});
await server.listen();
const browser = await chromium.launch({ channel: process.env.HF_BROWSER_CHANNEL });
const origin = 'https://goodhands.adamwhite.work';
phase('prepare untouched opening');
const chapter = await prepareAgencyChapter([], 7);
const book = emptyContinuity();
book.chapter = chapter;
book.initialClaims = [];
const opening = newGame(7, 6, chapter.guests, chapter);
phase('untouched opening ready');

try {
  for (const viewport of [
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ]) {
    phase(`viewport ${viewport.width}`);
    const context = await browser.newContext({ viewport });
    let shelf: PersonaShelfState = { heads: {}, revisions: [] };
    const requests: PersonaRequest[] = [];
    let holdGet = false,
      heldGet = false;
    let releaseGet = () => {};
    await context.exposeBinding('fixtureShelf', async (_source, message: PersonaRequest) => {
      requests.push(message);
      if (message.action === 'get') {
        const captured = shelf.revisions.find((p) => p.revision === shelf.heads[message.castId!]) ?? null;
        if (holdGet) {
          heldGet = true;
          await new Promise<void>((resolve) => {
            releaseGet = resolve;
          });
        }
        return captured;
      }
      assert.equal(message.action, 'put');
      shelf = acceptPersona(shelf, message.envelope!, message.fork);
      return message.envelope;
    });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname === '/fixture')
          return route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><body>Synthetic fixture</body>',
          });
        const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
        return route.fulfill({ response });
      }
      if (url.href === 'https://human.adamwhite.work/lab/identity/')
        return route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><script>
        addEventListener('message', async e => {
          const m=e.data; let value, error;
          try {
            if (m.type==='hf-persona-consent' && m.action==='get') value=true;
            else if (m.type==='hf-persona-request') value=await window.fixtureShelf(m);
            else return;
          } catch (err) { error=String(err); }
          const reply={type:m.type==='hf-persona-consent'?'hf-persona-consent-reply':'hf-persona-reply',id:m.id,value,error};
          if(e.ports[0]) e.ports[0].postMessage(reply); else e.source.postMessage(reply,e.origin);
        });</script>`,
        });
      assert.notEqual(route.request().method(), 'POST', 'no telemetry, feedback or production mutation');
      return route.abort();
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    async function seed(run: ReturnType<typeof exportRun>, fixture: 'met' | 'ended' | null = null) {
      phase(`seed ${fixture ?? 'untouched opening'}`);
      await page.goto(`${origin}/fixture`);
      await page.evaluate(
        async ({ run, fixture }) => {
          if (fixture) sessionStorage.setItem('goodhands-app-world-fixture', fixture);
          else sessionStorage.removeItem('goodhands-app-world-fixture');
          localStorage.setItem('hf-lab-recording-off', '1');
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('goodhands', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('pages');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result,
                tx = db.transaction('pages', 'readwrite');
              tx.objectStore('pages').put({ plain: JSON.stringify(run), at: Date.now() }, 'run');
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            };
          });
        },
        { run, fixture },
      );
      await page.goto(origin);
      await page.getByRole('button', { name: /^Resume/ }).click();
      phase(`resumed ${fixture ?? 'untouched opening'}`);
    }
    await seed(exportRun(opening, opening.inputs, book));
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'People after this month', exact: true }).click();
    assert.equal(requests.length, 0, 'reading an offer never publishes or pauses');
    await page.getByRole('button', { name: 'Pause and prepare checkpoints', exact: true }).click();
    await page
      .locator('[data-source-status]')
      .getByText(/Aylin: published/)
      .waitFor();
    const before = requests.length;
    assert.ok(before > 0);
    assert.ok(
      await page
        .locator('[data-source-status]')
        .innerText()
        .then((s) => s.includes('refused')),
    );
    assert.equal(
      await page.getByRole('link', { name: 'Check Aylin’s continuation in Murmur' }).count(),
      0,
      'unmet person has no offer',
    );
    await page.getByRole('button', { name: 'Download this run', exact: true }).last().click({ trial: true });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download this run', exact: true }).last().click();
    const stream = await (await download).createReadStream();
    assert.ok(stream);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const working = JSON.parse(Buffer.concat(chunks).toString());
    assert.ok(!Object.hasOwn(working, 'state'), 'default download is the compact working wire');
    const decoded = verifyImport(JSON.stringify(working));
    const full = exportRun(decoded.state, decoded.inputs, decoded.continuity);
    assert.ok(Object.hasOwn(full, 'state'), 'full replay case includes complete reconstructed state');
    for (const run of [full, compactRun(full)]) {
      const loaded = verifyImport(JSON.stringify(run));
      await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
      assert.ok(loaded.state.castPaused);
      assert.equal(loaded.continuity.publications?.length, 1);
      assert.ok(loaded.continuity.publications[0]!.results.some((s) => s.includes('refused')));
    }
    phase('untouched opening full/compact replay verified');
    await page.getByRole('button', { name: 'Resume agency play', exact: true }).click();
    assert.equal(requests.length, before, 'resume is local recorded input, not a claim');
    shelf = { heads: {}, revisions: [] };
    requests.length = 0;
    await seed(exportRun(opening, opening.inputs, book), 'ended');
    await page.locator('.review').waitFor();
    await page.locator('.review-actions [data-action="source-offer"]').click();
    await page.getByRole('button', { name: 'Pause and prepare checkpoints', exact: true }).click();
    await page
      .locator('[data-source-status]')
      .getByText(/Aylin: published/)
      .waitFor();
    await page.getByRole('link', { name: 'Check Aylin’s continuation in Murmur' }).waitFor();
    assert.ok(
      await page
        .locator('[data-source-status]')
        .innerText()
        .then((s) => s.includes('No receiver acceptance')),
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    phase('bounded world-only ending source offer verified');
    // A real background checkpoint must invalidate a pending receiver offer at the same source boundary.
    shelf = { heads: {}, revisions: [] };
    requests.length = 0;
    holdGet = true;
    await seed(exportRun(opening, opening.inputs, book), 'met');
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'People after this month', exact: true }).click();
    await page.getByRole('button', { name: 'Pause and prepare checkpoints', exact: true }).click();
    await page
      .locator('[data-source-status]')
      .getByText(/Aylin: published/)
      .waitFor();
    for (let i = 0; i < 100 && !heldGet; i++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(heldGet, 'actual public get is pending for known Aylin');
    phase('met fixture publication and held get ready');
    const capturedHeads = { ...shelf.heads };
    const capturedRevision = shelf.heads['hf.cast.aylin.murmur'];
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    for (
      let i = 0;
      i < 500 && Object.entries(capturedHeads).some(([id, revision]) => shelf.heads[id] === revision);
      i++
    )
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.notEqual(
      shelf.heads['hf.cast.aylin.murmur'],
      capturedRevision,
      'actual background checkpoint superseded owned revision',
    );
    assert.ok(
      Object.entries(capturedHeads).every(([id, revision]) => shelf.heads[id] !== revision),
      'the complete prior background publication settled before the next case',
    );
    await page.waitForTimeout(100);
    releaseGet();
    await page.waitForTimeout(100);
    assert.equal(
      await page.getByRole('link', { name: 'Check Aylin’s continuation in Murmur', exact: true }).count(),
      0,
      'late get cannot offer a superseded owned source revision',
    );
    holdGet = false;
    phase('complete background checkpoint and stale offer invalidation verified');
    // Hold an actual native digest, then cancel the page before any public SDK put.
    shelf = { heads: {}, revisions: [] };
    requests.length = 0;
    await seed(exportRun(opening, opening.inputs, book));
    await page.locator('[data-action="menu"]').click();
    await page.getByRole('button', { name: 'People after this month', exact: true }).click();
    await page.evaluate(() => {
      const control = window as Window & {
        sourceDigestHeld?: boolean;
        sourceDigestFinished?: boolean;
        releaseSourceDigest?: () => void;
      };
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (algorithm, data) => {
        crypto.subtle.digest = digest;
        control.sourceDigestHeld = true;
        await new Promise<void>((resolve) => {
          control.releaseSourceDigest = resolve;
        });
        const result = await digest(algorithm, data);
        control.sourceDigestFinished = true;
        return result;
      };
    });
    await page.getByRole('button', { name: 'Pause and prepare checkpoints', exact: true }).click();
    await page.waitForFunction(() => (window as Window & { sourceDigestHeld?: boolean }).sourceDigestHeld);
    assert.equal(requests.length, 0);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      (window as Window & { releaseSourceDigest?: () => void }).releaseSourceDigest!();
    });
    await page.waitForFunction(
      () => (window as Window & { sourceDigestFinished?: boolean }).sourceDigestFinished,
    );
    await page.waitForTimeout(100);
    assert.equal(
      requests.length,
      0,
      'pagehide cancels pending hashing and the SDK pagehide checkpoint callback',
    );
    const finalSave = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('goodhands', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const row = await new Promise<{ plain?: string; blob?: Blob }>((resolve, reject) => {
        const request = db.transaction('pages', 'readonly').objectStore('pages').get('run');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return (
        row.plain ??
        (await new Response(row.blob!.stream().pipeThrough(new DecompressionStream('gzip'))).text())
      );
    });
    const retained = verifyImport(finalSave);
    await validateContinuity(retained.continuity, retained.state, retained.inputs);
    phase('pagehide digest cancellation and retained save verified');
    assert.ok(retained.state.castPaused, 'pagehide still queues the synchronous complete final source save');
    assert.equal(retained.continuity.heads.length, 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Synthetic source menu/world-only end offer; untouched opening full/compact replay: PASS');
} finally {
  await browser.close();
  await server.close();
}
