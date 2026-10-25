import { expect, test } from 'vitest';
import { apply, fingerprint, newGame, view } from '../src/sim/index.ts';
import { termsWords } from '../src/sim/negotiation.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

const terms = { wage: 9000, startHour: 8, endHour: 17, dayOff: 6, trialDays: 3, fee: 4000 };
test.each([
  [1, '1 working day.'],
  [3, '3 working days.'],
] as const)('the offer names %i working days before a trial is agreed', (trialDays, words) => {
  expect(termsWords({ ...terms, trialDays })).toContain(words);
});
test('phase 1 compact histories keep simulation 2 and its fingerprint', () => {
  const state = newGame(37, 2);
  apply(state, { type: 'interview', candidate: 'sevda' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'q-patient' });
  expect(fingerprint(state)).toBe('8ac987cc');
  const run = compactRun(exportRun(state, state.inputs));
  expect(run.simulation).toBe(2);
  expect(fingerprint(verifyImport(JSON.stringify(run)).state)).toBe('8ac987cc');
});
test('full and compact simulation 3 exports replay each new verb', () => {
  for (const verb of ['call-in', 'propose-terms', 'call-household']) {
    const state = newGame(17, 3);
    if (verb === 'call-in') {
      apply(state, { type: 'take-number', candidate: 'sevda' });
      apply(state, { type: 'call-in', candidate: 'sevda' });
    } else if (verb === 'propose-terms') {
      apply(state, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
      expect(view(state).scene?.kind).toBe('negotiation');
      apply(state, { type: 'propose-terms', scene: view(state).scene!.id, terms });
    } else {
      apply(state, { type: 'call-household', family: 'arslans', member: 'arslans-0', topic: 'progress' });
    }
    const full = exportRun(state, state.inputs);
    expect(full.simulation).toBe(3);
    expect(state.inputs.some((entry) => entry.input.type === verb)).toBe(true);
    for (const run of [full, compactRun(full)]) {
      const imported = verifyImport(JSON.stringify(run));
      expect(fingerprint(imported.state)).toBe(full.fingerprint);
      expect(imported.inputs).toEqual(state.inputs);
    }
  }
});
test('imports reject malformed new inputs before running them', () => {
  const state = newGame(17);
  const run = compactRun(exportRun(state, []));
  const invalid = [
    { type: 'call-in', candidate: '' },
    { type: 'call-household', family: 'arslans', member: 'arslans-0', topic: 'secrets' },
    { type: 'call-household', family: 'arslans', member: 'arslans-0', topic: 'progress', extra: true },
    ...[{ wage: -1 }, { endHour: 7 }, { trialDays: 0 }, { dayOff: 7 }, { fee: -1 }, { unexpected: 1 }].map(
      (change) => ({ type: 'propose-terms', scene: 'scene-1', terms: { ...terms, ...change } }),
    ),
  ];
  for (const input of invalid) {
    expect(() => verifyImport(JSON.stringify({ ...run, inputs: [{ at: 510, input }] }))).toThrow(
      'Invalid input history',
    );
  }
  expect(() => verifyImport(JSON.stringify({ ...run, simulation: 99 }))).toThrow(
    'Unsupported simulation version',
  );
});

test('full and compact edition 4 exports retain their rules edition', () => {
  const state = newGame(17, 4);
  apply(state, { type: 'interview', candidate: 'sevda' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'last-family' });
  const full = exportRun(state, state.inputs);
  expect(full.simulation).toBe(4);
  for (const run of [full, compactRun(full)]) {
    expect(verifyImport(JSON.stringify(run)).state).toEqual(state);
  }
});
