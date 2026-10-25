import { expect, test } from 'vitest';
import type { State } from '../src/sim/types.ts';
import { advance, apply, fingerprint, newGame, replay, view } from './previous-simulation.ts';

function until(s: State, at: number) {
  while (s.now < at) advance(s, at - s.now);
}
function close(s: State) {
  if (view(s).scene) apply(s, { type: 'close-scene', scene: view(s).scene!.id });
}
function candidate(s: State, id: string) {
  return [...view(s).bench, ...view(s).books].find((c) => c.id === id)!;
}
test('a reference call cannot repeat testimony or add duplicate notes', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  close(s);
  until(s, 600);
  const ref = candidate(s, 'sevda').referees[0]!;
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: ref.id });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'ref-patient' });
  close(s);
  const before = structuredClone(candidate(s, 'sevda').notes);
  expect(candidate(s, 'sevda').referees[0]?.why).toContain('already told you');
  expect(candidate(s, 'sevda').referees[0]?.reachable).toBe(false);
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: ref.id });
  expect(view(s).scene).toBeNull();
  expect(candidate(s, 'sevda').notes).toEqual(before);
});
test('a trial status names tomorrow noon and its report arrives then', () => {
  const s = newGame(1);
  apply(s, { type: 'trial', candidate: 'sevda', family: 'arslans' });
  expect(candidate(s, 'sevda').busy).toContain('Tuesday 3 November, 12:00');
  until(s, 2160);
  expect(candidate(s, 'sevda').status).toBe('books');
  let found = false;
  for (let i = 0; i < 30 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind === 'trial-result') found = true;
    close(s);
  }
  expect(found).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});
test('an expired request carries a one-line reason', () => {
  const s = newGame(1);
  until(s, 1921);
  const r = view(s).requests.find((r) => r.family === 'arslans')!;
  expect(r.status).toBe('lost');
  expect(r.lostReason).toMatch(/needed someone earlier|asked elsewhere/);
});
test('an unknown wage refusal speaks visibly and makes the wage known', () => {
  const s = newGame(1);
  until(s, 900);
  apply(s, { type: 'interview', candidate: 'cem' });
  close(s);
  apply(s, { type: 'trial', candidate: 'cem', family: 'demirs' });
  expect(view(s).scene?.lines[0]?.text).toContain('9000');
  expect(candidate(s, 'cem').wage).toBe(9000);
  expect(candidate(s, 'cem').matchReasons?.find((r) => r.family === 'demirs')?.words).toContain('8500');
});

test('ending a reference warns that its unanswered questions will not be available on a new call', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  close(s);
  until(s, 600);
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: candidate(s, 'sevda').referees[0]!.id });
  expect(view(s).scene!.choices.find((c) => c.id === 'finish')?.hint).toContain('before hanging up');
});
