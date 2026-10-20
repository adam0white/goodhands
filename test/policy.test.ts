import { describe, expect, it } from 'vitest';
import { GoodHandsAdapter } from '../scripts/hf-playtest/adapter.ts';
import { type Policy, runPolicy } from '../scripts/policy.ts';
import { advance, apply, fingerprint, QUALITIES, view } from '../src/sim/index.ts';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected public game fixture.');
  return value;
}

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
  it('answers the opening phone before continuing the interview', () => {
    const state = runPolicy(1, 'careful', 700);
    const question = state.inputs.findIndex(
      ({ input }) => input.type === 'choose' && input.choice.startsWith('q-'),
    );
    expect(question).toBeGreaterThanOrEqual(0);
    expect(state.inputs[question + 1]?.input.type).toBe('answer-phone');
    expect(state.inputs.some(({ input }) => input.type === 'take-number')).toBe(true);
  });
  it('rejects invalid end times', () => {
    expect(() => runPolicy(1, 'careful', Number.NaN)).toThrow('finite minute');
  });
});

describe('HF public actions', () => {
  it('keeps a bench contact without inventing interview evidence', () => {
    const game = new GoodHandsAdapter(1);
    const candidate = required(view(game.state).bench[0]);
    const action = required(game.actions().find((a) => a.id === `take-number:${candidate.id}`));
    expect(action).toBeDefined();
    game.apply(action.id);
    const card = view(game.state).books.find((c) => c.id === candidate.id);
    expect(card?.status).toBe('books');
    expect(card?.notes).toEqual([]);
    expect(
      game
        .observe()
        .events.some((event) => Array.isArray(event.answers) && event.answers.includes(action.id)),
    ).toBe(true);
  });
  it.each(['interview', 'reference'] as const)(
    'offers a phone interruption during %s and resumes it',
    (kind) => {
      const game = new GoodHandsAdapter(1);
      game.state = apply(game.state, { type: 'interview', candidate: 'sevda' });
      const interview = required(view(game.state).scene ?? undefined);
      game.state = apply(game.state, { type: 'choose', scene: interview.id, choice: 'q-patient' });
      if (kind === 'reference') {
        game.state = apply(game.state, { type: 'close-scene', scene: interview.id });
        for (let n = 0; n < 5 && view(game.state).now < 630; n++) game.state = advance(game.state, 60);
        const candidate = required(
          [...view(game.state).bench, ...view(game.state).books].find((c) => c.id === 'sevda'),
        );
        const referee = required(candidate.referees.find((r) => r.reachable));
        expect(referee).toBeDefined();
        game.state = apply(game.state, {
          type: 'call-reference',
          candidate: candidate.id,
          referee: referee.id,
        });
      }
      const held = required(view(game.state).scene ?? undefined);
      expect(held.kind).toBe(kind);
      expect(view(game.state).phoneRinging).toBeTruthy();
      const answer = required(game.actions().find((a) => a.id === 'answer-phone'));
      expect(answer).toBeDefined();
      game.apply(answer.id);
      expect(view(game.state).heldScene?.id).toBe(held.id);
      expect(game.actions().some((a) => a.id === 'answer-phone')).toBe(false);
      expect(game.observe().loops.some((loop) => loop.includes(held.title))).toBe(true);
      const endCall = required(game.actions().find((a) => a.kind === 'close-scene'));
      game.apply(endCall.id);
      expect(view(game.state).scene?.id).toBe(held.id);
      expect(view(game.state).heldScene).toBeFalsy();
    },
  );
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
