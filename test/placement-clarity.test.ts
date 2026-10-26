import { expect, it } from 'vitest';
import { apply, fingerprint, newGame, view } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';
import { addedEvidence, placementDeadline } from '../src/ui/render.ts';

it('counts the answers left in this visit without changing the saved scene or replay', () => {
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'sevda' });
  for (const [used, choice] of ['last-family', 'wage', 'q-patient', 'hours'].entries()) {
    expect(view(state).scene?.questionsRemaining).toBe(4 - used);
    apply(state, { type: 'choose', scene: view(state).scene!.id, choice });
  }
  expect(view(state).scene?.questionsRemaining).toBe(0);
  expect(view(state).scene?.choices.map((c) => c.id)).toEqual(['done']);
  expect(state.scene).not.toHaveProperty('questionsRemaining');
  const run = exportRun(state, state.inputs);
  for (const data of [run, compactRun(run)]) {
    expect(fingerprint(verifyImport(JSON.stringify(data)).state)).toBe(fingerprint(state));
  }
});

it('calls a doubtful patience answer evidence without endorsing it', () => {
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'sevda' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'q-patient' });
  const notes = view(state).scene!.added!;
  expect(addedEvidence(notes)).toBe(
    `${notes[0]!.from} told Nermin about this worker. Nermin’s reading: ${notes[0]!.phrase}`,
  );
  expect(addedEvidence(notes.map((n) => ({ ...n, crossedOut: true })))).toBe('');
});

it('uses the selected household deadline, including another household', () => {
  const state = newGame(1);
  const v = view(state);
  const request = v.requests[0]!;
  expect(placementDeadline(v, request.family)).toContain(`by ${request.byLabel}.`);
  expect(placementDeadline(v, 'missing')).toBe('');
  const next = { ...request, family: 'kayas', byLabel: 'Wednesday 4 November 08:00' };
  expect(placementDeadline({ ...v, requests: [...v.requests, next] }, 'kayas')).toContain(
    'by Wednesday 4 November 08:00.',
  );
});

it('immediate evidence states the speaker and Nermin’s uncertain reading without changing the raw note', () => {
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'sevda' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'q-patient' });
  const notes = view(state).scene!.added!;
  const original = structuredClone(notes);
  expect(addedEvidence(notes)).toContain(`${notes[0]!.from} told Nermin`);
  expect(addedEvidence(notes)).toContain(notes[0]!.phrase);
  expect(notes).toEqual(original);
});

it('names the actual afternoon placement agreement time without claiming a meal or witnessed work', async () => {
  const { placementTiming } = await import('../src/ui/render.ts');
  expect(placementTiming({ since: 15 * 60 + 38 })).toBe('Placement agreed Monday 2 November at 15:38.');
});
