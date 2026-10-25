import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { advance, apply, newGame, view } from '../src/sim/index.ts';

const baseline = JSON.parse(
  readFileSync(new URL('./fixtures/hf3-baseline-hashes.json', import.meta.url), 'utf8'),
) as { rows: { edition: 1 | 2 | 3 | 4 | 6; seed: number; sha256: string; personIds: string[] }[] };
test('preserves complete seeded old continuation; only current Person engine stamps differ', () => {
  for (const row of baseline.rows) {
    const state = newGame(row.seed, row.edition);
    apply(state, { type: 'interview', candidate: 'sevda' });
    const scene = view(state).scene;
    if (scene) apply(state, { type: 'choose', scene: scene.id, choice: 'q-patient' });
    advance(state, 120);
    expect(Object.keys(state.people)).toEqual(row.personIds);
    const compared = structuredClone(state);
    if (row.edition === 6)
      for (const id of row.personIds) {
        expect(compared.people[id]?.engine).toBe('2.23.0');
        // This one enumerated metadata field is the entire permitted baseline difference.
        compared.people[id]!.engine = '2.21.0';
      }
    expect(createHash('sha256').update(JSON.stringify(compared)).digest('hex')).toBe(row.sha256);
  }
});
