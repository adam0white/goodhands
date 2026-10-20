/** Historical policy evidence runs under its shipped simulation, not the new verbs. */

import type { Policy } from '../scripts/policy.ts';
import { runPolicy as current } from '../scripts/policy.ts';

export { MONTH_END, type Policy } from '../scripts/policy.ts';
export const runPolicy = (seed: number, policy: Policy, until?: number) => current(seed, policy, until, 2);
