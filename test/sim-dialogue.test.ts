import { describe, expect, it } from 'vitest';
import {
  answer,
  personalAnswer,
  personalQuestions,
  questions,
  workerDisagreement,
  workerNeed,
} from '../src/sim/voices.ts';
import { CANDIDATES, makePeople } from '../src/sim/world.ts';

function sentences(text: string): number {
  return text.split(/[.!?]+(?:\s|$)/).filter(Boolean).length;
}

describe('authored worker conversations', () => {
  it('gives every candidate separate short answers about work and a personal boundary', () => {
    const needs = new Set<string>();
    const previousJobs = new Set<string>();
    for (const candidate of CANDIDATES) {
      expect(personalQuestions(candidate.id).map((question) => question.id)).toEqual([
        'wage',
        'last-family',
        'hours',
        'home',
        'why-left',
        'need',
      ]);
      for (const question of personalQuestions(candidate.id)) {
        const text = personalAnswer(candidate.id, question.id);
        expect(text).not.toBe('');
        expect(sentences(text)).toBeLessThanOrEqual(2);
      }
      expect(personalAnswer(candidate.id, 'wage')).toContain(`₺${candidate.wage}`);
      expect(personalAnswer(candidate.id, 'home')).toContain(candidate.home);
      expect(personalAnswer(candidate.id, 'home')).not.toContain(`₺${candidate.wage}`);
      expect(personalAnswer(candidate.id, 'last-family')).not.toContain(`₺${candidate.wage}`);
      expect(workerNeed(candidate.id).finishBy).toBeGreaterThan(0);
      needs.add(workerNeed(candidate.id).words);
      previousJobs.add(personalAnswer(candidate.id, 'last-family'));
    }
    expect(needs.size).toBe(CANDIDATES.length);
    expect(previousJobs.size).toBe(CANDIDATES.length);
  });

  it('keeps Sevda’s bus, mother and account of the disputed evening together', () => {
    expect(workerNeed('sevda')).toMatchObject({ finishBy: 18 * 60 });
    expect(personalAnswer('sevda', 'need')).toMatch(/18:10 bus/);
    expect(personalAnswer('sevda', 'need')).toMatch(/mother is alone/);
    expect(personalAnswer('sevda', 'why-left')).toMatch(/wages/);
    const account = workerDisagreement('sevda', 'the Arslans');
    expect(account).toMatch(/kitchen/);
    expect(account).toMatch(/Saadet/);
    expect(account).toMatch(/18:10/);
    expect(sentences(account)).toBeLessThanOrEqual(2);
  });

  it('keeps personal questions separate from character evidence', () => {
    expect(questions('nanny').every((question) => question.id.startsWith('q-'))).toBe(true);
    expect(personalAnswer('sevda', 'q-patient')).toBe('');
    expect(personalAnswer('unknown', 'hours')).toBe('');
  });

  it('uses distinct patience accounts and leaves room for a contextual reliability concern', () => {
    const people = makePeople(1);
    const answers = new Set<string>();
    for (const candidate of CANDIDATES) {
      const person = people[candidate.id];
      const role = candidate.roles[0];
      if (!person || !role) throw new Error(`Missing authored person or role: ${candidate.id}`);
      const patience = answer(person, candidate.presentation, role, 'q-patient', 0);
      answers.add(patience.text);
      expect(patience.quality).toBe('patient');
      expect(patience.claim).toBeGreaterThan(0);
      expect(patience.claim).toBeLessThan(1);
      for (const question of questions(role)) {
        for (let variant = 0; variant < 6; variant++) {
          expect(
            sentences(answer(person, candidate.presentation, role, question.id, variant).text),
          ).toBeLessThanOrEqual(2);
        }
      }
      for (let variant = 0; variant < 6; variant++) {
        const reliability = answer(person, candidate.presentation, role, 'q-reliable', variant);
        expect(sentences(reliability.text)).toBe(1);
      }
    }
    expect(answers.size).toBe(CANDIDATES.length);
  });
});
