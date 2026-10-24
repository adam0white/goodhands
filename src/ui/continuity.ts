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
type RecordingReply = { sameEpoch: boolean; branchId?: string; revision?: string; recordingEpoch?: string };
const bridgeUnavailable = (e: unknown) =>
  e instanceof Error &&
  /Shelf unavailable|local to this game|Continuity is off|Enable fictional person continuity/.test(e.message);
export class ContinuitySession {
  recordingKey: string | null = null;
  readonly shelf: Shelf;
  private readonly lab: RecordingLab;
  private readonly build: string | (() => string);
  private recordingGeneration = 0;
  constructor(shelf: Shelf, lab: RecordingLab, build: string | (() => string) = 'unknown') {
    this.shelf = shelf;
    this.lab = lab;
    this.build = build;
    const events = globalThis as unknown as EventTarget;
    if (typeof events.addEventListener === 'function') {
      const invalidate = () => {
        this.recordingGeneration++;
        this.lab.allowPersonaRecording(false);
      };
      events.addEventListener('hf-lab-preference', invalidate);
      events.addEventListener('storage', invalidate);
    }
  }
  invalidate() {
    this.recordingGeneration++;
    this.recordingKey = 'goodhands:pending';
    this.lab.setPersonaRecording(this.recordingKey);
    this.lab.allowPersonaRecording(false);
  }
  private async groupRecording(book: ContinuityBook, fromFile: boolean) {
    const generation = ++this.recordingGeneration;
    if (fromFile) {
      book.fileOrigin = true;
      book.fileUnlinked = true;
    }
    const pins = book.heads.map((p) => p.revision).join(':');
    this.recordingKey =
      book.heads.length || book.fileUnlinked ? 'goodhands:group:' + pins : 'goodhands:authored';
    this.lab.setPersonaRecording(this.recordingKey);
    this.lab.allowPersonaRecording(false);
    const player = this.lab.playerId;
    const current = () =>
      generation === this.recordingGeneration &&
      player === this.lab.playerId &&
      pins === book.heads.map((p) => p.revision).join(':');
    await this.shelf.ready;
    if (!current() || book.fileUnlinked) return;
    if (!book.heads.length) {
      this.recordingKey = null;
      this.lab.setPersonaRecording(null);
      return;
    }
    if (!this.shelf.enabled) return;
    try {
      const reply = await this.shelf.request<{ sameEpoch: boolean; revisions: string[] }>({
        action: 'recordingBatch',
        envelopes: book.heads,
      });
      if (
        current() &&
        reply.sameEpoch &&
        Array.isArray(reply.revisions) &&
        reply.revisions.join(':') === pins
      )
        this.lab.allowPersonaRecording(true);
    } catch {
      /* unavailable association remains local */
    }
  }
  private async groupAllow(book: ContinuityBook, allow: boolean) {
    const generation = ++this.recordingGeneration;
    const heads = structuredClone(book.heads),
      pins = heads.map((p) => p.revision).join(':');
    this.lab.setPersonaRecording(this.recordingKey ?? 'goodhands:file');
    this.lab.allowPersonaRecording(false);
    const player = this.lab.playerId;
    const current = () =>
      generation === this.recordingGeneration &&
      player === this.lab.playerId &&
      pins === book.heads.map((p) => p.revision).join(':');
    book.fileUnlinked = !allow;
    await this.shelf.ready;
    if (!current()) return;
    if (this.shelf.enabled && heads.length) {
      const q = await this.shelf.request<{ recordingEpoch: string | null; revisions: string[] }>({
        action: 'recordingBatch',
        envelopes: heads,
      });
      if (!current() || !Array.isArray(q.revisions) || q.revisions.join(':') !== pins || !q.recordingEpoch)
        return;
      await this.shelf.request({
        action: 'recordingBatch',
        envelopes: heads,
        allowRecording: allow,
        recordingEpoch: q.recordingEpoch,
      });
    }
    if (current()) this.lab.allowPersonaRecording(allow);
  }
  async recording(book: ContinuityBook, fromFile = false): Promise<void> {
    if (book.chapter || ((fromFile || book.fileUnlinked) && !book.heads.length))
      return this.groupRecording(book, fromFile);
    const generation = ++this.recordingGeneration;
    if (fromFile) book.fileUnlinked = true;
    // A cancelled bootstrap still loads ordinary play safely. The provisional gate is never reused
    // as consent: close it synchronously before any await, then select the stable branch key below.
    if (book.heads.length) {
      this.recordingKey = 'goodhands:pending';
      this.lab.setPersonaRecording(this.recordingKey);
      this.lab.allowPersonaRecording(false);
    }
    let player = this.lab.playerId;
    const pins = book.heads.map((p) => `${p.castId}/${p.branchId}/${p.revision}`).join(':');
    const current = () =>
      generation === this.recordingGeneration &&
      player === this.lab.playerId &&
      pins === book.heads.map((p) => `${p.castId}/${p.branchId}/${p.revision}`).join(':');
    await this.shelf.ready;
    if (!current()) return;
    const heads = book.heads;
    const key = heads.length
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
    if (!current()) return;
    this.recordingKey = key;
    this.lab.setPersonaRecording(this.recordingKey);
    const cachedAllowed = this.lab.personaRecordingAllowed === true;
    if (heads.length && book.fileUnlinked) {
      this.lab.allowPersonaRecording(false);
      return;
    }
    if (!heads.length || !this.shelf.enabled) return;
    this.lab.allowPersonaRecording(false);
    // Lab.playerId is null while the persona gate is closed. Capture after our own gate change;
    // preference/storage events still invalidate identity changes hidden by that null getter.
    player = this.lab.playerId;
    const associations = await Promise.allSettled(
      heads.map(async (p) =>
        this.shelf.request<RecordingReply>({ action: 'recording', castId: p.castId, envelope: p }),
      ),
    );
    if (
      current() &&
      associations.every((result, i) =>
        result.status === 'rejected'
          ? cachedAllowed && bridgeUnavailable(result.reason)
          : result.value.sameEpoch === true &&
            result.value.branchId === heads[i]?.branchId &&
            result.value.revision === heads[i]?.revision,
      )
    )
      this.lab.allowPersonaRecording(true);
  }
  async allow(book: ContinuityBook, allow: boolean): Promise<void> {
    if (book.chapter || (!book.heads.length && book.fileOrigin)) return this.groupAllow(book, allow);
    const generation = ++this.recordingGeneration;
    let player = this.lab.playerId;
    const heads = [...book.heads];
    const pins = heads.map((p) => p.revision).join(':');
    const current = () =>
      generation === this.recordingGeneration &&
      player === this.lab.playerId &&
      pins === book.heads.map((p) => p.revision).join(':');
    // The explicit choice applies locally now. No delayed reply can grant a later identity.
    book.fileUnlinked = !allow;
    this.lab.setPersonaRecording(this.recordingKey);
    this.lab.allowPersonaRecording(allow);
    player = this.lab.playerId;
    await this.shelf.ready;
    if (this.shelf.enabled && current()) {
      for (const p of heads) {
        try {
          const query = await this.shelf.request<RecordingReply>({
            action: 'recording',
            castId: p.castId,
            envelope: p,
          });
          if (!current()) return;
          // Old bridges cannot safely persist a historical grant. The local choice remains usable.
          if (
            query.branchId !== p.branchId ||
            query.revision !== p.revision ||
            typeof query.recordingEpoch !== 'string' ||
            !query.recordingEpoch
          )
            continue;
          const request: PersonaRequest & { recordingEpoch: string } = {
            action: 'recording',
            castId: p.castId,
            envelope: p,
            allowRecording: allow,
            recordingEpoch: query.recordingEpoch,
          };
          await this.shelf.request(request);
        } catch (e) {
          if (!bridgeUnavailable(e)) throw e;
        }
      }
    }
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
      source: {
        game: 'goodhands',
        build: typeof this.build === 'function' ? this.build() : this.build,
        engine: '2.17.0',
        rules: 'goodhands-6',
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
      source: {
        game: 'goodhands',
        build: typeof this.build === 'function' ? this.build() : this.build,
        engine: '2.17.0',
        rules: 'goodhands-6',
      },
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
