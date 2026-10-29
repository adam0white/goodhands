/** Behavioral regression fixtures for the shipped phase-one rules. New tests use sim/index. */
export * from '../src/sim/v6/index.ts';

import * as sim from '../src/sim/v6/index.ts';
import type { LoggedInput, State } from '../src/sim/v6/types.ts';
export const newGame = (seed: number, version: 1 | 2 | 3 = 2): State => sim.newGame(seed, version);
export const replay = (seed: number, inputs: LoggedInput[], until: number, version: 1 | 2 | 3 = 2): State =>
  sim.replay(seed, inputs, until, version);
