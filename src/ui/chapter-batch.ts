import type { LifePreparation, PersonaEnvelope } from '@adam0white/lab-client';
import { CAST, castKey } from '../sim/cast.ts';

export type SkippedPerson = { castId: string; reason: string };

/** Include only actual refused heads, never an absent head for a fresh person. */
export function skippedBeforeAcceptance(
  prepared: LifePreparation[],
  blocked: SkippedPerson[],
  claims: PersonaEnvelope[],
): SkippedPerson[] {
  const accepted = new Set(claims.map((p) => p.castId));
  const skipped = new Map(blocked.map((p) => [p.castId, { ...p }]));
  for (const input of prepared) {
    const id = input.parent.castId;
    if (!accepted.has(id) && !skipped.has(id))
      skipped.set(id, { castId: id, reason: `${CAST[castKey(id)].name} could not enter this month.` });
  }
  if (skipped.has(CAST.nermin.castId))
    throw new Error('Nermin cannot enter this month. Her saved history stays in its current game.');
  return [...skipped.values()];
}

export function savedMonthStatus(ready: boolean, older: boolean, unreadable: boolean): string {
  if (!ready) return 'Looking for a saved month…';
  if (older) return 'This saved month uses an older version. Keep the saved month and start a new game.';
  if (unreadable) return 'This saved month could not be loaded. Start a new game.';
  return '';
}
