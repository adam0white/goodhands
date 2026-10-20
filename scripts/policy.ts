/** Automated players use exactly the information shown by view(). No hidden people or authored world data. */
import {
  advance,
  apply,
  type CandidateView,
  type Input,
  newGame,
  QUALITIES,
  type Quality,
  type RequestView,
  type State,
  type View,
  view,
} from '../src/sim/index.ts';

export type Policy = 'careful' | 'reckless' | 'cunning';
export const MONTH_END = 27 * 1440 + 1140;

function pressure(request: RequestView): Quality {
  const words = request.wants.toLowerCase();
  if (/private|conversation|herself|business|discreet/.test(words)) return 'discreet';
  if (/trust|money|straight/.test(words)) return 'honest';
  if (/six|timetable|write|door|early|school.*gate/.test(words)) return 'reliable';
  if (/busy|clean|laundry|washing|eight for lunch/.test(words)) return 'hardworking';
  if (/talk|person|know people/.test(words)) return 'warm';
  return request.role === 'driver'
    ? 'reliable'
    : request.role === 'cook' || request.role === 'housekeeper'
      ? 'hardworking'
      : 'patient';
}
function available(v: View): CandidateView[] {
  return [...v.bench, ...v.books].filter((c) => ['bench', 'books'].includes(c.status) && !c.busy);
}
function matches(c: CandidateView, r: RequestView): boolean {
  return (
    c.roles.includes(r.role) &&
    (c.wage === null || c.wage <= r.wage) &&
    !c.refuses?.some((refusal) => refusal.family === r.family)
  );
}
function evidence(c: CandidateView, q: Quality): number {
  const notes = c.notes.filter((note) => note.quality === q && !note.crossedOut);
  return notes.reduce(
    (score, note) =>
      score +
      (note.read === 'yes' ? 1 : note.read === 'no' ? -1 : 0) *
        (note.source === 'seen' ? 5 : note.source === 'heard' ? 3 : 1),
    0,
  );
}
function vouched(c: CandidateView): Quality[] {
  return QUALITIES.filter(
    (q) =>
      c.notes.some((n) => n.quality === q && !n.crossedOut && n.read === 'yes' && n.source !== 'says') &&
      evidence(c, q) > 0,
  );
}

/** `until` is an absolute game minute. A chosen action may finish a few minutes after it. */
export function runPolicy(seed: number, policy: Policy, until = MONTH_END): State {
  if (!Number.isFinite(until) || until < 510)
    throw new Error('Policy end must be a finite minute at or after 08:30.');
  let state = newGame(seed);
  const attempted = new Set<string>();
  const coached = new Set<string>();
  const checked = new Set<string>();
  const rejected = new Set<string>();
  let stagnant = 0;
  function act(input: Input): boolean {
    const key = JSON.stringify(input);
    if (rejected.has(key)) return false;
    const before = view(state);
    state = apply(state, input);
    const after = view(state);
    // A refusal only adds a log line. It must not trap the driver at the same minute.
    const changed =
      before.now !== after.now ||
      before.scene?.id !== after.scene?.id ||
      before.placements.length !== after.placements.length ||
      before.cash !== after.cash ||
      before.phoneRinging?.since !== after.phoneRinging?.since;
    if (!changed && !['close-scene', 'choose', 'sleep'].includes(input.type)) rejected.add(key);
    return true;
  }
  for (let turn = 0; turn < 12000; turn++) {
    const v = view(state);
    if (v.ended || v.now >= until) return state;
    const beforeMinute = v.now;
    if (v.scene) {
      const sc = v.scene;
      const choices = sc.choices.filter((choice) => !choice.disabled);
      let choice = choices[0];
      if (sc.kind === 'interview') {
        const candidate = [...v.bench, ...v.books].find((c) => c.id === sc.with);
        const count = candidate?.notes.filter((note) => note.source === 'says').length ?? 0;
        const target = v.requests.find((r) => r.status === 'open' && candidate && matches(candidate, r));
        const priorities = [
          ...new Set([target ? pressure(target) : 'patient', 'honest', 'reliable', ...QUALITIES]),
        ];
        const question = priorities
          .map((q) =>
            choices.find(
              (c) =>
                c.id === `q-${q}` &&
                !candidate?.notes.some((note) => note.quality === q && note.source === 'says'),
            ),
          )
          .find(Boolean);
        if (
          policy === 'cunning' &&
          count >= 1 &&
          !coached.has(sc.with) &&
          choices.some((c) => c.id === 'coach')
        ) {
          coached.add(sc.with);
          choice = choices.find((c) => c.id === 'coach');
        } else
          choice =
            count < (policy === 'careful' ? 3 : 1) && question
              ? question
              : choices.find((c) => c.id === 'finish');
      } else if (sc.kind === 'rent') {
        choice =
          choices.find(
            (c) =>
              /pay/.test(`${c.id} ${c.label}`.toLowerCase()) &&
              !/part/.test(c.label.toLowerCase()) &&
              v.cash >= v.rent.amount,
          ) ??
          choices.find((c) => /part|promise/.test(`${c.id} ${c.label}`.toLowerCase())) ??
          choice;
      } else if (sc.kind === 'offer' && policy === 'careful') {
        choice =
          choices.find((c) => /^(keep-private|return-envelope|decline|change-subject)$/.test(c.id)) ?? choice;
      } else if (policy === 'cunning') {
        // Use offered verbs and visible labels; no policy-only action or cash shortcut.
        choice =
          choices.find((c) =>
            /sell|accept|take|tell.*(know|heard|confidence)|share/.test(`${c.id} ${c.label}`.toLowerCase()),
          ) ?? choice;
      } else {
        choice =
          choices.find((c) =>
            /keep.*(private|confidence)|listen|support|pay|thank|look|reassure/.test(
              `${c.id} ${c.label}`.toLowerCase(),
            ),
          ) ?? choice;
      }
      if (choice) act({ type: 'choose', scene: sc.id, choice: choice.id });
      else if (sc.canLeave) act({ type: 'close-scene', scene: sc.id });
      else throw new Error(`No available choice in ${sc.id}`);
    } else if (v.phoneRinging) act({ type: 'answer-phone' });
    else if (v.dayCard) act({ type: 'sleep' });
    else if (!v.open) state = advance(state, Math.min(60, until - v.now));
    else {
      let acted = false;
      const free = available(v);
      const requests = v.requests.filter((r) => r.status === 'open').sort((a, b) => a.by - b.by);
      for (const request of requests) {
        const candidates = free.filter((c) => matches(c, request));
        if (!candidates.length) continue;
        if (policy === 'reckless') {
          const c = candidates[0];
          if (!c) continue;
          acted = act({ type: 'place', candidate: c.id, family: request.family, vouch: [...QUALITIES] });
        } else {
          const unasked = candidates.find(
            (c) => c.notes.filter((n) => n.source === 'says').length < (policy === 'careful' ? 3 : 1),
          );
          if (unasked) acted = act({ type: 'interview', candidate: unasked.id });
          else {
            const uncalled =
              policy === 'careful'
                ? candidates.flatMap((c) =>
                    c.referees.filter((r) => r.reachable && !r.called).map((r) => ({ c, r })),
                  )[0]
                : undefined;
            if (uncalled)
              acted = act({ type: 'call-reference', candidate: uncalled.c.id, referee: uncalled.r.id });
            else {
              const waitingForReference =
                policy === 'careful' &&
                candidates.some((c) => c.referees.some((r) => !r.called)) &&
                request.by - v.now > 120;
              if (!waitingForReference) {
                const q = pressure(request);
                const c = [...candidates].sort(
                  (a, b) =>
                    evidence(b, q) +
                    0.3 * evidence(b, 'honest') -
                    evidence(a, q) -
                    0.3 * evidence(a, 'honest'),
                )[0];
                if (!c) continue;
                const key = `${request.id}:${c.id}`;
                if (!attempted.has(key)) {
                  attempted.add(key);
                  acted = act({
                    type: 'place',
                    candidate: c.id,
                    family: request.family,
                    vouch: policy === 'careful' ? vouched(c) : [...QUALITIES],
                  });
                }
              }
            }
          }
        }
        if (acted) break;
      }
      // Meet people even between requests so they remain on the books after leaving the bench.
      if (!acted && policy !== 'reckless') {
        const candidate = v.bench.find((c) => !c.notes.some((n) => n.source === 'says'));
        if (candidate) acted = act({ type: 'interview', candidate: candidate.id });
      }
      if (!acted && policy !== 'reckless') {
        const p = v.placements.find(
          (p) =>
            ['trial', 'kept'].includes(p.status) &&
            v.now - p.since >= 1440 &&
            !checked.has(`${p.id}:${Math.floor(v.now / 1440)}`),
        );
        if (p) {
          checked.add(`${p.id}:${Math.floor(v.now / 1440)}`);
          acted = act({ type: 'check-in', placement: p.id, how: policy === 'careful' ? 'visit' : 'phone' });
        }
      }
      if (!acted) state = advance(state, Math.min(30, until - v.now));
    }
    stagnant = state.now === beforeMinute ? stagnant + 1 : 0;
    if (stagnant > 30) throw new Error(`Policy ${policy} stalled at ${state.now}`);
  }
  throw new Error(`Policy ${policy} exceeded its action budget at ${state.now}`);
}
