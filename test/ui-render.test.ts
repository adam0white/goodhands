import { describe, expect, it } from 'vitest';
import type { CandidateView, Note, View } from '../src/sim/types.ts';
import {
  candidateAvailability,
  escapeHtml,
  evidence,
  INTRO,
  noteText,
  resumeLine,
  speedLabel,
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
