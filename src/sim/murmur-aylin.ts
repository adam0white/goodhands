/** Finite Murmur0.6 Aylin arrival. The full played source stays in its export. */
import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  type Person,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import { canonicalPersona, type PersonaEnvelope } from '@adam0white/lab-client';
export function prepareMurmurAylin(envelope: PersonaEnvelope, opening: Person): Person {
  const t = envelope.transfer;
  const portable = validateCalendarPersona(t.person),
    p = portable.person;
  const receipt = t.checkpoint as
    | { schema?: unknown; sourceMinute?: unknown; rng?: unknown; sha256?: unknown }
    | undefined;
  const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
  if (
    envelope.castId !== 'hf.cast.aylin.murmur' ||
    envelope.castRevision !== '1' ||
    envelope.source.game !== 'murmur' ||
    envelope.source.rules !== '0.6.0' ||
    envelope.source.engine !== '2.23.0' ||
    t.castPassport !== 'murmur-cast/1' ||
    t.sourceRole !== 'aylin' ||
    p.mappingVersion !== 'murmur-calendar/1' ||
    p.source.engine !== '2.23.0' ||
    p.source.id !== 'aylin' ||
    p.name !== 'Aylin' ||
    p.life.sex !== 'female' ||
    p.health.health !== 1 ||
    p.health.circadianPeak !== 960 ||
    Object.keys(p.skills).length ||
    p.episodes.length ||
    p.commitments.length ||
    portable.calendar.offset !== 0 ||
    portable.calendar.commitments.length ||
    portable.calendar.owed.length ||
    portable.calendar.lapse ||
    portable.calendar.norms.some((n) => !DEFAULT_NORMS.some((k) => same(k, n))) ||
    !receipt ||
    receipt.schema !== p.source.schema ||
    receipt.sourceMinute !== p.source.now ||
    !same(receipt.rng, p.rng) ||
    typeof receipt.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(receipt.sha256)
  )
    throw new Error(
      'This Aylin save from Murmur has details this game cannot continue. Keep the source export or start fresh.',
    );
  const age = (p.source.now - p.life.bornAt) / (365.25 * 1440);
  if (age < 35 || age >= 37) throw new Error('This saved age does not match Aylin.');
  const target = structuredClone(opening);
  const offset = target.now - p.source.now;
  target.life.bornAt = p.life.bornAt + offset;
  target.body.fitness = p.health.fitness;
  const mapped = structuredClone(portable);
  mapped.calendar.offset = offset;
  return admitCalendarPersona(mapped, target, {
    mappingVersion: 'murmur-calendar/1',
    sourceId: 'aylin',
    targetId: 'aylin',
    targetNorms: DEFAULT_NORMS,
  }).person;
}
