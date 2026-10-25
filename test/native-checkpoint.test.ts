import {
  acceptPersona,
  createPersona,
  initialPersonaLife,
  type PersonaRequest,
} from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { advance, apply, newGame } from '../src/sim/index.ts';
import { publishNativeCheckpoint } from '../src/ui/checkpoint.ts';
import { continuityRow, emptyContinuity } from '../src/ui/continuity.ts';

test('first native checkpoint publishes with recording OFF, no parent and no recording query', async () => {
  const state = newGame(7);
  apply(state, { type: 'pause-cast' });
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.hulya.castId,
    castRevision: CAST.hulya.revision,
    branchId: 'native-hulya',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '2.23.0', rules: 'goodhands-6' },
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
  await publishNativeCheckpoint(shelf, book, envelope, undefined, false, () => true);
  expect(shelfState.heads[envelope.castId]).toBe(envelope.revision);
  expect(requests.map((r) => r.action)).toEqual(['put']);
  book.heads = [envelope];
  const { revision, ...body } = envelope;
  const next = await createPersona({
    ...body,
    parentRevision: revision,
    transfer: { ...body.transfer, next: true },
  });
  await publishNativeCheckpoint(shelf, book, next, envelope, false, () => true);
  const sibling = await createPersona({
    ...body,
    parentRevision: revision,
    transfer: { ...body.transfer, other: true },
  });
  await expect(publishNativeCheckpoint(shelf, book, sibling, envelope, false, () => true)).rejects.toThrow(
    /conflict/i,
  );
  await expect(publishNativeCheckpoint(shelf, book, next, envelope, false, () => false)).rejects.toThrow(
    /changed/,
  );
  book.fileOrigin = true;
  await expect(publishNativeCheckpoint(shelf, book, next, envelope, false, () => true)).rejects.toThrow(
    /explicit new branch/,
  );
});

test('native ownership replay pins the agency boundary while retaining an idle person clock', async () => {
  const chapter = await prepareAgencyChapter([], 7);
  const state = newGame(7, 6, chapter.guests, chapter);
  advance(state, 15);
  apply(state, { type: 'pause-cast' });
  expect(state.people.hulya!.now).toBeLessThan(state.now);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.hulya.castId,
    castRevision: CAST.hulya.revision,
    branchId: 'idle-native',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '2.23.0', rules: 'goodhands-6' },
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
  book.rows[0]!.sourceMinute = state.people.hulya!.now;
  await expect(validateContinuity(book, state, state.inputs)).rejects.toThrow(/prefix|boundary/);
});
