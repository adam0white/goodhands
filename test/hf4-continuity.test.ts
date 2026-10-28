/** Local current SDK batch controls. No shared shelf or ownership receipt is claimed. */
import {
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  portablePersonOwner,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { ALLOCATION, CAST } from '../src/sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { ENGINE_VERSION } from '../src/sim/hf4.ts';
import { apply, newGame } from '../src/sim/index.ts';
import { agencySource, publishNativeCheckpoint } from '../src/ui/checkpoint.ts';
import { ContinuitySession, continuityRow, emptyContinuity } from '../src/ui/continuity.ts';
import { validateContinuity } from '../src/ui/export.ts';

test('current SDK batch claims retain complete parent provenance and receiver ownership', async () => {
  const source = newGame(1);
  apply(source, { type: 'pause-cast' });
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.nermin.castId,
    castRevision: CAST.nermin.revision,
    branchId: 'current-claim-control',
    parentRevision: null,
    source: { game: 'goodhands', build: 'source-build', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: {
      ...(await agencyTransfer(source, 'nermin')),
      life: initialPersonaLife(CAST.nermin.castId, 'current-claim-control', 0),
      sourceEvidence: { text: 'retained ü', values: [0.125, true, null] },
    },
    limitations: ['Local transport fixture.'],
  });
  const original = structuredClone(parent);
  const prepared = preparePersonaLife(parent, 0);
  let accepted = 0;
  const result = await claimCastChapterBatch(
    {
      async request<T>(request: { action: string }): Promise<T> {
        if (request.action === 'prepareBatch')
          return {
            expectedHeads: Object.fromEntries(
              ALLOCATION.map((person) => [
                person.castId,
                person.castId === parent.castId ? parent.revision : null,
              ]),
            ),
            inputs: [prepared],
            blocked: [],
          } as T;
        if (request.action === 'putBatch') {
          accepted++;
          return true as T;
        }
        throw new Error('Unexpected fixture request.');
      },
    },
    ALLOCATION.map((person) => person.castId),
    { game: 'goodhands', build: 'receiver-build', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    (inputs) => prepareAgencyChapter(inputs, 7),
  );
  expect(accepted).toBe(1);
  expect(result?.claims).toHaveLength(1);
  if (!result) throw new Error('No actual SDK batch claim.');
  const book = emptyContinuity();
  book.chapter = result.initial;
  book.initialClaims = result.claims;
  book.heads = structuredClone(result.claims);
  const state = newGame(7, 6, result.initial.guests, result.initial);
  await expect(validateContinuity(book, state, [])).resolves.toBeUndefined();
  expect(parent).toEqual(original);
  expect(result.claims[0]!.source).toEqual(parent.source);
  expect(result.claims[0]!.parentRevision).toBe(parent.revision);
  expect(portablePersonOwner(result.claims[0]!)).toBe('goodhands');
  expect(result.claims[0]!.transfer.sourceEvidence).toEqual(parent.transfer.sourceEvidence);
  for (const mutate of [
    (body: Omit<typeof parent, 'revision'>) => {
      body.transfer = { ...parent.transfer, life: prepared.life };
    },
    (body: Omit<typeof parent, 'revision'>) => {
      body.source.build = 'forged-build';
    },
    (body: Omit<typeof parent, 'revision'>) => {
      body.transfer.sourceEvidence = { text: 'changed' };
    },
    (body: Omit<typeof parent, 'revision'>) => {
      body.parentRevision = 'f'.repeat(64);
    },
  ]) {
    const { revision: _revision, ...body } = structuredClone(result.claims[0]!);
    mutate(body);
    const changed = await createPersona(body);
    const corrupt = structuredClone(book);
    corrupt.initialClaims = [changed];
    corrupt.heads = [changed];
    await expect(validateContinuity(corrupt, state, [])).rejects.toThrow(/claim|parent|passport/);
  }
  apply(state, { type: 'pause-cast' });
  const claim = result.claims[0]!;
  const { revision: priorRevision, ...priorBody } = claim;
  const continuation = await createPersona({
    ...priorBody,
    parentRevision: priorRevision,
    source: agencySource('continuation-control'),
    transfer: await agencyTransfer(state, 'nermin'),
  });
  let publications = 0;
  await publishNativeCheckpoint(
    {
      enabled: true,
      setEnabled() {},
      ready: Promise.resolve(true),
      async request<T>(): Promise<T> {
        publications++;
        return true as T;
      },
    },
    book,
    continuation,
    claim,
    false,
    () => true,
    state,
  );
  expect(publications).toBe(1);
  const continued = structuredClone(book);
  continued.heads = [continuation];
  continued.rows.push({
    ...continuityRow(continuation, 'checkpoint', 'shared'),
    sourceMinute: state.now,
    sourceInputCount: state.inputs.length,
  });
  await expect(validateContinuity(continued, state, state.inputs)).resolves.toBeUndefined();
  const { revision: _continuedRevision, ...continuedBody } = continuation;
  const forged = await createPersona({ ...continuedBody, parentRevision: 'f'.repeat(64) });
  const corrupt = structuredClone(continued);
  corrupt.heads = [forged];
  corrupt.rows[corrupt.rows.length - 1] = {
    ...continuityRow(forged, 'checkpoint', 'shared'),
    sourceMinute: state.now,
    sourceInputCount: state.inputs.length,
  };
  await expect(validateContinuity(corrupt, state, state.inputs)).rejects.toThrow(/lineage|parent/);

  const forgedBranch = await createPersona({ ...continuedBody, branchId: 'unrequested-branch' });
  const wrongBranch = structuredClone(continued);
  wrongBranch.heads = [forgedBranch];
  wrongBranch.rows[wrongBranch.rows.length - 1] = {
    ...continuityRow(forgedBranch, 'checkpoint', 'shared'),
    sourceMinute: state.now,
    sourceInputCount: state.inputs.length,
  };
  await expect(validateContinuity(wrongBranch, state, state.inputs)).rejects.toThrow(/lineage|branch/);

  const forkedBook = structuredClone(continued);
  const session = new ContinuitySession(
    {
      enabled: true,
      setEnabled() {},
      ready: Promise.resolve(true),
      async request<T>(): Promise<T> {
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  for (const fork of [true, false, true, false]) {
    const prior = forkedBook.heads[0]!;
    const priorBook = structuredClone(forkedBook);
    const next = await session.publish(forkedBook, prior.castId, await agencyTransfer(state, 'nermin'), fork);
    expect(next.parentRevision).toBe(fork ? null : prior.revision);
    if (fork) expect(next.branchId).not.toBe(prior.branchId);
    else expect(next.branchId).toBe(prior.branchId);
    await publishNativeCheckpoint(
      {
        enabled: true,
        setEnabled() {},
        ready: Promise.resolve(true),
        async request<T>(): Promise<T> {
          return true as T;
        },
      },
      priorBook,
      next,
      prior,
      fork,
      () => true,
      state,
    );
    await expect(validateContinuity(forkedBook, state, state.inputs)).resolves.toBeUndefined();
  }
});
