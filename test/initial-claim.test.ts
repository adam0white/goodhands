/** Local SDK transformation controls; no shelf service or ownership proof. */
import { readFileSync } from 'node:fs';
import {
  claimCastChapterBatch,
  createPersona,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { newGame } from '../src/sim/index.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { compactRun, exportRun, validateContinuity, verifyImport } from '../src/ui/export.ts';

test('full and compact imports require initial claims to preserve every inherited parent field', async () => {
  const parent: PersonaEnvelope = JSON.parse(
    readFileSync(new URL('./fixtures/murmur-next-final-aylin.json.passport.json', import.meta.url), 'utf8'),
  );
  const original = structuredClone(parent);
  const input = preparePersonaLife(parent, 0);
  const result = await claimCastChapterBatch(
    {
      async request<T>(request: { action: string }): Promise<T> {
        // Only transport is local. The released SDK constructs the actual claim.
        return (
          request.action === 'prepareBatch'
            ? { expectedHeads: { [parent.castId]: parent.revision }, inputs: [input], blocked: [] }
            : undefined
        ) as T;
      },
    },
    [parent.castId],
    { game: 'goodhands', build: 'claim-test', engine: '2.23.0', rules: 'goodhands-6' },
    (inputs) => prepareAgencyChapter(inputs, 7),
  );
  expect(result).not.toBeNull();
  if (!result?.claims[0]) throw new Error('SDK returned no claim.');
  const sdkClaim = result.claims[0];
  const chapter = result.initial;
  const state = newGame(7, 6, chapter.guests, chapter);
  const outcomes: Record<string, string> = {};
  const variants: [string, (body: Omit<PersonaEnvelope, 'revision'>) => void, boolean][] = [
    ['actual SDK claim', () => {}, true],
    [
      'historical 2.17 claim',
      (body) => {
        body.source.engine = '2.17.0';
      },
      true,
    ],
    [
      'historical 2.21 claim',
      (body) => {
        body.source.engine = '2.21.0';
      },
      true,
    ],
    [
      'terminal',
      (body) => {
        body.terminal = { kind: 'dead', at: 510 };
      },
      false,
    ],
    [
      'castRevision',
      (body) => {
        body.castRevision = '999';
      },
      false,
    ],
    [
      'limitations',
      (body) => {
        body.limitations = [];
      },
      false,
    ],
    [
      'source engine',
      (body) => {
        body.source.engine = '99.0.0';
      },
      false,
    ],
  ];
  for (const [name, edit, accepted] of variants) {
    const { revision: _, ...body } = structuredClone(sdkClaim);
    edit(body);
    const claim = name === 'actual SDK claim' ? sdkClaim : await createPersona(body);
    const book = emptyContinuity();
    book.chapter = chapter;
    book.initialClaims = [claim];
    book.heads = [claim];
    const full = exportRun(state, state.inputs, book);
    for (const [kind, data] of [
      ['full', full],
      ['compact', compactRun(full)],
    ] as const) {
      const loaded = verifyImport(JSON.stringify(data));
      try {
        await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
        outcomes[`${name}/${kind}`] = 'ACCEPTED';
      } catch (error) {
        outcomes[`${name}/${kind}`] = (error as Error).message;
      }
      expect.soft(outcomes[`${name}/${kind}`] === 'ACCEPTED', `${name}/${kind}`).toBe(accepted);
    }
  }
  console.log(JSON.stringify(outcomes));
  expect(parent).toEqual(original);
});
