/** Cast admission is a new opening. HF owns retained memory and duties. */

import { exportRun } from '@adam0white/human-framework';
import { canonicalPersona, type LifePreparation } from '@adam0white/lab-client';
import { CAST_KEYS, type CastKey } from './cast.ts';
import type { GuestAdmission } from './guests.ts';
import { overrideOpening, portableVocabularyFor, runFor, saveFramework } from './hf4.ts';
import {
  agencyHf4Transfer,
  type Hf4AgencyChapter,
  prepareHf4AgencyChapter,
  validateHf4AgencyChapter,
} from './hf4-cast.ts';
import type { State } from './types.ts';
export interface AgencyChapter extends Hf4AgencyChapter {
  guests: GuestAdmission[];
}
export async function digest(value: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(value))),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function agencyTransfer(state: State, id: CastKey) {
  saveFramework(state);
  const archive = exportRun(runFor(state));
  if (
    archive.current.pending.some((request) =>
      request.kind === 'action'
        ? request.person === id
        : request.speaker === id || request.recipients.includes(id),
    )
  )
    throw new Error(
      'This person still has an unresolved action or conversation. Let it finish before departure.',
    );
  return {
    ...agencyHf4Transfer(state, id, portableVocabularyFor(state)),
    checkpoint: {
      sourceNow: state.people[id]!.now,
      sourceAtMs: archive.current.at,
      checkpointDigest: archive.hashes.full,
      sourceEngine: archive.engine,
    },
  };
}
export async function prepareAgencyChapter(inputs: LifePreparation[], seed: number): Promise<AgencyChapter> {
  return { ...(await prepareHf4AgencyChapter(inputs, seed)), guests: [] };
}
export async function validateAgencyChapter(chapter: AgencyChapter) {
  if (!Array.isArray(chapter.guests) || chapter.guests.length)
    throw new Error('This saved chapter cannot continue here. Keep the file and start fresh.');
  const { guests: _, ...body } = chapter;
  await validateHf4AgencyChapter(body);
}
export function installAgencyChapter(state: State, chapter: AgencyChapter) {
  if (chapter.version !== 'goodhands-chapter/2')
    throw new Error(
      'This older chapter lacks supported retained history. Keep the file and start a new game.',
    );
  state.castChapter = structuredClone(chapter);
  for (const key of CAST_KEYS) {
    const authored = chapter.actors[key];
    if (authored) overrideOpening(state, key, authored);
    const fact = chapter.facts[key];
    if (!fact) continue;
    const card = (state.cards as Record<string, { arrived: number; met: boolean }>)[key];
    if (card && !card.met)
      card.arrived += (fact.startsAtHome ? 60 : 0) + (fact.availableForExtraWork ? 0 : 1440);
    const guest = (state.guests as { id: string; arrival: number }[]).find((g) => g.id === key);
    if (guest) guest.arrival += fact.startsAtHome ? 30 : 0;
  }
}
