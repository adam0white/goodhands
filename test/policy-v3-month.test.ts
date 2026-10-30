import { describe, expect, test } from 'vitest';
import { MONTH_END, type Policy, runPolicy } from '../scripts/policy.ts';
import { fingerprint, replay, view } from '../src/sim/v6/index.ts';

type Outcome = {
  seed: number;
  policy: Policy;
  cash: number;
  kept: number;
  warmWorkers: number;
};
const seeds = [1, 2];
const policies: Policy[] = ['careful', 'reckless', 'cunning'];
const outcomes: Outcome[] = [];

describe('current simulation month acceptance', { concurrent: false, shuffle: false }, () => {
  test.each(seeds.flatMap((seed) => policies.map((policy) => ({ seed, policy }))))(
    '$policy completes and exactly replays seed $seed',
    ({ seed, policy }) => {
      const state = runPolicy(seed, policy, MONTH_END, 3);
      const visible = view(state);
      expect(state.version).toBe(3);
      expect(visible.ended).toBe(true);
      expect(visible.now).toBeLessThanOrEqual(MONTH_END);
      expect(visible.review).not.toBeNull();
      expect(fingerprint(replay(seed, state.inputs, state.now, 3))).toBe(fingerprint(state));
      const outcome = {
        seed,
        policy,
        cash: visible.cash,
        kept: visible.placements.filter((placement) => placement.status === 'kept').length,
        warmWorkers: visible.review?.workersTrust?.filter((worker) => worker.trust === 'warm').length ?? 0,
      };
      outcomes.push(outcome);
      process.stdout.write(`Current month policy evidence: ${JSON.stringify(outcome)}\n`);
    },
    300000,
  );

  test('careful treatment improves retention or worker trust over reckless treatment', () => {
    expect(outcomes).toHaveLength(seeds.length * policies.length);
    const improved = seeds.filter((seed) => {
      const careful = outcomes.find((outcome) => outcome.seed === seed && outcome.policy === 'careful');
      const reckless = outcomes.find((outcome) => outcome.seed === seed && outcome.policy === 'reckless');
      if (!careful || !reckless) throw new Error(`Missing month evidence for seed ${seed}.`);
      return careful.kept > reckless.kept || careful.warmWorkers > reckless.warmWorkers;
    });
    expect(improved.length, JSON.stringify(outcomes)).toBeGreaterThan(0);
  });

  test('policy choices change the office cash outcome', () => {
    expect(outcomes).toHaveLength(seeds.length * policies.length);
    const different = seeds.filter((seed) => {
      const cash = outcomes.filter((outcome) => outcome.seed === seed).map((outcome) => outcome.cash);
      return new Set(cash).size > 1;
    });
    expect(different.length, JSON.stringify(outcomes)).toBeGreaterThan(0);
  });
});
