import { expect, test } from 'vitest';
import type { State } from '../src/sim/types.ts';
import { advance, apply, fingerprint, newGame, replay, view } from './previous-simulation.ts';

function until(s: State, at: number) {
  while (s.now < at && !view(s).ended) advance(s, at - s.now);
}
function close(s: State) {
  const sc = view(s).scene;
  if (sc) apply(s, { type: 'close-scene', scene: sc.id });
}
function choose(s: State, choice: string) {
  const sc = view(s).scene;
  if (!sc) throw new Error('Expected scene');
  apply(s, { type: 'choose', scene: sc.id, choice });
}

test.each(['interview', 'reference'] as const)(
  'a phone call holds and resumes an %s without losing progress',
  (kind) => {
    const s = newGame(1);
    apply(s, { type: 'speed', speed: 3 });
    apply(s, { type: 'interview', candidate: 'sevda' });
    choose(s, 'hours');
    if (kind === 'reference') {
      close(s);
      until(s, 660);
      apply(s, { type: 'call-reference', candidate: 'sevda', referee: 'ref-sevda' });
      choose(s, 'ref-patient');
    }
    const before = view(s).scene;
    if (!before) throw new Error('Expected conversation');
    const notes = [...view(s).bench, ...view(s).books].find((c) => c.id === 'sevda')?.notes;
    apply(s, { type: 'answer-phone' });
    expect(view(s).scene?.kind).toBe('phone');
    expect(view(s).scene?.id).not.toBe(before.id);
    expect(view(s).heldScene).toEqual({ id: before.id, title: before.title });
    expect(view(s).slowed).toBe(true);
    const callId = view(s).scene?.id;
    apply(s, { type: 'answer-phone' });
    expect(view(s).scene?.id).toBe(callId);
    expect(view(s).heldScene?.id).toBe(before.id);
    choose(s, 'look');
    expect(view(s).scene?.lines.at(-1)?.speaker).not.toBe('Nermin');
    choose(s, 'done');
    expect(view(s).scene?.id).toBe(before.id);
    expect(view(s).scene?.choices).toEqual(before.choices);
    expect(view(s).scene?.lines.slice(0, before.lines.length)).toEqual(before.lines);
    expect(view(s).scene?.lines.at(-1)?.text).toBe('Sorry. Where were we?');
    expect([...view(s).bench, ...view(s).books].find((c) => c.id === 'sevda')?.notes).toEqual(notes);
    expect(view(s).heldScene).toBeNull();
    expect(view(s).slowed).toBe(true);
    close(s);
    expect(view(s).speed).toBe(3);
    expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
  },
);

test('taking a number costs two minutes, adds no notes, and clears the departure warning', () => {
  const s = newGame(1);
  until(s, 690);
  apply(s, { type: 'answer-phone' });
  choose(s, 'look');
  choose(s, 'done');
  expect(view(s).task.text).toMatch(/will give up by about \d\d:\d\d\. Interview her or take her number/);
  const at = s.now;
  apply(s, { type: 'take-number', candidate: 'gul' });
  expect(s.now).toBe(at + 2);
  const card = [...view(s).bench, ...view(s).books].find((c) => c.id === 'gul');
  expect(card?.status).toBe('books');
  expect(card?.notes).toEqual([]);
  expect(view(s).task.text).not.toContain('Gül');
  until(s, 1000);
  expect([...view(s).bench, ...view(s).books].find((c) => c.id === 'gul')?.status).toBe('books');
  expect([...view(s).bench, ...view(s).books].find((c) => c.id === 'pinar')?.status).toBe('gone');
  expect(
    view(s).log.some((l) => l.text.includes('Pınar') && l.text.includes('gone') && l.text.includes('number')),
  ).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('starting an interview keeps the bench seat until an explicit ending choice', () => {
  const s = newGame(1);
  until(s, 690);
  apply(s, { type: 'interview', candidate: 'gul' });
  expect(view(s).bench.find((c) => c.id === 'gul')?.status).toBe('bench');
  choose(s, 'send-home');
  choose(s, 'done');
  expect(view(s).task.text).not.toContain('Gül');
  until(s, 1000);
  expect([...view(s).bench, ...view(s).books].find((c) => c.id === 'gul')?.status).toBe('books');
});

test('Monday brings two further jobs with distinct deadlines', () => {
  const s = newGame(1);
  until(s, 660);
  const kaya = view(s).requests.find((r) => r.family === 'kayas');
  expect(kaya?.role).toBe('carer');
  expect(kaya?.byLabel).toBe('Wednesday 4 November, 08:00');
  expect(view(s).phoneRinging?.who).toContain('Kayas');
  until(s, 840);
  const demir = view(s).requests.find((r) => r.family === 'demirs');
  expect(demir?.role).toBe('driver');
  expect(demir?.byLabel).toBe('Thursday 5 November, 08:00');
});

test.each([1100, 1150])(
  'the first placed worker leaves a named tomorrow when answered at %i',
  (answeredAt) => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
    until(s, answeredAt);
    while (view(s).phoneRinging) {
      apply(s, { type: 'answer-phone' });
      if (view(s).scene?.kind === 'two-sides') break;
      close(s);
    }
    expect(view(s).scene?.kind).toBe('two-sides');
    expect(view(s).scene?.with).toBe('sevda');
    expect(view(s).scene?.lines[0]?.text).toMatch(/ferry|bus/);
    expect(view(s).scene?.lines.map((l) => l.side)).toEqual(['worker', 'family']);
    choose(s, 'promise');
    close(s);
    const pending = view(s).placements[0]?.pending;
    expect(pending?.text).toContain('Sevda');
    until(s, 1140);
    expect(view(s).dayCard?.tomorrow).toContain(pending?.text);
    expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
  },
);

test('one deposit just covers first rent and replacements cannot pay it twice', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  expect(view(s).cash).toBe(5250);
  expect(view(s).log.at(-1)?.text).toContain('deposit');
  apply(s, { type: 'withdraw', placement: 'placement-1' });
  apply(s, { type: 'place', candidate: 'gul', family: 'arslans', vouch: [] });
  expect(view(s).cash).toBe(5250);
  until(s, 4 * 1440 + 1020);
  expect(view(s).cash).toBe(250);
  expect(view(s).log.some((l) => l.text.includes('Rent paid'))).toBe(true);
});

test('withdrawing during the first evening call leaves the replacement on tomorrow’s card', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  until(s, 1100);
  for (let n = 0; n < 20 && view(s).phoneRinging; n++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind === 'two-sides') break;
    close(s);
  }
  choose(s, 'withdraw');
  until(s, 1140);
  expect(view(s).dayCard?.tomorrow).toContain('replacement');
  expect(view(s).dayCard?.tomorrow).toContain('Arslans');
});

test('a kept trial pays the remaining three quarters once, when the verdict reaches Nermin', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  until(s, 8 * 1440);
  expect(view(s).cash).toBe(250);
  for (let n = 0; n < 100 && view(s).phoneRinging; n++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind === 'verdict') break;
    close(s);
  }
  expect(view(s).scene?.kind).toBe('verdict');
  expect(view(s).placements[0]?.status).toBe('kept');
  expect(view(s).cash).toBe(7000);
  apply(s, { type: 'answer-phone' });
  expect(view(s).cash).toBe(7000);
  choose(s, 'thank');
  for (let n = 0; n < 100 && view(s).phoneRinging; n++) {
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  expect(view(s).cash).toBe(7000);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('adding Deniz preserves Saadet’s saved identity and fills the missing twin in a continued run', () => {
  const s = newGame(1);
  expect(s.people['arslans-3']?.name).toBe('Saadet');
  const savedSaadet = structuredClone(s.people['arslans-3']);
  delete s.people['arslans-4'];
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  expect(() => until(s, 1100)).not.toThrow();
  expect(s.people['arslans-3']?.name).toBe(savedSaadet?.name);
  expect(s.people['arslans-4']?.name).toBe('Deniz');
});
