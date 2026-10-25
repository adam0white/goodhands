import { expect, test } from 'vitest';
import { personalAnswer } from '../src/sim/dialogue.ts';
import { apply, newGame, view } from '../src/sim/index.ts';
import { answer } from '../src/sim/voices.ts';
import { CANDIDATES, FAMILIES, makePeople, REFEREES } from '../src/sim/world.ts';

test('current monthly people have readable names and family requests speak literally', () => {
  const names = [...CANDIDATES, ...REFEREES, ...FAMILIES.flatMap((family) => family.household)].map(
    (person) => person.name,
  );
  for (const name of names) expect(name).not.toMatch(/applicant|request|employer \d|Household/);
  for (const family of FAMILIES) {
    expect(family.name).toMatch(/^the .+ family$/);
    expect(family.wants).not.toMatch(/A frustrated household|The household|A visitor asks/);
  }
});

test('experience replies remain first-person speech and keep the note separate', () => {
  for (const candidate of CANDIDATES) {
    expect(personalAnswer(candidate.id, 'last-family')).toMatch(/^I /);
    expect(personalAnswer(candidate.id, 'last-family')).not.toMatch(/This applicant|Check the reference/);
  }
  const state = newGame(1);
  apply(state, { type: 'interview', candidate: 'gul' });
  apply(state, { type: 'choose', scene: view(state).scene!.id, choice: 'last-family' });
  expect(view(state).scene!.lines.at(-1)).toMatchObject({
    speaker: 'Gülce Aksoy',
    kind: 'speech',
    text: 'I have worked as a nanny.',
  });
});

test('interview observations name the person without an ambiguous plural pronoun', () => {
  const people = makePeople(1);
  for (const candidate of CANDIDATES) {
    for (let variant = 0; variant < 6; variant++) {
      const notice = answer(
        people[candidate.id]!,
        candidate.presentation,
        candidate.roles[0]!,
        'q-patient',
        variant,
      ).notice;
      expect(notice).not.toMatch(/\b[Tt]hey\b|\b[Tt]heir\b|\{person\}|\{possessive\}/);
    }
  }
});
