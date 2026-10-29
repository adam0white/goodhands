/** Current Good Hands runtime. All actor changes pass through HF's public Run protocol. */

import * as HF from '@adam0white/human-framework';
import type * as Old from '@adam0white/human-framework-legacy3';
import { canonicalPersona } from '@adam0white/lab-client';
import { CAST } from './cast.ts';
import { authoredPerson } from './hf4-author.ts';
import { portablePremises } from './hf4-cast.ts';
import {
  type Bridge,
  EDITION,
  hostHead,
  input,
  MINUTE,
  need,
  restore as restoreBridge,
  save,
  advance as serve,
  type World,
  workForAccount,
} from './hf4-host.ts';
export type Person = Old.Person;
export type Traits = Old.Traits;
export type Values = Old.Values;
export type Affordance = Old.Affordance;
export type CalendarPersonaSnapshot = Old.CalendarPersonaSnapshot;
export type PersonaProjectionSnapshot = Old.PersonaProjectionSnapshot;
export type PersonaCalendarMap = Old.PersonaCalendarMap;
export const DEFAULT_NORMS = HF.DEFAULT_NORMS;
export const ENGINE_VERSION = '4.7.0';
type Opening = Parameters<typeof import('@adam0white/human-framework-legacy3').createPerson>[0];
type WorkReceipt = { skill?: string; psychological?: HF.ActualConsequences['psychological'] };
type Context = {
  work: Map<string, WorkReceipt>;
  careDay: number;
  seed: number;
  people: Record<string, Person>;
  authors: Map<string, HF.PersonAuthoring>;
  offers: Map<string, readonly HF.Offer[]>;
  bridge?: Bridge;
  initial: { kind: HF.Input['kind']; payload: HF.Input['payload'] }[];
  state?: { hf4?: unknown };
  decisions: Map<string, Old.Decision>;
  scheduled: { at: number; offer: HF.Offer }[];
};
let constructing: Context | undefined;
const contexts = new WeakMap<Person, Context>();
const stateContexts = new WeakMap<object, Context>();
export function beginFramework(seed: number) {
  constructing = {
    work: new Map(),
    careDay: 0,
    seed,
    people: {},
    authors: new Map(),
    offers: new Map(),
    initial: [],
    decisions: new Map(),
    scheduled: [],
  };
}
export function authorPerson(spec: Opening): HF.PersonAuthoring {
  const p = authoredPerson(spec.id, spec.name ?? spec.id, spec.sex ?? 'female');
  const cast = (CAST as Record<string, { castId: string }>)[spec.id];
  if (cast) p.identity.castId = cast.castId;
  p.identity.birthAt = Math.round((spec.bornAt ?? 510 - 30 * 365.25 * 1440) * MINUTE);
  p.state.traits = { ...p.state.traits, ...spec.traits };
  p.state.values = { ...p.state.values, ...spec.values };
  p.state.needs = { ...p.state.needs, ...spec.needs };
  p.state.skills = Object.entries(spec.skills ?? {}).map(([id, level]) => ({
    id,
    level,
    practicedMs: 0,
    lastPracticed: 510 * MINUTE,
  }));
  p.state.voices = (spec.voices ?? []).map((v) => ({ ...v, trust: v.trust ?? 0.5 }));
  p.state.heldNorms = DEFAULT_NORMS.map((n) => ({
    normId: n.id,
    standing: n.standing,
    conviction: 0.5,
    provenance: n.provenance,
  }));
  p.state.relationships = (spec.relationships ?? []).map((r) => ({
    otherId: r.otherId,
    affection: r.affection ?? 0,
    familiarity: r.familiarity ?? 0,
    trust: r.trust ?? 0.5,
    respect: r.respect ?? 0,
    roles: r.roles ?? [],
    ledger: 0,
    lastInteraction: 510 * MINUTE,
  }));
  return p;
}
export function createPerson(spec: Opening): Person {
  if (!constructing) throw new Error('Good Hands has no opening under construction.');
  const authored = authorPerson(spec);
  constructing.authors.set(spec.id, authored);
  const p = {
    id: spec.id,
    name: spec.name ?? spec.id,
    now: spec.now ?? 510,
    engine: ENGINE_VERSION,
    traits: authored.state.traits,
    values: authored.state.values,
    skills: Object.fromEntries(
      authored.state.skills.map((s) => [
        s.id,
        { level: s.level, practice: 0, lastPracticed: s.lastPracticed / MINUTE },
      ]),
    ),
    life: { bornAt: authored.identity.birthAt / MINUTE, sex: authored.identity.sex },
    body: { ...authored.state.body, alive: true, sleepDebt: 0, circadianPeak: 960, downed: false },
    needs: { ...authored.state.needs },
    affect: { mood: { ...authored.state.affect.mood } },
    memory: { episodes: [], beliefs: [], sourceTrust: {}, expectations: [], gists: [], contradictions: [] },
    social: { relationships: authored.state.relationships, impressions: [] },
    agenda: { commitments: [], owed: [], goals: [], precommitments: [], exemptions: {} },
    conscience: { norms: authored.state.heldNorms },
    lexicon: { plainEnglish: true },
    rng: {},
    skillRetention: {},
  } as unknown as Person;
  constructing.people[p.id] = p;
  contexts.set(p, constructing);
  return p;
}
function context(p: Person): Context {
  const c = contexts.get(p);
  if (!c) throw new Error('Unbound Good Hands actor.');
  return c;
}
function specFor(c: Context): HF.RunSpec {
  const ids = Object.keys(c.people),
    skills = [...new Set([...c.authors.values()].flatMap((p) => p.state.skills.map((s) => s.id)))];
  const premises = portablePremises([...c.authors.values()], (c.state as any)?.castChapter?.vocabulary);
  const normMap = new Map(DEFAULT_NORMS.map((n) => [n.id, n]));
  for (const norm of premises.norms) {
    const known = normMap.get(norm.id);
    if (known && canonicalPersona(known) !== canonicalPersona(norm))
      throw new Error('Conflicting sourced norm definitions.');
    normMap.set(norm.id, norm);
  }
  const actions = [
    ...new Set([
      ...premises.actions,
      'rest',
      'eat',
      'drink',
      'sleep',
      'cold-food-trial',
      'leave-for-home',
      'voice-office-work',
      'selin-enquiry',
      'placement-work',
      'household-meal',
      'interview',
      'wait',
    ]),
  ];
  return {
    id: 'goodhands',
    seed: c.seed,
    start: 510 * MINUTE,
    host: { id: 'goodhands', edition: EDITION, schema: EDITION },
    definitions: {
      actions: actions.map((id) => ({
        id,
        label: id,
        demands: { effort: 0, focus: 0, mode: id === 'sleep' ? 'sleep' : 'awake', requires: {} },
        tags: [],
        norms: [],
      })),
      norms: [...normMap.values()],
      marriageCustoms: [],
      skills: skills.map((id) => ({ id, label: id, domain: 'motor' })),
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [
        { type: 'host', id: 'goodhands' },
        ...ids.map((id) => ({ type: 'person' as const, id })),
        ...[...new Set([...ids, ...premises.sources])].map((id) => ({ type: 'voice' as const, id })),
      ],
      lexicon: {
        names: Object.fromEntries(ids.map((id) => [id, c.people[id]!.name])),
        roles: {},
        prefer: 'name',
        actions: {},
      },
      calendar: {
        id: 'goodhands-november-2026',
        epoch: { id: '2026-11-02', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: 86400000,
        days: Array.from({ length: 30 }, (_, dayIndex) => ({
          dayIndex,
          start: dayIndex * 86400000,
          windows: [],
        })),
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: {
      revision: 0,
      facts: premises.entities.map((id) => ({
        id: `declared:${id}`,
        subject: id,
        predicate: 'declared-history-entity',
        value: true,
        at: 510 * MINUTE,
        provenance: { source: 'goodhands', evidenceId: 'authored:retained-history' },
      })),
      hostState: hostHead(0),
    },
  };
}
export function overrideOpening(state: object, id: string, authored: HF.PersonAuthoring) {
  const c = stateContexts.get(state) ?? constructing;
  if (!c || c.bridge) throw new Error('The opening has already started.');
  c.authors.set(id, authored);
}
export function finalizeFramework(state: { people: Record<string, Person>; hf4?: unknown }) {
  const c = constructing;
  if (!c) throw new Error('Missing opening.');
  c.state = state;
  c.people = state.people;
  for (const p of Object.values(state.people)) contexts.set(p, c);
  stateContexts.set(state, c);
  const spec = specFor(c),
    run = need(HF.createRun(spec));
  for (const p of c.authors.values()) need(HF.createPerson(run, p));
  c.bridge = { run, host: { at: spec.start, serial: 0, revision: 0, active: [], completed: [] } };
  // Host state is admitted through the first world receipt; the envelope keeps ingress metadata.
  constructing = undefined;
  const initial = [...c.initial];
  careCommands(c, 510);
  if (initial.length) sendBatch(c, 510, initial);
  c.careDay = 1;
  refresh(c);
  saveFramework(state);
}
export function runFor(state: object): HF.Run {
  return bound(state).bridge!.run;
}
function bound(state: object): Context {
  let c = stateContexts.get(state);
  if (c) return c;
  const s = state as {
    people: Record<string, Person>;
    hf4?: { version: string; archive: HF.RunArchive; host: Bridge['host'] };
  };
  if (!s.hf4 || s.hf4.version !== EDITION)
    throw new Error('This file uses an older Good Hands version. Keep it and start a new game.');
  c = {
    work: new Map((s.hf4 as any).work ?? []),
    careDay: (s.hf4 as any).careDay ?? 0,
    seed: 0,
    people: s.people,
    authors: new Map(
      s.hf4.archive.initial.people.map((p) => [p.id, structuredClone(p) as HF.PersonAuthoring]),
    ),
    offers: new Map((s.hf4 as any).offers ?? []),
    initial: [],
    state: s,
    decisions: new Map(),
    scheduled: structuredClone((s.hf4 as any).scheduled ?? []),
    bridge: restoreBridge({ version: EDITION, run: s.hf4.archive, host: s.hf4.host }),
  };
  stateContexts.set(state, c);
  for (const p of Object.values(s.people)) contexts.set(p, c);
  refresh(c);
  return c;
}
export function bindFramework(state: object) {
  bound(state);
}
export function completedAction(p: Person, actionId: string) {
  return context(p).bridge!.host.completed.some(
    (a) => a.person === p.id && a.actionId === actionId && a.status === 'completed',
  );
}
export function placementWorkForReport(p: Person, now: number, since: number, lastReportedStart?: number) {
  const host = context(p).bridge!.host;
  return workForAccount(host, p.id, Math.max(now * MINUTE, host.at), since * MINUTE, lastReportedStart);
}

export function saveFramework(state: object) {
  const c = bound(state);
  (state as { hf4?: unknown }).hf4 = {
    version: EDITION,
    archive: HF.exportRun(c.bridge!.run),
    host: structuredClone(c.bridge!.host),
    careDay: c.careDay,
    offers: structuredClone([...c.offers]),
    scheduled: structuredClone(c.scheduled),
    work: structuredClone([...c.work]),
  };
}
function part(
  c: Context,
  id: string,
  selection: HF.InspectQuery['select'][number],
  perspective: HF.InspectQuery['perspective'] = { kind: 'host' },
): any {
  const view = need(HF.inspect(c.bridge!.run, { perspective, people: [id], select: [selection] }));
  return view.people[0]!.parts[0]!.value;
}
export function portableFor(state: object, id: string): HF.PortablePerson {
  const c = bound(state),
    castId = c.authors.get(id)?.identity.castId ?? `hf.goodhands.${id}`;
  const v = need(
    HF.inspect(c.bridge!.run, {
      perspective: { kind: 'host' },
      people: [id],
      select: ['persona', 'calendar'],
      portable: {
        person: id,
        castId,
        castRevision: (CAST as Record<string, { revision: string }>)[id]?.revision ?? '1',
      },
    }),
  );
  return v.people[0]!.parts.find((p) => p.select === 'persona')!.value as HF.PortablePerson;
}
export function skillReadingsFor(state: object, id: string): HF.SkillReading[] {
  return structuredClone(part(bound(state), id, 'skills'));
}
function refresh(c: Context) {
  if (!c.bridge) return;
  const views = need(
    HF.inspect(c.bridge.run, {
      perspective: { kind: 'host' },
      people: Object.keys(c.people),
      select: [
        'summary',
        'body',
        'traits',
        'skills',
        'needs',
        'agenda',
        'beliefs',
        'sourceTrust',
        'relationships',
        'condition',
      ],
    }),
  ).people;
  for (const p of Object.values(c.people)) {
    const id = p.id,
      parts = Object.fromEntries(
        views.find((v) => v.id === id)!.parts.map((v) => [v.select, v.value]),
      ) as any;
    const summary = parts.summary,
      body = parts.body,
      traits = parts.traits,
      skills = parts.skills,
      needs = parts.needs,
      agenda = parts.agenda;
    p.now = Math.floor(c.bridge.host.at / MINUTE);
    p.traits = structuredClone(traits);
    p.body = {
      ...body.state,
      sleepDebt: body.state.sleepDebtHours,
      circadianPeak: body.state.circadianPeakMs / MINUTE,
    } as Person['body'];
    p.needs = Object.fromEntries(needs.map((n: any) => [n.id, n.level])) as Person['needs'];
    p.skills = Object.fromEntries(
      skills.map((s: any) => [
        s.id,
        { level: s.competence, practice: s.practicedMs / MINUTE, lastPracticed: s.lastPracticed / MINUTE },
      ]),
    );
    p.memory.beliefs = structuredClone(parts.beliefs);
    p.memory.sourceTrust = structuredClone(parts.sourceTrust);
    p.social.relationships = structuredClone(parts.relationships.ties);
    p.affect.mood = { valence: parts.condition.outwardSigns.mood ?? 0, arousal: 0.3 };
    p.agenda = structuredClone(agenda);
    p.agenda.commitments = p.agenda.commitments.map((a) => ({
      ...a,
      from: a.from / MINUTE,
      until: a.until / MINUTE,
      ...('recurEveryMs' in a ? { recurEvery: Number(a.recurEveryMs) / MINUTE } : {}),
    }));
    const active = c.bridge.host.active.find((a) => a.person === id);
    p.activity = active
      ? ({
          id: active.id,
          startedAt: active.startedAt / MINUTE,
          endsAt: (active.startedAt + active.offer.durationMs) / MINUTE,
          affordance: fromOffer(active.offer),
        } as unknown as Person['activity'])
      : null;
  }
}
function worldFor(c: Context): World {
  return {
    canStart(person, offer) {
      const state = c.state as
        | {
            castPaused?: boolean;
            placements?: { candidate: string; status: string }[];
            guests?: { id: string; status: string }[];
          }
        | undefined;
      if (!Object.hasOwn(c.people, person) || state?.castPaused) return false;
      if (offer.actionId === 'cold-food-trial' || offer.actionId === 'selin-enquiry')
        return !!state?.guests?.some((g) => g.id === person && g.status === 'available');
      if (offer.actionId === 'leave-for-home' && person !== 'zeynep-pass') return false;
      if (offer.actionId === 'voice-office-work' && person !== 'selin-voice') return false;
      if (offer.actionId === 'placement-work')
        return !!state?.placements?.some(
          (p) => p.candidate === person && ['trial', 'kept'].includes(p.status),
        );
      return true;
    },
    finish(active, at, interrupt) {
      const id = active.offer.actionId,
        work = c.work.get(active.offer.id);
      const guest = (c.state as { guests?: { id: string; trial?: { succeeded: boolean } }[] })?.guests?.find(
        (g) => g.id === active.person,
      );
      const trial = id === 'cold-food-trial';
      return {
        disposition: interrupt ? 'interrupted' : 'completed',
        summary: trial
          ? `Cold dishes ${guest?.trial?.succeeded ? 'were ready as agreed' : 'needed correction'}.`
          : `${active.offer.label} ${interrupt ? 'was interrupted' : 'finished'}.`,
        actual: {
          exposures: [],
          observedProgress: [],
          ...(!interrupt && work ? { psychological: work.psychological, practice: { quality: 0.6 } } : {}),
          ...(!interrupt && trial ? { practice: { quality: guest?.trial?.succeeded ? 1 : 0.25 } } : {}),
          ...(!interrupt && id === 'rest' ? { psychological: { leisure: 0.1 } } : {}),
          ...(!interrupt && (id === 'eat' || id === 'household-meal')
            ? { consumed: { food: 0.6, water: 0.6 } }
            : !interrupt && id === 'drink'
              ? { consumed: { water: 0.6 } }
              : {}),
        },
      };
    },
    communicate(request) {
      emitted.push(request);
      return {
        emittedItemIds: request.items.map((i) => i.id),
        received: request.recipients
          .filter(
            (person) => conversationPair?.speaker === request.speaker && conversationPair.listener === person,
          )
          .map((person) => ({
            recipient: person,
            evidenceId: `received:${request.id}:${person}`,
            itemIds: request.items.map((i) => i.id),
            attention: 1,
          })),
      };
    },
  };
}
function sendBatch(
  c: Context,
  minute: number,
  commands: { kind: HF.Input['kind']; payload: HF.Input['payload'] }[],
) {
  if (!c.bridge) {
    c.initial.push(...commands);
    return;
  }
  const at = Math.max(Math.round(minute * MINUTE), c.bridge.host.at + 1);
  const inputs = commands.map(
    (x, i) =>
      ({
        id: `goodhands:${c.bridge!.host.serial + i + 1}`,
        at,
        source: { type: 'host' as const, id: 'goodhands' },
        kind: x.kind,
        payload: x.payload,
      }) as HF.Input,
  );
  const result = serve(c.bridge, at, inputs, c.offers, worldFor(c));
  refresh(c);
  return result;
}
/** Offers are one opportunity. An accepted activity retains its own offer snapshot. */
function closeOffers(c: Context, person: string, minute: number) {
  const revision = c.bridge!.host.serial + 1;
  sendBatch(c, minute, [{ kind: 'offers.received', payload: { person, revision, offers: [] } }]);
  c.offers.set(person, []);
}
function send(p: Person, kind: HF.Input['kind'], payload: Record<string, unknown>, minute = p.now) {
  const c = context(p);
  sendBatch(c, minute, [
    {
      kind,
      payload: {
        person: p.id,
        evidenceId: `goodhands:evidence:${c.bridge?.host.serial ?? c.initial.length}:${p.id}`,
        ...payload,
      } as HF.Input['payload'],
    },
  ]);
}
export function outwardSigns(p: Person) {
  return part(context(p), p.id, 'condition').outwardSigns;
}
export function selfReport(p: Person) {
  return part(context(p), p.id, 'condition').selfReport;
}
export function trustOf(p: Person, id: string) {
  return p.memory.sourceTrust[id] ?? 0.5;
}
export function skillLevel(p: Person, id: string) {
  const c = context(p);
  if (!c.bridge) return p.skills[id]?.level ?? 0.05;
  return part(c, p.id, 'skills').find((s: HF.SkillReading) => s.id === id)?.competence ?? 0.05;
}
export function credence(p: Person, prop: string) {
  const b = p.memory.beliefs.find((b) => b.prop === prop);
  return (b as unknown as { credence?: number } | undefined)?.credence ?? 0.5;
}
export function estimate(p: Person, targetId: string, key: string, _at: number) {
  const reading = part(context(p), targetId, 'condition', {
    kind: 'person',
    observer: p.id,
  }) as HF.ImpressionReading;
  return reading.cues.find((c) => c.key === key) ?? { value: 0.5, confidence: 0 };
}
export function glimpse(p: Person, target: string, signs: HF.ConditionReading['outwardSigns'], at: number) {
  send(p, 'person.glimpsed', { target, signs, clarity: 1 }, at);
}
export function hear(
  p: Person,
  target: string,
  key: string,
  value: number,
  at: number,
  weight = 1,
  teller = target,
) {
  send(p, 'person.reported', { target, key, value, weight, teller }, at);
}
export function acquaint(
  p: Person,
  target: string,
  familiarity: number,
  known: { traits?: Partial<Traits> },
  at: number,
) {
  send(
    p,
    'acquaintance.received',
    {
      target,
      familiarity,
      known: Object.entries(known.traits ?? {}).map(([trait, value]) => ({ kind: 'trait', trait, value })),
    },
    at,
  );
}
export function believe(
  p: Person,
  prop: string,
  value: boolean,
  confidence: number,
  sourceId: string,
  at: number,
) {
  send(
    p,
    'testimony.received',
    {
      teller: sourceId === 'self' ? p.id : sourceId,
      claims: [
        {
          prop,
          value,
          confidence,
          sourceId: sourceId === 'self' ? p.id : sourceId,
          evidenceId: `claim:${p.id}:${prop}:${at}`,
          provenance: [],
        },
      ],
    },
    at,
  );
}
export function confirm(p: Person, prop: string, value: boolean, at: number) {
  send(p, 'fact.confirmed', { prop, value, observationId: `observed:${p.id}:${prop}:${at}` }, at);
}
export function socialEvent(p: Person, event: Old.SocialEvent) {
  send(
    p,
    'social.received',
    { other: event.otherId, event: { kind: event.kind, byMe: event.byMe, magnitude: event.magnitude } },
    event.at,
  );
}
export function observeAct(
  p: Person,
  actor: string,
  act: Old.ObservedAct,
  table: Record<string, Partial<Traits>> = {},
) {
  send(
    p,
    'act.witnessed',
    {
      actor,
      act: {
        tags: act.tags ?? [],
        ...('toward' in act ? { toward: act.toward } : {}),
        ...('withId' in act ? { withId: act.withId } : {}),
      },
    },
    act.at,
  );
  for (const tag of act.tags ?? [])
    for (const [trait, value] of Object.entries(table[tag] ?? {}))
      hear(p, actor, `trait:${trait}`, value!, act.at, 0.5);
}
export function perceive(p: Person, percepts: Old.Percept[]) {
  for (const e of percepts)
    send(
      p,
      'observation.received',
      {
        percepts: [
          {
            id: `percept:${p.id}:${context(p).bridge?.host.serial ?? 0}:${e.kind}`,
            occurredAt: Math.round(e.at * MINUTE),
            channel: e.channel,
            kind: e.kind,
            actorId: e.actorId,
            targetId: e.targetId,
            salience: e.salience ?? 0.5,
            valence: e.valence ?? 0,
            summary: e.summary ?? '',
            claims: [],
            norms: [],
            advice: [],
            consequences: [],
            withdrawConsequences: [],
            witnesses: [],
            reports: [],
            provenance: [],
          },
        ],
      },
      e.at,
    );
}
export function tick(p: Person, until: number) {
  const c = context(p);
  if (!c.bridge) return;
  const through = Math.floor(until / 1440) + 1;
  if (through > c.careDay) {
    careCommands(c, until);
    c.careDay = through;
  }
  const target = Math.max(Math.round(until * MINUTE), c.bridge.host.at);
  c.scheduled.sort((a, b) => a.at - b.at || a.offer.id.localeCompare(b.offer.id));
  while (c.scheduled.length && c.scheduled[0]!.at <= target) {
    const scheduledAt = c.scheduled[0]!.at;
    const group: typeof c.scheduled = [];
    while (c.scheduled[0]?.at === scheduledAt) group.push(c.scheduled.shift()!);
    // Finish reached accepted activities before offering care at the same clock.
    const boundaryAt = Math.max(scheduledAt, c.bridge.host.at);
    if (boundaryAt > c.bridge.host.at) {
      serve(c.bridge, boundaryAt, [], c.offers, worldFor(c));
      refresh(c);
    }
    const ready: typeof group = [];
    const people = new Set<string>();
    for (const scheduled of group) {
      const active = c.bridge.host.active.find((a) => a.person === scheduled.offer.person);
      if (active) {
        // Meals and sleep are opportunities. They do not interrupt accepted work.
        c.scheduled.push({
          ...scheduled,
          at: Math.max(active.startedAt + active.offer.durationMs, c.bridge.host.at + 1),
        });
      } else if (people.has(scheduled.offer.person)) {
        c.scheduled.push({ ...scheduled, at: c.bridge.host.at + 1 });
      } else {
        people.add(scheduled.offer.person);
        ready.push(scheduled);
      }
    }
    c.scheduled.sort((a, b) => a.at - b.at || a.offer.id.localeCompare(b.offer.id));
    if (!ready.length) continue;
    const at = Math.max(scheduledAt, c.bridge.host.at + 1);
    const serial = c.bridge.host.serial;
    const commands: { kind: HF.Input['kind']; payload: HF.Input['payload'] }[] = [];
    for (const { offer } of ready) {
      c.offers.set(offer.person, [offer]);
      const revision = serial + commands.length + 1;
      commands.push(
        { kind: 'offers.received', payload: { person: offer.person, revision, offers: [offer] } },
        {
          kind: 'decision.requested',
          payload: {
            person: offer.person,
            reason: 'Scheduled Good Hands activity',
            treatment: 'ordinary',
            offerRevision: revision,
          },
        },
      );
    }
    sendBatch(c, at / MINUTE, commands);
    const closeSerial = c.bridge.host.serial;
    sendBatch(
      c,
      at / MINUTE,
      ready.map(({ offer }, index) => ({
        kind: 'offers.received',
        payload: { person: offer.person, revision: closeSerial + index + 1, offers: [] },
      })),
    );
    for (const { offer } of ready) c.offers.set(offer.person, []);
  }
  if (target > c.bridge.host.at) {
    serve(c.bridge, target, [], c.offers, worldFor(c));
    refresh(c);
  }
}

function toOffer(p: Person, a: Affordance): HF.Offer {
  return {
    id: a.id,
    person: p.id,
    actionId: a.action,
    label: a.label ?? a.action,
    durationMs: Math.round(a.duration * MINUTE),
    participants: [],
    alongside: [],
    demands: {
      effort: a.effort ?? 0,
      focus: 0,
      mode: a.mode ?? 'awake',
      requires: {},
      ...(a.skill ? { skill: { ...a.skill, domain: 'motor' } } : {}),
    },
    tags: a.tags ?? [],
    norms: a.norms ?? [],
    expected: { needs: a.advertises ?? {}, followedBy: [], provenance: ['authored:goodhands'] },
    fulfills: a.fulfills ?? [],
    advances: [],
    diminishes: [],
  };
}
function fromOffer(a: HF.Offer): Affordance {
  return {
    id: a.id,
    action: a.actionId,
    label: a.label,
    duration: a.durationMs / MINUTE,
    effort: a.demands.effort,
    advertises: a.expected.needs,
  };
}
export function decide(
  p: Person,
  offers: Affordance[],
  options?: Old.DecideOptions,
): ReturnType<typeof import('@adam0white/human-framework-legacy3').decide> {
  const c = context(p),
    mapped = offers.map((a) => toOffer(p, a)),
    revision = (c.bridge?.host.serial ?? 0) + 1;
  c.offers.set(p.id, [
    ...(c.offers.get(p.id) ?? []).filter((o) => !mapped.some((m) => m.id === o.id)),
    ...mapped,
  ]);
  const commands: { kind: HF.Input['kind']; payload: HF.Input['payload'] }[] = [
    { kind: 'offers.received', payload: { person: p.id, revision, offers: mapped } },
  ];
  if (options?.suggestion)
    commands.push({
      kind: 'suggestion.received',
      payload: {
        person: p.id,
        received: {
          kind: 'ordinary',
          suggestion: {
            ...options.suggestion,
            adviceId: `goodhands:advice:${p.id}:${revision}`,
            since: Math.round(p.now * MINUTE),
          },
        },
      },
    });
  commands.push({
    kind: 'decision.requested',
    payload: {
      person: p.id,
      reason: 'Good Hands opportunity',
      treatment: 'ordinary',
      offerRevision: revision,
    },
  });
  const result = sendBatch(c, p.now, commands)!;
  closeOffers(c, p.id, p.now);
  const decision = result.events.find((e) => e.person === p.id && e.data.kind === 'decision');
  if (!decision || decision.data.kind !== 'decision')
    throw new Error('HF did not record a Good Hands decision.');
  return decision.data.decision as unknown as ReturnType<
    typeof import('@adam0white/human-framework-legacy3').decide
  >;
}
export function begin(_p: Person, _a: Affordance, _d: unknown) {} // decision.requested and accepted start already own the activity
export function finish(p: Person, _outcome: unknown) {
  tick(p, p.now);
}
export function readPerson(p: Person) {
  return { body: part(context(p), p.id, 'body').readout };
}
export function successChance(p: Person, id: string, difficulty: number, _capacity: number) {
  return need(
    HF.inspect(context(p).bridge!.run, {
      perspective: { kind: 'host' },
      people: [p.id],
      select: [],
      skill: { person: p.id, skill: id, difficulty, support: 0 },
    }),
  ).skill!.successChance;
}
export function nextDutyId(p: Person) {
  const c = context(p);
  return `goodhands-duty:${p.id}:${c.authors.get(p.id)!.state.agenda.commitments.length}`;
}

function interruptActive(p: Person, minute: number, reason: string, actionId?: string) {
  const c = context(p);
  const active = c.bridge?.host.active.find(
    (a) => a.person === p.id && (!actionId || a.offer.actionId === actionId),
  );
  if (active)
    sendBatch(c, minute, [
      {
        kind: 'activity.interrupted',
        payload: { person: p.id, activityId: active.id, reason },
      },
    ]);
}
export function interruptPlacement(p: Person, minute: number) {
  interruptActive(p, minute, 'placement ended', 'placement-work');
}
export function interruptEndingActivity(p: Person, minute: number) {
  interruptActive(p, minute, 'agency chapter ended');
}

export function promise(
  p: Person,
  commitment: Parameters<typeof import('@adam0white/human-framework-legacy3').promise>[1],
) {
  const c = context(p);
  const d = {
    ...commitment,
    id: nextDutyId(p),
    from: Math.round(commitment.from * MINUTE),
    until: Math.round(commitment.until * MINUTE),
    ...(commitment.recurEvery ? { recurEveryMs: Math.round(commitment.recurEvery * MINUTE) } : {}),
  };
  delete (d as Record<string, unknown>).recurEvery;
  if (!c.bridge) {
    (c.authors.get(p.id)!.state.agenda.commitments as any[]).push(d);
    p.agenda.commitments.push({ ...commitment, id: d.id, status: 'pending' } as any);
  } else
    sendBatch(c, p.now, [
      { kind: 'agenda.requested', payload: { person: p.id, request: { type: 'commit', commitment: d } } },
    ]);
}
export function advanceAgenda(p: Person, until: number) {
  tick(p, until);
}

export function openingFor(state: object, id: string): HF.PersonAuthoring {
  const c = stateContexts.get(state) ?? constructing;
  const p = c?.authors.get(id);
  if (!p) throw new Error(`Unknown opening actor ${id}`);
  return structuredClone(p);
}
let conversationPair: { speaker: string; listener: string } | undefined;
let emitted: HF.DeepReadonly<Extract<HF.HostRequest, { kind: 'communication' }>>[] = [];
export function converse(
  speaker: Person,
  listener: Person,
  options: { at: number; placeId?: string; topics: string[]; maxClaims: number },
): ReturnType<typeof import('@adam0white/human-framework-legacy3').converse> {
  emitted = [];
  conversationPair = { speaker: speaker.id, listener: listener.id };
  try {
    sendBatch(context(speaker), options.at, [
      {
        kind: 'conversation.requested',
        payload: {
          speaker: speaker.id,
          listener: listener.id,
          topicIds: options.topics,
          maxClaims: options.maxClaims,
          temptations: [],
          loyalWarning: false,
        },
      },
    ]);
  } finally {
    conversationPair = undefined;
  }
  const claims = emitted.flatMap((r) =>
    r.items.flatMap((i) => (i.data.kind === 'claim' ? [i.data.told] : [])),
  );
  return {
    told: claims.length
      ? [
          {
            at: options.at,
            kind: 'speech',
            channel: 'told',
            actorId: speaker.id,
            targetId: listener.id,
            summary: 'They spoke.',
            salience: 0.6,
            claims,
          },
        ]
      : [],
    socialEvents: { speaker: [], listener: [] },
  } as unknown as ReturnType<typeof import('@adam0white/human-framework-legacy3').converse>;
}
/** An authored reaction to actual social evidence. HF owns trust updates. */
export function sourceResponse(
  p: Person,
  sourceId: string,
  kept: boolean,
  at: number,
  rule = 'goodhands-social-evidence',
) {
  send(
    p,
    'social.received',
    {
      other: sourceId,
      event: { kind: kept ? 'promise-kept' : 'promise-broken', byMe: false, magnitude: 0.5 },
      ...(!kept
        ? {
            sourceTrustResponse: {
              sourceId,
              multiplier: 0.75,
              basis: { author: 'goodhands', ruleId: rule, edition: EDITION },
            },
          }
        : {}),
    },
    at,
  );
  if (kept) confirm(p, `${sourceId}:reliable`, true, at);
}

function careCommands(c: Context, until: number): void {
  const through = Math.floor(until / 1440) + 1;
  for (const p of Object.values(c.people))
    for (let day = c.careDay; day < through; day++) {
      for (const [hour, action, duration] of [
        [7, 'eat', 20],
        [12, 'eat', 20],
        [19, 'eat', 20],
        [23, 'sleep', 480],
      ] as const) {
        const at = (day * 1440 + hour * 60) * MINUTE;
        if (at <= Math.max(510 * MINUTE, c.bridge!.host.at)) continue;
        const offer = toOffer(p, {
          id: `care:${p.id}:${day}:${hour}`,
          action,
          label: action === 'sleep' ? 'Sleep at home' : 'Eat a meal and drink water',
          duration,
          effort: 0,
          mode: action === 'sleep' ? 'sleep' : 'awake',
          advertises: action === 'sleep' ? { sleep: 0.8, rest: 0.4 } : { food: 0.6, water: 0.6 },
        });
        c.scheduled.push({ at, offer });
      }
    }
}

export function portableVocabularyFor(state: object) {
  const c = bound(state);
  const spec = specFor(c);
  return {
    actions: spec.definitions.actions.map((a) => a.id),
    sources: spec.definitions.sources.map((s) => s.id),
    entities: spec.world.facts.map((f) => f.subject),
  };
}

/** Schedule today's remaining placement hours through HF's routine protocol. */
export function schedulePlacement(p: Person, now: number, endHour: number, receipt: WorkReceipt = {}) {
  const c = context(p);
  const remaining = Math.max(0, endHour * 60 - (now % 1440));
  if (!remaining) return;
  const id = `placement:${p.id}:${Math.floor(now / 1440)}`;
  const offer = toOffer(p, {
    id,
    action: 'placement-work',
    label: 'Work at the household',
    duration: remaining,
    effort: 0.45,
    advertises: receipt.psychological ?? {},
    ...(receipt.skill ? { skill: { id: receipt.skill, difficulty: 0.45 } } : {}),
  });
  // Same-minute ingress phases must not extend the agreed household shift.
  const startsAt = Math.max(Math.round(now * MINUTE), c.bridge!.host.at + 1);
  offer.durationMs = Math.round((Math.floor(now / 1440) * 1440 + endHour * 60) * MINUTE) - startsAt;
  if (offer.durationMs <= 0) return false;
  c.work.set(id, structuredClone(receipt));
  c.offers.set(p.id, [offer]);
  const revision = c.bridge!.host.serial + 1;
  sendBatch(c, now, [
    { kind: 'offers.received', payload: { person: p.id, revision, offers: [offer] } },
    {
      kind: 'decision.requested',
      payload: {
        person: p.id,
        reason: 'Scheduled Good Hands placement',
        treatment: 'ordinary',
        offerRevision: revision,
      },
    },
  ]);
  closeOffers(c, p.id, now);
  return c.bridge!.host.active.some((a) => a.person === p.id && a.offer.id === id);
}
