import { expect, test } from 'vitest';
import { runPolicy } from '../scripts/policy.ts';
import { view } from '../src/sim/index.ts';

test('city testimony changes incoming work during an ordinary month', () => {
  const v = view(runPolicy(1, 'careful'));
  expect(
    v.log.some((l) => /recommended you|placed told me to come|looking elsewhere|another agency/.test(l.text)),
  ).toBe(true);
  const routes = v.review?.routes ?? [];
  expect(routes.some((r) => r.parent !== undefined)).toBe(true);
  for (const route of routes)
    if (route.parent !== undefined) {
      const earlier = routes.find((r) => r.id === route.parent)!;
      expect(earlier.to).toBe(route.from);
      expect(earlier.words).toBe(route.words);
      expect(earlier.at).toBeLessThanOrEqual(route.at);
    }
});
