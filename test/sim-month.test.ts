import { expect, test } from 'vitest';
import { advance, apply, fingerprint, milestones, newGame, replay, view } from '../src/sim/index.ts';
import { CANDIDATES, FAMILIES, makePeople, quality } from '../src/sim/world.ts';

function until(s: ReturnType<typeof newGame>, target: number) {
  for (let guard = 0; guard < 2000 && s.now < target && !view(s).ended; guard++) advance(s, target - s.now);
}
function close(s: ReturnType<typeof newGame>) {
  const scene = view(s).scene;
  if (scene) apply(s, { type: 'close-scene', scene: scene.id });
}

test('world uses seeded HF truth and authored households', () => {
  expect(CANDIDATES).toHaveLength(24);
  expect(FAMILIES).toHaveLength(16);
  expect(FAMILIES.every((f) => f.household.length >= 2 && f.household.length <= 5)).toBe(true);
  const p = makePeople(1);
  expect(quality(p.gul!, 'honest')).toBeLessThan(0.3);
  expect(quality(p.sevda!, 'patient')).toBeGreaterThan(0.8);
  expect(quality(p.pinar!, 'reliable')).toBeLessThan(0.3);
  expect(JSON.stringify(makePeople(2))).not.toBe(JSON.stringify(p));
});
test('trial morning delivers seen evidence through a phone report', () => {
  const s = newGame(1);
  apply(s, { type: 'trial', candidate: 'sevda', family: 'arslans' });
  expect(view(s).books.find((c) => c.id === 'sevda')?.status).toBe('trial');
  until(s, 1440 + 720);
  while (view(s).phoneRinging && !view(s).scene) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind === 'trial-result') break;
    close(s);
  }
  expect(view(s).scene?.kind).toBe('trial-result');
  expect(
    [...view(s).bench, ...view(s).books]
      .find((c) => c.id === 'sevda')
      ?.notes.some((n) => n.source === 'heard'),
  ).toBe(true);
});
test('good placement reaches verdict, confidence and rent on the game clock', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  until(s, 8 * 1440);
  expect(view(s).placements[0]?.status).toBe('trial');
  for (let i = 0; i < 100 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  expect(view(s).placements[0]?.status).toBe('kept');
  expect(view(s).cash).toBe(7000);
  expect(view(s).log.some((l) => l.text.includes('Rent paid'))).toBe(true);
  expect(s.people['arslans-0']!.memory.sourceTrust.nermin).toBeGreaterThan(0.5);
  expect(view(s).city.threads.length).toBeGreaterThan(0);
});
test.each([1, 17])('replays ten days with varied waits and choices for seed %i', (seed) => {
  const s = newGame(seed);
  apply(s, { type: 'interview', candidate: 'sevda' });
  for (const q of ['q-patient', 'q-reliable', 'q-honest'])
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: q });
  close(s);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  for (let i = 0; i < 1000 && s.now < 10 * 1440 && !view(s).ended; i++) {
    const v = view(s);
    if (v.scene) apply(s, { type: 'choose', scene: v.scene.id, choice: v.scene.choices[0]!.id });
    else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
    else if (v.dayCard) apply(s, { type: 'sleep' });
    else advance(s, 37);
  }
  expect(fingerprint(replay(seed, JSON.parse(JSON.stringify(s.inputs)), s.now))).toBe(fingerprint(s));
});
test('two unpaid rents end the month with a truthful review', () => {
  const s = newGame(1);
  until(s, 12 * 1440);
  expect(view(s).ended).toBe(true);
  expect(view(s).review?.people.find((p) => p.id === 'gul')?.truth.honest).toBe('no');
});

test('a booked trial holds the family deadline through its noon answer', () => {
  const s = newGame(1);
  apply(s, { type: 'trial', candidate: 'sevda', family: 'arslans' });
  until(s, 1440 + 720);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  expect(view(s).placements).toHaveLength(1);
});
test('withdrawing a worker allows replacement without charging the first half twice', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'gul', family: 'arslans', vouch: [] });
  const cash = view(s).cash;
  apply(s, { type: 'withdraw', placement: view(s).placements[0]!.id });
  expect(view(s).requests[0]?.status).toBe('open');
  apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
  expect(view(s).placements).toHaveLength(2);
  expect(view(s).cash).toBe(cash);
});
test('a view is a detached snapshot and first-answer evidence emits its milestone', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'gul' });
  const before = view(s);
  apply(s, { type: 'choose', scene: before.scene!.id, choice: 'q-honest' });
  expect(before.bench.find((c) => c.id === 'gul')!.notes).toHaveLength(0);
  expect(milestones(before, view(s))).toContain('first interview');
  expect(view(s).bench.find((c) => c.id === 'gul')!.notes[0]?.read).toBe('yes');
});

test('a delayed callback only delivers the household moments known when it rang', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  until(s, 1440 + 720);
  const firstCount = (s.placements as { moments: unknown[] }[])[0]!.moments.length;
  expect(view(s).books.find((c) => c.id === 'sevda')!.notes).toHaveLength(0);
  until(s, 2 * 1440 + 720);
  expect((s.placements as { moments: unknown[] }[])[0]!.moments.length).toBeGreaterThan(firstCount);
  apply(s, { type: 'answer-phone' });
  expect(view(s).books.find((c) => c.id === 'sevda')!.notes).toHaveLength(firstCount);
});

test('taking the envelope creates a later demand if no placement follows', () => {
  const s = newGame(1);
  // Keep Gül on the books without placing her.
  apply(s, { type: 'interview', candidate: 'gul' });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'q-patient' });
  close(s);
  until(s, 1440 + 930);
  for (let i = 0; i < 20 && view(s).scene?.title !== 'An envelope on the desk'; i++) {
    if (view(s).scene) close(s);
    else if (view(s).phoneRinging) apply(s, { type: 'answer-phone' });
    else break;
  }
  expect(view(s).scene?.title).toBe('An envelope on the desk');
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'take-envelope' });
  until(s, s.now + 2 * 1440 + 1);
  for (let i = 0; i < 50 && view(s).scene?.title !== 'The envelope comes back'; i++) {
    if (view(s).scene) close(s);
    else if (view(s).phoneRinging) apply(s, { type: 'answer-phone' });
    else break;
  }
  expect(view(s).scene?.title).toBe('The envelope comes back');
  expect(view(s).scene?.canLeave).toBe(false);
  until(s, s.now + 1441);
  expect(s.people.gul!.memory.sourceTrust.nermin).toBeLessThan(0.5);
});
