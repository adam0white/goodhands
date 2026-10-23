import { expect, test } from 'vitest';
import { candidateMemories, householdMemories } from '../src/sim/backstories.ts';
import { personalAnswer } from '../src/sim/dialogue.ts';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import { familyMoment } from '../src/sim/references.ts';
import type { State } from '../src/sim/types.ts';
import * as third from '../src/sim/v3/index.ts';
import { CANDIDATES, FAMILIES } from '../src/sim/world.ts';

function agree(s: State, wage: number, fee: number) {
  apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  const scene = view(s).scene!;
  apply(s, {
    type: 'propose-terms',
    scene: scene.id,
    terms: { wage, fee, startHour: 8, endHour: 17, dayOff: 6, trialDays: 3 },
  });
  apply(s, { type: 'choose', scene: scene.id, choice: 'accept-terms' });
}

test('all existing candidates have specific recollections through the existing personal questions', () => {
  expect(Object.keys(candidateMemories)).toHaveLength(CANDIDATES.length);
  for (const c of CANDIDATES) {
    expect(personalAnswer(c.id, 'last-family')).toContain(candidateMemories[c.id]!.last);
    expect(personalAnswer(c.id, 'why-left')).toContain(candidateMemories[c.id]!.leaving);
  }
  const s = newGame(1, 4);
  apply(s, { type: 'interview', candidate: 'sevda' });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'last-family' });
  expect(view(s).scene!.lines.some((l) => l.text.includes('one boot under my chair'))).toBe(true);
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 4))).toBe(fingerprint(s));
});

test('families reveal individual concerns in calls and consequences through existing outcomes', () => {
  expect(Object.keys(householdMemories)).toHaveLength(FAMILIES.length);
  for (const f of FAMILIES) {
    const memory = householdMemories[f.id]!;
    expect(memory.voices).toHaveLength(f.household.length);
    expect(familyMoment(f.id, memory.quality, true, 'Worker')).toContain(memory.good);
    expect(familyMoment(f.id, memory.quality, false, 'Worker')).toContain(memory.bad);
  }
  const s = newGame(1, 4);
  expect(JSON.stringify(view(s))).not.toContain('ironed my work blouse');
  apply(s, { type: 'call-household', family: 'arslans', member: 'arslans-0', topic: 'progress' });
  expect(view(s).scene!.lines[0]!.text).toContain('ironed my work blouse');
  apply(s, { type: 'close-scene', scene: view(s).scene!.id });
  apply(s, { type: 'call-household', family: 'arslans', member: 'arslans-3', topic: 'progress' });
  expect(view(s).scene!.lines[0]!.text).toContain('without a written schedule');
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 4))).toBe(fingerprint(s));
});

test('new agreements collect a week of wages capped at the total fee', () => {
  for (const fee of [3000, 1000, 0]) {
    const s = newGame(1, 4);
    const cash = view(s).cash;
    agree(s, 10000, fee);
    expect(view(s).placements).toHaveLength(1);
    expect(view(s).cash - cash).toBe(Math.min(2500, fee));
    if (fee === 0) {
      expect(view(s).scene!.lines.at(-1)!.text).toContain('No agency fee is due');
      expect(view(s).log.find((l) => l.kind === 'placement')?.text).toContain('No agency fee is due');
    }
    expect(fingerprint(replay(s.seed, s.inputs, s.now, 4))).toBe(fingerprint(s));
  }
});

test('version three saves continue and replay with the exact frozen state and view', () => {
  const original = third.newGame(1);
  const dispatched = newGame(1, 3);
  for (const state of [original, dispatched]) agree(state, 10000, 3000);
  expect(dispatched).toEqual(original);
  expect(view(dispatched)).toEqual(third.view(original));
  const resumed = structuredClone(original);
  for (const s of [resumed, original]) {
    const sc = view(s).scene;
    if (sc) apply(s, { type: 'close-scene', scene: sc.id });
  }
  third.advance(original, 1440);
  advance(resumed, 1440);
  expect(resumed).toEqual(original);
  expect(fingerprint(replay(resumed.seed, resumed.inputs, resumed.now, 3))).toBe(third.fingerprint(original));
});

test('replacement words and final balance use the deposit already paid', () => {
  const s = newGame(1, 4);
  agree(s, 10000, 3000);
  apply(s, { type: 'close-scene', scene: view(s).scene!.id });
  apply(s, { type: 'withdraw', placement: view(s).placements[0]!.id });
  const cash = view(s).cash;
  agree(s, 9000, 6000);
  expect(view(s).placements).toHaveLength(2);
  expect(view(s).cash).toBe(cash);
  expect(view(s).scene!.lines.at(-1)!.text).toContain('earlier deposit covers this replacement');
  expect(view(s).scene!.lines.at(-1)!.text).not.toContain('deposit is');
  apply(s, { type: 'close-scene', scene: view(s).scene!.id });
  const placement = view(s).placements[1]!;
  while (s.now < placement.trialEnds) advance(s, placement.trialEnds - s.now);
  const host = s as State & { placements: { status: string; pendingFee: number }[] };
  expect(host.placements[1]!.status).toBe('kept');
  expect(host.placements[1]!.pendingFee).toBe(3500);
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 4))).toBe(fingerprint(s));
});
