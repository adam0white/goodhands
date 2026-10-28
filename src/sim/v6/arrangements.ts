import { workerNeed } from './dialogue.ts';
import { CANDIDATES } from './world.ts';

type Moment =
  | 'finish'
  | 'funds'
  | 'handover'
  | 'instructions'
  | 'break'
  | 'day-off'
  | 'pay'
  | 'route'
  | 'duties';

interface ArrangementSpec {
  request: string;
  terms: string;
  test: string;
  at: number;
  workerKept: string;
  workerBroken: string;
  familyKept: string;
  familyBroken: string;
  moment: Moment;
}

interface Terms {
  moment: Moment;
  minute: number;
  weekday?: number[];
  request: string;
  terms: string;
  test: string;
  workerKept: string;
  workerBroken: string;
  familyKept: string;
  familyBroken: string;
}

const TERMS: Record<string, Terms> = Object.fromEntries(
  CANDIDATES.map((c) => {
    const need = workerNeed(c.id);
    return [
      c.id,
      {
        moment: 'finish',
        minute: need.finishBy,
        request: `Keep ${c.name}’s agreed finish time and duties.`,
        terms: `${c.name} asks for these terms: “${need.words}”`,
        test: `Will ${c.name} finish at the agreed time without extra duties?`,
        workerKept: 'I finished the agreed duties and left on time.',
        workerBroken: 'They added work after the agreed finish time. That was not our agreement.',
        familyKept: 'We covered the extra work ourselves.',
        familyBroken: 'We asked the worker to stay after the agreed finish time.',
      },
    ];
  }),
);

export function arrangementSpec(candidateId: string, now: number): ArrangementSpec {
  const candidate = CANDIDATES.find((candidate) => candidate.id === candidateId);
  const need = workerNeed(candidateId);
  const terms = TERMS[candidateId];
  if (!candidate || !terms) throw new Error(`No authored arrangement for ${candidateId}`);
  // The next day is the earliest possible test. Sunday is reserved for days off;
  // work tasks run Monday–Saturday, including a deferred Monday after Sunday.
  let day = Math.floor(now / 1440) + 1;
  while (terms.weekday ? !terms.weekday.includes(day % 7) : day % 7 === 6) day++;
  const { minute, weekday: _weekday, ...spec } = terms;
  return { ...spec, at: day * 1440 + minute, terms: spec.terms || need.words };
}
