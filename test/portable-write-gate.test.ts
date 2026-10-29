import { type PersonaEnvelope, portableWriteBlockers } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { assertPortableWrite } from '../src/ui/continuity.ts';

test('portable writes follow the SDK peer gate while legacy writes remain available', () => {
  for (const cast of Object.values(CAST)) {
    const envelope = { castId: cast.castId, transfer: { portable: {} } } as unknown as PersonaEnvelope;
    const blockers = portableWriteBlockers(cast.castId, 'goodhands');
    if (blockers.length) expect(() => assertPortableWrite(envelope)).toThrow(/cannot be shared yet/);
    else expect(() => assertPortableWrite(envelope)).not.toThrow();
    expect(() => assertPortableWrite({ ...envelope, transfer: {} })).not.toThrow();
  }
});

test('the default reader gate stops publication before a shelf request and leaves the book unchanged', async () => {
  const { createPersona } = await import('@adam0white/lab-client');
  const { ContinuitySession, emptyContinuity } = await import('../src/ui/continuity.ts');
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.hatice.castId,
    castRevision: CAST.hatice.revision,
    branchId: 'gate-control',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '4.8.1', rules: 'goodhands-6' },
    transfer: {},
    limitations: [],
  });
  expect(portableWriteBlockers(parent.castId, 'goodhands').length).toBeGreaterThan(0);
  const book = emptyContinuity();
  book.heads = [parent];
  const before = structuredClone(book);
  let requests = 0;
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        requests++;
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  await expect(session.publish(book, parent.castId, { portable: {} })).rejects.toThrow(
    /cannot be shared yet/,
  );
  expect(requests).toBe(0);
  expect(book).toEqual(before);
});

test('SDK skips a blocked portable head and retains an unrelated accepted input and source', async () => {
  const { claimCastChapterBatch, createPersona, initialPersonaLife, preparePersonaLife } = await import(
    '@adam0white/lab-client'
  );
  const { agencyTransfer } = await import('../src/sim/cast-chapter.ts');
  const { apply, newGame } = await import('../src/sim/index.ts');
  const { syntheticPortableReaders } = await import('./support/synthetic-portable-readers.ts');
  // Generate a valid source fixture under synthetic readers; restore the real default before admission.
  const restore = await syntheticPortableReaders();
  let portableTransfer: Record<string, unknown>;
  try {
    const state = newGame(3);
    apply(state, { type: 'pause-cast' });
    portableTransfer = await agencyTransfer(state, 'hatice');
  } finally {
    restore();
  }
  const source = { game: 'goodhands', build: 'source-test', engine: '4.8.1', rules: 'goodhands-6' };
  const make = (key: 'hatice' | 'nermin', transfer: Record<string, unknown>) =>
    createPersona({
      format: 'hf-persona/1',
      castId: CAST[key].castId,
      castRevision: CAST[key].revision,
      branchId: `gate-${key}`,
      parentRevision: null,
      source,
      transfer: { ...transfer, life: initialPersonaLife(CAST[key].castId, `gate-${key}`, 0) },
      limitations: [],
    });
  const blocked = await make('hatice', portableTransfer);
  const allowed = await make('nermin', { note: 'retained source' });
  const original = structuredClone(blocked);
  const expectedHeads = { [blocked.castId]: blocked.revision, [allowed.castId]: allowed.revision };
  let writes: PersonaEnvelope[] = [];
  const result = await claimCastChapterBatch(
    {
      async request<T>(request: { action: string; envelopes?: PersonaEnvelope[] }): Promise<T> {
        if (request.action === 'prepareBatch')
          return {
            expectedHeads,
            inputs: [preparePersonaLife(blocked, 0), preparePersonaLife(allowed, 0)],
            blocked: [],
          } as T;
        writes = request.envelopes ?? [];
        return true as T;
      },
    },
    [blocked.castId, allowed.castId],
    source,
    async (inputs) => inputs,
  );
  expect(result?.blocked.map((p) => p.castId)).toEqual([blocked.castId]);
  expect(result?.inputs.map((p) => p.parent.castId)).toEqual([allowed.castId]);
  expect(writes.map((p) => p.castId)).toEqual([allowed.castId]);
  expect(result?.inputs[0]?.parent).toEqual(allowed);
  expect(blocked).toEqual(original);
});
