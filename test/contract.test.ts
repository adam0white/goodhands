import { describe, expect, it } from 'vitest';
import { QUALITIES, SPEEDS } from '../src/sim/types.ts';

describe('contract', () => {
  it('names six qualities and four speeds', () => {
    expect(QUALITIES).toHaveLength(6);
    expect(SPEEDS).toHaveLength(4);
  });
});
