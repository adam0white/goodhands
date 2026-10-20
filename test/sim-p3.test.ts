import { expect, test } from 'vitest';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import type { State } from '../src/sim/types.ts';

function choose(s: State, choice: string) {
  const scene = view(s).scene;
  if (!scene) throw new Error('Expected scene');
  apply(s, { type: 'choose', scene: scene.id, choice });
}
function close(s: State) {
  const scene = view(s).scene;
  if (scene) apply(s, { type: 'close-scene', scene: scene.id });
}
function until(s: State, at: number) {
  while (s.now < at && !view(s).ended) advance(s, at - s.now);
}

test('interview ending explicitly keeps a bench seat or sends a candidate home', () => {
  for (const choice of ['wait-bench', 'send-home']) {
    const s = newGame(1);
    apply(s, { type: 'interview', candidate: 'gul' });
    expect(view(s).bench.some((c) => c.id === 'gul')).toBe(true);
    expect(view(s).scene?.choices.map((c) => c.id)).toEqual(
      expect.arrayContaining(['wait-bench', 'send-home']),
    );
    choose(s, choice);
    const card = [...view(s).bench, ...view(s).books].find((c) => c.id === 'gul');
    expect(card?.status).toBe(choice === 'wait-bench' ? 'bench' : 'books');
    expect(view(s).scene?.lines.at(-1)?.speaker).toBe('Gül');
    expect(view(s).scene?.lines.at(-1)?.text).toMatch(choice === 'wait-bench' ? /wait/ : /home|number/);
    close(s);
    until(s, 1000);
    expect(view(s).books.find((c) => c.id === 'gul')?.status).toBe(
      choice === 'wait-bench' ? 'gone' : 'books',
    );
    expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
  }
});

test('an old opening call acknowledges a completed placement at delivery', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'gul' });
  choose(s, 'wage');
  close(s);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['discreet'] });
  apply(s, { type: 'answer-phone' });
  const scene = view(s).scene;
  expect(scene?.lines.map((l) => l.text).join(' ')).toMatch(/Sevda/);
  expect(scene?.lines.map((l) => l.text).join(' ')).not.toMatch(/Have you found|still interviewing/);
  expect(scene?.choices.some((c) => /confirm|acknowledge/.test(c.id))).toBe(true);
});

test('cold placement first-day call reports past work without inventing an earlier conversation', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  until(s, 1100);
  for (let i = 0; i < 40 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind === 'two-sides') break;
    close(s);
  }
  const words = view(s)
    .scene?.lines.map((l) => l.text)
    .join(' ');
  expect(words).toMatch(/wanted the windows done before I left|left at six/);
  expect(words).not.toMatch(/as I told you|I told you|must finish.*tonight/);
  choose(s, 'negotiate');
  if (view(s).scene?.choices.some((c) => c.id === 'accept-condition')) {
    const cash = view(s).cash;
    choose(s, 'accept-condition');
    expect(view(s).cash).toBe(cash - 300);
    expect(view(s).scene?.lines.at(-1)?.text).toMatch(/paid|₺300|six|18:00/);
    expect(view(s).scene?.lines.at(-1)?.speaker).not.toBe('Nermin');
  }
});

test('Sevda can answer the specific crying-boy reference claim', () => {
  const s = newGame(3);
  until(s, 540);
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: 'ref-sevda' });
  choose(s, 'ref-patient');
  expect(view(s).scene?.lines.at(-1)?.text).toMatch(/crying/);
  close(s);
  apply(s, { type: 'interview', candidate: 'sevda' });
  const follow = view(s).scene?.choices.find((c) => c.label === 'Mrs Uslu says you left the boy crying');
  expect(follow).toBeDefined();
  choose(s, follow!.id);
  expect(view(s).scene?.lines.at(-1)?.text).toMatch(/boot|cry|beside/);
  expect(view(s).scene?.lines.at(-1)?.speaker).toBe('Sevda');
});

test('a queued first-day dispute becomes current news after withdrawal and replacement', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  until(s, 1100);
  apply(s, { type: 'withdraw', placement: 'placement-1' });
  apply(s, { type: 'place', candidate: 'gul', family: 'arslans', vouch: [] });
  for (let i = 0; i < 30 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.with === 'sevda') break;
    close(s);
  }
  expect(
    view(s)
      .scene?.lines.map((l) => l.text)
      .join(' '),
  ).toMatch(/Sevda is no longer working/);
  expect(view(s).scene?.choices.some((c) => c.id === 'negotiate')).toBe(false);
});

test('a driver’s first-day call waits until after his agreed finish', () => {
  const s = newGame(1);
  until(s, 900);
  for (let i = 0; i < 40 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  apply(s, { type: 'interview', candidate: 'cem' });
  choose(s, 'q-reliable');
  choose(s, 'coach');
  choose(s, 'send-home');
  close(s);
  apply(s, { type: 'place', candidate: 'cem', family: 'demirs', vouch: ['discreet'] });
  expect(view(s).placements[0]?.candidate).toBe('cem');
  until(s, 1100);
  for (let i = 0; i < 30 && view(s).phoneRinging; i++) {
    expect(view(s).phoneRinging?.who).not.toBe('Cem');
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  until(s, 1160);
  for (let i = 0; i < 30 && view(s).phoneRinging?.who !== 'Cem'; i++) {
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  expect(view(s).phoneRinging?.who).toBe('Cem');
});
