import { expect, it } from 'vitest';
import { newGame } from '../src/sim/index.ts';
import { ARCHIVE_LIMIT, verifyArchiveBytes } from '../src/ui/archive-import.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

it('verifies full archives above the ordinary import limit without weakening snapshot equality', async () => {
  const run = exportRun(newGame(1), []);
  const text = JSON.stringify({ ...run, padding: 'x'.repeat(30_000_001) });
  expect(() => verifyImport(text)).toThrow('too large');
  const bytes = new TextEncoder().encode(text);
  expect((await verifyArchiveBytes(bytes.buffer)).state.seed).toBe(run.seed);
  await expect(
    verifyArchiveBytes(new TextEncoder().encode(JSON.stringify(compactRun(run))).buffer),
  ).rejects.toThrow('not a complete');
  const changed = structuredClone(run);
  changed.state = { ...changed.state, altered: true };
  await expect(
    verifyArchiveBytes(new TextEncoder().encode(JSON.stringify(changed)).buffer),
  ).rejects.toThrow();
  await expect(verifyArchiveBytes(new ArrayBuffer(ARCHIVE_LIMIT + 1))).rejects.toThrow('too large');
});
