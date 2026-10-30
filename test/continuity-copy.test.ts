import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { continuityError, sourceStatus, unavailablePeople } from '../src/ui/continuity-copy.ts';

test('names refused people together without displaying stored library reasons', () => {
  expect(unavailablePeople()).toBe('');
  expect(unavailablePeople([{ castId: CAST.hulya.castId }])).toBe(
    'Hülya could not come to the office this month. Their saved histories stay as they were.',
  );
  expect(unavailablePeople([{ castId: CAST.hulya.castId }, { castId: CAST.derya.castId }])).toBe(
    'Hülya and Derya could not come to the office this month. Their saved histories stay as they were.',
  );
});

test('raw errors and historical publication reports require the lab view', () => {
  const raw = 'Error: unsupported edition / shelf head / paused chapter';
  expect(continuityError(new Error(raw), false, 'Could not save.')).toBe('Could not save.');
  expect(continuityError(new Error(raw), true, 'Could not save.')).toBe(raw);
  expect(sourceStatus('', [raw], false)).toBe('');
  expect(sourceStatus('', [raw], true)).toBe(raw);
  expect(sourceStatus('Saved.', [raw], false)).toBe('Saved.');
});
