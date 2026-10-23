import type { CalendarPersonaSnapshot } from '@adam0white/human-framework';
import {
  type Affordance,
  admitPersona,
  advanceAgenda,
  begin,
  createPerson,
  decide,
  finish,
  type Person,
  type PersonaProjectionSnapshot,
  perceive,
  projectPersona,
  promise,
  readPerson,
  snapshot,
  successChance,
  tick,
  validatePersonaProjection,
} from '@adam0white/human-framework';
import { canonicalPersona, validatePersona } from '@adam0white/lab-client';
import { castProfile } from './cast.ts';
import {
  type CalendarGuest,
  maintainCalendarGuest,
  prepareCalendarGuest,
  returnCalendarGuest,
  startCalendarRoutine,
} from './guest-calendar.ts';
import type { Input, LogEntry, State } from './types.ts';

export type GuestId = 'zeynep-pass' | 'selin-voice';
export type GuestAction = 'offer-trial' | 'decline' | 'ask-service' | 'end-enquiry';
export interface GuestHistory {
  id: string;
  summary: string;
  at: number;
  sourceGame: string;
  sourceEpisodeId: string;
}
export interface GuestAdmission {
  id: GuestId;
  person: Person;
  arm: 'fresh' | 'biography' | 'continuing';
  history: GuestHistory[];
  familyHistory?: { status: 'kept' | 'broken'; from: number; until: number };
  calendar?: CalendarGuest;
}
export interface GuestView {
  id: GuestId;
  name: string;
  status: 'expected' | 'available' | 'working' | 'complete';
  text: string;
  choices: { action: GuestAction; label: string; disabled?: string }[];
  trial?: { verdict: string; chance?: number; succeeded?: boolean };
}
interface Guest extends Omit<GuestAdmission, 'person'> {
  status: GuestView['status'];
  arrival: number;
  text: string;
  trial?: GuestView['trial'];
  encounterEpisode?: string;
  routine?: string;
  calendarDay?: number;
  pendingEnquiry?: 'ask-service' | 'end-enquiry';
}
interface GuestState extends State {
  guests: Guest[];
}
const DAY = 1440;
const IDENTITY = {
  'zeynep-pass': {
    name: 'Zeynep',
    age: 45,
    cast: 'hf.cast.zeynep.pass',
    source: 'pass',
    mapping: 'pass-zeynep/1',
  },
  'selin-voice': {
    name: 'Selin',
    age: 32,
    cast: 'hf.cast.selin.voice',
    source: 'voice',
    mapping: 'voice-selin/1',
  },
} as const;
const clone = <T>(x: T): T => structuredClone(x);
const local = (at: number) => ((at % DAY) + DAY) % DAY;
function fail(message: string): never {
  throw new Error(`Good Hands guest: ${message}`);
}
function record(s: State, text: string, kind: LogEntry['kind'] = 'word') {
  const log = s.log as LogEntry[];
  log.push({ id: log.length + 1, at: s.now, kind, text });
}
function family(p: Person) {
  return promise(p, {
    kind: 'promise',
    toId: 'sons',
    targetId: 'home',
    actions: ['leave-for-home'],
    from: Math.floor(p.now / DAY) * DAY + 1290,
    until: Math.floor(p.now / DAY) * DAY + 1330,
    importance: 0.7,
    recurEvery: DAY,
    chain: 'pass-family',
    label: 'Home with my sons',
  });
}
function office(p: Person) {
  const d = Math.floor(p.now / DAY) + (local(p.now) >= 1080 ? 1 : 0);
  return promise(p, {
    kind: 'job',
    actions: ['voice-office-work'],
    from: d * DAY + 540,
    until: d * DAY + 1080,
    importance: 0.8,
    recurEvery: DAY,
    chain: 'voice-office-job',
    label: 'Office work',
  });
}
export function freshGuest(id: GuestId, seed = 1): GuestAdmission {
  const info = IDENTITY[id];
  // An authored zero-duration chapter opening, before the guest's first visible encounter.
  const now = DAY + (id === 'zeynep-pass' ? 570 : 1081);
  const person = createPerson({
    id,
    name: info.name,
    seed,
    now,
    bornAt: now - info.age * 365.25 * DAY,
    sex: 'female',
    ...castProfile(id),
    skills: id === 'zeynep-pass' ? { cold: 0.7 } : {},
    voices: [{ voiceId: 'nermin', trust: 0.5 }],
  });
  if (id === 'zeynep-pass') family(person);
  else office(person);
  return { id, person, arm: 'fresh', history: [] };
}
function checkCommitments(projection: PersonaProjectionSnapshot, id: GuestId, opening: number) {
  if (projection.commitments.length !== 1) fail('exactly one supported recurring obligation required');
  const c = projection.commitments[0]!;
  const z = id === 'zeynep-pass';
  const action = z ? 'leave-for-home' : 'voice-office-work';
  if (
    c.kind !== (z ? 'promise' : 'job') ||
    c.status !== 'pending' ||
    c.recurEvery !== DAY ||
    c.importance !== (z ? 0.7 : 0.8) ||
    c.actions.length !== 1 ||
    c.actions[0] !== action ||
    local(c.from) !== (z ? 1290 : 540) ||
    local(c.until) !== (z ? 1330 : 1080) ||
    c.until - c.from !== (z ? 40 : 540) ||
    c.until < opening ||
    (z && (c.toId !== 'sons' || c.targetId !== undefined)) ||
    (!z && (c.toId !== undefined || c.targetId !== undefined))
  )
    fail('unsupported obligation mapping');
}
function history(value: unknown): GuestHistory[] {
  if (!Array.isArray(value) || value.length > 8) fail('invalid history');
  return value.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      Object.keys(row).sort().join(',') !== 'at,id,sourceEpisodeId,sourceGame,summary'
    )
      fail('invalid history fields');
    const r = row as GuestHistory;
    for (const k of ['id', 'summary', 'sourceGame', 'sourceEpisodeId'] as const)
      if (typeof r[k] !== 'string' || !r[k].length || r[k].length > (k === 'summary' ? 512 : 128))
        fail('invalid history text');
    if (!Number.isFinite(r.at)) fail('invalid history time');
    return clone(r);
  });
}
/** Validate portable semantics before the caller claims the shelf head. No source save enters live state. */
export async function prepareGuest(input: unknown): Promise<GuestAdmission> {
  const envelope = await validatePersona(input);
  const id = (Object.keys(IDENTITY) as GuestId[]).find((key) => IDENTITY[key].cast === envelope.castId);
  if (!id || envelope.castRevision !== '1') fail('unsupported cast revision');
  const info = IDENTITY[id];
  if (envelope.source.game !== info.source || envelope.source.engine !== '2.14.1') fail('unsupported source');
  if (
    id === 'selin-voice' &&
    (envelope.transfer.person as { format?: string } | undefined)?.format === 'hf-persona-calendar/1'
  ) {
    if (
      Object.keys(envelope.transfer).some(
        (key) => !['person', 'history', 'checkpoint', 'calendarHost', 'targetOpening'].includes(key),
      )
    )
      fail('unsupported calendar transfer fields');
    const admitted = prepareCalendarGuest(envelope, freshGuest(id).person);
    const p = admitted.projection.person;
    const facts = history(envelope.transfer.history);
    if (
      facts.length !== 1 ||
      facts.some(
        (f) =>
          f.sourceGame !== 'voice' ||
          f.at > p.source.now ||
          f.id !== p.episodes[0]!.id ||
          f.summary !== p.episodes[0]!.summary ||
          f.at !== p.episodes[0]!.at,
      )
    )
      fail('unsupported source history');
    const checkpoint = envelope.transfer.checkpoint as Record<string, unknown> | undefined;
    if (
      !checkpoint ||
      Object.keys(checkpoint).sort().join(',') !== 'checkpointDigest,sourceNow,sourceRng,sourceSchema' ||
      checkpoint.sourceSchema !== p.source.schema ||
      checkpoint.sourceNow !== p.source.now ||
      canonicalPersona(checkpoint.sourceRng) !== canonicalPersona(p.rng)
    )
      fail('missing source checkpoint provenance');
    return { id, person: admitted.person, arm: 'continuing', history: facts, calendar: admitted.metadata };
  }
  if (
    Object.keys(envelope.transfer).some(
      (key) =>
        !['person', 'history', 'checkpoint', 'admission', 'targetOpening', 'familyHistory'].includes(key),
    )
  )
    fail('unsupported transfer fields');
  if (envelope.source.game === 'pass' && !['pass-12', '12'].includes(envelope.source.rules))
    fail('unsupported source edition');
  if (envelope.source.game === 'voice' && envelope.source.rules !== 'voice-3')
    fail('unsupported source edition');
  const p = validatePersonaProjection(envelope.transfer.person);
  if (
    p.mappingVersion !== info.mapping ||
    p.source.id !== (id === 'zeynep-pass' ? 'zeynep' : 'selin') ||
    p.name !== info.name ||
    p.life.sex !== 'female'
  )
    fail('identity or mapping conflict');
  if (Object.keys(p.skills).sort().join(',') !== (id === 'zeynep-pass' ? 'cold' : ''))
    fail('unsupported skill mapping');
  if (p.episodes.length !== 1) fail('one attended source fact required');
  if (p.episodes.some((e) => e.voiceId === 'nermin' || e.actorId === 'nermin'))
    fail('source cannot grant Nermin prior history');
  const sourceClock = local(p.source.now);
  if (id === 'selin-voice' && sourceClock < 1080) fail('enquiry requires after-work source boundary');
  // Preserve local clock and exact source age. Whole-day offset models no travel or recovery.
  const age = (p.source.now - p.life.bornAt) / (365 * DAY);
  if (age < info.age || age >= info.age + 1) fail('unsupported canonical age');
  const arrivalPolicy = envelope.transfer.admission as Record<string, unknown> | undefined;
  if (
    arrivalPolicy &&
    (Object.keys(arrivalPolicy).some((key) => !['adapter', 'targetOpening', 'familyHistory'].includes(key)) ||
      arrivalPolicy.adapter !== info.mapping)
  )
    fail('unsupported source admission policy');
  const now = arrivalPolicy?.targetOpening ?? envelope.transfer.targetOpening;
  if (
    typeof now !== 'number' ||
    !Number.isInteger(now) ||
    now < 510 ||
    now > 3 * DAY ||
    local(now) !== sourceClock
  )
    fail('unsupported target opening');
  if (p.health.health !== 1 || p.health.circadianPeak !== 960) fail('health compatibility conflict');
  const base = freshGuest(id).person;
  base.now = now;
  // Exercise-related fitness is portable stable state, not clinical healing.
  base.body.fitness = p.health.fitness;
  base.life.bornAt = p.life.bornAt + now - p.source.now;
  base.agenda.commitments = [];
  checkCommitments(p, id, now);
  const person = admitPersona(p, base, {
    mappingVersion: info.mapping,
    sourceId: p.source.id,
    targetId: id,
  }).person;
  const facts = history(envelope.transfer.history);
  const retained = p.episodes[0]!;
  if (
    facts.length !== 1 ||
    facts.some(
      (fact) =>
        fact.sourceGame !== info.source ||
        fact.at > p.source.now ||
        fact.id !== retained.id ||
        fact.summary !== retained.summary ||
        fact.at !== retained.at,
    )
  )
    fail('unsupported source history');
  const checkpoint = envelope.transfer.checkpoint as Record<string, unknown> | undefined;
  if (
    !checkpoint ||
    Object.keys(checkpoint).sort().join(',') !== 'checkpointDigest,sourceNow,sourceRng,sourceSchema' ||
    checkpoint.sourceSchema !== p.source.schema ||
    checkpoint.sourceNow !== p.source.now ||
    canonicalPersona(checkpoint.sourceRng) !== canonicalPersona(p.rng) ||
    typeof checkpoint.checkpointDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(checkpoint.checkpointDigest)
  )
    fail('missing source checkpoint provenance');
  let familyHistory: GuestAdmission['familyHistory'];
  if (id === 'zeynep-pass') {
    const old = (arrivalPolicy?.familyHistory ??
      envelope.transfer.familyHistory) as GuestAdmission['familyHistory'];
    if (
      !old ||
      Object.keys(old).sort().join(',') !== 'from,status,until' ||
      !['kept', 'broken'].includes(old.status) ||
      !Number.isFinite(old.from) ||
      !Number.isFinite(old.until) ||
      local(old.from) !== 1290 ||
      local(old.until) !== 1330 ||
      old.until - old.from !== 40 ||
      old.until > p.source.now
    )
      fail('unsupported family history');
    familyHistory = {
      status: old.status,
      from: old.from + now - p.source.now,
      until: old.until + now - p.source.now,
    };
  } else if (envelope.transfer.familyHistory !== undefined) fail('unsupported family history');
  return { id, person, arm: 'continuing', history: facts, ...(familyHistory ? { familyHistory } : {}) };
}
export function initGuests(state: State, admissions: GuestAdmission[]) {
  const supplied = new Map(admissions.map((a) => [a.id, a]));
  if (supplied.size !== admissions.length) fail('duplicate admission');
  const guests: Guest[] = [];
  for (const id of Object.keys(IDENTITY) as GuestId[]) {
    const admission = clone(supplied.get(id) ?? freshGuest(id, state.seed));
    if (admission.person.id !== id || admission.person.name !== IDENTITY[id].name)
      fail('invalid pinned admission');
    state.people[id] = admission.person;
    const { person, ...fields } = admission;
    let arrival = Math.max(DAY + (id === 'zeynep-pass' ? 570 : 1081), person.now);
    if (id === 'zeynep-pass' && local(arrival) > 960) arrival = (Math.floor(arrival / DAY) + 1) * DAY + 570;
    guests.push({ ...fields, status: 'expected', arrival, text: '' });
  }
  (state as GuestState).guests = guests;
}
function offer(id: string, action: string, duration: number, extra: Partial<Affordance> = {}): Affordance {
  return { id, action, label: action, duration, effort: 0.1, advertises: {}, ...extra };
}
function startRoutine(p: Person, a: Affordance) {
  const decision = decide(p, [a]);
  begin(p, a, decision);
}
function attendAnswer(p: Person, text: string): string | undefined {
  const before = new Set(p.memory.episodes.map((e) => e.id));
  perceive(p, [
    {
      kind: 'speech',
      channel: 'told',
      at: p.now,
      actorId: 'nermin',
      targetId: p.id,
      valence: 0,
      salience: 1,
      summary: text,
    },
  ]);
  return p.memory.episodes.findLast((e) => !before.has(e.id))?.id;
}
export function stepGuests(state: State) {
  const s = state as GuestState;
  for (const g of s.guests ?? []) {
    const p = s.people[g.id]!;
    if (s.now < p.now) continue;
    if (g.calendar) g.calendarDay = maintainCalendarGuest(p, g.calendar.calendarHost, g.calendarDay);
    if (p.activity && s.now >= p.activity.endsAt) {
      const a = p.activity.affordance;
      tick(p, p.activity.endsAt);
      const trial = a.action === 'cold-food-trial';
      finish(p, {
        affordanceId: a.id,
        action: a.action,
        at: p.now,
        status: 'completed',
        ...(trial ? { quality: g.trial?.succeeded ? 1 : 0.25 } : {}),
        needs: g.calendar
          ? a.action === 'eat'
            ? { food: 0.6 }
            : a.action === 'drink'
              ? { water: 0.6 }
              : a.action === 'rest'
                ? { rest: 0.25, leisure: 0.1 }
                : {}
          : a.action === 'eat'
            ? { food: 0.8, water: 0.8 }
            : a.action === 'sleep'
              ? { sleep: 0.8 }
              : {},
        summary: trial
          ? `Prepared the cold supper: ${g.trial?.succeeded ? 'ready as agreed' : 'needed correction'}.`
          : a.label,
      });
      advanceAgenda(p, p.now);
      if (trial) {
        g.status = 'complete';
        g.encounterEpisode = p.memory.episodes.at(-1)?.id;
        g.text = `The daytime cold-supper preparation is finished. ${g.trial?.succeeded ? 'The cold dishes were ready as agreed.' : 'The cold dishes needed correction.'} Nermin released this guest duty. Zeynep still keeps her daily family window.`;
        const account = `Nermin: The household reports that the cold dishes ${g.trial?.succeeded ? 'were ready as agreed' : 'needed correction'}. Your short trial is finished; you have no further agency duty.`;
        // A bounded account of this host-resolved trial, heard by the cook herself.
        g.encounterEpisode = attendAnswer(p, account) ?? g.encounterEpisode;
        record(s, account);
      }
    }
    tick(p, s.now);
    advanceAgenda(p, s.now);
    if (g.status === 'expected' && s.now >= g.arrival) {
      g.status = 'available';
      g.text =
        g.id === 'zeynep-pass'
          ? 'Zeynep, 45, spent twenty years in a school canteen. This short daytime stint is within reach of home and her sons. She offers cold-supper preparation only. She leaves for home at 21:30.'
          : 'Selin phones after office work about practical help for her father Halil in his Anatolian town. Nermin must check whether a suitable service reaches his address. This is an enquiry.';
      if (g.history.length) g.text += ` Her retained account: “${g.history.at(-1)!.summary}”`;
      record(s, `${IDENTITY[g.id].name}: ${g.text}`, 'arrival');
    }
    if (p.activity) continue;
    const t = local(s.now);
    if (g.calendar) {
      g.calendarDay = maintainCalendarGuest(p, g.calendar.calendarHost, g.calendarDay);
      if (g.pendingEnquiry && t >= 1080 && t < 1260) {
        const answer = g.pendingEnquiry;
        delete g.pendingEnquiry;
        answerEnquiry(s, g, p, answer);
      } else startCalendarRoutine(p);
      continue;
    }
    const obligation = p.agenda.commitments.find(
      (c) => c.status === 'pending' && c.from <= s.now && c.until > s.now,
    );
    if (obligation) {
      const z = g.id === 'zeynep-pass';
      startRoutine(
        p,
        offer(
          z ? 'guest-home' : 'guest-office',
          z ? 'leave-for-home' : 'voice-office-work',
          obligation.until - s.now,
          {
            targetId: z ? 'home' : undefined,
            placeId: z ? 'home' : 'voice-office',
            fulfills: [obligation.id],
          },
        ),
      );
    } else if (t === 480 || t === 1110) {
      startRoutine(p, offer('guest-meal', 'eat', 20, { advertises: { food: 0.8, water: 0.8 } }));
    } else if (t === 1350) {
      startRoutine(p, offer('guest-sleep', 'sleep', 570, { mode: 'sleep', advertises: { sleep: 0.8 } }));
    }
  }
}
function answerEnquiry(s: GuestState, g: Guest, p: Person, action: 'ask-service' | 'end-enquiry') {
  const text =
    action === 'ask-service'
      ? 'Nermin: I cannot confirm a suitable service reaches your father’s address. We have made no placement. Please check local availability and ask him what help he wants.'
      : 'Nermin: We have ended the enquiry without arranging help. Your father has not agreed to a service.';
  g.encounterEpisode = attendAnswer(p, text);
  g.text = text;
  g.status = 'complete';
  record(s, `Selin heard ${text}`);
}
export function applyGuest(state: State, input: Extract<Input, { type: 'guest-action' }>) {
  const s = state as GuestState;
  const g = s.guests?.find((row) => row.id === input.guest);
  if (!g || g.status !== 'available') return;
  const p = s.people[g.id]!;
  const t = local(s.now);
  if (g.id === 'zeynep-pass' && input.action === 'offer-trial') {
    if (t < 540 || t > 960 || p.activity) return;
    const a = offer('cold-supper-trial', 'cold-food-trial', 90, {
      skill: { id: 'cold', difficulty: 0.65 },
      advertises: { competence: 0.45 },
      tags: ['work'],
    });
    const rest = offer('guest-wait', 'rest', 15, { advertises: { leisure: 0.05 } });
    const decision = decide(p, [a, rest], {
      suggestion: { voiceId: 'nermin', affordanceId: a.id, strength: 0.7, appeal: 'achievement' },
    });
    const verdict = decision.suggestion?.verdict ?? 'refused';
    g.trial = { verdict };
    if (verdict !== 'assented') {
      g.text = `Zeynep ${verdict === 'deferred' ? 'asks to wait' : 'does not agree to this trial'}. Nermin accepts her answer.`;
      record(s, g.text);
      return;
    }
    const chance = successChance(p, 'cold', 0.65, readPerson(p).body.capacity);
    // Matched seeds share this event draw across all three comparison arms.
    const draw = eventRoll(s.seed, 'zeynep-cold-trial');
    g.trial = { verdict, chance, succeeded: draw < chance };
    promise(p, {
      kind: 'duty',
      actions: ['cold-food-trial'],
      from: s.now,
      until: s.now + 90,
      importance: 0.6,
      label: 'Short cold-supper trial',
    });
    begin(p, a, decision);
    g.status = 'working';
    g.text = 'Zeynep agreed to the ninety-minute cold-supper preparation. Her family window stays free.';
    record(s, g.text);
  } else if (g.id === 'selin-voice' && (input.action === 'ask-service' || input.action === 'end-enquiry')) {
    if (t < 1080 || (!g.calendar && p.activity)) return;
    if (g.calendar && p.activity) {
      if (g.pendingEnquiry) return;
      g.pendingEnquiry = input.action;
      g.text = `Selin is finishing ${p.activity.affordance.label.toLowerCase()}. Nermin will reply when she is free.`;
      record(s, g.text);
      return;
    }
    answerEnquiry(s, g, p, input.action);
  } else if (g.id === 'zeynep-pass' && input.action === 'decline') {
    g.text = 'Nermin declined the guest trial. No placement took place.';
    g.status = 'complete';
    g.encounterEpisode = attendAnswer(p, g.text);
    record(s, g.text);
  }
}
function eventRoll(seed: number, event: string) {
  let h = 2166136261;
  for (const c of `${seed}:${event}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
export function guestViews(state: State): GuestView[] {
  return ((state as GuestState).guests ?? [])
    .filter((g) => g.status !== 'expected')
    .map((g) => ({
      id: g.id,
      name: IDENTITY[g.id].name,
      status: g.status,
      text: g.text,
      ...(g.trial ? { trial: clone(g.trial) } : {}),
      choices:
        g.status !== 'available'
          ? []
          : g.id === 'zeynep-pass'
            ? [
                {
                  action: 'offer-trial',
                  label: 'Offer a short cold-supper trial',
                  ...(local(state.now) > 960 || state.people[g.id]!.activity
                    ? { disabled: 'A daytime trial needs ninety free minutes.' }
                    : {}),
                },
                { action: 'decline', label: 'Decline the guest trial' },
              ]
            : [
                {
                  action: 'ask-service',
                  label:
                    g.calendar && state.people[g.id]?.activity
                      ? 'Reply after Selin finishes'
                      : 'Check the limits of this enquiry',
                  ...(local(state.now) < 1080 ||
                  (g.calendar ? !!g.pendingEnquiry : state.people[g.id]?.activity)
                    ? {
                        disabled: g.pendingEnquiry
                          ? 'Nermin’s reply is waiting until Selin finishes.'
                          : 'Selin can speak after office work, from 18:00.',
                      }
                    : {}),
                },
                {
                  action: 'end-enquiry',
                  label: 'End without a placement',
                  ...(local(state.now) < 1080 ||
                  (g.calendar ? !!g.pendingEnquiry : state.people[g.id]?.activity)
                    ? {
                        disabled: g.pendingEnquiry
                          ? 'Nermin’s reply is waiting until Selin finishes.'
                          : 'Selin can speak after office work, from 18:00.',
                      }
                    : {}),
                },
              ],
    }));
}
export async function exportGuest(
  state: State,
  id: GuestId,
): Promise<{
  projection: PersonaProjectionSnapshot | CalendarPersonaSnapshot;
  targetOpening?: number;
  calendarHost?: CalendarGuest['calendarHost'];
  sourceRevision?: string;
  sourceCheckpointDigest?: string;
  checkpoint: {
    sourceSchema: Person['schema'];
    sourceNow: number;
    sourceRng: Person['rng'];
    checkpointDigest: string;
  };
  history: GuestHistory[];
}> {
  const g = (state as GuestState).guests?.find((row) => row.id === id);
  if (!g || g.status !== 'complete' || !g.encounterEpisode)
    fail('an attended completed encounter is required');
  const p = state.people[id]!;
  const z = id === 'zeynep-pass';
  if (g.calendar) {
    const returned = returnCalendarGuest(p, g.encounterEpisode, g.calendar);
    const e = p.memory.episodes.find((e) => e.id === g.encounterEpisode)!;
    const bytes = new TextEncoder().encode(canonicalPersona(snapshot(p)));
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    return {
      ...returned,
      checkpoint: {
        sourceSchema: p.schema,
        sourceNow: p.now,
        sourceRng: clone(p.rng),
        checkpointDigest: digest,
      },
      history: [
        ...g.history,
        {
          id: 'goodhands-encounter',
          summary: e.summary,
          at: e.at,
          sourceGame: 'goodhands',
          sourceEpisodeId: e.id,
        },
      ].slice(-8),
    };
  }
  const bindings: Record<
    string,
    {
      id: string;
      actions: string[];
      from: number;
      until: number;
      toId?: string;
      targetId?: string;
      chain?: string;
    }
  > = {};
  for (const c of p.agenda.commitments.filter((c) => c.status === 'pending')) {
    const supported = z ? c.actions[0] === 'leave-for-home' : c.actions[0] === 'voice-office-work';
    if (!supported) fail('unreleased guest duty');
    bindings[c.id] = {
      id: c.id,
      actions: [z ? 'home' : 'work'],
      from: c.from,
      until: c.until,
      ...(c.toId ? { toId: c.toId } : {}),
      ...(c.targetId ? { targetId: c.targetId } : {}),
      ...(c.chain ? { chain: c.chain } : {}),
    };
  }
  const e = p.memory.episodes.find((episode) => episode.id === g.encounterEpisode);
  if (!e) fail('encounter episode no longer retained');
  const personReference = (reference: string): string => {
    if (reference === 'nermin') return 'nermin-goodhands';
    if (reference === id) return z ? 'zeynep' : 'selin';
    return fail(`unsupported encounter person reference ${reference}`);
  };
  const projection = projectPersona(p, {
    version: z ? 'goodhands-zeynep/1' : 'goodhands-selin/1',
    skills: z ? { cold: 'cold' } : {},
    commitments: bindings,
    episodes: {
      [e.id]: {
        id: 'goodhands-encounter',
        ...(e.action ? { action: z ? 'cold' : 'selin-enquiry' } : {}),
        ...(e.actorId ? { actorId: personReference(e.actorId) } : {}),
        ...(e.targetId ? { targetId: personReference(e.targetId) } : {}),
        ...(e.placeId ? { placeId: 'goodhands-agency' } : {}),
        ...(e.voiceId ? { voiceId: personReference(e.voiceId) } : {}),
        tags: [],
      },
    },
  });
  const bytes = new TextEncoder().encode(canonicalPersona(snapshot(p)));
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  return {
    projection,
    checkpoint: {
      sourceSchema: p.schema,
      sourceNow: p.now,
      sourceRng: clone(p.rng),
      checkpointDigest: digest,
    },
    history: [
      ...g.history,
      {
        id: 'goodhands-encounter',
        summary: e.summary,
        at: e.at,
        sourceGame: 'goodhands',
        sourceEpisodeId: e.id,
      },
    ].slice(-8),
  };
}
