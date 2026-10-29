import { expect, test } from 'vitest';
import { GoodHandsAdapter } from '../scripts/hf-playtest/adapter.ts';
import { runPolicy } from '../scripts/policy.ts';
import { fingerprint, replay, view } from '../src/sim/v6/index.ts';

test('the current careful policy calls a saved contact in before interviewing', () => {
  const state = runPolicy(1, 'careful', 1000, 3);
  expect(state.version).toBe(3);
  expect(state.inputs.some(({ input }) => input.type === 'call-in')).toBe(true);
  expect(view(state).placements.length).toBeGreaterThan(0);
  expect(fingerprint(replay(state.seed, state.inputs, state.now, state.version))).toBe(fingerprint(state));
});
test('the HF adapter shows physical interview limits and offers the call-in verb', () => {
  const game = new GoodHandsAdapter(1);
  game.actions();
  game.apply('take-number:sevda');
  const actions = game.actions();
  expect(actions.find((action) => action.id === 'interview:sevda')?.disabled?.reason).toBeTruthy();
  const call = actions.find((action) => action.id === 'call-in:sevda');
  expect(call).toBeDefined();
  expect(call?.disabled).toBeUndefined();
  game.apply('call-in:sevda');
  expect(
    [...view(game.state).books, ...view(game.state).bench].find((c) => c.id === 'sevda')?.arrival,
  ).toBeTruthy();
});
test('the HF adapter offers known adults as people to phone', () => {
  const game = new GoodHandsAdapter(1);
  const actions = game.actions().filter((action) => action.kind === 'call-household');
  expect(actions.length).toBeGreaterThan(0);
  expect(actions.some((action) => /Saadet/.test(action.label))).toBe(true);
  const call = actions.find((action) => !action.disabled)!;
  game.apply(call.id);
  expect(view(game.state).scene?.kind).toBe('household-call');
});
