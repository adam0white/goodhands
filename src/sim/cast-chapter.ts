/** Whole-cast semantic admission. Source payloads are dialects, not public biographies.
 * All clock offsets are zero-duration agency chapter maps. Life never settles duties or heals bodies.
 * General agency passports return only to this host. The live Voice Selin dialect is registered separately.
 */
import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  isContinuingCommitment,
  type Person,
  projectCalendarPersona,
  restore,
  snapshot,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import {
  canonicalPersona,
  type LifePreparation,
  lifeAdmission,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST, CAST_KEYS, type CastKey, castKey } from './cast.ts';
import { freshGuest, type GuestAdmission, prepareGuest } from './guests.ts';
import { prepareSiteSelin } from './site-selin.ts';
import type { State } from './types.ts';
import { makePeople } from './world.ts';
export interface AgencyChapter {
  version: 'goodhands-chapter/1';
  seed: number;
  inputs: LifePreparation[];
  actors: Partial<Record<CastKey, Person>>;
  guests: GuestAdmission[];
  facts: Partial<Record<CastKey, ReturnType<typeof lifeAdmission>>>;
}
const identity = (xs: string[]) => Object.fromEntries(xs.map((x) => [x, x]));
const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
export async function digest(value: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(value))),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
function projection(person: Person, offset: number) {
  const cs = person.agenda.commitments.filter((c) => isContinuingCommitment(person.agenda, c));
  const owed = person.agenda.owed ?? [];
  return projectCalendarPersona(person, {
    version: 'goodhands-agency-calendar/1',
    skills: identity(Object.keys(person.skills)),
    episodes: Object.fromEntries(
      person.memory.episodes.slice(-8).map((e) => [
        e.id,
        {
          id: e.id,
          action: e.action,
          actorId: e.actorId,
          targetId: e.targetId,
          placeId: e.placeId,
          voiceId: e.voiceId,
          tags: e.tags,
        },
      ]),
    ),
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: identity([
          ...cs.flatMap((c) => [c.id, ...(c.makeUpOf ? [c.makeUpOf] : [])]),
          ...owed.flatMap((d) => [d.ofId, ...(d.scheduledAs ? [d.scheduledAs] : [])]),
        ]),
        chains: identity(cs.flatMap((c) => (c.chain ? [c.chain] : []))),
        actions: identity([
          ...cs.flatMap((c) => [...c.actions, ...(c.violatedBy ?? [])]),
          ...owed.flatMap((d) => [...d.actions, ...(d.violatedBy ?? [])]),
        ]),
        entities: identity(cs.flatMap((c) => [c.toId, c.targetId].filter((x): x is string => !!x))),
        norms: identity(DEFAULT_NORMS.map((n) => n.id)),
      },
    },
  });
}
/** A source pause is an actual logged agency action. Live placements cannot be abandoned. */
export async function agencyTransfer(state: State, id: CastKey) {
  if (!state.castPaused) throw new Error('Pause the agency chapter before saving a person.');
  const p = state.people[id];
  if (p && p.now > state.now) throw new Error('This guest has not arrived at the current source clock.');
  if (
    (id === 'zeynep-pass' || id === 'selin-voice') &&
    !(state.guests as { id: string; status: string }[]).some((g) => g.id === id && g.status === 'complete')
  )
    throw new Error('Complete the actual guest encounter before departure.');
  if (!p?.body.alive) throw new Error('A dead person needs a terminal closure.');
  const placements = state.placements as { candidate: string; status: string }[];
  if (
    placements.some(
      (x) => (x.candidate === id || id === 'nermin') && ['trial', 'placed', 'kept'].includes(x.status),
    )
  )
    throw new Error('Release the active placement through play before departure.');
  const raw = snapshot(p);
  const agencyPerson = projection(p, 0); // HF refuses activities, unresolved projects and unsupported body state.
  return {
    castPassport: 'goodhands-agency/1',
    sourceRole: id,
    agencyPerson,
    checkpoint: {
      sourceSchema: p.schema,
      sourceNow: p.now,
      sourceRng: structuredClone(p.rng),
      checkpointDigest: await digest(raw),
    },
    limitations: [
      ...agencyPerson.person.limitations,
      'Raw source snapshot stays in the agency export. Only explicit agency calendar meanings return to this host.',
    ],
  };
}
export async function prepareAgencyChapter(inputs: LifePreparation[], seed: number): Promise<AgencyChapter> {
  if (inputs.length > 7 || new Set(inputs.map((x) => x.parent.castId)).size !== inputs.length)
    throw new Error('Invalid bounded cast batch.');
  const base = makePeople(seed);
  for (const key of ['zeynep-pass', 'selin-voice'] as const) base[key] = freshGuest(key, seed).person;
  const chapter: AgencyChapter = {
    version: 'goodhands-chapter/1',
    seed,
    inputs: structuredClone(inputs),
    actors: {},
    guests: [],
    facts: {},
  };
  for (const input of inputs) {
    const parent = await validatePersona(input.parent),
      key = castKey(parent.castId),
      cast = CAST[key];
    if (parent.terminal)
      throw new Error(
        'This person’s branch is closed. Inspect/export it or explicitly start a different story.',
      );
    if (parent.castRevision !== cast.revision)
      throw new Error('Older cast revision. Inspect/export the old head and explicitly start fresh.');
    if (!same(preparePersonaLife(parent, input.clockMs).life, input.life))
      throw new Error('Pinned life does not match its clock and parent.');
    const facts = lifeAdmission(input, 'goodhands');
    let person: Person;
    if (parent.source.game === 'voice' && key === 'selin-voice') {
      const guest =
        parent.transfer.castPassport === 'site-cast/1'
          ? prepareSiteSelin(parent)
          : await prepareGuest(parent);
      chapter.guests.push(guest);
      person = guest.person;
    } else if (parent.source.game === 'pass' && key === 'zeynep-pass') {
      const guest = await prepareGuest(parent);
      chapter.guests.push(guest);
      person = guest.person;
    } else if (
      parent.source.game === 'goodhands' &&
      parent.source.engine === '2.17.0' &&
      parent.source.rules === 'goodhands-6' &&
      parent.transfer.castPassport === 'goodhands-agency/1' &&
      parent.transfer.sourceRole === key
    ) {
      const portable = validateCalendarPersona(parent.transfer.agencyPerson),
        p = portable.person;
      const receipt = parent.transfer.checkpoint as {
        sourceSchema?: unknown;
        sourceNow?: unknown;
        sourceRng?: unknown;
        checkpointDigest?: unknown;
      };
      if (
        p.mappingVersion !== 'goodhands-agency-calendar/1' ||
        p.source.id !== key ||
        p.name !== cast.name ||
        !receipt ||
        receipt.sourceSchema !== p.source.schema ||
        receipt.sourceNow !== p.source.now ||
        !same(receipt.sourceRng, p.rng) ||
        typeof receipt.checkpointDigest !== 'string' ||
        !/^[a-f0-9]{64}$/.test(receipt.checkpointDigest)
      )
        throw new Error('Agency source identity or full-source receipt conflict.');
      if (portable.calendar.norms.some((n) => !DEFAULT_NORMS.some((k) => same(k, n))))
        throw new Error('Unsupported calendar norm meaning.');
      const opening = restore(snapshot(base[key]!));
      // Preserve the guest's local hour; the declared map changes only whole host-calendar days.
      if (key === 'selin-voice' || key === 'zeynep-pass') opening.now = 1440 + (p.source.now % 1440);
      const offset = opening.now - p.source.now;
      const age = p.source.now - p.life.bornAt;
      if (age < cast.age * 365 * 1440 || age > (cast.age + 200) * 365.25 * 1440)
        throw new Error('Canonical age conflict.');
      opening.body.fitness = p.health.fitness;
      opening.life.bornAt = p.life.bornAt + offset;
      const shifted = structuredClone(portable);
      shifted.calendar.offset = offset;
      for (const c of shifted.calendar.commitments) {
        c.from += offset;
        c.until += offset;
        if (c.recurUntil !== undefined) c.recurUntil += offset;
        if (c.exempt) c.exempt.at += offset;
      }
      for (const d of shifted.calendar.owed) {
        d.at += offset;
        if (d.lapseSince !== undefined) d.lapseSince += offset;
      }
      if (shifted.calendar.lapse) shifted.calendar.lapse.since += offset;
      opening.agenda.commitments = [];
      delete opening.agenda.owed;
      delete opening.agenda.lapse;
      person = admitCalendarPersona(shifted, opening, {
        mappingVersion: 'goodhands-agency-calendar/1',
        sourceId: key,
        targetId: key,
        targetNorms: DEFAULT_NORMS,
      }).person;
      if (key === 'zeynep-pass' || key === 'selin-voice') {
        const meta = parent.transfer.guestMetadata as Omit<GuestAdmission, 'person'> | undefined;
        if (!meta || meta.id !== key) throw new Error('Guest calendar provenance is missing.');
        const copied = structuredClone(meta) as typeof meta & { calendarDay?: number };
        delete copied.calendarDay;
        if (copied.familyHistory) {
          copied.familyHistory.from += offset;
          copied.familyHistory.until += offset;
        }
        if (copied.calendar) {
          if (offset % 1440 !== 0) throw new Error('Guest calendar day offset is not integral.');
          const host = copied.calendar.calendarHost;
          if (
            host.version !== 'voice-spring/1' ||
            !Number.isSafeInteger(host.sourceDayOffset) ||
            !Number.isSafeInteger(host.originSourceNow) ||
            !Number.isSafeInteger(host.ramadanFirstDay) ||
            !Number.isSafeInteger(host.ramadanDays) ||
            host.ramadanDays < 1 ||
            host.ramadanDays > 30
          )
            throw new Error('Unsupported guest calendar metadata.');
          copied.calendar.returnCalendarHost ??= structuredClone(host);
          host.sourceDayOffset -= offset / 1440;
        }
        chapter.guests.push({ ...copied, person });
      }
    } else
      throw new Error(
        `${cast.name}: no registered semantic adapter for ${parent.source.game}/${String(parent.transfer.castPassport ?? 'dedicated passport')}. Export the source or choose fresh local play.`,
      );
    // Actual supported Person survives admission. Coarse opportunities only affect new opening work and contacts.
    for (const event of input.life.events.filter((e) => e.kind === 'contact'))
      person.memory.episodes.push({
        id: `cast-note:${parent.branchId}:${event.slot}:${event.detail}`,
        at: person.now,
        kind: 'cast-notice',
        valence: 0,
        salience: 0.4,
        summary: `${person.name} read a public work note from ${facts.contacts.join(', ')}. No reciprocal acquaintance is recorded.`,
        tags: ['work'],
      });
    chapter.actors[key] = structuredClone(person);
    chapter.facts[key] = facts;
  }
  return chapter;
}
export async function validateAgencyChapter(chapter: AgencyChapter) {
  if (chapter.version !== 'goodhands-chapter/1') throw new Error('Unsupported agency chapter. Start fresh.');
  const rebuilt = await prepareAgencyChapter(chapter.inputs, chapter.seed);
  if (!same(chapter, rebuilt))
    throw new Error('Pinned multi-person initial state differs from source preflight.');
}
export function installAgencyChapter(state: State, chapter: AgencyChapter) {
  state.castChapter = structuredClone(chapter);
  for (const key of CAST_KEYS) {
    const actor = chapter.actors[key];
    if (actor) state.people[key] = structuredClone(actor);
    const f = chapter.facts[key];
    if (!f) continue;
    const cards = state.cards as Record<
      string,
      { arrived: number; arrivalAt?: number; met: boolean; status: string }
    >;
    const card = cards[key];
    if (card && !card.met) card.arrived += (f.startsAtHome ? 60 : 0) + (f.availableForExtraWork ? 0 : 1440);
    const guests = state.guests as { id: string; arrival: number }[];
    const guest = guests.find((g) => g.id === key);
    if (guest) guest.arrival += f.startsAtHome ? 30 : 0;
  }
}
