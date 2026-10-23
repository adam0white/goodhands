import { type Person, trustOf } from '@adam0white/human-framework-legacy';
import type { EmploymentTerms, NegotiationView, SceneChoice } from './types.ts';
import { workerNeed } from './voices.ts';
import type { Candidate, Family } from './world.ts';

export function validTerms(t: EmploymentTerms): boolean {
  return (
    !!t &&
    Object.keys(t).length === 6 &&
    [t.wage, t.startHour, t.endHour, t.dayOff, t.trialDays, t.fee].every(Number.isFinite) &&
    t.wage > 0 &&
    t.wage <= 1e6 &&
    Number.isInteger(t.startHour * 60) &&
    Number.isInteger(t.endHour * 60) &&
    t.startHour >= 0 &&
    t.startHour < 24 &&
    t.endHour > t.startHour &&
    t.endHour <= 24 &&
    Number.isInteger(t.dayOff) &&
    t.dayOff >= 0 &&
    t.dayOff <= 6 &&
    Number.isInteger(t.trialDays) &&
    t.trialDays >= 1 &&
    t.trialDays <= 14 &&
    t.fee >= 0 &&
    t.fee <= 1e6
  );
}
export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const hourWords = (hour: number) =>
  `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
export const termsWords = (t: EmploymentTerms) =>
  `₺${t.wage} a month, ${hourWords(t.startHour)}–${hourWords(t.endHour)}, ${weekdays[t.dayOff]} off, a trial of ${t.trialDays} working days; agency fee ₺${t.fee}.`;
export function responses(
  c: Candidate,
  f: Family,
  w: Person,
  h: Person,
  t: EmploymentTerms,
): {
  worker: NegotiationView['worker'];
  familyResponse: NegotiationView['familyResponse'];
  workerWords: string;
  familyWords: string;
} {
  const finish = workerNeed(c.id).finishBy / 60;
  const flexibility = w.traits.agreeableness * 0.04 + (trustOf(w, 'nermin') - 0.5) * 0.04;
  const low = t.wage < c.wage * (1 - flexibility),
    late = t.endHour > finish,
    long = t.endHour - t.startHour > 10 + (1 - w.needs.autonomy) * 2;
  const harsh = t.trialDays > 7 && w.needs.safety < 0.55;
  const wrongDay = c.id === 'gul' && t.dayOff !== 6;
  const workerRefuses =
    t.wage < c.wage * (0.65 + w.needs.safety * 0.1) || t.endHour > finish + 2 || t.endHour - t.startHour > 14;
  const worker = workerRefuses
    ? 'refused'
    : low || late || long || harsh || wrongDay
      ? 'countered'
      : 'accepted';
  const costly =
    t.wage >
    f.wage *
      (1.08 +
        h.traits.agreeableness * 0.4 +
        (trustOf(h, 'nermin') - 0.5) * 0.1 +
        (t.trialDays <= 3 ? 0.15 : 0));
  const fee = t.fee > f.wage * (1 + h.traits.agreeableness * 0.3);
  const short = (t.endHour < 16 || t.endHour - t.startHour < 6) && h.needs.autonomy < 0.5;
  const familyRefuses = t.wage > f.wage * (1.6 + h.traits.agreeableness * 0.3) || t.fee > f.wage * 2;
  const familyResponse = familyRefuses ? 'refused' : costly || fee || short ? 'countered' : 'accepted';
  return {
    worker,
    familyResponse,
    workerWords: workerRefuses
      ? 'No. I cannot take a job on those terms. Offer a fair wage and a day I can manage.'
      : wrongDay
        ? 'Sunday is when my daughter brings the children. I need Sunday off.'
        : low
          ? `I need ₺${c.wage} a month. Will you put that to them?`
          : late
            ? `I need to leave by ${String(Math.floor(finish)).padStart(2, '0')}:00. ${workerNeed(c.id).words}`
            : long
              ? 'Those hours leave no time to recover. Shorten the day.'
              : harsh
                ? 'I cannot wait that long for a settled job. Try seven working days first.'
                : `I can agree to that. ${weekdays[t.dayOff]} off, and we keep those hours.`,
    familyWords: familyRefuses
      ? 'No. We cannot commit to that wage and fee. Bring us an offer within our means.'
      : costly
        ? `We offered ₺${f.wage}. Ask for less${t.trialDays > 3 ? ', or give us three working days before we commit' : ''}.`
        : fee
          ? `That fee is too much. Lower it before we agree.`
          : short
            ? 'We need at least six hours of cover, through four. Can you arrange those hours?'
            : `Agreed. We will pay ₺${t.wage} and keep those hours. We will decide after ${t.trialDays} working days.`,
  };
}
export function negotiationChoices(n: NegotiationView, c: Candidate): SceneChoice[] {
  const t = n.terms;
  return [
    {
      id: 'accept-terms',
      label: 'Then we have an agreement. Shall we begin?',
      ...(n.worker !== 'accepted' || n.familyResponse !== 'accepted'
        ? { disabled: 'Both the worker and the family must agree to the same terms.' }
        : {}),
    },
    { id: 'offer-wage', label: `Would you raise it to ₺${Math.max(c.wage, t.wage + 500)}?` },
    {
      id: 'offer-hours',
      label: `Can ${c.name} leave at ${Math.min(17, Math.floor(workerNeed(c.id).finishBy / 60))}:00?`,
    },
    { id: 'offer-day-off', label: `Give ${c.name} ${weekdays[(t.dayOff + 1) % 7]} off instead.` },
    {
      id: 'offer-trial',
      label: t.trialDays === 3 ? 'Try seven working days first.' : 'Try three working days first.',
    },
    { id: 'offer-fee', label: `I can lower my fee to ₺${Math.max(0, t.fee - 1000)}.` },
    { id: 'cancel', label: 'We have no agreement. Leave it for now.' },
  ];
}
