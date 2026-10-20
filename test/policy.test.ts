import { describe, expect, it } from 'vitest';
import { GoodHandsAdapter } from '../scripts/hf-playtest/adapter.ts';
import { type Policy, runPolicy } from '../scripts/policy.ts';
import { advance, apply, fingerprint, QUALITIES, view } from '../src/sim/index.ts';

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
  it('careful completes one interview and vouches only from positive testimony or observation', () => {
    const state = runPolicy(1, 'careful', 1600);
    const v = view(state);
    expect(state.inputs.some(({ input }) => input.type === 'choose' && input.choice === 'hours')).toBe(true);
    for (const placement of v.placements) {
      const c = [...v.bench, ...v.books].find((c) => c.id === placement.candidate);
      expect(c).toBeDefined();
      expect(
        new Set(c?.notes.filter((n) => n.source === 'says').map((n) => n.quality)).size,
      ).toBeGreaterThanOrEqual(3);
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
  it('uses named waits and never reopens a completed interview', () => {
    const state = runPolicy(1, 'careful', 3600);
    const interviews = state.inputs.flatMap(({ input }) =>
      input.type === 'interview' ? [input.candidate] : [],
    );
    expect(new Set(interviews).size).toBe(interviews.length);
    expect(state.inputs.some(({ input }) => input.type === 'wait-for')).toBe(true);
  });
  it('rejects invalid end times', () => {
    expect(() => runPolicy(1, 'careful', Number.NaN)).toThrow('finite minute');
  });
});

describe('HF public actions', () => {
  it('offers the named wait and withholds check-ins before the first morning', () => {
    const game = new GoodHandsAdapter(1);
    const initial = view(game.state);
    const candidate = initial.bench[0];
    const request = initial.requests[0];
    if (!candidate || !request) throw new Error('Opening candidate and request required.');
    game.state = apply(game.state, {
      type: 'place',
      candidate: candidate.id,
      family: request.family,
      vouch: [],
    });
    const actions = game.actions();
    expect(actions.some((action) => action.kind === 'check-in')).toBe(false);
    expect(actions.find((action) => action.kind === 'wait-for')?.label).toContain(
      view(game.state).next?.label,
    );
    while (!view(game.state).dayCard) game.state = advance(game.state, 60);
    expect(game.actions().some((action) => action.kind === 'wait-for')).toBe(false);
  });
});
