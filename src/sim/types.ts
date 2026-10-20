/**
 * The contract between the simulation (src/sim) and the UI (src/ui). The UI reads only `View` (from `view(state)`)
 * and sends only `Input` (through `apply`). The sim owns `State`. Fields may be added; never remove or rename one.
 * Design authority: docs/design.md.
 */
import type { Person } from '@adam0white/human-framework';

/** Game minutes since 00:00 Monday 2 November 2026. Day d (0-based) starts at d * 1440. */
export type Minute = number;

export type Quality = 'patient' | 'honest' | 'reliable' | 'warm' | 'hardworking' | 'discreet';
export const QUALITIES: readonly Quality[] = [
  'patient',
  'honest',
  'reliable',
  'warm',
  'hardworking',
  'discreet',
];

export type Role = 'nanny' | 'cook' | 'carer' | 'driver' | 'housekeeper';

/** Where a note on a candidate's card came from. The word is the confidence: seen > heard > says. */
export type Source = 'says' | 'heard' | 'seen';

export type Speed = 0 | 1 | 2 | 3; // slow, walk, trot, gallop
/** Game minutes per real second at each speed. While a scene is open or the phone rings, the clock runs at SPEEDS[0]. */
export const SPEEDS: readonly number[] = [0.5, 2, 6, 20];

export type Input =
  | { type: 'speed'; speed: Speed }
  | { type: 'interview'; candidate: string } // opens an interview scene
  | { type: 'take-number'; candidate: string } // two minutes; keep a bench candidate on the books
  | { type: 'call-reference'; candidate: string; referee: string } // opens a phone scene
  | { type: 'trial'; candidate: string; family: string } // send for a trial morning (next morning)
  | { type: 'place'; candidate: string; family: string; vouch: Quality[] } // vouch: what Nermin tells the family
  | { type: 'check-in'; placement: string; how: 'phone' | 'visit' | 'drop-by' }
  | { type: 'withdraw'; placement: string }
  | { type: 'choose'; scene: string; choice: string } // answer in any open scene
  | { type: 'close-scene'; scene: string } // leave a scene that allows leaving
  | { type: 'answer-phone' } // pick up a ringing phone (opens its scene)
  | { type: 'wait-for' }
  | { type: 'sleep' }; // end the evening from the day card: advance to 08:30 next open day

export interface LoggedInput {
  at: Minute;
  input: Input;
}

/** One note on a card: "patient — she says so". */
export interface Note {
  quality: Quality;
  /** Nermin's read in words: 'yes' | 'maybe' | 'no' plus a short phrase in her voice. Never a number. */
  read: 'yes' | 'maybe' | 'no';
  phrase: string; // e.g. 'patient with children'
  source: Source;
  from: string; // who: 'she says', 'Mrs Ak', 'I saw it', 'the Arslans'
  at: Minute;
  claim?: string; // The source’s own words, quoted and attributed.
  crossedOut?: boolean; // contradicted by later, stronger evidence
}

export interface CandidateView {
  id: string;
  name: string;
  age: number;
  roles: Role[]; // roles she is looking for
  look: string; // one line Nermin noticed on arrival ('rough hands, a careful coat')
  status: 'bench' | 'books' | 'trial' | 'placed' | 'gone';
  /** Posture on the bench, show-don't-count patience: 'settled' | 'restless' | 'leaving'. */
  posture?: 'settled' | 'restless' | 'leaving';
  /** Why she is not available now, if she is not (DL-4): 'At the Arslans until 18:00'. */
  busy?: string;
  wants?: string;
  wage: number | null; // lira per month she asked for, once known
  experience: string[]; // in words, once known
  notes: Note[];
  referees: { id: string; name: string; reachable: boolean; why?: string; called: boolean }[];
  /** Families she will not work for, in her words, once known. */
  refuses?: { family: string; words: string }[];
}

export interface RequestView {
  id: string;
  family: string; // family id
  role: Role;
  wants: string; // what they say they want, their words
  wage: number; // offered, per month
  by: Minute; // deadline
  byLabel: string; // 'Tuesday 3 November, 08:00'
  status: 'open' | 'filled' | 'lost';
}

export interface FamilyView {
  id: string;
  name: string; // 'the Arslans'
  district: string; // 'Karşıyaka'
  household: { name: string; who: string }[]; // 'Grandmother Saadet', 'lives with them'
  trust: 'warm' | 'polite' | 'cool' | 'unknown'; // their trust in Nermin's word, in words
  line?: string; // their latest words to Nermin
}

export interface PlacementView {
  id: string;
  candidate: string;
  family: string;
  role: Role;
  since: Minute;
  trialEnds: Minute;
  /** How it seems to Nermin, from what has reached her: 'good' | 'unsure' | 'trouble' | 'unknown'. */
  seems: 'good' | 'unsure' | 'trouble' | 'unknown';
  lastWord?: string; // the latest words that reached Nermin about it
  status: 'trial' | 'kept' | 'returned' | 'quit' | 'withdrawn' | 'dismissed';
  checkInAt?: Minute; // Earliest moment a check-in can have a new answer.
  arrangement?: string;
  pending?: { text: string; at: Minute; dateLabel: string };
  vouched: Quality[];
}

export interface SceneChoice {
  id: string;
  label: string; // short, English, action-first ('Ask about her last family')
  hint?: string; // known cost or risk (DL-14), e.g. 'takes 15 minutes', 'she will say it to them'
  disabled?: string; // reason if unavailable (DL-4)
}

export interface SceneLine {
  speaker: string; // display name, or '' for narration
  text: string;
  kind: 'speech' | 'notice' | 'narration';
  side?: 'worker' | 'family';
}

export interface SceneView {
  id: string;
  kind:
    | 'two-sides'
    | 'visit'
    | 'interview'
    | 'reference'
    | 'phone'
    | 'check-in'
    | 'trial-result'
    | 'verdict'
    | 'rent'
    | 'offer'
    | 'confidence';
  title: string; // 'Interview: Sevda'
  with: string; // person id or family id
  lines: SceneLine[]; // the exchange so far, newest last
  choices: SceneChoice[];
  canLeave: boolean;
  /** Notes added by this scene, so the UI can show "added to her card". */
  added?: Note[];
}

export interface LogEntry {
  id: number;
  at: Minute;
  text: string;
  kind: 'arrival' | 'phone' | 'word' | 'money' | 'placement' | 'city' | 'day';
  ref?: { candidate?: string; family?: string; placement?: string };
}

/** One thread of talk on the city map (only talk that happened; drawn as it happens). */
export interface TalkThread {
  id: number;
  end: Minute;
  consequence?: string;
  at: Minute;
  from: string;
  to: string;
  place: string; // 'Kültürpark'
  about?: string; // 'Nermin' or a family/candidate id, only if it reached Nermin
}

export interface CityFigure {
  id: string;
  name: string;
  x: number; // 0..1 map coordinates
  y: number;
  kind: 'worker' | 'candidate' | 'family';
  place?: string;
  toX?: number;
  toY?: number;
  arrive?: Minute;
  mood?: 'easy' | 'tired' | 'upset'; // drawn as posture, never a bar
}

export interface DayCard {
  day: number;
  dateLabel: string; // 'Monday 2 November'
  lines: string[]; // 2-4 plain lines of what changed today that Nermin could know
  tomorrow: string; // one line naming an unfinished decision
}

export interface View {
  next: { label: string; at: Minute; dateLabel: string } | null;
  seed: number;
  now: Minute;
  dateLabel: string; // 'Monday 2 November'
  timeLabel: string; // '08:30'
  speed: Speed;
  slowed: boolean; // true when the clock is held slow because something waits
  open: boolean; // office hours
  cash: number;
  rent: { due: Minute; amount: number; label: string; short: boolean };
  /** The one thing that needs a response now, with what to tap (DL-3, DL-5). */
  task: {
    text: string;
    target?: { kind: 'candidate' | 'family' | 'placement' | 'phone' | 'scene'; id: string };
  };
  phoneRinging: { who: string; since: Minute } | null;
  scene: SceneView | null; // at most one open scene (DL-24)
  /** Conversation waiting while Nermin answers a call. */
  heldScene?: { id: string; title: string } | null;
  bench: CandidateView[]; // waiting now, in seat order
  books: CandidateView[]; // all others met (on the books, on trial, placed, gone)
  requests: RequestView[];
  families: FamilyView[];
  placements: PlacementView[];
  log: LogEntry[]; // newest last
  city: { figures: CityFigure[]; threads: TalkThread[]; houses: { family: string; x: number; y: number }[] };
  dayCard: DayCard | null; // shown at 19:00 until 'sleep'
  ended: boolean;
  review: Review | null; // set when ended
}

/** A spoken claim's complete path. Revealed only in the month review. */
export interface TalkRoute {
  id: number;
  at: Minute;
  from: string;
  to: string;
  about: string;
  words: string;
  /** Earlier telling heard by this speaker, when this is a retelling. */
  parent?: number;
}

export interface Review {
  routes?: TalkRoute[];
  workersTrust?: { id: string; name: string; trust: 'warm' | 'polite' | 'cool' }[];
  people: { id: string; name: string; truth: Record<Quality, 'yes' | 'maybe' | 'no'>; notes: Note[] }[];
  placements: { id: string; story: string[] }[];
  threads: TalkThread[];
  cash: number;
  trustedBy: string[];
  question: string;
}

/** The sim's state: plain JSON. People are HF Persons, keyed by id. */
export interface State {
  version: 1;
  seed: number;
  rng: number; // seeded RNG state
  now: Minute;
  speed: Speed;
  inputs: LoggedInput[];
  people: Record<string, Person>; // candidates, household members, referees, Nermin ('nermin')
  // The sim adds whatever else it needs below; the UI must not read State directly.
  [key: string]: unknown;
}

/** Public API the sim must export from src/sim/index.ts. */
export interface SimApi {
  newGame(seed: number): State;
  apply(state: State, input: Input): State; // logs the input at state.now
  advance(state: State, minutes: number): State; // runs the clock; may stop early when something waits
  view(state: State): View;
  replay(seed: number, inputs: LoggedInput[], until: Minute): State;
  fingerprint(state: State): string;
}
