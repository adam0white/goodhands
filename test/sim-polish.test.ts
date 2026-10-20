import { expect, test } from 'vitest';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';

function choose(s: ReturnType<typeof newGame>, choice: string) {
  const sc = view(s).scene;
  if (!sc) throw new Error('No conversation');
  apply(s, { type: 'choose', scene: sc.id, choice });
}
function close(s: ReturnType<typeof newGame>) {
  const sc = view(s).scene;
  if (sc) apply(s, { type: 'close-scene', scene: sc.id });
}
function placed() {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  choose(s, 'hours');
  close(s);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  return s;
}
function until(s: ReturnType<typeof newGame>, at: number) {
  while (s.now < at) advance(s, at - s.now);
}

test('questions leave the conversation, and wage and home are separate answers', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  choose(s, 'hours');
  expect(view(s).scene?.choices.some((c) => c.id === 'hours')).toBe(false);
  const card = [...view(s).bench, ...view(s).books].find((c) => c.id === 'sevda');
  expect(card?.wants).toContain('18:10');
  expect(card?.wage).toBeNull();
  expect(card?.experience).toEqual([]);
  choose(s, 'wage');
  expect([...view(s).bench, ...view(s).books].find((c) => c.id === 'sevda')?.wage).toBe(8000);
});

test('every placement opens a two-sided disagreement and tests a negotiated finish on its named day', () => {
  const s = placed();
  until(s, 1440 + 720);
  while (view(s).phoneRinging && view(s).scene?.kind !== 'two-sides') {
    close(s);
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind !== 'two-sides') close(s);
  }
  expect(view(s).scene?.kind).toBe('two-sides');
  expect(view(s).scene?.lines.map((l) => l.side)).toContain('worker');
  expect(view(s).scene?.lines.map((l) => l.side)).toContain('family');
  choose(s, 'negotiate');
  close(s);
  const p = view(s).placements[0];
  expect(p?.arrangement).toContain('18:00');
  expect(p?.pending?.at).toBeGreaterThan(s.now);
  const at = p?.pending?.at ?? 0;
  until(s, at);
  expect(view(s).placements[0]?.pending).toBeUndefined();
  expect(view(s).log.some((l) => /18:00/.test(l.text) && /kept|refused|left|bus/.test(l.text))).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('named waiting stops for new decisions and records the input for replay', () => {
  const s = placed();
  while (view(s).phoneRinging) {
    apply(s, { type: 'answer-phone' });
    close(s);
  }
  expect(view(s).next).not.toBeNull();
  const at = view(s).next?.at ?? 0;
  apply(s, { type: 'wait-for' });
  expect(s.now).toBeGreaterThan(510);
  expect(s.now).toBeLessThanOrEqual(at);
  expect(s.inputs.at(-1)?.input.type).toBe('wait-for');
  expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
});

test('a doubted referee cannot erase the candidate estimate, and quotes remain intact', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'gul' });
  choose(s, 'q-honest');
  close(s);
  until(s, 840);
  apply(s, { type: 'call-reference', candidate: 'gul', referee: 'ref-gul' });
  const notes = () => [...view(s).bench, ...view(s).books].find((c) => c.id === 'gul')?.notes ?? [];
  expect(notes()).toHaveLength(1);
  choose(s, 'ref-honest');
  const claim = notes().at(-1)?.claim;
  expect(claim).toContain('Mrs Ak');
  expect(notes().at(-1)?.read).not.toBe('yes');
  choose(s, 'distrust');
  expect(notes().at(-1)?.read).toBe('yes');
  expect(notes().at(-1)?.claim).toBe(claim);
  expect(notes()[0]?.crossedOut).toBe(false);
});

test('four questions require an answer and callback before more questions', () => {
  const s = newGame(1);
  apply(s, { type: 'interview', candidate: 'sevda' });
  for (const q of ['hours', 'wage', 'last-family', 'q-patient']) choose(s, q);
  expect(view(s).scene?.choices.map((c) => c.id)).toEqual(['wait-bench', 'send-home']);
  expect(view(s).scene?.choices[1]?.hint).toContain('Call again');
  close(s);
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene).toBeNull();
  until(s, s.now + 120);
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene?.choices.some((c) => c.id === 'q-honest')).toBe(true);
  expect(view(s).scene?.choices.some((c) => c.id === 'hours')).toBe(false);
});

test('withdrawal clears every future promise and does not transfer it to a replacement', () => {
  const s = placed();
  until(s, 1440 + 720);
  while (view(s).phoneRinging && view(s).scene?.kind !== 'two-sides') {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind !== 'two-sides') close(s);
  }
  choose(s, 'promise');
  close(s);
  apply(s, { type: 'withdraw', placement: 'placement-1' });
  expect(view(s).placements[0]?.pending).toBeUndefined();
  const r = view(s).requests.find((r) => r.family === 'arslans');
  expect(r?.status).toBe('open');
});

test('an evening conversation brings a named consequence before Friday', () => {
  const s = placed();
  until(s, 3 * 1440 + 600);
  expect(view(s).city.threads.some((t) => t.place.includes('ferry') || t.place.includes('bus'))).toBe(true);
  expect(view(s).city.threads.some((t) => t.consequence?.includes('Sevda'))).toBe(true);
  expect(view(s).log.some((l) => l.text.includes('Sevda sent me'))).toBe(true);
  const figure = view(s).city.figures.find((f) => f.id === 'sevda');
  expect(figure?.place).toBe('at the Arslans');
  until(s, 3 * 1440 + 1110);
  expect(view(s).city.figures.find((f) => f.id === 'sevda')?.arrive).toBe(3 * 1440 + 1140);
  until(s, 3 * 1440 + 1200);
  expect(view(s).city.figures.find((f) => f.id === 'sevda')?.place).toBe('at home');
});

test('support after a replacement changes only the current placement', () => {
  const s = newGame(1);
  apply(s, { type: 'place', candidate: 'gul', family: 'arslans', vouch: [] });
  apply(s, { type: 'withdraw', placement: 'placement-1' });
  apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
  until(s, 1440 + 1100);
  for (let i = 0; i < 20 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.with === 'pinar') break;
    close(s);
  }
  expect(view(s).scene?.with).toBe('pinar');
  choose(s, 'promise');
  close(s);
  expect(view(s).placements[0]?.pending).toBeUndefined();
  expect(view(s).placements[1]?.pending?.text).toContain('Pınar');
});

test('a broken promise gives a warning that a real negotiation can prevent', () => {
  const s = placed();
  until(s, 1440 + 720);
  while (view(s).phoneRinging && view(s).scene?.kind !== 'two-sides') {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind !== 'two-sides') close(s);
  }
  choose(s, 'promise');
  close(s);
  const due = view(s).placements[0]?.pending?.at ?? 0;
  const trustBefore = s.people.sevda?.memory.sourceTrust.nermin ?? 0.5;
  until(s, due);
  expect(s.people.sevda?.memory.sourceTrust.nermin ?? 1).toBeLessThan(trustBefore);
  expect(view(s).placements[0]?.status).toBe('trial');
  for (let n = 0; n < 20 && !view(s).scene?.title.includes('warning'); n++) {
    close(s);
    if (view(s).phoneRinging) apply(s, { type: 'answer-phone' });
    else break;
  }
  expect(view(s).scene?.title).toContain('warning');
  choose(s, 'negotiate');
  if (view(s).scene?.choices.some((c) => c.id === 'accept-condition')) choose(s, 'accept-condition');
  close(s);
  const testAt = view(s).placements[0]?.pending?.at ?? 0;
  until(s, testAt);
  expect(view(s).placements[0]?.status).toBe('trial');
  expect(view(s).log.some((l) => l.text.includes('caught the 18:10 bus'))).toBe(true);
});
