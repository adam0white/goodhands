/** Explicit receiving map for the published Voice general calendar passport.
 * Office practice remains office practice. Archived source memories are not invented here.
 * This route has no dedicated Voice return prefix and grants no return ownership.
 */
import { admitCalendarPersona, DEFAULT_NORMS, validateCalendarPersona } from '@adam0white/human-framework';
import { canonicalPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { freshGuest, type GuestAdmission } from './guests.ts';
export function prepareSiteSelin(envelope: PersonaEnvelope): GuestAdmission {
  const t = envelope.transfer;
  const portable = validateCalendarPersona(t.person),
    p = portable.person;
  const receipt = t.checkpoint as
    | { schema?: unknown; sourceMinute?: unknown; rng?: unknown; sha256?: unknown }
    | undefined;
  const fail = (): never => {
    throw new Error('Unsupported Voice general Selin calendar passport.');
  };
  if (
    envelope.castId !== 'hf.cast.selin.voice' ||
    envelope.castRevision !== '2' ||
    envelope.source.game !== 'voice' ||
    envelope.source.engine !== '2.17.0' ||
    envelope.source.rules !== 'cast-1' ||
    t.castPassport !== 'site-cast/1' ||
    t.sourceRole !== 'selin' ||
    t.engine !== '2.17.0' ||
    p.mappingVersion !== 'site-cast-calendar/1' ||
    p.source.id !== 'selin' ||
    p.name !== 'Selin' ||
    p.life.sex !== 'female' ||
    p.health.health !== 1 ||
    p.health.circadianPeak !== 960 ||
    Object.keys(p.skills).some((k) => k !== 'office') ||
    p.episodes.length ||
    portable.calendar.offset !== 0 ||
    !receipt ||
    receipt.schema !== p.source.schema ||
    receipt.sourceMinute !== p.source.now ||
    canonicalPersona(receipt.rng) !== canonicalPersona(p.rng) ||
    typeof receipt.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(receipt.sha256)
  )
    fail();
  const age = (p.source.now - p.life.bornAt) / (365 * 1440);
  if (age < 32 || age >= 33 || p.source.now % 1440 < 1080) fail();
  const arrival = 1440 + (p.source.now % 1440),
    offset = arrival - p.source.now;
  const mapped = structuredClone(portable);
  const action = (id: string) => {
    if (!['work', 'eat', 'drink', 'tea', 'pray', 'pray-qada', 'pray-eid'].includes(id)) fail();
    return id === 'work' ? 'voice-office-work' : id;
  };
  const entity = (id: string) => {
    if (!['self', 'god', 'selin'].includes(id) && !DEFAULT_NORMS.some((n) => n.id === id)) fail();
    return id === 'selin' ? 'selin-voice' : id;
  };
  mapped.calendar.offset = offset;
  for (const c of mapped.calendar.commitments) {
    if (
      c.kind === 'promise' ||
      c.kind === 'duty' ||
      (c.kind === 'job' &&
        (c.actions.join(',') !== 'work' ||
          c.chain !== 'job' ||
          c.from % 1440 !== 540 ||
          c.until % 1440 !== 1080 ||
          c.until - c.from !== 540))
    )
      fail();
    c.actions = c.actions.map(action);
    if (c.violatedBy) c.violatedBy = c.violatedBy.map(action);
    if (c.toId) c.toId = entity(c.toId);
    if (c.targetId) c.targetId = entity(c.targetId);
    if (c.chain) {
      if (c.chain !== 'job' && !c.chain.startsWith('sawm:') && !c.chain.startsWith('salah:')) fail();
      if (c.chain === 'job') c.chain = 'voice-office';
    }
    c.from += offset;
    c.until += offset;
    if (c.recurUntil !== undefined) c.recurUntil += offset;
    if (c.exempt) c.exempt.at += offset;
  }
  for (const d of mapped.calendar.owed) {
    if (!['abstain', 'worship'].includes(d.kind)) fail();
    d.actions = d.actions.map(action);
    if (d.violatedBy) d.violatedBy = d.violatedBy.map(action);
    d.at += offset;
    if (d.lapseSince !== undefined) d.lapseSince += offset;
  }
  if (mapped.calendar.lapse) mapped.calendar.lapse.since += offset;
  const target = freshGuest('selin-voice').person;
  target.now = arrival;
  target.life.bornAt = p.life.bornAt + offset;
  target.body.fitness = p.health.fitness;
  target.agenda.commitments = [];
  delete target.agenda.owed;
  delete target.agenda.lapse;
  const person = admitCalendarPersona(mapped, target, {
    mappingVersion: 'site-cast-calendar/1',
    sourceId: 'selin',
    targetId: 'selin-voice',
    targetNorms: DEFAULT_NORMS,
  }).person;
  return {
    id: 'selin-voice',
    person,
    arm: 'continuing',
    history: [],
    calendar: {
      calendarHost: {
        version: 'voice-spring/1',
        originSourceNow: p.source.now,
        sourceDayOffset: Math.floor(p.source.now / 1440) - 1,
        ramadanFirstDay: 1,
        ramadanDays: 30,
      },
      sourceRevision: envelope.revision,
      sourceCheckpointDigest: receipt!.sha256 as string,
    },
  };
}
