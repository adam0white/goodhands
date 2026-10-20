import { describe, expect, it } from 'vitest';
import * as stories from '../src/sim/references.ts';
import type { Quality } from '../src/sim/types.ts';
import { FAMILIES, makePeople, REFEREES } from '../src/sim/world.ts';

const questions = ['ref-patient', 'ref-honest', 'ref-reliable', 'ref-leaving', 'ref-return'];

describe('household and reference stories', () => {
  it('gives the Arslan twins and their grandmother their own people and matching request', () => {
    const family = FAMILIES.find((f) => f.id === 'arslans')!;
    const people = makePeople(1);
    expect(family.household.filter((p) => /three/.test(p.who)).map((p) => p.name)).toEqual(['Ada', 'Deniz']);
    expect(family.wants).toMatch(/Ada and Deniz/);
    expect(family.wants).toMatch(/Saadet/);
    const grandmother = family.household.find((p) => p.name === 'Saadet')!;
    expect(people[grandmother.id]!.traits.agreeableness).toBe(0.2);
    const twin = family.household.find((p) => p.name === 'Deniz')!;
    expect(people[twin.id]!.life.sex).toBe('male');
  });

  it('gives the Demirs a driving request that fits their household', () => {
    const family = FAMILIES.find((f) => f.id === 'demirs')!;
    expect(family.role).toBe('driver');
    expect(family.wants).toMatch(/driv|school|journey/i);
  });

  it('does not reuse another referee’s anecdote with a substituted worker name', () => {
    const people = makePeople(1);
    const speakers = new Map<string, string>();
    for (const ref of REFEREES) {
      const worker = people[ref.candidate]!;
      const texts = [
        stories.referenceOpening(ref, worker),
        ...questions.map((question) => stories.referenceReply(ref, people[ref.id]!, question, 510).text),
      ];
      expect(new Set(texts).size).toBeGreaterThanOrEqual(3);
      for (const text of texts) {
        const normalized = text.replaceAll(worker.name, 'WORKER');
        expect(speakers.get(normalized), `${ref.id}: ${normalized}`).toBeOneOf([undefined, ref.id]);
        speakers.set(normalized, ref.id);
      }
    }
  });

  it('tags a keys-and-hours departure as reliability, and an unpaid-wages story as honesty', () => {
    const people = makePeople(1);
    const gul = REFEREES.find((r) => r.candidate === 'gul')!;
    const sevda = REFEREES.find((r) => r.candidate === 'sevda')!;
    expect(stories.referenceReply(gul, people[gul.id]!, 'ref-leaving', 510).quality).toBe('reliable');
    const wageReply = stories.referenceReply(sevda, people[sevda.id]!, 'ref-leaving', 510);
    expect(wageReply.quality).toBe('honest');
    expect(wageReply.wageDispute).toBe(true);
  });

  it('keeps every named household member in requests and family accounts in the right home', () => {
    const names = new Set(FAMILIES.flatMap((family) => family.household.map((p) => p.name)));
    const seenDisagreements = new Set<string>();
    for (const family of FAMILIES) {
      const disagreement = stories.familyDisagreementWords(family.id, 'WORKER');
      expect(seenDisagreements.has(disagreement)).toBe(false);
      seenDisagreements.add(disagreement);
      const lines = [family.wants, family.pressureWords, family.secret, disagreement];
      for (const q of ['patient', 'honest', 'reliable', 'warm', 'hardworking', 'discreet'] as Quality[]) {
        lines.push(
          stories.familyMoment(family.id, q, true, 'WORKER'),
          stories.familyMoment(family.id, q, false, 'WORKER'),
        );
      }
      for (const name of names) {
        const named = new RegExp(`(?<!\\p{L})${name}(?!\\p{L})`, 'u');
        if (lines.some((line) => named.test(line))) {
          expect(
            family.household.some((person) => person.name === name),
            `${family.id}: ${name}`,
          ).toBe(true);
        }
      }
    }
  });

  it('gives every family distinct positive and negative household anecdotes for every quality', () => {
    expect(stories).toHaveProperty('familyMoment');
    const seen = new Set<string>();
    for (const family of FAMILIES) {
      for (const q of ['patient', 'honest', 'reliable', 'warm', 'hardworking', 'discreet'] as Quality[]) {
        const good = stories.familyMoment(family.id, q, true, 'WORKER');
        const bad = stories.familyMoment(family.id, q, false, 'WORKER');
        expect(good).not.toBe(bad);
        for (const text of [good, bad]) {
          expect(text).toContain('WORKER');
          expect(seen.has(text), text).toBe(false);
          seen.add(text);
        }
      }
    }
  });
});
