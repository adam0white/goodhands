import { describe, expect, it } from 'vitest';
import { type Policy, runPolicy } from '../scripts/policy.ts';
import { fingerprint, QUALITIES, view } from '../src/sim/index.ts';

describe('public-view policies', () => {
  it.each<Policy>(['careful', 'reckless', 'cunning'])(
    '%s makes progress and stays deterministic',
    (policy) => {
      const a = runPolicy(1, policy, 1600);
      const b = runPolicy(1, policy, 1600);
      expect(a.now).toBeGreaterThanOrEqual(1600);
      expect(fingerprint(a)).toBe(fingerprint(b));
      expect(view(a).placements.length).toBeGreaterThan(0);
    },
  );
  it('careful asks three different questions and vouches only from positive testimony or observation', () => {
    const state = runPolicy(1, 'careful', 1600);
    const v = view(state);
    for (const placement of v.placements) {
      const c = [...v.bench, ...v.books].find((c) => c.id === placement.candidate);
      expect(c).toBeDefined();
      expect(new Set(c?.notes.filter((n) => n.source === 'says').map((n) => n.quality)).size).toBe(3);
      for (const quality of placement.vouched) {
        expect(
          c?.notes.some(
            (n) =>
              n.quality === quality && n.read === 'yes' && n.source !== 'says' && n.at <= placement.since,
          ),
        ).toBe(true);
      }
    }
  });
  it('reckless places without an interview and vouches for every quality', () => {
    const v = view(runPolicy(1, 'reckless', 600));
    expect(v.placements[0]?.vouched).toEqual(QUALITIES);
    expect([...v.bench, ...v.books].every((c) => c.notes.length === 0)).toBe(true);
  });
  it('cunning uses the offered coaching choice', () => {
    const state = runPolicy(1, 'cunning', 700);
    expect(
      state.inputs.some((entry) => entry.input.type === 'choose' && entry.input.choice === 'coach'),
    ).toBe(true);
  });
  it('rejects invalid end times', () => {
    expect(() => runPolicy(1, 'careful', Number.NaN)).toThrow('finite minute');
  });
});
