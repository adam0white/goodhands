import { expect, test } from 'vitest';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import type { State } from '../src/sim/types.ts';
import { phoneAvailability } from '../src/ui/render.ts';

function choose(s: State, choice: string) {
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice });
}
function close(s: State) {
  if (view(s).scene) apply(s, { type: 'close-scene', scene: view(s).scene!.id });
}
function until(s: State, at: number) {
  while (s.now < at) advance(s, at - s.now);
}
function cappedInterview() {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  for (const question of ['wage', 'hours', 'need', 'last-family']) choose(s, question);
  return s;
}

test('interview warns in words, keeps unasked questions with a callback reason, and recovers', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene?.interviewPace).toMatch(/couple more questions|few more questions/);
  choose(s, 'wage');
  choose(s, 'hours');
  expect(view(s).scene?.interviewPace).toMatch(/couple more questions/);
  choose(s, 'need');
  expect(view(s).scene?.interviewPace).toMatch(/one more question/);
  const remaining = view(s).scene!.choices.filter((c) => !['wait-bench', 'send-home'].includes(c.id));
  choose(s, 'last-family');
  const capped = view(s).scene!;
  for (const question of remaining.filter((c) => c.id !== 'last-family')) {
    expect(capped.choices.find((c) => c.id === question.id)?.disabled).toMatch(
      /told you what she can for now\. Call her back after \d\d:\d\d/,
    );
  }
  const before = capped.lines;
  choose(s, 'q-patient');
  expect(view(s).scene?.lines).toEqual(before);
  choose(s, 'send-home');
  close(s);
  const callback = view(s).books.find((c) => c.id === 'sevda')!.interviewAfter!;
  until(s, callback - 1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene).toBeNull();
  until(s, callback);
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene?.choices.find((c) => c.id === 'q-patient')?.disabled).toBeUndefined();
  choose(s, 'q-patient');
  expect(view(s).scene?.lines.at(-1)?.speaker).toBe('Sevda');
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('a capped bench task offers only the possible number-taking action', () => {
  const s = cappedInterview();
  choose(s, 'wait-bench');
  close(s);
  while (view(s).phoneRinging) {
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  expect(view(s).task.text).toMatch(/Sevda has to go now\. Take her number to call her after \d\d:\d\d/);
  expect(view(s).task.text).not.toMatch(/Interview/);
  expect(view(s).slowed).toBe(true);
  const at = s.now;
  apply(s, { type: 'take-number', candidate: 'sevda' });
  expect(s.now).toBe(at + 2);
  expect(view(s).bench.some((c) => c.id === 'sevda')).toBe(false);
  expect(view(s).books.find((c) => c.id === 'sevda')?.status).toBe('books');
});

test('quiet news yields to the next ringing family without losing its words or replay', () => {
  const s = newGame(1);
  for (const candidate of ['gul', 'sevda', 'pinar']) apply(s, { type: 'take-number', candidate });
  until(s, 560);
  apply(s, { type: 'answer-phone' });
  expect(view(s).scene?.title).toMatch(/Mr Hüsnü/);
  const news = view(s).scene!.lines[0]!.text;
  until(s, 660);
  expect(view(s).phoneRinging).not.toBeNull();
  expect(phoneAvailability(view(s))).toBeUndefined();
  apply(s, { type: 'answer-phone' });
  expect(view(s).scene?.with).toBe('kayas');
  expect(view(s).log.some((l) => l.text.includes('Excuse me, the phone.'))).toBe(true);
  expect(view(s).log.some((l) => l.text.includes(news))).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('the next event never introduces an unmet referee or an unknown arrival by name', () => {
  const s = newGame(1);
  expect(view(s).next?.label).not.toMatch(/Mrs Uslu|Mrs Ak|Cem|Kayas/);
  apply(s, { type: 'interview', candidate: 'sevda' });
  close(s);
  expect(view(s).next?.label).toBe("Sevda's reference, Mrs Uslu, can be reached from 09:00");
  until(s, 540);
  expect(view(s).next?.label).not.toMatch(/Kayas|Cem|Mrs Ak/);
});
