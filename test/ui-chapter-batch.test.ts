import type { LifePreparation, PersonaEnvelope } from '@adam0white/lab-client';
import { PEOPLE_ACROSS_GAMES } from '@adam0white/lab-kit';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { savedMonthStatus, skippedBeforeAcceptance } from '../src/ui/chapter-batch.ts';

const input = (castId: string) => ({ parent: { castId } }) as LifePreparation;
const claim = (castId: string) => ({ castId }) as PersonaEnvelope;

test('precommit omission includes refused heads, not fresh absent people', () => {
  const skipped = skippedBeforeAcceptance(
    [input(CAST.hatice.castId), input(CAST.hulya.castId)],
    [{ castId: CAST.aylin.castId, reason: 'Aylin is elsewhere.' }],
    [claim(CAST.hatice.castId)],
  );
  expect(skipped.map((p) => p.castId)).toEqual([CAST.aylin.castId, CAST.hulya.castId]);
  expect(skipped[1]?.reason).toContain(CAST.hulya.name);
  expect(() => skippedBeforeAcceptance([input(CAST.nermin.castId)], [], [])).toThrow(/Nermin/);
});

test('older saves get a start-new message and the shared caption is used', () => {
  expect(savedMonthStatus(true, true, false)).toBe(
    'This saved month uses an older version. Start a new game.',
  );
  expect(savedMonthStatus(false, true, false)).toBe('Looking for a saved month…');
  expect(PEOPLE_ACROSS_GAMES).toBe('People across games');
});
