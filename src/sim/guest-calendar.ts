/** Optional Selin calendar chapter; obligations remain owned by HF agenda APIs. */
import {
  type Affordance,
  admitCalendarPersona,
  applyExemptions,
  begin,
  type CalendarPersonaSnapshot,
  calendarRetimer,
  DEFAULT_NORMS,
  decide,
  owedMakeUps,
  type Person,
  type PersonaCalendarMap,
  projectCalendarPersona,
  retimeCommitments,
  scheduleMakeUp,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import type { PersonaEnvelope } from '@adam0white/lab-client';

export interface CalendarHost {
  version: 'voice-spring/1';
  originSourceNow: number;
  sourceDayOffset: number;
  ramadanFirstDay: number;
  ramadanDays: number;
}
export interface CalendarGuest {
  calendarHost: CalendarHost;
  returnCalendarHost?: CalendarHost;
  sourceRevision: string;
  sourceCheckpointDigest: string;
}
const DAY = 1440;
function fail(message: string): never {
  throw new Error(`Good Hands calendar: ${message}`);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected object');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).sort().join(',') !== keys.sort().join(',')) fail('unsupported metadata fields');
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    fail('invalid calendar metadata');
  return value;
}
/** Caller validates envelope SHA256 and common history/checkpoint semantics before invoking this. */
export function prepareCalendarGuest(
  envelope: PersonaEnvelope,
  opening: Person,
): {
  person: Person;
  metadata: CalendarGuest;
  projection: CalendarPersonaSnapshot;
} {
  if (
    envelope.castId !== 'hf.cast.selin.voice' ||
    envelope.castRevision !== '2' ||
    envelope.source.game !== 'voice' ||
    envelope.source.rules !== 'voice-4' ||
    envelope.source.engine !== '2.17.0'
  )
    fail('unsupported source');
  const projection = validateCalendarPersona(envelope.transfer.person);
  const p = projection.person;
  if (
    p.mappingVersion !== 'voice-selin-calendar/1' ||
    p.source.id !== 'selin' ||
    p.name !== 'Selin' ||
    p.life.sex !== 'female' ||
    Object.keys(p.skills).length ||
    p.episodes.length !== 1 ||
    p.episodes[0]?.kind !== 'outcome' ||
    p.episodes[0]?.action !== 'voice-office-work' ||
    p.episodes[0]?.actorId !== 'selin-voice'
  )
    fail('unsupported Selin mapping');
  if (p.health.health !== 1 || p.health.circadianPeak !== 960) fail('health compatibility conflict');
  const age = (p.source.now - p.life.bornAt) / (365 * DAY);
  if (age < 32 || age >= 33) fail('canonical age conflict');
  const arrival = integer(envelope.transfer.targetOpening, 1440, 2879);
  if (arrival !== (p.source.now % DAY) + DAY || arrival % DAY < 1080)
    fail('after-work chapter clock conflict');
  const raw = object(envelope.transfer.calendarHost);
  exact(raw, ['version', 'originSourceNow', 'sourceDayOffset', 'ramadanFirstDay', 'ramadanDays']);
  if (raw.version !== 'voice-spring/1') fail('unsupported fictional calendar');
  const host: CalendarHost = {
    version: 'voice-spring/1',
    originSourceNow: integer(raw.originSourceNow, 0, 1e9),
    sourceDayOffset: integer(raw.sourceDayOffset, -100000, 100000),
    ramadanFirstDay: integer(raw.ramadanFirstDay, 0, 100000),
    ramadanDays: integer(raw.ramadanDays, 1, 30),
  };
  if (
    host.originSourceNow !== p.source.now ||
    host.sourceDayOffset !== Math.floor(p.source.now / DAY) - Math.floor(arrival / DAY) ||
    projection.calendar.offset !== arrival - p.source.now
  )
    fail('calendar provenance/offset conflict');
  const checkpoint = object(envelope.transfer.checkpoint);
  const digest = checkpoint.checkpointDigest;
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) fail('checkpoint digest missing');
  const target = structuredClone(opening);
  target.now = arrival;
  target.life.bornAt = p.life.bornAt + arrival - p.source.now;
  target.body.fitness = p.health.fitness;
  // Only the new authored target calendar is empty. No source calendar is altered.
  target.agenda.commitments = [];
  delete target.agenda.owed;
  delete target.agenda.lapse;
  const person = admitCalendarPersona(projection, target, {
    mappingVersion: 'voice-selin-calendar/1',
    sourceId: 'selin',
    targetId: 'selin-voice',
    targetNorms: DEFAULT_NORMS,
  }).person;
  for (const c of person.agenda.commitments)
    if (
      c.kind === 'promise' ||
      c.kind === 'duty' ||
      (c.kind === 'job' && c.actions.join(',') !== 'voice-office-work')
    )
      fail('unsupported role commitment');
  if (person.agenda.owed?.some((d) => !['abstain', 'worship'].includes(d.kind)))
    fail('unsupported owed calendar meaning');
  returnReferences(person);
  return {
    person,
    projection,
    metadata: { calendarHost: host, sourceRevision: envelope.revision, sourceCheckpointDigest: digest },
  };
}
/** Single declared fiction used with HF calendarRetimer; no astronomical or religious inference. */
export function guestSpringCalendar(host: CalendarHost, day: number) {
  const d = day + host.sourceDayOffset;
  return {
    fajr: 300 - d,
    sunrise: 390 - d,
    dhuhr: 750,
    asr: 960 + Math.floor(d / 2),
    maghrib: 1125 + d,
    isha: 1215 + d,
  };
}
/** Explicit namespaces for every calendar/debt cross-reference; HF selects retained records itself. */
function returnReferences(person: Person): PersonaCalendarMap['references'] {
  const refs: PersonaCalendarMap['references'] = {
    commitments: {},
    chains: {},
    actions: {},
    entities: {},
    norms: {},
  };
  const commitment = (id: string) => {
    refs.commitments[id] = `goodhands-return:${id}`;
  };
  const action = (id: string) => {
    const supported = ['voice-office-work', 'eat', 'drink', 'tea', 'pray', 'pray-qada', 'pray-eid'];
    if (!supported.includes(id)) fail(`unsupported calendar action ${id}`);
    refs.actions[id] = id === 'voice-office-work' ? 'work' : id;
  };
  const entity = (id: string) => {
    if (!['self', 'selin-voice', 'god'].includes(id) && !DEFAULT_NORMS.some((n) => n.id === id))
      fail(`unsupported calendar entity ${id}`);
    refs.entities[id] = id === 'selin-voice' ? 'selin' : id;
  };
  for (const c of person.agenda.commitments) {
    commitment(c.id);
    if (c.makeUpOf) commitment(c.makeUpOf);
    c.actions.forEach(action);
    c.violatedBy?.forEach(action);
    if (c.toId) entity(c.toId);
    if (c.targetId) entity(c.targetId);
    if (c.chain) {
      if (c.chain !== 'voice-office' && !c.chain.startsWith('sawm:') && !c.chain.startsWith('salah:'))
        fail('unsupported calendar chain');
      refs.chains[c.chain] = c.chain === 'voice-office' ? 'job' : c.chain;
    }
  }
  for (const owed of person.agenda.owed ?? []) {
    commitment(owed.ofId);
    if (owed.scheduledAs) commitment(owed.scheduledAs);
    owed.actions.forEach(action);
    owed.violatedBy?.forEach(action);
  }
  for (const norm of DEFAULT_NORMS) refs.norms[norm.id] = norm.id;
  return refs;
}
/** Source revision/checkpoint binding remains outside this strict HF wrapper. */
export function returnCalendarGuest(
  person: Person,
  episodeId: string,
  metadata: CalendarGuest,
): {
  projection: CalendarPersonaSnapshot;
  targetOpening: number;
  calendarHost: CalendarHost;
  sourceRevision: string;
  sourceCheckpointDigest: string;
} {
  const episode = person.memory.episodes.find((e) => e.id === episodeId);
  if (!episode || episode.actorId !== 'nermin' || episode.targetId !== 'selin-voice')
    fail('actual received Nermin answer required');
  const targetOpening = (metadata.returnCalendarHost ?? metadata.calendarHost).originSourceNow;
  const projection = projectCalendarPersona(person, {
    version: 'goodhands-selin-calendar/1',
    skills: {},
    episodes: {
      [episodeId]: {
        id: 'goodhands-enquiry-answer',
        action: 'selin-enquiry',
        actorId: 'nermin-goodhands',
        targetId: 'selin',
        ...(episode.placeId ? { placeId: 'goodhands-agency' } : {}),
        ...(episode.voiceId ? { voiceId: 'nermin-goodhands' } : {}),
        tags: [],
      },
    },
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset: targetOpening - person.now,
      references: returnReferences(person),
      sourceNorms: DEFAULT_NORMS,
    },
  });
  return {
    projection,
    targetOpening,
    ...structuredClone(metadata),
    calendarHost: structuredClone(metadata.returnCalendarHost ?? metadata.calendarHost),
  };
}

/** Ordinary host dates; HF alone owns recurrence, exemption, owed scheduling and fulfillment. */
export function maintainCalendarGuest(person: Person, host: CalendarHost, lastScheduledDay?: number): number {
  const day = Math.floor(person.now / DAY);
  const calendar = (d: number) => guestSpringCalendar(host, d);
  const retimer = calendarRetimer(calendar);
  retimeCommitments(person, person.now, (c) => {
    if (c.kind === 'job' && c.chain === 'voice-office') {
      const d = Math.floor(c.from / DAY);
      return { from: d * DAY + 540, until: d * DAY + 1080 };
    }
    return retimer(c);
  });
  applyExemptions(person, person.now, { catalog: DEFAULT_NORMS });
  if (lastScheduledDay === day) return day;
  // Preserve paid owed records and their actual kept receipts until return; no cleanup erases proof.
  const reserved = new Set(
    person.agenda.commitments
      .filter((c) => c.makeUpOf && c.kind === 'abstain' && c.status === 'pending')
      .map((c) => Math.floor(c.from / DAY)),
  );
  let nextFast = Math.max(day + 1, host.ramadanFirstDay + host.ramadanDays + 1 - host.sourceDayOffset);
  let qada = 0;
  for (const owed of owedMakeUps(person)) {
    if (owed.kind === 'worship') {
      if (qada++ >= 2) continue;
      const today = calendar(day);
      const d = day * DAY + today.asr - 15 <= person.now ? day + 1 : day;
      const times = calendar(d);
      scheduleMakeUp(
        person,
        owed.ofId,
        { from: d * DAY + times.dhuhr + 15, until: d * DAY + times.asr - 15 },
        { importance: 0.3, actions: ['pray-qada'] },
      );
    } else if (owed.kind === 'abstain') {
      while (reserved.has(nextFast)) nextFast++;
      const d = nextFast++;
      reserved.add(d);
      const times = calendar(d);
      scheduleMakeUp(person, owed.ofId, { from: d * DAY + times.fajr, until: d * DAY + times.maghrib });
    } else fail('unsupported owed calendar meaning');
  }
  applyExemptions(person, person.now, { catalog: DEFAULT_NORMS });
  return day;
}
/** Quiet alternatives use the same food/drink/work meanings as Voice; a host never starts a rejected offer. */
export function startCalendarRoutine(person: Person): void {
  if (person.activity) return;
  const minute = person.now % DAY;
  const future = person.agenda.commitments
    .filter((c) => c.status === 'pending' && c.kind !== 'abstain' && c.from > person.now)
    .map((c) => c.from - person.now);
  const alarm = Math.min(...future, minute < 480 ? 480 - minute : DAY + 480 - minute);
  const night = minute >= 1260 || minute < 480;
  const offers: Affordance[] = [
    {
      id: 'calendar-rest',
      action: 'rest',
      label: 'Rest at home',
      duration: 30,
      effort: 0,
      advertises: { rest: 0.25, leisure: 0.1 },
    },
    {
      id: 'calendar-eat',
      action: 'eat',
      label: 'Eat at home',
      duration: 30,
      effort: 0.1,
      advertises: { food: 0.6 },
    },
    {
      id: 'calendar-drink',
      action: 'drink',
      label: 'Drink water',
      duration: 5,
      effort: 0.02,
      advertises: { water: 0.6 },
    },
    {
      id: 'calendar-sleep',
      action: 'sleep',
      label: 'Sleep at home',
      duration: night ? Math.max(1, Math.min(480, alarm)) : 30,
      mode: 'sleep',
      effort: 0,
      advertises: { sleep: 0.8, rest: 0.4 },
    },
  ];
  for (const c of person.agenda.commitments) {
    if (
      c.status !== 'pending' ||
      c.kind === 'abstain' ||
      c.from > person.now ||
      c.until <= person.now ||
      !c.actions.length
    )
      continue;
    const action = c.actions[0]!;
    const duration =
      action === 'voice-office-work'
        ? c.until - person.now
        : Math.min(action === 'eat' ? 30 : 20, c.until - person.now);
    offers.push({
      id: `calendar-duty:${c.id}`,
      action,
      label: c.label ?? action,
      duration,
      effort: 0.1,
      ...(c.targetId ? { targetId: c.targetId } : {}),
      fulfills: [c.id],
      ...(c.normId ? { norms: [{ normId: c.normId, relation: 'fulfills' as const }] } : {}),
      advertises:
        action === 'voice-office-work'
          ? { competence: 0.2, esteem: 0.1 }
          : action === 'eat'
            ? { food: 0.6 }
            : { meaning: 0.1 },
    });
  }
  const decision = decide(person, offers);
  const chosen = offers.find((a) => a.id === decision.chosenAffordanceId);
  if (chosen) begin(person, chosen, decision);
}
