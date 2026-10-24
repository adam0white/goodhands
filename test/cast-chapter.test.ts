import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { advance, apply, fingerprint, newGame, replay } from '../src/sim/index.ts';

async function source(id: 'nermin' | 'hatice') {
  const s = newGame(1);
  apply(s, { type: 'pause-cast' });
  const transfer = await agencyTransfer(s, id);
  return createPersona({
    format: 'hf-persona/1',
    castId: CAST[id].castId,
    castRevision: CAST[id].revision,
    branchId: id,
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '2.17.0', rules: 'goodhands-6' },
    transfer: { ...transfer, life: initialPersonaLife(CAST[id].castId, id, 0) },
    limitations: [],
  });
}
test('preflights multiple real agency passports, pins life and replays without a current clock', async () => {
  const a = await source('nermin'),
    b = await source('hatice');
  const inputs = [preparePersonaLife(a, 48 * 3600000), preparePersonaLife(b, 48 * 3600000)];
  const c = await prepareAgencyChapter(inputs, 7);
  const s = newGame(7, 6, c.guests, c);
  advance(s, 10);
  expect(fingerprint(replay(s.seed, s.inputs, s.now, 6, c.guests, c))).toBe(fingerprint(s));
  expect(c.actors.nermin?.rng).toEqual((a.transfer.agencyPerson as any).person.rng);
  expect(c.facts.hatice?.assignment).toBeTruthy();
  const bad = structuredClone(inputs);
  bad[1]!.parent.castRevision = '0';
  await expect(prepareAgencyChapter(bad, 7)).rejects.toThrow(/revision|edition|checksum/);
});
test('source projection requires a played pause and never clears active projects', async () => {
  const s = newGame(1);
  await expect(agencyTransfer(s, 'nermin')).rejects.toThrow(/pause/i);
});

test('changed away-life changes the new chapter’s actual applicant arrival, without rerolling her traits', async () => {
  const parent = await source('hatice');
  const first = preparePersonaLife(parent, 0);
  let later = first;
  for (let hour = 1; hour <= 48; hour++) {
    const input = preparePersonaLife(parent, hour * 3600000);
    if (input.life.work !== first.life.work || input.life.place !== first.life.place) {
      later = input;
      break;
    }
  }
  const a = await prepareAgencyChapter([first], 1),
    b = await prepareAgencyChapter([later], 1);
  const s1 = newGame(1, 6, a.guests, a),
    s2 = newGame(1, 6, b.guests, b);
  const one = (s1.cards as Record<string, { arrived: number }>).hatice!;
  const two = (s2.cards as Record<string, { arrived: number }>).hatice!;
  expect(two.arrived).not.toBe(one.arrived);
  expect(s2.people.hatice?.traits).toEqual(s1.people.hatice?.traits);
});

import { emptyContinuity } from '../src/ui/continuity.ts';
import { compactRun, exportRun, validateContinuity, verifyImport } from '../src/ui/export.ts';

test('fresh empty-batch exports retain their header; explicit file play needs no fabricated claim', async () => {
  const empty = await prepareAgencyChapter([], 7),
    book = emptyContinuity();
  book.chapter = empty;
  book.initialClaims = [];
  const s = newGame(7, 6, empty.guests, empty);
  const run = exportRun(s, s.inputs, book);
  expect(verifyImport(JSON.stringify(compactRun(run))).state).toEqual(s);
  const parent = await source('nermin'),
    local = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
  const file = emptyContinuity();
  file.chapter = local;
  file.initialClaims = [];
  file.fileOrigin = true;
  file.fileUnlinked = true;
  await expect(validateContinuity(file, newGame(7, 6, local.guests, local), [])).resolves.toBeUndefined();
  expect(file.heads).toEqual([]);
});

test('unarrived guests cannot publish a future source checkpoint', async () => {
  const s = newGame(1);
  apply(s, { type: 'pause-cast' });
  await expect(agencyTransfer(s, 'zeynep-pass')).rejects.toThrow(/arrived|encounter/);
});

import { readFileSync } from 'node:fs';
import { guestSpringCalendar } from '../src/sim/guest-calendar.ts';

test('a second agency chapter maps Selin’s actual calendar days and keeps the original return binding', async () => {
  const parent = JSON.parse(
    readFileSync(new URL('./fixtures/voice4-current-departure.json', import.meta.url), 'utf8'),
  );
  const first = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
  const s = newGame(7, 6, first.guests, first);
  while (s.now < 2575) advance(s, Math.min(60, 2575 - s.now));
  for (
    let n = 0;
    n < 300 && (s.guests as any[]).find((g) => g.id === 'selin-voice').status !== 'available';
    n++
  )
    advance(s, 1);
  apply(s, { type: 'guest-action', guest: 'selin-voice', action: 'ask-service' });
  const target = s.now + 1440;
  while (s.now < target) advance(s, Math.min(60, target - s.now));
  apply(s, { type: 'pause-cast' });
  for (let i = 0; i < 600 && !s.castPaused; i++) advance(s, 1);
  expect(s.castPaused).toBe(true);
  const transfer = await agencyTransfer(s, 'selin-voice');
  const guest = (s.guests as any[]).find((g) => g.id === 'selin-voice');
  const original = structuredClone(guest.calendar.calendarHost);
  const next = await createPersona({
    format: 'hf-persona/1',
    castId: CAST['selin-voice'].castId,
    castRevision: '2',
    branchId: 'calendar-repeat',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '2.17.0', rules: 'goodhands-6' },
    transfer: {
      ...transfer,
      guestMetadata: {
        id: 'selin-voice',
        arm: 'continuing',
        history: guest.history,
        calendar: guest.calendar,
      },
      life: initialPersonaLife(CAST['selin-voice'].castId, 'calendar-repeat', 0),
    },
    limitations: [],
  });
  const second = await prepareAgencyChapter([preparePersonaLife(next, 0)], 7);
  const carried = second.guests[0]!;
  expect(guestSpringCalendar(carried.calendar!.calendarHost, Math.floor(carried.person.now / 1440))).toEqual(
    guestSpringCalendar(original, Math.floor(s.people['selin-voice']!.now / 1440)),
  );
  expect(carried.calendar?.returnCalendarHost).toEqual(original);
  expect(carried.calendar?.sourceRevision).toBe(guest.calendar.sourceRevision);
  expect(carried.calendar?.sourceCheckpointDigest).toBe(guest.calendar.sourceCheckpointDigest);
});

test('admits the actual source-UI general Voice Selin passport without inventing an attended episode', async () => {
  const { default: raw } = await import('./fixtures/voice-site-selin.json');
  const { validatePersona } = await import('@adam0white/lab-client');
  const envelope = await validatePersona(raw);
  const input = preparePersonaLife(envelope, (envelope.transfer.life as any).clock.watermark * 3_600_000);
  const chapter = await prepareAgencyChapter([input], 7);
  const person = chapter.actors['selin-voice']!;
  expect(person.skills.office?.practice).toBe(
    (envelope.transfer.person as any).person.skills.office.practice,
  );
  expect(person.agenda.owed).toHaveLength(1);
  expect(chapter.guests[0]?.history).toEqual([]);
  const s = newGame(7, 6, chapter.guests, chapter);
  expect(fingerprint(replay(7, [], s.now, 6, chapter.guests, chapter))).toBe(fingerprint(s));
  const bad = structuredClone(envelope);
  (bad.transfer.person as any).calendar.norms[0].label = 'Different meaning';
  const { prepareSiteSelin } = await import('../src/sim/site-selin.ts');
  expect(() => prepareSiteSelin(bad)).toThrow();
});
