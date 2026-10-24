import type { CalendarPersonaSnapshot, PersonaProjectionSnapshot } from '@adam0white/human-framework';
import {
  boundedPersonaJson,
  canonicalPersona,
  type PersonaEnvelope,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST, CAST_EDITION } from '../sim/cast.ts';
import { type AgencyChapter, validateAgencyChapter } from '../sim/cast-chapter.ts';
import { exportGuest, type GuestId, prepareGuest } from '../sim/guests.ts';
import { fingerprint, replay, view } from '../sim/index.ts';
import { type Input, type LoggedInput, QUALITIES, type State } from '../sim/types.ts';
import { type ContinuityBook, castIds, emptyContinuity, type OneCastRow } from './continuity.ts';

export interface RunExport {
  game: 'goodhands';
  version: 1;
  castEdition?: string;
  framework?: string;
  chapter?: AgencyChapter;
  simulation?: 1 | 2 | 3 | 4 | 5 | 6;
  continuity?: ContinuityBook;
  oneCast?: OneCastRow[];
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  state: State;
  fingerprint: string;
}
export type CompactRunExport = Omit<RunExport, 'state'>;

function projectionBody(projection: PersonaProjectionSnapshot | CalendarPersonaSnapshot) {
  return projection.format === 'hf-persona-calendar/1' ? projection.person : projection;
}
function calendarTransfer(projected: {
  projection: PersonaProjectionSnapshot | CalendarPersonaSnapshot;
  targetOpening?: number;
  calendarHost?: unknown;
  sourceRevision?: string;
  sourceCheckpointDigest?: string;
}) {
  if (projected.projection.format !== 'hf-persona-calendar/1') return {};
  if (
    !Number.isInteger(projected.targetOpening) ||
    !projected.calendarHost ||
    !projected.sourceRevision ||
    !projected.sourceCheckpointDigest
  )
    throw new Error('Calendar return needs its pinned host clock.');
  return {
    targetOpening: projected.targetOpening,
    calendarHost: projected.calendarHost,
    sourceRevision: projected.sourceRevision,
    sourceCheckpointDigest: projected.sourceCheckpointDigest,
  };
}
/** The same pinned wire is constructed for publication and deterministic load validation. */
export async function guestCheckpointTransfer(state: State, id: GuestId, origin: PersonaEnvelope) {
  const projected = await exportGuest(state, id);
  const body = projectionBody(projected.projection);
  const checkpoint = origin.transfer.checkpoint as { checkpointDigest?: string } | undefined;
  if (!checkpoint?.checkpointDigest) throw new Error('Original source checkpoint is missing.');
  const calendar = calendarTransfer(projected);
  if (
    'sourceRevision' in calendar &&
    (calendar.sourceRevision !== origin.revision ||
      calendar.sourceCheckpointDigest !== checkpoint.checkpointDigest)
  )
    throw new Error('Calendar return changed the original source binding.');
  return {
    person: projected.projection,
    history: projected.history,
    checkpoint: projected.checkpoint,
    ...calendar,
    admission: {
      adapter: 'goodhands/1',
      sourceRevision: origin.revision,
      sourceCheckpointDigest: checkpoint.checkpointDigest,
      mapping: body.mappingVersion,
      opening: body.source.now,
    },
  };
}

export function exportRun(state: State, inputs: LoggedInput[], continuity?: ContinuityBook): RunExport {
  const visible = view(state);
  return {
    game: 'goodhands',
    version: 1,
    ...(state.version === 6 ? { framework: '2.18.0' } : {}),
    ...(state.castChapter ? { chapter: structuredClone(state.castChapter as AgencyChapter) } : {}),
    ...(state.version === 6 ? { castEdition: CAST_EDITION } : {}),
    ...(state.version === 6 ? { oneCast: structuredClone(continuity?.rows ?? []) } : {}),
    ...(continuity && (continuity.arrivals.length || continuity.heads.length || continuity.chapter)
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
  const { game, version, simulation, seed, minute, inputs, fingerprint, continuity, oneCast, castEdition } =
    run;
  return {
    game,
    version,
    ...(oneCast ? { oneCast: structuredClone(oneCast) } : {}),
    ...(continuity ? { continuity: structuredClone(continuity) } : {}),
    ...(simulation ? { simulation } : {}),
    ...(castEdition ? { castEdition } : {}),
    ...(run.framework ? { framework: run.framework } : {}),
    ...(run.chapter ? { chapter: structuredClone(run.chapter) } : {}),
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
    'pause-cast': [],
    'resume-cast': [],
    'cast-talk': ['person', 'choice'],
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
    if (value.type === 'cast-talk' && key === 'person') {
      if (!Object.hasOwn(CAST, String(value[key]))) return false;
    } else if (value.type === 'cast-talk' && key === 'choice') {
      if (!['invite', 'respect', 'defer'].includes(String(value[key]))) return false;
    } else if (value.type === 'guest-action' && key === 'guest') {
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
  if (simulation === 5)
    throw new Error('This month uses the older cast. Start fresh; keep its export for inspection.');
  if (simulation !== 1 && simulation !== 2 && simulation !== 3 && simulation !== 4 && simulation !== 6)
    throw new Error('Unsupported simulation version.');
  if (simulation === 6 && data.castEdition !== CAST_EDITION)
    throw new Error('Unsupported cast edition. Start fresh.');
  const continuity = readContinuity(data.continuity, data.oneCast);
  if (simulation === 6 && data.framework !== '2.18.0')
    throw new Error('Older framework edition. Start fresh.');
  if (data.chapter !== undefined) {
    boundedPersonaJson(data.chapter);
    if (
      !record(data.chapter) ||
      data.chapter.version !== 'goodhands-chapter/1' ||
      !Array.isArray(data.chapter.inputs) ||
      data.chapter.inputs.length > 7 ||
      data.chapter.seed !== data.seed ||
      canonicalPersona(data.chapter) !== canonicalPersona(continuity.chapter)
    )
      throw new Error('Invalid pinned agency chapter.');
  } else if (continuity.chapter) throw new Error('Missing pinned agency chapter.');
  if (simulation !== 6 && (continuity.arrivals.length || continuity.heads.length || continuity.chapter))
    throw new Error('Legacy runs cannot admit a guest.');
  if (simulation !== 6 && inputs.some((e) => e.input.type === 'guest-action'))
    throw new Error('Legacy editions have no guest actions.');
  const state = replay(
    data.seed as number,
    inputs,
    data.minute,
    simulation,
    (data.chapter as AgencyChapter | undefined)?.guests ?? continuity.arrivals.map((a) => a.initial),
    data.chapter as AgencyChapter | undefined,
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
    value.arrivals.length > 7 ||
    !Array.isArray(value.heads) ||
    value.heads.length > 7 ||
    !Array.isArray(value.rows) ||
    value.rows.length > 256 ||
    canonicalPersona(rows) !== canonicalPersona(value.rows)
  )
    throw new Error('Invalid pinned continuity.');
  if (value.fileUnlinked !== undefined && typeof value.fileUnlinked !== 'boolean')
    throw new Error('Invalid file recording state.');
  const book = value as unknown as ContinuityBook;
  if (
    book.forks !== undefined &&
    (!record(book.forks) ||
      Object.keys(book.forks).length > book.rows.length ||
      Object.entries(book.forks).some(
        ([revision, parent]) =>
          !/^[a-f0-9]{64}$/.test(revision) || typeof parent !== 'string' || !/^[a-f0-9]{64}$/.test(parent),
      ))
  )
    throw new Error('Invalid explicit fork history.');
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
      !['zeynep', 'selin', 'nermin', 'hatice', 'hulya', 'aylin', 'derya'].includes(row.probe) ||
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
  if (book.chapter) {
    await validateAgencyChapter(book.chapter);
    if (!savedState || canonicalPersona(savedState.castChapter) !== canonicalPersona(book.chapter))
      throw new Error('Run chapter header differs.');
    const claims = book.initialClaims ?? [];
    const localFile = book.fileOrigin === true && !claims.length;
    if (!localFile && claims.length !== book.chapter.inputs.length)
      throw new Error('Missing initial batch claims.');
    for (const input of localFile ? [] : book.chapter.inputs) {
      const claim = claims.find((p) => p.castId === input.parent.castId);
      if (
        !claim ||
        claim.parentRevision !== input.parent.revision ||
        claim.branchId !== input.parent.branchId
      )
        throw new Error('Invalid batch claim parent.');
      await validatePersona(claim);
      if (
        claim.source.game !== 'goodhands' ||
        claim.source.rules !== 'goodhands-6' ||
        canonicalPersona(claim.transfer) !== canonicalPersona({ ...input.parent.transfer, life: input.life })
      )
        throw new Error('Batch claim changed the pinned passport.');
    }
    for (const head of book.heads) {
      await validatePersona(head);
      const claim = claims.find((p) => p.castId === head.castId);
      if (claim?.revision === head.revision) continue;
      if (head.source.game !== 'goodhands' || head.source.rules !== 'goodhands-6')
        throw new Error('Invalid owned source receipt.');
      const row = book.rows.find(
        (r) => r.revision === head.revision && r.parentRevision === head.parentRevision,
      );
      if (!row) throw new Error('Owned receipt has no accepted lineage.');
      if (head.terminal) {
        const source = replay(
          savedState.seed,
          inputs.filter((i) => i.at <= head.terminal!.at),
          head.terminal.at,
          6,
          book.chapter.guests,
          book.chapter,
        );
        if (source.people[(await import('../sim/cast.ts')).castKey(head.castId)]?.body.alive)
          throw new Error('Terminal receipt has no actual source death.');
        continue;
      }
      const cp = head.transfer.checkpoint as { sourceNow?: number; checkpointDigest?: string } | undefined;
      if (!cp || typeof cp.sourceNow !== 'number' || cp.sourceNow > savedState.now)
        throw new Error('Owned receipt has no source boundary.');
      const at = cp.sourceNow;
      const source = replay(
        savedState.seed,
        inputs.filter((i) => i.at <= at),
        at,
        6,
        book.chapter.guests,
        book.chapter,
      );
      const { agencyTransfer } = await import('../sim/cast-chapter.ts');
      const expected = await agencyTransfer(source, (await import('../sim/cast.ts')).castKey(head.castId));
      if (
        canonicalPersona(expected.agencyPerson) !== canonicalPersona(head.transfer.agencyPerson) ||
        expected.checkpoint.checkpointDigest !== cp.checkpointDigest
      )
        throw new Error('Owned checkpoint differs from the pinned source replay.');
    }
    return;
  }
  for (const arrival of book.arrivals) {
    await validatePersona(arrival.source);
    await validatePersona(arrival.claim);
    if (
      arrival.claim.source.game !== 'goodhands' ||
      arrival.claim.source.rules !== 'goodhands-6' ||
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
    if (!row || head.source.game !== 'goodhands' || head.source.rules !== 'goodhands-6')
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
        const forkOf =
          book.forks?.[ancestor.revision] ??
          (ancestor.revision === head.revision
            ? (head.transfer.admission as Record<string, unknown> | undefined)?.forkOf
            : undefined);
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
      6,
      book.arrivals.map((a) => a.initial),
    );
    const expected = await guestCheckpointTransfer(source, arrival.initial.id, arrival.source);
    const forkOf = (head.transfer.admission as Record<string, unknown> | undefined)?.forkOf;
    const transfer =
      typeof forkOf === 'string' ? { ...expected, admission: { ...expected.admission, forkOf } } : expected;
    if (canonicalPersona(head.transfer) !== canonicalPersona(transfer))
      throw new Error('Pinned head does not match the source checkpoint.');
  }
}
