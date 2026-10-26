import { describe, expect, it } from 'vitest';
import type { CandidateView, Note, View } from '../src/sim/types.ts';
import {
  automaticPace,
  candidateAvailability,
  canWait,
  clockLabels,
  escapeHtml,
  evidence,
  INTRO,
  matchingReason,
  monthTally,
  noteText,
  personName,
  phoneAvailability,
  placementDepositWords,
  referenceReason,
  requestGroups,
  resumeLine,
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
    expect(noteText(note)).toContain('Nermin observed this.');
    expect(
      evidence({ ...candidate, notes: [{ ...note, source: 'says', crossedOut: true }, note] }, 'patient'),
    ).toBe('patient — Nermin’s reading: waited with the twins Nermin observed this.');
    expect(evidence(candidate, 'honest')).toContain('checked this yet');
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
    expect(vouchLabel({ ...candidate, notes: [seen, says] }, 'patient')).toBe(
      'patient · Nermin observed this.',
    );
    expect(vouchLabel({ ...candidate, notes: [{ ...seen, crossedOut: true }, says] }, 'patient')).toBe(
      'patient · Nermin told Nermin about this worker.',
    );
    expect(vouchLabel({ ...candidate, notes: [{ ...note, source: 'heard' }] }, 'patient')).toBe(
      'patient · Nermin reported this to Nermin.',
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
  it('uses automatic clock pace and holds decisions', () => {
    const quiet = { bench: [], speed: 3, next: { at: 600 } } as unknown as View;
    expect(automaticPace(quiet)).toBe(20);
    expect(automaticPace({ ...quiet, speed: 0 })).toBe(20);
    expect(automaticPace({ ...quiet, bench: [candidate] })).toBe(2);
    expect(automaticPace({ ...quiet, bench: [candidate] }, true)).toBe(0.5);
    expect(automaticPace({ ...quiet, slowed: true })).toBe(0.5);
    expect(canWait({ ...quiet, slowed: true })).toBe(false);
    for (const held of [
      { scene: {} },
      { heldScene: {} },
      { phoneRinging: {} },
      { dayCard: {} },
      { ended: true },
    ]) {
      const v = { ...quiet, ...held } as View;
      expect(automaticPace(v)).toBe(0);
      expect(canWait(v)).toBe(false);
    }
    expect(canWait(quiet)).toBe(true);
    expect(canWait({ ...quiet, next: null })).toBe(false);
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
    'patient — Nermin’s reading: waited with the twins Nermin observed this. I sat with the twins until they slept.',
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

it('allows wage negotiation while preserving the trial wage reason', () => {
  const worker = {
    ...candidate,
    roles: ['driver' as const],
    matchReasons: [{ family: request.family, words: 'Wage too low' }],
  };
  expect(matchingReason(worker, request, 'trial')).toBe('Wage too low');
  expect(matchingReason(worker, request, 'place')).toBeUndefined();
  expect(matchingReason(worker, request, 'place', 2)).toBe('Wage too low');
});

it('keeps the optional agency tally off until a finished review and explains its components', () => {
  const view = {
    ended: true,
    review: { trustedBy: ['arslans', 'kaya'] },
    placements: ['kept', 'kept', 'quit', 'trial', 'withdrawn'].map((status) => ({ status })),
  } as View;
  expect(monthTally(view)).toContain('<summary>See tally</summary>');
  expect(monthTally(view)).not.toContain(' open');
  expect(monthTally({ ...view, ended: false })).toBe('');
  expect(monthTally({ ...view, review: null })).toBe('');
  const before = JSON.stringify(view);
  expect(monthTally(view)).toContain('TOTAL: 3 = kept placements (2)');
  expect(monthTally(view)).toContain('households that trust Nermin (2)');
  expect(monthTally(view)).toContain('dismissed placements (1)');
  expect(monthTally(view)).toContain('does not measure people’s worth');
  expect(JSON.stringify(view)).toBe(before);
});

it('explains the deposit for the saved rules edition', () => {
  expect(placementDepositWords(3)).toContain('half the agreed fee');
  expect(placementDepositWords(4)).toContain('one week');
  expect(placementDepositWords(4, true)).toContain('earlier deposit');
});

it('resolves public people outside the applicant list without leaking IDs', () => {
  const v = {
    bench: [],
    books: [],
    families: [
      {
        id: 'arslans',
        name: 'the Arslan family',
        household: [{ id: 'arslans-0', name: 'Suna', who: 'mother' }],
      },
    ],
    city: { figures: [], threads: [], houses: [] },
  } as unknown as View;
  expect(personName(v, 'husnu')).toBe('Mr Hüsnü');
  expect(personName(v, 'arslans-0')).toBe('Suna');
  expect(personName(v, 'the Arslan family')).toBe('the Arslan family');
  expect(personName(v, 'internal-missing')).toBe('Someone');
});
