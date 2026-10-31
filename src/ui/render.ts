import type { CandidateView, Note, PlacementView, Quality, RequestView, View } from '../sim/types.ts';
import { plainText } from './plain-english.ts';

export const INTRO =
  'You run Good Hands, a small placement agency. A household needs a nanny by Tuesday 08:00. Three applicants are waiting on your bench. Rent is due Friday.';

/** The weekday Sleep opens on. Mirrors the sim's Sleep input: day 0 is Monday 2 November; Sundays are skipped except day 27. */
export function nextOpenWeekday(day: number): string {
  let next = day + 1;
  if (next % 7 === 6 && next !== 27) next++;
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][next % 7]!;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

export function money(amount: number): string {
  return `₺${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount)}`;
}

/** Source words describe evidence reaching Nermin, never the worker’s true traits. */
export function noteSource(note: Note): string {
  return note.source === 'seen'
    ? 'Nermin observed this.'
    : note.source === 'says'
      ? `${note.from.replace(/ says$/, '')} said this.`
      : `${note.from} reported this to Nermin.`;
}

export function noteText(note: Note): string {
  return `${note.quality} — Nermin’s reading: ${plainText(note.phrase)} ${noteSource(note)}${note.claim ? ` ${plainText(note.claim)}` : ''}`;
}

export function evidence(candidate: CandidateView, quality: Quality): string {
  const notes = candidate.notes.filter((n) => n.quality === quality && !n.crossedOut);
  return notes.length ? notes.map(noteText).join('; ') : 'You have not made a note or checked this yet.';
}

export function vouchLabel(candidate: CandidateView, quality: Quality): string {
  const notes = candidate.notes.filter((n) => n.quality === quality && !n.crossedOut);
  const note = ['seen', 'heard', 'says'].flatMap((source) => notes.filter((n) => n.source === source))[0];
  return `${quality} · ${note ? noteSource(note) : 'not checked'}`;
}

/** Resolve public names without showing internal actor IDs. */
export function personName(v: View, id: string): string {
  const applicants = [...v.bench, ...v.books];
  return (
    applicants.find((c) => c.id === id)?.name ??
    v.families.find((f) => f.id === id || f.name === id)?.name ??
    v.families.flatMap((f) => f.household).find((p) => p.id === id)?.name ??
    applicants.flatMap((c) => c.referees).find((r) => r.id === id)?.name ??
    v.castContacts?.find((c) => c.id === id)?.name ??
    v.guests?.find((g) => g.id === id)?.name ??
    v.city.figures.find((f) => f.id === id)?.name ??
    (id === 'nermin' ? 'Nermin' : id === 'husnu' ? 'Mr Hüsnü' : 'Someone')
  );
}

export function phoneAvailability(v: View): string | undefined {
  if (v.scene?.yieldsToPhone) return undefined;
  if (v.heldScene || (v.scene && !['interview', 'reference'].includes(v.scene.kind)))
    return 'Finish this conversation before answering another call.';
  return undefined;
}

export function candidateAvailability(candidate: CandidateView): string | undefined {
  if (candidate.busy) return candidate.busy;
  if (candidate.status === 'gone') return 'This applicant has left and is no longer in your agency records.';
  if (candidate.status === 'placed')
    return 'This worker is working. Use Placed to check in or bring the worker back.';
  if (candidate.status === 'trial') return 'This worker is on a trial. Wait for the family’s report.';
  return undefined;
}

export function placementLabel(placement: PlacementView): string {
  return {
    trial: 'During the trial',
    kept: 'Kept on',
    returned: 'Returned to agency records',
    quit: 'Left the house',
    withdrawn: 'Brought back',
    dismissed: 'Dismissed',
  }[placement.status];
}

export function resumeLine(v: View): string {
  const where = v.ended
    ? 'Month review'
    : (v.scene?.title ?? (v.dayCard ? 'The office is closed' : v.task.text));
  return `${v.dateLabel}, ${v.timeLabel} · ${where}`;
}

/** The part of a button that the title screen changes while a new month is being prepared. */
export interface OpeningControl {
  disabled: boolean;
  textContent: string | null;
  isConnected: boolean;
}
export const OPEN_OFFICE = 'Open the office';
export const OPENING_OFFICE = 'Opening the office…';
/** Shows that preparation has started, only when startup will actually begin. */
export function startOpening(control: OpeningControl, willStart: boolean): void {
  if (!willStart) return;
  control.disabled = true;
  control.textContent = OPENING_OFFICE;
}
/**
 * Called when startup has finished, however it ended. A button that is still on the title, with no
 * other startup running, goes back to a working retry. A replaced title (the office opened, or a
 * retained opening was offered) is left alone.
 */
export function settleOpening(control: OpeningControl, otherStartupActive: boolean): void {
  if (otherStartupActive || !control.isConnected) return;
  control.disabled = false;
  control.textContent = OPEN_OFFICE;
}

/** Reading a card, a sheet or the City view uses the existing inspection slowdown. */
export function isInspecting(state: {
  sheet: boolean;
  tab: string;
  selected: string | null;
  city: boolean;
}): boolean {
  return state.sheet || state.city || (state.tab === 'Bench' && state.selected !== null);
}

/** The only return time the player holds for a kept number is the callback the worker asked for. */
export function awayWords(candidate: CandidateView): string | undefined {
  if (!candidate.interviewUnavailable) return undefined;
  if (candidate.status !== 'books' || candidate.interviewAfter === undefined || candidate.arrival)
    return candidate.interviewUnavailable;
  const when = clockLabels(candidate.interviewAfter);
  return `${candidate.name} is away. Call back after ${when.dateLabel}, ${when.timeLabel}, and allow time for the journey.`;
}

/** Wall-clock presentation only. Historical saved speeds still replay in the simulation. */
export function automaticPace(v: View, inspecting = false): number {
  if (v.ended || v.scene || v.heldScene || v.phoneRinging || v.dayCard || v.open === false) return 0;
  if (v.slowed || (inspecting && v.bench.length > 0)) return 0.5;
  return v.bench.length ? 2 : 20;
}
export function canWait(v: View): boolean {
  return !!v.next && !v.slowed && automaticPace(v) > 0;
}

/** Calendar labels for a public game minute, independent of the machine timezone. */
export function clockLabels(minute: number): { dateLabel: string; timeLabel: string } {
  const date = new Date(Date.UTC(2026, 10, 2) + Math.floor(minute) * 60_000);
  return {
    dateLabel: new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(date),
    timeLabel: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(date),
  };
}

/** Eligibility comes from the public view; unknown character facts stay in the simulation. */
export function matchingReason(
  candidate: CandidateView,
  request?: RequestView,
  kind: 'trial' | 'place' = 'trial',
  simulation = 3,
): string | undefined {
  return (
    candidateAvailability(candidate) ??
    candidate.refuses?.find((refusal) => refusal.family === request?.family)?.words ??
    (request?.status !== 'open'
      ? 'This request is no longer open. Choose another family or answer the phone.'
      : ((kind === 'trial' || simulation < 3
          ? candidate.matchReasons?.find((reason) => reason.family === request.family)?.words
          : undefined) ??
        (!candidate.roles.includes(request.role)
          ? `${candidate.name} is looking for ${candidate.roles.join(' or ')} work. This family needs a ${request.role}.`
          : undefined)))
  );
}

export function referenceReason(referee: CandidateView['referees'][number]): string | undefined {
  if (referee.called)
    return referee.why ?? 'You already heard this reference. Read the account in Nermin’s notes.';
  return referee.reachable ? undefined : (referee.why ?? 'You cannot reach this person now. Try later.');
}

export function requestGroups(requests: RequestView[]): { open: RequestView[]; lost: RequestView[] } {
  return {
    open: requests.filter((request) => request.status === 'open'),
    lost: requests.filter((request) => request.status === 'lost'),
  };
}

/** An optional game reckoning, using only outcomes already present in the public view. */
export function monthTally(v: View): string {
  if (!v.ended || !v.review) return '';
  const kept = v.placements.filter((p) => p.status === 'kept').length;
  const ended = v.placements.filter((p) => ['returned', 'quit', 'dismissed'].includes(p.status)).length;
  const trust = v.review.trustedBy.length;
  return `<details data-month-tally><summary>See tally</summary><h2>Nermin’s closing tally</h2><p>This tally counts agency outcomes. It does not measure people’s worth.</p><p>TOTAL: ${kept + trust - ended} = kept placements (${kept}) + households that trust Nermin (${trust}) − returned, quit or dismissed placements (${ended}). Each placement record counts once. Trials and withdrawals do not count.</p></details>`;
}

/** Money language follows the run's rules edition, including imported months. */
export function placementDepositWords(simulation: number, replacement = false): string {
  if (replacement) return 'The earlier deposit covers this replacement.';
  return simulation >= 4
    ? 'The family pays a deposit now. The deposit is one week’s wage. It is never more than the agreed fee.'
    : simulation === 3
      ? 'The family pays half the agreed fee as a deposit now.'
      : 'The family pays one week’s wage as a deposit now.';
}

/**
 * Why a reading stands, from the accounts Nermin received. A crossed-out line stays in the record: it shows that a
 * later account changed the reading, not that the old account still moves it. Reasons use only what was said, whether
 * an account moved her estimate, and which speaker counted for more when that order is certain. No numbers.
 */
export function readingBasis(notes: Note[]): string {
  if (!notes.length) return '';
  const who = (n: Note) => plainText(n.from.replace(/ says$/, ''));
  const by = (source: Note['source']) => notes.filter((n) => n.source === source);
  const names = (list: Note[]) => [...new Set(list.map(who))].join(' and ');
  const parts = [
    by('seen').length ? 'what Nermin saw herself' : '',
    by('heard').length
      ? `${by('heard').length === 1 ? 'a report' : 'reports'} from ${names(by('heard'))}`
      : '',
    by('says').length ? `${names(by('says'))}’s own ${by('says').length === 1 ? 'answer' : 'answers'}` : '',
  ].filter(Boolean);
  const told = notes.filter((n) => n.source !== 'seen');
  const unmoved = told.filter((n) => n.moved === false);
  const well = notes.filter((n) => n.said === 'well');
  const badly = notes.filter((n) => n.said === 'badly');
  const more = notes.find((n) => n.weighs === 'more');
  const less = notes.find((n) => n.weighs === 'less');
  const latest = notes.at(-1)!.read;
  const outcome = (
    notes.length === 1
      ? {
          yes: 'This is enough for her to believe it.',
          no: 'This is enough for her to doubt it.',
          maybe: 'This is not clear enough, so she stays unsure.',
        }
      : {
          yes: 'Together they are clear enough for her to believe it.',
          no: 'Together they are clear enough for her to doubt it.',
          maybe: 'Together they are not clear enough, so she stays unsure.',
        }
  )[latest];
  return [
    `Nermin received ${parts.join(' and ')}.`,
    unmoved.length
      ? `${names(unmoved)}’s ${unmoved.length === 1 ? 'account' : 'accounts'} did not visibly change her reading.`
      : '',
    well.length && badly.length
      ? `The accounts disagree: ${names(well)} spoke well of this, and ${names(badly)} spoke badly of it.`
      : '',
    more && less
      ? more.weighReason === 'trust'
        ? `${who(more)}’s account counts for more than ${who(less)}’s, because she trusted ${who(more)}’s word more when she heard it.`
        : `${who(less)}’s own answer counts for less than ${who(more)}’s report, because people’s own word about themselves counts for less.`
      : by('heard').length && by('says').length
        ? 'A report counts for less when she trusted the speaker less when she heard it. A person’s own answer counts for less than the same words from someone she trusted as much.'
        : '',
    !by('seen').length && !by('heard').length
      ? `Only ${names(by('says'))} says so. Nobody else has confirmed it.`
      : notes.length === 1 && told.length === 1
        ? 'This is one report from one person.'
        : '',
    notes.some((n) => n.crossedOut)
      ? 'A crossed-out line stays in her record. A later account changed the reading.'
      : '',
    outcome,
  ]
    .filter(Boolean)
    .join(' ');
}

/** The default bench description is false once the applicant is at home, travelling or at work. */
export function showsWaitingLook(
  candidate: Pick<CandidateView, 'presence' | 'look'>,
  waitingLook: string,
): boolean {
  return candidate.look !== waitingLook || !candidate.presence || candidate.presence === 'office';
}

/** An ended placement whose trial verdict has not reached Nermin, with the rest its own terms would bring. */
export type AwaitedFee = { name: string; rest: number };
/** What the family has paid so far, from the fee ledger in the view. */
export type FeeLedger =
  | { depositPaid: number; settled: boolean; complete?: boolean; awaited?: AwaitedFee }
  | undefined;
function awaitedFee(
  v: Pick<View, 'placements'> & Partial<Pick<View, 'bench' | 'books'>>,
  family: string,
  before = Infinity,
): AwaitedFee | undefined {
  const p = v.placements.findLast((e) => e.family === family && e.since < before && e.feeOutlook?.awaited);
  if (!p) return undefined;
  const name =
    [...(v.bench ?? []), ...(v.books ?? [])].find((c) => c.id === p.candidate)?.name ?? 'the earlier worker';
  return { name, rest: p.feeOutlook!.restIfKept };
}
export function feeLedgerFor(
  v: Pick<View, 'placements'> & Partial<Pick<View, 'bench' | 'books'>>,
  family: string,
): FeeLedger {
  const earlier = v.placements.filter((p) => p.family === family && p.feeOutlook);
  if (!earlier.length) return undefined;
  const first = earlier.reduce((a, b) => (b.since < a.since ? b : a));
  const awaited = awaitedFee(v, family);
  return {
    depositPaid: first.feeOutlook!.depositPaid,
    settled: earlier.some((p) => p.feeOutlook!.settled),
    ...(earlier.some((p) => p.feeOutlook!.complete) ? { complete: true } : {}),
    ...(awaited ? { awaited } : {}),
  };
}

const COMPLETE_FEE =
  'This family already kept a worker you placed, so its fee is finished. No more fee is due.';
/** Both possibilities while an earlier trial verdict is unanswered; each amount comes from its own public terms. */
function awaitedWords(a: AwaitedFee, rest: number): string {
  return `${a.name}’s trial result has not reached you yet. If the family kept ${a.name}, ${a.rest > 0 ? `it owes the other ${money(a.rest)} under the earlier terms, sent with that news, and` : 'its fee is finished, and'} nothing more is due for the new placement. If not, ${rest > 0 ? `it pays the other ${money(rest)} after the new trial, if the new worker stays` : 'nothing more is due after the new trial'}.`;
}

/** The deposit rule as the simulation applies it: a quarter of the monthly wage, never more than the fee. */
export function feeWords(terms: { wage: number; fee: number }, ledger?: FeeLedger): string {
  if (terms.fee === 0) {
    // An earlier trial verdict may still be on its way; zero new fee does not cancel what it would owe.
    return ledger?.awaited && !ledger.settled && !ledger.complete
      ? `No new agency fee is due under these terms. ${awaitedWords(ledger.awaited, 0)}`
      : 'No agency fee is due.';
  }
  if (ledger) {
    if (ledger.settled) return 'This family has already paid its fee in full. Nothing more is due.';
    if (ledger.complete) return COMPLETE_FEE;
    const rest = Math.max(0, terms.fee - ledger.depositPaid);
    if (ledger.awaited)
      return `This family already paid you a ${money(ledger.depositPaid)} deposit. ${awaitedWords(ledger.awaited, rest)}`;
    return `This family already paid you a ${money(ledger.depositPaid)} deposit.${rest > 0 ? ` It pays the other ${money(rest)} after the trial, if the worker stays.` : ' Nothing more is due after the trial.'}`;
  }
  const deposit = Math.min(terms.fee, terms.wage / 4);
  const rest = terms.fee - deposit;
  return `The family pays you ${money(deposit)} when you agree. ${deposit < terms.wage / 4 ? 'This is the whole fee, which is less than a quarter of the monthly wage.' : deposit === terms.fee ? `This is the whole fee, which is a quarter of the ${money(terms.wage)} monthly wage.` : `This is a quarter of the ${money(terms.wage)} monthly wage.`}${rest > 0 ? ` The family pays the other ${money(rest)} after the trial, if the worker stays.` : ' Nothing more is due after the trial.'}`;
}

const READING_WORDS = { yes: 'she believes it', no: 'she doubts it', maybe: 'she is unsure' } as const;

/** What is still to come for a placement, using only terms, dates, the fee ledger and promises in the view. */
export function placementStakes(v: View, p: PlacementView): string[] {
  const lines: string[] = [];
  if (p.status === 'trial') {
    const end = clockLabels(p.trialEnds);
    lines.push(
      `The trial ends ${end.dateLabel} at ${end.timeLabel}. The family then says whether it keeps the worker.`,
    );
    const outlook = p.feeOutlook;
    const awaited = awaitedFee(v, p.family, p.since);
    if (outlook && p.terms && (p.terms.fee > 0 || awaited)) {
      lines.push(
        outlook.settled
          ? 'This family has already paid its fee in full. No more fee is due. If the family does not keep the worker, the worker returns to your records.'
          : outlook.complete
            ? `${COMPLETE_FEE} If the family does not keep the worker, the worker returns to your records.`
            : awaited
              ? `${p.terms.fee === 0 ? 'No new agency fee is due under these terms. ' : ''}${awaitedWords(awaited, outlook.restIfKept)} If the family does not keep this worker, the worker returns to your records.`
              : outlook.restIfKept > 0
                ? `If the family keeps the worker, it pays the other ${money(outlook.restIfKept)}. If not, no more fee is paid and the worker returns to your records.`
                : 'No more fee is due after the trial. If the family does not keep the worker, the worker returns to your records.',
      );
    }
  }
  if (p.vouched.length) {
    // "Checked" is the record now: someone other than the applicant has given Nermin an account of it.
    // It does not say the account was good, and it is not the state when you made the promise.
    const notes = [...v.bench, ...v.books].find((c) => c.id === p.candidate)?.notes ?? [];
    const state = (q: Quality) => {
      const mine = notes.filter((n) => n.quality === q);
      const checked = mine.some((n) => n.source === 'seen' || n.source === 'heard');
      const latest = mine.at(-1);
      return checked
        ? `checked; ${READING_WORDS[latest!.read]}`
        : latest
          ? `not checked; ${READING_WORDS[latest.read]}`
          : 'not checked';
    };
    lines.push(
      `${personName(v, p.family).replace(/^the /, 'The ')} will remember what you promised: ${p.vouched.map((q) => `${q} (${state(q)})`).join(', ')}. This is the record now, not when you promised. The family remembers if a promise proves false.`,
    );
  }
  const left = v.rent.remaining;
  lines.push(
    left
      ? `Rent of ${money(v.rent.amount)} is due every Friday and is paid from the cash box. The next payment is ${v.rent.label}, and ${left === 1 ? 'it is the last this month' : `${left} are due before the month ends, counting that one`}.`
      : 'No more rent is due this month.',
  );
  return lines;
}

/** A recorded answer is evidence, including when Nermin doubts it. */
export function addedEvidence(notes: Note[]): string {
  return notes
    .filter((n) => !n.crossedOut)
    .map((n) => `${noteSource(n)} Nermin’s reading: ${plainText(n.phrase)}`)
    .join(' ');
}

export function placementDeadline(v: View, family: string): string {
  const request = v.requests.find((r) => r.family === family && r.status === 'open');
  const name = personName(v, family);
  return request
    ? `${name.charAt(0).toLocaleUpperCase('en-GB')}${name.slice(1)} needs a ${request.role} by ${request.byLabel}.`
    : '';
}

/** An agreement time is known. It does not establish when work or a meal was observed. */
export function placementTiming(placement: Pick<PlacementView, 'since'>): string {
  const at = clockLabels(placement.since);
  return `Placement agreed ${at.dateLabel} at ${at.timeLabel}.`;
}
