import { expect } from 'vitest';
import { advance, apply, newGame } from '../src/sim/index.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { exportRun, validateContinuity, verifyImport } from '../src/ui/export.ts';

export async function pausedRun(pending = false) {
  const book = emptyContinuity();
  // Seed1's ordinary noon meal has accepted current-cast activities. No actor or clock is edited.
  const state = newGame(pending ? 1 : 7);
  if (pending) {
    // advance stops at player-visible events, so keep using the public boundary until noon.
    for (let turn = 0; turn < 300 && state.now < 720; turn++) advance(state, Math.min(60, 720 - state.now));
    expect(state.now).toBe(720);
  }
  apply(state, { type: 'pause-cast' });
  expect(state.castPaused).toBe(!pending);
  expect(state.castPauseRequested).toBe(true);
  const run = exportRun(state, state.inputs, book);
  const loaded = verifyImport(JSON.stringify(run));
  await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
  return run;
}
