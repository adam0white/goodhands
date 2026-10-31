import { describe, expect, it } from 'vitest';
import { apply, newGame, view } from '../src/sim/index.ts';
import { DISPUTE_REPLIES, REFERENCE_WORDINGS, referenceFollowUp } from '../src/sim/references.ts';
import type { Note } from '../src/sim/types.ts';
import { answerFromReadings } from '../src/sim/voices.ts';
import { CANDIDATES, FAMILIES } from '../src/sim/world.ts';
import {
  automaticPace,
  awayWords,
  clockLabels,
  feeLedgerFor,
  feeWords,
  isInspecting,
  OPEN_OFFICE,
  OPENING_OFFICE,
  placementStakes,
  readingBasis,
  settleOpening,
  showsWaitingLook,
  startOpening,
} from '../src/ui/render.ts';

const WAITING = 'This applicant is waiting with an application form.';
const find = (s: ReturnType<typeof newGame>, id: string) =>
  [...view(s).bench, ...view(s).books].find((c) => c.id === id)!;

/** Ask one patience question, then call the first former employer once the call is possible. */
function patienceThenReference(seed: number, id: string) {
  const s = newGame(seed);
  apply(s, { type: 'interview', candidate: id });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'q-patient' });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'wait-bench' });
  for (let i = 0; i < 14 && !find(s, id).referees[0]!.reachable; i++) {
    const v = view(s);
    if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
    else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
    else apply(s, { type: 'wait-for' });
  }
  if (view(s).scene) apply(s, { type: 'close-scene', scene: view(s).scene!.id });
  apply(s, { type: 'call-reference', candidate: id, referee: find(s, id).referees[0]!.id });
  apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'ref-patient' });
  return s;
}

describe('F-2183 Nermin reading', () => {
  it('names every account received and why the own answer counted for less here, even when the quote sounds good', () => {
    // Seed 4: Özlem's own answer was hedged, then her former employer said she listened. Reading stays unsure.
    const s = patienceThenReference(4, 'pinar');
    const notes = find(s, 'pinar').notes.filter((n) => n.quality === 'patient');
    expect(notes.map((n) => n.read)).toEqual(['maybe', 'maybe']);
    expect(notes[1]!.claim).toContain('listened when the instructions were repeated');
    expect(readingBasis(notes)).toBe(
      'Nermin received a report from Hale Erol and Özlem Koç’s own answer. Özlem Koç’s own answer counts for less than Hale Erol’s report, because people’s own word about themselves counts for less. Together they are not clear enough, so she stays unsure.',
    );
  }, 60_000);

  it('keeps a crossed-out account in the record without claiming it still moves the reading', () => {
    // Seed 4: Şebnem's own confident answer is crossed out by a former employer's account, and stays in the evidence.
    const s = patienceThenReference(4, 'sevda');
    const notes = find(s, 'sevda').notes.filter((n) => n.quality === 'patient');
    expect(notes.map((n) => [n.read, !!n.crossedOut])).toEqual([
      ['yes', true],
      ['no', false],
    ]);
    const why = readingBasis(notes);
    expect(why).toContain('Nermin received a report from Melek Yıldız and');
    expect(why).toContain(
      'The accounts disagree: Şebnem Eren spoke well of this, and Melek Yıldız spoke badly of it.',
    );
    expect(why).toContain('A crossed-out line stays in her record. A later account changed the reading.');
    expect(why).not.toMatch(/replaced|still counts|counted/);
    expect(why).toContain('clear enough for her to doubt it');
  }, 60_000);

  it('words the own-answer discount by the actual order, and names a report that did not move the reading', () => {
    // View notes as the simulation projects them; trust itself is never shown.
    const note = (source: 'heard' | 'says', from: string, extra: Partial<Note>): Note => ({
      quality: 'patient',
      read: 'maybe',
      phrase: 'x',
      source,
      from,
      at: 0,
      said: 'well',
      moved: true,
      ...extra,
    });
    const trusted = readingBasis([
      note('heard', 'Hale Erol', { weighs: 'less', weighReason: 'trust' }),
      note('says', 'Özlem Koç', { weighs: 'more', weighReason: 'trust' }),
    ]);
    expect(trusted).toContain(
      'Özlem Koç’s account counts for more than Hale Erol’s, because she trusts Özlem Koç’s word more.',
    );
    expect(trusted).not.toMatch(/own answer counts (least|for less)/);
    const unmoved = readingBasis([
      note('heard', 'Hale Erol', { moved: false }),
      note('says', 'Özlem Koç', {}),
    ]);
    expect(unmoved).toContain('Hale Erol’s account did not visibly change her reading.');
    // No unchanged-estimate case may invent a cause: a rounded estimate also stays put for a trusted corroborating report.
    expect(unmoved).not.toMatch(/because she does not trust/);
  });

  it('gives nothing for a quality that has not been asked about', () => {
    expect(readingBasis([])).toBe('');
  });
});

describe('F-2184 fee and deposit', () => {
  const placeWith = (terms: { wage: number; fee: number }) => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: ['patient'] });
    const scene = view(s).scene!;
    const before = view(s).cash;
    apply(s, {
      type: 'propose-terms',
      scene: scene.id,
      terms: { ...terms, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7 },
    });
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
    return { s, paid: view(s).cash - before };
  };

  it('states the same deposit and rest that the simulation pays, for the default and a negotiated offer', () => {
    for (const [terms, deposit, rest] of [
      [{ wage: 9000, fee: 9000 }, 2250, 6750],
      [{ wage: 8500, fee: 9100 }, 2125, 6975],
    ] as const) {
      const { paid } = placeWith(terms);
      expect(paid).toBe(deposit);
      const words = feeWords(terms);
      expect(words).toContain(`pays you ₺${deposit.toLocaleString('en-GB')} when you agree`);
      expect(words).toContain(`other ₺${rest.toLocaleString('en-GB')} after the trial`);
    }
  }, 60_000);

  it('does not call a capped deposit a quarter of the wage, and handles no fee', () => {
    const capped = feeWords({ wage: 9000, fee: 1000 });
    expect(capped).toContain('pays you ₺1,000 when you agree');
    expect(capped).toContain('whole fee, which is less than a quarter');
    expect(capped).toContain('Nothing more is due after the trial.');
    // Equal to a quarter is not less than a quarter.
    const quarter = feeWords({ wage: 8000, fee: 2000 });
    expect(quarter).toContain('pays you ₺2,000 when you agree');
    expect(quarter).toContain('whole fee, which is a quarter of the ₺8,000 monthly wage');
    expect(quarter).not.toContain('less than');
    expect(feeWords({ wage: 9000, fee: 0 })).toBe('No agency fee is due.');
  });

  it('uses the family ledger for a replacement, including a changed wage and a fee already settled', () => {
    // The deposit retained from the first placement, not a new quarter of the new wage.
    expect(feeWords({ wage: 8000, fee: 9000 }, { depositPaid: 2250, settled: false })).toBe(
      'This family already paid you a ₺2,250 deposit. It pays the other ₺6,750 after the trial, if the worker stays.',
    );
    expect(feeWords({ wage: 8000, fee: 9000 }, { depositPaid: 2250, settled: true })).toBe(
      'This family has already paid its fee in full. Nothing more is due.',
    );
  });
});

describe('F-2186 what is still to come', () => {
  const placed = () => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: ['patient'] });
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
    return s;
  };

  it('projects the real fee ledger and lists trial end, fee still owed, promise and rents left', () => {
    const s = placed();
    const v = view(s);
    const p = v.placements[0]!;
    expect(p.feeOutlook).toEqual({ depositPaid: 2250, restIfKept: 6750, settled: false });
    expect(v.rent.remaining).toBe(4);
    const lines = placementStakes(v, p);
    expect(lines[0]).toMatch(
      /^The trial ends .* at \d\d:\d\d\. The family then says whether it keeps the worker\.$/,
    );
    expect(lines[1]).toContain('it pays the other ₺6,750');
    expect(lines[2]).toBe(
      'The Arslan family will remember what you promised: patient (not checked). This is the record now, not when you promised. The family remembers if a promise proves false.',
    );
    expect(lines[3]).toBe(
      `Rent of ₺5,000 is due every Friday and is paid from the cash box. The next payment is ${v.rent.label}, and 4 are due before the month ends, counting that one.`,
    );
    // After the trial only the promise and rent remain, and no fee is promised.
    expect(placementStakes(v, { ...p, status: 'kept' })).toHaveLength(2);
    // After the last Friday of the month there is no next payment to name.
    const done = { ...v, rent: { ...v.rent, remaining: 0 } };
    expect(placementStakes(done, p).at(-1)).toBe('No more rent is due this month.');
  });

  it('keeps the ledger for a replacement with a changed wage', () => {
    const s = placed();
    const inner = s as unknown as { placements: { terms: { wage: number; fee: number } }[] };
    Object.assign(inner.placements[0]!.terms, { wage: 8000, fee: 9000 });
    const replacement = view(structuredClone(s));
    expect(replacement.placements[0]!.feeOutlook!.restIfKept).toBe(6750);
    expect(placementStakes(replacement, replacement.placements[0]!)[1]).toContain('the other ₺6,750');
  });

  it('does not show the second fee as paid until the kept answer is delivered and the cash arrives', () => {
    // FIXTURE, manual setup: the trial is shortened and given one good moment so the real verdict and
    // answer-phone code run within one test. Not a played trial week.
    const s = placed();
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    const inner = s as unknown as {
      now: number;
      placements: {
        status: string;
        pendingFee: number;
        trialEnds: number;
        moments: { day: number; quality: string; good: boolean; text: string }[];
      }[];
    };
    const p = inner.placements[0]!;
    p.trialEnds = inner.now + 1;
    p.moments.push({ day: 0, quality: 'patient', good: true, text: 'fixture' });
    // The verdict is made at the next noon; calls before it are answered on the way.
    for (let i = 0; i < 20 && p.status === 'trial'; i++) {
      const v = view(s);
      if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
      else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
      else apply(s, { type: 'wait-for' });
    }
    expect(p.status).toBe('kept');
    expect(p.pendingFee).toBe(6750);
    const pending = view(s);
    expect(pending.placements[0]!.status).toBe('trial');
    expect(pending.placements[0]!.feeOutlook).toEqual({
      depositPaid: 2250,
      restIfKept: 6750,
      settled: false,
    });
    expect(placementStakes(pending, pending.placements[0]!)[1]).toContain(
      'If the family keeps the worker, it pays the other ₺6,750',
    );
    for (let i = 0; i < 20 && p.pendingFee; i++) {
      const v = view(s);
      if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
      else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
      else apply(s, { type: 'wait-for' });
    }
    const paid = view(s);
    expect(p.pendingFee).toBe(0);
    expect(paid.placements[0]!.status).toBe('kept');
    expect(paid.cash - pending.cash).toBe(6750);
    expect(paid.placements[0]!.feeOutlook).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
  }, 60_000);

  it('keeps a received fee received through withdrawal, a replacement and its private kept verdict', () => {
    // FIXTURE, manual setup as above for both trials (shortened, one good moment). The receipt, the withdrawal
    // and the placement of the replacement go through the real code; this is not a played trial week.
    const s = placed();
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    const inner = s as unknown as {
      now: number;
      placements: {
        status: string;
        pendingFee: number;
        trialEnds: number;
        moments: { day: number; quality: string; good: boolean; text: string }[];
      }[];
    };
    const drain = (done: () => boolean) => {
      for (let i = 0; i < 40 && !done(); i++) {
        const v = view(s);
        if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
        else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
        else if (v.dayCard) apply(s, { type: 'sleep' });
        else apply(s, { type: 'wait-for' });
      }
    };
    const first = inner.placements[0]!;
    first.trialEnds = inner.now + 1;
    first.moments.push({ day: 0, quality: 'patient', good: true, text: 'fixture' });
    drain(() => first.status === 'kept' && first.pendingFee === 0);
    expect(view(s).placements[0]!.feeOutlook!.settled).toBe(true);
    const cashAfterReceipt = view(s).cash;
    // Nermin brings the worker back and places another with the same family on a changed wage.
    if (view(s).scene) apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    apply(s, { type: 'withdraw', placement: view(s).placements[0]!.id });
    apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
    apply(s, {
      type: 'propose-terms',
      scene: view(s).scene!.id,
      terms: { wage: 8000, fee: 9000, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7 },
    });
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    const second = inner.placements.at(-1)!;
    expect(inner.placements).toHaveLength(2);
    const during = view(s);
    const outlook = (v: typeof during) => v.placements.at(-1)!.feeOutlook;
    expect(outlook(during)).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
    expect(placementStakes(during, during.placements.at(-1)!)[1]).toContain('already paid its fee in full');
    // The replacement's private kept verdict neither pays again nor changes the public fee state.
    second.trialEnds = inner.now + 1;
    second.moments.push({ day: 0, quality: 'patient', good: true, text: 'fixture' });
    drain(() => second.status === 'kept');
    expect(second.status).toBe('kept');
    expect(second.pendingFee).toBe(0);
    const privateVerdict = view(s);
    expect(outlook(privateVerdict)).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
    drain(() => view(s).placements.at(-1)!.status === 'kept');
    const delivered = view(s);
    expect(outlook(delivered)).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
    expect(delivered.cash).toBe(cashAfterReceipt);
  }, 60_000);

  it('keeps a checked promise checked after a later own answer crosses the reference out', () => {
    const s = placed();
    const v = view(s);
    const card = [...v.bench, ...v.books].find((c) => c.id === 'pinar')!;
    const note = (source: 'heard' | 'says', read: 'yes' | 'maybe', crossedOut: boolean) => ({
      quality: 'patient' as const,
      read,
      phrase: 'x',
      source,
      from: 'someone',
      at: 0,
      crossedOut,
    });
    card.notes.push(note('heard', 'yes', true), note('says', 'maybe', false));
    const lines = placementStakes(v, v.placements[0]!);
    expect(lines[2]).toContain('patient (checked; she is unsure)');
  });

  it('offers only actions the game admits now, and names when check-in opens', () => {
    const s = placed();
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    for (const c of [...view(s).bench]) apply(s, { type: 'take-number', candidate: c.id });
    expect(view(s).bench).toHaveLength(0);
    const at = view(s).placements[0]!.checkInAt!;
    const opens = `You can first check in by phone on a placed worker at ${clockLabels(at).dateLabel}, ${clockLabels(at).timeLabel}.`;
    const cards = (s as unknown as { cards: Record<string, { introduced?: boolean; status: string }> }).cards;
    const kept = view(s).books.filter((c) => cards[c.id]!.introduced && c.status === 'books');
    expect(kept.length).toBeGreaterThan(0);
    expect(view(s).task.text).toContain(`Wait, or call ${kept[0]!.name} in from the numbers you kept.`);
    expect(view(s).task.text).toContain(opens);
    expect(view(s).task.text).not.toContain('or check in by phone');
    // Someone already on the way cannot be called in again.
    for (const c of kept) apply(s, { type: 'call-in', candidate: c.id });
    expect(view(s).task.text).not.toContain('from the numbers you kept');
    expect(view(s).task.text).toContain(opens);
  }, 60_000);

  it('admits a stretch when the family agrees above what it planned, without moving the limit', () => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
    const scene = view(s).scene!;
    apply(s, {
      type: 'propose-terms',
      scene: scene.id,
      terms: { wage: 9000, fee: 9100, startHour: 8, endHour: 18, dayOff: 6, trialDays: 7 },
    });
    expect(view(s).scene!.negotiation!.familyResponse).toBe('accepted');
    const words = view(s)
      .scene!.lines.filter((l) => l.side === 'family')
      .at(-1)!.text;
    expect(words).toBe(
      'Agreed. It is more than we planned, but we will manage. We will pay ₺9000 and keep those hours. We will decide after 7 working days.',
    );
  });
});

describe('Lena: a placed worker is not still waiting', () => {
  it('hides the bench description once the worker is placed and at work', () => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
    const placed = find(s, 'pinar');
    expect(placed.look).toBe(WAITING);
    expect(placed.presence).toBe('working');
    expect(showsWaitingLook(placed, WAITING)).toBe(false);
    expect(showsWaitingLook(find(s, 'sevda'), WAITING)).toBe(true);
    expect(showsWaitingLook({ look: 'rough hands', presence: 'working' }, WAITING)).toBe(true);
  });
});

describe('F-2185 distinct words', () => {
  it('gives two people at the same grade different patience lines without changing their grade or claim', () => {
    const answer = (id: string, name: string) =>
      answerFromReadings(
        { id, name },
        {
          outwardSigns: { fatigue: 0, fear: 0, pain: 0 },
          selfReport: { fatigue: 0, fear: 0, pain: 0 },
        },
        { quality: 0.8, skill: 0.5, honesty: 0.9 },
        'plain',
        'nanny',
        'q-patient',
        0,
      );
    const lines = ['pinar', 'sevda', 'gulce', 'cihan'].map((id) => answer(id, id));
    expect(new Set(lines.map((l) => l.claim)).size).toBe(1);
    expect(new Set(lines.map((l) => l.text)).size).toBeGreaterThan(2);
  });
});

describe('GH-L2-R4 actual receipt, existing allocation and new fee entitlement stay separate', () => {
  type Inner = {
    now: number;
    fees: Record<string, { first: boolean; second: boolean; deposit?: number; received?: boolean }>;
    placements: {
      status: string;
      reportedStatus: string;
      pendingFee: number;
      trialEnds: number;
      moments: { day: number; quality: string; good: boolean; text: string }[];
    }[];
  };
  const terms = (fee: number, wage = 9000) => ({
    wage,
    fee,
    startHour: 8,
    endHour: 18,
    dayOff: 6,
    trialDays: 7,
  });
  // FIXTURE, manual setup: each trial is shortened and given one good moment so the real verdict, answer-phone,
  // withdraw and place code run within one test. Not a played trial week and not a full journey.
  const setup = (firstFee?: number) => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
    if (firstFee !== undefined)
      apply(s, { type: 'propose-terms', scene: view(s).scene!.id, terms: terms(firstFee) });
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    const inner = s as unknown as Inner;
    const drain = (done: () => boolean) => {
      for (let i = 0; i < 40 && !done(); i++) {
        const v = view(s);
        if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
        else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
        else if (v.dayCard) apply(s, { type: 'sleep' });
        else apply(s, { type: 'wait-for' });
      }
    };
    const shorten = (p: Inner['placements'][number]) => {
      p.trialEnds = inner.now + 1;
      p.moments.push({ day: 0, quality: 'patient', good: true, text: 'fixture' });
    };
    const replace = (fee: number) => {
      if (view(s).scene) apply(s, { type: 'close-scene', scene: view(s).scene!.id });
      apply(s, { type: 'withdraw', placement: view(s).placements[0]!.id });
      apply(s, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
      apply(s, { type: 'propose-terms', scene: view(s).scene!.id, terms: terms(fee) });
      apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
      apply(s, { type: 'close-scene', scene: view(s).scene!.id });
      expect(inner.placements).toHaveLength(2);
      return inner.placements[1]!;
    };
    return { s, inner, drain, shorten, replace, first: inner.placements[0]! };
  };

  for (const fee of [1000, 0]) {
    it(`original fee ${fee}: a reported kept verdict finishes the fee without a cash receipt or new fee`, () => {
      const { s, inner, drain, shorten, replace, first } = setup(fee);
      expect(inner.fees.arslans!.deposit).toBe(fee);
      shorten(first);
      const before = view(s);
      drain(() => first.status === 'kept');
      // The private kept verdict changes neither the public outlook nor its words.
      const secret = view(s);
      expect(secret.placements[0]!.feeOutlook).toEqual(before.placements[0]!.feeOutlook);
      expect(placementStakes(secret, secret.placements[0]!)).toEqual(
        placementStakes(before, before.placements[0]!),
      );
      drain(() => first.reportedStatus === 'kept');
      const told = view(s);
      expect(inner.fees.arslans!.received).toBeUndefined();
      expect(told.placements[0]!.feeOutlook).toEqual({
        depositPaid: fee,
        restIfKept: 0,
        settled: false,
        complete: true,
      });
      expect(feeWords(terms(9000), feeLedgerFor(told, 'arslans'))).toBe(
        'This family already kept a worker you placed, so its fee is finished. No more fee is due.',
      );
      const second = replace(9000);
      const during = view(s);
      expect(during.placements[1]!.feeOutlook).toEqual({
        depositPaid: fee,
        restIfKept: 0,
        settled: false,
        complete: true,
      });
      const words = placementStakes(during, during.placements[1]!)[1]!;
      expect(words).toContain('its fee is finished. No more fee is due.');
      expect(words).not.toMatch(/₺8,000|₺9,000|paid its fee in full/);
      shorten(second);
      drain(() => second.status === 'kept');
      expect(second.pendingFee).toBe(0);
      drain(() => second.reportedStatus === 'kept');
      expect(second.reportedStatus).toBe('kept');
      expect(view(s).cash).toBe(during.cash);
      expect(inner.fees.arslans!.received).toBeUndefined();
    }, 60_000);
  }

  it('an earlier fee pending but unreceived: shows both possibilities, then pays the actual 6750 once', () => {
    const { s, inner, drain, shorten, replace, first } = setup();
    shorten(first);
    drain(() => first.status === 'kept');
    expect(first.pendingFee).toBe(6750);
    const second = replace(9100);
    const v = view(s);
    expect(v.placements[0]!.feeOutlook).toMatchObject({ restIfKept: 6750, settled: false, awaited: true });
    const words = placementStakes(v, v.placements[1]!)[1]!;
    expect(words).toContain('trial result has not reached you yet.');
    expect(words).toContain('it owes the other ₺6,750 under the earlier terms');
    expect(words).toContain('If not, it pays the other ₺6,850 after the new trial, if the new worker stays.');
    expect(words).not.toMatch(/^If the family keeps the worker, it pays the other ₺6,850/);
    const offer = feeWords(terms(9100), feeLedgerFor(v, 'arslans'));
    expect(offer).toContain('₺6,750 under the earlier terms');
    // Answering the earlier verdict credits the actual pending amount once and records the receipt.
    drain(() => first.pendingFee === 0);
    const paid = view(s);
    expect(paid.cash - v.cash).toBe(6750);
    expect(inner.fees.arslans!.received).toBe(true);
    expect(paid.placements[1]!.feeOutlook).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
    // The replacement's own kept verdict adds nothing, before or after it is reported.
    shorten(second);
    drain(() => second.status === 'kept');
    expect(second.pendingFee).toBe(0);
    expect(view(s).placements[1]!.feeOutlook).toEqual(paid.placements[1]!.feeOutlook);
    drain(() => second.reportedStatus === 'kept');
    expect(second.reportedStatus).toBe('kept');
    expect(view(s).cash).toBe(paid.cash);
  }, 60_000);

  it('a zero-fee replacement still shows the earlier unpaid 6750 and its condition, then pays it once', () => {
    const { s, inner, drain, shorten, replace, first } = setup();
    shorten(first);
    drain(() => first.status === 'kept');
    const before = view(s);
    const second = replace(0);
    const v = view(s);
    // The private kept verdict is not named; both possibilities are.
    const offer = feeWords(terms(0), feeLedgerFor(v, 'arslans'));
    expect(offer).toContain('No new agency fee is due under these terms.');
    expect(offer).toContain('it owes the other ₺6,750 under the earlier terms');
    expect(offer).toContain('If not, nothing more is due after the new trial.');
    expect(offer).not.toMatch(/^No agency fee is due\.$/);
    const words = placementStakes(v, v.placements[1]!)[1]!;
    expect(words).toContain('No new agency fee is due under these terms.');
    expect(words).toContain('it owes the other ₺6,750 under the earlier terms');
    expect(words).not.toMatch(/was kept|has kept/);
    expect(v.cash).toBe(before.cash);
    // Answering the old call credits 6750 once; the zero-fee replacement adds nothing.
    drain(() => first.pendingFee === 0);
    const paid = view(s);
    expect(paid.cash - v.cash).toBe(6750);
    shorten(second);
    drain(() => second.status === 'kept');
    drain(() => second.reportedStatus === 'kept');
    expect(second.reportedStatus).toBe('kept');
    expect(view(s).cash).toBe(paid.cash);
    expect(inner.fees.arslans!.received).toBe(true);
  }, 60_000);
});

describe('R7 F-2187 the City view is read at the inspection pace', () => {
  it('slows the clock for a waiting person while the City view is open, and keeps every other pace', () => {
    const s = newGame(1);
    const v = view(s);
    expect(v.bench.length).toBeGreaterThan(0);
    const closed = { sheet: false, tab: 'Families', selected: null, city: false };
    // Same View, same contract: only the reading state differs.
    expect(automaticPace(v, isInspecting(closed))).toBe(2);
    expect(automaticPace(v, isInspecting({ ...closed, city: true }))).toBe(0.5);
    expect(automaticPace(v, isInspecting({ ...closed, sheet: true }))).toBe(0.5);
    // With nobody waiting, there is nothing to read: the City view does not change the quiet pace.
    expect(automaticPace({ ...v, bench: [] }, isInspecting({ ...closed, city: true }))).toBe(20);
    // A conversation or a ringing phone still holds the clock whatever is on screen.
    expect(automaticPace({ ...v, phoneRinging: {} as never }, isInspecting({ ...closed, city: true }))).toBe(
      0,
    );
  });
});

describe('R7 F-2190 only a time the player was given', () => {
  it('names the callback a worker asked for, and nothing invented otherwise', () => {
    const s = newGame(1);
    apply(s, { type: 'take-number', candidate: 'sevda' });
    const generic = find(s, 'sevda');
    expect(generic.interviewUnavailable).toContain('is away');
    expect(awayWords(generic)).toBe(generic.interviewUnavailable);
    expect(awayWords(generic)).not.toMatch(/\d\d:\d\d/);
    // FIXTURE, manual setup: four interviews are not played here. The worker asked for a callback in two hours.
    const inner = s as unknown as {
      now: number;
      cards: Record<string, { interviewCount: number; interviewUntil: number }>;
    };
    inner.cards.sevda!.interviewCount = 4;
    inner.cards.sevda!.interviewUntil = inner.now + 120;
    const asked = view(structuredClone(s)).books.find((c) => c.id === 'sevda')!;
    expect(asked.interviewAfter).toBe(inner.now + 120);
    const words = awayWords(asked)!;
    expect(words).toContain('Call back after');
    expect(words).toContain(clockLabels(inner.now + 120).timeLabel);
    expect(words).toContain('allow time for the journey');
  });
});

describe('R8 F-2185 equivalent wording keeps what each speaker claims', () => {
  it('keeps listened and argued, and the repeated-instructions circumstance, in every employer variant', () => {
    for (const [good, bad] of REFERENCE_WORDINGS.patient) {
      expect(good).toMatch(/listened/);
      expect(good).not.toMatch(/argued|complain|without/);
      expect(bad).toMatch(/argued/);
      expect(bad).not.toMatch(/listened|complain|without/);
      for (const line of [good, bad]) expect(line).toMatch(/instructions were repeated/);
    }
    // Every topic has the same number of good and bad wordings, with the same worker placeholder.
    for (const pairs of Object.values(REFERENCE_WORDINGS))
      for (const [good, bad] of pairs) expect([good, bad].every((l) => l.includes('{worker}'))).toBe(true);
  });
  it('words two workers differently for the same event, with the same follow-up outcome', () => {
    const a = patienceThenReference(4, 'gul');
    const b = patienceThenReference(4, 'sevda');
    const claim = (s: ReturnType<typeof newGame>, id: string) =>
      find(s, id).notes.findLast((n) => n.source === 'heard' && n.quality === 'patient')!.claim ?? '';
    expect(claim(a, 'gul')).not.toBe(claim(b, 'sevda'));
    // Routing through the actual follow-up: a praising claim gets the good reply, a blaming claim the bad one.
    const parity = (key: string) => [...key].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 2, 0);
    for (const c of CANDIDATES.slice(0, 8))
      for (const topic of ['patient', 'honest', 'reliable', 'leaving'] as const) {
        const choice = {
          patient: 'ref-patient',
          honest: 'ref-honest',
          reliable: 'ref-reliable',
          leaving: 'ref-leaving',
        }[topic];
        const [good, bad] = REFERENCE_WORDINGS[topic][parity(c.id)]!.map((l) =>
          l.replaceAll('{worker}', c.name),
        );
        const replies = DISPUTE_REPLIES[parity(`${c.id}:reply`)]![topic];
        expect(referenceFollowUp(c.id, 'Employer', good!, choice).reply).toBe(replies[0]);
        expect(referenceFollowUp(c.id, 'Employer', bad!, choice).reply).toBe(replies[1]);
      }
  });
  it('gives each worker a dispute reply that matches the outcome, in either wording', () => {
    for (const set of DISPUTE_REPLIES) {
      expect(set.patient[0]).toMatch(/listened/);
      expect(set.patient[1]).toMatch(/argued/);
      expect(set.reliable[1]).toMatch(/should have called/);
      for (const [good, bad] of [set.patient, set.honest, set.reliable, set.leaving])
        expect(good).not.toBe(bad);
    }
    expect(DISPUTE_REPLIES).toHaveLength(2);
  });
});

describe('R8 F-2185 family needs keep the same need in different words', () => {
  const KEY: Record<string, RegExp[]> = {
    patient: [/patient/, /frustrated|throws a plate/, /repeats|understood/],
    discreet: [/private/, /visitors/i],
    warm: [/directly/, /person receiving help|speak/],
    hardworking: [/extra tasks/, /keep working/],
    reliable: [/arrive at the agreed time/],
    honest: [/shopping change/, /receipts/],
  };
  it('keeps role, pressure and every fact, while no two families of one role and pressure repeat a sentence', () => {
    const seen = new Map<string, string>();
    for (const f of FAMILIES) {
      expect(f.wants.startsWith(`We need a ${f.role}`)).toBe(true);
      for (const re of KEY[f.pressure]!) expect(f.wants).toMatch(re);
      const key = `${f.role}:${f.pressure}`;
      if (seen.has(key)) expect(f.wants).not.toBe(seen.get(key));
      else seen.set(key, f.wants);
    }
    expect(new Set(FAMILIES.filter((f) => f.pressure === 'reliable').map((f) => f.wants)).size).toBe(3);
  });
});

describe('R8 GH-R7-1 a failed or abandoned startup gives the retry back', () => {
  const button = (isConnected = true) => ({
    disabled: false,
    textContent: OPEN_OFFICE as string | null,
    isConnected,
  });
  it('shows opening while it prepares, restores the retry when startup ends on the same title, and leaves other states alone', () => {
    const b = button();
    startOpening(b, true);
    expect(b).toMatchObject({ disabled: true, textContent: OPENING_OFFICE });
    // Another startup took over (a newer generation): keep waiting, do not offer a second start.
    settleOpening(b, true);
    expect(b.disabled).toBe(true);
    // Failure or abort on the same title: the retry works again and says so plainly.
    settleOpening(b, false);
    expect(b).toMatchObject({ disabled: false, textContent: OPEN_OFFICE });
    // The title was replaced (the office opened, or a retained opening was offered): nothing is touched.
    const gone = button(false);
    startOpening(gone, true);
    settleOpening(gone, false);
    expect(gone).toMatchObject({ disabled: true, textContent: OPENING_OFFICE });
    // Startup will not begin (file mode, no storage, or already opening): the label does not change.
    const idle = button();
    startOpening(idle, false);
    expect(idle).toMatchObject({ disabled: false, textContent: OPEN_OFFICE });
  });
});
