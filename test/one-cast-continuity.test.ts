import { acceptPersona, createPersona } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
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
test('recording gate is set before association lookup; files never inherit sameEpoch', async () => {
  const calls: string[] = [];
  const source = await original();
  const book = emptyContinuity();
  book.heads.push(source);
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        calls.push('query');
        return { sameEpoch: true } as T;
      },
    },
    {
      setPersonaRecording(key) {
        calls.push(key ? 'gate' : 'fresh');
      },
      allowPersonaRecording(allow) {
        calls.push(allow ? 'allow' : 'deny');
      },
    },
  );
  await session.recording(book, false);
  expect(calls).toEqual(['gate', 'deny', 'query', 'allow']);
  calls.length = 0;
  await session.recording(book, true);
  expect(calls).toEqual(['gate', 'deny']);
  calls.length = 0;
  await session.recording(book, false);
  expect(calls).toEqual(['gate', 'deny']);
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
