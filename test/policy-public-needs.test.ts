import { expect, it } from 'vitest';
import { pressure } from '../scripts/policy.ts';
import type { RequestView } from '../src/sim/types.ts';

const request = (role: RequestView['role'], wants: string): RequestView => ({
  id: 'public-request',
  family: 'public-family',
  role,
  wants,
  wage: 9000,
  by: 1000,
  byLabel: 'tomorrow',
  status: 'open',
});

it.each([
  ['nanny', 'We need a nanny who will give Eylül time to put away her toys herself.', 'patient'],
  ['carer', 'We need a carer who will ask Nihal which activity she would like to do.', 'warm'],
  ['nanny', 'We need a nanny who will ask İdil which picture book she would like.', 'warm'],
  ['carer', 'We need a carer who will ask Şükran where she would like to sit.', 'warm'],
  ['driver', 'Drive Deniz to school and Onur to his night shift. Keep our journeys private.', 'discreet'],
  ['cook', 'Eight for lunch on Saturdays. You need not join the conversation.', 'discreet'],
  ['carer', 'The worker must keep family matters to herself.', 'discreet'],
  [
    'carer',
    'We need a carer for the agreed hours. The person receiving help wants the worker to speak directly to that person.',
    'warm',
  ],
] as const)('classifies public request %s: %s as %s', (role, words, expected) => {
  expect(pressure(request(role, words))).toBe(expected);
});
