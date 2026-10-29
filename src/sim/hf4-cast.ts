/** Supported retained cast exchange. HF owns admission; the shelf owns identity,
 * source ownership and transport. No incomplete legacy passport becomes a new person. */
import type { PersonAuthoring, PortablePerson, SkillReading, SourcedNorm } from '@adam0white/human-framework';
import { validatePortablePerson } from '@adam0white/human-framework';
import {
  admitPortablePerson,
  canonicalPersona,
  type LifePreparation,
  lifeAdmission,
  portablePersonRole,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST, type CastKey, castKey } from './cast.ts';
import { authorPerson, portableFor, skillReadingsFor } from './hf4.ts';
import type { State } from './types.ts';
import { authorPeople } from './world.ts';

const START = 510 * 60_000;
export interface PortableVocabulary {
  actions: string[];
  sources: string[];
  entities: string[];
}
export interface Hf4AgencyChapter {
  version: 'goodhands-chapter/2';
  seed: number;
  inputs: LifePreparation[];
  actors: Partial<Record<CastKey, PersonAuthoring>>;
  facts: Partial<Record<CastKey, ReturnType<typeof lifeAdmission>>>;
  vocabulary: PortableVocabulary;
}
const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
function refuse(): never {
  throw new Error(
    'This saved person lacks supported retained history. Keep or export the source file and start fresh. No replacement person has been admitted.',
  );
}
const unique = (xs: string[]) => [...new Set(xs)].sort();
function vocabulary(value: unknown): PortableVocabulary {
  if (!value || typeof value !== 'object') return { actions: [], sources: [], entities: [] };
  const data = value as Record<string, unknown>;
  const ids = (x: unknown): string[] => {
    if (x === undefined) return [];
    if (
      !Array.isArray(x) ||
      x.length > 1024 ||
      x.some((id) => typeof id !== 'string' || !id || id.normalize('NFC') !== id)
    )
      return refuse();
    return unique(x as string[]);
  };
  return { actions: ids(data.actions), sources: ids(data.sources), entities: ids(data.entities) };
}

/** Source skill readings are explicit host evidence, outside HF's retained-v2
 * promise. Rebase current competence at arrival so forgetting is not applied twice. */
function mapSkills(value: unknown, opening: PersonAuthoring): void {
  if (value === undefined) return; // No claim that an absent source skill was retained.
  if (!Array.isArray(value) || value.length > 128) refuse();
  const allowed = new Set(opening.state.skills.map((skill) => skill.id)),
    seen = new Set<string>();
  for (const item of value) {
    const skill = item as SkillReading;
    if (
      !skill ||
      typeof skill.id !== 'string' ||
      seen.has(skill.id) ||
      !Number.isFinite(skill.competence) ||
      skill.competence < 0 ||
      skill.competence > 1 ||
      !Number.isSafeInteger(skill.practicedMs) ||
      skill.practicedMs < 0 ||
      !Number.isSafeInteger(skill.lastPracticed)
    )
      refuse();
    seen.add(skill.id);
    if (!allowed.has(skill.id)) continue; // Foreign craft IDs are not silently given a local meaning.
    opening.state.skills = [
      ...opening.state.skills.filter((s) => s.id !== skill.id),
      { id: skill.id, level: skill.competence, practicedMs: skill.practicedMs, lastPracticed: START },
    ];
  }
}
function clearReceiverHistory(opening: PersonAuthoring): void {
  opening.biography = [];
  opening.state.beliefs = [];
  opening.state.expectations = [];
  opening.state.sourceTrust = [];
  opening.state.heldNorms = [];
  opening.state.agenda = {
    ...opening.state.agenda,
    commitments: [],
    owed: [],
    goals: [],
    precommitments: [],
  };
}
export async function prepareHf4AgencyChapter(
  inputs: LifePreparation[],
  seed: number,
): Promise<Hf4AgencyChapter> {
  if (inputs.length > 7 || new Set(inputs.map((input) => input.parent.castId)).size !== inputs.length)
    throw new Error('Choose up to seven different people.');
  const specs = authorPeople(seed);
  const chapter: Hf4AgencyChapter = {
    version: 'goodhands-chapter/2',
    seed,
    inputs: structuredClone(inputs),
    actors: {},
    facts: {},
    vocabulary: { actions: [], sources: [], entities: [] },
  };
  for (const input of inputs) {
    const parent = await validatePersona(input.parent),
      key = castKey(parent.castId),
      cast = CAST[key];
    if (
      parent.terminal ||
      parent.castRevision !== cast.revision ||
      !same(preparePersonaLife(parent, input.clockMs).life, input.life)
    )
      return refuse();
    if (parent.transfer.castPassport !== 'hf-portable-person/2') return refuse();
    if (portablePersonRole(parent, 'goodhands') !== key) return refuse();
    const portable = validatePortablePerson(parent.transfer.portable);
    if (portable.version !== 2) return refuse();
    const spec = specs[key] ?? {
      id: key,
      seed,
      name: cast.name,
      sex: 'female' as const,
      bornAt: 510 - cast.age * 365.25 * 1440,
      traits: cast.traits,
      values: cast.values,
      skills: key === 'zeynep-pass' ? { cold: 0.7 } : {},
    };
    const opening = authorPerson(spec);
    opening.identity.castId = cast.castId;
    clearReceiverHistory(opening);
    mapSkills(parent.transfer.portableSkills, opening);
    chapter.actors[key] = admitPortablePerson(parent, 'goodhands', opening, {
      offsetMs: START - portable.retained.at,
      references: [],
    });
    chapter.facts[key] = lifeAdmission(input, 'goodhands');
    const extra = vocabulary(parent.transfer.portableVocabulary);
    chapter.vocabulary.actions.push(...extra.actions);
    chapter.vocabulary.sources.push(...extra.sources);
    chapter.vocabulary.entities.push(...extra.entities);
  }
  for (const key of ['actions', 'sources', 'entities'] as const)
    chapter.vocabulary[key] = unique(chapter.vocabulary[key]);
  return chapter;
}
export async function validateHf4AgencyChapter(chapter: Hf4AgencyChapter): Promise<void> {
  if (
    chapter.version !== 'goodhands-chapter/2' ||
    !same(chapter, await prepareHf4AgencyChapter(chapter.inputs, chapter.seed))
  )
    return refuse();
}

/** Collect only declared references from the admitted history. Register external
 * entities as host world facts and action IDs as history vocabulary, never actors. */
export function portablePremises(
  authors: readonly PersonAuthoring[],
  extra?: PortableVocabulary,
): PortableVocabulary & { norms: SourcedNorm[] } {
  const actions = [...(extra?.actions ?? [])],
    sources = [...(extra?.sources ?? [])],
    entities = [...(extra?.entities ?? [])],
    norms = new Map<string, SourcedNorm>();
  for (const author of authors) {
    const portable = author.portable?.person;
    if (!portable || portable.version !== 2) continue;
    const retained = portable.retained;
    for (const norm of retained.calendar.norms) {
      const old = norms.get(norm.id);
      if (old && !same(old, norm)) return refuse();
      norms.set(norm.id, structuredClone(norm) as SourcedNorm);
    }
    sources.push(...Object.keys(retained.memory.sourceTrust));
    for (const belief of retained.memory.beliefs) {
      sources.push(...belief.sources.map((source) => source.id));
      if (belief.provenance) sources.push(belief.provenance.origin, belief.provenance.firstFrom);
    }
    for (const episode of [...retained.memory.episodes, ...retained.memory.gists]) {
      if (episode.action) actions.push(episode.action);
      if (episode.voiceId) sources.push(episode.voiceId);
      for (const id of [episode.actorId, episode.targetId, episode.placeId]) if (id) entities.push(id);
    }
    for (const contradiction of retained.memory.contradictions) sources.push(contradiction.sourceId);
    for (const commitment of retained.agenda.commitments) {
      actions.push(...commitment.actions, ...(commitment.violatedBy ?? []));
      for (const id of [commitment.toId, commitment.targetId]) if (id) entities.push(id);
    }
    for (const duty of retained.agenda.owed) actions.push(...duty.actions, ...(duty.violatedBy ?? []));
  }
  return {
    actions: unique(actions),
    sources: unique(sources),
    entities: unique(entities),
    norms: [...norms.values()],
  };
}

/** Caller proves the host departure boundary before publishing this payload. */
export function agencyHf4Transfer(state: State, id: CastKey, declared: PortableVocabulary) {
  if (!state.castPaused) throw new Error('Pause the agency chapter before saving a person.');
  const person = state.people[id];
  if (!person?.body.alive || person.now > state.now)
    throw new Error('This person is not available to depart.');
  const placements = state.placements as { candidate: string; status: string }[];
  if (
    placements.some(
      (p) => (p.candidate === id || id === 'nermin') && ['trial', 'placed', 'kept'].includes(p.status),
    )
  )
    throw new Error('End the active placement before departure.');
  if (
    (id === 'zeynep-pass' || id === 'selin-voice') &&
    !(state.guests as { id: string; status: string }[]).some(
      (guest) => guest.id === id && guest.status === 'complete',
    )
  )
    throw new Error('Finish this guest’s visit before departure.');
  const portable = portableFor(state, id);
  if (portable.version !== 2) return refuse();
  return {
    castPassport: 'hf-portable-person/2',
    portable,
    portableSkills: skillReadingsFor(state, id),
    portableVocabulary: vocabulary(declared),
    portableLimitations:
      'Supported remembered history and duties continue through HF v2. Source skills are explicit current readings rebased at arrival; the source runtime and RNG stay in the game export.',
  };
}
