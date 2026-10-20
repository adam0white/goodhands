import {
  believe,
  confirm,
  converse,
  credence,
  estimate,
  glimpse,
  hear,
  impressionConfidence,
  observeAct,
  outwardSigns,
  perceive,
  skillLevel,
  socialEvent,
  tick,
  trustOf,
} from '@adam0white/human-framework';
import type {
  CandidateView,
  DayCard,
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
import { answer, questions } from './voices.ts';
import { CANDIDATES, FAMILIES, makePeople, QUALITY_MAP, quality, REFEREES, ROLE_SKILL } from './world.ts';

export * from './types.ts';

interface Card {
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
  routes: TalkRoute[];
  routeFacts: Record<number, { prop: string; value: boolean }>;
  envelopePromise?: { candidate: string; at: number };
  envelopeDebt?: { candidate: string; scene: string; at: number };
  fees: Record<string, { first: boolean; second: boolean }>;
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
const sim = (s: State) => s as Sim;
const DAY = 1440;
const END = 27 * DAY + 1140;
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const day = (s: State) => Math.floor(s.now / DAY);
const name = (id: string) =>
  id === 'nermin'
    ? 'Nermin'
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
  s.phones.push({
    since: s.now,
    who: name(who),
    scene: exchange,
    ...(p ? { placement: p.id, through: through ?? p.moments.length, status: p.status } : {}),
  });
  log(s, 'phone', `${name(who)} is calling.`);
}
function addNote(
  s: Sim,
  candidate: string,
  q: Quality,
  value: number,
  source: Note['source'],
  from: string,
  sourceId: string,
): Note {
  const observer = s.people.nermin!;
  // Belief sources remember whose words proved right when Nermin later sees an act.
  // Impressions keep the richer estimate; neither call reads hidden traits here.
  if (source === 'seen') confirm(observer, `${candidate}:${q}`, value >= 0.62, s.now);
  else if (value > 0.62 || value < 0.4)
    believe(observer, `${candidate}:${q}`, value > 0.62, 0.85, sourceId, s.now);
  hear(
    observer,
    candidate,
    cue(q),
    value,
    s.now,
    source === 'seen' ? 1 : trustOf(observer, sourceId) * (source === 'says' ? 0.65 : 1),
  );
  estimate(observer, candidate, cue(q), s.now);
  // Confidence governs whether an uncertain claim can be written as a firm note. It is never displayed as a number.
  const confidence = impressionConfidence(observer, candidate, s.now);
  const result: Note['read'] = value > 0.62 ? 'yes' : value < 0.4 ? 'no' : 'maybe';
  const phrases: Record<Quality, string> = {
    patient: 'patient when someone needs time',
    honest: 'straight about money',
    reliable: 'comes when promised',
    warm: 'puts people at ease',
    hardworking: 'finishes the work',
    discreet: 'keeps a household’s business private',
  };
  const note: Note = {
    quality: q,
    read: result,
    phrase: `${result === 'no' ? 'Doubt about whether she ' : result === 'maybe' || confidence === 0 ? 'Still unsure: ' : ''}${phrases[q]}`,
    source,
    from,
    at: s.now,
  };
  const ranks = { says: 0, heard: 1, seen: 2 };
  for (const old of s.cards[candidate]!.notes)
    if (old.quality === q && old.read !== result && ranks[source] >= ranks[old.source]) old.crossedOut = true;
  s.cards[candidate]!.notes.push(note);
  return note;
}
function interviewChoices(s: Sim, id: string): SceneView['choices'] {
  const card = s.cards[id]!;
  const c = CANDIDATES.find((p) => p.id === id)!;
  return [
    ...questions(c.roles[0]!)
      .filter((q) => (card.asked[q.id] ?? 0) < 6)
      .map((q) => ({ id: q.id, label: q.label, hint: 'Takes 8–12 minutes' })),
    ...(Object.values(card.asked).some((n) => n > 0) && !card.coached.length
      ? [
          {
            id: 'coach',
            label: 'Coach her',
            hint: 'Tell her to promise she loves the work. The family will remember.',
          },
        ]
      : []),
    { id: 'finish', label: 'Finish the interview' },
  ];
}
function arrive(s: Sim) {
  for (const c of CANDIDATES)
    if (!s.cards[c.id]!.met && c.arrives <= s.now) {
      const reputation = credence(s.people[c.id]!, 'nermin:reliable');
      if (reputation < 0.28) {
        Object.assign(s.cards[c.id]!, { met: true, status: 'gone', arrived: s.now });
        log(
          s,
          'word',
          `${c.name} sent word: “I heard what happened at your last house. I am looking elsewhere.”`,
          { candidate: c.id },
        );
        continue;
      }
      Object.assign(s.cards[c.id]!, { met: true, status: 'bench', arrived: s.now });
      if (reputation > 0.72)
        log(s, 'word', `${c.name}: “Someone you placed told me to come here. They said you listen.”`, {
          candidate: c.id,
        });
      log(s, 'arrival', `${c.name} sat on the bench. ${c.look}`, { candidate: c.id });
    }
  for (const f of FAMILIES)
    if (f.arrives <= s.now && !s.requests.some((r) => r.family === f.id)) {
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
      const reputation = credence(s.people[`${f.id}-0`]!, 'nermin:reliable');
      if (reputation < 0.28) request.status = 'lost';
      const words =
        reputation < 0.28
          ? 'We heard how the last placement ended. We are going to another agency.'
          : reputation > 0.72
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
            `${words} We can pay ₺${f.wage}. I need someone by ${label(f.deadline)}.`,
            [
              { id: 'look', label: 'Promise to look' },
              { id: 'decline', label: 'Decline the request' },
            ],
          ),
        );
    }
}
export function newGame(seed: number): State {
  const s: Sim = {
    version: 1,
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
    phones: [],
    log: [],
    threads: [],
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
  arrive(s);
  return s;
}
function finish(s: Sim, why: string) {
  s.ended = true;
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
    question: 'Whose trust will you carry into another month?',
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
  const pending = s.placements.find((p) => p.status === 'trial');
  const request = s.requests.find((r) => r.status === 'open');
  s.dayCard = {
    day: day(s),
    dateLabel: dateLabel(s.now),
    lines,
    tomorrow: pending
      ? `Tomorrow 08:00: ${name(pending.candidate)} is due at ${name(pending.family)}. Ask how the morning went.`
      : request
        ? `Tomorrow: decide who to send to ${name(request.family)}.`
        : 'Tomorrow: decide whom to interview when the office opens.',
  };
}
function step(s: Sim) {
  arrive(s);
  for (const c of CANDIDATES) {
    const card = s.cards[c.id]!;
    if (
      card.status === 'bench' &&
      s.scene?.with !== c.id &&
      s.now - card.arrived >= 210 + (hash(c.id) % 90)
    ) {
      card.status = Object.keys(card.asked).length ? 'books' : 'gone';
      log(
        s,
        'arrival',
        `${c.name} picked up her bag and left${card.status === 'books' ? '. Her number is on your books' : ' without an interview'}.`,
        { candidate: c.id },
      );
    }
  }
  for (const r of s.requests)
    if (r.status === 'open' && s.now > r.by) {
      r.status = 'lost';
      log(s, 'word', `${name(r.family)}: “We needed someone earlier. We have asked elsewhere.”`, {
        family: r.family,
      });
    }
  if (s.now % DAY === 600) placementDay(s);
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
  envelopeDue(s);
  if (s.ended) return;
  if (day(s) % 7 === 4 && s.now % DAY === 960) cityTalk(s, true);
  if (day(s) % 7 === 5 && s.now % DAY === 900) cityTalk(s, false);
  if (s.now % DAY === 1140) closeDay(s);
  if (s.now >= END) finish(s, 'Sunday 29 November. The month is over.');
}
function runTo(s: Sim, target: number, stopOnNew = false) {
  if (!Number.isFinite(target)) return;
  const end = Math.min(END, Math.max(s.now, target));
  while (s.now < end && !s.ended) {
    const phones = s.phones.length;
    const card = s.dayCard;
    const openScene = s.scene;
    const urgent = Object.values(s.cards).some((c) => c.status === 'bench' && s.now - c.arrived >= 180);
    const next = Math.min(end, Math.floor(s.now) + 1);
    s.now = next;
    if (Number.isInteger(next)) step(s);
    if (
      stopOnNew &&
      (s.phones.length > phones ||
        (!card && s.dayCard) ||
        (!openScene && s.scene) ||
        (!urgent && Object.values(s.cards).some((c) => c.status === 'bench' && s.now - c.arrived >= 180)))
    )
      break;
  }
}
export function advance(state: State, minutes: number): State {
  snapshots.delete(state);
  const s = sim(state);
  if (Number.isFinite(minutes) && minutes > 0) runTo(s, s.now + minutes, true);
  return s;
}
function refuse(s: Sim, text: string) {
  log(s, 'word', text);
}
export function apply(state: State, input: Input): State {
  snapshots.delete(state);
  const s = sim(state);
  if (s.ended) return s;
  s.inputs.push({ at: s.now, input: structuredClone(input) });
  if (input.type === 'speed') {
    if ([0, 1, 2, 3].includes(input.speed)) s.speed = input.speed;
    return s;
  }
  if (input.type === 'sleep') {
    if (!s.dayCard) {
      refuse(s, 'The day card opens at 19:00.');
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
    if (sc.kind === 'rent') {
      settleRent(s, input.choice);
      return s;
    }
    if (sc.kind === 'confidence') {
      const p = s.placements.find((p) => p.candidate === sc.with && p.confidenceGiven);
      if (p && !s.confidences.some((c) => c.candidate === p.candidate && c.family === p.family)) {
        const f = FAMILIES.find((f) => f.id === p.family)!;
        s.confidences.push({ candidate: p.candidate, family: p.family, text: f.secret, told: false });
        log(s, 'word', `${name(p.candidate)} told you in confidence: “${f.secret}”`, {
          candidate: p.candidate,
          family: p.family,
        });
        s.people[p.candidate]!.memory.sourceTrust.nermin = clamp(
          trustOf(s.people[p.candidate]!, 'nermin') + 0.06,
        );
      }
    }
    if (sc.kind === 'interview') {
      const c = CANDIDATES.find((p) => p.id === sc.with)!;
      const card = s.cards[c.id]!;
      if (input.choice === 'finish') {
        s.scene = null;
        return s;
      }
      if (input.choice === 'coach') {
        card.coached.push('warm');
        sc.lines.push({
          speaker: 'Nermin',
          text: 'Tell them you love children. Say it even if you are unsure.',
          kind: 'speech',
        });
        sc.lines.push({ speaker: c.name, text: 'If that is what gets me through the door.', kind: 'speech' });
        log(s, 'word', `You coached ${c.name}. The family will hear the promise.`, { candidate: c.id });
        runTo(s, s.now + 8);
      } else {
        const count = card.asked[input.choice] ?? 0;
        const a = answer(s.people[c.id]!, c.presentation, c.roles[0]!, input.choice, count);
        card.asked[input.choice] = count + 1;
        card.wageKnown = true;
        card.experience = c.skills;
        const note = addNote(s, c.id, a.quality, a.claim, 'says', `${c.name} says`, c.id);
        sc.lines.push({ speaker: c.name, text: a.text, kind: 'speech' });
        sc.added = [note];
        if (Object.values(card.asked).reduce((a, b) => a + b, 0) === 1) {
          sc.lines.push({ speaker: '', text: a.notice, kind: 'notice' });
          sc.lines.push({
            speaker: c.name,
            text: `I need ₺${c.wage} a month. I come from ${c.home}; it takes ${c.commute} minutes. ${c.skills.join('. ')}.`,
            kind: 'speech',
          });
        }
        runTo(s, s.now + 8 + (hash(`${s.seed}:${c.id}:${input.choice}:${count}`) % 5));
        if (!s.eventKeys.includes('opening-phone')) {
          s.eventKeys.push('opening-phone');
          queue(
            s,
            'arslans',
            scene(
              s,
              'phone',
              'arslans',
              'The Arslans are checking',
              'Have you found someone? The twins need someone tomorrow morning.',
              [
                { id: 'look', label: 'Say you are still interviewing' },
                { id: 'soon', label: 'Promise an answer today' },
              ],
            ),
          );
        }
      }
      tick(s.people[c.id]!, s.now);
      sc.choices = interviewChoices(s, c.id);
      return s;
    }
    if (sc.kind === 'offer') offerChoice(s, sc, input.choice);
    if (input.choice === 'support') {
      const p = s.placements.find((p) => p.family === sc.with || p.candidate === sc.with);
      if (p) {
        const worker = s.people[p.candidate]!;
        worker.needs.autonomy = clamp(worker.needs.autonomy + 0.08);
        worker.memory.sourceTrust.nermin = clamp(trustOf(worker, 'nermin') + 0.03);
        log(s, 'word', `You spoke for ${name(p.candidate)}. The family agreed to an earlier finish.`);
      }
    }
    if (input.choice === 'decline') {
      const r = s.requests.find((r) => r.family === sc.with && r.status === 'open');
      if (r) r.status = 'lost';
    }
    s.scene = null;
    runTo(s, s.now + 3);
    return s;
  }
  if (s.scene) {
    refuse(s, 'Finish this conversation first.');
    return s;
  }
  if (input.type === 'answer-phone') {
    const p = s.phones.shift();
    if (p) {
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
            log(s, 'money', `${name(placement.family)} sent the second half: ₺${placement.pendingFee}.`);
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
      log(s, 'word', `${p.who}: “${p.scene.lines[0]!.text}”`);
    }
    return s;
  }
  if (
    ['interview', 'call-reference', 'trial', 'place'].includes(input.type) &&
    (day(s) % 7 === 6 || s.now % DAY < 510 || s.now % DAY >= 1140)
  ) {
    refuse(s, 'The office opens at 08:30, Monday to Saturday.');
    return s;
  }
  if (input.type === 'interview') {
    const c = CANDIDATES.find((p) => p.id === input.candidate);
    const card = s.cards[input.candidate];
    if (!c || !card?.met || !['bench', 'books'].includes(card.status)) {
      refuse(s, 'That candidate is not available for an interview.');
      return s;
    }
    s.people[c.id]!.now = s.now;
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
    log(s, 'word', `You began an interview with ${c.name}.`, { candidate: c.id });
    return s;
  }
  if (input.type === 'call-reference') {
    const ref = REFEREES.find((r) => r.id === input.referee && r.candidate === input.candidate);
    const c = CANDIDATES.find((p) => p.id === input.candidate);
    const card = s.cards[input.candidate];
    if (!ref || !c || !card?.met) return s;
    if (s.now % DAY < ref.reachableAt) {
      refuse(s, `${ref.name} cannot answer until ${timeLabel(ref.reachableAt)}; they are at work.`);
      return s;
    }
    const speaker = s.people[ref.id]!;
    const lines: SceneView['lines'] = [];
    const notes: Note[] = [];
    for (const q of QUALITIES) {
      const remembered = estimate(speaker, c.id, cue(q), s.now).value;
      const lie = speaker.traits.honesty < 0.4 && ref.bias !== 'fair';
      const claim = clamp(
        remembered +
          (ref.bias === 'fond' ? 0.24 : ref.bias === 'stingy' ? -0.35 : 0) +
          (lie ? (ref.bias === 'fond' ? 0.15 : -0.15) : 0),
      );
      notes.push(addNote(s, c.id, q, claim, 'heard', ref.name, ref.id));
      lines.push({ speaker: ref.name, text: referenceWords(q, claim, ref.bias), kind: 'speech' });
    }
    card.called.push(ref.id);
    s.scene = scene(
      s,
      'reference',
      ref.id,
      `Reference: ${c.name}`,
      'I remember her. What do you need to know?',
    );
    s.scene.lines = lines;
    s.scene.added = notes;
    log(s, 'word', `${ref.name}: “${lines[0]!.text}”`, { candidate: c.id });
    runTo(s, s.now + 15);
    return s;
  }
  if (input.type === 'place' || input.type === 'trial') {
    const c = CANDIDATES.find((c) => c.id === input.candidate);
    const card = s.cards[input.candidate];
    const f = FAMILIES.find((f) => f.id === input.family);
    const r = s.requests.find((r) => r.family === input.family && r.status === 'open');
    if (!c || !f || !card?.met || !r || !['bench', 'books'].includes(card.status)) {
      refuse(s, 'A free candidate and an open request are needed.');
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
    if (c.wage > r.wage) {
      refuse(s, `${c.name}: “I need ₺${c.wage}. That wage will not cover home.”`);
      return s;
    }
    if (card.refuses.some((a) => a.family === f.id)) {
      refuse(s, `${c.name}: “Not ${f.name}. I have heard enough.”`);
      return s;
    }
    if (input.type === 'trial') {
      card.status = 'trial';
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
    const vouched = [...new Set(input.vouch)].filter((q) => QUALITIES.includes(q));
    const p: Placement = {
      id: `placement-${s.placements.length + 1}`,
      candidate: c.id,
      family: f.id,
      role: r.role,
      since: s.now,
      trialEnds: (day(s) + 7) * DAY + 720,
      seems: 'unknown',
      status: 'trial',
      reportedStatus: 'trial',
      pendingFee: 0,
      vouched,
      story: [],
      moments: [],
      reported: 0,
      confidenceGiven: false,
      wage: r.wage,
    };
    s.placements.push(p);
    card.status = 'placed';
    r.status = 'filled';
    s.fees[f.id] ??= { first: false, second: false };
    const fee = s.fees[f.id]!;
    const firstPaid = fee.first ? 0 : r.wage / 2;
    fee.first = true;
    s.cash += firstPaid;
    for (const q of [...new Set([...vouched, ...card.coached])])
      believe(s.people[`${f.id}-0`]!, `${c.id}:${q}`, true, 0.92, 'nermin', s.now);
    log(
      s,
      'placement',
      `${c.name} placed with ${f.name}. ${firstPaid ? `Half the fee, ₺${firstPaid}, is in the cash box.` : `The earlier first half covers this replacement.`}`,
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
      reopen(s, p);
      p.status = 'withdrawn';
      p.reportedStatus = 'withdrawn';
      s.cards[p.candidate]!.status = 'books';
      p.story.push(`Nermin withdrew ${name(p.candidate)} on ${dateLabel(s.now)}.`);
      log(s, 'placement', `You brought ${name(p.candidate)} back from ${name(p.family)}.`, {
        placement: p.id,
      });
      runTo(s, s.now + 20);
      return s;
    }
    deliverReport(s, p);
    if (input.how === 'visit' && day(s) > Math.floor(p.since / DAY)) {
      const f = FAMILIES.find((f) => f.id === p.family)!;
      moment(s, p, f.pressure, p.moments.length + 10);
      deliverReport(s, p, true);
    }
    s.scene = scene(
      s,
      'check-in',
      p.family,
      `Check in: ${name(p.family)}`,
      p.lastWord ?? 'It is too early to say. Call after her first morning.',
    );
    runTo(s, s.now + (input.how === 'visit' ? 90 : 15));
    return s;
  }
  return s;
}
function referenceWords(q: Quality, claim: number, bias: string) {
  const words: Record<Quality, [string, string]> = {
    patient: ['She sat beside him until he calmed down.', 'She raised her voice when he asked again.'],
    honest: ['She brought back the shopping change.', 'We disagreed about the money she had taken.'],
    reliable: ['She was there before I left each morning.', 'I waited at the door more than once.'],
    warm: ['The children asked when she was coming back.', 'She kept herself apart from the children.'],
    hardworking: ['The work was done before she went home.', 'There were jobs left for me at night.'],
    discreet: [
      'She never discussed another house with me.',
      'I heard more about her old employers than I needed.',
    ],
  };
  return `${words[q][claim >= 0.55 ? 0 : 1]}${q === 'honest' && bias === 'stingy' ? ' She kept asking for wages before the month was over.' : q === 'honest' && bias === 'cagey' ? ' I would rather leave it there.' : ''}`;
}
export function view(state: State): View {
  const cached = snapshots.get(state);
  if (cached) return cached;
  const s = sim(state);
  const t = s.now % DAY;
  const cards: CandidateView[] = CANDIDATES.filter((c) => s.cards[c.id]!.met).map((c) => {
    const card = s.cards[c.id]!;
    const elapsed = s.now - card.arrived;
    return {
      id: c.id,
      name: c.name,
      age: c.age,
      roles: c.roles,
      look: c.look,
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
        ? { busy: `At ${name(s.placements.findLast((p) => p.candidate === c.id)!.family)} until 18:00` }
        : card.status === 'trial'
          ? { busy: 'At a trial morning; an answer is due at noon' }
          : {}),
      wage: card.wageKnown ? c.wage : null,
      experience: card.experience,
      notes: card.notes,
      referees: c.referees.map((id) => {
        const r = REFEREES.find((r) => r.id === id)!;
        return {
          id,
          name: r.name,
          reachable: t >= r.reachableAt,
          ...(t < r.reachableAt ? { why: `At work until ${timeLabel(r.reachableAt)}` } : {}),
          called: card.called.includes(id),
        };
      }),
      refuses: card.refuses,
    };
  });
  const families = FAMILIES.filter((f) => f.arrives <= s.now).map((f) => {
    const trust = trustOf(s.people[`${f.id}-0`]!, 'nermin');
    return {
      id: f.id,
      name: f.name,
      district: f.district,
      household: f.household.map((p) => ({ name: p.name, who: p.who })),
      trust: trust > 0.7 ? ('warm' as const) : trust < 0.45 ? ('cool' as const) : ('polite' as const),
      line: s.familyLines[f.id],
    };
  });
  const bench = cards.filter((c) => c.status === 'bench');
  const r = s.requests.find((r) => r.status === 'open');
  const phone = s.phones[0];
  const urgent = bench.find((c) => c.posture === 'leaving');
  const task: View['task'] = s.ended
    ? { text: 'The month is over. Read what happened beside what you believed.' }
    : s.scene
      ? { text: s.scene.title, target: { kind: 'scene', id: s.scene.id } }
      : phone
        ? { text: `${phone.who} is waiting on the phone.`, target: { kind: 'phone', id: 'phone' } }
        : urgent
          ? {
              text: `${urgent.name} has picked up her bag. Speak to her before she leaves.`,
              target: { kind: 'candidate', id: urgent.id },
            }
          : r
            ? {
                text: `${name(r.family)} need a ${r.role} by ${r.byLabel}. ${bench.length ? 'Candidates are waiting on your bench.' : 'Your books hold the people you have met.'}`,
                target: { kind: 'family', id: r.family },
              }
            : { text: 'Check in with a placed worker, or meet someone on your bench.' };
  const snapshot: View = structuredClone({
    seed: s.seed,
    now: s.now,
    dateLabel: dateLabel(s.now),
    timeLabel: timeLabel(s.now),
    speed: s.speed,
    slowed: !!(s.scene || phone || urgent || s.dayCard),
    open: day(s) % 7 !== 6 && t >= 510 && t < 1140,
    cash: s.cash,
    rent: { due: s.rentDue, amount: 5000, label: label(s.rentDue), short: s.cash < 5000 },
    task,
    phoneRinging: phone ? { who: phone.who, since: phone.since } : null,
    scene: s.scene,
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
        ...p
      }) => ({ ...p, status: reportedStatus }),
    ),
    log: s.log,
    city: {
      figures: [
        ...families.map((f) => {
          const def = FAMILIES.find((d) => d.id === f.id)!;
          return {
            id: f.id,
            name: f.name,
            x: def.x,
            y: def.y,
            kind: 'family' as const,
            mood: f.trust === 'cool' ? ('upset' as const) : ('easy' as const),
          };
        }),
        ...cards
          .filter((c) => c.status !== 'gone')
          .map((c, i) => ({
            id: c.id,
            name: c.name,
            x: 0.42 + (i % 6) * 0.025,
            y: 0.48 + Math.floor(i / 6) * 0.035,
            kind: c.status === 'placed' ? ('worker' as const) : ('candidate' as const),
            mood: 'easy' as const,
          })),
      ],
      threads: s.threads,
      houses: FAMILIES.filter((f) => f.arrives <= s.now).map((f) => ({ family: f.id, x: f.x, y: f.y })),
    },
    dayCard: s.dayCard,
    ended: s.ended,
    review: s.review,
  });
  snapshots.set(state, snapshot);
  return snapshot;
}
export function replay(seed: number, inputs: LoggedInput[], until: number): State {
  const s = sim(newGame(seed));
  for (const entry of inputs) {
    if (entry.at > until) break;
    if (entry.at < s.now) throw new Error('Run inputs are out of order.');
    runTo(s, entry.at);
    apply(s, entry.input);
  }
  runTo(s, until);
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
function moment(s: Sim, p: Placement, q: Quality, ordinal: number) {
  const f = FAMILIES.find((f) => f.id === p.family)!;
  const worker = s.people[p.candidate]!;
  const skill = skillLevel(worker, ROLE_SKILL[p.role]);
  const fatigue = worker.body.exertion;
  const ability = ['honest', 'discreet'].includes(q)
    ? quality(worker, q)
    : 0.72 * quality(worker, q) + 0.28 * skill;
  const good = ability - fatigue * 0.08 > 0.23 + 0.48 * roll(s, `moment:${p.id}:${day(s)}:${ordinal}`);
  const text = momentWords(q, good, f.pressureWords);
  p.moments.push({ day: day(s), quality: q, good, text });
  p.story.push(`${dateLabel(s.now)}: ${text}`);
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
  worker.body.exertion = clamp(worker.body.exertion + (hardHouse ? 0.06 : 0.02));
  worker.needs.autonomy = clamp(
    worker.needs.autonomy + (hardHouse ? -0.035 * (1 - worker.traits.agreeableness) : 0.012),
  );
  worker.needs.esteem = clamp(worker.needs.esteem + (good ? 0.025 : -0.035));
  worker.needs.safety = clamp(
    worker.needs.safety + (f.wage >= CANDIDATES.find((c) => c.id === worker.id)!.wage + 500 ? 0.012 : -0.008),
  );
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
    q === 'honest' &&
    !good &&
    worker.traits.honesty < 0.3 &&
    roll(s, `temptation:${p.id}:${day(s)}`) < 0.55
  ) {
    p.story.push(`${dateLabel(s.now)}: Shopping money went missing. ${name(p.candidate)} kept it.`);
    endPlacement(s, p, 'dismissed', 'The shopping money has gone. I cannot leave her with the children.');
  }
}
function momentWords(q: Quality, good: boolean, pressure: string) {
  const words: Record<Quality, [string, string]> = {
    patient: [
      'She waited through the repeated questions and answered gently.',
      'She snapped when the same question came again.',
    ],
    honest: [
      'She left the loose money on the table and accounted for every lira.',
      'The shopping change did not match the receipt.',
    ],
    reliable: [
      'She arrived before the household needed to leave.',
      'She was late. Someone had to stay home and wait.',
    ],
    warm: [
      'She noticed who had gone quiet and sat beside them.',
      'She kept apart when someone needed company.',
    ],
    hardworking: [
      'She finished the washing before sitting down.',
      'The last of the work was left for the family.',
    ],
    discreet: [
      'She turned the neighbour’s questions back to the weather.',
      'At the door, she repeated something private about the household.',
    ],
  };
  return `${pressure} ${words[q][good ? 0 : 1]}`;
}
function endPlacement(s: Sim, p: Placement, status: Placement['status'], words: string) {
  if (!['trial', 'kept'].includes(p.status)) return;
  p.status = status;
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
        { id: 'support', label: 'Support the worker' },
        { id: 'replace', label: 'Offer to find a replacement' },
      ],
    ),
    p.id,
  );
}
function deliverReport(s: Sim, p: Placement, visit = false, through = p.moments.length) {
  const unseen = p.moments.slice(p.reported, through);
  const f = FAMILIES.find((f) => f.id === p.family)!;
  const speaker = s.people[f.household[0]!.id]!;
  if (!unseen.length) return;
  for (const m of unseen) {
    const remembered = m.good ? 0.85 : 0.2;
    addNote(
      s,
      p.candidate,
      m.quality,
      visit ? (m.good ? 0.85 : 0.2) : remembered,
      visit ? 'seen' : 'heard',
      visit ? 'I saw her at work' : f.name,
      visit ? 'nermin' : speaker.id,
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
  p.lastWord = latest.text;
  s.familyLines[p.family] = latest.text;
  log(s, 'word', `${f.name}: “${latest.text}”`, {
    placement: p.id,
    candidate: p.candidate,
    family: p.family,
  });
}
function placementDay(s: Sim) {
  for (const p of s.placements) {
    if (!['trial', 'kept'].includes(p.status) || day(s) <= Math.floor(p.since / DAY)) continue;
    const worker = s.people[p.candidate]!;
    // Off-screen nights are ordinary rest, food and travel, not a month of idle HF simulation.
    worker.now = s.now - 45;
    worker.body.exertion *= 0.45;
    worker.body.sleepPressure = 0.15;
    worker.body.satiety = 0.9;
    worker.body.hydration = 0.95;
    worker.needs.autonomy = clamp(worker.needs.autonomy + 0.02);
    tick(worker, s.now);
    const f = FAMILIES.find((f) => f.id === p.family)!;
    for (const m of f.household) {
      const member = s.people[m.id]!;
      member.now = s.now - 30;
      member.body.satiety = 0.9;
      member.body.hydration = 0.95;
      member.body.sleepPressure = 0.15;
      tick(member, s.now);
    }
    if (day(s) - Math.floor(p.since / DAY) >= 3) {
      const fair = worker.needs.autonomy > 0.3;
      confirm(worker, `${f.id}:kind`, fair, s.now);
      confirm(worker, 'nermin:reliable', fair, s.now);
    }
    const count = 1 + (hash(`${s.seed}:count:${p.id}:${day(s)}`) % 3);
    for (let n = 0; n < count && ['trial', 'kept'].includes(p.status); n++) {
      const q =
        n === 0 ? f.pressure : QUALITIES[hash(`${s.seed}:${p.id}:${day(s)}:${n}`) % QUALITIES.length]!;
      moment(s, p, q, n);
    }
    if (!['trial', 'kept'].includes(p.status)) continue;
    if (
      (worker.needs.autonomy < 0.22 || (worker.needs.safety < 0.25 && worker.affect.mood.valence < -0.15)) &&
      day(s) - Math.floor(p.since / DAY) >= 4
    ) {
      endPlacement(s, p, 'quit', 'I cannot keep working those hours. I have my own family to get home to.');
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
            { id: 'ask-more', label: 'Ask how she is managing' },
          ],
        ),
        p.id,
      );
    }
    if (day(s) - Math.floor(p.since / DAY) >= 1) {
      const prior = p.moments.filter((m) => m.day < day(s));
      if (prior.length && !s.phones.some((ph) => ph.placement === p.id && ph.scene.kind === 'check-in')) {
        const latest = prior.at(-1)!;
        queue(
          s,
          p.family,
          scene(s, 'check-in', p.family, `Word from ${f.name}`, latest.text, [
            { id: 'listen', label: 'Listen to what happened' },
            { id: 'support', label: 'Ask them to give her time' },
          ]),
          p.id,
          prior.length,
        );
      }
      // Opening family's first noon report is the deliberate exception to next-day delivery.
      if (day(s) === 1 && p.family === 'arslans') s.eventKeys.push(`noon:${p.id}`);
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
      const secondPaid = kept && !fee.second ? p.wage / 2 : 0;
      if (kept) {
        p.pendingFee = secondPaid;
        fee.second = true;
      } else {
        s.cards[p.candidate]!.status = 'books';
      }
      const words = kept
        ? 'We would like her to stay. She has found her way with us. The rest of your fee is ready.'
        : 'It has not worked. We need someone who can manage the mornings without us standing by.';
      p.story.push(`${dateLabel(s.now)}: ${words}`);
      const family = s.people[`${p.family}-0`]!;
      believe(family, 'nermin:reliable', true, 0.9, 'nermin', s.now);
      confirm(family, 'nermin:reliable', kept, s.now);
      const worker = s.people[p.candidate]!;
      worker.memory.sourceTrust.nermin = clamp(trustOf(worker, 'nermin') + (kept ? 0.08 : -0.12));
      confirm(worker, `${p.family}:kind`, kept, s.now);
      confirm(worker, 'nermin:reliable', kept, s.now);
      queue(
        s,
        p.family,
        scene(s, 'verdict', p.family, `Trial week: ${name(p.candidate)}`, words, [
          { id: 'thank', label: kept ? 'Thank the family' : 'Accept their answer' },
          { id: 'support', label: 'Speak for the worker' },
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
    const good = 0.7 * quality(worker, f.pressure) + 0.3 * skillLevel(worker, ROLE_SKILL[f.role]) > 0.55;
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
        ? 'She settled in. I would like to try a week.'
        : 'It was hard going. She did not seem at ease here.',
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
    log(s, 'money', 'Rent paid: ₺5000. Mr Hüsnü left a receipt.');
    return;
  }
  const exchange = scene(
    s,
    'rent',
    'husnu',
    'Mr Hüsnü: the rent',
    'Friday. The rent is ₺5000. What can you give me today?',
    [
      {
        id: 'pay-part',
        label: 'Pay what is in the cash box',
        hint: `Pay ₺${s.cash}. The rest is still owed.`,
      },
      { id: 'promise', label: 'Promise next Friday', hint: 'He will record this rent as missed.' },
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
    log(s, 'money', `Mr Hüsnü accepted ₺${paid}. “That is a missed rent. I cannot carry two.”`);
  } else log(s, 'money', 'Rent paid: ₺5000. Mr Hüsnü left a receipt.');
  s.scene = null;
  if (s.missedRent >= 2)
    finish(s, 'Two missed rents. Mr Hüsnü took back the office key. The month ended early.');
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
    finish(s, 'Two missed rents. Mr Hüsnü took back the office key. The month ended early.');
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
      const exchange = converse(s.people[from]!, s.people[to]!, {
        at: s.now,
        placeId: place,
        topics: ['nermin'],
        maxClaims: 2,
      });
      for (const told of exchange.told)
        for (const claim of told.claims ?? []) {
          const about = claim.prop.split(':')[0]!;
          const sources = s.people[from]!.memory.beliefs.find((b) => b.prop === claim.prop)?.sources ?? [];
          const own = sources.some((source) => source.id === from || source.id === 'self');
          const parent = own
            ? undefined
            : s.routes.findLast(
                (r) =>
                  r.to === from.replace(/-0$/, '') &&
                  s.routeFacts[r.id]?.prop === claim.prop &&
                  s.routeFacts[r.id]?.value === claim.value &&
                  sources.some(
                    (source) => source.id.replace(/-0$/, '') === r.from && source.value === claim.value,
                  ),
              );
          const id = s.routes.length + 1;
          s.routes.push({
            id,
            at: s.now,
            from: from.replace(/-0$/, ''),
            to: to.replace(/-0$/, ''),
            about,
            words: spokenClaim(claim.prop, claim.value),
            ...(parent ? { parent: parent.id } : {}),
          });
          s.routeFacts[id] = { prop: claim.prop, value: claim.value };
        }
      perceive(s.people[to]!, exchange.told);
      for (const ev of exchange.socialEvents.speaker) socialEvent(s.people[from]!, ev);
      for (const ev of exchange.socialEvents.listener) socialEvent(s.people[to]!, ev);
      // A thread marks an actual spoken claim, not a scheduled meeting with nothing said.
      if (exchange.told.length)
        s.threads.push({ at: s.now, from: from.replace(/-0$/, ''), to: to.replace(/-0$/, ''), place });
    }
  }
  log(
    s,
    'city',
    workers ? 'Workers met for tea in Kültürpark.' : 'Families met at Saturday tea. Their words will travel.',
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
            words: `Not ${f.name}. Everyone has heard how they treat people.`,
          });
          log(s, 'word', `${c.name}: “Not ${f.name}. Everyone has heard how they treat people.”`, {
            candidate: c.id,
            family: f.id,
          });
        }
      }
}

function recordConfidence(s: Sim, candidate: string) {
  const p = s.placements.find((p) => p.candidate === candidate && p.confidenceGiven);
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
            hint: '₺1800. The worker trusted you with this.',
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
        'A better-paid household',
        `Could you bring ${name(p.candidate)} to us instead? There is ₺6000 for finding her. Her present family need not know until she agrees.`,
        [
          {
            id: 'accept-poach',
            label: 'Make the offer to the worker',
            hint: '₺6000 if she agrees. Her family will lose her.',
          },
          { id: 'decline', label: 'Leave her in her present place' },
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
        'There is ₺1200 here. Send me to a house that pays. You do not have to write this down.',
        [
          { id: 'take-envelope', label: 'Take the envelope', hint: '₺1200. She expects a good placement.' },
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
      family.memory.sourceTrust.nermin = clamp(trustOf(family, 'nermin') + 0.06);
      log(s, 'money', `You repeated ${name(offer.candidate)}’s confidence. ${name(sc.with)} paid ₺1800.`);
      // The path is recorded; only some tellings find their way back to the house.
      s.threads.push({ at: s.now, from: 'nermin', to: sc.with, place: 'telephone', about: offer.family });
      s.routes.push({
        id: s.routes.length + 1,
        at: s.now,
        from: 'nermin',
        to: sc.with,
        about: offer.family,
        words: secret.text,
      });
      if (roll(s, `trace:${sc.id}`) < 0.7)
        s.eventKeys.push(`trace-secret:${offer.candidate}:${offer.family}:${s.now + DAY}`);
    }
  } else if (choice === 'take-envelope' && offer.kind === 'envelope') {
    s.cash += 1200;
    s.eventKeys.push(`envelope:${offer.candidate}`);
    s.envelopePromise = { candidate: offer.candidate, at: s.now + 2 * DAY };
    log(s, 'money', `${name(offer.candidate)} left ₺1200 on the desk. She expects the next suitable house.`);
  } else if (offer.kind === 'refund') {
    delete s.envelopeDebt;
    if (choice === 'refund-envelope' && s.cash >= 1200) {
      s.cash -= 1200;
      log(s, 'money', `You returned ₺1200 to ${name(offer.candidate)}.`);
    } else {
      worker.memory.sourceTrust.nermin = clamp(trustOf(worker, 'nermin') - 0.25);
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
        endPlacement(s, p, 'withdrawn', `Nermin found me a better-paid house with ${f.name}.`);
        p.reportedStatus = 'withdrawn';
        s.people[`${old}-0`]!.memory.sourceTrust.nermin = clamp(
          trustOf(s.people[`${old}-0`]!, 'nermin') - 0.3,
        );
        log(
          s,
          'money',
          `${name(offer.candidate)} accepted the offer. ${f.name} paid the ₺6000 finder’s fee.`,
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
          pendingFee: 0,
          vouched: [],
          story: [`Moved from ${name(old)} by Nermin’s offer.`],
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
    log(s, 'word', 'You pushed the envelope back across the desk. “Find me a place anyway,” she said.');
  else if (choice === 'keep-private' || choice === 'change-subject')
    log(s, 'word', 'You kept the household’s private words to yourself. The caller changed the subject.');
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
          'Something from inside this house has been repeated. We know who told you. She cannot stay.',
        );
      for (const c of CANDIDATES.filter((c) => s.cards[c.id]!.met))
        s.people[c.id]!.memory.sourceTrust.nermin = clamp(trustOf(s.people[c.id]!, 'nermin') - 0.18);
      for (const c of CANDIDATES.filter((c) => s.cards[c.id]!.met))
        confirm(s.people[c.id]!, 'nermin:reliable', false, s.now);
      log(s, 'word', `${name(candidate)}: “I told only you. They knew my words.”`, { candidate, family });
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
    log(s, 'word', `${name(promise.candidate)}: “You did find me a house. I remember that.”`);
    return;
  }
  const call = scene(
    s,
    'offer',
    promise.candidate,
    'The envelope comes back',
    'You took my money. I am still without work. Give it back, or find me a place.',
    [
      { id: 'keep-envelope', label: 'Keep the money', hint: 'She will tell people what happened.' },
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
  const claims: Record<string, [string, string]> = {
    reliable: [`You can rely on ${subject}.`, `You cannot rely on ${subject}.`],
    honest: [`${subject} has been straight with people.`, `${subject} has not been straight with people.`],
    kind: [`${subject} has treated people well.`, `${subject} has treated people badly.`],
    patient: [`${subject} gives people time.`, `${subject} gets cross when people need time.`],
    warm: [`${subject} makes people feel welcome.`, `${subject} keeps apart from people.`],
    hardworking: [`${subject} finishes the work.`, `${subject} leaves work for other people.`],
    discreet: [`${subject} keeps private words private.`, `${subject} repeats private words.`],
  };
  return (
    claims[trait ?? '']?.[value ? 0 : 1] ??
    `${subject}: ${value ? 'that is what I heard' : 'I heard otherwise'}.`
  );
}
