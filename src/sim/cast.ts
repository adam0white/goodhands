/** Registry one-cast-1 content, pending replacement by the released shared artifact.
 * Opening priors only: continuing supported Persons must never be rebuilt from these.
 */
import { createPerson, type Person, type Traits, type Values } from '@adam0white/human-framework';

export const CAST_EDITION = 'goodhands-one-cast-1';
export const BASE_TRAITS: Traits = {
  honesty: 0.5,
  emotionality: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  conscientiousness: 0.5,
  openness: 0.5,
};
export const BASE_VALUES: Values = {
  benevolence: 0.5,
  universalism: 0.5,
  tradition: 0.5,
  conformity: 0.5,
  security: 0.5,
  achievement: 0.5,
  power: 0.5,
  hedonism: 0.5,
  stimulation: 0.5,
  selfDirection: 0.5,
};
export const CAST = {
  nermin: {
    castId: 'hf.cast.nermin.goodhands',
    revision: 1,
    name: 'Nermin',
    age: 45,
    role: 'agency operator; formerly alterations tailor',
    traits: {
      honesty: 0.75,
      agreeableness: 0.65,
      conscientiousness: 0.75,
      extraversion: 0.6,
      emotionality: 0.5,
      openness: 0.65,
    },
    values: {},
  },
  hatice: {
    castId: 'hf.cast.hatice.hearsay',
    revision: 1,
    name: 'Hatice',
    age: 48,
    role: 'tea-garden keeper; seasonal cook and housekeeper',
    traits: {
      honesty: 0.85,
      extraversion: 0.7,
      conscientiousness: 0.7,
      agreeableness: 0.6,
      emotionality: 0.5,
      openness: 0.5,
    },
    values: {},
  },
  hulya: {
    castId: 'hf.cast.hulya.pass',
    revision: 1,
    name: 'Hülya',
    age: 38,
    role: 'oven cook; bounded baking and meal preparation',
    traits: { honesty: 0.8, conscientiousness: 0.75, agreeableness: 0.3, extraversion: 0.4 },
    values: {},
  },
  aylin: {
    castId: 'hf.cast.aylin.murmur',
    revision: 1,
    name: 'Aylin',
    age: 36,
    role: 'school kitchen cook; private meal preparation',
    traits: {
      honesty: 0.8,
      conscientiousness: 0.8,
      extraversion: 0.55,
      agreeableness: 0.65,
      emotionality: 0.55,
      openness: 0.55,
    },
    values: {},
  },
  derya: {
    castId: 'hf.cast.derya.stairwell',
    revision: 2,
    name: 'Derya',
    age: 44,
    role: 'night nurse; professional care-scope contact',
    traits: { honesty: 0.7, extraversion: 0.35, agreeableness: 0.6, emotionality: 0.5, openness: 0.55 },
    values: {},
  },
  'zeynep-pass': {
    castId: 'hf.cast.zeynep.pass',
    revision: 2,
    name: 'Zeynep',
    age: 45,
    role: 'canteen cook; visiting cold-supper cook',
    traits: { honesty: 0.8, conscientiousness: 0.85, agreeableness: 0.7 },
    values: {},
  },
  'selin-voice': {
    castId: 'hf.cast.selin.voice',
    revision: 2,
    name: 'Selin',
    age: 32,
    role: 'office worker; household enquiry contact',
    traits: { conscientiousness: 0.7, extraversion: 0.6, agreeableness: 0.65, honesty: 0.75 },
    values: { benevolence: 0.8, achievement: 0.6, tradition: 0.4 },
  },
} as const;
export type CastKey = keyof typeof CAST;
export function castProfile(id: CastKey): { traits: Traits; values: Values } {
  return { traits: { ...BASE_TRAITS, ...CAST[id].traits }, values: { ...BASE_VALUES, ...CAST[id].values } };
}
export function freshCast(
  id: CastKey,
  seed: number,
  now: number,
  skills: Record<string, number> = {},
): Person {
  const c = CAST[id];
  return createPerson({
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
