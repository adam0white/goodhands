/** Fictional source ownership is independent of the menu recording preference (F-491). */
import { ENGINE_VERSION } from '@adam0white/human-framework-legacy3';
import {
  boundedPersonaJson,
  canonicalPersona,
  type PersonaEnvelope,
  validatePersona,
} from '@adam0white/lab-client-legacy3';
import { CAST, castKey } from './cast.ts';
import { agencyTransfer } from './cast-chapter.ts';
import { type ContinuityBook, continuityRow, type Shelf } from './continuity.ts';
import type { State } from './types.ts';
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
  source: State,
  options: {
    sourceInputCount?: number;
    reserveReport?: NonNullable<ContinuityBook['publications']>[number];
    /** Save the complete native source only after all prospective receipt capacity checks. */
    retainSource?: () => Promise<boolean>;
  } = {},
): Promise<void> {
  await shelf.ready;
  if (!isCurrent()) throw new Error('This source chapter changed before publication.');
  if (!shelf.enabled) throw new Error('Fictional person continuity is off.');
  if (book.fileOrigin && !fork) throw new Error('This file needs an explicit new branch before publication.');
  if (
    source.version !== 6 ||
    envelope.source.game !== 'goodhands' ||
    envelope.source.rules !== 'goodhands-6' ||
    envelope.source.engine !== ENGINE_VERSION
  )
    throw new Error('This checkpoint needs the original current agency edition and source.');
  await validatePersona(envelope);
  const id = castKey(envelope.castId);
  if (envelope.castRevision !== CAST[id].revision || envelope.transfer.targetClaim !== undefined)
    throw new Error('A receiver claim or another cast edition is not a native source checkpoint.');
  if (book.rows.length >= 256)
    throw new Error('This run’s continuity history is full. Keep the complete run.');
  if (envelope.terminal) {
    if (
      !parent ||
      parent.terminal ||
      source.people[id]?.body.alive ||
      envelope.terminal.at !== source.people[id]?.now
    )
      throw new Error('A terminal checkpoint requires the actual owned source death.');
  } else {
    const expected = await agencyTransfer(source, id);
    for (const key of Object.keys(expected) as (keyof typeof expected)[])
      if (canonicalPersona(expected[key]) !== canonicalPersona(envelope.transfer[key]))
        throw new Error('Checkpoint differs from the complete native source.');
  }
  const assertParent = () => {
    const owned = book.heads.find((p) => p.castId === envelope.castId);
    if (owned?.revision !== parent?.revision || owned?.branchId !== parent?.branchId || parent?.terminal)
      throw new Error('This source chapter no longer owns its captured open parent.');
    if (
      envelope.parentRevision !== (fork ? null : (parent?.revision ?? null)) ||
      (parent && !fork && envelope.branchId !== parent.branchId) ||
      (parent && fork && envelope.branchId === parent.branchId)
    )
      throw new Error('Checkpoint differs from its exact parent or explicit new branch.');
  };
  assertParent();
  // Check the complete future native reader envelope, not only the portable Person or row count.
  // This detached capacity reservation is never saved or sent as an actual publication report.
  const assertCapacity = () => {
    const staged = structuredClone(book);
    const index = staged.heads.findIndex((p) => p.castId === envelope.castId);
    if (index < 0) staged.heads.push(envelope);
    else staged.heads[index] = envelope;
    staged.rows.push({
      ...continuityRow(
        envelope,
        'checkpoint',
        book.fileOrigin ? 'file' : 'shared',
        parent ? 'continuing' : 'fresh',
      ),
      sourceMinute: source.now,
      sourceInputCount: options.sourceInputCount ?? source.inputs.length,
    });
    if (options.reserveReport) staged.publications = [...(staged.publications ?? []), options.reserveReport];
    if ((staged.publications?.length ?? 0) > 32) throw new Error('This run’s publication reports are full.');
    boundedPersonaJson(staged);
  };
  assertCapacity();
  if (!isCurrent()) throw new Error('This source chapter changed before publication.');
  if (options.retainSource && !(await options.retainSource()))
    throw new Error('The complete source run could not be saved. No checkpoint was published.');
  if (!isCurrent()) throw new Error('This source chapter changed before publication.');
  assertParent();
  assertCapacity();
  if (!shelf.enabled) throw new Error('Fictional person continuity is off.');
  // The shelf still performs exact-parent CAS. Recording epochs are not permission or ownership.
  await shelf.request({
    action: 'put',
    envelope,
    fork,
    authored: !parent && !fork && !book.fileOrigin && !book.chapter?.inputs.length,
  });
}
