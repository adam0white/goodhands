import { trustOf } from '@adam0white/human-framework-legacy3';
import { expect, test } from 'vitest';
import type { State } from '../src/sim/types.ts';
import { advance, apply, fingerprint, newGame, replay, view } from './previous-simulation.ts';

function until(s: State, at: number) {
  while (s.now < at) advance(s, at - s.now);
}
function clear(s: State) {
  for (let i = 0; i < 30; i++) {
    const v = view(s);
    if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
    else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
    else return;
  }
  throw new Error('Phone queue did not clear');
}

test('a driver request brings an available driver within the same half-day', () => {
  const s = newGame(1);
  until(s, 840);
  expect(view(s).requests.find((r) => r.family === 'demirs')?.role).toBe('driver');
  expect(view(s).next?.at).toBeLessThanOrEqual(840 + 325);
  until(s, 900);
  expect(view(s).bench.some((c) => c.roles.includes('driver'))).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('the first evening tests a vouched quality and changes family source trust', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'gul', family: 'arslans', vouch: ['honest'] });
  const before = trustOf(s.people['arslans-0']!, 'nermin');
  until(s, 1100);
  const placement = (s.placements as { moments: { quality: string; good: boolean }[] }[])[0]!;
  expect(placement.moments[0]?.quality).toBe('honest');
  expect(placement.moments[0]?.good).toBe(false);
  expect(trustOf(s.people['arslans-0']!, 'nermin')).toBeLessThan(before);
  clear(s);
  expect(view(s).placements[0]?.lastWord).toContain('You said Gül was honest');
  expect(view(s).placements[0]?.lastWord).toContain('not what you promised');
});

test('an empty office receives a named event after 45 minutes, without character evidence', () => {
  const s = newGame(1);
  for (const c of [...view(s).bench]) apply(s, { type: 'take-number', candidate: c.id });
  until(s, 541);
  const notes = view(s).books.map((c) => c.notes);
  const next = view(s).next;
  expect(next?.label).toContain('street');
  expect(next!.at - 516).toBeGreaterThanOrEqual(30);
  expect(next!.at - 516).toBeLessThanOrEqual(60);
  until(s, next!.at);
  expect(view(s).phoneRinging).not.toBeNull();
  expect(view(s).log.some((l) => l.kind === 'city')).toBe(true);
  expect(view(s).books.map((c) => c.notes)).toEqual(notes);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('ordinary city errands move families and people on the books', () => {
  const s = newGame(1);
  apply(s, { type: 'take-number', candidate: 'gul' });
  until(s, 740);
  const before = view(s).city.figures;
  until(s, 760);
  const after = view(s).city.figures;
  for (const id of ['gul', 'arslans']) {
    expect(before.find((f) => f.id === id)?.place).toContain('market');
    expect(after.find((f) => f.id === id)?.x).not.toBe(before.find((f) => f.id === id)?.x);
  }
});

test('a consumed queued report cannot reveal household moments after its cutoff', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  until(s, 1100);
  clear(s);
  until(s, 1440 + 1100);
  apply(s, { type: 'check-in', placement: 'placement-1', how: 'phone' });
  clearScene(s);
  const notes = view(s).books.find((c) => c.id === 'sevda')?.notes;
  until(s, 2 * 1440 + 600);
  apply(s, { type: 'answer-phone' });
  const speech = view(s)
    .scene?.lines.map((l) => l.text)
    .join(' ');
  expect(speech).toContain('You said Sevda was patient');
  expect(speech).not.toContain('abandoned');
  expect(view(s).books.find((c) => c.id === 'sevda')?.notes).toEqual(notes);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

function clearScene(s: State) {
  const sc = view(s).scene;
  if (sc) apply(s, { type: 'close-scene', scene: sc.id });
}

test('a new placement tests an unseen promise before one already observed', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  until(s, 1100);
  clear(s);
  until(s, 1440 + 1100);
  apply(s, { type: 'check-in', placement: 'placement-1', how: 'visit' });
  clearScene(s);
  expect(
    view(s)
      .books.find((c) => c.id === 'sevda')
      ?.notes.some((n) => n.quality === 'patient' && n.source === 'seen'),
  ).toBe(true);
  until(s, 2 * 1440 + 510);
  apply(s, { type: 'withdraw', placement: 'placement-1' });
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient', 'honest'] });
  until(s, 2 * 1440 + 600);
  until(s, 3 * 1440 + 600);
  const placements = s.placements as { moments: { quality: string }[] }[];
  expect(placements[1]?.moments[0]?.quality).toBe('honest');
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('a successful promise raises family source trust and reaches the next call', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  const before = trustOf(s.people['arslans-0']!, 'nermin');
  until(s, 1100);
  expect(trustOf(s.people['arslans-0']!, 'nermin')).toBeGreaterThan(before);
  clear(s);
  expect(view(s).placements[0]?.lastWord).toContain('You said Sevda was patient');
  expect(view(s).placements[0]?.lastWord).toContain('You were right to give us your word');
});
