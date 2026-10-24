import { expect, it } from 'vitest';
import { exportRun, verifyImport } from '../src/ui/export.ts';
import { resumeForPlay } from '../src/ui/resume.ts';
import { pausedRun } from './paused-run.ts';

for (const pending of [false, true]) {
  it(`resumes a replay-verified ${pending ? 'pending-pause' : 'paused'} save with a logged action`, async () => {
    const original = await pausedRun(pending);
    const before = structuredClone(original);
    const resumed = resumeForPlay(original.state, original.inputs);
    expect(resumed.state.castPaused).toBe(false);
    expect(resumed.state.castPauseRequested).toBe(false);
    expect(resumed.inputs.at(-1)).toEqual({ at: original.minute, input: { type: 'resume-cast' } });
    const exported = exportRun(resumed.state, resumed.inputs, original.continuity);
    expect(verifyImport(JSON.stringify(exported)).state).toEqual(resumed.state);
    expect(original).toEqual(before);
  });
}
