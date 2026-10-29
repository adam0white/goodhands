/** Synthetic reader certifications for in-memory protocol tests only. This is not deployment evidence. */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CANONICAL_CAST, portableWriteBlockers } from '@adam0white/lab-client';

export async function syntheticPortableReaders(): Promise<() => void> {
  const entry = fileURLToPath(import.meta.resolve('@adam0white/lab-client'));
  const path = pathToFileURL(join(dirname(entry), 'portable-readers.js')).href;
  const module = (await import(/* @vite-ignore */ path)) as {
    PORTABLE_READERS: Record<string, { client: string; perPersonSkips: boolean }>;
  };
  const readers = module.PORTABLE_READERS;
  const original = { ...readers };
  const peers = new Set(
    CANONICAL_CAST.flatMap((person) => [
      ...person.games,
      ...portableWriteBlockers(person.castId, 'goodhands'),
    ]),
  );
  for (const game of peers) readers[game] = { client: '0.5.7', perPersonSkips: true };
  return () => {
    for (const game of Object.keys(readers)) delete readers[game];
    Object.assign(readers, original);
  };
}
