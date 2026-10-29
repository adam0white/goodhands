/** Public profiles come from the immutable released canonical registry. Private discoveries stay host-authored. */
import { createPerson, type Person, type Traits, type Values } from '@adam0white/human-framework-legacy3';
import { canonicalCast, castForGame } from '@adam0white/lab-client-legacy3';
export const CAST_EDITION = 'goodhands-one-cast-1';
export const CAST_KEYS = [
  'nermin',
  'hatice',
  'hulya',
  'aylin',
  'derya',
  'zeynep-pass',
  'selin-voice',
] as const;
export type CastKey = (typeof CAST_KEYS)[number];
const IDS: Record<CastKey, string> = {
  nermin: 'hf.cast.nermin.goodhands',
  hatice: 'hf.cast.hatice.hearsay',
  hulya: 'hf.cast.hulya.pass',
  aylin: 'hf.cast.aylin.murmur',
  derya: 'hf.cast.derya.stairwell',
  'zeynep-pass': 'hf.cast.zeynep.pass',
  'selin-voice': 'hf.cast.selin.voice',
};
export const ALLOCATION = castForGame('goodhands');
export const CAST = Object.fromEntries(
  CAST_KEYS.map((key) => {
    const c = canonicalCast(IDS[key]);
    return [key, { ...c, role: c.work }];
  }),
) as Record<CastKey, ReturnType<typeof canonicalCast> & { role: string }>;
export function castKey(castId: string): CastKey {
  const key = CAST_KEYS.find((k) => CAST[k].castId === castId);
  if (!key) throw new Error('Person is outside the Good Hands allocation.');
  return key;
}
export function castProfile(id: CastKey): { traits: Traits; values: Values } {
  return { traits: structuredClone(CAST[id].traits), values: structuredClone(CAST[id].values) };
}
export function freshCast(
  id: CastKey,
  seed: number,
  now: number,
  skills: Record<string, number> = {},
): Person {
  const c = CAST[id];
  return createPerson({
    lexicon: { plainEnglish: true },
    id,
    name: c.name,
    seed,
    now,
    bornAt: now - c.age * 365.25 * 1440,
    sex: 'female',
    ...castProfile(id),
    skills,
  });
}

/** Author-facing family facts; not a discovery or a player-facing biography. */
export const CAST_FAMILY = {
  nermin: 'A grown foster daughter lives independently.',
  hatice: 'Widowed; a grown child lives outside the district.',
  hulya: 'Separated; an adult stepdaughter is a private background relation.',
  aylin: 'Dilan is her younger sister; their mother is background.',
  derya: 'Single; Volkan is her brother, currently between jobs. His circumstances are private.',
  'zeynep-pass': 'Two sons at home; no named spouse established.',
  'selin-voice':
    'Halil is her father. Her mother Nuran died before the Voice opening; her own household is unnamed.',
} satisfies Record<CastKey, string>;
export function castManifest() {
  return Object.fromEntries(
    (Object.keys(CAST) as CastKey[]).map((id) => [
      id,
      { ...CAST[id], family: CAST_FAMILY[id], ...castProfile(id) },
    ]),
  );
}
