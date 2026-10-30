import { expect, test } from 'vitest';
import { make } from '../scripts/hf-playtest/adapter.ts';
import { fingerprint } from '../src/sim/index.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';

test('public playtest adapter uses the current game and replays an offered input', () => {
  const game = make(1);
  expect(game.state.version).toBe(6);
  const action = game.actions().find((item) => item.kind === 'take-number' && !item.disabled);
  expect(action).toBeDefined();
  game.apply(action!.id);
  const file = exportRun(game.state, game.state.inputs);
  expect(file.framework).toBe('4.8.1');
  expect(file.simulation).toBe(6);
  expect(fingerprint(verifyImport(JSON.stringify(file)).state)).toBe(fingerprint(game.state));
});
