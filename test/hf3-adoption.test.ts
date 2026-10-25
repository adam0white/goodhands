import { readFileSync } from 'node:fs';
import { ENGINE_VERSION } from '@adam0white/human-framework';
import { createPersona, preparePersonaLife } from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { advance, fingerprint, newGame } from '../src/sim/index.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

const fixture = () =>
  JSON.parse(readFileSync(new URL('./fixtures/murmur-hf3-aylin.json', import.meta.url), 'utf8'));
test('actual signed Murmur0.6 Aylin admits and pins the receiving export replay', async () => {
  const parent = fixture(),
    original = structuredClone(parent);
  expect(parent.source).toEqual({ game: 'murmur', build: '92cdebd9fe73', engine: '2.23.0', rules: '0.6.0' });
  expect(ENGINE_VERSION).toBe('2.23.0');
  const chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
  expect(parent).toEqual(original);
  expect(chapter.actors.aylin?.rng).toEqual(parent.transfer.person.person.rng);
  expect(chapter.actors.aylin?.traits).toEqual(parent.transfer.person.person.traits);
  const state = newGame(7, 6, chapter.guests, chapter);
  advance(state, 60);
  const book = emptyContinuity();
  book.chapter = chapter;
  book.initialClaims = [];
  const run = exportRun(state, state.inputs, book);
  expect(run.framework).toBe('3.0.0');
  for (const data of [run, compactRun(run)])
    expect(fingerprint(verifyImport(JSON.stringify(data)).state)).toBe(fingerprint(state));
});
test('Murmur admission refuses other rules, roles, engines, maps and checkpoint RNG', async () => {
  for (const edit of [
    (x: ReturnType<typeof fixture>) => (x.source.rules = '0.5.0'),
    (x: ReturnType<typeof fixture>) => (x.source.engine = '2.24.0'),
    (x: ReturnType<typeof fixture>) => (x.transfer.sourceRole = 'dilan'),
    (x: ReturnType<typeof fixture>) => (x.transfer.person.person.mappingVersion = 'other/1'),
    (x: ReturnType<typeof fixture>) => x.transfer.checkpoint.rng.a++,
    (x: ReturnType<typeof fixture>) => x.transfer.person.calendar.owed.push({}),
  ]) {
    const value = fixture();
    edit(value);
    const { revision: _, ...body } = value;
    const parent = await createPersona(body);
    await expect(prepareAgencyChapter([preparePersonaLife(parent, 0)], 7)).rejects.toThrow();
  }
});

test('browser claims and native checkpoints identify the actual current engine', async () => {
  const { ContinuitySession } = await import('../src/ui/continuity.ts');
  const { agencyTransfer } = await import('../src/sim/cast-chapter.ts');
  const { apply } = await import('../src/sim/index.ts');
  const state = newGame(7);
  apply(state, { type: 'pause-cast' });
  const session = new ContinuitySession(
    {
      enabled: false,
      ready: Promise.resolve(true),
      async request() {
        return true; // In-memory transport only; not a server receipt.
      },
    } as never,
    { setPersonaRecording() {}, allowPersonaRecording() {} } as never,
  );
  const claim = await session.claim(fixture(), 'file');
  expect(claim.source.engine).toBe('2.23.0');
  const book = emptyContinuity();
  book.heads = [claim];
  const checkpoint = await session.publish(book, claim.castId, await agencyTransfer(state, 'aylin'));
  expect(checkpoint.source.engine).toBe('2.23.0');
  expect(
    (checkpoint.transfer.agencyPerson as { person: { source: { engine: string } } }).person.source.engine,
  ).toBe(checkpoint.source.engine);
});
