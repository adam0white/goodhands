import { readFileSync } from 'node:fs';
import type { CalendarPersonaSnapshot, PersonaProjectionSnapshot } from '@adam0white/human-framework-legacy3';
import { projectPersona, snapshot } from '@adam0white/human-framework-legacy3';
import { canonicalPersona, createPersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import * as v4 from '../src/sim/v4/index.ts';
import {
  advance,
  apply,
  exportGuest,
  fingerprint,
  freshGuest,
  newGame,
  prepareGuest,
  replay,
  view,
} from '../src/sim/v6/index.ts';

const base = (p: PersonaProjectionSnapshot | CalendarPersonaSnapshot) =>
  p.format === 'hf-persona-calendar/1' ? p.person : p;

import { type ContinuityBook, continuityRow } from '../src/sim/v6/continuity.ts';
import {
  compactRun,
  exportRun,
  guestCheckpointTransfer,
  validateContinuity,
  verifyImport,
} from '../src/sim/v6/export.ts';

function runTo(s: ReturnType<typeof newGame>, at: number) {
  while (s.now < at) advance(s, Math.min(60, at - s.now));
}
function trial(seed: number, level: number, arm: 'fresh' | 'biography' | 'continuing') {
  const a = freshGuest('zeynep-pass', 19);
  a.arm = arm;
  if (arm !== 'fresh')
    a.history = [
      {
        id: 'attended-work',
        summary: 'Prepared cold dishes during an attended school-canteen shift.',
        at: a.person.now,
        sourceGame: 'pass',
        sourceEpisodeId: 'fixture-work',
      },
    ];
  a.person.skills.cold!.level = level;
  const s = newGame(seed, 6, [a]);
  runTo(s, 2010);
  apply(s, { type: 'guest-action', guest: 'zeynep-pass', action: 'offer-trial' });
  return { s, a, result: view(s).guests!.find((g) => g.id === 'zeynep-pass')!.trial! };
}
describe('historical HF3 one cast guest edition', () => {
  it('keeps the historical Pass fixture inspectable but refuses it as the expanded cast edition', async () => {
    const transfer = JSON.parse(
      readFileSync(new URL('./fixtures/pass-departure.json', import.meta.url), 'utf8'),
    );
    const envelope = await createPersona({
      format: 'hf-persona/1',
      castId: 'hf.cast.zeynep.pass',
      castRevision: '1',
      branchId: 'actual-pass-seed42',
      parentRevision: null,
      source: { game: 'pass', build: 'historical-fixture', engine: '2.14.1', rules: '12' },
      transfer,
      limitations: transfer.person.limitations,
    });
    await expect(prepareGuest(envelope)).rejects.toThrow(/This saved version of the person is not supported/);
    expect(transfer.person.skills.cold).toBeDefined();
  });

  it('retains exact version four behavior', () => {
    const s = newGame(44, 4);
    const frozen = v4.newGame(44);
    advance(s, 20);
    v4.advance(frozen, 20);
    expect(s).toEqual(frozen);
    expect(view(s)).toEqual(v4.view(frozen));
  });
  it('delays guests beyond the ordinary opening and keeps separate identities', () => {
    const s = newGame(1);
    expect(view(s).guests).toEqual([]);
    expect(s.people['tass-2']).toBeUndefined();
    expect(s.people['tass-0']!.name).not.toBe('Halil');
    expect(s.people['zeynep-pass']!.name).toBe('Zeynep');
    runTo(s, 2010);
    expect(view(s).guests!.map((g) => g.id)).toEqual(['zeynep-pass']);
    expect(s.people['zeynep-pass']!.agenda.commitments[0]).toMatchObject({
      toId: 'sons',
      targetId: 'home',
      importance: 0.7,
      recurEvery: 1440,
      from: 2730,
      until: 2770,
    });
  });
  it('asks HF for assent, uses only cold skill, and replays pinned admission', () => {
    const { s, a, result } = trial(9, 0.9, 'continuing');
    expect(result.verdict).toBe('assented');
    expect(result.chance).toBeGreaterThan(0.8);
    expect(s.people['zeynep-pass']!.skills.cooking).toBeUndefined();
    runTo(s, 2100);
    const r = replay(s.seed, s.inputs, s.now, 6, [a]);
    expect(fingerprint(r)).toBe(fingerprint(s));
  });
  it('measures matched target seeds fresh / biography / continuing', () => {
    const counts = { fresh: 0, biography: 0, continuing: 0 };
    const chances: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++)
      for (const arm of ['fresh', 'biography', 'continuing'] as const) {
        const { result } = trial(seed, arm === 'continuing' ? 0.9 : 0.7, arm);
        expect(result.verdict).toBe('assented');
        counts[arm] += Number(result.succeeded);
        chances[arm] = result.chance!;
      }
    console.info('matched target seed cold trial', { counts, chances, n: 12 });
    expect(counts.fresh).toBe(counts.biography);
    expect(chances.continuing).toBeGreaterThan(chances.biography!);
  });
  it('returns only an actual attended encounter with checkpoint digest', async () => {
    const { s } = trial(9, 0.9, 'continuing');
    await expect(exportGuest(s, 'zeynep-pass')).rejects.toThrow(
      /Finish the guest’s visit before exporting this person/,
    );
    runTo(s, 2100);
    const out = await exportGuest(s, 'zeynep-pass');
    expect(out.checkpoint.checkpointDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(base(out.projection).skills)).toEqual(['cold']);
    expect(out.history.at(-1)!.summary).toMatch(/cold dishes/);
    expect(base(out.projection).episodes[0]).toMatchObject({
      actorId: 'nermin-goodhands',
      targetId: 'zeynep',
    });
    expect(canonicalPersona(out)).not.toContain('trace');
    s.people['zeynep-pass']!.agenda.commitments.push({
      id: 'unsupported-duty',
      kind: 'duty',
      actions: ['other'],
      from: s.now,
      until: s.now + 30,
      importance: 0.5,
      status: 'pending',
    });
    await expect(exportGuest(s, 'zeynep-pass')).rejects.toThrow(
      /End the guest’s current agency duty before exporting this person/,
    );
  });
  it('preserves the cook as actor in her own completed work outcome', async () => {
    const { s } = trial(9, 0.9, 'continuing');
    runTo(s, 2100);
    const person = s.people['zeynep-pass']!;
    const outcome = person.memory.episodes.find(
      (e) => e.action === 'cold-food-trial' && e.actorId === 'zeynep-pass',
    );
    expect(outcome).toBeDefined();
    const guest = (s.guests as { id: string; encounterEpisode?: string }[]).find(
      (g) => g.id === 'zeynep-pass',
    )!;
    guest.encounterEpisode = outcome!.id;
    const out = await exportGuest(s, 'zeynep-pass');
    expect(base(out.projection).episodes[0]!.actorId).toBe('zeynep');
    expect(base(out.projection).episodes[0]!.targetId).toBe(outcome!.targetId);
  });
  it('keeps Selin office job and records enquiry without inventing a placement', async () => {
    const s = newGame(2);
    runTo(s, 2521);
    apply(s, { type: 'guest-action', guest: 'selin-voice', action: 'ask-service' });
    const g = view(s).guests!.find((g) => g.id === 'selin-voice')!;
    expect(g.status).toBe('complete');
    expect(g.text).toContain('cannot confirm');
    const out = await exportGuest(s, 'selin-voice');
    expect(base(out.projection).commitments[0]).toMatchObject({
      kind: 'job',
      actions: ['work'],
      importance: 0.8,
      recurEvery: 1440,
    });
    expect(out.history.at(-1)!.summary).toContain('no placement');
    expect(base(out.projection).episodes[0]).toMatchObject({
      action: 'selin-enquiry',
      actorId: 'nermin-goodhands',
      targetId: 'selin',
    });
    runTo(s, 3420);
    expect(s.people['selin-voice']!.activity?.action).toBe('voice-office-work');
    runTo(s, 3960);
    expect(
      s.people['selin-voice']!.agenda.commitments.some((c) => c.kind === 'job' && c.status === 'kept'),
    ).toBe(true);
  });
  it('strictly admits source projection and rejects unsupported skills and provenance', async () => {
    // Genuine HF2.21 generated unit control; not an actual foreign source journey.
    const legacy = JSON.parse(
      readFileSync(new URL('./fixtures/voice3-hf221-unit.json', import.meta.url), 'utf8'),
    );
    const source = legacy.source;
    const projection = legacy.projection;
    const e = source.memory.episodes.at(-1)!;
    const digest = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(snapshot(source)))),
      ),
    ]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    const body = {
      format: 'hf-persona/1' as const,
      castId: 'hf.cast.selin.voice',
      castRevision: '2',
      branchId: 'test-selin',
      parentRevision: null,
      source: { game: 'voice', build: 'historical-unit-hf221', engine: '2.21.0', rules: 'voice-3' },
      transfer: {
        person: projection,
        targetOpening: source.now % 1440,
        history: [
          { id: 'source-work', summary: e.summary, at: e.at, sourceGame: 'voice', sourceEpisodeId: e.id },
        ],
        checkpoint: {
          sourceSchema: source.schema,
          sourceNow: source.now,
          sourceRng: source.rng,
          checkpointDigest: digest,
        },
      },
      limitations: projection.limitations,
    };
    const envelope = await createPersona(body);
    const admission = await prepareGuest(envelope);
    const { revision, ...unsigned } = envelope;
    const claim = await createPersona({
      ...unsigned,
      parentRevision: revision,
      source: { game: 'goodhands', build: 'test', engine: '2.23.0', rules: 'goodhands-6' },
    });
    const book: ContinuityBook = {
      v: 1,
      arrivals: [{ source: envelope, claim, initial: admission, scope: 'file' }],
      heads: [claim],
      rows: [continuityRow(claim, 'admitted', 'file')],
    };
    const received = newGame(91, 6, [admission]);
    runTo(received, 2521);
    apply(received, { type: 'guest-action', guest: 'selin-voice', action: 'ask-service' });
    const full = exportRun(received, received.inputs, book);
    for (const exported of [full, compactRun(full)]) {
      const imported = verifyImport(JSON.stringify(exported));
      expect(imported.state).toEqual(received);
      expect(imported.continuity.heads).toEqual([claim]);
      expect(imported.continuity.arrivals[0]!.initial).toEqual(admission);
      await validateContinuity(imported.continuity);
    }
    const { revision: claimRevision, ...claimBody } = claim;
    const head = await createPersona({
      ...claimBody,
      parentRevision: claimRevision,
      transfer: await guestCheckpointTransfer(received, 'selin-voice', envelope),
    });
    book.heads = [head];
    book.rows.push(continuityRow(head, 'checkpoint', 'file'));
    const saved = verifyImport(JSON.stringify(exportRun(received, received.inputs, book)));
    await validateContinuity(saved.continuity, saved.state, saved.inputs);
    const { revision: _headRevision, ...headBody } = head;
    const altered = await createPersona({ ...headBody, transfer: { ...head.transfer, history: [] } });
    const invalid = structuredClone(book);
    invalid.heads = [altered];
    invalid.rows[1] = continuityRow(altered, 'checkpoint', 'file');
    await expect(validateContinuity(invalid, received, received.inputs)).rejects.toThrow(/source checkpoint/);
    expect(admission.person.id).toBe('selin-voice');
    expect(admission.person.will.voices.find((v) => v.voiceId === 'nermin')?.trust).toBe(0.5);
    const unhealthy = structuredClone(body);
    unhealthy.transfer.person.health.health = 0.5;
    await expect(prepareGuest(await createPersona(unhealthy))).rejects.toThrow(
      /The saved body state is not compatible with this game/,
    );
    const blocked = structuredClone(source);
    blocked.agenda.goals.push({
      id: 'project',
      label: 'Unfinished project',
      serves: ['achievement'],
      progress: 0,
      advancedBy: [{ action: 'work', amount: 0.2 }],
      importance: 0.6,
      status: 'active',
      adoptedAt: blocked.now,
    });
    expect(() => projectPersona(blocked, { version: 'voice-selin/1', skills: {} })).toThrow(/active goal/);
    const bad = structuredClone(body);
    bad.transfer.person.skills.office = { level: 0.6, practice: 0, lastPracticed: source.now };
    await expect(prepareGuest(await createPersona(bad))).rejects.toThrow(/skill/);
  });
});
