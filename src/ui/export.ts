import { fingerprint, replay, view } from '../sim/index.ts';
import { type Input, type LoggedInput, QUALITIES, type State } from '../sim/types.ts';

export interface RunExport {
  game: 'goodhands';
  version: 1;
  seed: number;
  minute: number;
  inputs: LoggedInput[];
  state: State;
  fingerprint: string;
}
export type CompactRunExport = Omit<RunExport, 'state'>;

export function exportRun(state: State, inputs: LoggedInput[]): RunExport {
  const visible = view(state);
  return {
    game: 'goodhands',
    version: 1,
    seed: visible.seed,
    minute: visible.now,
    inputs: structuredClone(inputs),
    state: structuredClone(state),
    fingerprint: fingerprint(state),
  };
}
export function compactRun(run: RunExport): CompactRunExport {
  const { game, version, seed, minute, inputs, fingerprint } = run;
  return { game, version, seed, minute, inputs: structuredClone(inputs), fingerprint };
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
    'call-reference': ['candidate', 'referee'],
    trial: ['candidate', 'family'],
    place: ['candidate', 'family', 'vouch'],
    'check-in': ['placement', 'how'],
    withdraw: ['placement'],
    choose: ['scene', 'choice'],
    'close-scene': ['scene'],
    'answer-phone': [],
    sleep: [],
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
    if (key === 'speed') {
      if (![0, 1, 2, 3].includes(value[key] as number)) return false;
    } else if (key === 'how') {
      if (!['phone', 'visit', 'drop-by'].includes(value[key] as string)) return false;
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

export function verifyImport(text: string): { state: State; inputs: LoggedInput[] } {
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
  const state = replay(data.seed as number, inputs, data.minute);
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
  return { state, inputs };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
