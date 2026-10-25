import type { CandidateView, Note, PlacementView, Quality, RequestView, View } from '../sim/types.ts';
import { plainText } from './plain-english.ts';

export const SPEED_NAMES = ['Slow', 'Steady', 'Fast'] as const;
export const INTRO =
  'You run Good Hands, a small placement agency. A household needs a nanny by Tuesday 08:00. Three applicants are waiting on your bench. Rent is due Friday.';

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

export function money(amount: number): string {
  return `₺${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount)}`;
}

export function noteText(note: Note): string {
  return `${note.quality} — ${plainText(note.phrase)} · ${note.source}: ${note.from}${note.claim ? ` — ${note.claim}` : ''}`;
}

export function evidence(candidate: CandidateView, quality: Quality): string {
  const notes = candidate.notes.filter((n) => n.quality === quality && !n.crossedOut);
  return notes.length
    ? notes.map((n) => `${n.source}: ${plainText(n.phrase)} (${n.from})`).join('; ')
    : 'You have not made a note or checked this yet.';
}

export function vouchLabel(candidate: CandidateView, quality: Quality): string {
  const notes = candidate.notes.filter((n) => n.quality === quality && !n.crossedOut);
  const source = ['seen', 'heard', 'says'].find((source) => notes.some((n) => n.source === source));
  return `${quality} · ${source ?? 'not checked'}`;
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
    ? 'The family pays one week’s wage as a deposit now, capped at the agreed fee.'
    : simulation === 3
      ? 'The family pays half the agreed fee as a deposit now.'
      : 'The family pays one week’s wage as a deposit now.';
}
