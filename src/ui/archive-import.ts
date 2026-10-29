import { validateContinuity, verifyImport } from './export.ts';

// The cap bounds serialized bytes, not the memory needed to reconstruct a run.
export const ARCHIVE_LIMIT = 100 * 1024 * 1024;

export async function verifyArchiveBytes(bytes: ArrayBuffer) {
  if (bytes.byteLength > ARCHIVE_LIMIT) throw new Error('This archive is too large.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const run = verifyImport(text, { maxCharacters: ARCHIVE_LIMIT, requireFull: true });
  await validateContinuity(run.continuity, run.state, run.inputs);
  return run;
}
