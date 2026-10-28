/** Unnamed households have work consequences, not extra maintained personal arcs. */
import type { Quality } from './types.ts';
export function householdVoice(_family: string, _member: number): string {
  return 'Please check the written agreement with the person doing the work.';
}
export function householdConsequence(_family: string, _quality: Quality, good: boolean): string {
  return good ? 'The household could follow the agreed routine.' : 'The household had to change the routine.';
}
