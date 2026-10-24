import { readFileSync } from 'node:fs';
import { preparePersonaLife } from '@adam0white/lab-client';
import { expect } from 'vitest';
import { prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { advance, apply, newGame } from '../src/sim/index.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { exportRun, validateContinuity, verifyImport } from '../src/ui/export.ts';

export async function pausedRun(pending = false) {
  const book = emptyContinuity();
  if (pending) {
    const parent = JSON.parse(
      readFileSync(new URL('./fixtures/voice4-current-departure.json', import.meta.url), 'utf8'),
    );
    book.chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 7);
    book.fileOrigin = true;
    book.fileUnlinked = true;
    book.initialClaims = [];
  }
  const state = newGame(7, 6, book.chapter?.guests, book.chapter);
  if (pending) while (state.now < 2550) advance(state, 1);
  apply(state, { type: 'pause-cast' });
  expect(state.castPaused).toBe(!pending);
  expect(state.castPauseRequested).toBe(true);
  const run = exportRun(state, state.inputs, book);
  const loaded = verifyImport(JSON.stringify(run));
  await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
  return run;
}
