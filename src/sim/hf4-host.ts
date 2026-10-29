/** Good Hands' candidate run boundary. The game still owns each actual world outcome. */
import {
  type ActionResolution,
  type CommunicationResolution,
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun,
  type HostRequest,
  type Input,
  inspect,
  type Offer,
  type PersonAuthoring,
  preview,
  type Run,
  type RunArchive,
  type RunSpec,
  replay,
  restoreRun,
  type StepResult,
  step,
} from '@adam0white/human-framework';

export const MINUTE = 60_000;
export const EDITION = 'goodhands-hf4/2';
// The current chapter is a month with84 actors. HF keeps every input and action
// boundary; its daily policy supplies the numerical resolution for long spans.
export const FIDELITY = { mode: 'daily', dayMs: 86400000, anchor: 0 } as const;
export function need<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; path: string; message: string } },
): T {
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  return result.value;
}
export type Active = { id: string; person: string; offerRevision: number; offer: Offer; startedAt: number };
export interface HostState {
  revision: number;
  serial: number;
  /** Last admitted input time. Same-minute operations use an explicit, saved ingress phase. */
  at: number;
  active: Active[];
  completed: {
    offerId: string;
    offerRevision: number;
    person: string;
    actionId: string;
    start: number;
    end: number;
    status: string;
  }[];
}
/** Select admitted work, never a scheduled promise, for a household account. */
export function workForAccount(
  host: HostState,
  person: string,
  now: number,
  since: number,
  lastReportedStart?: number,
): { start: number } | undefined {
  const today = Math.floor(now / (1440 * MINUTE));
  const starts = [
    ...host.active
      .filter(
        (a) =>
          a.person === person &&
          a.offer.actionId === 'placement-work' &&
          a.startedAt <= now &&
          Math.floor(a.startedAt / (1440 * MINUTE)) === today,
      )
      .map((a) => a.startedAt),
    ...host.completed
      .filter(
        (a) =>
          a.person === person && a.actionId === 'placement-work' && a.status === 'completed' && a.end <= now,
      )
      .map((a) => a.start),
  ]
    .filter((start) => start >= since && start > (lastReportedStart ?? -1))
    .sort((a, b) => b - a);
  return starts.length ? { start: starts[0]! } : undefined;
}
export interface Checkpoint {
  version: typeof EDITION;
  host: HostState;
  run: DeepReadonly<RunArchive>;
}
export interface Bridge {
  run: Run;
  host: HostState;
}
export type ActionOutcome = {
  disposition: 'completed' | 'failed' | 'interrupted';
  summary: string;
  actual: NonNullable<ActionResolution['outcome']>['actual'];
};
export interface World {
  canStart(person: string, offer: DeepReadonly<Offer>, at: number): boolean;
  finish(active: Active, at: number, interrupt: boolean): ActionOutcome;
  /** A request is emission. The host supplies actual co-location/attention receipts. */
  communicate(
    request: DeepReadonly<Extract<HostRequest, { kind: 'communication' }>>,
    at: number,
  ): Pick<CommunicationResolution, 'emittedItemIds' | 'received'>;
}
const source = { type: 'host', id: 'goodhands' } as const;
/** Bounded duplicate binding only. Gameplay keeps its full current host index. */
export function hostHead(revision: number) {
  return { schema: EDITION, revision };
}
function jsonHost(host: HostState) {
  return hostHead(host.revision);
}

type BookingReceipt =
  | { kind: 'start'; id: string; person: string; at: number; offerRevision: number; offer: Offer }
  | { kind: 'finish'; id: string; person: string; at: number; status: ActionOutcome['disposition'] };
/** The same host accounting owns live receipts and cold reconstruction. */
function reduceBooking(host: HostState, receipt: BookingReceipt): Active {
  let active: Active;
  if (receipt.kind === 'start') {
    if (host.active.some((a) => a.person === receipt.person || a.id === receipt.id))
      throw new Error('Duplicate accepted Good Hands activity.');
    active = {
      id: receipt.id,
      person: receipt.person,
      offerRevision: receipt.offerRevision,
      offer: structuredClone(receipt.offer),
      startedAt: receipt.at,
    };
    host.active.push(active);
  } else {
    const index = host.active.findIndex((a) => a.id === receipt.id && a.person === receipt.person);
    const found = host.active[index];
    if (!found) throw new Error('Good Hands has no accepted activity for this receipt.');
    active = found;
    host.active.splice(index, 1);
    host.completed = host.completed.filter(
      (a) =>
        a.person !== active.person || a.actionId !== active.offer.actionId || a.status !== receipt.status,
    );
    host.completed.push({
      offerId: active.offer.id,
      offerRevision: active.offerRevision,
      person: active.person,
      actionId: active.offer.actionId,
      start: active.startedAt,
      end: receipt.at,
      status: receipt.status,
    });
  }
  host.revision++;
  return active;
}
function stable(value: unknown): string {
  return Array.isArray(value)
    ? `[${value.map(stable).join(',')}]`
    : value !== null && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : (JSON.stringify(value) ?? 'null');
}
function checkHead(value: unknown, revision: number) {
  if (stable(value) !== stable(hostHead(revision)))
    throw new Error('The saved Good Hands world head differs from its public receipts.');
}
/** Complete public inputs and requests survive format5 journal clipping. */
function reconstructHost(archive: DeepReadonly<RunArchive>): HostState {
  const host: HostState = {
    revision: archive.initial.spec.world.revision,
    serial: 0,
    at: archive.current.at,
    active: [],
    completed: [],
  };
  checkHead(archive.initial.spec.world.hostState, host.revision);
  const books = new Map<string, readonly Offer[]>(),
    requests = new Map<string, DeepReadonly<HostRequest>>();
  for (const transaction of archive.history) {
    for (const entry of transaction.inputs) {
      const ordinal = /^goodhands:(\d+)$/.exec(entry.id);
      if (ordinal) host.serial = Math.max(host.serial, Number(ordinal[1]));
      if (entry.kind === 'offers.received')
        books.set(entry.payload.person, structuredClone(entry.payload.offers) as Offer[]);
      if (entry.kind === 'action.resolved') {
        const receipt = entry.payload,
          request = requests.get(receipt.requestId);
        if (
          !request ||
          request.kind !== 'action' ||
          request.person !== receipt.person ||
          request.activityId !== receipt.activityId ||
          request.stage !== receipt.stage
        )
          throw new Error('A Good Hands receipt lacks its public action request.');
        if (receipt.stage === 'start' && receipt.disposition === 'accepted') {
          const offer = books.get(receipt.person)?.find((o) => o.id === request.offerId);
          if (!offer) throw new Error('An accepted Good Hands activity lacks its public offer.');
          reduceBooking(host, {
            kind: 'start',
            id: receipt.activityId,
            person: receipt.person,
            at: entry.at,
            offerRevision: request.offerRevision,
            offer,
          });
        } else if (receipt.stage !== 'start') {
          if (!['completed', 'failed', 'interrupted'].includes(receipt.disposition) || !receipt.outcome)
            throw new Error('A Good Hands completion lacks its actual public outcome.');
          const active = reduceBooking(host, {
            kind: 'finish',
            id: receipt.activityId,
            person: receipt.person,
            at: entry.at,
            status: receipt.disposition as ActionOutcome['disposition'],
          });
          const outcome = receipt.outcome;
          if (
            outcome.offerId !== active.offer.id ||
            outcome.actionId !== active.offer.actionId ||
            outcome.start !== active.startedAt ||
            outcome.end !== entry.at ||
            outcome.status !== receipt.disposition
          )
            throw new Error('A Good Hands outcome differs from its accepted public activity.');
        }
        if (receipt.worldChange) checkHead(receipt.worldChange.hostState, host.revision);
      } else if (entry.kind === 'world.changed') {
        host.revision = entry.payload.revision;
        checkHead(entry.payload.hostState, host.revision);
      }
    }
    if (transaction.boundary.type === 'world-required')
      for (const request of transaction.boundary.requests) requests.set(request.id, request);
  }
  checkHead(archive.current.world.hostState, host.revision);
  return host;
}

export function opening(spec: RunSpec, people: readonly PersonAuthoring[]): Bridge {
  if (spec.host.id !== source.id || spec.host.edition !== EDITION || spec.host.schema !== EDITION)
    throw new Error('Good Hands requires its current host schema.');
  const host: HostState = {
    revision: spec.world.revision,
    serial: 0,
    at: spec.start,
    active: [],
    completed: [],
  };
  const run = need(createRun({ ...spec, world: { ...spec.world, hostState: jsonHost(host) } }));
  for (const person of people) need(createPerson(run, person));
  return { run, host };
}

/** Inputs at one displayed minute remain ordered and never reopen a closed HF timestamp. */
export function input<K extends Input['kind']>(
  bridge: Bridge,
  minute: number,
  kind: K,
  payload: Input<K>['payload'],
): Input<K> {
  const floor = minute * MINUTE;
  if (!Number.isSafeInteger(floor) || floor < 0) throw new Error('Invalid Good Hands minute.');
  const at = Math.max(floor, bridge.host.at + 1);
  if (at >= floor + MINUTE) throw new Error('Good Hands exhausted its minute ingress phases.');
  return { id: `goodhands:${bridge.host.serial + 1}`, at, source, kind, payload } as Input<K>;
}

/** Build one complete same-time host batch before closing its timestamp. */
export function inputs(
  bridge: Bridge,
  minute: number,
  commands: readonly { kind: Input['kind']; payload: Input['payload'] }[],
): Input[] {
  const first = input(
    bridge,
    minute,
    commands[0]?.kind ?? 'world.changed',
    commands[0]?.payload ?? {
      expectedRevision: bridge.host.revision,
      revision: bridge.host.revision + 1,
      put: [],
      remove: [],
      hostState: {},
    },
  );
  return commands.map(
    (command, index) =>
      ({
        ...first,
        id: `goodhands:${bridge.host.serial + index + 1}`,
        kind: command.kind,
        payload: command.payload,
      }) as Input,
  );
}

function settle(
  host: HostState,
  request: DeepReadonly<HostRequest>,
  offers: ReadonlyMap<string, readonly Offer[]>,
  world: World,
): Input<'action.resolved' | 'communication.resolved'> {
  const frame = { id: `goodhands:receipt:${request.id}`, at: request.boundaryAt, source };
  if (request.kind === 'communication')
    return {
      ...frame,
      kind: 'communication.resolved',
      payload: {
        requestId: request.id,
        requestHash: request.requestHash,
        worldRevision: host.revision,
        speaker: request.speaker,
        ...world.communicate(request, request.boundaryAt),
      },
    };
  const base = {
    requestId: request.id,
    requestHash: request.requestHash,
    worldRevision: host.revision,
    person: request.person,
    activityId: request.activityId,
    stage: request.stage,
  };
  let resolution: ActionResolution;
  if (request.stage === 'start') {
    const offer = offers.get(request.person)?.find((o) => o.id === request.offerId);
    if (
      !offer ||
      host.completed.some(
        (a) =>
          a.person === request.person && a.offerId === offer.id && a.offerRevision === request.offerRevision,
      ) ||
      host.active.some((active) => active.person === request.person) ||
      !world.canStart(request.person, offer, request.boundaryAt)
    )
      resolution = { ...base, disposition: 'rejected', observations: [] };
    else {
      const prior = host.revision;
      reduceBooking(host, {
        kind: 'start',
        id: request.activityId,
        person: request.person,
        at: request.boundaryAt,
        offerRevision: request.offerRevision,
        offer,
      });
      resolution = {
        ...base,
        disposition: 'accepted',
        observations: [],
        worldChange: {
          expectedRevision: prior,
          revision: host.revision,
          put: [],
          remove: [],
          hostState: jsonHost(host),
        },
      };
    }
  } else {
    const index = host.active.findIndex((a) => a.id === request.activityId && a.person === request.person);
    const active = host.active[index];
    if (!active) throw new Error('Good Hands has no accepted activity for this settlement.');
    const result = world.finish(structuredClone(active), request.boundaryAt, request.stage === 'interrupt');
    if (request.stage === 'interrupt' && result.disposition !== 'interrupted')
      throw new Error('An interruption cannot complete a task.');
    const prior = host.revision;
    reduceBooking(host, {
      kind: 'finish',
      id: active.id,
      person: active.person,
      at: request.boundaryAt,
      status: result.disposition,
    });
    resolution = {
      ...base,
      disposition: result.disposition,
      observations: [],
      outcome: {
        activityId: active.id,
        offerId: active.offer.id,
        actionId: active.offer.actionId,
        start: active.startedAt,
        end: request.boundaryAt,
        status: result.disposition,
        evidenceId: `goodhands:outcome:${request.id}`,
        summary: result.summary,
        actual: result.actual,
        fulfills: result.disposition === 'completed' ? structuredClone(active.offer.fulfills) : [],
        advances: result.disposition === 'completed' ? structuredClone(active.offer.advances) : [],
      },
      worldChange: {
        expectedRevision: prior,
        revision: host.revision,
        put: [],
        remove: [],
        hostState: jsonHost(host),
      },
    };
  }
  return { ...frame, kind: 'action.resolved', payload: resolution };
}

/** Publish staged world changes only after HF admits the entire receipt batch. */
export function advance(
  bridge: Bridge,
  until: number,
  inputs: readonly Input[],
  offers: ReadonlyMap<string, readonly Offer[]>,
  world: World,
): DeepReadonly<StepResult> {
  let batch = inputs,
    candidate: HostState | undefined;
  const events: DeepReadonly<StepResult>['events'][number][] = [];
  for (let count = 0; count < 10_000; count++) {
    const result = need(step(bridge.run, { until, fidelity: FIDELITY, inputs: batch }));
    events.push(...result.events);
    if (candidate) bridge.host = candidate;
    for (const admitted of batch) {
      const ordinal = /^goodhands:(\d+)$/.exec(admitted.id);
      if (ordinal) bridge.host.serial = Math.max(bridge.host.serial, Number(ordinal[1]));
    }
    bridge.host.at = result.at;
    if (result.boundary.type === 'until') {
      if (!result.reachedUntil || result.at !== until)
        throw new Error('Good Hands did not reach its target.');
      return { ...result, events };
    }
    if (!result.boundary.requests.length) throw new Error('Good Hands received an empty world boundary.');
    candidate = structuredClone(bridge.host);
    batch = [...result.boundary.requests]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((r) => settle(candidate!, r, offers, world));
  }
  throw new Error('Good Hands exceeded its settlement budget.');
}

export function save(bridge: Bridge): Checkpoint {
  return { version: EDITION, host: structuredClone(bridge.host), run: exportRun(bridge.run) };
}
function decodeHost(value: unknown): HostState {
  if (!value || typeof value !== 'object') throw new Error('Missing Good Hands host state.');
  const h = value as HostState;
  if (
    Object.keys(h).sort().join(',') !== 'active,at,completed,revision,serial' ||
    !Number.isSafeInteger(h.revision) ||
    h.revision < 0 ||
    !Number.isSafeInteger(h.serial) ||
    h.serial < 0 ||
    !Number.isSafeInteger(h.at) ||
    !Array.isArray(h.active) ||
    !Array.isArray(h.completed)
  )
    throw new Error('Invalid Good Hands host state.');
  for (const a of h.active)
    if (
      !a ||
      typeof a.id !== 'string' ||
      typeof a.person !== 'string' ||
      !Number.isSafeInteger(a.offerRevision) ||
      !Number.isSafeInteger(a.startedAt) ||
      !a.offer ||
      a.offer.person !== a.person ||
      typeof a.offer.id !== 'string' ||
      typeof a.offer.actionId !== 'string'
    )
      throw new Error('Invalid Good Hands activity.');
  for (const a of h.completed)
    if (
      !a ||
      typeof a.person !== 'string' ||
      typeof a.offerId !== 'string' ||
      !Number.isSafeInteger(a.offerRevision) ||
      typeof a.actionId !== 'string' ||
      !Number.isSafeInteger(a.start) ||
      !Number.isSafeInteger(a.end) ||
      a.end < a.start ||
      !['completed', 'failed', 'interrupted'].includes(a.status)
    )
      throw new Error('Invalid Good Hands outcome.');
  return structuredClone(h);
}
export function restore(checkpoint: Checkpoint): Bridge {
  if (
    checkpoint.version !== EDITION ||
    checkpoint.run.host.id !== 'goodhands' ||
    checkpoint.run.host.edition !== EDITION ||
    checkpoint.run.host.schema !== EDITION
  )
    throw new Error('This file uses an older Good Hands version. Keep the file and start a new game.');
  const host = decodeHost(checkpoint.host);
  if (host.at !== checkpoint.run.current.at || host.revision !== checkpoint.run.current.world.revision)
    throw new Error('The Good Hands and HF clocks or world revisions differ.');
  const run = need(restoreRun(checkpoint.run));
  const rebuilt = reconstructHost(checkpoint.run);
  if (stable(host) !== stable(rebuilt))
    throw new Error('The saved Good Hands booking index differs from its public receipts.');
  return { run, host };
}
export function verify(checkpoint: Checkpoint) {
  const result = need(replay(checkpoint.run));
  if (!result.verified || result.fullHash !== checkpoint.run.hashes.full)
    throw new Error('The HF archive did not replay.');
  return result;
}
export const operations = { createRun, createPerson, step, inspect, preview, exportRun, restoreRun, replay };
