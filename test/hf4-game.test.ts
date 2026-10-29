import { appendFileSync, writeFileSync } from 'node:fs';
import { exportRun as frameworkArchive, replay as frameworkReplay } from '@adam0white/human-framework';
import { expect, test, vi } from 'vitest';
import * as hf4 from '../src/sim/hf4.ts';
import {
  bindFramework,
  decide,
  placementWorkForReport,
  promise,
  runFor,
  saveFramework,
  schedulePlacement,
  tick,
} from '../src/sim/hf4.ts';
import { authoredPerson } from '../src/sim/hf4-author.ts';
import {
  advance as advanceHost,
  type HostState,
  inputs as hostInputs,
  opening as openHost,
  restore as restoreHost,
  save as saveHost,
  type World,
  workForAccount,
} from '../src/sim/hf4-host.ts';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

// Synchronous file receipts remain visible while a long synchronous game action runs.
function progress(...values: unknown[]) {
  const target = process.env.GOODHANDS_PROGRESS_PATH;
  const line = values.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
  if (target) appendFileSync(target, line + '\n');
  else console.error(line);
}

function archiveBytes(archive: ReturnType<typeof frameworkArchive>) {
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
  let hostStateBytes = 0,
    hostStates = 0,
    inputs = 0;
  for (const transaction of archive.history)
    for (const input of transaction.inputs) {
      inputs++;
      const change =
        input.kind === 'world.changed'
          ? input.payload
          : input.kind === 'action.resolved' || input.kind === 'communication.resolved'
            ? input.payload.worldChange
            : undefined;
      if (change?.hostState !== undefined) {
        hostStates++;
        hostStateBytes += bytes(change.hostState);
      }
    }
  return {
    archiveBytes: bytes(archive),
    historyBytes: bytes(archive.history),
    currentCacheBytes: bytes(archive.current),
    hostStateBytes,
    hostStates,
    inputs,
    transactions: archive.history.length,
  };
}

test('the real current Gül interview uses one HF4 Run and both game files replay completely', () => {
  const state = newGame(7);
  expect(frameworkArchive(runFor(state)).engine.package).toBe('@adam0white/human-framework@4.7.0');
  apply(state, { type: 'interview', candidate: 'gul' });
  const scene = view(state).scene!;
  expect(scene.kind).toBe('interview');
  apply(state, { type: 'choose', scene: scene.id, choice: 'q-honest' });
  expect(view(state).scene!.lines.some((line) => line.kind === 'speech')).toBe(true);
  expect(
    [...view(state).bench, ...view(state).books]
      .find((p) => p.id === 'gul')!
      .notes.some((n) => n.quality === 'honest'),
  ).toBe(true);
  saveFramework(state);
  const archive = frameworkArchive(runFor(state));
  const checked = frameworkReplay(archive);
  expect(checked.ok).toBe(true);
  if (checked.ok) expect(checked.value.fullHash).toBe(archive.hashes.full);
  const full = exportRun(state, state.inputs);
  for (const file of [full, compactRun(full)]) {
    const loaded = verifyImport(JSON.stringify(file));
    expect(loaded.state).toEqual(state);
    expect(fingerprint(loaded.state)).toBe(fingerprint(state));
  }
}, 180000);

test('the same-seed current waiting control retains complete ordered game replay', () => {
  const state = newGame(7);
  advance(state, 10);
  expect(view(state).scene).toBeNull();
  const copy = replay(7, state.inputs, state.now);
  expect(copy).toEqual(state);
}, 180000);

test('placement work is admitted and survives a game checkpoint', () => {
  const state = newGame(7);
  const worker = state.people.gul!;
  (state.placements as unknown[]).push({ candidate: 'gul', status: 'trial' });
  schedulePlacement(worker, state.now, 10, {
    skill: 'childcare',
    psychological: { autonomy: 0.025, safety: 0.018 },
  });
  tick(worker, state.now + 1);
  saveFramework(state);
  const active = (state.hf4 as { host: HostState }).host.active.find(
    (a) => a.person === 'gul' && a.offer.actionId === 'placement-work',
  );
  expect(active?.offer.actionId).toBe('placement-work');
  expect(active?.offer.demands.skill?.id).toBe('childcare');
  const restored = structuredClone(state);
  bindFramework(restored);
  tick(worker, state.now + 95);
  tick(restored.people.gul!, state.now + 95);
  saveFramework(state);
  saveFramework(restored);
  expect(restored.hf4).toEqual(state.hf4);
  const forged = structuredClone(state);
  (forged.hf4 as { host: HostState }).host.completed[0]!.end++;
  expect(() => bindFramework(forged)).toThrow(/public receipts/);
  expect(
    (state.hf4 as { host: HostState }).host.completed.some(
      (a) => a.person === 'gul' && a.actionId === 'placement-work',
    ),
  ).toBe(true);
  const receipt = frameworkArchive(runFor(state))
    .history.flatMap((t) => t.inputs)
    .find(
      (i) =>
        i.kind === 'action.resolved' &&
        i.payload.person === 'gul' &&
        i.payload.outcome?.actionId === 'placement-work',
    );
  expect(receipt?.kind).toBe('action.resolved');
  if (receipt?.kind === 'action.resolved') {
    expect(receipt.payload.outcome?.actual.psychological).toEqual({ autonomy: 0.025, safety: 0.018 });
    expect(receipt.payload.outcome?.actual.practice).toEqual({ quality: 0.6 });
  }
  expect(worker.skills.childcare!.practice).toBeGreaterThan(0);
  expect(
    frameworkArchive(runFor(state))
      .history.flatMap((t) => t.inputs)
      .filter((i) => i.kind === 'action.resolved' && i.payload.person === 'gul'),
  ).toHaveLength(2);
  decide(worker, [
    {
      id: 'second-work',
      action: 'placement-work',
      label: 'A second household task',
      duration: 5,
      effort: 0,
      advertises: { competence: 0.5 },
    },
  ]);
  tick(worker, state.now + 155);
  saveFramework(state);
  expect(
    (state.hf4 as { host: HostState }).host.completed.filter(
      (a) => a.person === 'gul' && a.actionId === 'placement-work',
    ),
  ).toHaveLength(1);
  expect(
    frameworkArchive(runFor(state))
      .history.flatMap((t) => t.inputs)
      .filter((i) => i.kind === 'action.resolved' && i.payload.outcome?.actionId === 'placement-work'),
  ).toHaveLength(2);
}, 180000);

test('a real placement starts work at the next game boundary and survives JSON replay', () => {
  const state = newGame(1);
  if (process.env.GOODHANDS_PROGRESS) progress('opening ready', state.now);
  apply(state, { type: 'place', candidate: 'sevda', family: 'arslans', vouch: [] });
  if (process.env.GOODHANDS_PROGRESS) progress('negotiation ready', state.now);
  for (const choice of ['offer-wage', 'offer-hours', 'accept-terms']) {
    const scene = view(state).scene;
    if (process.env.GOODHANDS_PROGRESS) progress('choice', choice, state.now);
    if (scene?.kind === 'negotiation' && scene.choices.some((c) => c.id === choice && !c.disabled))
      apply(state, { type: 'choose', scene: scene.id, choice });
  }
  if (view(state).scene) apply(state, { type: 'close-scene', scene: view(state).scene!.id });
  expect(view(state).placements).toHaveLength(1);
  for (let i = 0; i < 100 && state.now < 1440 + 600; i++) {
    const current = view(state);
    if (current.scene) apply(state, { type: 'close-scene', scene: current.scene.id });
    else if (current.dayCard) apply(state, { type: 'sleep' });
    else advance(state, Math.min(60, 1440 + 600 - state.now));
    if (process.env.GOODHANDS_PROGRESS)
      progress(
        JSON.stringify({
          i,
          now: state.now,
          scene: view(state).scene?.kind,
          dayCard: !!view(state).dayCard,
          active: (state.hf4 as { host: HostState }).host.active.map((a) => [a.person, a.offer.actionId]),
          rss: process.memoryUsage().rss,
        }),
      );
  }
  expect(state.now).toBeGreaterThanOrEqual(1440 + 600);
  expect(
    (state.hf4 as { host: HostState }).host.active.some(
      (a) => a.person === 'sevda' && a.offer.actionId === 'placement-work',
    ),
  ).toBe(true);
  const file = JSON.stringify(exportRun(state, state.inputs));
  if (process.env.GOODHANDS_EXPORT_PATH) writeFileSync(process.env.GOODHANDS_EXPORT_PATH, file);
  if (process.env.GOODHANDS_PROGRESS)
    progress({
      stage: 'before placement import',
      now: state.now,
      bytes: Buffer.byteLength(file),
      engine: frameworkArchive(runFor(state)).engine,
      hashes: frameworkArchive(runFor(state)).hashes,
      archive: archiveBytes(frameworkArchive(runFor(state))),
    });
  expect(verifyImport(file).state).toEqual(state);
  if (process.env.GOODHANDS_PROGRESS) progress({ stage: 'placement import verified', now: state.now });
}, 420000);

test('a current cast passport admits retained history into a new current game', async () => {
  const { createPersona, initialPersonaLife, preparePersonaLife } = await import('@adam0white/lab-client');
  const { CAST } = await import('../src/sim/cast.ts');
  const { agencyTransfer, prepareAgencyChapter } = await import('../src/sim/cast-chapter.ts');
  const source = newGame(1);
  apply(source, { type: 'pause-cast' });
  const transfer = await agencyTransfer(source, 'nermin');
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: CAST.nermin.castId,
    castRevision: CAST.nermin.revision,
    branchId: 'nermin',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '4.7.0', rules: 'goodhands-hf4-2' },
    transfer: { ...transfer, life: initialPersonaLife(CAST.nermin.castId, 'nermin', 0) },
    limitations: [],
  });
  const chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
  const receiving = newGame(7, 6, chapter.guests, chapter);
  expect(receiving.castChapter).toEqual(chapter);
  const { emptyContinuity } = await import('../src/ui/continuity.ts');
  const book = emptyContinuity();
  book.chapter = chapter;
  book.initialClaims = [];
  const file = JSON.stringify(exportRun(receiving, receiving.inputs, book));
  expect(verifyImport(file).state).toEqual(receiving);
}, 180000);

test('a paused chapter does not start placement work', () => {
  const state = newGame(7);
  (state.placements as unknown[]).push({ candidate: 'gul', status: 'trial' });
  apply(state, { type: 'pause-cast' });
  expect(schedulePlacement(state.people.gul!, state.now, 10)).toBe(false);
}, 180000);

test('a guest receives completion even when another actor advances the shared run', async () => {
  const state = newGame(7);
  const guest = (
    state as unknown as { guests: { id: string; status: string; trial?: { succeeded: boolean } }[] }
  ).guests.find((g) => g.id === 'zeynep-pass')!;
  guest.status = 'available';
  guest.trial = { succeeded: true };
  const actor = state.people['zeynep-pass']!;
  promise(actor, {
    kind: 'duty',
    actions: ['cold-food-trial'],
    from: state.now,
    until: state.now + 5,
    importance: 0.6,
  });
  const duty = actor.agenda.commitments.find((c) => c.kind === 'duty')!;
  decide(state.people['zeynep-pass']!, [
    {
      id: 'shared-trial',
      fulfills: [duty.id],
      action: 'cold-food-trial',
      label: 'Prepare cold food',
      duration: 5,
      effort: 0.1,
      advertises: { competence: 0.4 },
      skill: { id: 'cold', difficulty: 0.65 },
    },
  ]);
  guest.status = 'working';
  tick(state.people.gul!, state.now + 6);
  state.now += 6;
  const { stepGuests } = await import('../src/sim/guests.ts');
  stepGuests(state);
  expect(guest.status).toBe('complete');
  expect(actor.agenda.commitments.find((c) => c.id === duty.id)?.status).toBe('kept');
  const completion = frameworkArchive(runFor(state))
    .history.flatMap((t) => t.inputs)
    .find((i) => i.kind === 'action.resolved' && i.payload.outcome?.actionId === 'cold-food-trial');
  if (completion?.kind === 'action.resolved') expect(completion.payload.outcome?.fulfills).toContain(duty.id);
  else throw new Error('Missing actual trial completion receipt');
}, 60000);

test('current games refuse legacy guest admissions before creating actors', () => {
  expect(() => newGame(7, 6, [{} as never])).toThrow('start a new game');
});

test('household work starts at the agreed hour before the ten oclock report', () => {
  const state = newGame(7);
  // A bounded host fixture represents a contract agreed before this opening.
  // It does not stand in for the separate negotiated-placement journey.
  (state.placements as unknown[]).push({
    id: 'agreed-opening',
    candidate: 'gul',
    family: 'arslans',
    role: 'nanny',
    status: 'trial',
    since: -1,
    terms: { startHour: 9, endHour: 13, dayOff: 6 },
    vouched: [],
    story: [],
    moments: [],
    reported: 0,
    confidenceGiven: false,
    wage: 8000,
    disagreement: true,
    pendingFee: 0,
    reportedStatus: 'trial',
  });
  state.now = 539;
  advance(state, 1);
  const host = (state.hf4 as { host: HostState }).host;
  const active = host.active.find((a) => a.person === 'gul' && a.offer.actionId === 'placement-work');
  expect(active?.startedAt).toBeGreaterThanOrEqual(540 * 60000);
  expect(active!.startedAt).toBeLessThan(541 * 60000);
  expect(active!.startedAt + active!.offer.durationMs).toBe(780 * 60000);
  expect((state.placements as { moments: unknown[] }[])[0]!.moments).toHaveLength(0);
  state.now = 599;
  advance(state, 1);
  expect((state.placements as { moments: unknown[] }[])[0]!.moments.length).toBeGreaterThan(0);
  tick(state.people.gul!, 781);
  saveFramework(state);
  expect(
    (state.hf4 as { host: HostState }).host.completed.find(
      (a) => a.person === 'gul' && a.actionId === 'placement-work' && a.status === 'completed',
    )?.end,
  ).toBe(780 * 60000);
}, 60000);

test('late work receives one next-morning account from its actual completion', () => {
  const state = newGame(7);
  const placement = {
    id: 'late-opening',
    candidate: 'gul',
    family: 'arslans',
    role: 'nanny',
    status: 'trial',
    since: -1,
    terms: { startHour: 11, endHour: 12, dayOff: 6 },
    vouched: [],
    story: [],
    moments: [] as { day: number }[],
    reported: 0,
    confidenceGiven: false,
    wage: 8000,
    disagreement: true,
    pendingFee: 0,
    reportedStatus: 'trial',
    lastWorkAccountStart: undefined as number | undefined,
  };
  (state.placements as unknown[]).push(placement);
  if (process.env.GOODHANDS_PROGRESS) progress('late opening ready', state.now);
  state.now = 599;
  advance(state, 1);
  expect(placement.moments).toHaveLength(0);
  state.now = 659;
  advance(state, 1);
  const active = (state.hf4 as { host: HostState }).host.active.find(
    (a) => a.person === 'gul' && a.offer.actionId === 'placement-work',
  )!;
  expect(active).toBeDefined();
  if (process.env.GOODHANDS_PROGRESS) progress('late work ready', state.now);
  tick(state.people.gul!, 721);
  saveFramework(state);
  expect(
    (state.hf4 as { host: HostState }).host.completed.some(
      (a) => a.person === 'gul' && a.actionId === 'placement-work' && a.status === 'completed',
    ),
  ).toBe(true);
  expect(placementWorkForReport(state.people.gul!, 2040, placement.since)).toEqual({
    start: active.startedAt,
  });
  if (process.env.GOODHANDS_PROGRESS) progress('late before morning account', state.now);
  state.now = 1440 + 599;
  advance(state, 1);
  if (process.env.GOODHANDS_PROGRESS)
    progress('late after morning account', state.now, placement.moments.length, {
      status: placement.status,
      marker: placement.lastWorkAccountStart,
      same: placement === (state.placements as unknown[])[0],
      selected: placementWorkForReport(state.people.gul!, 2040, placement.since),
      work: (state.hf4 as { host: HostState }).host.completed.filter(
        (a) => a.person === 'gul' && a.actionId === 'placement-work',
      ),
    });
  expect(placement.moments.length).toBeGreaterThan(0);
  expect(placement.lastWorkAccountStart).toBe(active.startedAt);
  expect(placement.moments.every((m) => m.day === 0)).toBe(true);
  const count = placement.moments.length;
  // Re-enter the same account boundary without inventing another completed shift.
  if (process.env.GOODHANDS_PROGRESS) progress('late before morning account', state.now);
  state.now = 1440 + 599;
  advance(state, 1);
  if (process.env.GOODHANDS_PROGRESS)
    progress('late after morning account', state.now, placement.moments.length, {
      status: placement.status,
      marker: placement.lastWorkAccountStart,
      same: placement === (state.placements as unknown[])[0],
      selected: placementWorkForReport(state.people.gul!, 2040, placement.since),
      work: (state.hf4 as { host: HostState }).host.completed.filter(
        (a) => a.person === 'gul' && a.actionId === 'placement-work',
      ),
    });
  expect(placement.moments).toHaveLength(count);
}, 60000);

test('account selection uses previous completed late work once and refuses invented work', () => {
  const host: HostState = {
    at: 2040 * 60000,
    serial: 0,
    revision: 0,
    active: [],
    completed: [
      {
        offerId: 'late',
        offerRevision: 0,
        person: 'gul',
        actionId: 'placement-work',
        start: 660 * 60000,
        end: 720 * 60000,
        status: 'completed',
      },
    ],
  };
  expect(workForAccount(host, 'gul', host.at, 0)).toEqual({ start: 660 * 60000 });
  expect(workForAccount(host, 'gul', host.at, 0, 660 * 60000)).toBeUndefined();
  expect(workForAccount({ ...host, completed: [] }, 'gul', host.at, 0)).toBeUndefined();
  expect(workForAccount(host, 'gul', host.at, 721 * 60000)).toBeUndefined();
});

test('same-time care uses one opening batch and preserves every actor receipt', () => {
  const state = newGame(1);
  tick(state.people.gul!, 720);
  saveFramework(state);
  const archive = frameworkArchive(runFor(state));
  expect(archiveBytes(archive).hostStateBytes).toBeLessThan(100000);
  const meals = archive.history.filter((t) =>
    t.inputs.some(
      (i) =>
        i.kind === 'offers.received' &&
        i.payload.offers.some((o) => o.id.startsWith('care:') && o.actionId === 'eat'),
    ),
  );
  expect(meals).toHaveLength(1);
  const people = Object.keys(state.people).sort();
  expect(
    meals[0]!.inputs
      .filter((i) => i.kind === 'decision.requested')
      .map((i) => i.payload.person)
      .sort(),
  ).toEqual(people);
  expect(
    (state.hf4 as { host: HostState }).host.active
      .filter((a) => a.offer.actionId === 'eat')
      .map((a) => a.person)
      .sort(),
  ).toEqual(people);
  tick(state.people.gul!, 741);
  saveFramework(state);
  expect(
    (state.hf4 as { host: HostState }).host.completed
      .filter((a) => a.actionId === 'eat' && a.status === 'completed')
      .map((a) => a.person)
      .sort(),
  ).toEqual(people);
  const nowArchive = frameworkArchive(runFor(state));
  expect(
    nowArchive.history
      .flatMap((t) => t.inputs)
      .filter((i) => i.kind === 'action.resolved' && i.payload.outcome?.actionId === 'eat'),
  ).toHaveLength(people.length);
  const restored = structuredClone(state);
  bindFramework(restored);
  expect(restored.hf4).toEqual(state.hf4);
  if (process.env.GOODHANDS_PROGRESS)
    progress({ stage: 'care cache verified', archive: archiveBytes(nowArchive) });
}, 60000);

test('host reconstruction preserves completed failed and interrupted actual receipts', () => {
  const source = newGame(1);
  const spec = structuredClone(
    frameworkArchive(runFor(source)).initial.spec,
  ) as import('@adam0white/human-framework').RunSpec;
  const people = ['gul', 'sevda', 'pinar'];
  const bridge = openHost(
    spec,
    people.map((id) => authoredPerson(id, id, 'female')),
  );
  const books = new Map<string, import('@adam0white/human-framework').Offer[]>();
  const offers = people.map((person) => ({
    id: `protocol:${person}`,
    person,
    actionId: 'placement-work',
    label: 'A household task',
    durationMs: 5 * 60000,
    participants: [],
    alongside: [],
    demands: { effort: 0, focus: 0, mode: 'awake' as const, requires: {} },
    tags: [],
    norms: [],
    expected: { needs: { competence: 0.8 }, followedBy: [], provenance: ['authored:protocol-control'] },
    fulfills: [],
    advances: [],
    diminishes: [],
  }));
  for (const offer of offers) books.set(offer.person, [offer]);
  const world: World = {
    canStart: () => true,
    finish(active, _at, interrupt) {
      return {
        disposition: interrupt ? 'interrupted' : active.person === 'sevda' ? 'failed' : 'completed',
        summary: 'The host recorded the actual task result.',
        actual: { exposures: [], observedProgress: [] },
      };
    },
    communicate: () => ({ emittedItemIds: [], received: [] }),
  };
  const commands: Parameters<typeof hostInputs>[2] = offers.flatMap((offer) => [
    { kind: 'offers.received' as const, payload: { person: offer.person, revision: 1, offers: [offer] } },
    {
      kind: 'decision.requested' as const,
      payload: {
        person: offer.person,
        reason: 'Ordinary household opportunity',
        treatment: 'ordinary' as const,
        offerRevision: 1,
      },
    },
  ]);
  const start = hostInputs(bridge, 510, commands);
  advanceHost(bridge, start[0]!.at, start, books, world);
  expect(bridge.host.active).toHaveLength(3);
  const close = hostInputs(
    bridge,
    510,
    people.map((person) => ({ kind: 'offers.received', payload: { person, revision: 2, offers: [] } })),
  );
  advanceHost(bridge, close[0]!.at, close, books, world);
  for (const person of people) books.set(person, []);
  const activeCheckpoint = saveHost(bridge);
  expect(restoreHost(activeCheckpoint).host).toEqual(bridge.host);
  const interrupted = bridge.host.active.find((a) => a.person === 'pinar')!;
  const stop = hostInputs(bridge, 511, [
    {
      kind: 'activity.interrupted',
      payload: { person: 'pinar', activityId: interrupted.id, reason: 'The household withdrew this task.' },
    },
  ]);
  advanceHost(bridge, stop[0]!.at, stop, books, world);
  advanceHost(bridge, 516 * 60000, [], books, world);
  expect(bridge.host.completed.map((a) => a.status).sort()).toEqual(['completed', 'failed', 'interrupted']);
  const checkpoint = saveHost(bridge);
  expect(restoreHost(checkpoint).host).toEqual(bridge.host);
  const statuses = checkpoint.run.history
    .flatMap((t) => t.inputs)
    .flatMap((i) => (i.kind === 'action.resolved' && i.payload.outcome ? [i.payload.outcome.status] : []));
  expect(statuses.sort()).toEqual(['completed', 'failed', 'interrupted']);
});

test('a meal at the agreed start does not lose the household shift', () => {
  const state = newGame(7);
  (state.placements as unknown[]).push({
    id: 'meal-conflict',
    candidate: 'gul',
    family: 'arslans',
    role: 'nanny',
    status: 'trial',
    since: -1,
    terms: { startHour: 12, endHour: 13, dayOff: 6 },
    vouched: [],
    story: [],
    moments: [],
    reported: 0,
    confidenceGiven: false,
    wage: 8000,
    disagreement: true,
    pendingFee: 0,
    reportedStatus: 'trial',
  });
  state.now = 719;
  advance(state, 1);
  expect(
    (state.hf4 as { host: HostState }).host.active.some(
      (a) => a.person === 'gul' && a.offer.actionId === 'eat',
    ),
  ).toBe(true);
  advance(state, 25);
  const host = (state.hf4 as { host: HostState }).host;
  const work = host.active.find((a) => a.person === 'gul' && a.offer.actionId === 'placement-work');
  expect(work).toBeDefined();
  expect(work!.startedAt).toBeGreaterThan(720 * 60000);
  expect(work!.startedAt + work!.offer.durationMs).toBe(780 * 60000);
  tick(state.people.gul!, 781);
  saveFramework(state);
  const completed = (state.hf4 as { host: HostState }).host.completed.filter(
    (a) => a.person === 'gul' && a.actionId === 'placement-work',
  );
  expect(completed).toHaveLength(1);
  expect(completed[0]!.end).toBe(780 * 60000);
  const decisions = frameworkArchive(runFor(state))
    .history.flatMap((t) => t.inputs)
    .filter(
      (i) =>
        i.kind === 'decision.requested' &&
        i.payload.person === 'gul' &&
        i.payload.reason === 'Scheduled Good Hands placement',
    );
  expect(decisions).toHaveLength(1);
}, 60000);

test('a refused delayed placement is not offered again', () => {
  const state = newGame(7);
  (state.placements as unknown[]).push({
    id: 'refused',
    candidate: 'gul',
    family: 'arslans',
    role: 'nanny',
    status: 'trial',
    since: -1,
    terms: { startHour: 12, endHour: 13, dayOff: 6 },
    vouched: [],
    story: [],
    moments: [],
    reported: 0,
    confidenceGiven: false,
    wage: 8000,
    disagreement: true,
    pendingFee: 0,
    reportedStatus: 'trial',
  });
  const refusal = vi.spyOn(hf4, 'schedulePlacement').mockReturnValue(false);
  try {
    state.now = 719;
    advance(state, 1);
    advance(state, 30);
    expect(refusal).toHaveBeenCalledTimes(1);
    expect((state.eventKeys as string[]).some((key) => key.startsWith('work-pending:refused:'))).toBe(false);
  } finally {
    refusal.mockRestore();
  }
}, 60000);
