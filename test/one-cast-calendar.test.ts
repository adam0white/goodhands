import { readFileSync } from 'node:fs';
import {
  type CalendarPersonaSnapshot,
  DEFAULT_NORMS,
  tick,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import { canonicalPersona, createPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { maintainCalendarGuest, startCalendarRoutine } from '../src/sim/guest-calendar.ts';
import {
  advance,
  apply,
  exportGuest,
  fingerprint,
  newGame,
  prepareGuest,
  replay,
  view,
} from '../src/sim/index.ts';
import { type ContinuityBook, continuityRow } from '../src/ui/continuity.ts';
import {
  compactRun,
  exportRun,
  guestCheckpointTransfer,
  validateContinuity,
  verifyImport,
} from '../src/ui/export.ts';

const fixture = () =>
  JSON.parse(
    readFileSync(new URL('./fixtures/voice4-departure.json', import.meta.url), 'utf8'),
  ) as PersonaEnvelope;
const provenance = JSON.parse(
  readFileSync(new URL('./fixtures/voice4-departure-provenance.json', import.meta.url), 'utf8'),
);
const wrapper = (envelope: PersonaEnvelope) => validateCalendarPersona(envelope.transfer.person);
function runTo(s: ReturnType<typeof newGame>, at: number) {
  while (s.now < at) advance(s, Math.min(60, at - s.now));
}
function answer(s: ReturnType<typeof newGame>) {
  apply(s, { type: 'guest-action', guest: 'selin-voice', action: 'ask-service' });
  const end = s.now + 180;
  while (view(s).guests!.find((g) => g.id === 'selin-voice')!.status !== 'complete' && s.now < end)
    advance(s, 1);
  expect(view(s).guests!.find((g) => g.id === 'selin-voice')!.status).toBe('complete');
}
async function rehash(envelope: PersonaEnvelope) {
  const { revision: _, ...body } = envelope;
  return createPersona(body);
}
function calendar(p: Awaited<ReturnType<typeof exportGuest>>['projection']): CalendarPersonaSnapshot {
  if (p.format !== 'hf-persona-calendar/1') throw Error('calendar wrapper required');
  return p;
}
describe('Selin quiet calendar', () => {
  it('rejects extra source facts and a retained fact with a different id before admission', async () => {
    const extra = fixture();
    (extra.transfer.history as unknown[]).push({
      id: 'invented',
      summary: 'Invented source claim',
      at: 2500,
      sourceGame: 'voice',
      sourceEpisodeId: 'invented',
    });
    await expect(prepareGuest(await rehash(extra))).rejects.toThrow(/source history/);
    const wrongId = fixture();
    (wrongId.transfer.history as { id: string }[])[0]!.id = 'invented-id';
    await expect(prepareGuest(await rehash(wrongId))).rejects.toThrow(/source history/);
  });
  it.each(['action', 'entity', 'chain', 'role'] as const)(
    'rejects unsupported incoming calendar %s before admission',
    async (kind) => {
      const envelope = fixture(),
        payload = envelope.transfer.person as CalendarPersonaSnapshot;
      const job = payload.calendar.commitments.find((c) => c.kind === 'job')!;
      job.status = 'pending';
      job.from = 3420;
      job.until = 3960;
      if (kind === 'action') job.actions = ['unsupported-action'];
      if (kind === 'entity') job.targetId = 'unsupported-entity';
      if (kind === 'chain') job.chain = 'unsupported-chain';
      if (kind === 'role') job.kind = 'promise';
      await expect(prepareGuest(await rehash(envelope))).rejects.toThrow(/unsupported/);
    },
  );

  it('continues the actual pending iftar while Nermin waits and answers after the current activity', async () => {
    const admission = await prepareGuest(fixture());
    const s = newGame(76, 6, [admission]);
    runTo(s, admission.person.now);
    expect(s.people['selin-voice']!.activity?.action).toBe('eat');
    // Nermin has not selected a reply; waiting must not freeze Selin's ordinary meal.
    runTo(s, 2620);
    expect(s.people['selin-voice']!.agenda.commitments.find((c) => c.chain === 'sawm:iftar')?.status).toBe(
      'kept',
    );
    const owed = s.people['selin-voice']!.agenda.owed!.length;
    answer(s);
    expect(s.people['selin-voice']!.agenda.owed).toHaveLength(owed);
    expect(fingerprint(replay(s.seed, s.inputs, s.now, 6, [admission]))).toBe(fingerprint(s));
  });
  it('schedules synthetic owed worship in a future declared qada window after today expires', async () => {
    const admission = await prepareGuest(fixture());
    const p = admission.person;
    // Default Selin has no owed worship. This explicitly labeled control tests the supported generic wire.
    p.agenda.owed!.push({
      ofId: 'synthetic-owed-prayer',
      kind: 'worship',
      actions: ['pray'],
      reason: 'missed',
      at: p.now - 200,
      normId: 'salah',
    });
    maintainCalendarGuest(p, admission.calendar!.calendarHost);
    const makeup = p.agenda.commitments.find((c) => c.makeUpOf === 'synthetic-owed-prayer')!;
    expect(makeup.from).toBeGreaterThan(p.now);
    expect(makeup.until).toBeGreaterThan(p.now);
    expect(makeup.actions).toEqual(['pray-qada']);
    tick(p, p.now + 1);
    expect(makeup.status).toBe('pending');
    expect(p.agenda.owed!.find((d) => d.ofId === 'synthetic-owed-prayer')?.scheduledAs).toBe(makeup.id);
  });

  it('admits actual ordinary-input Voice4 departure with unpaid duties intact', async () => {
    const envelope = fixture(),
      source = wrapper(envelope);
    expect(provenance.kind).toBe('actual-ordinary-input-voice4-departure');
    expect(provenance.replayDriftAt).toBe(-1);
    expect(provenance.sourceDirty).toBe(false);
    expect(provenance.sourceCommit).toBe('fecf72682cd2e00f03c78007e71f2cbfe76f3459');
    expect(provenance.publicHf.version).toBe('2.16.0');
    expect(envelope.revision).toBe(provenance.envelopeRevision);
    const admission = await prepareGuest(envelope);
    expect(admission.calendar?.calendarHost.originSourceNow).toBe(provenance.actualSourceNow);
    expect(admission.person.agenda.owed).toEqual(source.calendar.owed);
    expect(admission.person.agenda.commitments).toEqual(source.calendar.commitments);
    expect(admission.person.conscience.norms).toEqual(source.calendar.heldNorms);
    expect(admission.person.rng).toEqual(source.person.rng);
    expect(source.calendar.owed.length).toBeGreaterThan(0);
  });
  it('returns the actual Nermin answer with original source binding and live owed state', async () => {
    const envelope = fixture();
    const admission = await prepareGuest(envelope);
    const s = newGame(73, 6, [admission]);
    runTo(s, admission.person.now);
    const person = s.people['selin-voice']!;
    const source = wrapper(envelope);
    expect(view(s).guests!.find((g) => g.id === 'selin-voice')!.text).toContain(
      source.person.episodes[0]!.summary,
    );
    answer(s);
    expect(view(s).guests!.find((g) => g.id === 'selin-voice')!.status).toBe('complete');
    const out = await exportGuest(s, 'selin-voice');
    const back = calendar(out.projection);
    expect(out.targetOpening).toBe(admission.calendar!.calendarHost.originSourceNow);
    expect(out.sourceRevision).toBe(envelope.revision);
    expect(out.sourceCheckpointDigest).toBe(
      (envelope.transfer.checkpoint as { checkpointDigest: string }).checkpointDigest,
    );
    expect(back.person.episodes[0]).toMatchObject({
      action: 'selin-enquiry',
      actorId: 'nermin-goodhands',
      targetId: 'selin',
    });
    expect(back.calendar.owed).toHaveLength(person.agenda.owed!.length);
    expect(back.calendar.owed[0]).toMatchObject({
      reason: 'broken',
      ofId: `goodhands-return:${person.agenda.owed![0]!.ofId}`,
    });
    expect(back.calendar.commitments.find((c) => c.kind === 'job')).toMatchObject({
      actions: ['work'],
      chain: 'job',
    });
    expect(fingerprint(replay(s.seed, s.inputs, s.now, 6, [admission]))).toBe(fingerprint(s));
  });
  it('replays full and compact calendar arrivals with pinned heads', async () => {
    const source = fixture(),
      admission = await prepareGuest(source);
    const { revision, ...body } = source;
    const claim = await createPersona({
      ...body,
      parentRevision: revision,
      source: { game: 'goodhands', build: 'calendar-test', engine: '2.14.1', rules: 'goodhands-5' },
    });
    const book: ContinuityBook = {
      v: 1,
      arrivals: [{ source, claim, initial: admission, scope: 'file' }],
      heads: [claim],
      rows: [continuityRow(claim, 'admitted', 'file')],
    };
    const s = newGame(74, 6, [admission]);
    runTo(s, admission.person.now);
    answer(s);
    const transfer = await guestCheckpointTransfer(s, 'selin-voice', source);
    expect((transfer.person as CalendarPersonaSnapshot).format).toBe('hf-persona-calendar/1');
    const { revision: claimRevision, ...claimBody } = claim;
    const head = await createPersona({ ...claimBody, parentRevision: claimRevision, transfer });
    book.heads = [head];
    book.rows.push(continuityRow(head, 'checkpoint', 'file'));
    const full = exportRun(s, s.inputs, book);
    for (const file of [full, compactRun(full)]) {
      const loaded = verifyImport(JSON.stringify(file));
      expect(loaded.state).toEqual(s);
      expect(loaded.continuity.heads).toEqual([head]);
      await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
    }
  });
  it('reserves distinct make-up days and preserves a kept receipt in an explicit transport control', async () => {
    const admitted = await prepareGuest(fixture()),
      p = admitted.person,
      host = admitted.calendar!.calendarHost;
    // Explicit transport control: paid state is represented by a retained kept receipt, never inferred from time.
    const original = p.agenda.owed![0]!;
    const receiptId = 'control-kept-receipt';
    p.agenda.commitments.push({
      id: receiptId,
      kind: 'abstain',
      actions: [],
      violatedBy: structuredClone(original.violatedBy),
      normId: original.normId,
      from: p.now - 100,
      until: p.now - 20,
      importance: 0.8,
      status: 'kept',
      makeUpOf: 'control-paid-original',
    });
    p.agenda.owed!.push({
      ...structuredClone(original),
      ofId: 'control-paid-original',
      scheduledAs: receiptId,
      at: p.now - 200,
    });
    p.agenda.owed!.push({
      ...structuredClone(original),
      ofId: 'control-unscheduled-extra',
      scheduledAs: undefined,
    });
    // Ensure bounded JSON keeps optional absence, rather than an explicit undefined property.
    delete p.agenda.owed!.at(-1)!.scheduledAs;
    maintainCalendarGuest(p, host);
    const days = p.agenda.commitments
      .filter((c) => c.kind === 'abstain' && c.makeUpOf && c.status === 'pending')
      .map((c) => Math.floor(c.from / 1440));
    expect(new Set(days).size).toBe(days.length);
    expect(p.agenda.owed!.find((d) => d.ofId === 'control-paid-original')?.scheduledAs).toBe(receiptId);
    expect(p.agenda.commitments.find((c) => c.id === receiptId)?.status).toBe('kept');
    expect(p.agenda.owed!.find((d) => d.ofId === 'control-unscheduled-extra')?.scheduledAs).toBeTruthy();
    const s = newGame(75, 6, [admitted]);
    runTo(s, p.now);
    answer(s);
    const exported = calendar((await exportGuest(s, 'selin-voice')).projection);
    expect(
      exported.calendar.owed.find((d) => d.ofId === 'goodhands-return:control-paid-original')?.scheduledAs,
    ).toBe(`goodhands-return:${receiptId}`);
    expect(exported.calendar.commitments.find((c) => c.id === `goodhands-return:${receiptId}`)?.status).toBe(
      'kept',
    );
  });
  it('quiet alternatives never force an activity rejected by HF and never start an abstain as work', async () => {
    const admission = await prepareGuest(fixture());
    const person = admission.person;
    startCalendarRoutine(person);
    if (person.activity) {
      const decision = person.trace.findLast((r) => r.id === person.activity!.decisionId);
      expect(decision?.chosenAffordanceId).toBe(person.activity.affordanceId);
      expect(person.activity.action).not.toBe('fast');
      expect(
        person.activity.affordance.fulfills?.some(
          (id) => person.agenda.commitments.find((c) => c.id === id)?.kind === 'abstain',
        ),
      ).not.toBe(true);
    }
  });
  it('rejects changed norm meanings, calendar offsets and source binding', async () => {
    const wrongNorm = fixture();
    const first = (wrongNorm.transfer.person as CalendarPersonaSnapshot).calendar.norms[0]!;
    first.label = 'invented norm meaning';
    await expect(prepareGuest(await rehash(wrongNorm))).rejects.toThrow(/norm semantic/);
    const wrongOffset = fixture();
    (wrongOffset.transfer.person as CalendarPersonaSnapshot).calendar.offset += 1440;
    await expect(prepareGuest(await rehash(wrongOffset))).rejects.toThrow(/offset/);
    const wrongHost = fixture();
    (wrongHost.transfer.calendarHost as { originSourceNow: number }).originSourceNow += 1;
    await expect(prepareGuest(await rehash(wrongHost))).rejects.toThrow(/provenance/);
    const missingReference = fixture();
    (missingReference.transfer.person as CalendarPersonaSnapshot).calendar.owed[0]!.scheduledAs =
      'unproven-history';
    const admitted = await prepareGuest(await rehash(missingReference));
    expect(admitted.person.agenda.owed![0]!.scheduledAs).toBe('unproven-history');
    expect(DEFAULT_NORMS.length).toBeGreaterThan(0);
    expect(canonicalPersona(admitted.person)).not.toContain('invented norm meaning');
  });
});
