/** Fictional source ownership is independent of the menu recording preference (F-491). */
import { ENGINE_VERSION } from '@adam0white/human-framework';
import type { PersonaEnvelope } from '@adam0white/lab-client';
import type { ContinuityBook, Shelf } from './continuity.ts';
/** One producer stamp for browser claims, checkpoints and bounded source exports. */
export function agencySource(build: string): PersonaEnvelope['source'] {
  return { game: 'goodhands', build, engine: ENGINE_VERSION, rules: 'goodhands-6' };
}
export async function publishNativeCheckpoint(
  shelf: Shelf,
  book: ContinuityBook,
  envelope: PersonaEnvelope,
  parent: PersonaEnvelope | undefined,
  fork: boolean,
  isCurrent: () => boolean,
): Promise<void> {
  await shelf.ready;
  if (!isCurrent()) throw new Error('This source chapter changed before publication.');
  if (!shelf.enabled) throw new Error('Fictional person continuity is off.');
  if (book.fileOrigin && !fork) throw new Error('This file needs an explicit new branch before publication.');
  const owned = book.heads.find((p) => p.castId === envelope.castId);
  if (owned?.revision !== parent?.revision || owned?.branchId !== parent?.branchId)
    throw new Error('This source chapter no longer owns its captured parent.');
  if (
    envelope.parentRevision !== (fork ? null : (parent?.revision ?? null)) ||
    (parent && !fork && envelope.branchId !== parent.branchId) ||
    (parent && fork && envelope.branchId === parent.branchId)
  )
    throw new Error('Checkpoint differs from its exact parent or explicit new branch.');
  // The shelf still performs exact-parent CAS. Recording epochs are not permission or ownership.
  await shelf.request({
    action: 'put',
    envelope,
    fork,
    authored: !parent && !fork && !book.fileOrigin && !book.chapter?.inputs.length,
  });
}
