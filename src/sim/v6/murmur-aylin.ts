/** Finite Murmur0.6 Aylin arrival. Native v1 stays unchanged. Opt-in v2 accepts only the
 * actual 154caef producer's eight selected episodes e4698–e4705 at its pinned 92cdebd checkpoint.
 * The semantic digest binds incoming payload, references, selection/map, omissions, raw witness and
 * provenance; it is a finite source restriction, not a signature or ownership check. We admit the
 * incoming projection, never a bundled Person. HF translates episode/birth clocks by arrival offset.
 * All 192 omitted episodes and full raw history stay in the source archive. Empty beliefs/duties/debt
 * prove no nonempty coverage. No source reference creates a tie, skill, trust or public fact here.
 */
import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  type Person,
  validateCalendarPersona,
} from '@adam0white/human-framework-legacy3';
import { canonicalPersona, type PersonaEnvelope } from '@adam0white/lab-client-legacy3';
export async function prepareMurmurAylin(envelope: PersonaEnvelope, opening: Person): Promise<Person> {
  const t = envelope.transfer;
  const history = t.castPassport === 'murmur-cast/2';
  if (history) {
    // Exact signed producer dialect and original parent; unknown v2 checkpoints need their own map review.
    const semantic = {
      person: t.person,
      selection: t.selection,
      checkpoint: t.checkpoint,
      provenance: t.provenance,
    };
    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(semantic))),
      ),
    ]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    if (
      envelope.source.build !== '154caef0ccee20950cfb7491390fcb5c6ebe8d58' ||
      envelope.branchId !== 'murmur-hf3-native-proof-aylin' ||
      envelope.parentRevision !== '11bd8626b954c39c748f832a9a43ef837db81438e4e1bbda834da868d76f82b7' ||
      hash !== 'c436807f4e8b1b2217973787a7e67b8caf3470694b0dcac96d287a4e8d623487'
    )
      throw new Error(
        'This Murmur history source or episode selection is not supported. Keep its source export or start fresh.',
      );
  }
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
    t.castPassport !== (history ? 'murmur-cast/2' : 'murmur-cast/1') ||
    t.sourceRole !== 'aylin' ||
    p.mappingVersion !== (history ? 'murmur-calendar/2' : 'murmur-calendar/1') ||
    p.source.engine !== '2.23.0' ||
    p.source.id !== 'aylin' ||
    p.name !== 'Aylin' ||
    p.life.sex !== 'female' ||
    p.health.health !== 1 ||
    p.health.circadianPeak !== 960 ||
    Object.keys(p.skills).length ||
    (history ? p.episodes.length !== 8 : p.episodes.length) ||
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
    mappingVersion: history ? 'murmur-calendar/2' : 'murmur-calendar/1',
    sourceId: 'aylin',
    targetId: 'aylin',
    targetNorms: DEFAULT_NORMS,
  }).person;
}
