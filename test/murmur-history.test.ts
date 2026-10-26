/** Actual CLI source controls, not a live producer/ownership or human journey. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DEFAULT_NORMS, projectCalendarPersona, snapshot } from '@adam0white/human-framework';
import { createPersona, preparePersonaLife } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { digest, prepareAgencyChapter, validateAgencyChapter } from '../src/sim/cast-chapter.ts';
import { advance, fingerprint, newGame } from '../src/sim/index.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { compactRun, exportRun, validateContinuity, verifyImport } from '../src/ui/export.ts';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const passport = () => JSON.parse(read('murmur-next-final-aylin.json.passport.json'));

test('actual producer pair maps eight incoming episodes and replays a receiving week with its pinned selection', async () => {
  const archive = JSON.parse(read('murmur-next-final-aylin.json'));
  const manifest = JSON.parse(read('murmur-next-source-manifest.json'));
  for (const [name, hash] of Object.entries(manifest.files))
    expect(createHash('sha256').update(read(name)).digest('hex')).toBe(hash);
  const parent = passport(),
    original = structuredClone(parent),
    raw = archive.native.raw;
  expect(archive.envelope).toEqual(parent);
  expect(await digest(raw)).toBe(manifest.rawDigest);
  expect(raw.memory.episodes).toHaveLength(200);
  expect(parent.transfer.selection.omittedEpisodeIds).toEqual(
    raw.memory.episodes.slice(0, -8).map((e: { id: string }) => e.id),
  );
  expect(projectCalendarPersona(raw, parent.transfer.selection.map)).toEqual(parent.transfer.person);
  const chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
  const person = chapter.actors.aylin!;
  const offset = person.now - raw.now;
  expect(person.memory.episodes).toEqual(
    raw.memory.episodes.slice(-8).map((e: { at: number }) => ({ ...e, at: e.at + offset })),
  );
  expect(person.life.bornAt).toBe(raw.life.bornAt + offset);
  expect(person.rng).toEqual(raw.rng);
  expect(person.traits).toEqual(raw.traits);
  expect(person.values).toEqual(raw.values);
  expect(person.skills).toEqual({});
  expect(person.agenda.commitments).toEqual([]);
  expect(person.memory.beliefs).toEqual([]);
  const fresh = newGame(7).people.aylin!;
  expect(person.social).toEqual(fresh.social);
  expect(snapshot(person)).toEqual(person);
  expect(chapter.inputs[0]!.parent).toEqual(parent);
  await validateAgencyChapter(chapter);
  const state = newGame(7, 6, chapter.guests, chapter);
  advance(state, 7 * 1440);
  const book = emptyContinuity();
  book.chapter = chapter;
  book.initialClaims = [];
  book.fileOrigin = true;
  const run = exportRun(state, state.inputs, book);
  for (const data of [run, compactRun(run)]) {
    const loaded = verifyImport(JSON.stringify(data));
    await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
    expect(fingerprint(loaded.state)).toBe(fingerprint(state));
    expect(loaded.state.castChapter).toEqual(chapter);
    advance(loaded.state, 30);
    const continued = structuredClone(state);
    advance(continued, 30);
    expect(fingerprint(loaded.state)).toBe(fingerprint(continued));
  }
  expect(parent).toEqual(original);
  expect(DEFAULT_NORMS).toEqual(parent.transfer.selection.map.calendar.sourceNorms);
});

test('finite history refuses re-signed unknown source, selection, references, payload, clock and unsupported stores', async () => {
  for (const edit of [
    (x: ReturnType<typeof passport>) => {
      x.source.build = 'unknown';
    },
    (x: ReturnType<typeof passport>) => {
      x.parentRevision = 'a'.repeat(64);
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.castPassport = 'murmur-cast/3';
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.selection.ids.pop();
    },
    (x: ReturnType<typeof passport>) => {
      delete x.transfer.selection.map.episodes.e4698.action;
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.person.person.episodes[0].placeId = 'agency';
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.person.person.episodes[0].summary = 'invented';
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.selection.clockOffset = 1;
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.selection.sourceRawDigest = 'b'.repeat(64);
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.person.person.skills = { cook: 1 };
    },
    (x: ReturnType<typeof passport>) => {
      x.transfer.person.calendar.owed.push({});
    },
  ]) {
    const value = passport();
    edit(value);
    const { revision: _, ...body } = value;
    const parent = await createPersona(body);
    await expect(prepareAgencyChapter([preparePersonaLife(parent, 0)], 7)).rejects.toThrow();
  }
  const chapter = await prepareAgencyChapter([preparePersonaLife(passport(), 0)], 7);
  chapter.inputs[0]!.parent.transfer.selection = {};
  await expect(validateAgencyChapter(chapter)).rejects.toThrow();
});

test('legacy native Aylin chapter retains its exact pre-change starting state', async () => {
  const parent = JSON.parse(read('murmur-hf3-aylin.json'));
  const chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
  expect(await digest(chapter)).toBe('2d8aa0a3a769ad77fa6f6633549b5b5d8ddc5ade8a5d981961c6e858afb1f5ad');
});
