import { boundedPersonaJson, canonicalPersona, validatePersona } from '@adam0white/lab-client';
import { exportGuest, prepareGuest } from '../sim/guests.ts';
import { fingerprint, replay, view } from '../sim/index.ts';
import { type Input, type LoggedInput, QUALITIES, type State } from '../sim/types.ts';
import { type ContinuityBook, castIds, emptyContinuity, type OneCastRow } from './continuity.ts';

export interface RunExport {
  game: 'goodhands';
  version: 1;
  simulation?: 1 | 2 | 3 | 4 | 5;
  continuity?: ContinuityBook;
  oneCast?: OneCastRow[];
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  state: State;
  fingerprint: string;
}
export type CompactRunExport = Omit<RunExport, 'state'>;

export function exportRun(state: State, inputs: LoggedInput[], continuity?: ContinuityBook): RunExport {
  const visible = view(state);
  return {
    game: 'goodhands',
    version: 1,
    ...(state.version === 5 ? { oneCast: structuredClone(continuity?.rows ?? []) } : {}),
    ...(continuity && (continuity.arrivals.length || continuity.heads.length)
      ? { continuity: structuredClone(continuity), oneCast: structuredClone(continuity.rows) }
      : {}),
    ...(state.version !== 1 ? { simulation: state.version } : {}),
    seed: visible.seed,
    minute: visible.now,
    inputs: structuredClone(inputs),
    state: structuredClone(state),
    fingerprint: fingerprint(state),
  };
}
export function compactRun(run: RunExport): CompactRunExport {
  const { game, version, simulation, seed, minute, inputs, fingerprint, continuity, oneCast } = run;
  return {
    game,
    version,
    ...(oneCast ? { oneCast: structuredClone(oneCast) } : {}),
    ...(continuity ? { continuity: structuredClone(continuity) } : {}),
    ...(simulation ? { simulation } : {}),
    seed,
    minute,
    inputs: structuredClone(inputs),
    fingerprint,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function word(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}
function validInput(value: unknown): value is Input {
  if (!record(value)) return false;
  const fields: Record<string, string[]> = {
    speed: ['speed'],
    interview: ['candidate'],
    'call-in': ['candidate'],
    'call-household': ['family', 'member', 'topic'],
    'propose-terms': ['scene', 'terms'],
    'take-number': ['candidate'],
    'call-reference': ['candidate', 'referee'],
    trial: ['candidate', 'family'],
    place: ['candidate', 'family', 'vouch'],
    'check-in': ['placement', 'how'],
    withdraw: ['placement'],
    choose: ['scene', 'choice'],
    'close-scene': ['scene'],
    'answer-phone': [],
    'wait-for': [],
    sleep: [],
    'guest-action': ['guest', 'action'],
  };
  if (typeof value.type !== 'string' || !Object.hasOwn(fields, value.type)) return false;
  const required = fields[value.type];
  if (!required) return false;
  if (
    Object.keys(value).length !== required.length + 1 ||
    !required.every((key) => Object.hasOwn(value, key))
  )
    return false;
  for (const key of required) {
    if (value.type === 'guest-action' && key === 'guest') {
      if (!['zeynep-pass', 'selin-voice'].includes(value[key] as string)) return false;
    } else if (value.type === 'guest-action' && key === 'action') {
      if (!['offer-trial', 'decline', 'ask-service', 'end-enquiry'].includes(value[key] as string))
        return false;
    } else if (key === 'speed') {
      if (![0, 1, 2, 3].includes(value[key] as number)) return false;
    } else if (key === 'how') {
      if (!['phone', 'visit', 'drop-by'].includes(value[key] as string)) return false;
    } else if (key === 'topic') {
      if (!['progress', 'complaint', 'smooth', 'worker'].includes(value[key] as string)) return false;
    } else if (key === 'terms') {
      const terms = value[key];
      const keys = ['wage', 'startHour', 'endHour', 'dayOff', 'trialDays', 'fee'];
      if (
        !record(terms) ||
        Object.keys(terms).length !== keys.length ||
        !keys.every((key) => typeof terms[key] === 'number' && Number.isFinite(terms[key]))
      )
        return false;
      const { wage, startHour, endHour, dayOff, trialDays, fee } = terms as Record<string, number>;
      if (
        !(
          wage! > 0 &&
          wage! <= 1e6 &&
          startHour! >= 0 &&
          startHour! < 24 &&
          endHour! > startHour! &&
          endHour! <= 24 &&
          Number.isInteger(dayOff) &&
          dayOff! >= 0 &&
          dayOff! <= 6 &&
          Number.isInteger(trialDays) &&
          trialDays! >= 1 &&
          trialDays! <= 14 &&
          fee! >= 0 &&
          fee! <= 1e6
        )
      )
        return false;
    } else if (key === 'vouch') {
      const qualities = value[key];
      if (
        !Array.isArray(qualities) ||
        qualities.length > QUALITIES.length ||
        new Set(qualities).size !== qualities.length ||
        !qualities.every((q) => QUALITIES.includes(q))
      )
        return false;
    } else if (!word(value[key])) return false;
  }
  return true;
}
function clock(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 510 && value <= 28 * 1440;
}

export function verifyImport(text: string): {
  state: State;
  inputs: LoggedInput[];
  continuity: ContinuityBook;
} {
  if (text.length > 30_000_000) throw new Error('This run is too large.');
  const data: unknown = JSON.parse(text);
  if (!record(data) || data.game !== 'goodhands' || data.version !== 1)
    throw new Error('This is not a Good Hands run.');
  if (
    !Number.isSafeInteger(data.seed) ||
    !clock(data.minute) ||
    !Array.isArray(data.inputs) ||
    !word(data.fingerprint)
  )
    throw new Error('The run is incomplete.');
  if (data.inputs.length > 20000) throw new Error('The run has too many inputs.');
  let previous = 510;
  for (const entry of data.inputs) {
    if (
      !record(entry) ||
      Object.keys(entry).length !== 2 ||
      !clock(entry.at) ||
      entry.at < previous ||
      entry.at > data.minute ||
      !validInput(entry.input)
    )
      throw new Error('Invalid input history.');
    previous = entry.at;
  }
  const inputs = structuredClone(data.inputs) as LoggedInput[];
  const simulation = data.simulation ?? 1;
  if (simulation !== 1 && simulation !== 2 && simulation !== 3 && simulation !== 4 && simulation !== 5)
    throw new Error('Unsupported simulation version.');
  const continuity = readContinuity(data.continuity, data.oneCast);
  if (simulation !== 5 && (continuity.arrivals.length || continuity.heads.length))
    throw new Error('Legacy runs cannot admit a guest.');
  if (simulation !== 5 && inputs.some((e) => e.input.type === 'guest-action'))
    throw new Error('Legacy editions have no guest actions.');
  const state = replay(
    data.seed as number,
    inputs,
    data.minute,
    simulation,
    continuity.arrivals.map((a) => a.initial),
  );
  const visible = view(state);
  if (visible.now !== data.minute || visible.seed !== data.seed)
    throw new Error('The run clock or seed did not match the replay.');
  if (fingerprint(state) !== data.fingerprint)
    throw new Error('Replay did not match this run. Your current office is unchanged.');
  if (Object.hasOwn(data, 'state')) {
    if (!record(data.state) || fingerprint(data.state as State) !== data.fingerprint)
      throw new Error('The saved state did not match this run.');
    // Compare all JSON content too: a fingerprint may omit derived or unobserved fields.
    if (canonical(data.state) !== canonical(state))
      throw new Error('The saved state did not match the replay.');
  }
  return { state, inputs, continuity };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value))
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function readContinuity(value: unknown, rows: unknown): ContinuityBook {
  if (value === undefined) {
    if (rows !== undefined && (!Array.isArray(rows) || rows.length))
      throw new Error('Missing pinned continuity.');
    return emptyContinuity();
  }
  boundedPersonaJson(value);
  if (
    !record(value) ||
    value.v !== 1 ||
    !Array.isArray(value.arrivals) ||
    value.arrivals.length > 2 ||
    !Array.isArray(value.heads) ||
    value.heads.length > 2 ||
    !Array.isArray(value.rows) ||
    value.rows.length > 256 ||
    canonicalPersona(rows) !== canonicalPersona(value.rows)
  )
    throw new Error('Invalid pinned continuity.');
  if (value.fileUnlinked !== undefined && typeof value.fileUnlinked !== 'boolean')
    throw new Error('Invalid file recording state.');
  const book = value as unknown as ContinuityBook;
  for (const arrival of book.arrivals) {
    if (
      !record(arrival) ||
      !record(arrival.source) ||
      !record(arrival.claim) ||
      !record(arrival.initial) ||
      !['shared', 'local', 'file'].includes(arrival.scope) ||
      !castIds.includes(arrival.source.castId as (typeof castIds)[number])
    )
      throw new Error('Invalid pinned arrival.');
    if (
      arrival.claim.parentRevision !== arrival.source.revision ||
      arrival.claim.castId !== arrival.source.castId ||
      arrival.claim.branchId !== arrival.source.branchId
    )
      throw new Error('Invalid admission claim parent.');
  }
  for (const head of book.heads)
    if (!record(head) || !castIds.includes(head.castId as (typeof castIds)[number]))
      throw new Error('Invalid pinned head.');
  if (
    new Set(book.heads.map((p) => p.castId)).size !== book.heads.length ||
    new Set(book.arrivals.map((p) => p.source.castId)).size !== book.arrivals.length
  )
    throw new Error('Repeated pinned person.');
  for (const row of book.rows) {
    if (
      !record(row) ||
      row.v !== 1 ||
      !['zeynep', 'selin'].includes(row.probe) ||
      !['fresh', 'biography', 'continuing'].includes(row.arm) ||
      !['shared', 'local', 'file'].includes(row.scope) ||
      !castIds.includes(row.castId as (typeof castIds)[number]) ||
      !/^[a-f0-9]{64}$/.test(row.revision) ||
      (row.parentRevision !== null && !/^[a-f0-9]{64}$/.test(row.parentRevision)) ||
      ![row.stage, row.outcome, row.branchId].every(
        (s) => typeof s === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(s),
      )
    )
      throw new Error('Invalid one-cast evidence.');
  }
  return structuredClone(book);
}
/** Run only after deterministic replay validation, before restoring a pinned head or attaching uploads. */
export async function validateContinuity(
  book: ContinuityBook,
  savedState?: State,
  inputs: LoggedInput[] = [],
): Promise<void> {
  for (const arrival of book.arrivals) {
    await validatePersona(arrival.source);
    await validatePersona(arrival.claim);
    if (
      arrival.claim.source.game !== 'goodhands' ||
      arrival.claim.source.rules !== 'goodhands-5' ||
      arrival.claim.parentRevision !== arrival.source.revision ||
      arrival.claim.branchId !== arrival.source.branchId ||
      !book.heads.some((h) => h.castId === arrival.source.castId)
    )
      throw new Error('Invalid pinned admission head.');
    const prepared = await prepareGuest(arrival.source);
    if (canonicalPersona(prepared) !== canonicalPersona(arrival.initial))
      throw new Error('Pinned initial person does not match the source admission.');
  }
  for (const head of book.heads) {
    await validatePersona(head);
    const arrival = book.arrivals.find((a) => a.source.castId === head.castId);
    if (!arrival) throw new Error('Pinned head has no admitted arrival.');
    if (head.revision === arrival.claim.revision) {
      if (canonicalPersona(head) !== canonicalPersona(arrival.claim))
        throw new Error('Pinned claim changed.');
      continue;
    }
    const row = book.rows.find(
      (r) =>
        r.revision === head.revision &&
        r.castId === head.castId &&
        r.branchId === head.branchId &&
        r.stage === 'checkpoint' &&
        r.parentRevision === head.parentRevision,
    );
    if (!row || head.source.game !== 'goodhands' || head.source.rules !== 'goodhands-5')
      throw new Error('Pinned head has no accepted target checkpoint.');
    let cursor: string | null = head.revision;
    const visited = new Set<string>();
    while (cursor !== arrival.claim.revision) {
      if (!cursor || visited.has(cursor)) throw new Error('Pinned head has no claim lineage.');
      visited.add(cursor);
      const ancestor = book.rows.find((r) => r.revision === cursor && r.castId === head.castId);
      if (!ancestor) throw new Error('Pinned head has incomplete claim lineage.');
      cursor = ancestor.parentRevision;
      if (cursor === null && ancestor.stage === 'checkpoint') {
        const forkOf = (head.transfer.admission as Record<string, unknown> | undefined)?.forkOf;
        if (typeof forkOf === 'string' && !visited.has(forkOf)) {
          cursor = forkOf;
        }
      }
    }
    const checkpoint = head.transfer.checkpoint as Record<string, unknown> | undefined;
    if (
      !savedState ||
      !checkpoint ||
      typeof checkpoint.sourceNow !== 'number' ||
      checkpoint.sourceNow > view(savedState).now
    )
      throw new Error('Pinned head needs its validated source replay.');
    const at = checkpoint.sourceNow;
    const source = replay(
      view(savedState).seed,
      inputs.filter((entry) => entry.at <= at),
      at,
      5,
      book.arrivals.map((a) => a.initial),
    );
    const projected = await exportGuest(source, arrival.initial.id);
    if (
      canonicalPersona(head.transfer.person) !== canonicalPersona(projected.projection) ||
      canonicalPersona(head.transfer.history) !== canonicalPersona(projected.history) ||
      canonicalPersona(checkpoint) !== canonicalPersona(projected.checkpoint)
    )
      throw new Error('Pinned head does not match the source checkpoint.');
  }
}
