import { describe, expect, it } from 'vitest';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index';
import type { LoggedInput } from '../src/sim/types';
import { compactRun, exportRun, verifyImport } from '../src/ui/export';

describe('run exports', () => {
  function fixture() {
    let state = newGame(17);
    const inputs: LoggedInput[] = [{ at: view(state).now, input: { type: 'speed', speed: 2 } }];
    state = apply(state, { type: 'speed', speed: 2 });
    state = advance(state, 10);
    return exportRun(state, inputs);
  }
  it('replays full and compact runs without sharing input arrays', () => {
    const run = fixture();
    for (const data of [run, compactRun(run)]) {
      const imported = verifyImport(JSON.stringify(data));
      expect(fingerprint(imported.state)).toBe(run.fingerprint);
      expect(imported.inputs).toEqual(run.inputs);
    }
    const compact = compactRun(run);
    compact.inputs.length = 0;
    expect(run.inputs).toHaveLength(1);
    expect(compact).not.toHaveProperty('state');
  });
  it('rejects changed fingerprints and changed full snapshots', () => {
    const run = fixture();
    expect(() => verifyImport(JSON.stringify({ ...run, fingerprint: 'wrong' }))).toThrow();
    expect(() => verifyImport(JSON.stringify({ ...run, state: newGame(18) }))).toThrow();
  });
  it('rejects malformed employment terms before replay', () => {
    const run = compactRun(fixture());
    const valid = { wage: 9000, startHour: 9, endHour: 17, dayOff: 0, trialDays: 3, fee: 500 };
    const { fee: _fee, ...missing } = valid;
    for (const terms of [
      missing,
      { ...valid, extra: 1 },
      { ...valid, wage: '9000' },
      { ...valid, wage: null },
    ]) {
      expect(() =>
        verifyImport(
          JSON.stringify({
            ...run,
            inputs: [{ at: 510, input: { type: 'propose-terms', scene: 'scene-1', terms } }],
          }),
        ),
      ).toThrow('Invalid input history.');
    }
    const overflowing = JSON.stringify({
      ...run,
      inputs: [{ at: 510, input: { type: 'propose-terms', scene: 'scene-1', terms: valid } }],
    }).replace('9000', '1e400');
    expect(() => verifyImport(overflowing)).toThrow('Invalid input history.');
  });
  it('rejects a historical original-edition envelope clock beyond its actual end', () => {
    const state = replay(17, [], 40320, 1);
    const run = compactRun(exportRun(state, []));
    expect(() => verifyImport(JSON.stringify({ ...run, minute: run.minute + 1 }))).toThrow('clock');
  });
  it('rejects a current envelope clock before the actual opening', () => {
    const run = compactRun(exportRun(newGame(17), []));
    expect(() => verifyImport(JSON.stringify({ ...run, minute: run.minute - 1 }))).toThrow(
      'The run is incomplete.',
    );
  });
  it('rejects malformed input types, values, ordering and clocks', () => {
    const run = compactRun(fixture());
    for (const input of [
      { type: 'unknown' },
      { type: 'speed', speed: 4 },
      { type: 'interview', candidate: '' },
      { type: 'place', candidate: 'a', family: 'b', vouch: ['evil'] },
      { type: 'check-in', placement: 'a', how: 'text' },
      { type: 'choose', scene: 'a', choice: 1 },
      { type: 'sleep', extra: true },
    ])
      expect(() => verifyImport(JSON.stringify({ ...run, inputs: [{ at: 510, input }] }))).toThrow();
    for (const minute of [-1, 1e20, null])
      expect(() => verifyImport(JSON.stringify({ ...run, minute }))).toThrow();
    for (const at of [-1, run.minute + 1, null])
      expect(() =>
        verifyImport(JSON.stringify({ ...run, inputs: [{ at, input: { type: 'sleep' } }] })),
      ).toThrow();
    expect(() =>
      verifyImport(
        JSON.stringify({
          ...run,
          inputs: [
            { at: 512, input: { type: 'speed', speed: 1 } },
            { at: 511, input: { type: 'speed', speed: 1 } },
          ],
        }),
      ),
    ).toThrow();
  });
});

it('round-trips a live interview through JSON optional fields', () => {
  let state = newGame(1);
  const inputs: LoggedInput[] = [];
  const interview = { type: 'interview', candidate: 'sevda' } as const;
  inputs.push({ at: view(state).now, input: interview });
  state = apply(state, interview);
  const run = exportRun(state, inputs);
  const imported = verifyImport(JSON.stringify(run));
  expect(fingerprint(imported.state)).toBe(run.fingerprint);
  const changed = JSON.parse(JSON.stringify(run));
  changed.state.scene.lines[0].text = 'Changed testimony';
  expect(() => verifyImport(JSON.stringify(changed))).toThrow();
});

it('imports named waiting as a replayable input', () => {
  let state = newGame(1);
  const inputs: LoggedInput[] = [{ at: view(state).now, input: { type: 'wait-for' } }];
  state = apply(state, { type: 'wait-for' });
  const run = compactRun(exportRun(state, inputs));
  expect(verifyImport(JSON.stringify(run)).inputs).toEqual(inputs);
});

it('keeps a saved candidate’s number through full and compact imports', () => {
  let state = newGame(1);
  const input = { type: 'take-number', candidate: 'pinar' } as const;
  const inputs: LoggedInput[] = [{ at: view(state).now, input }];
  state = apply(state, input);
  const run = exportRun(state, inputs);
  for (const data of [run, compactRun(run)]) {
    const imported = verifyImport(JSON.stringify(data));
    expect(imported.inputs).toEqual(inputs);
    expect(view(imported.state).bench.some((c) => c.id === 'pinar')).toBe(false);
    expect(view(imported.state).books.find((c) => c.id === 'pinar')?.status).toBe('books');
  }
});

// Authored two-input history, in the same compact envelope used by notebook exports.
it('loads an unversioned simulation export through the frozen original engine', () => {
  const run = {
    game: 'goodhands',
    version: 1,
    seed: 37,
    minute: 519,
    inputs: [
      { at: 510, input: { type: 'interview', candidate: 'sevda' } },
      { at: 510, input: { type: 'choose', scene: 'scene-1', choice: 'q-patient' } },
    ],
    fingerprint: 'ef02eb7b',
  };
  const imported = verifyImport(JSON.stringify(run));
  expect(imported.state.version).toBe(1);
  expect(fingerprint(imported.state)).toBe('ef02eb7b');
  expect(compactRun(exportRun(imported.state, imported.inputs))).toEqual(run);
});
