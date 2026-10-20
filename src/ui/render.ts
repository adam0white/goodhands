import type { CandidateView, Note, PlacementView, Quality, View } from '../sim/types.ts';

export const SPEED_NAMES = ['Slow', 'Walk', 'Trot', 'Gallop'] as const;
export const INTRO =
  'You run Good Hands, a small placement agency. The Arslans need a nanny by Tuesday 08:00. Three women are waiting on your bench. Rent is due Friday.';

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
  return `${note.quality} — ${note.phrase} · ${note.source}: ${note.from}${note.claim ? ` — ${note.claim}` : ''}`;
}

export function evidence(candidate: CandidateView, quality: Quality): string {
  const notes = candidate.notes.filter((n) => n.quality === quality && !n.crossedOut);
  return notes.length
    ? notes.map((n) => `${n.source}: ${n.phrase} (${n.from})`).join('; ')
    : 'No note yet. You have not checked this.';
}

export function vouchLabel(candidate: CandidateView, quality: Quality): string {
  const notes = candidate.notes.filter((n) => n.quality === quality && !n.crossedOut);
  const source = ['seen', 'heard', 'says'].find((source) => notes.some((n) => n.source === source));
  return `${quality} · ${source ?? 'not checked'}`;
}

export function phoneAvailability(v: View): string | undefined {
  if (v.heldScene || (v.scene && !['interview', 'reference'].includes(v.scene.kind)))
    return 'Finish this conversation before answering another call.';
  return undefined;
}

export function candidateAvailability(candidate: CandidateView): string | undefined {
  if (candidate.busy) return candidate.busy;
  if (candidate.status === 'gone') return 'She has left. She is no longer on your books.';
  if (candidate.status === 'placed') return 'She is working. Use Placed to check in or withdraw her.';
  if (candidate.status === 'trial') return 'She is at a trial. Wait for the family’s word.';
  return undefined;
}

export function placementLabel(placement: PlacementView): string {
  return {
    trial: 'In the trial week',
    kept: 'Kept on',
    returned: 'Returned to the books',
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

export function speedLabel(v: View): string {
  return v.slowed
    ? `Slow · held slow (chosen: ${SPEED_NAMES[v.speed]})`
    : `${SPEED_NAMES[v.speed]} · clock moving`;
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
