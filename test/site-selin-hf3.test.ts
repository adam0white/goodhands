import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { snapshot } from '@adam0white/human-framework';
import {
  canonicalPersona,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { agencyTransfer, prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import type { GuestAdmission } from '../src/sim/guests.ts';
import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import { prepareSiteSelin } from '../src/sim/site-selin.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

const present = <T>(value: T | undefined): T => {
  assert(value !== undefined);
  return value;
};
type SourceFixture = typeof import('./fixtures/voice-site-selin-hf3.json');
const fixture = (name = 'voice-site-selin-hf3') =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as SourceFixture;
test('actual signed HF3 generic Selin retains source calendar through receiving replay and own claims', async () => {
  const f = fixture(),
    e = await validatePersona(f.envelope),
    p = f.envelope.transfer.person;
  expect(createHash('sha256').update(canonicalPersona(f.raw)).digest('hex')).toBe(
    f.envelope.transfer.checkpoint.sha256,
  );
  expect(f.raw.rng).toEqual(p.person.rng);
  expect(f.proof.wholeNotebookReplayExact).toBe(true);
  expect(f.raw.now).toBe(2525);
  let chapter = await prepareAgencyChapter([preparePersonaLife(e, 0)], 7);
  expect(present(chapter.actors['selin-voice']).rng).toEqual(f.raw.rng);
  expect(present(chapter.actors['selin-voice']).traits).toEqual(f.raw.traits);
  expect(present(chapter.actors['selin-voice']).agenda.commitments).toEqual(
    p.calendar.commitments.map((c) => ({
      ...c,
      actions: c.actions.map((a) => (a === 'work' ? 'voice-office-work' : a)),
      ...(c.chain === 'job' ? { chain: 'voice-office' } : {}),
    })),
  );
  for (let round = 0; round < 2; round++) {
    const s = newGame(7, 6, chapter.guests, chapter);
    while (s.now < 2575) advance(s, Math.min(60, 2575 - s.now));
    for (
      let i = 0;
      i < 300 && view(s).guests?.find((g) => g.id === 'selin-voice')?.status !== 'available';
      i++
    )
      advance(s, 1);
    apply(s, { type: 'guest-action', guest: 'selin-voice', action: 'ask-service' });
    for (
      let i = 0;
      i < 600 && view(s).guests?.find((g) => g.id === 'selin-voice')?.status !== 'complete';
      i++
    )
      advance(s, 1);
    apply(s, { type: 'pause-cast' });
    for (let i = 0; i < 600 && !s.castPaused; i++) advance(s, 1);
    expect(s.castPaused).toBe(true);
    expect(fingerprint(replay(7, s.inputs, s.now, 6, chapter.guests, chapter))).toBe(fingerprint(s));
    const book = emptyContinuity();
    book.chapter = chapter;
    book.initialClaims = [];
    book.fileOrigin = true;
    book.fileUnlinked = true;
    const run = exportRun(s, s.inputs, book);
    expect(verifyImport(JSON.stringify(run)).state).toEqual(s);
    expect(verifyImport(JSON.stringify(compactRun(run))).state).toEqual(s);
    const transfer = await agencyTransfer(s, 'selin-voice');
    const metadata = (s.guests as Omit<GuestAdmission, 'person'>[]).find((g) => g.id === 'selin-voice');
    if (!metadata) throw new Error('Expected actual Selin visit');
    const claim = await createPersona({
      format: 'hf-persona/1',
      castId: e.castId,
      castRevision: e.castRevision,
      branchId: 'actual-selin-retained',
      parentRevision: null,
      source: { game: 'goodhands', build: 'test', rules: 'goodhands-6', engine: '2.23.0' },
      transfer: {
        ...transfer,
        guestMetadata: metadata,
        life: initialPersonaLife(e.castId, 'actual-selin-retained', 0),
      },
      limitations: [],
    });
    chapter = await prepareAgencyChapter([preparePersonaLife(claim, 0)], 7);
    expect(present(chapter.actors['selin-voice']).rng).toEqual(
      snapshot(present(s.people['selin-voice'])).rng,
    );
    expect(present(present(chapter.guests[0]).calendar).sourceRevision).toBe(e.revision);
  }
});
test('actual early source and finite unsupported version role body calendar shapes refuse', async () => {
  expect(() =>
    prepareSiteSelin(fixture('voice-site-selin-hf3-0359').envelope as unknown as PersonaEnvelope),
  ).toThrow();
  const e = fixture().envelope;
  for (const mutate of [
    (x: SourceFixture['envelope']) => {
      x.source.engine = '2.24.0';
    },
    (x: SourceFixture['envelope']) => {
      x.transfer.engine = '2.24.0';
    },
    (x: SourceFixture['envelope']) => {
      x.transfer.sourceRole = 'other';
    },
    (x: SourceFixture['envelope']) => {
      x.source.rules = 'voice-4';
    },
    (x: SourceFixture['envelope']) => {
      x.transfer.person.person.health.health = 0.9;
    },
    (x: SourceFixture['envelope']) => {
      present(x.transfer.person.calendar.commitments[0]).kind = 'duty';
    },
    (x: SourceFixture['envelope']) => {
      present(x.transfer.person.calendar.norms[0]).label = 'Changed meaning';
    },
  ]) {
    const bad = structuredClone(e);
    mutate(bad);
    expect(() => prepareSiteSelin(bad as unknown as PersonaEnvelope)).toThrow();
  }
});
