import { describe, expect, it } from 'vitest';
import type { CandidateView, Note, View } from '../src/sim/types.ts';
import {
  candidateAvailability,
  clockLabels,
  escapeHtml,
  evidence,
  INTRO,
  matchingReason,
  noteText,
  phoneAvailability,
  referenceReason,
  requestGroups,
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

const request = {
  id: 'request-demirs',
  family: 'demirs',
  role: 'driver' as const,
  wants: 'School journeys',
  wage: 8500,
  by: 4800,
  byLabel: 'Thursday 5 November, 08:00',
  status: 'open' as const,
};

it('uses public match reasons without reading or inferring hidden wages', () => {
  const driver = { ...candidate, id: 'cem', name: 'Cem', roles: ['driver' as const] };
  expect(matchingReason(driver, request)).toBeUndefined();
  expect(
    matchingReason(
      {
        ...driver,
        wage: 9000,
        matchReasons: [{ family: 'demirs', words: 'Cem needs ₺9,000; this family offers ₺8,500.' }],
      },
      request,
    ),
  ).toContain('₺9,000');
  expect(matchingReason({ ...driver, wage: 9000, matchReasons: [] }, request)).toBeUndefined();
  expect(matchingReason({ ...driver, busy: 'Trial answer due Wednesday noon' }, request)).toContain(
    'Wednesday noon',
  );
  expect(matchingReason(driver, { ...request, status: 'lost' })).toContain('no longer open');
});

it('keeps completed reference calls unavailable with their reason', () => {
  expect(
    referenceReason({
      id: 'ref-cem',
      name: 'Mr Tunç',
      reachable: true,
      called: true,
      why: 'You already heard his account.',
    }),
  ).toBe('You already heard his account.');
  expect(referenceReason({ id: 'ref-cem', name: 'Mr Tunç', reachable: true, called: false })).toBeUndefined();
});

it('separates open requests from lost requests and excludes filled requests', () => {
  const lost = { ...request, id: 'lost', status: 'lost' as const, lostReason: 'We asked elsewhere.' };
  const filled = { ...request, id: 'filled', status: 'filled' as const };
  expect(requestGroups([request, lost, filled])).toEqual({ open: [request], lost: [lost] });
});
