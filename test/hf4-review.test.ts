import { exportRun as archive, replay as frameworkReplay } from '@adam0white/human-framework';
import { expect, test } from 'vitest';
import { applyGuest } from '../src/sim/guests.ts';
import { bindFramework, decide, runFor, saveFramework, schedulePlacement, tick } from '../src/sim/hf4.ts';
import type { HostState } from '../src/sim/hf4-host.ts';
import { apply, newGame } from '../src/sim/index.ts';

test('withdrawing a placement interrupts its admitted shift', () => {
  const state = newGame(7);
  const worker = state.people.gul!;
  const placement = { id: 'test-placement', candidate: 'gul', family: 'arslans', status: 'trial', story: [] };
  (state.placements as unknown[]).push(placement);
  schedulePlacement(worker, state.now, 120, { skill: 'childcare', psychological: { autonomy: 0.1 } });
  tick(worker, state.now + 1);
  saveFramework(state);
  expect(
    (state.hf4 as { host: HostState }).host.active.some(
      (a) => a.person === 'gul' && a.offer.actionId === 'placement-work',
    ),
  ).toBe(true);
  state.scene = {
    id: 'test-scene',
    kind: 'two-sides',
    title: 'Test',
    with: 'arslans',
    lines: [],
    choices: [{ id: 'withdraw', label: 'Withdraw' }],
    canLeave: true,
  };
  (state.scenePlacements as Record<string, string>)['test-scene'] = placement.id;
  apply(state, { type: 'choose', scene: 'test-scene', choice: 'withdraw' });
  saveFramework(state);
  const host = (state.hf4 as { host: HostState }).host;
  expect(host.active.some((a) => a.person === 'gul' && a.offer.actionId === 'placement-work')).toBe(false);
  const receipt = archive(runFor(state))
    .history.flatMap((t) => t.inputs)
    .find(
      (i) =>
        i.kind === 'action.resolved' &&
        i.payload.outcome?.actionId === 'placement-work' &&
        i.payload.disposition === 'interrupted',
    );
  expect(receipt?.kind).toBe('action.resolved');
  if (receipt?.kind === 'action.resolved') expect(receipt.payload.outcome?.actual.practice).toBeUndefined();
  expect(
    host.completed.some(
      (a) => a.person === 'gul' && a.actionId === 'placement-work' && a.status === 'interrupted',
    ),
  ).toBe(true);
}, 60000);

test('direct withdrawal interrupts an admitted shift', () => {
  const state = newGame(7);
  const worker = state.people.gul!;
  (state.placements as unknown[]).push({
    id: 'direct',
    candidate: 'gul',
    family: 'arslans',
    status: 'trial',
    story: [],
  });
  schedulePlacement(worker, state.now, 120, { skill: 'childcare' });
  tick(worker, state.now + 1);
  saveFramework(state);
  apply(state, { type: 'withdraw', placement: 'direct' });
  saveFramework(state);
  const host = (state.hf4 as { host: HostState }).host;
  expect(host.active.some((a) => a.person === 'gul' && a.offer.actionId === 'placement-work')).toBe(false);
  expect(
    host.completed.some(
      (a) => a.person === 'gul' && a.actionId === 'placement-work' && a.status === 'interrupted',
    ),
  ).toBe(true);
  const restored = structuredClone(state);
  bindFramework(restored);
  tick(restored.people.gul!, state.now + 130);
  saveFramework(restored);
  expect(
    (restored.hf4 as { host: HostState }).host.completed.some(
      (a) => a.person === 'gul' && a.actionId === 'placement-work' && a.status === 'completed',
    ),
  ).toBe(false);
}, 60000);

test('an accepted guest trial completes its actual duty', () => {
  const state = newGame(7);
  const guest = (
    state as unknown as { guests: { id: string; status: string; trial?: { verdict: string } }[] }
  ).guests.find((g) => g.id === 'zeynep-pass')!;
  guest.status = 'available';
  tick(state.people.gul!, 540);
  state.now = 540;
  applyGuest(state, { type: 'guest-action', guest: 'zeynep-pass', action: 'offer-trial' });
  expect(guest.trial?.verdict).toBe('assented');
  const actor = state.people['zeynep-pass']!;
  const duty = actor.agenda.commitments.find((c) => c.kind === 'duty')!;
  expect(duty).toBeDefined();
  tick(actor, state.now + 91);
  const completed = archive(runFor(state))
    .history.flatMap((t) => t.inputs)
    .find(
      (i) =>
        i.kind === 'action.resolved' &&
        i.payload.outcome?.actionId === 'cold-food-trial' &&
        i.payload.disposition === 'completed',
    );
  expect(completed?.kind).toBe('action.resolved');
  if (completed?.kind === 'action.resolved') expect(completed.payload.outcome?.fulfills).toContain(duty.id);
  expect(actor.agenda.commitments.find((c) => c.id === duty.id)?.status).toBe('kept');
}, 60000);

test('ending with an accepted meal records interruption and permits a cast checkpoint', async () => {
  const state = newGame(7);
  const person = state.people.nermin!;
  decide(person, [
    { id: 'ending-meal', action: 'eat', label: 'Dinner', duration: 20, effort: 0, advertises: { food: 0.6 } },
  ]);
  saveFramework(state);
  expect(
    (state.hf4 as { host: HostState }).host.active.some(
      (a) => a.person === 'nermin' && a.offer.id === 'ending-meal',
    ),
  ).toBe(true);
  // Test-only world overlay uses the ordinary second-rent decision as a bounded ending.
  state.cash = 0;
  state.missedRent = 1;
  state.scene = {
    id: 'ending-rent',
    kind: 'rent',
    title: 'Rent',
    with: 'hüsnü',
    lines: [],
    choices: [{ id: 'promise', label: 'Promise' }],
    canLeave: false,
  };
  apply(state, { type: 'choose', scene: 'ending-rent', choice: 'promise' });
  expect(state.ended).toBe(true);
  apply(state, { type: 'pause-cast' });
  expect(state.castPaused).toBe(true);
  saveFramework(state);
  const receipt = archive(runFor(state))
    .history.flatMap((t) => t.inputs)
    .find(
      (i) =>
        i.kind === 'action.resolved' &&
        i.payload.outcome?.offerId === 'ending-meal' &&
        i.payload.disposition === 'interrupted',
    );
  expect(receipt?.kind).toBe('action.resolved');
  if (receipt?.kind === 'action.resolved') expect(receipt.payload.outcome?.actual.consumed).toBeUndefined();
  const { agencyTransfer } = await import('../src/sim/cast-chapter.ts');
  expect(await agencyTransfer(state, 'nermin')).toBeDefined();
  const restored = structuredClone(state);
  bindFramework(restored);
  expect((restored.hf4 as { host: HostState }).host).toEqual((state.hf4 as { host: HostState }).host);
  const source = archive(runFor(state));
  const replayed = frameworkReplay(source);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.value.fullHash).toBe(source.hashes.full);
}, 60000);

test('a calm household call records its actual social observation in HF and replays it', () => {
  const state = newGame(7);
  const initialMood = state.people['arslans-0']!.affect.mood.valence;
  apply(state, { type: 'call-household', family: 'arslans', member: 'arslans-0', topic: 'smooth' });
  expect(state.people['arslans-0']!.affect.mood.valence).toBeGreaterThan(initialMood);
  saveFramework(state);
  const source = archive(runFor(state));
  const observations = source.history
    .flatMap((t) => t.inputs)
    .filter((i) => i.kind === 'observation.received' && i.payload.person === 'arslans-0');
  expect(
    observations.some(
      (i) =>
        i.kind === 'observation.received' &&
        i.payload.percepts.some((p) => p.summary === 'Nermin spoke calmly about settling the disagreement.'),
    ),
  ).toBe(true);
  const replayed = frameworkReplay(source);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.value.fullHash).toBe(source.hashes.full);
}, 60000);
