import { expect, test } from 'vitest';
import { advance, apply, newGame, replay, view } from '../src/sim/index.ts';
import { verifyImport as historicalVerify } from '../src/sim/v6/export.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';
import { createFileSession } from '../src/ui/file-session.ts';

test('historical export is refused without replacing the held file', async () => {
  // Existing authored two-input historical envelope, also checked by export.test.ts.
  const old = {
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
  const oldFile = new File([JSON.stringify(old)], 'old.json');
  const current = new File([JSON.stringify(exportRun(newGame(24), []))], 'current.json');
  const session = createFileSession();
  await session.select(current);
  const before = session.snapshot();
  const original = session.original();
  await expect(session.select(oldFile)).rejects.toThrow(/keep.*start a new game/i);
  expect(session.snapshot()).toEqual(before);
  expect(session.original()).toEqual(original);
  expect(() => verifyImport(JSON.stringify(old))).toThrow(/keep.*start a new game/i);
  expect(() => newGame(37, 2)).toThrow(/start a new game/i);
  expect(() => replay(37, [], old.minute, 1)).toThrow(/start a new game/i);
  const state = historicalVerify(JSON.stringify(old)).state;
  expect(() => view(state)).toThrow(/start a new game/i);
  expect(() => apply(state, { type: 'speed', speed: 2 })).toThrow(/start a new game/i);
  expect(() => advance(state, 1)).toThrow(/start a new game/i);
});
