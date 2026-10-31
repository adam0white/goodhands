import { describe, expect, it } from 'vitest';
import { apply, newGame, view } from '../src/sim/index.ts';
import type { Note } from '../src/sim/types.ts';
import { answerFromReadings } from '../src/sim/voices.ts';
import {
  awayWords,
  clockLabels,
  feeLedgerFor,
  feeWords,
  placementStakes,
  readingBasis,
} from '../src/ui/render.ts';

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

type Sim = ReturnType<typeof newGame>;
/** The ordinary loop: close a scene, answer the phone, sleep at the day card, otherwise wait for the next event. */
function drainState(s: Sim, done: () => boolean) {
  for (let i = 0; i < 40 && !done(); i++) {
    const v = view(s);
    if (v.scene) apply(s, { type: 'close-scene', scene: v.scene.id });
    else if (v.phoneRinging) apply(s, { type: 'answer-phone' });
    else if (v.dayCard) apply(s, { type: 'sleep' });
    else apply(s, { type: 'wait-for' });
  }
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
      'Özlem Koç’s account counts for more than Hale Erol’s, because she trusted Özlem Koç’s word more when she heard it.',
    );
    expect(trusted).not.toMatch(/own answer counts (least|for less)/);
    const unmoved = readingBasis([
      note('heard', 'Hale Erol', { moved: false }),
      note('says', 'Özlem Koç', {}),
    ]);
    expect(unmoved).toContain('Hale Erol’s account did not visibly change her reading.');
    // No unchanged-estimate case may invent a cause: a rounded estimate also stays put for a trusted corroborating report.
    expect(unmoved).not.toMatch(/because she does not trust/);
    // One account never says "Together"; it states what that one account amounts to. Several keep their wording.
    for (const [read, words] of [
      ['yes', 'This is enough for her to believe it.'],
      ['no', 'This is enough for her to doubt it.'],
      ['maybe', 'This is not clear enough, so she stays unsure.'],
    ] as const) {
      const one = readingBasis([note('heard', 'Hale Erol', { read })]);
      expect(one).toContain(words);
      expect(one).not.toContain('Together');
    }
    expect(unmoved).toContain('Together they are not clear enough, so she stays unsure.');
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

  it('keeps a received fee received through withdrawal and a replacement on a changed wage', () => {
    // FIXTURE, manual setup: the first trial is shortened and given one good moment so the real verdict, answer-phone,
    // receipt, withdraw and place code run. Not a played trial week. The replacement's own overnight verdict is covered
    // once, by the pending 6750 / new 9100 case below, not repeated here.
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
    const first = inner.placements[0]!;
    first.trialEnds = inner.now + 1;
    first.moments.push({ day: 0, quality: 'patient', good: true, text: 'fixture' });
    drainState(s, () => first.status === 'kept' && first.pendingFee === 0);
    expect(view(s).placements[0]!.feeOutlook!.settled).toBe(true);
    const cashAfterReceipt = view(s).cash;
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
    expect(inner.placements).toHaveLength(2);
    const during = view(s);
    expect(during.placements.at(-1)!.feeOutlook).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
    expect(placementStakes(during, during.placements.at(-1)!)[1]).toContain('already paid its fee in full');
    expect(during.cash).toBe(cashAfterReceipt);
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
  // withdraw and place code run. Not a played trial week and not a full journey. Crossing a real night costs about
  // 20 s locally and more on CI, so only the pending 6750 / new 9100 case below crosses one (with its own explicit allowance); the
  // others stop at the offer, the words and the receipt, which need no overnight.
  const start = (firstFee?: number) => {
    const s = newGame(1);
    apply(s, { type: 'place', candidate: 'pinar', family: 'arslans', vouch: [] });
    if (firstFee !== undefined)
      apply(s, { type: 'propose-terms', scene: view(s).scene!.id, terms: terms(firstFee) });
    apply(s, { type: 'choose', scene: view(s).scene!.id, choice: 'accept-terms' });
    apply(s, { type: 'close-scene', scene: view(s).scene!.id });
    const inner = s as unknown as Inner;
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
    return { s, inner, shorten, replace, first: inner.placements[0]! };
  };

  for (const fee of [1000, 0]) {
    it(`original fee ${fee}: a reported kept verdict finishes the fee, so a replacement offers no new fee`, () => {
      const { s, inner, shorten, replace, first } = start(fee);
      expect(inner.fees.arslans!.deposit).toBe(fee);
      shorten(first);
      const before = view(s);
      drainState(s, () => first.status === 'kept');
      // The private kept verdict changes neither the public outlook nor its words.
      const secret = view(s);
      expect(secret.placements[0]!.feeOutlook).toEqual(before.placements[0]!.feeOutlook);
      expect(placementStakes(secret, secret.placements[0]!)).toEqual(
        placementStakes(before, before.placements[0]!),
      );
      drainState(s, () => first.reportedStatus === 'kept');
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
      replace(9000);
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
      expect(during.cash).toBe(told.cash);
      expect(inner.fees.arslans!.received).toBeUndefined();
    }, 60_000);
  }

  it('zero new fee: still names the earlier unpaid 6750 and its condition, then the actual first receipt is credited once', () => {
    const { s, inner, shorten, replace, first } = start();
    shorten(first);
    drainState(s, () => first.status === 'kept');
    expect(first.status).toBe('kept');
    const before = view(s);
    replace(0);
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
    drainState(s, () => first.pendingFee === 0);
    expect(first.pendingFee).toBe(0);
    expect(view(s).cash - v.cash).toBe(6750);
    expect(inner.fees.arslans!.received).toBe(true);
  }, 60_000);

  // The one case that crosses a real night. Positive replacement terms (new 9100) after the earlier 6750 is received:
  // the replacement's own verdict would compute a positive rest (9100 - 2250 = 6850) if the family's `second` flag
  // were not honoured (src/sim/index.ts, the verdict loop: `kept && !fee.second`), so a double credit fails the cash
  // assertions below. Locally about 40 s; the CI runner took 2-3 times as long, so it uses the existing global 180 s
  // allowance (as the normal script sets) instead of a 60 s cap.
  it('an earlier fee pending but unreceived: shows both possibilities, pays the actual 6750 once, and the new 9100 replacement verdict adds nothing', () => {
    const { s, inner, shorten, replace, first } = start();
    shorten(first);
    drainState(s, () => first.status === 'kept');
    expect(first.status).toBe('kept');
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
    drainState(s, () => first.pendingFee === 0);
    expect(first.pendingFee).toBe(0);
    const paid = view(s);
    expect(paid.cash - v.cash).toBe(6750);
    expect(inner.fees.arslans!.received).toBe(true);
    expect(paid.placements[1]!.feeOutlook).toEqual({ depositPaid: 2250, restIfKept: 0, settled: true });
    // The replacement trial now crosses the real night. Its verdict is private first, then told.
    shorten(second);
    drainState(s, () => second.status === 'kept');
    expect(second.status).toBe('kept');
    expect(second.reportedStatus).not.toBe('kept');
    expect(view(s).placements[1]!.status).toBe('trial');
    expect(second.pendingFee).toBe(0);
    expect(view(s).cash).toBe(paid.cash);
    expect(view(s).placements[1]!.feeOutlook).toEqual(paid.placements[1]!.feeOutlook);
    drainState(s, () => second.reportedStatus === 'kept');
    expect(second.reportedStatus).toBe('kept');
    expect(view(s).placements[1]!.status).toBe('kept');
    expect(view(s).cash).toBe(paid.cash);
    expect(inner.fees.arslans!.received).toBe(true);
  }, 180_000);
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
