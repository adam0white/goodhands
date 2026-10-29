import { exportRun as archive } from '@adam0white/human-framework';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { applyCastTalk, castContacts } from '../src/sim/cast-scenes.ts';
import { runFor } from '../src/sim/hf4.ts';
import { fingerprint, newGame, view } from '../src/sim/index.ts';

test('a skipped Derya cannot appear or mutate either game or HF through cast contact', async () => {
  const chapter = await prepareAgencyChapter([], 7, [
    { castId: CAST.derya.castId, reason: 'Derya is still in another chapter.' },
  ]);
  const state = newGame(7, 6, [], chapter);
  // Synthetic clock fixture for this independent contact rule, not a two-day play trace.
  state.now = 1440 + 840;
  expect(castContacts(state).some((p) => p.id === 'derya')).toBe(false);
  expect(view(state).castContacts?.some((p) => p.id === 'derya')).toBe(false);
  const before = fingerprint(state),
    hfHash = archive(runFor(state)).hashes.full;
  expect(applyCastTalk(state, 'derya', 'invite')).toBe(false);
  expect(fingerprint(state)).toBe(before);
  expect(archive(runFor(state)).hashes.full).toBe(hfHash);
  const local = newGame(7);
  local.now = state.now;
  expect(castContacts(local).some((p) => p.id === 'derya')).toBe(true);
});
