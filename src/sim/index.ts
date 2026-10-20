import {
  believe,
  confirm,
  estimate,
  glimpse,
  hear,
  impressionConfidence,
  outwardSigns,
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
  TalkThread,
  View,
} from './types.ts';
import { QUALITIES } from './types.ts';
import { answer, questions } from './voices.ts';
import { CANDIDATES, FAMILIES, makePeople, QUALITY_MAP, quality, REFEREES } from './world.ts';

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
  story: string[];
  moments: { day: number; quality: Quality; good: boolean; text: string }[];
  reported: number;
  confidenceGiven: boolean;
  wage: number;
}
interface Phone {
  since: number;
  who: string;
  scene: SceneView;
  placement?: string;
}
interface Sim extends State {
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
const sim = (s: State) => s as Sim;
const DAY = 1440;
const END = 27 * DAY + 1140;
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const day = (s: State) => Math.floor(s.now / DAY);
const name = (id: string) =>
  CANDIDATES.find((c) => c.id === id)?.name ??
  FAMILIES.find((f) => f.id === id)?.name ??
  REFEREES.find((r) => r.id === id)?.name ??
  id;
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
function queue(s: Sim, who: string, exchange: SceneView, placement?: string) {
  s.phones.push({ since: s.now, who: name(who), scene: exchange, ...(placement ? { placement } : {}) });
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
      Object.assign(s.cards[c.id]!, { met: true, status: 'bench', arrived: s.now });
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
      s.requests.push(request);
      s.familyLines[f.id] = f.wants;
      log(s, 'word', `${f.name}: “${f.wants}”`, { family: f.id });
      if (f.arrives > 510)
        queue(
          s,
          f.id,
          scene(
            s,
            'phone',
            f.id,
            `Request: ${f.name}`,
            `${f.wants} We can pay ₺${f.wage}. I need someone by ${label(f.deadline)}.`,
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
    requests: [],
    placements: [],
    cash: 3000,
    rentDue: 4 * DAY + 1020,
    missedRent: 0,
    scene: null,
    phones: [],
    log: [],
    threads: [],
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
    threads: s.threads,
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
    const next = Math.min(end, Math.floor(s.now) + 1);
    s.now = next;
    if (Number.isInteger(next)) step(s);
    if (stopOnNew && (s.phones.length > phones || (!card && s.dayCard) || (!openScene && s.scene))) break;
  }
}
export function advance(state: State, minutes: number): State {
  const s = sim(state);
  if (Number.isFinite(minutes) && minutes > 0) runTo(s, s.now + minutes, true);
  return s;
}
function refuse(s: Sim, text: string) {
  log(s, 'word', text);
}
export function apply(state: State, input: Input): State {
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
        if (Object.values(card.asked).reduce((a, b) => a + b, 0) === 1)
          sc.lines.push({ speaker: '', text: a.notice, kind: 'notice' });
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
      sc.choices = interviewChoices(s, c.id);
      return s;
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
      log(s, 'word', `${p.who}: “${p.scene.lines[0]!.text}”`);
    }
    return s;
  }
  if (input.type === 'interview') {
    const c = CANDIDATES.find((p) => p.id === input.candidate);
    const card = s.cards[input.candidate];
    if (!c || !card?.met || !['bench', 'books'].includes(card.status)) {
      refuse(s, 'That candidate is not available for an interview.');
      return s;
    }
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
    s.cash += r.wage / 2;
    for (const q of [...new Set([...vouched, ...card.coached])])
      believe(s.people[`${f.id}-0`]!, `${c.id}:${q}`, true, 0.92, 'nermin', s.now);
    log(
      s,
      'placement',
      `${c.name} placed with ${f.name}. Half the fee, ₺${r.wage / 2}, is in the cash box.`,
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
      p.status = 'withdrawn';
      s.cards[p.candidate]!.status = 'books';
      p.story.push(`Nermin withdrew ${name(p.candidate)} on ${dateLabel(s.now)}.`);
      log(s, 'placement', `You brought ${name(p.candidate)} back from ${name(p.family)}.`, {
        placement: p.id,
      });
      runTo(s, s.now + 20);
      return s;
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
      status: card.status,
      ...(card.status === 'bench'
        ? {
            posture:
              elapsed > 180
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
  return structuredClone({
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
        ...p
      }) => p,
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
