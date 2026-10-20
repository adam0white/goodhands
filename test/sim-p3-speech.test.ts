import { expect, test } from 'vitest';
import type { State } from '../src/sim/types.ts';
import { advance, apply, newGame, view } from './previous-simulation.ts';

const DAY = 1440;
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected test state is missing');
  return value;
}
function choose(s: State, choice: string) {
  const sc = required(view(s).scene);
  expect(sc.choices.some((c) => c.id === choice)).toBe(true);
  apply(s, { type: 'choose', scene: sc.id, choice });
}
function close(s: State) {
  const sc = view(s).scene;
  if (sc) apply(s, { type: 'close-scene', scene: sc.id });
}
function until(s: State, at: number) {
  for (let i = 0; s.now < at && i < 1000; i++) advance(s, at - s.now);
  expect(s.now).toBe(at);
}
function answerUntil(s: State, match: (title: string) => boolean) {
  for (let i = 0; i < 100 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    if (match(required(view(s).scene).title)) return;
    close(s);
  }
  throw new Error('Expected queued call was not delivered');
}
function firstDayCall(s: State) {
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  until(s, 1100);
  answerUntil(s, (title) => title.includes('Sevda calls'));
}
function expectReply(s: State, before: number, words: RegExp) {
  const sc = required(view(s).scene);
  expect(sc.lines.slice(before)).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: 'speech', text: expect.stringMatching(words) })]),
  );
  expect(sc.lines.at(-1)?.speaker).not.toBe('Nermin');
}

test('the arrangement call preserves the observed caught-bus result when delivered', () => {
  const s = newGame(1);
  firstDayCall(s);
  choose(s, 'negotiate');
  expect(view(s).scene?.lines.at(-1)?.text).toMatch(/follow that arrangement/);
  const at = required(required(view(s).placements[0]).pending).at;
  close(s);
  until(s, at);
  answerUntil(s, (title) => title.startsWith('The arrangement:'));
  const lines = required(view(s).scene).lines;
  expect(lines[0]?.text).toBe('They took over at six. I caught the 18:10 bus; my mother was waiting.');
  expect(lines[1]?.text).toBe('We took over at six, as arranged. Sevda left for her bus.');
  expect(lines.map((l) => l.text).join(' ')).not.toMatch(/wanted the windows|not pleased/);
});

test.each(['phone', 'drop-by'] as const)(
  'a first-day %s check-in before 18:20 cannot describe a completed day',
  (how) => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
    const placement = required(view(s).placements[0]);
    until(s, DAY + 720);
    apply(s, { type: 'check-in', placement: placement.id, how });
    expect(view(s).scene).toBeNull();
    expect(view(s).log.at(-1)?.text).toMatch(/first new answer is due.*18:20/);
    expect(view(s).log.at(-1)?.text).not.toMatch(/I left at six|caught the 18:10/);
  },
);

test('distrusting a referee leaves the referee response visible', () => {
  const s = newGame(1);
  until(s, 540);
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: 'ref-sevda' });
  const before = required(view(s).scene).lines.length;
  choose(s, 'distrust');
  expectReply(s, before, /heard my account|ask the worker/i);
});

test('declining a family request leaves its response visible', () => {
  const s = newGame(1);
  until(s, 660);
  answerUntil(s, () => required(view(s).scene).choices.some((c) => c.id === 'decline'));
  const before = required(view(s).scene).lines.length;
  choose(s, 'decline');
  expectReply(s, before, /look elsewhere|understand/i);
  expect(view(s).scene?.choices.map((c) => c.id)).toEqual(['done']);
});

test('paying rent leaves the landlord response visible', () => {
  const s = newGame(1);
  until(s, 4 * DAY + 1020);
  expect(view(s).scene?.kind).toBe('rent');
  const before = required(view(s).scene).lines.length;
  const cash = view(s).cash;
  choose(s, 'pay-part');
  expect(view(s).cash).toBeLessThan(cash);
  expectReply(s, before, /recorded the payment|accepted|owed/i);
  expect(view(s).scene?.choices.map((c) => c.id)).toEqual(['done']);
});

test('paying the family condition leaves its agreement visible', () => {
  const s = newGame(1);
  firstDayCall(s);
  required(s.people['arslans-0']).traits.agreeableness = 0.43;
  choose(s, 'negotiate');
  expect(view(s).scene?.choices.some((c) => c.id === 'accept-condition')).toBe(true);
  const before = required(view(s).scene).lines.length;
  const cash = view(s).cash;
  choose(s, 'accept-condition');
  expect(view(s).cash).toBe(cash - 300);
  expectReply(s, before, /₺300.*Agreed/);
});
