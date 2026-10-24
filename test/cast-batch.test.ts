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
    source: { game: 'goodhands', build: 'test', engine: '2.17.0', rules: 'goodhands-6' },
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
test('mixed recording requires the exact complete group and files cannot inherit approval', async () => {
  const book = emptyContinuity();
  book.chapter = await prepareAgencyChapter([], 1);
  book.heads = [await original('nermin'), await original('hatice')];
  let allowed = false;
  const calls: any[] = [];
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(r: any): Promise<T> {
      calls.push(r);
      return {
        sameEpoch: false,
        revisions: r.envelopes.map((p: any) => p.revision),
        recordingEpoch: 'opaque',
      } as T;
    },
  };
  const session = new ContinuitySession(shelf, {
    setPersonaRecording() {
      allowed = false;
    },
    allowPersonaRecording(x) {
      allowed = x;
    },
  });
  await session.recording(book);
  expect(allowed).toBe(false);
  expect(calls[0].envelopes).toHaveLength(2);
  await session.allow(book, true);
  expect(allowed).toBe(true);
  expect(calls.at(-1).allowRecording).toBe(true);
  expect(calls.at(-1).recordingEpoch).toBe('opaque');
  await session.recording(book, true);
  expect(allowed).toBe(false);
  expect(book.fileOrigin).toBe(true);
});
test('closed branches cannot be prepared as a living person', async () => {
  const parent = await original('nermin');
  const closed = await closePersonaBranch(parent, parent.source, 510);
  expect(() => preparePersonaLife(closed, 3600000)).toThrow(/closed/);
});
