import { readFileSync, writeFileSync } from 'node:fs';
import { exportRun as archive } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { runFor, saveFramework } from '../src/sim/hf4.ts';
import { advance, apply, newGame, view } from '../src/sim/index.ts';
import { familyMoment } from '../src/sim/references.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

it('carries an attributed request through the real opening and never reports the requested chore as done', () => {
  const state = newGame(7);
  const request = 'For the morning routine, we need a nanny who will give Elif time to choose her clothes.';
  const visible = view(state);
  expect(visible.requests.find((r) => r.family === 'arslans')?.wants).toBe(request);
  expect(visible.families.find((f) => f.id === 'arslans')?.line).toContain(request);
  expect(JSON.stringify(state.log)).toContain(request);
  expect(familyMoment('arslans', 'patient', true, 'Gülce')).not.toMatch(/clothes|morning routine/i);
  expect(familyMoment('arslans', 'patient', false, 'Gülce')).not.toMatch(/clothes|morning routine/i);
});

it('captures a complete opening and checks full and compact cold replay with the same next input', () => {
  const state = newGame(7);
  advance(state, 10);
  saveFramework(state);
  if (process.env.NEEDS_BASELINE) {
    writeFileSync(
      process.env.NEEDS_BASELINE,
      JSON.stringify({ state, archive: archive(runFor(state)), full: exportRun(state, state.inputs) }),
    );
  }
  const full = exportRun(state, state.inputs);
  for (const file of [full, compactRun(full)]) {
    const rebuilt = verifyImport(JSON.stringify(file)).state;
    expect(rebuilt).toEqual(state);
    expect(archive(runFor(rebuilt))).toEqual(archive(runFor(state)));
    const input = { type: 'interview', candidate: 'gul' } as const;
    const original = structuredClone(state);
    apply(original, input);
    apply(rebuilt, input);
    expect(rebuilt).toEqual(original);
    saveFramework(original);
    saveFramework(rebuilt);
    expect(archive(runFor(rebuilt))).toEqual(archive(runFor(original)));
  }
}, 180000);

it('carries a later family request into the phone and family view', () => {
  const state = newGame(7);
  for (let i = 0; i < 30 && state.now < 840; i++) {
    const current = view(state);
    if (current.scene)
      apply(state, { type: 'choose', scene: current.scene.id, choice: current.scene.choices[0]!.id });
    else if (current.phoneRinging) apply(state, { type: 'answer-phone' });
    else advance(state, 840 - state.now);
  }
  const request = 'We need a driver who will keep the addresses on our journey list private.';
  expect(view(state).requests.find((r) => r.family === 'demirs')?.wants).toBe(request);
  expect(view(state).families.find((f) => f.id === 'demirs')?.line).toContain(request);
  expect(JSON.stringify(state.log)).toContain(request);
  for (let i = 0; i < 5 && view(state).phoneRinging; i++) {
    apply(state, { type: 'answer-phone' });
    if (view(state).scene?.title === 'Request: the Demir family') break;
    const scene = view(state).scene;
    if (scene) apply(state, { type: 'close-scene', scene: scene.id });
  }
  expect(view(state).scene?.title).toBe('Request: the Demir family');
  expect(JSON.stringify(view(state).scene?.lines)).toContain(request);
}, 180000);

it('refuses an exact older current compact export without replacing the held original', async () => {
  const { createFileSession } = await import('../src/ui/file-session.ts');
  // Captured from a03c4e4, seed 7, at minute 520 before request prose changed.
  const old =
    '{"game":"goodhands","version":1,"framework":"4.8.1","castEdition":"goodhands-one-cast-1","oneCast":[],"simulation":6,"seed":7,"minute":520,"inputs":[],"fingerprint":"ecc975a4"}';
  const session = createFileSession();
  const current = new File([JSON.stringify(exportRun(newGame(7), []))], 'current.json');
  await session.select(current);
  const before = session.original();
  const oldFile = new File([old], 'old.json');
  await expect(session.select(oldFile)).rejects.toThrow(/start a new game/i);
  expect(session.original()).toEqual(before);
  expect(await oldFile.text()).toBe(old);
  if (process.env.NEEDS_OLD_BASELINE) {
    const baseline = JSON.parse(readFileSync(process.env.NEEDS_OLD_BASELINE, 'utf8')) as { full: unknown };
    const fullBytes = JSON.stringify(baseline.full);
    const oldFull = new File([fullBytes], 'old-full.json');
    await expect(session.select(oldFull)).rejects.toThrow(/start a new game/i);
    expect(session.original()).toEqual(before);
    expect(await oldFull.text()).toBe(fullBytes);
  }
}, 180000);
