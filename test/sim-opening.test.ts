import { describe, expect, test } from 'vitest';
import { advance, apply, fingerprint, milestones, newGame, replay, view } from '../src/sim/index.ts';

describe('the first morning', () => {
  test('opens with an urgent request and three different women', () => {
    const v = view(newGame(1));
    expect(v.dateLabel).toBe('Monday 2 November');
    expect(v.timeLabel).toBe('08:30');
    expect(v.bench.map((c) => c.name)).toEqual(['Gül', 'Sevda', 'Pınar']);
    expect(v.task.text).toContain('Arslans');
    expect(v.cash).toBe(3000);
    expect(v.requests[0]?.byLabel).toBe('Tuesday 3 November, 08:00');
  });
  test('interview, reference, vouch, day card and sleep form a playable opening', () => {
    const s = newGame(1);
    const first = view(s);
    apply(s, { type: 'interview', candidate: 'sevda' });
    let scene = view(s).scene!;
    apply(s, { type: 'choose', scene: scene.id, choice: 'q-patient' });
    scene = view(s).scene!;
    expect(scene.lines.some((l) => l.kind === 'speech')).toBe(true);
    expect(scene.choices.some((c) => c.label === 'Coach her')).toBe(false);
    expect(scene.choices.some((c) => c.id === 'q-patient')).toBe(false);
    expect([...view(s).bench, ...view(s).books].find((c) => c.id === 'sevda')!.notes.length).toBeGreaterThan(
      0,
    );
    apply(s, { type: 'close-scene', scene: scene.id });
    const ref = [...view(s).bench, ...view(s).books].find((c) => c.id === 'sevda')!.referees[0]!;
    advance(s, 120);
    apply(s, { type: 'call-reference', candidate: 'sevda', referee: ref.id });
    expect(view(s).scene?.kind).toBe('reference');
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
    expect(view(s).placements).toHaveLength(1);
    expect(view(s).cash).toBeGreaterThan(5000);
    expect(milestones(first, view(s))).toContain('first placement');
    for (let i = 0; i < 40 && !view(s).dayCard; i++) {
      const current = view(s);
      if (current.scene) {
        apply(s, {
          type: 'choose',
          scene: current.scene.id,
          choice: current.scene.kind === 'two-sides' ? 'promise' : current.scene.choices[0]!.id,
        });
        if (view(s).scene) apply(s, { type: 'close-scene', scene: view(s).scene!.id });
      } else if (current.phoneRinging) apply(s, { type: 'answer-phone' });
      else advance(s, 120);
    }
    expect(view(s).dayCard?.tomorrow).toContain('Sevda');
    apply(s, { type: 'sleep' });
    expect(view(s).dateLabel).toBe('Tuesday 3 November');
    expect(view(s).timeLabel).toBe('08:30');
    expect(fingerprint(replay(1, s.inputs, s.now))).toBe(fingerprint(s));
  });
  test('waiting costs a candidate her patience', () => {
    const s = newGame(1);
    advance(s, 120);
    expect(view(s).bench.some((c) => c.posture !== 'settled')).toBe(true);
    while (s.now < 690) advance(s, 690 - s.now);
    expect(view(s).bench.some((c) => c.posture === 'leaving')).toBe(true);
    while (s.now < 1000) advance(s, 1000 - s.now);
    expect(view(s).books.some((c) => c.status === 'gone')).toBe(true);
    expect(view(s).log.some((l) => l.text.includes('left'))).toBe(true);
  });
});
