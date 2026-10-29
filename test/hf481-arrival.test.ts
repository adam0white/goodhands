import { exportRun as archive, replay as replayHF } from '@adam0white/human-framework';
import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { stepGuests } from '../src/sim/guests.ts';
import { bindFramework, ENGINE_VERSION, runFor, saveFramework, tick } from '../src/sim/hf4.ts';
import { advance, apply, newGame } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

test('a retained visitor arrives mid-run with her original portable input and exact replay', async () => {
  const source = newGame(7);
  // An available source departure is distinct from completing the visitor's enquiry.
  (source.guests as { id: string; status: string }[]).find((g) => g.id === 'zeynep-pass')!.status =
    'complete';
  apply(source, { type: 'pause-cast' });
  const transfer = await agencyTransfer(source, 'zeynep-pass');
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: CAST['zeynep-pass'].castId,
    castRevision: CAST['zeynep-pass'].revision,
    branchId: 'arrival-control',
    parentRevision: null,
    source: { game: 'goodhands', build: 'control', engine: ENGINE_VERSION, rules: 'goodhands-6' },
    transfer: { ...transfer, life: initialPersonaLife(CAST['zeynep-pass'].castId, 'arrival-control', 0) },
    limitations: [],
  });
  const chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 9);
  const state = newGame(9, 6, [], chapter);
  const before = archive(runFor(state));
  expect(before.initial.people.some((p) => p.id === 'zeynep-pass')).toBe(false);
  expect(before.current.people['zeynep-pass']).toBeUndefined();
  const arrival = (state.guests as { id: string; arrival: number }[]).find(
    (g) => g.id === 'zeynep-pass',
  )!.arrival;
  const { emptyContinuity } = await import('../src/ui/continuity.ts');
  const book = emptyContinuity();
  book.chapter = chapter;
  book.initialClaims = [];
  const full = exportRun(state, state.inputs, book);
  for (const file of [full, compactRun(full)])
    expect(verifyImport(JSON.stringify(file)).state).toEqual(state);
  // Synthetic host-boundary control: exercise the pre-arrival meal boundary
  // without generating an unrelated day of 84 people's actions.
  state.now = 1110;
  stepGuests(state);
  expect(archive(runFor(state)).current.people['zeynep-pass']).toBeUndefined();
  tick(state.people.nermin!, arrival + 1);
  saveFramework(state);
  const after = archive(runFor(state));
  const entry = after.history.flatMap((t) => t.inputs).find((i) => i.kind === 'person.arrived');
  expect(entry?.kind).toBe('person.arrived');
  if (entry?.kind === 'person.arrived') {
    expect(entry.at).toBe(arrival * 60_000);
    expect(entry.payload.authored.portable?.person).toEqual(parent.transfer.portable);
    expect(entry.payload.authored.portable?.mapping.offsetMs).toBe(
      chapter.actors['zeynep-pass']!.portable!.mapping.offsetMs,
    );
  }
  const replay = replayHF(after);
  expect(replay.ok).toBe(true);
  if (replay.ok) expect(replay.value.fullHash).toBe(after.hashes.full);
  const restored = structuredClone(state);
  bindFramework(restored);
  tick(restored.people.nermin!, arrival + 2);
  tick(state.people.nermin!, arrival + 2);
  saveFramework(restored);
  saveFramework(state);
  expect(restored).toEqual(state);
}, 180000);

test('skipped people never enter HF, appear on the bench, or acquire guest activity', async () => {
  const skipped = ['hulya', 'zeynep-pass'].map((key) => ({
    castId: CAST[key as keyof typeof CAST].castId,
    reason: 'Owned by another chapter.',
  }));
  const chapter = await prepareAgencyChapter([], 7, skipped);
  const state = newGame(7, 6, [], chapter);
  advance(state, 10);
  saveFramework(state);
  expect(archive(runFor(state)).initial.people.some((p) => ['hulya', 'zeynep-pass'].includes(p.id))).toBe(
    false,
  );
  expect((state.cards as Record<string, { met: boolean }>).hulya?.met).toBe(false);
  const { emptyContinuity } = await import('../src/ui/continuity.ts');
  const book = emptyContinuity();
  book.chapter = chapter;
  book.initialClaims = [];
  const exported = exportRun(state, state.inputs, book);
  for (const file of [exported, compactRun(exported)])
    expect(verifyImport(JSON.stringify(file)).state).toEqual(state);
  await expect(
    prepareAgencyChapter([], 7, [{ castId: CAST.nermin.castId, reason: 'Still elsewhere.' }]),
  ).rejects.toThrow(/Nermin/);
}, 180000);
