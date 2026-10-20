import { performance } from 'node:perf_hooks';
import { view } from '../src/sim/index.ts';
import { type Policy, runPolicy } from './policy.ts';

const policies: Policy[] = ['careful', 'reckless', 'cunning'];
const count = Number(process.argv[2] ?? 5);
if (!Number.isInteger(count) || count < 1 || count > 100)
  throw new Error('Usage: npm run measure -- <seeds 1..100>');
for (let seed = 1; seed <= count; seed++) {
  for (const policy of policies) {
    const start = performance.now();
    const v = view(runPolicy(seed, policy));
    console.log(
      JSON.stringify({
        seed,
        policy,
        milliseconds: Math.round(performance.now() - start),
        now: v.now,
        ended: v.ended,
        cash: v.cash,
        placements: v.placements.length,
        kept: v.placements.filter((p) => p.status === 'kept').length,
        trusted: v.review?.trustedBy.length ?? v.families.filter((f) => f.trust === 'warm').length,
        workersTrust: v.review?.workersTrust?.filter((worker) => worker.trust === 'warm').length ?? 0,
        // Month-review reports record what happened when the household tested the arrangement.
        // An offered negotiation or an unresolved promise does not count as a result.
        arrangementTests:
          v.review?.placements.flatMap((placement) => {
            const reports = placement.story.filter((line) => line.includes('Household test ('));
            return reports.length
              ? [
                  {
                    placement: placement.id,
                    tests: reports.length,
                    first: reports[0],
                    latest: reports.at(-1),
                  },
                ]
              : [];
          }) ?? [],
      }),
    );
  }
}
