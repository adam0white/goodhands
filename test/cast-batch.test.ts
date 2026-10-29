import {
  acceptPersona,
  acceptPersonaBatch,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { ALLOCATION, CAST } from '../src/sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { ENGINE_VERSION } from '../src/sim/hf4.ts';
import { apply, newGame } from '../src/sim/index.ts';
import { ContinuitySession, emptyContinuity } from '../src/ui/continuity.ts';

async function original(key: 'nermin' | 'hatice') {
  const s = newGame(1);
  apply(s, { type: 'pause-cast' });
  return createPersona({
    format: 'hf-persona/1',
    castId: CAST[key].castId,
    castRevision: CAST[key].revision,
    branchId: key,
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: { ...(await agencyTransfer(s, key)), life: initialPersonaLife(CAST[key].castId, key, 0) },
    limitations: [],
  });
}
test('one stale member prevents all batch claims, including an otherwise valid second person', async () => {
  const a = await original('nermin'),
    b = await original('hatice');
  let state = acceptPersona(acceptPersona({ heads: {}, revisions: [] }, a), b);
  const before = structuredClone(state);
  const shelf = {
    async request<T>(r: any): Promise<T> {
      if (r.action === 'prepareBatch')
        return {
          expectedHeads: Object.fromEntries(ALLOCATION.map((c) => [c.castId, state.heads[c.castId] ?? null])),
          inputs: [preparePersonaLife(a, 3600000), preparePersonaLife(b, 3600000)],
          blocked: [],
        } as T;
      if (r.action === 'putBatch') {
        const { revision, ...body } = b;
        state = acceptPersona(
          state,
          await createPersona({
            ...body,
            parentRevision: revision,
            transfer: { ...body.transfer, later: true },
          }),
        );
        state = acceptPersonaBatch(state, r.envelopes, r.expectedHeads);
        return true as T;
      }
      throw Error('unexpected');
    },
  };
  await expect(
    claimCastChapterBatch(
      shelf,
      ALLOCATION.map((c) => c.castId),
      a.source,
      (x) => prepareAgencyChapter(x, 1),
    ),
  ).rejects.toThrow(/conflict/i);
  expect(state.heads[a.castId]).toBe(before.heads[a.castId]);
});

test('closed branches cannot be prepared as a living person', async () => {
  const parent = await original('nermin');
  const closed = await closePersonaBranch(parent, parent.source, 510);
  expect(() => preparePersonaLife(closed, 3600000)).toThrow(/closed/);
});

test('seven carried heads can save and reload without an obsolete recording scope or consent query', async () => {
  const book = emptyContinuity();
  book.chapter = await prepareAgencyChapter([], 1);
  book.heads = await Promise.all(
    ALLOCATION.map((p) =>
      createPersona({
        format: 'hf-persona/1',
        castId: p.castId,
        castRevision: p.revision,
        branchId: crypto.randomUUID(),
        parentRevision: null,
        source: { game: 'goodhands', build: 'test', engine: ENGINE_VERSION, rules: 'goodhands-6' },
        transfer: { recordingEpochProvenance: 'old-immutable-epoch' },
        limitations: [],
      }),
    ),
  );
  const before = structuredClone(book.heads);
  const keys: (string | null)[] = [];
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        throw Error('No recording query.');
      },
    },
    {
      setPersonaRecording(key) {
        keys.push(key);
        if (key !== null) throw Error('Per-person recording scope is obsolete.');
      },
      allowPersonaRecording() {
        throw Error('No separate recording permission.');
      },
    },
  );
  await session.recording(book);
  session.invalidate();
  await session.recording(book, true);
  await session.recording(book);
  expect(book.fileOrigin).toBe(true);
  expect(book.fileUnlinked).toBe(true);
  expect(book.heads).toEqual(before);
  expect(keys).toEqual([null, null, null, null]);
});
