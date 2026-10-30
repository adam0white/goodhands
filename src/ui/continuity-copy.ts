import { CAST, castKey } from '../sim/cast.ts';

export function unavailablePeople(people: readonly { castId: string }[] = []): string {
  const names = people.map((p) => CAST[castKey(p.castId)].name);
  if (!names.length) return '';
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${joined} could not come to the office this month. Their saved histories stay as they were.`;
}

export function continuityError(error: unknown, lab: boolean, fallback: string): string {
  return lab && error instanceof Error ? error.message : fallback;
}

export function sourceStatus(current: string, saved: readonly string[] | undefined, lab: boolean): string {
  return current || (lab ? saved?.join('\n') : '') || '';
}
