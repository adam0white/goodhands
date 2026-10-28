import { householdVoice } from './backstories.ts';
import { CAST, CAST_EDITION, castManifest } from './cast.ts';
import { type AgencyChapter, installAgencyChapter } from './cast-chapter.ts';
import { applyCastTalk, castContacts } from './cast-scenes.ts';
import {
  beginFramework,
  bindFramework,
  finalizeFramework,
  placementWorkForReport,
  saveFramework,
  schedulePlacement,
  sourceResponse,
} from './hf4.ts';

// Versions 1, 2 and 3 are frozen for exact replay of earlier saves and compact exports.

import { arrangementSpec } from './arrangements.ts';
import { applyGuest, type GuestAdmission, guestViews, initGuests, stepGuests } from './guests.ts';
import {
  believe,
  confirm,
  converse,
  credence,
  estimate,
  glimpse,
  hear,
  interruptPlacement,
  observeAct,
  outwardSigns,
  perceive,
  skillLevel,
  socialEvent,
  tick,
  trustOf,
} from './hf4.ts';
import { hourWords, negotiationChoices, responses, termsWords, validTerms } from './negotiation.ts';
import {
  familyDisagreementWords,
  familyMoment,
  referenceChoices,
  referenceFollowUp,
  referenceOpening,
  referenceReply,
} from './references.ts';
import type {
  CandidateView,
  DayCard,
  EmploymentTerms,
  HouseholdTopic,
  Input,
  LogEntry,
  LoggedInput,
  Note,
  PlacementView,
  Quality,
  RequestView,
  Review,
  SceneView,
  State,
  TalkRoute,
  TalkThread,
  View,
} from './types.ts';
import { QUALITIES } from './types.ts';
import * as legacy from './v1/index.ts';
import * as previous from './v2/index.ts';
import * as third from './v3/index.ts';
import * as fourth from './v4/index.ts';

export * from './guests.ts';

import {
  answer,
  contextualConcern,
  personalAnswer,
  personalQuestions,
  questions,
  workerDisagreement,
  workerNeed,
} from './voices.ts';
import { CANDIDATES, FAMILIES, makePeople, QUALITY_MAP, quality, REFEREES, ROLE_SKILL } from './world.ts';

export * from './types.ts';

interface Card {
  arrivalAt?: number;
  returnAt?: number;
  introduced?: boolean;
  wants?: string;
  interviewCount: number;
  interviewUntil: number;
  lastQuestion?: string;
  referenceDispute?: { from: string; story: string };
  wageDispute?: string;
  referenceClaims?: { id: string; label: string; reply: string; quality: Quality }[];
  evidence: { quality: Quality; value: number; source: Note['source']; sourceId: string; at: number }[];
  status: CandidateView['status'];
  met: boolean;
  arrived: number;
  notes: Note[];
  asked: Record<string, number>;
  called: string[];
  coached: Quality[];
  wageKnown: boolean;
  experience: string[];
  refuses: { family: string; words: string }[];
}
interface Placement extends PlacementView {
  lastWorkAccountStart?: number;
  bendUntil?: number;
  disagreement?: boolean;
  arrangementMode?: 'negotiate' | 'bend' | 'promise' | 'refused';
  arrangementKept?: boolean;
  warning?: { status: PlacementView['status']; words: string; at: number };
  pendingFee: number;
  reportedStatus: PlacementView['status'];
  story: string[];
  moments: { day: number; quality: Quality; good: boolean; text: string }[];
  reported: number;
  confidenceGiven: boolean;
  wage: number;
}
interface Phone {
  status?: PlacementView['status'];
  through?: number;
  since: number;
  who: string;
  scene: SceneView;
  placement?: string;
}
interface Sim extends State {
  negotiationVouches?: Record<string, Quality[]>;
  negotiationAgreed?: { candidate: string; family: string; terms: EmploymentTerms };
  householdCalls?: Record<string, { family: string; member: string }>;
  quietOfficeAt?: number;
  scenePlacements: Record<string, string>;
  referenceAsked: Record<string, string[]>;
  referrals: { candidate: string; from: string; thread: number; at: number }[];
  routes: TalkRoute[];
  routeFacts: Record<number, { prop: string; value: boolean }>;
  envelopePromise?: { candidate: string; at: number };
  envelopeDebt?: { candidate: string; scene: string; at: number };
  fees: Record<string, { first: boolean; second: boolean; deposit?: number }>;
  offerDetails?: Record<
    string,
    { kind: 'confidence' | 'envelope' | 'poach' | 'refund'; candidate: string; family: string }
  >;
  trialReports?: Record<
    string,
    { candidate: string; quality: Quality; value: number; from: string; source: string }
  >;
  cards: Record<string, Card>;
  requests: RequestView[];
  placements: Placement[];
  cash: number;
  rentDue: number;
  missedRent: number;
  scene: SceneView | null;
  heldScene?: SceneView | null;
  phones: Phone[];
  log: LogEntry[];
  threads: TalkThread[];
  dayCard: DayCard | null;
  ended: boolean;
  review: Review | null;
  serial: number;
  eventKeys: string[];
  familyLines: Record<string, string>;
  confidences: { candidate: string; family: string; text: string; told: boolean }[];
}
const snapshots = new WeakMap<State, View>();
const sim = (state: State): Sim => state as Sim;
const DAY = 1440;
const END = 27 * DAY + 1140;
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const day = (s: State) => Math.floor(s.now / DAY);
const name = (id: string) =>
  id === 'nermin'
    ? 'Nermin'
    : id === 'husnu'
      ? 'Mr Hüsnü'
      : (CANDIDATES.find((c) => c.id === id)?.name ??
        FAMILIES.find((f) => f.id === id)?.name ??
        REFEREES.find((r) => r.id === id)?.name ??
        id);
const cue = (q: Quality) =>
  ['warm', 'hardworking', 'discreet'].includes(q) ? `trait:goodhands:${q}` : `trait:${QUALITY_MAP[q]}`;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
const roll = (s: State, event: string) => hash(`${s.seed}:${event}`) / 4294967296;
export function dateLabel(at: number): string {
  const d = Math.floor(at / DAY);
  return `${weekdays[d % 7]} ${d + 2} November`;
}
export function timeLabel(at: number): string {
  const t = Math.floor(at % DAY);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
const label = (at: number) => `${dateLabel(at)}, ${timeLabel(at)}`;
function log(s: Sim, kind: LogEntry['kind'], text: string, ref?: LogEntry['ref']) {
  text = cap(text).replace(/\.\./g, '.');
  s.log.push({ id: s.log.length + 1, at: s.now, kind, text, ...(ref ? { ref } : {}) });
}
function scene(
  s: Sim,
  kind: SceneView['kind'],
  who: string,
  title: string,
  text: string,
  choices: SceneView['choices'] = [{ id: 'thanks', label: 'Thank them' }],
): SceneView {
  return {
    id: `scene-${++s.serial}`,
    kind,
    with: who,
    title,
    lines: [{ speaker: name(who), text, kind: 'speech' }],
    choices,
    canLeave: true,
  };
}
function queue(s: Sim, who: string, exchange: SceneView, placement?: string, through?: number) {
  const p = placement ? s.placements.find((p) => p.id === placement) : undefined;
  if (p) s.scenePlacements[exchange.id] = p.id;
  s.phones.push({
    since: s.now,
    who: name(who),
    scene: exchange,
    ...(p ? { placement: p.id, through: through ?? p.moments.length, status: p.status } : {}),
  });
  log(s, 'phone', `There is a call from ${name(who)}.`);
}
function addNote(
  s: Sim,
  candidate: string,
  q: Quality,
  value: number,
  source: Note['source'],
  from: string,
  sourceId: string,
  claim?: string,
): Note {
  const observer = s.people.nermin!;
  // Belief sources remember whose words proved right when Nermin later sees an act.
  // Impressions keep the richer estimate; neither call reads hidden traits here.
  if (source === 'seen') confirm(observer, `${candidate}:${q}`, value >= 0.62, s.now);
  else if (value > 0.62 || value < 0.4)
    believe(observer, `${candidate}:${q}`, value > 0.62, 0.85, sourceId, s.now);
  s.cards[candidate]!.evidence.push({ quality: q, value, source, sourceId, at: s.now });
  hear(
    observer,
    candidate,
    cue(q),
    value,
    s.now,
    source === 'seen' ? 1 : Math.max(0, trustOf(observer, sourceId) - 0.1) * (source === 'says' ? 0.65 : 1),
    sourceId,
  );
  const result = synthesize(s, candidate, q);
  const phrases: Record<Quality, string> = {
    patient: 'the worker is patient when someone needs time',
    honest: 'the worker is honest about money',
    reliable: 'the worker arrives when promised',
    warm: 'the worker makes people feel comfortable',
    hardworking: 'the worker finishes the work',
    discreet: 'the worker keeps a household’s private information private',
  };
  const note: Note = {
    ...(claim ? { claim: `“${claim}” — ${from}` } : {}),
    quality: q,
    read: result,
    phrase: `${result === 'no' ? 'I doubt that ' : result === 'maybe' ? 'I am still unsure whether ' : 'I believe '}${phrases[q]}.`,
    source,
    from,
    at: s.now,
  };
  for (const old of s.cards[candidate]!.notes) if (old.quality === q) old.crossedOut = old.read !== result;
  s.cards[candidate]!.notes.push(note);
  return note;
}
function synthesize(s: Sim, candidate: string, q: Quality): Note['read'] {
  const observer = s.people.nermin!;
  const read = estimate(observer, candidate, cue(q), s.now);
  return read.value > 0.62 ? 'yes' : read.value < 0.4 ? 'no' : 'maybe';
}
function callbackTime(s: Sim, at: number): string {
  return day(s) === Math.floor(at / DAY) ? timeLabel(at) : label(at);
}
function interviewPace(s: Sim, id: string): string {
  const card = s.cards[id]!;
  const he = s.people[id]!.life.sex === 'male';
  if (card.interviewCount >= 4)
    return `${he ? 'He' : 'She'} has told you what ${he ? 'he' : 'she'} can for now. Call ${he ? 'him' : 'her'} again after ${callbackTime(s, card.interviewUntil)}.`;
  return `${he ? 'He will' : 'She will'} answer ${card.interviewCount >= 3 ? 'one more question' : card.interviewCount >= 2 ? 'a couple more questions' : 'a few more questions'} before ${he ? 'he' : 'she'} wants your decision.`;
}
function interviewChoices(s: Sim, id: string): SceneView['choices'] {
  const card = s.cards[id]!;
  const c = CANDIDATES.find((p) => p.id === id)!;
  const available = card.interviewCount < 4;
  return [
    ...[
      ...(card.referenceClaims ?? []).map(({ id, label }) => ({ id, label })),
      ...personalQuestions(id),
      ...questions(c.roles[0]!),
      ...(card.wageDispute
        ? [{ id: 'follow-wages', label: `${card.wageDispute} says you argued over wages` }]
        : []),
    ]
      .filter((q) => !card.asked[q.id])
      .map((q) => ({
        id: q.id,
        label: q.label,
        hint: 'This takes 8–12 minutes.',
        ...(!available ? { disabled: interviewPace(s, id) } : {}),
      })),
    ...(available && card.lastQuestion === 'q-reliable' && !card.coached.length
      ? [
          {
            id: 'coach',
            label: contextualConcern(id, c.roles[0]!).promise,
            hint: 'The family will accept the wage the worker asks for. They will remember this promise.',
          },
        ]
      : []),
    ...(card.referenceDispute &&
    !card.wageDispute &&
    !card.asked['follow-reference'] &&
    !card.referenceClaims?.some((claim) => claim.id.endsWith('ref-leaving'))
      ? [
          {
            id: 'follow-reference',
            label: `${card.referenceDispute.from} says the job ended differently`,
            hint: card.referenceDispute.story,
            ...(!available ? { disabled: interviewPace(s, id) } : {}),
          },
        ]
      : []),
    {
      id: 'wait-bench',
      label: 'Ask the candidate to wait on the bench',
      hint: 'The candidate stays but may grow tired of waiting.',
    },
    {
      id: 'send-home',
      label: 'Send the candidate home and keep the number',
      hint: available
        ? 'The candidate goes home. You keep the contact details.'
        : `The candidate goes home. Call again after ${label(card.interviewUntil)}.`,
    },
  ];
}
function requiredCard(s: Sim, id: string): Card {
  const card = s.cards[id];
  if (!card) throw new Error(`Missing roster card: ${id}`);
  return card;
}
function requiredPerson(s: Sim, id: string): Sim['people'][string] {
  const person = s.people[id];
  if (!person) throw new Error(`Missing roster person: ${id}`);
  return person;
}
function arrive(s: Sim) {
  for (const c of CANDIDATES) {
    const card = requiredCard(s, c.id);
    if (!card.met && card.arrived <= s.now) {
      const reputation = credence(requiredPerson(s, c.id), 'nermin:reliable');
      if (reputation < 0.42) {
        Object.assign(card, { met: true, status: 'gone', arrived: s.now });
        log(
          s,
          'word',
          `${c.name} sent word: “I heard what happened at your last house. I am looking elsewhere.”`,
          { candidate: c.id },
        );
        continue;
      }
      Object.assign(card, { met: true, status: 'bench', arrived: s.now });
      landReferral(s, c.id);
      if (reputation > 0.58)
        log(s, 'word', `${c.name}: “Someone you placed told me to come here. They said you listen.”`, {
          candidate: c.id,
        });
      log(s, 'arrival', `${c.name} sat on the bench. ${c.look}`, { candidate: c.id });
    }
  }
  for (const f of FAMILIES)
    if (f.arrives <= s.now && !s.requests.some((r) => r.family === f.id) && requestHasPath(s, f)) {
      const request: RequestView = {
        id: `request-${f.id}`,
        family: f.id,
        role: f.role,
        wants: f.wants,
        wage: f.wage,
        by: f.deadline,
        byLabel: label(f.deadline),
        status: 'open',
      };
      const reputation = credence(requiredPerson(s, `${f.id}-0`), 'nermin:reliable');
      if (reputation < 0.42) {
        request.status = 'lost';
        request.lostReason = 'They heard how the last placement ended and chose another agency.';
      }
      const words =
        reputation < 0.42
          ? 'We heard how the last placement ended. We are going to another agency.'
          : reputation > 0.58
            ? `A family at tea recommended you. ${f.wants}`
            : f.wants;
      s.requests.push(request);
      s.familyLines[f.id] = words;
      log(s, 'word', `${f.name}: “${words}”`, { family: f.id });
      if (f.arrives > 510)
        queue(
          s,
          f.id,
          scene(
            s,
            'phone',
            f.id,
            `Request: ${f.name}`,
            request.status === 'lost'
              ? words
              : `${words} We can pay ₺${f.wage}. I need someone by ${label(f.deadline)}.`,
            [
              ...(request.status === 'lost'
                ? [{ id: 'acknowledge', label: 'Acknowledge their decision' }]
                : [
                    { id: 'look', label: 'Promise to look' },
                    { id: 'decline', label: 'Decline the request' },
                  ]),
            ],
          ),
        );
    }
}
// A job reaches the desk only with a worker to contact or a dated arrival that day.
function requestHasPath(s: Sim, f: (typeof FAMILIES)[number]): boolean {
  const suitable = CANDIDATES.filter((c) => c.roles.includes(f.role));
  if (
    suitable.some((c) => {
      const card = requiredCard(s, c.id);
      return (
        ['bench', 'books'].includes(card.status) && card.met && !card.refuses.some((r) => r.family === f.id)
      );
    })
  )
    return true;
  const next = suitable
    .filter((c) => !requiredCard(s, c.id).met)
    .sort((a, b) => {
      const aCard = requiredCard(s, a.id);
      const bCard = requiredCard(s, b.id);
      return aCard.arrived - bCard.arrived;
    })[0];
  if (!next) return false;
  // The candidate has already arranged to come; bring that appointment into this half-day.
  const nextCard = requiredCard(s, next.id);
  nextCard.arrived = Math.min(nextCard.arrived, s.now + 60);
  return true;
}

function quietOfficeTime(s: Sim): number {
  return s.quietOfficeAt ?? s.now + 45;
}
function quietOffice(s: Sim) {
  const t = s.now % DAY;
  const waiting =
    s.scene ||
    s.heldScene ||
    s.phones.length ||
    s.dayCard ||
    Object.values(s.cards).some((c) => c.status === 'bench');
  if (day(s) % 7 === 6 || t < 510 || t >= 1140 || waiting) {
    s.quietOfficeAt = s.now + 45;
    return;
  }
  s.quietOfficeAt ??= s.now + 45;
  if (s.now < s.quietOfficeAt) return;
  const ordinal = s.log.filter(
    (line) => line.kind === 'city' && line.text.startsWith('At the office:'),
  ).length;
  const met = CANDIDATES.filter((c) => s.cards[c.id]!.met && s.cards[c.id]!.status !== 'gone');
  const knownFamilies = FAMILIES.filter((f) => s.requests.some((r) => r.family === f.id));
  const household = knownFamilies[ordinal % knownFamilies.length]!;
  const activePlacements = s.placements.filter(active);
  const placed = activePlacements[ordinal % Math.max(1, activePlacements.length)];
  const nextCandidate = CANDIDATES.find((c) => !s.cards[c.id]!.met && s.cards[c.id]!.arrived <= s.now + DAY);
  const kind = (hash(`${s.seed}:quiet`) + ordinal) % 4;
  if (kind === 0 && nextCandidate) {
    Object.assign(s.cards[nextCandidate.id]!, { met: true, status: 'bench', arrived: s.now });
    landReferral(s, nextCandidate.id);
    log(
      s,
      'arrival',
      `${nextCandidate.name} climbed the stairs. “Mr Hüsnü downstairs said you might have a job for me.” ${nextCandidate.look}`,
      { candidate: nextCandidate.id },
    );
    log(s, 'city', `At the office: ${nextCandidate.name} came up from the pharmacy.`);
  } else {
    const worker = met[ordinal % Math.max(1, met.length)];
    const caller = kind === 2 && placed ? placed.candidate : 'husnu';
    const words =
      kind === 2 && placed
        ? [
            `I have your number with me at ${name(placed.family)}. If the arrangements change, I will call you after work.`,
            `Please keep my phone number. It helps to know I can reach someone outside this house.`,
            `Before I put the phone away, please remember ${workerNeed(placed.candidate).reason}. I am counting on our agreement.`,
          ][Math.floor(ordinal / 4) % 3]!
        : kind === 3
          ? `${household.household[0]!.name}'s relative stopped at the pharmacy to ask how your agency works. I told them the family and worker must both agree on the duties. They may come upstairs another day.`
          : worker
            ? `${worker.name} stopped at my counter for a glass of water. We spoke about the buses from ${worker.home}. I told ${s.people[worker.id]!.life.sex === 'male' ? 'him' : 'her'} your office was upstairs if there was anything to ask.`
            : `${household.household[0]!.name} asked at my counter whether your office still opens on Saturday. I said you open at half past eight, as you do on weekdays.`;
    const exchange = scene(
      s,
      'phone',
      caller,
      kind === 2 && placed
        ? `A message from ${name(placed.candidate)}`
        : 'Mr Hüsnü brings word from downstairs',
      words,
      [{ id: 'listen', label: kind === 2 && placed ? 'Send a short reply' : 'Thank him for the news' }],
    );
    exchange.yieldsToPhone = true;
    queue(s, caller, exchange);
    log(s, 'city', `At the office: ${words}`);
  }
  s.quietOfficeAt = s.now + 45;
}

export function newGame(
  seed: number,
  version: 1 | 2 | 3 | 4 | 5 | 6 = 6,
  admissions: GuestAdmission[] = [],
  chapter?: AgencyChapter,
): State {
  if (version === 1) return legacy.newGame(seed);
  if (version === 2) return previous.newGame(seed);
  if (version === 3) return third.newGame(seed);
  if (version === 4) return fourth.newGame(seed);
  if (version === 5)
    throw new Error(
      'This saved game uses an older cast. Start a new game. You can keep the exported file to read later.',
    );
  if (admissions.length)
    throw new Error('This file uses an older guest version. Keep the file and start a new game.');
  beginFramework(Math.trunc(seed) || 1);
  const s: Sim = {
    version: 6,
    castEdition: CAST_EDITION,
    castManifest: castManifest(),
    seed: Math.trunc(seed) || 1,
    rng: Math.trunc(seed) >>> 0,
    now: 510,
    speed: 1,
    inputs: [],
    people: makePeople(Math.trunc(seed) || 1),
    cards: {},
    fees: {},
    requests: [],
    placements: [],
    cash: 3000,
    rentDue: 4 * DAY + 1020,
    missedRent: 0,
    scene: null,
    heldScene: null,
    phones: [],
    log: [],
    threads: [],
    quietOfficeAt: 555,
    scenePlacements: {},
    referenceAsked: {},
    referrals: [],
    routes: [],
    routeFacts: {},
    dayCard: null,
    ended: false,
    review: null,
    serial: 0,
    eventKeys: [],
    familyLines: {},
    confidences: [],
  };
  for (const c of CANDIDATES)
    s.cards[c.id] = {
      interviewCount: 0,
      interviewUntil: 0,
      evidence: [],
      status: 'books',
      met: false,
      arrived: c.arrives,
      notes: [],
      asked: {},
      called: [],
      coached: [],
      wageKnown: false,
      experience: [],
      refuses: [],
    };
  initGuests(s, admissions);
  if (chapter) installAgencyChapter(s, chapter);
  // Pin narration only when a fresh chapter starts. Loaded runs keep their saved lexicon.
  for (const person of Object.values(s.people)) person.lexicon = { ...person.lexicon, plainEnglish: true };
  finalizeFramework(s);
  arrive(s);
  saveFramework(s);
  return s;
}
function finish(s: Sim, why: string) {
  s.ended = true;
  s.heldScene = null;
  s.scene = null;
  s.phones = [];
  s.dayCard = null;
  log(s, 'day', why);
  s.review = {
    people: CANDIDATES.filter((c) => s.cards[c.id]!.met).map((c) => ({
      id: c.id,
      name: c.name,
      truth: Object.fromEntries(
        QUALITIES.map((q) => [
          q,
          quality(s.people[c.id]!, q) > 0.62 ? 'yes' : quality(s.people[c.id]!, q) < 0.4 ? 'no' : 'maybe',
        ]),
      ) as Review['people'][number]['truth'],
      notes: s.cards[c.id]!.notes,
    })),
    placements: s.placements.map((p) => ({ id: p.id, story: p.story })),
    threads: s.threads.map((t) => ({
      ...t,
      about: t.about ?? s.routes.find((r) => r.at === t.at && r.from === t.from && r.to === t.to)?.about,
    })),
    routes: s.routes,
    workersTrust: CANDIDATES.filter((c) => s.cards[c.id]!.met).map((c) => ({
      id: c.id,
      name: c.name,
      trust:
        trustOf(s.people[c.id]!, 'nermin') > 0.65
          ? 'warm'
          : trustOf(s.people[c.id]!, 'nermin') < 0.45
            ? 'cool'
            : 'polite',
    })),
    cash: s.cash,
    trustedBy: FAMILIES.filter((f) => trustOf(s.people[`${f.id}-0`]!, 'nermin') > 0.65).map((f) => f.name),
    question: relationshipQuestion(s),
  };
}
function closeDay(s: Sim) {
  const lines = s.log
    .filter(
      (l) =>
        day({ now: l.at } as State) === day(s) && ['word', 'money', 'placement', 'arrival'].includes(l.kind),
    )
    .slice(-3)
    .map((l) => l.text);
  if (!lines.length) lines.push('The office was quiet today.');
  if (lines.length < 2) lines.push(`There is ₺${s.cash} in the cash box. Rent is due ${label(s.rentDue)}.`);
  const pending = s.placements
    .filter(active)
    .filter((p) => p.pending && p.pending.at > s.now)
    .sort((a, b) => a.pending!.at - b.pending!.at)[0]?.pending;
  const firstMorning = s.placements.find((p) => active(p) && !p.disagreement && firstCallAt(p) > s.now);
  const replacement = s.placements.findLast(
    (p) => !active(p) && s.requests.some((r) => r.family === p.family && r.status === 'open' && r.by > s.now),
  );
  const replacementRequest = replacement
    ? s.requests.find((r) => r.family === replacement.family)
    : undefined;
  const next = pending
    ? { label: pending.text, dateLabel: pending.dateLabel }
    : replacement && replacementRequest
      ? {
          label: `Find a replacement for ${name(replacement.candidate)} at ${name(replacement.family)}`,
          dateLabel: replacementRequest.byLabel,
        }
      : firstMorning
        ? {
            label: `${cap(name(firstMorning.family))} will call about ${name(firstMorning.candidate)} after the first day`,
            dateLabel: label(firstCallAt(firstMorning)),
          }
        : nextEvent(s);
  const request = s.requests.find((r) => r.status === 'open' && r.by > s.now);
  s.dayCard = {
    day: day(s),
    dateLabel: dateLabel(s.now),
    lines,
    tomorrow: next
      ? `${next.dateLabel}: ${next.label}${/[.!?]$/.test(next.label) ? '' : '.'}`
      : request
        ? `Decide who to send to ${name(request.family)} before ${request.byLabel}.`
        : relationshipQuestion(s),
  };
}
function step(s: Sim) {
  stepGuests(s);
  startPlacementWork(s);
  if (s.castPauseRequested && Object.keys(CAST).every((k) => !s.people[k]?.activity)) s.castPaused = true;
  landReferrals(s);
  for (const c of CANDIDATES) {
    const card = s.cards[c.id]!;
    if (
      (card.arrivalAt !== undefined && s.now >= card.arrivalAt) ||
      (card.returnAt !== undefined && s.now >= card.returnAt)
    ) {
      delete card.arrivalAt;
      delete card.returnAt;
      card.status = 'bench';
      card.arrived = s.now;
      card.interviewCount = 0;
      log(s, 'arrival', `${c.name} climbed the stairs and sat on the bench after the journey.`, {
        candidate: c.id,
      });
    }
  }
  arrive(s);
  arrangementTests(s);
  for (const c of CANDIDATES) {
    const card = s.cards[c.id]!;
    if (
      card.status === 'bench' &&
      s.scene?.with !== c.id &&
      s.heldScene?.with !== c.id &&
      s.now - card.arrived >= 210 + (hash(c.id) % 90)
    ) {
      card.status = card.introduced ? 'books' : 'gone';
      if (card.status === 'gone') {
        let returnDay = day(s) + 2 + (hash(`${s.seed}:${c.id}:return`) % 3);
        if (returnDay % 7 === 6) returnDay++;
        card.returnAt = returnDay * DAY + 540;
      }
      log(
        s,
        'arrival',
        `${c.name} picked up ${s.people[c.id]!.life.sex === 'male' ? 'his' : 'her'} bag and left to attend to things at home${card.status === 'books' ? '. You have the phone number' : ' without an interview or leaving a number. You cannot call'}.`,
        { candidate: c.id },
      );
    }
  }
  for (const r of s.requests)
    if (r.status === 'open' && s.now > r.by) {
      r.status = 'lost';
      r.lostReason = 'They needed someone earlier and asked elsewhere.';
      log(s, 'word', `${name(r.family)}: “We needed someone earlier. We have asked elsewhere.”`, {
        family: r.family,
      });
    }
  if (s.now % DAY === 600) placementDay(s);
  for (const p of s.placements) {
    if (active(p) && !p.disagreement && s.now >= firstCallAt(p) && p.moments.length)
      openDisagreement(s, p, false, true);
  }

  if (s.now % DAY === 720) {
    trialResults(s);
    verdicts(s);
    for (const p of s.placements)
      if (s.eventKeys.includes(`noon:${p.id}`)) {
        s.eventKeys.splice(s.eventKeys.indexOf(`noon:${p.id}`), 1);
        queue(
          s,
          p.family,
          scene(
            s,
            'check-in',
            p.family,
            `First morning: ${name(p.candidate)}`,
            p.moments.at(-1)?.text ?? 'We have begun the morning.',
            [
              { id: 'listen', label: 'Listen to the family' },
              { id: 'support', label: 'Speak for the worker' },
            ],
          ),
          p.id,
        );
      }
  }
  rent(s);
  overdueRent(s);
  if (s.now % DAY === 930) offers(s);
  traceSecrets(s);
  if (s.now % DAY === 1110 && day(s) % 7 !== 6) commuteTalk(s);
  envelopeDue(s);
  quietOffice(s);
  if (s.ended) return;
  if (day(s) % 7 === 4 && s.now % DAY === 960) cityTalk(s, true);
  if (day(s) % 7 === 5 && s.now % DAY === 900) cityTalk(s, false);
  if (s.now % DAY === 1140) closeDay(s);
  if (s.now >= END) finish(s, 'Sunday 29 November. The month is over.');
}
function runTo(s: Sim, target: number, stopOnNew = false) {
  if (!Number.isFinite(target)) return;
  if (s.castPaused && target > s.now) throw new Error('A paused chapter cannot advance its clock.');
  const end = Math.min(END, Math.max(s.now, target));
  while (s.now < end && !s.ended && !s.castPaused) {
    const phones = s.phones.length;
    const card = s.dayCard;
    const openScene = s.scene;
    const logLength = s.log.length;
    const urgent = Object.values(s.cards).some((c) => c.status === 'bench' && s.now - c.arrived >= 180);
    const next = Math.min(end, Math.floor(s.now) + 1);
    s.now = next;
    if (Number.isInteger(next)) step(s);
    if (
      stopOnNew &&
      (s.log.slice(logLength).some((l) => l.kind === 'arrival') ||
        s.phones.length > phones ||
        (!card && s.dayCard) ||
        (!openScene && s.scene) ||
        (!urgent && Object.values(s.cards).some((c) => c.status === 'bench' && s.now - c.arrived >= 180)))
    )
      break;
  }
}
function advanceInternal(state: State, minutes: number): State {
  if (state.castPaused) return state;
  if (state.version === 1) return legacy.advance(state as legacy.State, minutes);
  if (state.version === 2) return previous.advance(state as previous.State, minutes);
  if (state.version === 3) return third.advance(state as third.State, minutes);
  if (state.version === 4) return fourth.advance(state as fourth.State, minutes);
  snapshots.delete(state);
  const s = sim(state);
  if (Number.isFinite(minutes) && minutes > 0) runTo(s, s.now + minutes, true);
  resumeHeld(s);
  return s;
}
function refuse(s: Sim, text: string) {
  log(s, 'word', text);
}
function choiceReply(s: Sim, sc: SceneView, choice: string, cashBefore: number): string {
  const replies: Record<string, string> = {
    look: 'All right. Call when you have someone to recommend.',
    soon: 'I will wait for your answer today.',
    decline: 'I understand. We will look elsewhere.',
    acknowledge: 'Thank you for listening. That is the situation.',
    confirm: 'Good. We will keep the arrangements you made.',
    distrust: 'You have heard my account. Ask the worker about it too.',
    support: 'Please hear both sides before deciding what to do.',
    listen: 'Thank you. I will let you know when there is more to tell.',
    worker: 'That is what happened as I remember it.',
    family: 'That is how we understood the agreement.',
    withdraw: 'All right. I will leave this job. Call me about the next one.',
    replace: 'Please call when you have someone else to recommend.',
    consider: 'Let me know when you have decided.',
    'keep-private': 'All right. I will not ask you again about their private affairs.',
    'return-envelope': 'Keep my number, then. I still need work.',
    'take-envelope': 'You have the money. Please remember which house you promised me.',
    'sell-confidence': 'Here is the payment. I heard what you said about the household.',
    'refund-envelope': 'I have the money back. That settles the payment.',
    'keep-envelope': 'You are keeping my money. I will remember that.',
    'accept-poach': 'I have heard your offer. Tell the households what we have agreed.',
    'pay-part': 'I have recorded the payment. Any unpaid rent is still owed.',
    'sell-ring': 'I have recorded the ring money and the rent payment.',
    promise:
      sc.kind === 'rent'
        ? 'I expect the payment next Friday. This week still counts as a missed rent payment.'
        : 'I expect you to keep that promise.',
  };
  return (
    replies[choice] ??
    (s.cash !== cashBefore
      ? `The payment is settled. We have heard your decision.`
      : 'All right. I have heard your answer.')
  );
}
function applyInternal(state: State, input: Input): State {
  if (state.version === 1) return legacy.apply(state as legacy.State, input as legacy.Input);
  if (state.version === 2) return previous.apply(state as previous.State, input as previous.Input);
  if (state.version === 3) return third.apply(state as third.State, input as third.Input);
  if (state.version === 4) return fourth.apply(state as fourth.State, input as fourth.Input);
  if (input.type === 'pause-cast' || input.type === 'resume-cast') {
    state.castPauseRequested = input.type === 'pause-cast';
    state.castPaused = state.castPauseRequested && Object.keys(CAST).every((k) => !state.people[k]?.activity);
    snapshots.delete(state);
    state.inputs.push({ at: state.now, input });
    (state.log as LogEntry[]).push({
      id: (state.log as LogEntry[]).length + 1,
      at: state.now,
      kind: 'word',
      text: state.castPaused
        ? 'Nermin paused the agency chapter for a departure review. Workers keep their current jobs and promises.'
        : 'Nermin resumed the agency chapter.',
    });
    return state;
  }
  if (state.castPaused) return state;
  if (input.type === 'cast-talk') {
    if (applyCastTalk(state, input.person, input.choice)) {
      snapshots.delete(state);
      state.inputs.push({ at: state.now, input: structuredClone(input) });
    }
    return state;
  }
  if (input.type === 'guest-action') {
    snapshots.delete(state);
    state.inputs.push({ at: state.now, input: structuredClone(input) });
    applyGuest(state, input);
    return state;
  }
  const before = sim(state);
  const sc = input.type === 'choose' && before.scene?.id === input.scene ? before.scene : null;
  const valid = !!(
    sc &&
    input.type === 'choose' &&
    sc.choices.some((c) => c.id === input.choice && !c.disabled)
  );
  const lineCount = sc?.lines.length ?? 0;
  const cashBefore = before.cash;
  const s = sim(applyInput(state, input));
  // A consequential answer stays in the transcript until the player ends the exchange.
  // Closing a conversation is navigation, not another decision requiring a new exchange.
  if (
    valid &&
    sc &&
    input.type === 'choose' &&
    !['done', 'finish', 'thanks', 'thank'].includes(input.choice) &&
    !s.ended
  ) {
    const answered = sc.lines.slice(lineCount).some((l) => l.kind === 'speech' && l.speaker !== 'Nermin');
    if (!answered) {
      const speaker = sc.kind === 'rent' ? 'Mr Hüsnü' : name(sc.with);
      const text = choiceReply(s, sc, input.choice, cashBefore);
      sc.lines.push({ speaker, text, kind: 'speech' });
      log(s, 'word', `${speaker}: “${text}”`);
    }
    if (!s.scene) {
      sc.choices = [{ id: 'done', label: 'End the conversation' }];
      sc.canLeave = true;
      s.scene = sc;
    }
  }
  resumeHeld(s);
  if (s.dayCard && !s.ended) closeDay(s);
  return s;
}
function revalidatePhone(s: Sim, phone: Phone) {
  const sc = phone.scene;
  const placement = s.placements.find((p) => p.id === phone.placement);
  const request = s.requests.find((r) => r.family === sc.with);
  const current = s.placements.findLast((p) => p.family === sc.with && active(p));
  const info = (text: string) => {
    sc.lines = [{ speaker: name(sc.with), text, kind: 'speech' }];
    sc.choices = [{ id: 'acknowledge', label: 'Acknowledge the news' }];
    sc.kind = 'phone';
  };
  if (placement) {
    if (!active(placement) && sc.kind === 'verdict' && phone.status !== placement.status) {
      sc.lines = [
        {
          speaker: name(placement.family),
          text: `We agreed to keep ${name(placement.candidate)} after the trial week. Since then the placement has ended. ${placement.story.at(-1) ?? ''}`,
          kind: 'speech',
        },
      ];
      sc.choices = [
        { id: 'acknowledge', label: 'Acknowledge the change' },
        { id: 'replace', label: 'Offer to find a replacement' },
      ];
      phone.status = placement.status;
    } else if (!active(placement) && !['verdict', 'phone'].includes(sc.kind)) {
      info(
        `${name(placement.candidate)} is no longer working at ${name(placement.family)}. ${placement.story.at(-1) ?? 'We need to settle what happens next.'}`,
      );
      phone.status = placement.status;
    } else if (active(placement) && sc.kind === 'two-sides' && !sc.title.startsWith('The arrangement:')) {
      sc.lines[0]!.text =
        `${day(s) > Math.floor(phone.since / DAY) ? `About ${dateLabel(phone.since)}: ` : ''}${workerDisagreement(
          placement.candidate,
          name(placement.family),
          !!s.cards[placement.candidate]!.asked.need || !!s.cards[placement.candidate]!.asked.hours,
        )}`;
      sc.lines[1] = {
        speaker: name(placement.family),
        text: `${reportWords(s, placement, phone.through)} ${familyDisagreement(placement)}`,
        kind: 'speech',
        side: 'family',
      };
    } else if (sc.kind === 'check-in') {
      sc.lines[0]!.text = reportWords(s, placement, phone.through);
    }
    return;
  }
  if (sc.kind === 'phone' && request && /^Request:|checking|Still looking:/.test(sc.title)) {
    if (request.status === 'filled' && current) {
      info(
        `${name(current.candidate)} is arranged with us. Good. We have the working hours and your recommendation; call if anything changes.`,
      );
      sc.choices = [{ id: 'confirm', label: 'Confirm the arrangement' }];
    } else if (request.status === 'lost')
      info('We are no longer waiting for a worker from you. We have made other arrangements.');
    else if (request.by <= s.now)
      info('The date we needed has passed. We have had to make other arrangements.');
    else
      sc.lines[0]!.text =
        `We are still looking for a ${request.role}. ${request.wants} We can pay ₺${request.wage}. We need someone by ${request.byLabel}.`;
  }
  const trial = s.trialReports?.[sc.id];
  if (trial && (request?.status !== 'open' || !['books', 'bench'].includes(s.cards[trial.candidate]!.status)))
    info(
      `That trial morning is over. ${name(trial.candidate)} is no longer available. The old offer is no longer open.`,
    );
  const offer = s.offerDetails?.[sc.id];
  if (offer) {
    const free = ['books', 'bench'].includes(s.cards[offer.candidate]!.status);
    const valid =
      offer.kind === 'envelope'
        ? free
        : offer.kind === 'poach'
          ? s.placements.some((p) => p.candidate === offer.candidate && p.status === 'kept') &&
            s.requests.some((r) => r.family === offer.family && r.status === 'open' && r.by > s.now)
          : offer.kind === 'confidence'
            ? s.confidences.some(
                (c) => c.candidate === offer.candidate && c.family === offer.family && !c.told,
              )
            : !!s.envelopeDebt;
    if (!valid) info('Things have changed since I called. That offer is no longer open.');
  }
}
function resumeHeld(s: Sim) {
  if (!s.ended && !s.scene && s.heldScene) {
    s.scene = s.heldScene;
    s.heldScene = null;
    s.scene.lines.push({ speaker: 'Nermin', text: 'Sorry. Where were we?', kind: 'speech' });
    log(s, 'word', 'Nermin returned to the conversation. “Sorry. Where were we?”');
  }
}
function applyInput(state: State, input: Input): State {
  snapshots.delete(state);
  const s = sim(state);
  if (s.ended) return s;
  s.inputs.push({ at: s.now, input: structuredClone(input) });
  if (['call-in', 'call-household'].includes(input.type) && s.scene) {
    refuse(s, 'Finish this conversation first.');
    return s;
  }
  if (input.type === 'call-in') {
    const c = CANDIDATES.find((c) => c.id === input.candidate);
    const card = s.cards[input.candidate];
    if (!c || !card?.met || card.status !== 'books' || !card.introduced) {
      refuse(s, 'You need the phone number of a worker who is available.');
      return s;
    }
    if (card.arrivalAt) {
      refuse(s, `${c.name} is already on the way, due ${label(card.arrivalAt)}.`);
      return s;
    }
    const earliest = Math.max(s.now + 3 + c.commute, card.interviewUntil);
    let at = earliest;
    if (at % DAY >= 1110 || at % DAY < 510 || Math.floor(at / DAY) % 7 === 6) {
      let d = Math.floor(at / DAY) + (at % DAY >= 1110 ? 1 : 0);
      if (d % 7 === 6) d++;
      at = d * DAY + 510 + c.commute;
    }
    card.arrivalAt = at;
    log(
      s,
      'word',
      `${c.name}: “I can come in. The journey takes about ${c.commute} minutes. Expect me ${label(at)}.”`,
      { candidate: c.id },
    );
    runTo(s, s.now + 3);
    return s;
  }
  if (input.type === 'propose-terms') {
    const sc = s.scene;
    if (sc?.kind === 'negotiation' && sc.id === input.scene && validTerms(input.terms))
      proposeTerms(s, sc, input.terms);
    return s;
  }
  if (input.type === 'call-household') {
    openHouseholdCall(s, input.family, input.member, input.topic);
    return s;
  }
  if (input.type === 'speed') {
    if ([0, 1, 2, 3].includes(input.speed)) s.speed = input.speed;
    return s;
  }
  if (input.type === 'wait-for') {
    if (s.scene || s.phones.length || s.dayCard) return s;
    const next = nextEvent(s);
    if (next) runTo(s, next.at, true);
    return s;
  }
  if (input.type === 'sleep') {
    if (s.heldScene) {
      refuse(s, 'Finish the call and the waiting conversation before closing for the evening.');
      return s;
    }
    if (!s.dayCard) {
      refuse(s, 'The day’s summary opens at 19:00.');
      return s;
    }
    if (s.scene?.kind === 'offer' && s.offerDetails?.[s.scene.id]?.kind === 'refund')
      offerChoice(s, s.scene, 'keep-envelope');
    s.scene = null;
    s.dayCard = null;
    let tomorrow = day(s) + 1;
    if (tomorrow % 7 === 6 && tomorrow !== 27) tomorrow++;
    runTo(s, tomorrow * DAY + 510);
    s.dayCard = null;
    return s;
  }
  if (input.type === 'close-scene') {
    if (s.scene?.id === input.scene && s.scene.canLeave) s.scene = null;
    return s;
  }
  if (input.type === 'choose') {
    const sc = s.scene;
    if (!sc || sc.id !== input.scene || !sc.choices.some((c) => c.id === input.choice && !c.disabled))
      return s;
    if (sc.kind === 'negotiation') {
      negotiationChoice(s, sc, input.choice);
      return s;
    }
    if (
      sc.kind === 'household-call' &&
      ['progress', 'complaint', 'smooth', 'worker'].includes(input.choice)
    ) {
      const call = s.householdCalls?.[sc.id];
      if (call) householdReply(s, sc, call.family, call.member, input.choice as HouseholdTopic);
      return s;
    }
    if (input.choice === 'done') {
      s.scene = null;
      return s;
    }
    if (sc.kind === 'rent') {
      settleRent(s, input.choice);
      return s;
    }
    if (sc.kind === 'confidence') {
      const p = s.placements.find((p) => p.id === s.scenePlacements[sc.id] && p.confidenceGiven);
      if (p && !s.confidences.some((c) => c.candidate === p.candidate && c.family === p.family)) {
        const f = FAMILIES.find((f) => f.id === p.family)!;
        s.confidences.push({ candidate: p.candidate, family: p.family, text: f.secret, told: false });
        log(s, 'word', `${name(p.candidate)} told you in confidence: “${f.secret}”`, {
          candidate: p.candidate,
          family: p.family,
        });
        sourceResponse(s.people[p.candidate]!, 'nermin', true, s.now);
      }
    }
    if (sc.kind === 'reference') {
      const ref = REFEREES.find((r) => r.id === sc.with)!;
      if (input.choice === 'finish') {
        s.scene = null;
        return s;
      }
      if (input.choice === 'distrust') {
        sourceResponse(s.people.nermin!, ref.id, false, s.now);
        for (const q of QUALITIES) {
          const result = synthesize(s, ref.candidate, q);
          const notes = s.cards[ref.candidate]!.notes.filter((n) => n.quality === q);
          for (const n of notes) n.crossedOut = n.read !== result;
          const latest = notes.at(-1);
          if (latest) {
            latest.read = result;
            latest.crossedOut = false;
            latest.phrase = 'I have not decided what to believe. I doubt this speaker.';
          }
        }
        sc.lines.push({
          speaker: 'Nermin',
          text: `I am not sure I believe ${s.people[ref.id]!.life.sex === 'male' ? 'him' : 'her'}. I will wait before deciding what to believe.`,
          kind: 'speech',
        });
      } else {
        const reply = referenceReply(ref, s.people[ref.id]!, input.choice, s.now);
        const note = addNote(
          s,
          ref.candidate,
          reply.quality,
          reply.value,
          'heard',
          ref.name,
          ref.id,
          reply.text,
        );
        sc.added = [note];
        sc.lines.push({ speaker: ref.name, text: reply.text, kind: 'speech' });
        const follow = referenceFollowUp(ref.candidate, ref.name, reply.text, input.choice);
        s.cards[ref.candidate]!.referenceClaims ??= [];
        const claims = s.cards[ref.candidate]!.referenceClaims!;
        if (!claims.some((c) => c.id === `claim-${ref.id}-${input.choice}`))
          claims.push({ id: `claim-${ref.id}-${input.choice}`, ...follow, quality: reply.quality });
        if (reply.wageDispute) s.cards[ref.candidate]!.wageDispute = ref.name;
        if (input.choice === 'ref-leaving')
          s.cards[ref.candidate]!.referenceDispute = { from: ref.name, story: reply.text };
      }
      s.referenceAsked[sc.id] ??= [];
      s.referenceAsked[sc.id]!.push(input.choice);
      sc.choices = referenceChoices(ref, s.referenceAsked[sc.id]!);
      runTo(s, s.now + 4);
      return s;
    }
    if (sc.kind === 'two-sides' || (sc.kind === 'visit' && ['worker', 'family'].includes(input.choice))) {
      const p = s.placements.find((p) => p.id === s.scenePlacements[sc.id]);
      if (!p || !active(p)) {
        s.scene = null;
        return s;
      }
      if (input.choice === 'worker' || input.choice === 'family') {
        sc.lines.push({
          speaker: input.choice === 'worker' ? name(p.candidate) : name(p.family),
          text:
            input.choice === 'worker'
              ? workerDisagreement(
                  p.candidate,
                  name(p.family),
                  !!s.cards[p.candidate]!.asked.need || !!s.cards[p.candidate]!.asked.hours,
                )
              : familyDisagreement(p),
          kind: 'speech',
        });
        sc.choices = interventionChoices(p);
        sc.kind = 'two-sides';
      } else intervention(s, p, sc, input.choice);
      return s;
    }
    if (sc.kind === 'interview') {
      const c = CANDIDATES.find((p) => p.id === sc.with)!;
      const card = s.cards[c.id]!;
      if (['finish', 'wait-bench', 'send-home'].includes(input.choice)) {
        card.status = input.choice === 'wait-bench' ? 'bench' : 'books';
        const words =
          input.choice === 'wait-bench'
            ? 'I will wait on the bench. Please do not forget me.'
            : 'I will go home, then. You have my number; call when you have an answer.';
        sc.lines.push({ speaker: c.name, text: words, kind: 'speech' });
        log(s, 'arrival', `${c.name}: “${words}”`, { candidate: c.id });
        sc.choices = [{ id: 'done', label: 'End the conversation' }];
        return s;
      }
      if (input.choice === 'coach') {
        card.coached.push('hardworking');
        card.lastQuestion = undefined;
        const promise = contextualConcern(c.id, c.roles[0]!).promise;
        sc.lines.push(
          { speaker: 'Nermin', text: promise, kind: 'speech' },
          { speaker: c.name, text: 'If that helps me get the job, I will say it.', kind: 'speech' },
        );
        log(s, 'word', `You coached ${c.name}: ${promise} The family will remember.`, { candidate: c.id });
      } else {
        card.asked[input.choice] = 1;
        card.lastQuestion = input.choice;
        card.interviewCount++;
        card.interviewUntil = s.now + 120;
        let text: string;
        if (personalQuestions(c.id).some((q) => q.id === input.choice)) {
          text = personalAnswer(c.id, input.choice);
          if (input.choice === 'wage') card.wageKnown = true;
          if (input.choice === 'last-family') card.experience = c.skills;
          if (['hours', 'need'].includes(input.choice)) card.wants = workerNeed(c.id).words;
        } else if (card.referenceClaims?.some((claim) => claim.id === input.choice)) {
          const claim = card.referenceClaims.find((claim) => claim.id === input.choice)!;
          text = claim.reply;
          sc.added = [addNote(s, c.id, claim.quality, 0.5, 'says', c.name, c.id, text)];
        } else if (input.choice === 'follow-reference') {
          text = `That is how ${card.referenceDispute!.from} remembers it. ${personalAnswer(c.id, 'why-left').replace(/\.\s+/g, '. ')}`;
          sc.added = [addNote(s, c.id, 'reliable', 0.65, 'says', c.name, c.id, text)];
        } else if (input.choice === 'follow-wages') {
          text =
            c.presentation === 'reserved'
              ? 'Two months of wages were late. I asked for them.'
              : c.presentation === 'chatty'
                ? 'An argument, they called it! I paid for the bus every day while my wages stayed unpaid.'
                : 'I asked for the wages we had agreed. My former employer called that an argument.';
          sc.added = [addNote(s, c.id, 'honest', 0.78, 'says', c.name, c.id, text)];
        } else {
          const a = answer(s.people[c.id]!, c.presentation, c.roles[0]!, input.choice, 0);
          text = a.text;
          sc.added = [addNote(s, c.id, a.quality, a.claim, 'says', c.name, c.id, text)];
          if (input.choice === 'q-reliable') text += ` ${contextualConcern(c.id, c.roles[0]!).concern}`;
        }
        sc.lines.push({ speaker: c.name, text, kind: 'speech' });
        log(s, 'word', `${c.name}: “${text}”`, { candidate: c.id });
        if (!s.eventKeys.includes('opening-phone')) {
          s.eventKeys.push('opening-phone');
          queue(
            s,
            'arslans',
            scene(
              s,
              'phone',
              'arslans',
              'The household is checking',
              'Have you found someone? We need someone to care for the children tomorrow morning. Please confirm the duties and how the worker will take over before agreeing.',
              [
                { id: 'look', label: 'Say you are still interviewing' },
                { id: 'soon', label: 'Promise an answer today' },
              ],
            ),
          );
        }
      }
      runTo(s, s.now + 8 + (hash(`${s.seed}:${c.id}:${input.choice}`) % 5));
      tick(s.people[c.id]!, s.now);
      sc.choices = interviewChoices(s, c.id);
      sc.interviewPace = interviewPace(s, c.id);
      if (card.interviewCount >= 4) {
        card.status = 'books';
        sc.lines.push({
          speaker: c.name,
          text: `I have to leave now. You have my number. Call after ${label(card.interviewUntil)} and allow time for me to travel.`,
          kind: 'speech',
        });
        sc.choices = [{ id: 'done', label: 'Let the candidate go home' }];
      }
      return s;
    }
    if (sc.kind === 'offer') offerChoice(s, sc, input.choice);
    if (input.choice === 'support') {
      const p = s.placements.find((p) => p.id === s.scenePlacements[sc.id]);
      if (p && active(p)) {
        sc.kind = 'two-sides';
        sc.choices = interventionChoices(p);
        return s;
      }
    }
    if (input.choice === 'replace') {
      const p = s.placements.find((p) => p.id === s.scenePlacements[sc.id]);
      if (p && !active(p)) {
        reopen(s, p);
        log(s, 'word', `${name(p.family)} needs another worker. Choose a candidate who is available.`, {
          family: p.family,
        });
      }
    }
    if (input.choice === 'decline') {
      const r = s.requests.find((r) => r.family === sc.with && r.status === 'open');
      if (r) {
        r.status = 'lost';
        r.lostReason = 'Nermin declined the request. The family is looking elsewhere.';
      }
    }
    s.scene = null;
    runTo(s, s.now + 3);
    return s;
  }
  if (input.type === 'answer-phone' && s.phones.length && s.scene?.yieldsToPhone) {
    log(s, 'word', 'Nermin: “Excuse me. I need to answer the phone.”');
    s.scene = null;
  }
  if (
    input.type === 'answer-phone' &&
    s.phones.length &&
    s.scene &&
    ['interview', 'reference'].includes(s.scene.kind) &&
    !s.heldScene
  ) {
    s.heldScene = s.scene;
    s.heldScene.lines.push({
      speaker: 'Nermin',
      text: 'Excuse me. I need to answer the phone.',
      kind: 'speech',
    });
    log(s, 'word', 'Nermin asked to pause the conversation and answer the phone.');
    s.scene = null;
  }
  if (s.scene) {
    refuse(s, 'Finish this conversation first.');
    return s;
  }
  if (input.type === 'answer-phone') {
    const p = s.phones.shift();
    if (p) {
      revalidatePhone(s, p);
      s.scene = p.scene;
      if (p.placement && p.scene.kind !== 'confidence') {
        const placement = s.placements.find((a) => a.id === p.placement);
        if (placement) {
          deliverReport(s, placement, false, p.through);
          if (
            p.status &&
            ['trial', 'kept'].includes(placement.reportedStatus) &&
            (p.status !== 'trial' || placement.reportedStatus === 'trial')
          )
            placement.reportedStatus = p.status;
          if (p.scene.kind === 'verdict' && placement.pendingFee) {
            s.cash += placement.pendingFee;
            log(s, 'money', `${name(placement.family)} sent the rest of the fee: ₺${placement.pendingFee}.`);
            placement.pendingFee = 0;
          }
          if (['returned', 'dismissed', 'quit'].includes(placement.reportedStatus)) reopen(s, placement);
        }
      }
      const trial = s.trialReports?.[p.scene.id];
      if (trial) {
        s.scene.added = [
          addNote(s, trial.candidate, trial.quality, trial.value, 'heard', trial.from, trial.source),
        ];
        delete s.trialReports![p.scene.id];
      }
      if (p.scene.kind === 'confidence') recordConfidence(s, p.scene.with);
      if (p.scene.kind === 'two-sides' && p.placement) {
        const placed = s.placements.find((a) => a.id === p.placement);
        if (placed) rememberNeed(s, placed);
      }
      log(s, 'word', `${p.who}: “${p.scene.lines[0]!.text}”`);
    }
    return s;
  }
  if (
    ['interview', 'take-number', 'call-reference', 'trial', 'place'].includes(input.type) &&
    (day(s) % 7 === 6 || s.now % DAY < 510 || s.now % DAY >= 1140)
  ) {
    refuse(s, 'The office opens at 08:30, Monday to Saturday.');
    return s;
  }
  if (input.type === 'take-number') {
    const card = s.cards[input.candidate];
    if (!card || card.status !== 'bench') {
      refuse(s, 'You can take a phone number only from someone waiting on the bench.');
      return s;
    }
    card.status = 'books';
    card.introduced = true;
    log(
      s,
      'arrival',
      `You took ${name(input.candidate)}’s number. ${name(input.candidate)} went home. You have the contact details.`,
      { candidate: input.candidate },
    );
    runTo(s, s.now + 2);
    return s;
  }
  if (input.type === 'interview') {
    const c = CANDIDATES.find((p) => p.id === input.candidate);
    const card = s.cards[input.candidate];
    if (!c || !card?.met || !['bench', 'books'].includes(card.status)) {
      refuse(s, 'That candidate is not available for an interview.');
      return s;
    }
    if (card.status !== 'bench' || card.arrivalAt) {
      refuse(s, `${c.name} is away. Call the number you kept and allow time for the journey.`);
      return s;
    }
    if (card.interviewCount >= 4) {
      if (s.now < card.interviewUntil) {
        refuse(s, `${c.name} needs to leave now. Call back after ${label(card.interviewUntil)}.`);
        return s;
      }
      card.interviewCount = 0;
    }
    card.introduced = true;
    glimpse(s.people.nermin!, c.id, outwardSigns(s.people[c.id]!), s.now);
    s.scene = scene(
      s,
      'interview',
      c.id,
      `Interview: ${c.name}`,
      `${c.name} sat across from your desk. ${c.look}`,
      interviewChoices(s, c.id),
    );
    s.scene.lines[0]!.kind = 'narration';
    s.scene.interviewPace = interviewPace(s, c.id);
    log(s, 'word', `You began an interview with ${c.name}.`, { candidate: c.id });
    return s;
  }
  if (input.type === 'call-reference') {
    const ref = REFEREES.find((r) => r.id === input.referee && r.candidate === input.candidate);
    const c = CANDIDATES.find((p) => p.id === input.candidate);
    const card = s.cards[input.candidate];
    if (!ref || !c || !card?.met) return s;
    if (card.called.includes(ref.id)) {
      refuse(s, `${ref.name} has already given an account of ${c.name}’s work.`);
      return s;
    }
    if (s.now % DAY < ref.reachableAt) {
      refuse(s, `${ref.name} is at work and cannot answer until ${timeLabel(ref.reachableAt)}.`);
      return s;
    }
    if (!card.called.includes(ref.id)) card.called.push(ref.id);
    card.introduced = true;
    s.scene = scene(
      s,
      'reference',
      ref.id,
      `Reference: ${c.name}`,
      referenceOpening(ref, s.people[c.id]!),
      referenceChoices(ref, []),
    );
    const opening = referenceFollowUp(c.id, ref.name, s.scene.lines[0]!.text, 'ref-opening');
    card.referenceClaims ??= [];
    const claims = card.referenceClaims;
    if (!claims.some((claim) => claim.id === `claim-${ref.id}-opening`))
      claims.push({ id: `claim-${ref.id}-opening`, ...opening, quality: 'reliable' });
    s.referenceAsked[s.scene.id] = [];
    log(s, 'word', `${ref.name}: “${s.scene.lines[0]!.text}”`, { candidate: c.id });
    runTo(s, s.now + 15);
    return s;
  }
  if (input.type === 'place' || input.type === 'trial') {
    const c = CANDIDATES.find((c) => c.id === input.candidate);
    const card = s.cards[input.candidate];
    const f = FAMILIES.find((f) => f.id === input.family);
    const r = s.requests.find((r) => r.family === input.family && r.status === 'open');
    if (!c || !f || !card?.met || !r || !['bench', 'books'].includes(card.status)) {
      refuse(s, 'You need an available candidate and a family that is still looking for a worker.');
      return s;
    }
    if (
      s.placements.some(
        (p) =>
          p.candidate === c.id &&
          !['trial', 'kept'].includes(p.status) &&
          ['trial', 'kept'].includes(p.reportedStatus),
      )
    ) {
      refuse(s, 'Hear the family’s call before making another placement.');
      return s;
    }
    if (!c.roles.includes(r.role)) {
      refuse(s, `${c.name} is not looking for work as a ${r.role}.`);
      return s;
    }
    if (input.type === 'trial' && c.wage > r.wage && !card.coached.length) {
      card.wageKnown = true;
      const words = `I need ₺${c.wage}. This family offers ₺${r.wage}; that is not enough for my household expenses. Choose another family or worker.`;
      s.scene = scene(s, 'phone', c.id, `${c.name}: the wage`, words);
      refuse(s, `${c.name}: “${words}”`);
      return s;
    }
    if (card.refuses.some((a) => a.family === f.id)) {
      refuse(s, `${c.name}: “I will not work for ${f.name}. I have heard enough about them.”`);
      return s;
    }
    if (input.type === 'trial') {
      card.status = 'trial';
      delete card.arrivalAt;
      delete card.returnAt;
      r.by = Math.max(r.by, (day(s) + 1) * DAY + 1080);
      r.byLabel = label(r.by);
      s.eventKeys.push(`trial:${c.id}:${f.id}:${(day(s) + 1) * DAY + 720}`);
      log(
        s,
        'placement',
        `${c.name} will spend tomorrow morning with ${f.name}. Their answer is due at noon.`,
        { candidate: c.id, family: f.id },
      );
      runTo(s, s.now + 12);
      return s;
    }
    if (
      !s.negotiationAgreed ||
      s.negotiationAgreed.candidate !== c.id ||
      s.negotiationAgreed.family !== f.id
    ) {
      const terms: EmploymentTerms = {
        wage: r.wage,
        startHour: 8,
        endHour: 18,
        dayOff: 6,
        trialDays: 7,
        fee: r.wage,
      };
      const sc = scene(
        s,
        'negotiation',
        c.id,
        `${c.name} and ${f.name}: an agreement`,
        `Shall we agree on the work? ${termsWords(terms)}`,
        [],
      );
      sc.lines[0]!.speaker = 'Nermin';
      sc.negotiation = { candidate: c.id, family: f.id, terms, worker: 'pending', familyResponse: 'pending' };
      s.negotiationVouches ??= {};
      s.negotiationVouches[sc.id] = [...input.vouch];
      s.scene = sc;
      proposeTerms(s, sc, terms);
      return s;
    }
    const agreed = s.negotiationAgreed.terms;
    delete s.negotiationAgreed;
    const vouched = [...new Set(input.vouch)].filter((q) => QUALITIES.includes(q));
    const p: Placement = {
      id: `placement-${s.placements.length + 1}`,
      candidate: c.id,
      family: f.id,
      role: r.role,
      since: s.now,
      checkInAt: workDayAfter(day(s), agreed.dayOff) * DAY + Math.max(1100, agreed.endHour * 60 + 20),
      trialEnds: trialEnd(s.now, agreed),
      terms: structuredClone(agreed),
      seems: 'unknown',
      status: 'trial',
      reportedStatus: 'trial',
      pendingFee: 0,
      vouched,
      story: [],
      moments: [],
      reported: 0,
      confidenceGiven: false,
      wage: agreed.wage,
    };
    s.placements.push(p);
    if (card.coached.length)
      log(
        s,
        'word',
        `${name(f.id)} accepted ${c.name} at the wage the worker asked for after hearing the promise to finish the agreed work on time.`,
        { candidate: c.id, family: f.id },
      );
    card.status = 'placed';
    delete card.arrivalAt;
    delete card.returnAt;
    believe(s.people[c.id]!, 'nermin:reliable', true, 0.9, 'self', s.now);
    r.status = 'filled';
    s.fees[f.id] ??= { first: false, second: false };
    const fee = s.fees[f.id]!;
    const firstPaid = fee.first ? 0 : Math.min(agreed.fee, agreed.wage / 4);
    if (!fee.first) fee.deposit = firstPaid;
    fee.first = true;
    s.cash += firstPaid;
    for (const q of [...new Set([...vouched, ...card.coached])])
      believe(s.people[`${f.id}-0`]!, `${c.id}:${q}`, true, 0.92, 'nermin', s.now);
    log(
      s,
      'placement',
      `${c.name} will work for ${f.name}. ${firstPaid ? `The deposit, ₺${firstPaid}, is in the cash box. The rest is due if the family keeps the worker after the agreed trial.` : agreed.fee === 0 ? `No agency fee is due under these terms.` : `The earlier deposit pays for this replacement.`}`,
      { candidate: c.id, family: f.id, placement: p.id },
    );
    runTo(s, s.now + 15);
    return s;
  }
  if (input.type === 'check-in' || input.type === 'withdraw') {
    const p = s.placements.find((p) => p.id === input.placement);
    if (!p || !['trial', 'kept'].includes(p.status)) {
      refuse(s, 'That placement has ended.');
      return s;
    }
    if (input.type === 'withdraw') {
      interruptPlacement(s.people[p.candidate]!, s.now);
      reopen(s, p);
      p.status = 'withdrawn';
      delete p.pending;
      delete p.warning;
      p.reportedStatus = 'withdrawn';
      s.cards[p.candidate]!.status = 'books';
      p.story.push(`Nermin ended ${name(p.candidate)}’s placement on ${dateLabel(s.now)}.`);
      log(s, 'placement', `You brought ${name(p.candidate)} back from ${name(p.family)}.`, {
        placement: p.id,
      });
      runTo(s, s.now + 20);
      return s;
    }
    if (s.now < (p.checkInAt ?? firstWorkDay(p) * DAY + 1100)) {
      refuse(s, `You can first ask for an update at ${label(p.checkInAt ?? firstWorkDay(p) * DAY + 1100)}.`);
      return s;
    }
    if (input.how === 'visit') {
      const f = FAMILIES.find((f) => f.id === p.family)!;
      moment(s, p, f.pressure, p.moments.length + 10);
      deliverReport(s, p, true);
      s.scene = scene(
        s,
        'visit',
        p.candidate,
        `Visit: ${name(p.candidate)} at ${name(p.family)}`,
        p.moments.at(-1)!.text,
        [
          { id: 'worker', label: `Talk to ${name(p.candidate)}` },
          { id: 'family', label: 'Talk to the family' },
        ],
      );
      s.scene.lines[0] = {
        speaker: '',
        text: `You arrived at ${name(p.family)}. ${p.moments.at(-1)!.text}`,
        kind: 'narration',
      };
    } else if (input.how === 'drop-by') {
      s.cards[p.candidate]!.wants = workerNeed(p.candidate).words;
      s.scene = scene(
        s,
        'two-sides',
        p.candidate,
        `${name(p.candidate)} drops by`,
        workerDisagreement(
          p.candidate,
          name(p.family),
          !!s.cards[p.candidate]!.asked.need || !!s.cards[p.candidate]!.asked.hours,
        ),
        interventionChoices(p),
      );
    } else {
      deliverReport(s, p);
      s.scene = scene(
        s,
        'check-in',
        p.family,
        `Call: ${name(p.family)}`,
        p.lastWord ?? familyDisagreement(p),
        [
          { id: 'listen', label: 'Hear the family' },
          { id: 'support', label: `Speak for ${name(p.candidate)}` },
        ],
      );
    }
    s.scenePlacements[s.scene.id] = p.id;
    p.checkInAt = (day(s) + 1) * DAY + 720;
    runTo(s, s.now + (input.how === 'visit' ? 90 : 15));
    return s;
  }
  return s;
}
export function view(state: State): View {
  if (state.version === 1) return legacy.view(state as legacy.State);
  if (state.version === 2) return previous.view(state as previous.State);
  if (state.version === 3) return third.view(state as third.State);
  if (state.version === 4) return fourth.view(state as fourth.State);
  const cached = snapshots.get(state);
  if (cached) return cached;
  const s = sim(state);
  const t = s.now % DAY;
  const cards: CandidateView[] = CANDIDATES.filter((c) => s.cards[c.id]!.met).map((c) => {
    const card = s.cards[c.id]!;
    const elapsed = s.now - card.arrived;
    const placement = s.placements.findLast((p) => p.candidate === c.id && active(p));
    const terms = placement?.terms;
    const atWork =
      placement &&
      day(s) % 7 !== (terms?.dayOff ?? 6) &&
      t >= (terms?.startHour ?? 8) * 60 &&
      t < (terms?.endHour ?? 18) * 60;
    return {
      id: c.id,
      presence: card.arrivalAt
        ? 'travelling'
        : card.status === 'bench'
          ? 'office'
          : atWork
            ? 'working'
            : 'home',
      ...(card.arrivalAt ? { arrival: { at: card.arrivalAt, dateLabel: label(card.arrivalAt) } } : {}),
      ...(card.status !== 'bench'
        ? {
            interviewUnavailable: card.arrivalAt
              ? `${c.name} is on the way and will arrive at ${label(card.arrivalAt)}.`
              : card.status === 'gone'
                ? `${c.name} left without leaving a number. You cannot call. The candidate may return another morning.`
                : `${c.name} is away. Call the number you kept and allow time for the journey.`,
          }
        : {}),
      name: c.name,
      age: c.age,
      roles: c.roles,
      look: c.look,
      ...(card.interviewCount >= 4 && s.now < card.interviewUntil
        ? { interviewAfter: card.interviewUntil }
        : {}),
      status:
        card.status === 'books' &&
        s.placements.some(
          (p) =>
            p.candidate === c.id &&
            !['trial', 'kept'].includes(p.status) &&
            ['trial', 'kept'].includes(p.reportedStatus),
        )
          ? 'placed'
          : card.status,
      ...(card.status === 'bench'
        ? {
            posture:
              elapsed >= 180
                ? ('leaving' as const)
                : elapsed > 90
                  ? ('restless' as const)
                  : ('settled' as const),
          }
        : {}),
      ...(card.status === 'placed'
        ? {
            busy: `${c.name} works at ${name(s.placements.findLast((p) => p.candidate === c.id)!.family)} and finishes at ${timeLabel((s.placements.findLast((p) => p.candidate === c.id)?.terms?.endHour ?? workerNeed(c.id).finishBy / 60) * 60)}.`,
          }
        : card.status === 'trial'
          ? {
              busy: (() => {
                const key = s.eventKeys.find((k) => k.startsWith(`trial:${c.id}:`));
                const [, , family, at] = key?.split(':') ?? [];
                return `A trial is arranged with ${name(family ?? '')}. Their answer is due at ${label(Number(at))}.`;
              })(),
            }
          : {}),
      ...(card.wants ? { wants: card.wants } : {}),
      wage: card.wageKnown ? c.wage : null,
      experience: card.experience,
      matchReasons: s.requests
        .filter((r) => r.status === 'open' && card.wageKnown && c.wage > r.wage && !card.coached.length)
        .map((r) => ({
          family: r.family,
          words: `${c.name} needs ₺${c.wage}. This family offers ₺${r.wage}. Choose another family or worker.`,
        })),
      notes: card.notes,
      referees: c.referees.map((id) => {
        const r = REFEREES.find((r) => r.id === id)!;
        return {
          id,
          name: r.name,
          reachable: !card.called.includes(id) && t >= r.reachableAt,
          ...(card.called.includes(id)
            ? {
                why: `${r.name} has already told you what ${s.people[r.id]!.life.sex === 'male' ? 'he thinks' : 'she thinks'} of ${c.name}.`,
              }
            : t < r.reachableAt
              ? { why: `At work until ${timeLabel(r.reachableAt)}.` }
              : {}),
          called: card.called.includes(id),
        };
      }),
      refuses: card.refuses,
    };
  });
  const families = FAMILIES.filter((f) => s.requests.some((r) => r.family === f.id)).map((f) => {
    const trust = trustOf(s.people[`${f.id}-0`]!, 'nermin');
    return {
      id: f.id,
      name: f.name,
      district: f.district,
      household: f.household.map((p) => ({
        id: p.id,
        name: p.name,
        who: p.who,
        ...((s.now - s.people[p.id]!.life.bornAt) / (365.25 * 1440) < 18
          ? { phoneUnavailable: 'A child cannot take an agency call. Speak to an adult.' }
          : {}),
      })),
      trust: trust > 0.7 ? ('warm' as const) : trust < 0.45 ? ('cool' as const) : ('polite' as const),
      line: s.familyLines[f.id],
    };
  });
  const bench = cards.filter((c) => c.status === 'bench');
  const r = s.requests.find((r) => r.status === 'open');
  const phone = s.phones[0];
  const urgent = bench.find((c) => c.posture === 'leaving');
  const departing = bench.find((c) => c.interviewAfter !== undefined);
  const task: View['task'] = s.ended
    ? { text: 'The month is over. Compare what happened with what you believed.' }
    : s.scene
      ? { text: s.scene.title, target: { kind: 'scene', id: s.scene.id } }
      : phone
        ? {
            text: `${cap(name(phone.who))} is calling.`,
            target: { kind: 'phone', id: 'phone' },
          }
        : departing
          ? {
              text: `${departing.name} has to go now. Take ${s.people[departing.id]!.life.sex === 'male' ? 'his' : 'her'} number to call ${s.people[departing.id]!.life.sex === 'male' ? 'him' : 'her'} after ${callbackTime(s, departing.interviewAfter!)}.`,
              target: { kind: 'candidate', id: departing.id },
            }
          : urgent
            ? {
                text: `${urgent.name} will stop waiting at about ${timeLabel(s.cards[urgent.id]!.arrived + 210 + (hash(urgent.id) % 90))}. Interview ${s.people[urgent.id]!.life.sex === 'male' ? 'him' : 'her'} or take ${s.people[urgent.id]!.life.sex === 'male' ? 'his' : 'her'} number.`,
                target: { kind: 'candidate', id: urgent.id },
              }
            : r
              ? {
                  text: `${cap(name(r.family))}: The family needs a ${r.role} by ${r.byLabel}. ${bench.length ? 'Candidates are waiting on your bench.' : 'You have contact details for the people you have met.'}`,
                  target: { kind: 'family', id: r.family },
                }
              : {
                  text: nextEvent(s)
                    ? `Next: ${nextEvent(s)!.label}${/[.!?]$/.test(nextEvent(s)!.label) ? '' : '.'} Wait or meet someone on your bench.`
                    : 'Meet someone on your bench, or read the notes you kept.',
                };
  const snapshot: View = structuredClone({
    next: nextEvent(s),
    simulation: s.version,
    guests: guestViews(s),
    castContacts: castContacts(s),
    seed: s.seed,
    now: s.now,
    dateLabel: dateLabel(s.now),
    timeLabel: timeLabel(s.now),
    speed: s.speed,
    slowed: !!(s.scene || phone || urgent || departing || s.dayCard),
    open: day(s) % 7 !== 6 && t >= 510 && t < 1140,
    cash: s.cash,
    rent: { due: s.rentDue, amount: 5000, label: label(s.rentDue), short: s.cash < 5000 },
    task,
    phoneRinging: phone ? { who: phone.who, since: phone.since } : null,
    scene:
      s.scene?.kind === 'interview'
        ? { ...s.scene, questionsRemaining: Math.max(0, 4 - s.cards[s.scene.with]!.interviewCount) }
        : s.scene,
    heldScene: s.heldScene ? { id: s.heldScene.id, title: s.heldScene.title } : null,
    bench,
    books: cards.filter((c) => c.status !== 'bench'),
    requests: s.requests,
    families,
    placements: s.placements.map(
      ({
        story: _story,
        moments: _moments,
        reported: _reported,
        confidenceGiven: _confidenceGiven,
        wage: _wage,
        reportedStatus,
        pendingFee: _pendingFee,
        disagreement: _disagreement,
        bendUntil: _bendUntil,
        lastWorkAccountStart: _lastWorkAccountStart,
        arrangementMode: _arrangementMode,
        arrangementKept: _arrangementKept,
        warning: _warning,
        ...p
      }) => ({ ...p, status: reportedStatus }),
    ),
    log: s.log.map((line, index) => {
      // The queue records its named caller immediately before the office account.
      // Project that attribution without changing persisted narration or replay hashes.
      const caller = s.log[index - 1]?.text.match(/^There is a call from (.+)\.$/u)?.[1];
      return line.kind === 'city' && line.text.startsWith('At the office: ') && caller
        ? { ...line, text: `${caller} says: “${line.text.slice('At the office: '.length)}”` }
        : line;
    }),
    city: {
      figures: [
        ...families.map((f) => {
          const def = FAMILIES.find((d) => d.id === f.id)!;
          const out = day(s) % 7 !== 6 && t >= 720 && t < 810;
          const progress = (t - 720) / 90;
          return {
            id: f.id,
            name: f.name,
            x: out ? def.x + (0.49 - def.x) * progress : def.x,
            y: out ? def.y + (0.43 - def.y) * progress : def.y,
            ...(out ? { toX: 0.49, toY: 0.43, arrive: day(s) * DAY + 810 } : {}),
            kind: 'family' as const,
            mood: s.people[`${f.id}-0`]!.affect.mood.valence < -0.15 ? ('upset' as const) : ('easy' as const),
            place: out ? 'on the way to the market' : `at ${f.name}`,
          };
        }),
        ...cards
          .filter(
            (c) =>
              c.status !== 'gone' ||
              s.threads.some((t) => t.at <= s.now && t.end >= s.now && [t.from, t.to].includes(c.id)),
          )
          .map((c) => cityFigure(s, c)),
        ...CANDIDATES.filter(
          (c) =>
            !s.cards[c.id]!.met &&
            s.threads.some((t) => t.at <= s.now && t.end >= s.now && [t.from, t.to].includes(c.id)),
        ).map((c) => cityFigure(s, { id: c.id, name: c.name, status: 'books' })),
      ],
      threads: s.threads,
      houses: FAMILIES.filter((f) => s.requests.some((r) => r.family === f.id)).map((f) => ({
        family: f.id,
        x: f.x,
        y: f.y,
      })),
    },
    dayCard: s.dayCard,
    ended: s.ended,
    review: s.review,
  });
  snapshots.set(state, snapshot);
  return snapshot;
}
export function replay(
  seed: number,
  inputs: LoggedInput[],
  until: number,
  version: 1 | 2 | 3 | 4 | 5 | 6 = 6,
  admissions: GuestAdmission[] = [],
  chapter?: AgencyChapter,
): State {
  if (version === 1) return legacy.replay(seed, inputs as legacy.LoggedInput[], until);
  if (version === 2) return previous.replay(seed, inputs as previous.LoggedInput[], until);
  if (version === 3) return third.replay(seed, inputs as third.LoggedInput[], until);
  if (version === 4) return fourth.replay(seed, inputs as fourth.LoggedInput[], until);
  if (version === 5)
    throw new Error(
      'This saved game uses an older cast. Start a new game. You can keep the exported file to read later.',
    );
  const s = sim(newGame(seed, version, admissions, chapter));
  for (const entry of inputs) {
    if (entry.at > until) break;
    if (entry.at < s.now) throw new Error('Run inputs are out of order.');
    runTo(s, entry.at);
    apply(s, entry.input);
  }
  runTo(s, until);
  saveFramework(s);
  return s;
}
export function fingerprint(state: State): string {
  return hash(JSON.stringify(state)).toString(16).padStart(8, '0');
}
export function milestones(prev: View, next: View): string[] {
  const out: string[] = [];
  if (
    prev.now === 510 &&
    !prev.log.some((l) => l.text.startsWith('You began')) &&
    next.log.some((l) => l.text.startsWith('You began'))
  )
    out.push('run started');
  const before = [...prev.bench, ...prev.books];
  const after = [...next.bench, ...next.books];
  if (
    !before.some((c) => c.notes.some((n) => n.source === 'says')) &&
    after.some((c) => c.notes.some((n) => n.source === 'says'))
  )
    out.push('first interview');
  if (!prev.placements.length && next.placements.length) out.push('first placement');
  if (
    !prev.placements.some((p) => ['kept', 'returned'].includes(p.status)) &&
    next.placements.some((p) => ['kept', 'returned'].includes(p.status))
  )
    out.push('first trial verdict');
  if (
    !prev.log.some((l) => l.text.includes('in confidence')) &&
    next.log.some((l) => l.text.includes('in confidence'))
  )
    out.push('first confidence');
  for (let week = 1; week <= 3; week++)
    if (prev.now < week * 7 * DAY && next.now >= week * 7 * DAY) out.push(`week ${week} done`);
  if (!prev.ended && next.ended) out.push('month ended');
  return out;
}

// Household outcomes are private host history. Only deliverReport or a witnessed visit
// may copy them into Nermin's notes. No view reads these moments directly.
function moment(s: Sim, p: Placement, q: Quality, ordinal: number, workAt = s.now) {
  const workDay = Math.floor(workAt / DAY);
  const f = FAMILIES.find((f) => f.id === p.family)!;
  const worker = s.people[p.candidate]!;
  const skill = skillLevel(worker, ROLE_SKILL[p.role]);
  const fatigue = worker.body.exertion;
  const ability = ['honest', 'discreet'].includes(q)
    ? quality(worker, q)
    : 0.72 * quality(worker, q) + 0.28 * skill;
  const good =
    ability +
      (p.arrangementKept ? 0.045 : 0) +
      (s.cards[p.candidate]!.coached.length && workDay - Math.floor(p.since / DAY) === 1 ? 0.16 : 0) -
      fatigue * 0.08 >
    0.23 + 0.48 * roll(s, `moment:${p.id}:${workDay}:${ordinal}`);
  const text = familyMoment(f.id, q, good, name(p.candidate));
  p.moments.push({ day: workDay, quality: q, good, text });
  p.story.push(`${dateLabel(workAt)}: ${text}`);
  for (const member of f.household) {
    const observer = s.people[member.id]!;
    observeAct(
      observer,
      worker.id,
      { at: s.now, tags: ['work'], withId: member.id, toward: good ? 0.6 : -0.4 },
      actTable(q, good, 'work'),
    );
    hear(observer, worker.id, `skill:${ROLE_SKILL[p.role]}`, good ? 0.85 : 0.25, s.now, 1);
    hear(observer, worker.id, cue(q), good ? 0.85 : 0.2, s.now, 1);
    confirm(observer, `${worker.id}:${q}`, good, s.now);
    const sourceTrust = trustOf(observer, 'nermin');
    if (sourceTrust > 0.52 || sourceTrust < 0.48)
      confirm(observer, 'nermin:reliable', sourceTrust > 0.5, s.now);
    // Families remember the coached words as Nermin's recommendation, too.
    socialEvent(worker, {
      at: s.now,
      kind: good ? 'help' : 'conflict',
      otherId: member.id,
      byMe: false,
      magnitude: good ? 0.25 : 0.45,
    });
  }
  const hardHouse = f.household.some((m) => s.people[m.id]!.traits.agreeableness < 0.3);
  perceive(worker, [
    {
      at: s.now,
      channel: 'social',
      kind: good ? 'thanks' : 'conflict',
      actorId: f.household[0]!.id,
      targetId: worker.id,
      salience: 0.8,
      valence: good ? 0.2 : -0.45,
      summary: text,
    },
  ]);
  if (
    p.disagreement &&
    q === 'honest' &&
    !good &&
    worker.traits.honesty < 0.3 &&
    roll(s, `temptation:${p.id}:${day(s)}`) < 0.55
  ) {
    p.story.push(`${dateLabel(s.now)}: Shopping money went missing. ${name(p.candidate)} kept it.`);
    endPlacement(
      s,
      p,
      'dismissed',
      'The shopping money is missing. I cannot leave the worker in charge here.',
    );
  }
}
function endPlacement(s: Sim, p: Placement, status: Placement['status'], words: string) {
  if (!['trial', 'kept'].includes(p.status)) return;
  interruptPlacement(s.people[p.candidate]!, s.now);
  p.status = status;
  delete p.pending;
  delete p.warning;
  s.cards[p.candidate]!.status = 'books';
  p.story.push(`${dateLabel(s.now)}: ${words}`);
  queue(
    s,
    status === 'quit' ? p.candidate : p.family,
    scene(
      s,
      'phone',
      status === 'quit' ? p.candidate : p.family,
      `${name(p.candidate)}: placement ended`,
      words,
      [
        { id: 'acknowledge', label: 'Hear the final decision' },
        { id: 'replace', label: 'Offer to find a replacement' },
      ],
    ),
    p.id,
  );
}
function reportWords(s: Sim, p: Placement, through = p.moments.length): string {
  const unseen = p.moments.slice(p.reported, through);
  const m =
    unseen.find((m) => p.vouched.includes(m.quality)) ?? unseen.at(-1) ?? p.moments.slice(0, through).at(-1);
  if (!m) return 'We have begun the morning.';
  const speaker = s.people[`${p.family}-0`]!;
  const words = referenceWordsForMoment(
    p,
    m.quality,
    clamp((m.good ? 0.85 : 0.2) + (speaker.traits.honesty < 0.5 ? -0.28 : 0)),
  );
  return p.vouched.includes(m.quality)
    ? `You said the worker was ${m.quality}. ${words} ${m.good ? 'You were right about this worker.' : 'That is not what you promised us.'}`
    : words;
}
function deliverReport(s: Sim, p: Placement, visit = false, through = p.moments.length) {
  const unseen = p.moments.slice(p.reported, through);
  const spoken = reportWords(s, p, through);
  const f = FAMILIES.find((f) => f.id === p.family)!;
  const speaker = s.people[f.household[0]!.id]!;
  if (!unseen.length) return;
  for (const m of unseen) {
    const hidden = m.good ? 0.85 : 0.2;
    const remembered = clamp(
      hidden + (speaker.traits.honesty < 0.5 ? (speaker.traits.agreeableness < 0.5 ? -0.28 : 0.22) : 0),
    );
    addNote(
      s,
      p.candidate,
      m.quality,
      visit ? (m.good ? 0.85 : 0.2) : remembered,
      visit ? 'seen' : 'heard',
      visit ? `I saw ${name(p.candidate)} at work` : f.name,
      visit ? 'nermin' : speaker.id,
      visit ? m.text : referenceWordsForMoment(p, m.quality, remembered),
    );
    if (visit)
      observeAct(
        s.people.nermin!,
        p.candidate,
        { at: s.now, tags: ['work'] },
        actTable(m.quality, m.good, 'work'),
      );
  }
  p.reported = Math.max(p.reported, through);
  const latest = unseen.at(-1)!;
  p.seems = unseen.filter((m) => m.good).length >= unseen.length / 2 ? 'good' : 'trouble';
  p.lastWord = visit ? latest.text : spoken;
  s.familyLines[p.family] = p.lastWord;
  log(s, 'word', `${f.name}: “${p.lastWord}”`, {
    placement: p.id,
    candidate: p.candidate,
    family: p.family,
  });
}
function startPlacementWork(s: Sim) {
  for (const p of s.placements) {
    if (
      !active(p) ||
      day(s) <= Math.floor(p.since / DAY) ||
      day(s) % 7 === (p.terms?.dayOff ?? 6) ||
      s.now % DAY !== (p.terms?.startHour ?? 9) * 60
    )
      continue;
    const worker = s.people[p.candidate]!;
    tick(worker, s.now);
    const hours = (p.terms?.endHour ?? 18) - (p.terms?.startHour ?? 9);
    const requested = CANDIDATES.find((c) => c.id === p.candidate)!.wage;
    // These are authored household terms, not an HF need-update formula.
    const autonomy =
      (hours <= 9 ? 0.025 : -0.035) +
      ((p.terms?.endHour ?? 18) * 60 > workerNeed(p.candidate).finishBy ? -0.065 : 0);
    const safety = Math.max(-0.06, Math.min(0.08, 0.018 + (p.wage / requested - 1) * 0.12));

    if (
      !schedulePlacement(worker, s.now, p.terms?.endHour ?? 18, {
        skill: ROLE_SKILL[p.role],
        psychological: { autonomy, safety },
      })
    )
      p.story.push(`${dateLabel(s.now)}: ${name(p.candidate)} did not start the household work.`);
  }
}
function placementDay(s: Sim) {
  for (const p of s.placements) {
    if (!['trial', 'kept'].includes(p.status) || day(s) <= Math.floor(p.since / DAY)) continue;
    const worker = s.people[p.candidate]!;
    if (day(s) % 7 === (p.terms?.dayOff ?? 6)) {
      p.story.push(`${dateLabel(s.now)}: ${name(p.candidate)} rested at home on the agreed day off.`);
    }
    tick(worker, s.now);
    const work = placementWorkForReport(worker, s.now, p.since, p.lastWorkAccountStart);
    if (!work) continue;
    p.lastWorkAccountStart = work.start;
    const workAt = work.start / 60000;
    const workDay = Math.floor(workAt / DAY);
    const f = FAMILIES.find((f) => f.id === p.family)!;
    for (const m of f.household) {
      const member = s.people[m.id]!;
      tick(member, s.now);
    }
    if (day(s) - Math.floor(p.since / DAY) >= 3) {
      const fair = worker.needs.autonomy > 0.3;
      confirm(worker, `${f.id}:kind`, fair, s.now);
      confirm(worker, 'nermin:reliable', fair, s.now);
    }
    const count = 1 + (hash(`${s.seed}:count:${p.id}:${workDay}`) % 3);
    const early = workDay <= firstWorkDay(p) + 1;
    const promises = p.vouched
      .filter((q) => !p.moments.some((m) => m.quality === q))
      .sort(
        (a, b) =>
          Number(s.cards[p.candidate]!.notes.some((n) => n.quality === a && n.source === 'seen')) -
          Number(s.cards[p.candidate]!.notes.some((n) => n.quality === b && n.source === 'seen')),
      );
    if (early) for (const [i, q] of promises.entries()) moment(s, p, q, 200 + i, workAt);
    for (let n = 0; n < count && ['trial', 'kept'].includes(p.status); n++) {
      const q =
        n === 0 ? f.pressure : QUALITIES[hash(`${s.seed}:${p.id}:${workDay}:${n}`) % QUALITIES.length]!;
      moment(s, p, q, n, workAt);
    }
    if (active(p) && s.cards[p.candidate]!.coached.length && day(s) - Math.floor(p.since / DAY) === 3) {
      p.story.push('The family remembered Nermin’s coached promise to finish the work on time.');
      moment(s, p, 'hardworking', 100, workAt);
    }
    if (!['trial', 'kept'].includes(p.status)) continue;
    if (
      (worker.needs.autonomy < 0.22 || (worker.needs.safety < 0.25 && worker.affect.mood.valence < -0.15)) &&
      day(s) - Math.floor(p.since / DAY) >= 4
    ) {
      warnPlacement(s, p, 'quit', `I cannot stay without ${workerNeed(p.candidate).reason}.`);
      continue;
    }
    if (day(s) - Math.floor(p.since / DAY) === 3 && trustOf(worker, 'nermin') >= 0.55 && !p.confidenceGiven) {
      p.confidenceGiven = true;
      queue(
        s,
        p.candidate,
        scene(
          s,
          'confidence',
          p.candidate,
          `${name(p.candidate)} drops by`,
          `${f.secret} Please keep that between us.`,
          [
            { id: 'keep-private', label: 'Promise to keep it private' },
            { id: 'ask-more', label: `Ask how ${name(p.candidate)} is managing` },
          ],
        ),
        p.id,
      );
    }
    if (day(s) - Math.floor(p.since / DAY) >= 1) {
      const prior = p.moments.filter((m) => m.day < day(s));
      if (prior.length && !s.phones.some((ph) => ph.placement === p.id && ph.scene.kind === 'check-in')) {
        queue(
          s,
          p.family,
          scene(s, 'check-in', p.family, `Word from ${f.name}`, reportWords(s, p, prior.length), [
            { id: 'listen', label: 'Listen to what happened' },
            { id: 'support', label: `Ask them to give ${name(p.candidate)} time` },
          ]),
          p.id,
          prior.length,
        );
      }
      // Opening family's first noon report is the deliberate exception to next-day delivery.
    }
  }
}
function verdicts(s: Sim) {
  for (const p of s.placements)
    if (p.status === 'trial' && s.now >= p.trialEnds) {
      const good = p.moments.filter((m) => m.good).length;
      const kept = good / Math.max(1, p.moments.length) >= 0.6;
      p.status = kept ? 'kept' : 'returned';
      s.fees[p.family] ??= { first: true, second: false };
      const fee = s.fees[p.family]!;
      const secondPaid =
        kept && !fee.second
          ? p.terms
            ? Math.max(0, p.terms.fee - (fee.deposit ?? 0))
            : (p.wage * 3) / 4
          : 0;
      if (kept) {
        p.pendingFee = secondPaid;
        fee.second = true;
      } else {
        s.cards[p.candidate]!.status = 'books';
        delete p.pending;
        delete p.warning;
      }
      const words = kept
        ? 'We would like the worker to stay. The work is going more smoothly. The rest of your fee is ready.'
        : 'The placement has not worked. We need someone who can manage the mornings without us standing by.';
      p.story.push(`${dateLabel(s.now)}: ${words}`);
      const family = s.people[`${p.family}-0`]!;
      believe(family, 'nermin:reliable', true, 0.9, 'nermin', s.now);
      confirm(family, 'nermin:reliable', kept, s.now);
      const worker = s.people[p.candidate]!;
      sourceResponse(worker, 'nermin', kept, s.now);
      confirm(worker, `${p.family}:kind`, kept, s.now);
      confirm(worker, 'nermin:reliable', kept, s.now);
      queue(
        s,
        p.family,
        scene(s, 'verdict', p.family, `Trial week: ${name(p.candidate)}`, words, [
          { id: 'thank', label: kept ? 'Thank the family' : 'Accept their answer' },
          ...(kept
            ? [{ id: 'support', label: 'Speak for the worker' }]
            : [{ id: 'replace', label: 'Find a replacement' }]),
        ]),
        p.id,
      );
    }
}
function trialResults(s: Sim) {
  for (const key of [...s.eventKeys]) {
    if (!key.startsWith('trial:')) continue;
    const [, cId, fId, minute] = key.split(':');
    if (s.now < Number(minute)) continue;
    s.eventKeys.splice(s.eventKeys.indexOf(key), 1);
    const c = CANDIDATES.find((c) => c.id === cId)!;
    const f = FAMILIES.find((f) => f.id === fId)!;
    const worker = s.people[c.id]!;
    const good =
      0.7 * quality(worker, f.pressure) +
        0.3 * skillLevel(worker, ROLE_SKILL[f.role]) +
        (s.cards[c.id]!.coached.length ? 0.12 : 0) >
      0.55;
    const observer = s.people[f.household[0]!.id]!;
    observeAct(observer, c.id, { at: s.now, tags: ['trial'] }, actTable(f.pressure, good, 'trial'));
    hear(observer, c.id, cue(f.pressure), good ? 0.85 : 0.2, s.now, 1);
    // The trial was the family's sight. Nermin receives their words, not direct sight.
    const report = scene(
      s,
      'trial-result',
      f.id,
      `Trial morning: ${c.name}`,
      good
        ? `${c.name} settled in. I would like to try a week.`
        : `The morning was difficult. ${c.name} did not seem at ease here.`,
      [
        { id: 'consider', label: 'Consider the placement' },
        { id: 'look', label: 'Keep looking' },
      ],
    );
    report.added = [];
    s.cards[c.id]!.status = 'books';
    queue(s, f.id, report);
    // Report notes are delivered only when this particular phone call is answered.
    s.trialReports ??= {};
    s.trialReports[report.id] = {
      candidate: c.id,
      quality: f.pressure,
      value: good ? 0.85 : 0.2,
      from: f.name,
      source: observer.id,
    };
  }
}
function rent(s: Sim) {
  if (s.now !== s.rentDue) return;
  const due = s.rentDue;
  s.rentDue += 7 * DAY;
  if (s.cash >= 5000) {
    s.cash -= 5000;
    log(s, 'money', 'You paid ₺5000 in rent. Mr Hüsnü left a receipt.');
    return;
  }
  const exchange = scene(
    s,
    'rent',
    'husnu',
    'Mr Hüsnü: the rent',
    'It is Friday. The rent is ₺5000. What can you give me today?',
    [
      {
        id: 'pay-part',
        label: 'Pay what is in the cash box',
        hint: `Pay ₺${s.cash}. The rest is still owed.`,
      },
      { id: 'promise', label: 'Promise to pay next Friday', hint: 'He will record this rent as missed.' },
      ...(!s.eventKeys.includes('sold-ring')
        ? [{ id: 'sell-ring', label: 'Sell the old ring', hint: 'The pharmacy offers ₺2500.' }]
        : []),
    ],
  );
  exchange.canLeave = false;
  s.eventKeys.push(`rent-unpaid:${due}`);
  if (s.scene) queue(s, 'husnu', exchange);
  else s.scene = exchange;
  log(s, 'money', 'Mr Hüsnü is waiting for the rent.');
}
function settleRent(s: Sim, choice: string) {
  if (choice === 'sell-ring') {
    s.cash += 2500;
    s.eventKeys.push('sold-ring');
  }
  const paid = choice === 'promise' ? 0 : Math.min(5000, s.cash);
  s.cash -= paid;
  const key = s.eventKeys.find((k) => k.startsWith('rent-unpaid:'));
  if (key) s.eventKeys.splice(s.eventKeys.indexOf(key), 1);
  if (paid < 5000) {
    s.missedRent++;
    log(
      s,
      'money',
      `Mr Hüsnü accepted ₺${paid}. “That counts as a missed rent payment. I cannot accept two missed payments.”`,
    );
  } else log(s, 'money', 'You paid ₺5000 in rent. Mr Hüsnü left a receipt.');
  s.scene = null;
  if (s.missedRent >= 2)
    finish(s, 'You missed two rent payments. Mr Hüsnü took back the office key. The month ended early.');
}
function overdueRent(s: Sim) {
  const key = s.eventKeys.find((k) => k.startsWith('rent-unpaid:') && s.now >= Number(k.split(':')[1]) + 120);
  if (!key) return;
  s.eventKeys.splice(s.eventKeys.indexOf(key), 1);
  s.missedRent++;
  log(s, 'money', 'Mr Hüsnü closed the pharmacy. The unpaid rent is recorded as missed.');
  if (s.scene?.kind === 'rent') s.scene = null;
  s.phones = s.phones.filter((p) => p.scene.kind !== 'rent');
  if (s.missedRent >= 2)
    finish(s, 'You missed two rent payments. Mr Hüsnü took back the office key. The month ended early.');
}
function cityTalk(s: Sim, workers: boolean) {
  const ids = workers
    ? CANDIDATES.filter(
        (c) =>
          (s.cards[c.id]!.met && s.cards[c.id]!.status !== 'gone') ||
          (!s.cards[c.id]!.met && c.arrives <= s.now + 7 * DAY),
      ).map((c) => c.id)
    : FAMILIES.filter((f) => f.arrives <= s.now + 7 * DAY).map((f) => `${f.id}-0`);
  const place = workers ? 'Kültürpark' : 'Saturday tea';
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const a = ids[(i + day(s)) % ids.length]!;
    const b = ids[(i + 1 + day(s)) % ids.length]!;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      if (!from || !to) continue;
      talkPair(s, from, to, place);
    }
  }
  log(
    s,
    'city',
    workers
      ? 'Workers met for tea in Kültürpark.'
      : 'Families met for tea on Saturday. They will tell others what they heard.',
  );
  // Reputational beliefs learned through conversation affect later willingness.
  if (workers)
    for (const c of CANDIDATES.filter((c) => s.cards[c.id]!.met))
      for (const f of FAMILIES) {
        if (
          credence(s.people[c.id]!, `${f.id}:kind`) < 0.3 &&
          !s.cards[c.id]!.refuses.some((r) => r.family === f.id)
        ) {
          s.cards[c.id]!.refuses.push({
            family: f.id,
            words: `I will not work for ${f.name}. Everyone has heard how they treat people.`,
          });
          log(
            s,
            'word',
            `${c.name}: “I will not work for ${f.name}. Everyone has heard how they treat people.”`,
            {
              candidate: c.id,
              family: f.id,
            },
          );
        }
      }
}

function recordConfidence(s: Sim, candidate: string) {
  const p = s.placements.findLast((p) => p.candidate === candidate && p.confidenceGiven && active(p));
  if (!p || s.confidences.some((c) => c.candidate === p.candidate && c.family === p.family)) return;
  const f = FAMILIES.find((f) => f.id === p.family)!;
  s.confidences.push({ candidate: p.candidate, family: p.family, text: f.secret, told: false });
  log(s, 'word', `${name(p.candidate)} told you in confidence: “${f.secret}”`, {
    candidate: p.candidate,
    family: p.family,
  });
}
function offers(s: Sim) {
  const secret = s.confidences.find((c) => !c.told && !s.eventKeys.includes(`asked-secret:${c.family}`));
  if (secret) {
    const asking = FAMILIES.find((f) => f.arrives <= s.now && f.id !== secret.family)!;
    if (asking) {
      s.eventKeys.push(`asked-secret:${secret.family}`);
      const call = scene(
        s,
        'offer',
        asking.id,
        `A question about ${name(secret.family)}`,
        `What do you hear about ${name(secret.family)}? We could use someone who knows the household. I can pay ₺1800 for your time.`,
        [
          {
            id: 'sell-confidence',
            label: 'Tell what you heard',
            hint: 'You will receive ₺1800. The worker trusted you with this information.',
          },
          { id: 'keep-private', label: 'Keep it private' },
          { id: 'change-subject', label: 'Change the subject' },
        ],
      );
      s.offerDetails ??= {};
      s.offerDetails[call.id] = { kind: 'confidence', candidate: secret.candidate, family: secret.family };
      queue(s, asking.id, call);
      return;
    }
  }
  if (day(s) >= 9 && !s.eventKeys.includes('poaching-offer')) {
    const p = s.placements.find((p) => p.status === 'kept');
    const rich = FAMILIES.find(
      (f) =>
        f.arrives <= s.now &&
        f.id !== p?.family &&
        f.wage >= 9500 &&
        !!p &&
        CANDIDATES.find((c) => c.id === p.candidate)!.roles.includes(f.role) &&
        s.requests.some((r) => r.family === f.id && r.status === 'open' && r.by > s.now),
    );
    if (p && rich) {
      s.eventKeys.push('poaching-offer');
      const call = scene(
        s,
        'offer',
        rich.id,
        'A job that pays more',
        `Could you bring ${name(p.candidate)} to us instead? We will pay ₺6000 for finding someone. The present household does not need to know until the worker agrees.`,
        [
          {
            id: 'accept-poach',
            label: 'Make the offer to the worker',
            hint: 'You will receive ₺6000 if the worker agrees. The present household loses their worker.',
          },
          { id: 'decline', label: 'Leave the worker with the present family' },
        ],
      );
      s.offerDetails ??= {};
      s.offerDetails[call.id] = { kind: 'poach', candidate: p.candidate, family: rich.id };
      queue(s, rich.id, call);
      return;
    }
  }
  if (!s.eventKeys.includes('envelope-offer')) {
    const c = CANDIDATES.find(
      (c) =>
        s.cards[c.id]!.met &&
        ['bench', 'books'].includes(s.cards[c.id]!.status) &&
        s.people[c.id]!.traits.honesty < 0.4,
    );
    if (c && day(s) >= 1) {
      s.eventKeys.push('envelope-offer');
      const call = scene(
        s,
        'offer',
        c.id,
        'An envelope on the desk',
        'There is ₺1200 here. Find me a job with a family that pays well. You do not have to write this down.',
        [
          {
            id: 'take-envelope',
            label: 'Take the envelope',
            hint: 'The worker will pay ₺1200 and expect a good placement in return.',
          },
          { id: 'return-envelope', label: 'Return the envelope' },
        ],
      );
      s.offerDetails ??= {};
      s.offerDetails[call.id] = { kind: 'envelope', candidate: c.id, family: '' };
      queue(s, c.id, call);
    }
  }
}
function offerChoice(s: Sim, sc: SceneView, choice: string) {
  const offer = s.offerDetails?.[sc.id];
  if (!offer) return;
  const worker = s.people[offer.candidate]!;
  if (choice === 'sell-confidence' && offer.kind === 'confidence') {
    const secret = s.confidences.find((c) => c.candidate === offer.candidate && c.family === offer.family);
    if (secret && !secret.told) {
      secret.told = true;
      s.cash += 1800;
      const family = s.people[`${sc.with}-0`]!;
      sourceResponse(family, 'nermin', true, s.now);
      log(
        s,
        'money',
        `You repeated what ${name(offer.candidate)} told you in private. ${cap(name(sc.with))} paid ₺1800.`,
      );
      const routeId = s.routes.length + 1;
      const prop = `${offer.family}:secret`;
      believe(family, prop, true, 0.98, 'nermin', s.now);
      s.threads.push({
        id: s.threads.length + 1,
        end: s.now + 20,
        at: s.now,
        from: 'nermin',
        to: sc.with,
        place: 'telephone',
        about: offer.family,
      });
      s.routes.push({
        id: routeId,
        at: s.now,
        from: 'nermin',
        to: sc.with,
        about: offer.family,
        words: secret.text,
      });
      s.routeFacts[routeId] = { prop, value: true };
    }
  } else if (choice === 'take-envelope' && offer.kind === 'envelope') {
    s.cash += 1200;
    s.eventKeys.push(`envelope:${offer.candidate}`);
    s.envelopePromise = { candidate: offer.candidate, at: s.now + 2 * DAY };
    log(
      s,
      'money',
      `${name(offer.candidate)} left ₺1200 on the desk. The worker expects you to find the next suitable job in return.`,
    );
  } else if (offer.kind === 'refund') {
    delete s.envelopeDebt;
    if (choice === 'refund-envelope' && s.cash >= 1200) {
      s.cash -= 1200;
      log(s, 'money', `You returned ₺1200 to ${name(offer.candidate)}.`);
    } else {
      sourceResponse(worker, 'nermin', false, s.now);
      confirm(worker, 'nermin:honest', false, s.now);
      confirm(worker, 'nermin:reliable', false, s.now);
      log(
        s,
        'word',
        `${name(offer.candidate)}: “You took my money. Do not say I never asked you to put it right.”`,
        { candidate: offer.candidate },
      );
    }
  } else if (choice === 'accept-poach' && offer.kind === 'poach') {
    const p = s.placements.find((p) => p.candidate === offer.candidate && p.status === 'kept');
    if (p) {
      const f = FAMILIES.find((f) => f.id === offer.family)!;
      const request = s.requests.find((r) => r.family === f.id && r.status === 'open' && r.by > s.now);
      if (!request || !CANDIDATES.find((c) => c.id === p.candidate)!.roles.includes(f.role)) {
        log(s, 'word', 'The other family no longer has a suitable opening.');
        return;
      }
      const old = p.family;
      const agrees = f.wage > p.wage && worker.needs.autonomy > 0.25;
      if (agrees) {
        s.cash += 6000;
        endPlacement(s, p, 'withdrawn', `Nermin found me a job with ${f.name} that pays more.`);
        p.reportedStatus = 'withdrawn';
        sourceResponse(s.people[`${old}-0`]!, 'nermin', false, s.now);
        log(
          s,
          'money',
          `${name(offer.candidate)} accepted the offer. ${cap(f.name)} paid the ₺6000 finder’s fee.`,
          { candidate: p.candidate, family: f.id },
        );
        const r = s.requests.find((r) => r.family === f.id);
        if (r) r.status = 'filled';
        const replacement: Placement = {
          ...p,
          id: `placement-${s.placements.length + 1}`,
          family: f.id,
          role: f.role,
          since: s.now,
          trialEnds: s.now + 7 * DAY,
          status: 'kept',
          reportedStatus: 'kept',
          disagreement: false,
          arrangement: undefined,
          pending: undefined,
          warning: undefined,
          arrangementMode: undefined,
          arrangementKept: undefined,
          checkInAt: (day(s) + 1) * DAY + 720,
          pendingFee: 0,
          vouched: [],
          story: [`${name(p.candidate)} left ${name(old)} after Nermin offered another job.`],
          moments: [],
          reported: 0,
          confidenceGiven: false,
          wage: f.wage,
        };
        s.placements.push(replacement);
        s.cards[p.candidate]!.status = 'placed';
      } else
        log(s, 'word', `${name(offer.candidate)}: “I have settled here. I will not move just for that.”`);
    }
  } else if (choice === 'return-envelope')
    log(
      s,
      'word',
      'You pushed the envelope back across the desk. “Find me a place anyway,” came the answer.',
    );
  else if (choice === 'keep-private' || choice === 'change-subject')
    log(
      s,
      'word',
      'You kept the household’s private information to yourself. The caller changed the subject.',
    );
  delete s.offerDetails![sc.id];
}
function traceSecrets(s: Sim) {
  for (const key of [...s.eventKeys])
    if (key.startsWith('trace-secret:')) {
      const [, candidate, family, when] = key.split(':');
      if (s.now < Number(when) || !candidate || !family) continue;
      s.eventKeys.splice(s.eventKeys.indexOf(key), 1);
      const p = s.placements.find(
        (p) => p.candidate === candidate && p.family === family && ['trial', 'kept'].includes(p.status),
      );
      if (p)
        endPlacement(
          s,
          p,
          'dismissed',
          'Something from inside this house has been repeated. We know who told you. The placement cannot continue.',
        );
      const worker = s.people[candidate]!;
      sourceResponse(worker, 'nermin', false, s.now);
      believe(worker, 'nermin:discreet', false, 0.98, 'self', s.now);
      confirm(worker, 'nermin:reliable', false, s.now);
      log(
        s,
        'word',
        `${name(candidate)}: “I only told you that information, but the family knew what I said.”`,
        { candidate, family },
      );
    }
}
function reopen(s: Sim, p: Placement) {
  const request = s.requests.find((r) => r.family === p.family);
  if (request) {
    request.status = 'open';
    request.by = s.now + 2 * DAY;
    request.byLabel = label(request.by);
  }
}
function actTable(q: Quality, good: boolean, tag: string) {
  // A composite is an interpretation of an act, not a direct measurement of HEXACO.
  return ['warm', 'hardworking', 'discreet'].includes(q)
    ? {}
    : { [tag]: { [QUALITY_MAP[q]]: good ? 0.85 : 0.2 } };
}
function envelopeDue(s: Sim) {
  const debt = s.envelopeDebt;
  if (debt && s.now >= debt.at) {
    const pending =
      s.scene?.id === debt.scene ? s.scene : s.phones.find((p) => p.scene.id === debt.scene)?.scene;
    if (pending) offerChoice(s, pending, 'keep-envelope');
    if (s.scene?.id === debt.scene) s.scene = null;
    s.phones = s.phones.filter((p) => p.scene.id !== debt.scene);
    delete s.envelopeDebt;
  }
  const promise = s.envelopePromise;
  if (!promise || s.now < promise.at) return;
  delete s.envelopePromise;
  const p = s.placements.find(
    (p) => p.candidate === promise.candidate && ['trial', 'kept'].includes(p.status),
  );
  if (p) {
    log(s, 'word', `${name(promise.candidate)}: “You did find me a job. I remember that.”`);
    return;
  }
  const call = scene(
    s,
    'offer',
    promise.candidate,
    'The worker asks about the envelope',
    'You took my money. I am still without work. Give it back, or find me a job.',
    [
      { id: 'keep-envelope', label: 'Keep the money', hint: 'The candidate will tell people what happened.' },
      {
        id: 'refund-envelope',
        label: 'Return the ₺1200',
        ...(s.cash < 1200
          ? { disabled: 'There is not ₺1200 in the cash box. Find a placement to collect a fee.' }
          : {}),
      },
    ],
  );
  call.canLeave = false;
  s.envelopeDebt = { candidate: promise.candidate, scene: call.id, at: s.now + DAY };
  s.offerDetails ??= {};
  s.offerDetails[call.id] = { kind: 'refund', candidate: promise.candidate, family: '' };
  queue(s, promise.candidate, call);
}
function spokenClaim(prop: string, value: boolean) {
  const [target, trait] = prop.split(':');
  const subject = name(target ?? '');
  const start = cap(subject);
  const claims: Record<string, [string, string]> = {
    reliable: [`You can rely on ${subject}.`, `You cannot rely on ${subject}.`],
    honest: [`${start} has been honest with people.`, `${start} has not been honest with people.`],
    kind: [`${start} has treated people well.`, `${start} has treated people badly.`],
    patient: [`${start} gives people time.`, `${start} gets angry when people need time.`],
    warm: [`${start} makes people feel welcome.`, `${start} keeps apart from people.`],
    hardworking: [`${start} finishes the work.`, `${start} leaves work for other people.`],
    discreet: [`${start} keeps private information private.`, `${start} repeats private information.`],
  };
  return (
    claims[trait ?? '']?.[value ? 0 : 1] ??
    `${subject}: ${value ? 'that is what I heard' : 'I heard otherwise'}.`
  );
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function workDayAfter(day: number, dayOff: number): number {
  const next = day + 1;
  return next % 7 === dayOff ? next + 1 : next;
}
function trialEnd(since: number, terms: EmploymentTerms): number {
  let day = Math.floor(since / DAY);
  for (let i = 0; i < terms.trialDays; i++) day = workDayAfter(day, terms.dayOff);
  return day * DAY + 720;
}
function firstWorkDay(p: Placement): number {
  return workDayAfter(Math.floor(p.since / DAY), p.terms?.dayOff ?? 6);
}
function firstCallAt(p: Placement): number {
  const finish = (p.terms?.endHour ?? workerNeed(p.candidate).finishBy / 60) * 60;
  const afterWork = Math.max(1100, finish + 20);
  // The opening placement can start that afternoon; later appointments start the next workday.
  return p.id === 'placement-1' &&
    Math.floor(p.since / DAY) % 7 !== (p.terms?.dayOff ?? 6) &&
    p.since < finish
    ? afterWork
    : firstWorkDay(p) * DAY + afterWork;
}
function active(p: Placement): boolean {
  return ['trial', 'kept'].includes(p.status);
}
function relationshipQuestion(s: Sim): string {
  const pending = s.placements.findLast((p) => p.pending);
  if (pending)
    return `Would you make the same promise to ${name(pending.candidate)} about ${workerNeed(pending.candidate).reason}?`;
  const last = s.placements.findLast((p) => p.arrangement);
  if (last)
    return `Would ${name(last.candidate)} trust your word about ${workerNeed(last.candidate).reason} again?`;
  const secret = s.confidences.find((c) => c.told);
  if (secret)
    return `Would ${name(secret.candidate)} tell you something else in private after the private information reached ${name(secret.family)}?`;
  const met = CANDIDATES.find((c) => s.cards[c.id]!.met && Object.keys(s.cards[c.id]!.asked).length);
  return met
    ? `What would you ask ${met.name} before recommending another family?`
    : 'Who would you take time to listen to before sending someone to work for a family?';
}
function nextEvent(s: Sim): View['next'] {
  if (s.ended) return null;
  const events: { label: string; at: number }[] = [];
  for (const p of s.placements.filter(active)) {
    if (p.pending) events.push({ label: p.pending.text, at: p.pending.at });
    if (p.warning)
      events.push({
        label: `${name(p.candidate)} needs an answer before the placement ends`,
        at: p.warning.at,
      });
    if (!p.disagreement)
      events.push({
        label: `${cap(name(p.family))} will call about ${name(p.candidate)} after the first day`,
        at: firstCallAt(p),
      });
    if (p.status === 'trial')
      events.push({
        label: `${name(p.family)} will give an answer about ${name(p.candidate)}’s trial week`,
        at: p.trialEnds,
      });
  }
  for (const key of s.eventKeys.filter((k) => k.startsWith('trial:'))) {
    const [, c, f, at] = key.split(':');
    events.push({
      label: `${name(f!)} will give an answer about ${name(c!)}’s trial morning`,
      at: Number(at),
    });
  }
  if (s.envelopePromise)
    events.push({
      label: `${name(s.envelopePromise.candidate)} will ask about the money in the envelope`,
      at: s.envelopePromise.at,
    });
  for (const c of CANDIDATES) {
    const card = s.cards[c.id]!;
    if (card.arrivalAt)
      events.push({ label: `${c.name} is due at the office after the journey`, at: card.arrivalAt });
    if (card.returnAt) events.push({ label: `A candidate may return to the bench`, at: card.returnAt });
  }
  for (const r of s.referrals)
    events.push({ label: `Someone ${name(r.from)} recommended is due on the bench`, at: r.at });
  for (const c of CANDIDATES.filter((c) => !s.cards[c.id]!.met))
    events.push({ label: 'Another candidate is due on the bench', at: s.cards[c.id]!.arrived });
  for (const f of FAMILIES.filter((f) => !s.requests.some((r) => r.family === f.id)))
    events.push({ label: 'A family is due to call', at: f.arrives });
  for (const c of CANDIDATES.filter((c) => s.cards[c.id]!.introduced))
    for (const id of c.referees) {
      const ref = REFEREES.find((r) => r.id === id)!;
      if (!s.cards[c.id]!.called.includes(id) && s.now % DAY < ref.reachableAt && day(s) % 7 !== 6)
        events.push({
          label: `${c.name}'s reference, ${ref.name}, can be reached from ${timeLabel(ref.reachableAt)}`,
          at: day(s) * DAY + ref.reachableAt,
        });
    }
  if (
    day(s) % 7 !== 6 &&
    s.now % DAY >= 510 &&
    s.now % DAY < 1140 &&
    !s.scene &&
    !s.phones.length &&
    !Object.values(s.cards).some((c) => c.status === 'bench')
  )
    events.push({ label: 'Someone will bring news from outside Good Hands', at: quietOfficeTime(s) });
  events.push({ label: 'The rent is due', at: s.rentDue });
  const next = events.filter((e) => e.at > s.now).sort((a, b) => a.at - b.at)[0];
  return next ? { ...next, label: cap(next.label), dateLabel: label(next.at) } : null;
}
/**
 * Where Skip (`wait-for`) stops, as far as the office can know: the next event, an applicant on the bench
 * starting to leave, or the 19:00 closing. A new arrival, call or scene can still stop it sooner. Pure reader.
 */
export function skipStop(state: State): { at: number; label: string } | null {
  if (state.version < 5) return null;
  const s = sim(state);
  const next = nextEvent(s);
  if (!next) return null;
  const stops: { at: number; label: string }[] = [{ at: next.at, label: next.label }];
  const bench = CANDIDATES.map((c) => ({ c, card: s.cards[c.id]! })).filter(
    ({ card }) => card.status === 'bench',
  );
  // runTo stops when the first applicant reaches three hours on the bench, unless one already has.
  if (!bench.some(({ card }) => s.now - card.arrived >= 180)) {
    const first = bench.sort((a, b) => a.card.arrived - b.card.arrived)[0];
    if (first)
      stops.push({
        at: Math.ceil(first.card.arrived + 180),
        label: `${first.c.name} has waited three hours`,
      });
  }
  const close = (s.now % DAY < 1140 ? day(s) : day(s) + 1) * DAY + 1140;
  stops.push({ at: close, label: 'The office closes for the day' });
  return stops.filter((x) => x.at > s.now).sort((a, b) => a.at - b.at)[0] ?? null;
}
function familyDisagreement(p: Placement): string {
  return familyDisagreementWords(p.family, name(p.candidate));
}

function interventionChoices(p: Placement): SceneView['choices'] {
  return [
    {
      id: 'negotiate',
      label: arrangementSpec(p.candidate, p.since).request,
      hint: `Speak to the family about ${workerNeed(p.candidate).reason}. They may refuse or ask for something in return.`,
    },
    {
      id: 'bend',
      label: 'Ask for flexibility this week',
      hint: 'The worker must manage without the requested arrangement this week.',
    },
    {
      id: 'promise',
      label: 'Promise to settle it tomorrow',
      hint: 'You must speak to the family before the promise is checked tomorrow.',
    },
    {
      id: 'withdraw',
      label: `Withdraw ${name(p.candidate)}`,
      hint: 'End the placement and keep the worker’s contact details. The family needs a replacement.',
    },
  ];
}
function openDisagreement(s: Sim, p: Placement, warning = false, commute = false) {
  if (!warning) p.disagreement = true;
  const home = CANDIDATES.find((c) => c.id === p.candidate)!.home;
  const family = FAMILIES.find((f) => f.id === p.family)!;
  const ride = family.district === 'Karşıyaka' || home === 'Karşıyaka' ? 'ferry' : 'bus';
  const sc = scene(
    s,
    'two-sides',
    p.candidate,
    warning
      ? `${name(p.candidate)}: a warning before leaving`
      : commute
        ? `${name(p.candidate)} calls from the ${ride}`
        : `${name(p.candidate)} and ${name(p.family)}`,
    `${commute ? `I am on the ${ride} after my first day. ` : ''}${workerDisagreement(p.candidate, name(p.family), !!s.cards[p.candidate]!.asked.need || !!s.cards[p.candidate]!.asked.hours)}`,
    interventionChoices(p),
  );
  sc.lines[0]!.side = 'worker';
  sc.lines.push({ speaker: name(p.family), text: familyDisagreement(p), kind: 'speech', side: 'family' });
  queue(s, p.candidate, sc, p.id);
}
function rememberNeed(s: Sim, p: Placement) {
  s.cards[p.candidate]!.wants = workerNeed(p.candidate).words;
}
function scheduleArrangement(s: Sim, p: Placement, mode: NonNullable<Placement['arrangementMode']>) {
  const need = workerNeed(p.candidate);
  const spec = arrangementSpec(p.candidate, s.now);
  p.arrangementMode = mode;
  if (mode === 'bend') p.bendUntil = s.now + 7 * DAY;
  else delete p.bendUntil;
  p.arrangementKept = false;
  const at = mode === 'promise' ? (day(s) + 1) * DAY + 720 : spec.at;
  p.arrangement =
    mode === 'negotiate'
      ? spec.terms
      : mode === 'bend'
        ? `${name(p.candidate)} will manage without the arrangement this week. Nermin must discuss it again next week.`
        : mode === 'promise'
          ? `Nermin promised ${name(p.candidate)} that she would settle ${need.reason} before ${label(at)}.`
          : `The family refused: ${spec.request}`;
  p.pending = {
    text:
      mode === 'negotiate'
        ? spec.test
        : mode === 'promise'
          ? `Will Nermin keep the promise to ${name(p.candidate)} about ${need.reason}?`
          : mode === 'bend'
            ? `Can ${name(p.candidate)} manage this week without ${need.reason}?`
            : `Can ${name(p.candidate)} stay after the family's refusal about ${need.reason}?`,
    at,
    dateLabel: label(at),
  };
  p.checkInAt = mode === 'promise' ? s.now : at;
  delete p.warning;
  p.story.push(`${dateLabel(s.now)}: ${p.arrangement}`);
  log(s, 'word', `${p.arrangement} Next: ${p.pending.text} ${p.pending.dateLabel}`, {
    placement: p.id,
    candidate: p.candidate,
    family: p.family,
  });
}
function intervention(s: Sim, p: Placement, sc: SceneView, choice: string) {
  rememberNeed(s, p);
  if (choice === 'finish') {
    s.scene = null;
    return;
  }
  if (choice === 'withdraw') {
    interruptPlacement(s.people[p.candidate]!, s.now);
    reopen(s, p);
    p.status = 'withdrawn';
    p.reportedStatus = 'withdrawn';
    delete p.pending;
    delete p.warning;
    s.cards[p.candidate]!.status = 'books';
    log(
      s,
      'placement',
      `You brought ${name(p.candidate)} back from ${name(p.family)}. The opening needs a replacement.`,
      { placement: p.id, family: p.family },
    );
    sourceResponse(s.people[p.candidate]!, 'nermin', true, s.now);
    s.scene = null;
    runTo(s, s.now + 15);
    return;
  }
  if (choice === 'accept-condition') {
    scheduleArrangement(s, p, 'negotiate');
    p.arrangement += ' Nermin pays ₺300 for the extra help this needs.';
    s.cash -= 300;
    log(s, 'money', 'You paid ₺300 for the extra help.');
    sc.lines.push({
      speaker: name(p.family),
      text: `We have your ₺300. ${arrangementSpec(p.candidate, s.now).terms} We agree to those terms. We will arrange help with the extra work.`,
      kind: 'speech',
      side: 'family',
    });
  } else if (choice === 'refuse-condition') {
    scheduleArrangement(s, p, 'refused');
    sc.lines.push({
      speaker: name(p.family),
      text: 'Then we have not agreed to the change. You will need to speak to the worker again.',
      kind: 'speech',
      side: 'family',
    });
  } else if (choice === 'negotiate' || choice === 'support') {
    const family = s.people[`${p.family}-0`]!;
    const disposition = family.traits.agreeableness + 0.15 * (trustOf(family, 'nermin') - 0.5);
    const response = disposition > 0.52 ? 'agree' : disposition < 0.36 ? 'refuse' : 'condition';
    sc.lines.push({
      speaker: 'Nermin',
      text: arrangementSpec(p.candidate, s.now).request,
      kind: 'speech',
    });
    sc.lines.push({
      speaker: name(p.family),
      text:
        response === 'agree'
          ? 'All right. We will follow that arrangement.'
          : response === 'refuse'
            ? 'No. We cannot run this house around that arrangement.'
            : 'Only if you pay for the extra help this arrangement needs. It will cost you ₺300.',
      kind: 'speech',
      side: 'family',
    });
    if (response === 'condition') {
      sc.choices = [
        { id: 'accept-condition', label: 'Pay ₺300 for the extra help' },
        { id: 'refuse-condition', label: 'Refuse the extra cost' },
      ];
      return;
    }
    scheduleArrangement(s, p, response === 'agree' ? 'negotiate' : 'refused');
  } else if (choice === 'promise' || choice === 'bend') {
    scheduleArrangement(s, p, choice);
    sc.lines.push({
      speaker: name(p.candidate),
      text:
        choice === 'promise'
          ? 'Then I will expect an answer tomorrow, as you promised.'
          : 'I will manage without it this week only. Please tell them that.',
      kind: 'speech',
      side: 'worker',
    });
  } else return;
  sc.choices = [{ id: 'finish', label: 'End the conversation' }];
  runTo(s, s.now + 8);
}
function arrangementTests(s: Sim) {
  for (const p of s.placements.filter(active)) {
    if (
      p.pending &&
      p.arrangementMode &&
      s.now >= p.pending.at &&
      (!p.warning || p.pending.at !== p.warning.at)
    ) {
      const worker = s.people[p.candidate]!;
      const family = s.people[`${p.family}-0`]!;
      const mode = p.arrangementMode;
      const spec = arrangementSpec(p.candidate, p.pending.at - DAY);
      const kept = mode === 'negotiate' && family.traits.honesty + 0.15 * trustOf(family, 'nermin') > 0.49;
      const bent = mode === 'bend' && worker.needs.autonomy > 0.28 && s.now < (p.bendUntil ?? 0);
      p.arrangementKept = kept;
      const at = p.pending.at;
      delete p.pending;
      const words = kept
        ? spec.workerKept
        : bent
          ? `I managed this time, as you asked. I still need ${workerNeed(p.candidate).reason} next week.`
          : mode === 'promise'
            ? `You promised an answer today. Nobody spoke to them about ${workerNeed(p.candidate).reason}.`
            : spec.workerBroken;
      const familyWords = kept
        ? spec.familyKept
        : bent
          ? 'The worker managed without that arrangement this time. We have not agreed to next week.'
          : spec.familyBroken;
      // The named household moment checks the agreed term; a promise checks Nermin's call.
      p.story.push(
        `${label(s.now)}. ${mode === 'promise' ? 'Nermin’s promised reply was due.' : 'The family tested the agreed arrangement.'} The family said, “${familyWords}”`,
      );
      sourceResponse(worker, 'nermin', kept, s.now);
      perceive(worker, [
        {
          at: s.now,
          channel: 'social',
          kind: kept ? 'promise-kept' : 'promise-broken',
          actorId: family.id,
          targetId: worker.id,
          salience: 0.9,
          valence: kept ? 0.6 : -0.6,
          summary: words,
        },
      ]);
      confirm(worker, 'nermin:reliable', kept, s.now);
      observeAct(
        worker,
        family.id,
        { at: s.now, tags: ['arrangement'] },
        { arrangement: { honesty: kept ? 0.9 : 0.2 } },
      );
      p.story.push(`${label(at)}. ${name(p.candidate)} said, “${words}” The family said, “${familyWords}”`);
      p.lastWord = words;
      p.checkInAt = s.now;
      p.seems = kept ? 'good' : 'trouble';
      log(s, 'word', `${name(p.candidate)}: “${words}”`, { placement: p.id, candidate: p.candidate });
      const report = scene(
        s,
        'two-sides',
        p.candidate,
        `The arrangement: ${name(p.candidate)}`,
        words,
        interventionChoices(p),
      );
      report.lines[0]!.side = 'worker';
      report.lines.push({ speaker: name(p.family), text: familyWords, kind: 'speech', side: 'family' });
      if (kept || bent)
        report.choices = [
          { id: 'finish', label: 'Hear both sides' },
          ...(!kept ? interventionChoices(p) : []),
        ];
      queue(s, p.candidate, report, p.id);
      if (bent && p.bendUntil)
        p.pending = {
          text: `Will ${name(p.candidate)} get the arrangement after this week's flexibility?`,
          at: p.bendUntil,
          dateLabel: label(p.bendUntil),
        };
      if (!kept && !bent)
        warnPlacement(s, p, 'quit', `I cannot stay without ${workerNeed(p.candidate).reason}.`);
    }
    if (p.warning && s.now >= p.warning.at) {
      const warning = p.warning;
      delete p.warning;
      endPlacement(s, p, warning.status, warning.words);
    }
  }
}
function warnPlacement(s: Sim, p: Placement, status: PlacementView['status'], words: string) {
  if (p.warning || !active(p)) return;
  p.warning = { status, words, at: (day(s) + 1) * DAY + 1080 };
  p.pending ??= {
    text: `You need to help ${name(p.candidate)} before the placement ends`,
    at: p.warning.at,
    dateLabel: label(p.warning.at),
  };
  openDisagreement(s, p, true);
}

function referenceWordsForMoment(p: Placement, q: Quality, value: number): string {
  return familyMoment(p.family, q, value >= 0.55, name(p.candidate));
}
function talkPair(s: Sim, from: string, to: string, place: string): TalkThread | undefined {
  const speaker = s.people[from]!;
  const listener = s.people[to]!;
  const exchange = converse(speaker, listener, {
    at: s.now,
    placeId: place,
    topics: ['nermin', ...s.confidences.filter((c) => c.told).map((c) => c.family)],
    maxClaims: 3,
  });
  const claims = exchange.told.flatMap((ev) => ev.claims ?? []);
  if (!claims.length) return;
  const thread: TalkThread = {
    id: s.threads.length + 1,
    at: s.now,
    end: s.now + 20,
    from: from.replace(/-0$/, ''),
    to: to.replace(/-0$/, ''),
    place,
  };
  s.threads.push(thread);
  for (const claim of claims) {
    const sources = speaker.memory.beliefs.find((b) => b.prop === claim.prop)?.sources ?? [];
    const own = sources.some((source) => source.id === from || source.id === 'self');
    const parent = own
      ? undefined
      : s.routes.findLast(
          (r) =>
            r.to === from.replace(/-0$/, '') &&
            s.routeFacts[r.id]?.prop === claim.prop &&
            s.routeFacts[r.id]?.value === claim.value &&
            sources.some((source) => source.id.replace(/-0$/, '') === r.from && source.value === claim.value),
        );
    const id = s.routes.length + 1;
    const secret = s.confidences.find((c) => c.told && `${c.family}:secret` === claim.prop);
    s.routes.push({
      id,
      at: s.now,
      from: thread.from,
      to: thread.to,
      about: claim.prop.split(':')[0]!,
      words: secret?.text ?? spokenClaim(claim.prop, claim.value),
      ...(parent ? { parent: parent.id } : {}),
    });
    s.routeFacts[id] = { prop: claim.prop, value: claim.value };
    if (secret && to === `${secret.family}-0` && !s.eventKeys.includes(`exposed:${secret.family}`)) {
      s.eventKeys.push(
        `exposed:${secret.family}`,
        `trace-secret:${secret.candidate}:${secret.family}:${s.now + 60}`,
      );
      thread.about = secret.family;
      thread.consequence = `${cap(name(secret.family))} heard their private words repeated at ${place}.`;
    }
    if (
      claim.prop === 'nermin:reliable' &&
      claim.value &&
      s.cards[to] &&
      !s.cards[to]!.met &&
      !s.referrals.some((r) => r.candidate === to)
    ) {
      s.referrals.push({ candidate: to, from, thread: thread.id, at: (day(s) + 1) * DAY + 540 });
    }
    if (claim.prop === 'nermin:discreet' && !claim.value && s.cards[to])
      sourceResponse(listener, 'nermin', false, s.now);
  }
  perceive(listener, exchange.told);
  for (const ev of exchange.socialEvents.speaker) socialEvent(speaker, ev);
  for (const ev of exchange.socialEvents.listener) socialEvent(listener, ev);
  return thread;
}
function commuteTalk(s: Sim) {
  const workers = s.placements.filter((p) => active(p) && day(s) > Math.floor(p.since / DAY));
  const used = new Set<string>();
  for (const p of workers) {
    const c = CANDIDATES.find((c) => c.id === p.candidate)!;
    const fellow =
      workers.find(
        (other) =>
          other.id !== p.id &&
          !used.has(other.candidate) &&
          CANDIDATES.find((c) => c.id === other.candidate)!.home === c.home,
      )?.candidate ??
      CANDIDATES.find((other) => other.id !== c.id && !s.cards[other.id]!.met && other.home === c.home)?.id ??
      CANDIDATES.find(
        (other) =>
          other.id !== c.id &&
          s.cards[other.id]!.met &&
          ['books', 'gone'].includes(s.cards[other.id]!.status) &&
          other.home === c.home,
      )?.id;
    if (!fellow || used.has(c.id)) continue;
    const f = FAMILIES.find((f) => f.id === p.family)!;
    const place = f.district === 'Karşıyaka' || c.home === 'Karşıyaka' ? 'the ferry' : `the ${c.home} bus`;
    talkPair(s, c.id, fellow, place);
    talkPair(s, fellow, c.id, place);
    used.add(c.id);
    used.add(fellow);
  }
  // Employers pass news at the school gate and on the way home; secrets use these same routes.
  const families = FAMILIES.filter((f) => f.arrives <= s.now);
  if (families.length > 1) {
    const a = families[day(s) % families.length]!;
    const b = families[(day(s) + 1) % families.length]!;
    talkPair(s, `${a.id}-0`, `${b.id}-0`, 'the school gate');
    talkPair(s, `${b.id}-0`, `${a.id}-0`, 'the school gate');
  }
}
function landReferral(s: Sim, candidate: string) {
  const referral = s.referrals.find((r) => r.candidate === candidate && r.at <= s.now);
  if (!referral) return;
  const text = `${name(candidate)} came because ${name(referral.from)} told ${s.people[candidate]!.life.sex === 'male' ? 'him' : 'her'} about you.`;
  const thread = s.threads.find((t) => t.id === referral.thread);
  if (thread) thread.consequence = text;
  log(
    s,
    'word',
    `${name(candidate)}: “${name(referral.from)} sent me. I heard that you found someone a job and listened to them.”`,
    { candidate },
  );
  s.referrals = s.referrals.filter((r) => r !== referral);
}
function landReferrals(s: Sim) {
  for (const referral of [...s.referrals]) {
    if (referral.at > s.now || s.cards[referral.candidate]!.met) continue;
    Object.assign(s.cards[referral.candidate]!, { met: true, status: 'bench', arrived: s.now });
    landReferral(s, referral.candidate);
    log(s, 'arrival', `${name(referral.candidate)} sat on the bench after the journey.`, {
      candidate: referral.candidate,
    });
  }
}
function cityFigure(
  s: Sim,
  c: Pick<CandidateView, 'id' | 'name' | 'status'>,
): View['city']['figures'][number] {
  const def = CANDIDATES.find((def) => def.id === c.id)!;
  const home = (
    {
      Alsancak: [0.48, 0.48],
      Karşıyaka: [0.24, 0.21],
      Bornova: [0.79, 0.32],
      Göztepe: [0.3, 0.66],
      Buca: [0.7, 0.8],
    } as Record<string, number[]>
  )[def.home]!;
  const p = s.placements.findLast((p) => p.candidate === c.id && active(p));
  const f = p ? FAMILIES.find((f) => f.id === p.family) : undefined;
  const t = s.now % DAY;
  const worker = s.people[c.id]!;
  const mood: 'easy' | 'tired' | 'upset' =
    worker.affect.mood.valence < -0.15
      ? 'upset'
      : worker.body.exertion > 0.45 || worker.body.sleepPressure > 0.6
        ? 'tired'
        : 'easy';
  const base = {
    id: c.id,
    name: c.name,
    x: home[0]!,
    y: home[1]!,
    kind: p ? ('worker' as const) : ('candidate' as const),
    mood,
    place: 'at home',
  };
  const commuting = s.threads.findLast(
    (thread) =>
      thread.at <= s.now &&
      thread.end >= s.now &&
      [thread.from, thread.to].includes(c.id) &&
      /bus|ferry/.test(thread.place),
  );
  if (!f && commuting)
    return {
      ...base,
      x: 0.48,
      y: 0.5,
      toX: home[0]!,
      toY: home[1]!,
      arrive: commuting.end,
      place: commuting.place.includes('ferry') ? 'on the ferry' : 'on the bus',
    };
  if (!f && day(s) % 7 === 4 && t >= 930 && t < 1020)
    return { ...base, x: 0.49, y: 0.43, place: 'Kültürpark' };
  const arrival = s.cards[c.id]!.arrivalAt;
  if (arrival) return { ...base, toX: 0.48, toY: 0.51, arrive: arrival, place: 'travelling to Good Hands' };
  if (c.status === 'bench' && t >= 510 && t < 1140)
    return { ...base, x: 0.48, y: 0.51, place: 'at Good Hands' };
  const finishAt = (p?.terms?.endHour ?? workerNeed(c.id).finishBy / 60) * 60;
  const off = p?.terms?.dayOff ?? 6;
  if (f && day(s) % 7 !== off && t >= (p?.terms?.startHour ?? 8) * 60 && t < finishAt)
    return { ...base, x: f.x, y: f.y, place: `at ${f.name}` };
  if (f && day(s) % 7 !== off && t >= finishAt && t < finishAt + 60)
    return {
      ...base,
      x: f.x,
      y: f.y,
      toX: home[0]!,
      toY: home[1]!,
      arrive: day(s) * DAY + finishAt + 60,
      place: f.district === 'Karşıyaka' || def.home === 'Karşıyaka' ? 'on the ferry' : 'on the bus',
    };
  if (!f && c.status !== 'bench' && day(s) % 7 !== 6 && t >= 600 && t < 960) {
    const phase = (t - 600) / 360;
    const progress = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    return {
      ...base,
      x: home[0]! + (0.49 - home[0]!) * progress,
      y: home[1]! + (0.43 - home[1]!) * progress,
      toX: phase < 0.5 ? 0.49 : home[0]!,
      toY: phase < 0.5 ? 0.43 : home[1]!,
      arrive: day(s) * DAY + (phase < 0.5 ? 780 : 960),
      place: phase < 0.5 ? 'on the way to the market' : 'returning from the market',
    };
  }
  return base;
}

function proposeTerms(s: Sim, sc: SceneView, terms: EmploymentTerms) {
  const n = sc.negotiation;
  if (!n || !validTerms(terms)) return;
  const c = CANDIDATES.find((c) => c.id === n.candidate)!;
  const f = FAMILIES.find((f) => f.id === n.family)!;
  const response = responses(c, f, s.people[c.id]!, s.people[f.household[0]!.id]!, terms);
  n.terms = structuredClone(terms);
  n.worker = response.worker;
  n.familyResponse = response.familyResponse;
  s.cards[c.id]!.wageKnown = true;
  s.cards[c.id]!.introduced = true;
  sc.lines.push(
    { speaker: 'Nermin', text: termsWords(terms), kind: 'speech' },
    { speaker: c.name, text: response.workerWords, kind: 'speech', side: 'worker' },
    { speaker: f.household[0]!.name, text: response.familyWords, kind: 'speech', side: 'family' },
  );
  sc.choices = negotiationChoices(n, c);
  runTo(s, s.now + 5);
}
function negotiationChoice(s: Sim, sc: SceneView, choice: string) {
  const n = sc.negotiation;
  if (!n) return;
  const c = CANDIDATES.find((c) => c.id === n.candidate)!;
  if (choice === 'cancel') {
    sc.lines.push({
      speaker: c.name,
      text: 'Then nothing is settled. Call me when there is an offer we can both accept.',
      kind: 'speech',
      side: 'worker',
    });
    sc.choices = [{ id: 'done', label: 'End the conversation' }];
    sc.kind = 'phone';
    return;
  }
  if (choice === 'accept-terms') {
    if (n.worker !== 'accepted' || n.familyResponse !== 'accepted') return;
    const r = s.requests.find((r) => r.family === n.family && r.status === 'open');
    const card = s.cards[n.candidate]!;
    if (!r || !['books', 'bench'].includes(card.status)) {
      sc.lines.push({
        speaker: 'Nermin',
        text: 'The opening or the worker is no longer free. We need a new agreement.',
        kind: 'speech',
      });
      sc.choices = [{ id: 'done', label: 'End the conversation' }];
      sc.kind = 'phone';
      return;
    }
    const vouch = s.negotiationVouches?.[sc.id] ?? [];
    const depositAlreadyPaid = s.fees[n.family]?.first === true;
    s.negotiationAgreed = { candidate: n.candidate, family: n.family, terms: structuredClone(n.terms) };
    s.scene = null;
    applyInput(s, { type: 'place', candidate: n.candidate, family: n.family, vouch });
    // The internal completion is part of this spoken acceptance, never a second logged player input.
    s.inputs.pop();
    sc.lines.push(
      { speaker: c.name, text: 'All right. I will begin on those terms.', kind: 'speech', side: 'worker' },
      {
        speaker: name(n.family),
        text: depositAlreadyPaid
          ? 'We have an agreement. The earlier deposit covers this replacement; we will pay any remaining fee if the worker stays after the trial.'
          : n.terms.fee === 0
            ? 'We have an agreement. No agency fee is due under these terms.'
            : `We have an agreement. The deposit is ₺${Math.min(n.terms.fee, n.terms.wage / 4)}; we will pay the rest if the worker stays after the trial.`,
        kind: 'speech',
        side: 'family',
      },
    );
    sc.choices = [{ id: 'done', label: 'End the conversation' }];
    sc.kind = 'phone';
    s.scene = sc;
    return;
  }
  const t = { ...n.terms };
  if (choice === 'offer-wage') t.wage = Math.max(c.wage, t.wage + 500);
  else if (choice === 'offer-hours') t.endHour = Math.min(17, Math.floor(workerNeed(c.id).finishBy / 60));
  else if (choice === 'offer-day-off') t.dayOff = (t.dayOff + 1) % 7;
  else if (choice === 'offer-trial') t.trialDays = t.trialDays === 3 ? 7 : 3;
  else if (choice === 'offer-fee') t.fee = Math.max(0, t.fee - 1000);
  else return;
  proposeTerms(s, sc, t);
}
function householdChoices(): SceneView['choices'] {
  return [
    { id: 'progress', label: 'How is the household managing?' },
    { id: 'complaint', label: 'Tell me what is wrong.' },
    { id: 'smooth', label: 'Let us settle this calmly.' },
    { id: 'worker', label: 'How is the worker being treated?' },
    { id: 'done', label: 'End the call' },
  ];
}
function openHouseholdCall(s: Sim, family: string, member: string, topic: HouseholdTopic) {
  const f = FAMILIES.find((f) => f.id === family);
  const m = f?.household.find((m) => m.id === member);
  if (!f || !m || !s.requests.some((r) => r.family === family)) return;
  if ((s.now - s.people[member]!.life.bornAt) / (365.25 * 1440) < 18) {
    refuse(s, `${m.name} cannot take an agency call. Speak to an adult.`);
    return;
  }
  if (day(s) % 7 === 6 || s.now % DAY < 510 || s.now % DAY >= 1140) {
    refuse(s, 'Call during office hours, 08:30–19:00 Monday to Saturday.');
    return;
  }
  const sc = scene(s, 'household-call', member, `Call ${m.name} at ${f.name}`, '', householdChoices());
  sc.lines = [];
  s.householdCalls ??= {};
  s.householdCalls[sc.id] = { family, member };
  s.scene = sc;
  householdReply(s, sc, family, member, topic);
}
function householdReply(s: Sim, sc: SceneView, family: string, member: string, topic: HouseholdTopic) {
  const f = FAMILIES.find((f) => f.id === family)!;
  const m = f.household.find((m) => m.id === member)!;
  const person = s.people[member]!;
  const p = s.placements.findLast((p) => p.family === family && active(p));
  const grandmother = m.who.includes('grandmother');
  const voice = grandmother ? 'From where I sit,' : 'Here at home,';
  const tense = person.affect.mood.valence < -0.1 || person.needs.autonomy < 0.4;
  const trusted = trustOf(person, 'nermin') > 0.45;
  let words: string;
  if (topic === 'smooth') {
    person.affect.mood.valence = clamp((person.affect.mood.valence + 1) / 2 + 0.04) * 2 - 1;
    sourceResponse(person, 'nermin', person.traits.agreeableness > 0.35, s.now);
    words =
      person.traits.agreeableness > 0.35
        ? 'All right. I can listen. Tell the worker that we will speak before changing the day.'
        : 'I will hear you, but do not promise the worker that I have agreed to a change.';
  } else if (!p)
    words =
      topic === 'complaint'
        ? `${voice} the problem is still that we have no worker. We need someone we can rely on.`
        : topic === 'worker'
          ? 'There is no worker here yet. Bring us an offer both sides can agree to.'
          : `${voice} we are still doing the work ourselves. ${grandmother ? 'I am with the children; ask me about the hours they need.' : 'Please call when you have a worker to propose.'}`;
  else {
    const q = grandmother ? 'patient' : f.pressure;
    const impression = estimate(person, p.candidate, cue(q), s.now).value;
    const read =
      impression === undefined
        ? 'uncertain'
        : impression > 0.58
          ? 'good'
          : impression < 0.42
            ? 'poor'
            : 'uncertain';
    if (topic === 'complaint') {
      words =
        read === 'poor'
          ? `${voice} I need ${name(p.candidate)} to slow down and listen. ${tense ? 'I am tired of repeating it.' : 'Can you speak to us both?'}`
          : `${voice} ${tense ? 'the day is making me tired' : 'I have not seen a reason to complain about the work'}. Please keep the agreed hours clear.`;
      if (read === 'poor') addNote(s, p.candidate, q, 0.3, 'heard', m.name, m.id, words);
    } else if (topic === 'worker') {
      words = trusted
        ? `${name(p.candidate)} is working ${hourWords(p.terms?.startHour ?? 8)} to ${hourWords(p.terms?.endHour ?? 18)}. ${person.traits.honesty > 0.5 ? 'Those are the hours we agreed; ask the worker whether we have kept them.' : 'We have a busy home. You should hear the worker too.'}`
        : 'Speak to the worker directly. I can only tell you what happens while I am here.';
      sourceResponse(s.people[p.candidate]!, 'nermin', true, s.now);
    } else {
      words = `${voice} ${read === 'good' ? `${name(p.candidate)} seems to be settling into the work` : read === 'poor' ? `I am finding the work with ${name(p.candidate)} difficult` : `I am still getting to know ${name(p.candidate)}`}. ${grandmother ? 'I notice the little interruptions during the day.' : tense ? 'We are all tired at the moment.' : 'Ask again after a few ordinary days.'}`;
      if (read !== 'uncertain')
        addNote(s, p.candidate, q, read === 'good' ? 0.75 : 0.3, 'heard', m.name, m.id, words);
    }
  }
  if (topic === 'progress') words = `${householdVoice(family, f.household.indexOf(m))} ${words}`;
  sc.lines.push({ speaker: m.name, text: words, kind: 'speech', side: 'family' });
  sc.choices = householdChoices();
  s.familyLines[family] = `${m.name}: “${words}”`;
  log(s, 'word', s.familyLines[family]!, {
    family,
    ...(p ? { placement: p.id, candidate: p.candidate } : {}),
  });
  runTo(s, s.now + 6);
}

export function advance(state: State, minutes: number): State {
  if (state.version <= 4) return advanceInternal(state, minutes);
  bindFramework(state);
  try {
    return advanceInternal(state, minutes);
  } finally {
    saveFramework(state);
  }
}
export function apply(state: State, input: Input): State {
  if (state.version <= 4) return applyInternal(state, input);
  bindFramework(state);
  try {
    return applyInternal(state, input);
  } finally {
    saveFramework(state);
  }
}
