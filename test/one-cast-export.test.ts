import { readFileSync } from 'node:fs';
import { acceptPersona, createPersona, type PersonaRequest } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { advance, apply, newGame, prepareGuest } from '../src/sim/index.ts';
import { type ContinuityBook, ContinuitySession, continuityRow } from '../src/ui/continuity.ts';
import { exportRun, guestCheckpointTransfer, validateContinuity, verifyImport } from '../src/ui/export.ts';

test('two explicit forks and later checkpoints retain their exact claim lineage', async () => {
  const transfer = JSON.parse(
    readFileSync(new URL('./fixtures/pass-departure.json', import.meta.url), 'utf8'),
  );
  const source = await createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.zeynep.pass',
    castRevision: '1',
    branchId: 'fork-replay-control',
    parentRevision: null,
    source: { game: 'pass', build: 'fixture', engine: '2.14.1', rules: 'pass-12' },
    transfer,
    limitations: transfer.person.limitations,
  });
  let shelf = acceptPersona({ heads: {}, revisions: [] }, source);
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: PersonaRequest): Promise<T> {
        shelf = acceptPersona(shelf, request.envelope!, request.fork);
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  const initial = await prepareGuest(source);
  const claim = await session.claim(source, 'shared');
  const book: ContinuityBook = {
    v: 1,
    arrivals: [{ source, claim, initial, scope: 'shared' }],
    heads: [claim],
    rows: [continuityRow(claim, 'admitted', 'shared')],
  };
  const state = newGame(42, 5, [initial]);
  while (state.now < 3450) advance(state, Math.min(60, 3450 - state.now));
  apply(state, { type: 'guest-action', guest: 'zeynep-pass', action: 'offer-trial' });
  while (state.now < 3540) advance(state, Math.min(60, 3540 - state.now));
  for (const fork of [true, false, true, false]) {
    const wire = await guestCheckpointTransfer(state, 'zeynep-pass', source);
    await session.publish(book, source.castId, wire, fork);
    const imported = verifyImport(JSON.stringify(exportRun(state, state.inputs, book)));
    await expect(
      validateContinuity(imported.continuity, imported.state, imported.inputs),
    ).resolves.toBeUndefined();
    advance(state, 1);
  }
  const accepted = book.heads[0]!;
  const { revision: _revision, ...body } = accepted;
  const forged = await createPersona({
    ...body,
    transfer: {
      ...accepted.transfer,
      admission: {
        ...(accepted.transfer.admission as Record<string, unknown>),
        sourceRevision: 'f'.repeat(64),
      },
    },
  });
  const corrupt = structuredClone(book);
  corrupt.heads = [forged];
  corrupt.rows = corrupt.rows.map((row) =>
    row.revision === accepted.revision ? { ...row, revision: forged.revision } : row,
  );
  await expect(validateContinuity(corrupt, state, state.inputs)).rejects.toThrow(/checkpoint|lineage/);
});
