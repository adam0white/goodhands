/** Browser transport only. Simulation admissions and encounter semantics stay in sim/guests. */
import {
  createPersona,
  type Lab,
  type PersonaEnvelope,
  type PersonaRequest,
  type personaChannel,
} from '@adam0white/lab-client';
import type { GuestAdmission } from '../sim/guests.ts';

export type OneCastRow = {
  v: 1;
  probe: 'zeynep' | 'selin';
  arm: 'fresh' | 'biography' | 'continuing';
  scope: 'shared' | 'local' | 'file';
  castId: string;
  branchId: string;
  revision: string;
  parentRevision: string | null;
  stage: string;
  outcome: string;
};
export type Arrival = {
  source: PersonaEnvelope;
  claim: PersonaEnvelope;
  initial: GuestAdmission;
  scope: OneCastRow['scope'];
};
export type ContinuityBook = {
  v: 1;
  fileUnlinked?: boolean;
  arrivals: Arrival[];
  heads: PersonaEnvelope[];
  rows: OneCastRow[];
};
export const emptyContinuity = (): ContinuityBook => ({ v: 1, arrivals: [], heads: [], rows: [] });
export const castIds = ['hf.cast.zeynep.pass', 'hf.cast.selin.voice'] as const;
export function continuityRow(
  p: PersonaEnvelope,
  stage: string,
  scope: OneCastRow['scope'],
  arm: OneCastRow['arm'] = 'continuing',
): OneCastRow {
  return {
    v: 1,
    probe: p.castId === castIds[0] ? 'zeynep' : 'selin',
    arm,
    scope,
    castId: p.castId,
    branchId: p.branchId,
    revision: p.revision,
    parentRevision: p.parentRevision,
    stage,
    outcome: 'accepted',
  };
}
export type Shelf = Pick<ReturnType<typeof personaChannel>, 'enabled' | 'ready' | 'setEnabled'> & {
  request<T>(request: PersonaRequest): Promise<T>;
};
type RecordingLab = Pick<Lab, 'setPersonaRecording' | 'allowPersonaRecording'> & {
  readonly personaRecordingAllowed?: boolean;
};
const bridgeUnavailable = (e: unknown) =>
  e instanceof Error &&
  /Shelf unavailable|local to this game|Continuity is off|Enable fictional person continuity/.test(e.message);
export class ContinuitySession {
  recordingKey: string | null = null;
  readonly shelf: Shelf;
  private readonly lab: RecordingLab;
  private readonly build: string | (() => string);
  constructor(shelf: Shelf, lab: RecordingLab, build: string | (() => string) = 'unknown') {
    this.shelf = shelf;
    this.lab = lab;
    this.build = build;
  }
  async recording(book: ContinuityBook, fromFile = false): Promise<void> {
    await this.shelf.ready;
    if (fromFile) book.fileUnlinked = true;
    const heads = book.heads;
    this.recordingKey = heads.length
      ? 'goodhands:' +
        [
          ...new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(
                heads
                  .map((p) => p.branchId)
                  .sort()
                  .join(':'),
              ),
            ),
          ),
        ]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('')
      : null;
    this.lab.setPersonaRecording(this.recordingKey);
    const cachedAllowed = this.lab.personaRecordingAllowed === true;
    if (heads.length && book.fileUnlinked) {
      this.lab.allowPersonaRecording(false);
      return;
    }
    if (!heads.length || !this.shelf.enabled) return;
    this.lab.allowPersonaRecording(false);
    try {
      const associations = await Promise.all(
        heads.map((p) =>
          this.shelf.request<{ sameEpoch: boolean }>({ action: 'recording', castId: p.castId }),
        ),
      );
      if (associations.every((a) => a.sameEpoch === true) || cachedAllowed)
        this.lab.allowPersonaRecording(true);
    } catch {
      if (cachedAllowed) this.lab.allowPersonaRecording(true);
    }
  }
  async allow(book: ContinuityBook, allow: boolean): Promise<void> {
    if (!allow) {
      book.fileUnlinked = true;
      this.lab.allowPersonaRecording(false);
      return;
    }
    if (this.shelf.enabled) {
      for (const p of book.heads) {
        try {
          await this.shelf.request({ action: 'recording', castId: p.castId, allowRecording: true });
        } catch (e) {
          if (!bridgeUnavailable(e)) throw e;
        }
      }
    }
    book.fileUnlinked = false;
    this.lab.allowPersonaRecording(true);
  }
  async claim(source: PersonaEnvelope, scope: OneCastRow['scope']): Promise<PersonaEnvelope> {
    await this.shelf.ready;
    const { revision, ...body } = source;
    const claim = await createPersona({
      ...body,
      parentRevision: revision,
      transfer: {
        ...body.transfer,
        targetClaim: { adapter: 'goodhands/1', rules: 'goodhands-5', claimId: crypto.randomUUID() },
      },
      source: {
        game: 'goodhands',
        build: typeof this.build === 'function' ? this.build() : this.build,
        engine: '2.14.1',
        rules: 'goodhands-5',
      },
    });
    if (scope === 'shared' || this.shelf.enabled) {
      try {
        await this.shelf.request({ action: 'put', envelope: claim });
      } catch (e) {
        if (scope !== 'file' || !bridgeUnavailable(e)) throw e;
      }
    }
    return claim;
  }
  async publish(
    book: ContinuityBook,
    castId: string,
    transfer: Record<string, unknown>,
    fork = false,
  ): Promise<PersonaEnvelope> {
    await this.shelf.ready;
    const prior = book.heads.find((p) => p.castId === castId);
    if (!prior) throw new Error('No accepted source revision in this run.');
    const { revision, ...body } = prior;
    const envelope = await createPersona({
      ...body,
      branchId: fork ? crypto.randomUUID() : prior.branchId,
      parentRevision: fork ? null : revision,
      source: {
        game: 'goodhands',
        build: typeof this.build === 'function' ? this.build() : this.build,
        engine: '2.14.1',
        rules: 'goodhands-5',
      },
      limitations:
        (transfer.person as { limitations?: string[] } | undefined)?.limitations ?? prior.limitations,
      transfer: fork
        ? {
            ...transfer,
            admission: { ...((transfer.admission as Record<string, unknown>) ?? {}), forkOf: revision },
          }
        : transfer,
    });
    await this.shelf.request({ action: 'put', envelope, fork });
    const index = book.heads.findIndex((p) => p.castId === castId);
    book.heads[index] = envelope;
    const arrival = book.arrivals.find((a) => a.source.castId === castId);
    book.rows.push(
      continuityRow(envelope, 'checkpoint', arrival?.scope ?? 'local', arrival?.initial.arm ?? 'fresh'),
    );
    return envelope;
  }
}
