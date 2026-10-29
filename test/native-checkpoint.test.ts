import {
  acceptPersona,
  createPersona,
  initialPersonaLife,
  type PersonaRequest,
} from '@adam0white/lab-client';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { ENGINE_VERSION } from '../src/sim/hf4.ts';
import { advance, apply, newGame } from '../src/sim/index.ts';
import { publishNativeCheckpoint } from '../src/ui/checkpoint.ts';
import { continuityRow, emptyContinuity } from '../src/ui/continuity.ts';
import { syntheticPortableReaders } from './support/synthetic-portable-readers.ts';

let restoreReaders: () => void;
beforeAll(async () => {
  restoreReaders = await syntheticPortableReaders();
});
afterAll(() => restoreReaders());

test('refuses publication when the complete current source archive did not commit', async () => {
  const state = newGame(7);
  apply(state, { type: 'pause-cast' });
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.nermin.castId,
    castRevision: CAST.nermin.revision,
    branchId: 'archive-refusal',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'nermin')),
      life: initialPersonaLife(CAST.nermin.castId, 'archive-refusal', 0),
    },
    limitations: [],
  });
  const requests: PersonaRequest[] = [];
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(request: PersonaRequest): Promise<T> {
      requests.push(request);
      return request.envelope as T;
    },
  };
  await expect(
    publishNativeCheckpoint(shelf, emptyContinuity(), envelope, undefined, false, () => true, state, {
      retainSource: async () => false,
    }),
  ).rejects.toThrow(/complete source run could not be saved/);
  expect(requests).toEqual([]);
});

test('first native checkpoint publishes with recording OFF, no parent and no recording query', async () => {
  const state = newGame(7);
  apply(state, { type: 'pause-cast' });
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.hulya.castId,
    castRevision: CAST.hulya.revision,
    branchId: 'native-hulya',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'hulya')),
      life: initialPersonaLife(CAST.hulya.castId, 'native-hulya', 0),
    },
    limitations: [],
  });
  let shelfState = { heads: {}, revisions: [] } as Parameters<typeof acceptPersona>[0];
  const requests: PersonaRequest[] = [];
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(r: PersonaRequest): Promise<T> {
      requests.push(r);
      if (r.action !== 'put') throw new Error('Recording is OFF; publication must not query consent.');
      shelfState = acceptPersona(shelfState, r.envelope!, r.fork);
      return r.envelope as T;
    },
  };
  const book = emptyContinuity();
  await publishNativeCheckpoint(shelf, book, envelope, undefined, false, () => true, state);
  expect(shelfState.heads[envelope.castId]).toBe(envelope.revision);
  expect(requests.map((r) => r.action)).toEqual(['put']);
  book.heads = [envelope];
  const { revision, ...body } = envelope;
  const next = await createPersona({
    ...body,
    parentRevision: revision,
    transfer: { ...body.transfer, next: true },
  });
  await publishNativeCheckpoint(shelf, book, next, envelope, false, () => true, state);
  const sibling = await createPersona({
    ...body,
    parentRevision: revision,
    transfer: { ...body.transfer, other: true },
  });
  await expect(
    publishNativeCheckpoint(shelf, book, sibling, envelope, false, () => true, state),
  ).rejects.toThrow(/conflict/i);
  await expect(
    publishNativeCheckpoint(shelf, book, next, envelope, false, () => false, state),
  ).rejects.toThrow(/changed/);
  book.fileOrigin = true;
  await expect(
    publishNativeCheckpoint(shelf, book, next, envelope, false, () => true, state),
  ).rejects.toThrow(/explicit new branch/);
});

test('native ownership replay pins the agency boundary and refuses a different source minute', async () => {
  const chapter = await prepareAgencyChapter([], 7);
  const state = newGame(7, 6, chapter.guests, chapter);
  advance(state, 15);
  apply(state, { type: 'pause-cast' });
  expect(state.now).toBe(525);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.hulya.castId,
    castRevision: CAST.hulya.revision,
    branchId: 'idle-native',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'hulya')),
      life: initialPersonaLife(CAST.hulya.castId, 'idle-native', 0),
    },
    limitations: [],
  });
  const book = emptyContinuity();
  book.chapter = chapter;
  book.heads = [envelope];
  book.rows = [
    Object.assign(continuityRow(envelope, 'checkpoint', 'shared', 'fresh'), {
      sourceMinute: state.now,
      sourceInputCount: state.inputs.length,
    }),
  ];
  const { validateContinuity } = await import('../src/ui/export.ts');
  await validateContinuity(book, state, state.inputs);
  apply(state, { type: 'resume-cast' });
  await validateContinuity(book, state, state.inputs);
  book.rows[0]!.sourceMinute = state.now - 1;
  await expect(validateContinuity(book, state, state.inputs)).rejects.toThrow(/prefix|boundary/);
});

test('publication refuses a mismatched complete source before touching the public shelf', async () => {
  const state = newGame(7);
  apply(state, { type: 'pause-cast' });
  const transfer = await agencyTransfer(state, 'aylin');
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.aylin.castId,
    castRevision: CAST.aylin.revision,
    branchId: 'source-aylin',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: { ...transfer, life: initialPersonaLife(CAST.aylin.castId, 'source-aylin', 0) },
    limitations: [],
  });
  const requests: PersonaRequest[] = [];
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(request: PersonaRequest): Promise<T> {
      requests.push(request);
      return request.envelope as T;
    },
  };
  const book = emptyContinuity();
  const refused = async (source = state, candidate = envelope, fork = false) => {
    const before = structuredClone(source);
    await expect(
      publishNativeCheckpoint(shelf, book, candidate, undefined, fork, () => true, source),
    ).rejects.toThrow();
    expect(source).toEqual(before);
    expect(requests).toEqual([]);
  };
  await refused(newGame(7));
  const legacy = structuredClone(state);
  legacy.version = 4;
  await refused(legacy);
  const { revision: _revision, ...body } = envelope;
  await refused(state, await createPersona({ ...body, source: { ...body.source, game: 'murmur' } }));
  await refused(
    state,
    await createPersona({ ...body, transfer: { ...body.transfer, targetClaim: { claimId: 'foreign' } } }),
  );
  await refused(state, await createPersona({ ...body, terminal: { kind: 'dead', at: state.now } }));
  const changed = structuredClone(state);
  // Current actor projections are read-only views. Forge the public archive binding instead.
  (changed.hf4 as { archive: { hashes: { full: string } } }).archive.hashes.full = '0'.repeat(64);
  await refused(changed);
  book.heads = [envelope];
  await refused(state, envelope, true);
  book.heads = [];
  book.fileOrigin = true;
  await refused();
  book.fileOrigin = false;
  const before = structuredClone(state);
  await publishNativeCheckpoint(shelf, book, envelope, undefined, false, () => true, state);
  expect(requests.map((r) => r.action)).toEqual(['put']);
  expect(state).toEqual(before);
});

test('a complete paused Aylin source publishes without mutation and full/compact replay continues exactly', async () => {
  const { compactRun, exportRun, verifyImport, validateContinuity } = await import('../src/ui/export.ts');
  const { fingerprint } = await import('../src/sim/index.ts');
  const chapter = await prepareAgencyChapter([], 7);
  const state = newGame(7, 6, chapter.guests, chapter);
  advance(state, 25);
  apply(state, { type: 'pause-cast' });
  const before = structuredClone(state);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.aylin.castId,
    castRevision: CAST.aylin.revision,
    branchId: 'complete-aylin',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'aylin')),
      life: initialPersonaLife(CAST.aylin.castId, 'complete-aylin', 0),
    },
    limitations: [],
  });
  let accepted = { heads: {}, revisions: [] } as Parameters<typeof acceptPersona>[0];
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(r: PersonaRequest): Promise<T> {
      expect(r.action).toBe('put');
      accepted = acceptPersona(accepted, r.envelope!, r.fork);
      return r.envelope as T;
    },
  };
  const book = emptyContinuity();
  book.chapter = chapter;
  book.initialClaims = [];
  await publishNativeCheckpoint(shelf, book, envelope, undefined, false, () => true, state);
  expect(accepted.heads[envelope.castId]).toBe(envelope.revision);
  expect(state).toEqual(before); // complete Persons, RNG, agenda, clock and provenance
  book.heads = [envelope];
  book.rows = [
    {
      ...continuityRow(envelope, 'checkpoint', 'shared', 'fresh'),
      sourceMinute: state.now,
      sourceInputCount: state.inputs.length,
    },
  ];
  book.publications = [
    {
      at: state.now,
      inputCount: state.inputs.length,
      fingerprint: fingerprint(state),
      results: ['Aylin: published checkpoint; no receiver acknowledgment.'],
    },
  ];
  const full = exportRun(state, state.inputs, book);
  expect(full.state).toEqual(before);
  const expected = structuredClone(state);
  apply(expected, { type: 'resume-cast' });
  advance(expected, 30);
  for (const run of [full, compactRun(full)]) {
    const loaded = verifyImport(JSON.stringify(run));
    await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
    expect(loaded.state).toEqual(before);
    expect(loaded.continuity.publications).toEqual(book.publications);
    apply(loaded.state, { type: 'resume-cast' });
    advance(loaded.state, 30);
    expect(fingerprint(loaded.state)).toBe(fingerprint(expected));
    expect(loaded.state).toEqual(expected);
  }
  const wrongReport = structuredClone(full);
  wrongReport.continuity!.publications![0]!.fingerprint = '00000000';
  const bad = verifyImport(JSON.stringify(wrongReport));
  await expect(validateContinuity(bad.continuity, bad.state, bad.inputs)).rejects.toThrow(/recorded source/);
});

test('actual App offers source checkpoints at its menu and bounded world-only end', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    ['scripts/verify-source-offer.ts', String(49000 + (process.pid % 500))],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      timeout: 300000,
      killSignal: 'SIGKILL',
    },
  );
  const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.error || result.status !== 0)
    console.error('Source-offer child failure:', result.error, result.status, diagnostics);
  expect(result.error, diagnostics).toBeUndefined();
  expect(result.status, diagnostics).toBe(0);
  expect(result.stdout).toContain('full/compact replay: PASS');
}, 310000);

test('staged native receipt refuses aggregate capacity before put and keeps the complete original export', async () => {
  const { boundedPersonaJson, PERSONA_LIMITS } = await import('@adam0white/lab-client');
  const { exportRun, verifyImport, validateContinuity } = await import('../src/ui/export.ts');
  const chapter = await prepareAgencyChapter([], 7);
  const state = newGame(7, 6, chapter.guests, chapter);
  apply(state, { type: 'pause-cast' });
  const book = Object.assign(emptyContinuity(), {
    chapter,
    initialClaims: [],
    retainedSourceMetadata: [] as string[],
  });
  let remaining = PERSONA_LIMITS.transferBytes - JSON.stringify(book).length - 160;
  while (remaining > 0) {
    const count = Math.min(remaining, 32000);
    book.retainedSourceMetadata.push('x'.repeat(count));
    remaining -= count;
  }
  boundedPersonaJson(book);
  const original = JSON.stringify(exportRun(state, state.inputs, book));
  const valid = verifyImport(original);
  await validateContinuity(valid.continuity, valid.state, valid.inputs);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.aylin.castId,
    castRevision: CAST.aylin.revision,
    branchId: 'capacity-aylin',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(state, 'aylin')),
      life: initialPersonaLife(CAST.aylin.castId, 'capacity-aylin', 0),
    },
    limitations: [],
  });
  const requests: PersonaRequest[] = [];
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(r: PersonaRequest): Promise<T> {
      requests.push(r);
      return r.envelope as T;
    },
  };
  let retained = 0;
  const retainSource = async () => {
    retained++;
    return true;
  };
  await expect(
    publishNativeCheckpoint(shelf, book, envelope, undefined, false, () => true, state, { retainSource }),
  ).rejects.toThrow(/256|capacity|full/i);
  expect(requests).toEqual([]);
  expect(retained).toBe(0);
  expect(JSON.stringify(exportRun(state, state.inputs, book))).toBe(original);
  // A head/row may fit while the pending public report would exceed the same native reader bound.
  const reportBook = { ...book, retainedSourceMetadata: [] as string[] };
  const row = {
    ...continuityRow(envelope, 'checkpoint', 'shared', 'fresh'),
    sourceMinute: state.now,
    sourceInputCount: state.inputs.length,
  };
  remaining =
    PERSONA_LIMITS.transferBytes -
    1000 -
    JSON.stringify({ ...reportBook, heads: [envelope], rows: [row] }).length -
    80;
  while (remaining > 0) {
    const count = Math.min(remaining, 32000);
    reportBook.retainedSourceMetadata.push('x'.repeat(count));
    remaining -= count;
  }
  boundedPersonaJson({ ...reportBook, heads: [envelope], rows: [row] });
  const originalReport = JSON.stringify(exportRun(state, state.inputs, reportBook));
  const { fingerprint } = await import('../src/sim/index.ts');
  await expect(
    publishNativeCheckpoint(shelf, reportBook, envelope, undefined, false, () => true, state, {
      retainSource,
      reserveReport: {
        at: state.now,
        inputCount: state.inputs.length,
        fingerprint: fingerprint(state),
        results: Array.from({ length: 7 }, () => 'x'.repeat(512)),
      },
    }),
  ).rejects.toThrow(/256|capacity|full/i);
  expect(requests).toEqual([]);
  expect(retained).toBe(0);
  expect(JSON.stringify(exportRun(state, state.inputs, reportBook))).toBe(originalReport);
});
