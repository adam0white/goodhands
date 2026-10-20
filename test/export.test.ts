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
  it('rejects an envelope clock beyond the actual end', () => {
    const state = replay(17, [], 40320);
    const run = compactRun(exportRun(state, []));
    expect(() => verifyImport(JSON.stringify({ ...run, minute: run.minute + 1 }))).toThrow('clock');
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
