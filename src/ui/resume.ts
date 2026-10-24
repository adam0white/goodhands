import { apply } from '../sim/index.ts';
import type { LoggedInput, State } from '../sim/types.ts';

/** Ordinary play resumes a saved departure pause through the existing replayable action. */
export function resumeForPlay(state: State, history: LoggedInput[]): { state: State; inputs: LoggedInput[] } {
  const inputs = structuredClone(history);
  if (!state.castPaused && !state.castPauseRequested) return { state, inputs };
  const input = { type: 'resume-cast' } as const;
  const next = apply(structuredClone(state), input);
  inputs.push({ at: state.now, input });
  return { state: next, inputs };
}
