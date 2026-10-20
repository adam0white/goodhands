import { describe, expect, it } from 'vitest';
import type { CandidateView, Note, View } from '../src/sim/types.ts';
import {
  candidateAvailability,
  clockLabels,
  escapeHtml,
  evidence,
  INTRO,
  noteText,
  phoneAvailability,
  resumeLine,
  speedLabel,
  vouchLabel,
} from '../src/ui/render.ts';

const candidate: CandidateView = {
  id: 'sevda',
  name: 'Sevda',
  age: 31,
  roles: ['nanny'],
  look: 'A careful coat',
  status: 'bench',
  wage: null,
  experience: [],
  notes: [],
  referees: [],
};
const note: Note = {
  quality: 'patient',
  read: 'yes',
  phrase: 'waited with the twins',
  source: 'seen',
  from: 'Nermin',
  at: 540,
};

describe('player-facing render helpers', () => {
  it('keeps the opening under forty words', () => expect(INTRO.split(/\s+/).length).toBeLessThanOrEqual(40));
  it('escapes speech before it enters HTML', () =>
    expect(escapeHtml('<button>"&\'')).toBe('&lt;button&gt;&quot;&amp;&#39;'));
  it('shows the source and excludes contradicted notes from a vouch', () => {
    expect(noteText(note)).toContain('seen: Nermin');
    expect(
      evidence({ ...candidate, notes: [{ ...note, source: 'says', crossedOut: true }, note] }, 'patient'),
    ).toBe('seen: waited with the twins (Nermin)');
    expect(evidence(candidate, 'honest')).toContain('not checked');
  });
  it('uses the known circumstance when an action is unavailable', () => {
    expect(candidateAvailability({ ...candidate, busy: 'At the Arslans until 18:00' })).toBe(
      'At the Arslans until 18:00',
    );
    expect(candidateAvailability(candidate)).toBeUndefined();
  });
  it('labels a vouch with the strongest uncrossed evidence rather than the latest claim', () => {
    const seen = { ...note, source: 'seen' as const };
    const says = { ...note, source: 'says' as const, at: 600 };
    expect(vouchLabel({ ...candidate, notes: [seen, says] }, 'patient')).toBe('patient · seen');
    expect(vouchLabel({ ...candidate, notes: [{ ...seen, crossedOut: true }, says] }, 'patient')).toBe(
      'patient · says',
    );
    expect(vouchLabel({ ...candidate, notes: [{ ...note, source: 'heard' }] }, 'patient')).toBe(
      'patient · heard',
    );
    expect(vouchLabel(candidate, 'reliable')).toBe('reliable · not checked');
  });
  it('explains when another call cannot interrupt the current scene', () => {
    expect(phoneAvailability({ scene: { kind: 'interview' } } as View)).toBeUndefined();
    expect(phoneAvailability({ scene: { kind: 'reference' } } as View)).toBeUndefined();
    expect(phoneAvailability({ scene: null } as View)).toBeUndefined();
    expect(phoneAvailability({ scene: { kind: 'phone' } } as View)).toContain('Finish');
    expect(
      phoneAvailability({
        scene: { kind: 'phone' },
        heldScene: { id: 'interview', title: 'Interview: Sevda' },
      } as View),
    ).toContain('Finish');
  });
  it('distinguishes chosen speed from a held slow clock', () => {
    expect(speedLabel({ speed: 3, slowed: true } as View)).toBe('Slow · held slow (chosen: Gallop)');
  });
  it('resumes at the visible scene rather than claiming time passed away', () => {
    expect(
      resumeLine({
        dateLabel: 'Monday 2 November',
        timeLabel: '09:15',
        scene: { title: 'Interview: Sevda' },
      } as View),
    ).toBe('Monday 2 November, 09:15 · Interview: Sevda');
  });
});

it('keeps a source’s own claim beside Nermin’s read', () => {
  expect(noteText({ ...note, claim: 'I sat with the twins until they slept.' })).toBe(
    'patient — waited with the twins · seen: Nermin — I sat with the twins until they slept.',
  );
});

it('shows fictional clock dates in English across a day boundary', () => {
  expect(clockLabels(1440 + 720)).toEqual({ dateLabel: 'Tuesday 3 November', timeLabel: '12:00' });
});
