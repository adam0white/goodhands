/** These are acceptance checks on the simulation, not special scoring rules inside the players. */
import { beforeAll, describe, expect, it } from 'vitest';
import { MONTH_END, type Policy, runPolicy } from '../scripts/policy.ts';
import { view } from '../src/sim/index.ts';

type Result = {
  seed: number;
  policy: Policy;
  cash: number;
  kept: number;
  trusted: number;
  ended: boolean;
  now: number;
};
const results: Result[] = [];
const seeds = [1, 2, 3, 4, 5];
const collectResults = () => {
  for (const seed of seeds) {
    for (const policy of ['careful', 'reckless', 'cunning'] as const) {
      const v = view(runPolicy(seed, policy));
      results.push({
        seed,
        policy,
        cash: v.cash,
        kept: v.placements.filter((p) => p.status === 'kept').length,
        trusted: v.review?.trustedBy.length ?? 0,
        ended: v.ended,
        now: v.now,
      });
    }
  }
  console.info('Policy outcome evidence:', JSON.stringify(results));
};

describe('month policy consequences across five seeds', () => {
  beforeAll(collectResults, 180000);
  it('all players finish a month or reach an authored early ending', () => {
    expect(results.every((r) => r.ended && r.now <= MONTH_END)).toBe(true);
  });
  it.each(['kept', 'trusted'] as const)(
    'careful earns more %s than reckless in a majority of seeds',
    (metric) => {
      const improved = seeds.filter((seed) => {
        const careful = results.find((r) => r.seed === seed && r.policy === 'careful');
        const reckless = results.find((r) => r.seed === seed && r.policy === 'reckless');
        return careful && reckless && careful[metric] > reckless[metric];
      });
      expect(improved.length, JSON.stringify(results)).toBeGreaterThan(seeds.length / 2);
    },
  );
  it('cunning sometimes earns strictly the most cash', () => {
    const wins = seeds.filter((seed) => {
      const cunning = results.find((r) => r.seed === seed && r.policy === 'cunning');
      return (
        cunning &&
        results.filter((r) => r.seed === seed && r.policy !== 'cunning').every((r) => cunning.cash > r.cash)
      );
    });
    expect(wins.length, JSON.stringify(results)).toBeGreaterThan(0);
  });
});
