import { expect, test } from 'vitest';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import type { State } from '../src/sim/types.ts';

const card = (s: State, id: string) => [...view(s).bench, ...view(s).books].find((c) => c.id === id)!;
function close(s: State) {
  const sc = view(s).scene;
  if (sc) apply(s, { type: 'close-scene', scene: sc.id });
}
function until(s: State, at: number) {
  while (s.now < at) advance(s, at - s.now);
}
test('a number keeps contact but a home interview requires a real journey', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'take-number', candidate: 'sevda' });
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene).toBeNull();
  expect(card(s, 'sevda').presence).toBe('home');
  const before = s.now;
  apply(s, { type: 'call-in', candidate: 'sevda' });
  expect(s.now).toBeGreaterThan(before);
  expect(card(s, 'sevda').presence).toBe('travelling');
  const arrival = card(s, 'sevda').arrival!.at;
  expect(arrival).toBeGreaterThan(s.now);
  apply(s, { type: 'call-in', candidate: 'sevda' });
  expect(card(s, 'sevda').arrival!.at).toBe(arrival);
  until(s, arrival);
  expect(card(s, 'sevda').presence).toBe('office');
  apply(s, { type: 'interview', candidate: 'sevda' });
  expect(view(s).scene?.kind).toBe('interview');
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 3))).toBe(fingerprint(s));
});
test('placement terms need both answers and acceptance before any fee is paid', () => {
  const s = newGame(1, 3);
  const cash = view(s).cash;
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  expect(view(s).scene?.kind).toBe('negotiation');
  expect(view(s).placements).toHaveLength(0);
  expect(view(s).cash).toBe(cash);
  const sc = view(s).scene!;
  expect(sc.lines.some((l) => l.side === 'worker')).toBe(true);
  expect(sc.lines.some((l) => l.side === 'family')).toBe(true);
  apply(s, {
    type: 'propose-terms',
    scene: sc.id,
    terms: { wage: 10000, startHour: 8, endHour: 17, dayOff: 6, trialDays: 3, fee: 3000 },
  });
  expect(view(s).scene?.negotiation?.terms.trialDays).toBe(3);
  apply(s, { type: 'choose', scene: sc.id, choice: 'accept-terms' });
  const p = view(s).placements[0]!;
  expect(p).toBeDefined();
  expect(p.terms?.fee).toBe(3000);
  expect(p.trialEnds - p.since).toBeLessThanOrEqual(4 * 1440);
  expect(view(s).cash - cash).toBe(1500);
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 3))).toBe(fingerprint(s));
});
test('household calls use the selected adult and offer four spoken acts', () => {
  const s = newGame(1, 3);
  const household = view(s).families.find((f) => f.id === 'arslans')!.household;
  const adult = household[0]!;
  const grandmother = household.find((m) => m.name.includes('Saadet'))!;
  const lines: string[] = [];
  for (const m of [adult, grandmother]) {
    const before = s.now;
    apply(s, { type: 'call-household', family: 'arslans', member: m.id!, topic: 'progress' });
    const sc = view(s).scene!;
    expect(sc.kind).toBe('household-call');
    expect(sc.lines[0]?.speaker).toBe(m.name);
    expect(sc.choices.map((c) => c.id)).toEqual(
      expect.arrayContaining(['progress', 'complaint', 'smooth', 'worker']),
    );
    lines.push(sc.lines[0]!.text);
    expect(s.now).toBeGreaterThan(before);
    close(s);
  }
  expect(lines[0]).not.toBe(lines[1]);
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 3))).toBe(fingerprint(s));
});

test('changing terms invalidates acceptance and spoken counters can resolve the disagreement', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  const id = view(s).scene!.id;
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 1000, startHour: 8, endHour: 22, dayOff: 6, trialDays: 14, fee: 8000 },
  });
  expect(view(s).scene!.negotiation?.worker).toBe('refused');
  apply(s, { type: 'choose', scene: id, choice: 'accept-terms' });
  expect(view(s).placements).toHaveLength(0);
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 8000, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7, fee: 8000 },
  });
  expect(view(s).scene!.negotiation?.worker).toBe('accepted');
  apply(s, { type: 'choose', scene: id, choice: 'offer-hours' });
  expect(view(s).scene!.negotiation?.terms.endHour).toBe(17);
  expect(
    view(s)
      .scene!.lines.slice(-2)
      .map((l) => l.side),
  ).toEqual(['worker', 'family']);
});
test('daily terms change fatigue, rest and wages through the household state', () => {
  const make = (endHour: number, dayOff: number, wage: number) => {
    const s = newGame(1, 3);
    apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
    const id = view(s).scene!.id;
    apply(s, {
      type: 'propose-terms',
      scene: id,
      terms: { wage, startHour: 8, endHour, dayOff, trialDays: 7, fee: 2000 },
    });
    apply(s, { type: 'choose', scene: id, choice: 'accept-terms' });
    close(s);
    return s;
  };
  const short = make(16, 6, 8000),
    long = make(18, 6, 8000),
    off = make(18, 1, 8000),
    paid = make(18, 6, 10000);
  expect(view(short).placements).toHaveLength(1);
  until(short, 2040);
  until(long, 2040);
  until(off, 2040);
  until(paid, 2040);
  expect(short.people.sevda!.body.exertion).toBeLessThan(long.people.sevda!.body.exertion);
  expect(off.people.sevda!.body.exertion).toBeLessThan(long.people.sevda!.body.exertion);
  expect(paid.people.sevda!.needs.safety).toBeGreaterThan(long.people.sevda!.needs.safety);
});
test('leaving without contact is different from keeping a number', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'take-number', candidate: 'sevda' });
  until(s, 850);
  expect(card(s, 'gul').status).toBe('gone');
  apply(s, { type: 'call-in', candidate: 'gul' });
  expect(card(s, 'gul').arrival).toBeUndefined();
  apply(s, { type: 'call-in', candidate: 'sevda' });
  expect(card(s, 'sevda').arrival).toBeDefined();
});
test('a household call cannot replace an interview and children cannot answer agency calls', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'interview', candidate: 'sevda' });
  const id = view(s).scene!.id;
  apply(s, { type: 'call-household', family: 'arslans', member: 'arslans-0', topic: 'smooth' });
  expect(view(s).scene!.id).toBe(id);
  close(s);
  apply(s, { type: 'call-household', family: 'arslans', member: 'arslans-2', topic: 'progress' });
  expect(view(s).scene).toBeNull();
});
test('each selected adult reports their own HF impression and soothing changes that adult', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  const id = view(s).scene!.id;
  apply(s, { type: 'choose', scene: id, choice: 'accept-terms' });
  close(s);
  // Separate perceptions entered through the real HF evidence API, not a shared placement summary.
  const good = s.people['arslans-0']!,
    bad = s.people['arslans-3']!;
  good.affect.mood.valence = 0.2;
  bad.affect.mood.valence = -0.5;
  apply(s, { type: 'call-household', family: 'arslans', member: 'arslans-3', topic: 'smooth' });
  expect(bad.affect.mood.valence).toBeGreaterThan(-0.5);
  expect(good.affect.mood.valence).toBe(0.2);
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 3))).not.toBe(fingerprint(s)); // direct fixture edits deliberately are not replay inputs
});

test('an appointment cannot bring a placed worker back onto the bench', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'take-number', candidate: 'sevda' });
  apply(s, { type: 'call-in', candidate: 'sevda' });
  const arrival = card(s, 'sevda').arrival!.at;
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
  close(s);
  until(s, arrival + 1);
  expect(card(s, 'sevda').status).toBe('placed');
  expect(card(s, 'sevda').arrival).toBeUndefined();
});
test('each side can refuse an extreme proposal and counter a negotiable one', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  const id = view(s).scene!.id;
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 100000, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7, fee: 8000 },
  });
  expect(view(s).scene!.negotiation?.familyResponse).toBe('refused');
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 7500, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7, fee: 8000 },
  });
  expect(view(s).scene!.negotiation?.worker).toBe('countered');
});
test('household and candidate calls respect the current conversation', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'take-number', candidate: 'sevda' });
  apply(s, { type: 'interview', candidate: 'gul' });
  const id = view(s).scene!.id;
  apply(s, { type: 'call-in', candidate: 'sevda' });
  expect(view(s).scene!.id).toBe(id);
  expect(card(s, 'sevda').arrival).toBeUndefined();
});

test('a reference call cannot repeat testimony or add duplicate notes', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'interview', candidate: 'sevda' });
  close(s);
  until(s, 600);
  const ref = card(s, 'sevda').referees[0]!;
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: ref.id });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'ref-patient' });
  close(s);
  const before = structuredClone(card(s, 'sevda').notes);
  expect(card(s, 'sevda').referees[0]?.why).toContain('already told you');
  expect(card(s, 'sevda').referees[0]?.reachable).toBe(false);
  apply(s, { type: 'call-reference', candidate: 'sevda', referee: ref.id });
  expect(view(s).scene).toBeNull();
  expect(card(s, 'sevda').notes).toEqual(before);
});
test('a trial status names tomorrow noon and its report arrives then', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'trial', candidate: 'sevda', family: 'arslans' });
  expect(card(s, 'sevda').busy).toContain('Tuesday 3 November, 12:00');
  until(s, 2160);
  expect(card(s, 'sevda').status).toBe('books');
  let found = false;
  for (let i = 0; i < 30 && view(s).phoneRinging; i++) {
    apply(s, { type: 'answer-phone' });
    if (view(s).scene?.kind === 'trial-result') found = true;
    close(s);
  }
  expect(found).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now, 3))).toBe(fingerprint(s));
});
test('an expired request carries a one-line reason', () => {
  const s = newGame(1, 3);
  until(s, 1921);
  const r = view(s).requests.find((r) => r.family === 'arslans')!;
  expect(r.status).toBe('lost');
  expect(r.lostReason).toMatch(/needed someone earlier|asked elsewhere/);
});

test('the agreed day off replaces Sunday rest and the map follows working hours', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  const id = view(s).scene!.id;
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 8000, startHour: 9, endHour: 17, dayOff: 1, trialDays: 7, fee: 2000 },
  });
  apply(s, { type: 'choose', scene: id, choice: 'accept-terms' });
  close(s);
  s.now = 6 * 1440 + 599;
  advance(s, 1);
  const figure = view(s).city.figures.find((f) => f.id === 'sevda')!;
  expect(figure.place).toContain('Arslans');
  const p = (s.placements as { moments: { day: number }[] }[])[0]!;
  expect(p.moments.some((m) => m.day === 6)).toBe(true);
  expect(fingerprint(replay(1, s.inputs, s.now, 3))).not.toBe(fingerprint(s)); // direct clock fixture deliberately skips intervening days
});

test('a shorter trial can resolve the family wage counter they actually offer', () => {
  const s = newGame(1, 3);
  s.people['arslans-0']!.traits.agreeableness = 0.5;
  s.people['arslans-0']!.memory.sourceTrust.nermin = 0.5;
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  const id = view(s).scene!.id;
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 12000, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7, fee: 2000 },
  });
  expect(view(s).scene!.negotiation?.familyResponse).toBe('countered');
  apply(s, { type: 'choose', scene: id, choice: 'offer-trial' });
  expect(view(s).scene!.negotiation?.familyResponse).toBe('accepted');
});
test('trial days count working days, and hours preserve minutes in spoken terms', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  const id = view(s).scene!.id;
  apply(s, {
    type: 'propose-terms',
    scene: id,
    terms: { wage: 8000, startHour: 8.5, endHour: 17.5, dayOff: 1, trialDays: 3, fee: 0 },
  });
  expect(view(s).scene!.lines.at(-3)!.text).toContain('08:30–17:30');
  apply(s, { type: 'choose', scene: id, choice: 'accept-terms' });
  const p = view(s).placements[0]!;
  expect(p.trialEnds).toBe(4 * 1440 + 720);
  expect(p.terms?.fee).toBe(0);
});

test('interview answers use clock time and leaving after a long conversation keeps contact', () => {
  const s = newGame(1, 3);
  apply(s, { type: 'interview', candidate: 'sevda' });
  const id = view(s).scene!.id;
  for (let i = 0; i < 4; i++) {
    const before = s.now;
    const choice = view(s).scene!.choices.find(
      (c) => !c.disabled && !['wait-bench', 'send-home', 'coach'].includes(c.id),
    )!;
    apply(s, { type: 'choose', scene: id, choice: choice.id });
    expect(s.now - before).toBeGreaterThanOrEqual(8);
    expect(s.now - before).toBeLessThanOrEqual(12);
  }
  expect(card(s, 'sevda').status).toBe('books');
  expect(view(s).scene!.lines.at(-1)!.text).toContain('journey');
  close(s);
  apply(s, { type: 'call-in', candidate: 'sevda' });
  expect(card(s, 'sevda').arrival!.at).toBeGreaterThanOrEqual(card(s, 'sevda').interviewAfter!);
  expect(fingerprint(replay(1, s.inputs, s.now, 3))).toBe(fingerprint(s));
});
