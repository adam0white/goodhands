import { acceptPersona, createPersona } from '@adam0white/lab-client';
import { expect, test, vi } from 'vitest';
import { ContinuitySession, emptyContinuity } from '../src/ui/continuity.ts';

async function original() {
  return createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.zeynep.pass',
    castRevision: '1',
    branchId: 'test-branch',
    parentRevision: null,
    source: { game: 'pass', build: 'test', engine: '2.14.1', rules: 'pass-12' },
    transfer: { person: {} },
    limitations: [],
  });
}
test('a receiving claim advances atomically before use, and old saved parents stay stale', async () => {
  const source = await original();
  let shelfState = acceptPersona({ heads: {}, revisions: [] }, source);
  let gets = 0;
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(r: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
      if (r.action === 'get') {
        gets++;
        return source as T;
      }
      if (r.action === 'put') {
        shelfState = acceptPersona(shelfState, r.envelope!, r.fork);
        return true as T;
      }
      return { sameEpoch: true } as T;
    },
  };
  const lab = { setPersonaRecording() {}, allowPersonaRecording() {} };
  const session = new ContinuitySession(shelf, lab);
  const book = emptyContinuity();
  const claim = await session.claim(source, 'shared');
  expect(shelfState.heads[source.castId]).toBe(claim.revision);
  book.heads.push(claim);
  const { revision: _revision, ...claimBody } = claim;
  const newer = await createPersona({
    ...claimBody,
    parentRevision: claim.revision,
    transfer: { person: { later: true } },
  });
  shelfState = acceptPersona(shelfState, newer);
  await expect(session.publish(book, source.castId, { person: { return: true } })).rejects.toThrow(
    'Continuity conflict',
  );
  expect(book.heads[0]?.revision).toBe(claim.revision);
  expect(gets).toBe(0);
});

test('validated reload rejects a checksum-valid unrelated head', async () => {
  const { validateContinuity } = await import('../src/ui/export.ts');
  const book = emptyContinuity();
  book.heads.push(await original());
  await expect(validateContinuity(book)).rejects.toThrow(/head|arrival/i);
});

test('blocked bridge retains file admission, while a real competing head still refuses it', async () => {
  const source = await original();
  let message = 'Shelf unavailable. Use a local file.';
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        throw new Error(message);
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  expect((await session.claim(source, 'file')).parentRevision).toBe(source.revision);
  message = 'Continuity conflict. Export this history or explicitly fork it.';
  await expect(session.claim(source, 'file')).rejects.toThrow('Continuity conflict');
});

test('two different admissions from the same source cannot share an idempotent claim', async () => {
  const source = await original();
  let state = acceptPersona({ heads: {}, revisions: [] }, source);
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        state = acceptPersona(state, request.envelope!);
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  const first = await session.claim(source, 'shared');
  expect(typeof (first.transfer.targetClaim as { claimId: string }).claimId).toBe('string');
  await expect(session.claim(source, 'shared')).rejects.toThrow('Continuity conflict');
});

test('a full bounded replay history refuses before any shelf mutation', async () => {
  const source = await original();
  const book = emptyContinuity();
  book.heads = [source];
  book.rows = Array.from({ length: 256 }, () => ({
    v: 1 as const,
    probe: 'zeynep' as const,
    arm: 'continuing' as const,
    scope: 'shared' as const,
    castId: source.castId,
    branchId: source.branchId,
    revision: source.revision,
    parentRevision: null,
    stage: 'checkpoint',
    outcome: 'accepted',
  }));
  let writes = 0;
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        writes++;
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  await expect(session.publish(book, source.castId, { person: {} })).rejects.toThrow(/history.*full/);
  expect(writes).toBe(0);
  expect(book.rows).toHaveLength(256);
  expect(book.heads).toEqual([source]);
});

test('binding imported histories makes no recording RPC and preserves file provenance', async () => {
  const request = vi.fn(async () => {
    throw new Error('obsolete recording RPC');
  });
  const session = new ContinuitySession(
    { enabled: true, ready: new Promise(() => {}), setEnabled() {}, request },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  const book = emptyContinuity();
  book.heads.push(await original());
  await session.recording(book, true);
  await session.allow(book, true);
  expect(book.fileOrigin).toBe(true);
  expect(book.fileUnlinked).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
