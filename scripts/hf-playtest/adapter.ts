/** HF sees only the public View and chooses the same Inputs as the office UI. */
import { advance, apply, fingerprint, newGame, view } from '../../src/sim/index.ts';
import type { Input, Quality, State, View } from '../../src/sim/types.ts';
import { QUALITIES, SPEEDS } from '../../src/sim/types.ts';
import { clockLabels } from '../../src/ui/render.ts';

type Action = {
  id: string;
  label: string;
  kind: string;
  promise: number;
  tags?: string[];
  mischief?: boolean;
  disabled?: { reason: string };
};
type Event = {
  kind: string;
  summary: string;
  valence: number;
  salience: number;
  answers: false | string[];
};

export class GoodHandsAdapter {
  name = 'goodhands-0.1.0';
  state: State;
  offered = new Map<string, Input>();
  private seenLog = new Set<number>();
  private seenScene = new Map<string, number>();
  private cards = new Map<string, string>();
  private placements = new Map<string, string>();
  private receipts: Event[] = [];
  private carry = 0;
  private previousCash: number;
  private interviewed = new Set<string>();

  constructor(seed: number) {
    this.state = newGame(seed);
    this.previousCash = view(this.state).cash;
  }

  observe() {
    const v = view(this.state);
    const events: Event[] = this.receipts.splice(0);
    for (const line of v.log) {
      if (this.seenLog.has(line.id)) continue;
      this.seenLog.add(line.id);
      events.push({ kind: line.kind, summary: line.text, valence: 0, salience: 0.65, answers: false });
    }
    if (v.scene) {
      const from = this.seenScene.get(v.scene.id) ?? 0;
      for (const line of v.scene.lines.slice(from))
        events.push({
          kind: v.scene.kind,
          summary: `${line.speaker ? `${line.speaker}: ` : ''}${line.text}`,
          valence: 0,
          salience: 0.8,
          answers: false,
        });
      this.seenScene.set(v.scene.id, v.scene.lines.length);
    }
    for (const c of [...v.bench, ...v.books]) {
      const summary = `${c.name}: ${c.look}. ${c.status}${c.busy ? `; ${c.busy}` : ''}${c.wants ? `; wants: ${c.wants}` : ''}. ${c.notes.map((n) => `${n.crossedOut ? 'Crossed out: ' : ''}${n.quality}: ${n.phrase} (${n.source}, ${n.from})`).join('; ')}`;
      if (this.cards.get(c.id) === summary) continue;
      this.cards.set(c.id, summary);
      events.push({ kind: 'candidate-card', summary, valence: 0, salience: 0.55, answers: false });
    }
    for (const p of v.placements) {
      const summary = `${p.candidate} at ${p.family}: ${p.status}. ${p.arrangement ?? ''}${p.pending ? ` ${p.pending.text} (${p.pending.dateLabel}).` : ''}${p.lastWord ? ` Latest word: ${p.lastWord}` : ''}`;
      if (this.placements.get(p.id) === summary) continue;
      this.placements.set(p.id, summary);
      events.push({ kind: 'placement-card', summary, valence: 0, salience: 0.7, answers: false });
    }
    const cashChange = v.cash - this.previousCash;
    if (cashChange !== 0)
      events.push({
        kind: 'cash',
        summary: `Cash ${cashChange > 0 ? '+' : ''}₺${cashChange}; now ₺${v.cash}.`,
        valence: cashChange > 0 ? 0.5 : -0.35,
        salience: 0.8,
        answers: false,
      });
    this.previousCash = v.cash;
    const loops = v.ended
      ? []
      : [
          v.task.text,
          ...(v.heldScene ? [`Resume after this call: ${v.heldScene.title}.`] : []),
          `Rent: ₺${v.rent.amount}, ${v.rent.label}.`,
          ...(v.dayCard ? [v.dayCard.tomorrow] : []),
          ...(v.next ? [`${v.next.label}: ${v.next.dateLabel}`] : []),
          ...v.placements.flatMap((p) => (p.pending ? [`${p.pending.text}: ${p.pending.dateLabel}`] : [])),
        ];
    return {
      clock: `${v.dateLabel} ${v.timeLabel}`,
      phase: v.ended ? 'review' : (v.scene?.kind ?? (v.dayCard ? 'day-card' : 'office')),
      chapter: `week ${Math.floor(v.now / (7 * 1440)) + 1}, ${v.dateLabel}`,
      goal: v.ended ? '' : 'You run Good Hands, a small placement agency.',
      next: v.ended ? '' : (v.next?.label ?? v.task.text),
      text: [
        { level: 'now' as const, text: v.task.text },
        ...events.map((e) => ({ level: 'happened' as const, text: e.summary })),
      ],
      events,
      features: {
        pressure: v.scene || v.phoneRinging || v.rent.short ? 0.8 : 0.3,
        openLoop: v.ended ? 0 : 0.7,
      },
      over: v.ended,
      ...(v.ended ? { outcome: v.now < 27 * 1440 ? ('loss' as const) : ('mixed' as const) } : {}),
      loops,
    };
  }

  actions() {
    const v = view(this.state);
    this.offered.clear();
    const out: Action[] = [];
    const add = (id: string, label: string, input: Input, promise: number, disabled?: string) => {
      if (!disabled) this.offered.set(id, input);
      out.push({
        id,
        label,
        kind: input.type,
        promise,
        ...(disabled ? { disabled: { reason: disabled } } : {}),
      });
    };
    if (v.ended) return out;
    if (v.scene) {
      if (
        v.phoneRinging &&
        (v.scene.yieldsToPhone || (!v.heldScene && ['interview', 'reference'].includes(v.scene.kind)))
      )
        add('answer-phone', `Answer the phone: ${v.phoneRinging.who}`, { type: 'answer-phone' }, 0.9);
      for (const c of v.scene.choices)
        add(
          `choose:${v.scene.id}:${c.id}`,
          `${c.label}${c.hint ? ` (${c.hint})` : ''}`,
          { type: 'choose', scene: v.scene.id, choice: c.id },
          /coach|envelope|tell them|share|poach/i.test(c.label) ? 0.4 : 0.75,
          c.disabled,
        );
      if (v.scene.canLeave)
        add(
          `close:${v.scene.id}`,
          'Finish this conversation',
          { type: 'close-scene', scene: v.scene.id },
          v.scene.lines.length > 4 ? 0.65 : 0.2,
        );
      return out;
    }
    if (v.phoneRinging)
      add('answer-phone', `Answer the phone: ${v.phoneRinging.who}`, { type: 'answer-phone' }, 0.9);
    if (v.next && !v.phoneRinging && !v.dayCard)
      add('wait-for', `${v.next.label} (${v.next.dateLabel})`, { type: 'wait-for' }, 0.7);
    if (v.dayCard) add('sleep', `Close for the evening. ${v.dayCard.tomorrow}`, { type: 'sleep' }, 0.85);
    if (v.open) {
      for (const c of [...v.bench, ...v.books].filter(
        (c) => ['bench', 'books'].includes(c.status) && !c.busy,
      )) {
        if (c.status === 'bench')
          add(
            `take-number:${c.id}`,
            `Take ${c.name}’s number for the books`,
            { type: 'take-number', candidate: c.id },
            c.posture === 'leaving' ? 0.85 : 0.5,
          );
        if (!this.interviewed.has(c.id))
          add(
            `interview:${c.id}`,
            `Interview ${c.name}`,
            { type: 'interview', candidate: c.id },
            c.notes.length ? 0.3 : 0.75,
            c.interviewAfter
              ? `Call back after ${clockLabels(c.interviewAfter).dateLabel}, ${clockLabels(c.interviewAfter).timeLabel}`
              : undefined,
          );
        for (const r of c.referees.filter((r) => !r.called))
          add(
            `reference:${c.id}:${r.id}`,
            `Call ${r.name} about ${c.name}`,
            { type: 'call-reference', candidate: c.id, referee: r.id },
            0.7,
            r.reachable ? undefined : (r.why ?? 'Not reachable now'),
          );
        for (const request of v.requests.filter(
          (r) =>
            r.status === 'open' &&
            r.by > v.now &&
            c.roles.includes(r.role) &&
            (c.wage === null || c.wage <= r.wage) &&
            !c.refuses?.some((x) => x.family === r.family),
        )) {
          const family = v.families.find((f) => f.id === request.family)?.name ?? request.family;
          const vouched = this.supported(c.notes);
          add(
            `place:${c.id}:${request.family}`,
            `Place ${c.name} with ${family}; vouch for ${vouched.length ? vouched.join(', ') : 'no qualities yet'}`,
            { type: 'place', candidate: c.id, family: request.family, vouch: vouched },
            c.notes.length ? 0.8 : 0.4,
          );
          if (request.by - v.now > 1440)
            add(
              `trial:${c.id}:${request.family}`,
              `Send ${c.name} for a trial morning with ${family}`,
              { type: 'trial', candidate: c.id, family: request.family },
              0.65,
            );
        }
      }
      for (const p of v.placements.filter((p) => ['trial', 'kept'].includes(p.status))) {
        const candidate = [...v.bench, ...v.books].find((c) => c.id === p.candidate)?.name ?? p.candidate;
        const family = v.families.find((f) => f.id === p.family)?.name ?? p.family;
        if (v.now >= (p.checkInAt ?? p.since + 1440))
          for (const how of ['phone', 'visit', 'drop-by'] as const)
            add(
              `check-in:${p.id}:${how}`,
              `Check in on ${candidate} at ${family}: ${how}`,
              { type: 'check-in', placement: p.id, how },
              p.seems === 'trouble' ? 0.8 : 0.35,
            );
        add(
          `withdraw:${p.id}`,
          `Withdraw ${candidate} from ${family}`,
          { type: 'withdraw', placement: p.id },
          p.seems === 'trouble' ? 0.65 : 0.1,
        );
      }
    }
    for (const speed of [0, 1, 2, 3] as const) {
      if (v.speed === speed) continue;
      add(
        `speed:${speed}`,
        `Clock: ${['slow', 'walk', 'trot', 'gallop'][speed]}`,
        { type: 'speed', speed },
        speed === 3 && !v.phoneRinging ? 0.35 : 0.05,
      );
    }
    return out;
  }

  edgeActions() {
    const v = view(this.state);
    if (v.ended) return [];
    const scene = v.scene;
    if (scene)
      return scene.choices
        .filter((c) => !c.disabled && /coach|envelope|tell them|share|poach/i.test(c.label))
        .map((c) => {
          const id = `edge:${scene.id}:${c.id}`;
          this.offered.set(id, { type: 'choose', scene: scene.id, choice: c.id });
          return { id, label: c.label, kind: 'choose', promise: 0.4, tags: ['confront'], mischief: true };
        });
    const edges: Action[] = [];
    for (const action of this.actions()) {
      const input = this.offered.get(action.id);
      if (input?.type !== 'place') continue;
      const id = `edge:${action.id}:vouch-all`;
      this.offered.set(id, { ...input, vouch: [...QUALITIES] });
      edges.push({
        id,
        label: `${action.label}; vouch for every quality, including those you have not seen`,
        kind: 'place',
        promise: 0.45,
        tags: ['confront'],
        mischief: true,
      });
    }
    return edges;
  }

  apply(id: string) {
    const input = this.offered.get(id);
    if (!input) throw new Error(`No currently offered action: ${id}`);
    const before = view(this.state);
    if (input.type === 'interview') this.interviewed.add(input.candidate);
    this.state = apply(this.state, input);
    const after = view(this.state);
    const resumed = !!after.scene && after.scene.id === before.heldScene?.id;
    const lines = resumed
      ? []
      : (after.scene?.lines.slice(before.scene?.id === after.scene.id ? before.scene.lines.length : 0) ?? []);
    const logs = after.log.filter((line) => !before.log.some((old) => old.id === line.id));
    const visible = [...lines.map((line) => line.text), ...logs.map((line) => line.text)];
    if (input.type === 'speed' && after.speed !== before.speed)
      visible.push(`Clock: ${['slow', 'walk', 'trot', 'gallop'][after.speed]}.`);
    if (resumed && after.scene) visible.push(`Conversation resumed: ${after.scene.title}.`);
    if (before.scene && !after.scene) visible.push(`Conversation finished. ${after.task.text}`);
    if (['sleep', 'wait-for'].includes(input.type) && after.now > before.now)
      visible.push(`${after.dateLabel}, ${after.timeLabel}. ${after.task.text}`);
    if (visible.length)
      this.receipts.push({
        kind: 'input-answer',
        summary: visible.join(' '),
        valence: 0,
        salience: 0.65,
        answers: [id],
      });
  }

  advance(seconds: number) {
    let remaining = Math.max(0, seconds);
    while (remaining > 1e-9) {
      const v = view(this.state);
      if (v.ended) break;
      const rate = SPEEDS[v.slowed ? 0 : v.speed] ?? SPEEDS[0] ?? 2;
      const available = this.carry + remaining * rate;
      const minutes = Math.min(60, Math.floor(available + 1e-8));
      if (minutes === 0) {
        this.carry = available;
        break;
      }
      this.state = advance(this.state, minutes);
      const elapsed = view(this.state).now - v.now;
      if (elapsed <= 0) break;
      remaining = Math.max(0, remaining - (elapsed - this.carry) / rate);
      this.carry = 0;
      // advance stops at a new response, so use its slow speed for the rest of the real beat.
    }
  }

  result() {
    const v = view(this.state);
    return {
      minute: v.now,
      ended: v.ended,
      fingerprint: fingerprint(this.state),
      visible: { cash: v.cash, placements: v.placements, review: v.review },
    };
  }

  private supported(notes: View['bench'][number]['notes']): Quality[] {
    return QUALITIES.filter((q) =>
      notes.some((n) => n.quality === q && n.read === 'yes' && !n.crossedOut && n.source !== 'says'),
    );
  }
}
export const make = (seed: number) => new GoodHandsAdapter(seed);
