/** Browser transport only. Simulation admissions and encounter semantics stay in sim/guests. */
import type { CalendarPersonaSnapshot, PersonaProjectionSnapshot } from '@adam0white/human-framework';
import {
  createPersona,
  type Lab,
  type PersonaEnvelope,
  type PersonaRequest,
  type personaChannel,
} from '@adam0white/lab-client';
import { ALLOCATION, castKey } from '../sim/cast.ts';
import type { AgencyChapter } from '../sim/cast-chapter.ts';
import type { GuestAdmission } from '../sim/guests.ts';
import { agencySource } from './checkpoint.ts';

export type OneCastRow = {
  v: 1;
  probe: import('../sim/cast.ts').CastKey | 'zeynep' | 'selin';
  arm: 'fresh' | 'biography' | 'continuing';
  scope: 'shared' | 'local' | 'file';
  castId: string;
  branchId: string;
  revision: string;
  parentRevision: string | null;
  stage: string;
  outcome: string;
  /** Agency clock at publication; an idle person's HF clock can be earlier. */
  sourceMinute?: number;
  sourceInputCount?: number;
};
export type Arrival = {
  source: PersonaEnvelope;
  claim: PersonaEnvelope;
  initial: GuestAdmission;
  scope: OneCastRow['scope'];
};
export type ContinuityBook = {
  v: 1;
  chapter?: AgencyChapter;
  initialClaims?: PersonaEnvelope[];
  fileOrigin?: boolean;
  fileUnlinked?: boolean;
  /** Explicit source-publication attempts only; transport reports never certify a receiver. No trimming. */
  publications?: { at: number; inputCount: number; fingerprint: string; results: string[] }[];
  arrivals: Arrival[];
  heads: PersonaEnvelope[];
  rows: OneCastRow[];
  /** Explicit fork revisions retain their prior accepted head through later checkpoints. */
  forks?: Record<string, string>;
};
export const emptyContinuity = (): ContinuityBook => ({ v: 1, arrivals: [], heads: [], rows: [] });
export const castIds = ALLOCATION.map((p) => p.castId);
export function continuityRow(
  p: PersonaEnvelope,
  stage: string,
  scope: OneCastRow['scope'],
  arm: OneCastRow['arm'] = 'continuing',
): OneCastRow {
  return {
    v: 1,
    probe:
      p.castId === 'hf.cast.zeynep.pass'
        ? 'zeynep'
        : p.castId === 'hf.cast.selin.voice'
          ? 'selin'
          : castKey(p.castId),
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
  readonly playerId?: string | null;
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
  invalidate() {
    this.recordingKey = null;
    this.lab.setPersonaRecording(this.recordingKey);
  }
  /** Bind metadata without consulting recording identity or historical consent. */
  async recording(book: ContinuityBook, fromFile = false): Promise<void> {
    if (fromFile) {
      book.fileOrigin = true;
      book.fileUnlinked = true;
    }
    // F-491 removed per-person recording scopes. Even seven UUID branch ids exceed the old key limit.
    this.recordingKey = null;
    this.lab.setPersonaRecording(this.recordingKey);
  }
  async allow(_book: ContinuityBook, _allow: boolean): Promise<void> {
    // Kept for old callers. The single recording menu switch owns this preference.
  }
  async claim(source: PersonaEnvelope, scope: OneCastRow['scope']): Promise<PersonaEnvelope> {
    await this.shelf.ready;
    const { revision, ...body } = source;
    const claim = await createPersona({
      ...body,
      parentRevision: revision,
      transfer: {
        ...body.transfer,
        targetClaim: { adapter: 'goodhands/1', rules: 'goodhands-6', claimId: crypto.randomUUID() },
      },
      source: agencySource(typeof this.build === 'function' ? this.build() : this.build),
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
    if (book.rows.length >= 256)
      throw new Error(
        'This run’s continuity history is full. Keep a copy and start a new chapter. Local play remains available.',
      );
    await this.shelf.ready;
    const prior = book.heads.find((p) => p.castId === castId);
    if (!prior) throw new Error('No accepted source revision in this run.');
    const { revision, ...body } = prior;
    const projection = transfer.person as PersonaProjectionSnapshot | CalendarPersonaSnapshot | undefined;
    const envelope = await createPersona({
      ...body,
      branchId: fork ? crypto.randomUUID() : prior.branchId,
      parentRevision: fork ? null : revision,
      source: agencySource(typeof this.build === 'function' ? this.build() : this.build),
      limitations:
        (projection?.format === 'hf-persona-calendar/1'
          ? projection.person.limitations
          : projection?.limitations) ?? prior.limitations,
      transfer: fork
        ? {
            ...transfer,
            admission: { ...((transfer.admission as Record<string, unknown>) ?? {}), forkOf: revision },
          }
        : transfer,
    });
    await this.shelf.request({ action: 'put', envelope, fork });
    const priorFork = (prior.transfer.admission as Record<string, unknown> | undefined)?.forkOf;
    if (fork || (prior.parentRevision === null && typeof priorFork === 'string')) {
      book.forks = {
        ...book.forks,
        ...(prior.parentRevision === null && typeof priorFork === 'string'
          ? { [prior.revision]: priorFork }
          : {}),
        ...(fork ? { [envelope.revision]: revision } : {}),
      };
    }
    const index = book.heads.findIndex((p) => p.castId === castId);
    book.heads[index] = envelope;
    const arrival = book.arrivals.find((a) => a.source.castId === castId);
    book.rows.push(
      continuityRow(envelope, 'checkpoint', arrival?.scope ?? 'local', arrival?.initial.arm ?? 'fresh'),
    );
    return envelope;
  }
}
