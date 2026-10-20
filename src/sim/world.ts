/** Authored Izmir households and public presentations. Hidden truth lives only in HF Persons. */
import { acquaint, createPerson, hear, type Person, skillLevel } from '@adam0white/human-framework';
import type { Quality, Role } from './types.ts';

export interface Candidate {
  id: string;
  name: string;
  age: number;
  roles: Role[];
  look: string;
  presentation: 'chatty' | 'reserved' | 'polished' | 'plain';
  wage: number;
  commute: number;
  home: string;
  arrives: number;
  skills: string[];
  referees: string[];
}
export interface Family {
  id: string;
  name: string;
  district: string;
  household: { id: string; name: string; who: string }[];
  pressure: Quality;
  pressureWords: string;
  role: Role;
  wage: number;
  wants: string;
  arrives: number;
  deadline: number;
  x: number;
  y: number;
  secret: string;
}
export interface Referee {
  id: string;
  name: string;
  candidate: string;
  bias: 'fair' | 'stingy' | 'fond' | 'cagey';
  reachableAt: number;
}

/**
 * Host interpretation of HF HEXACO, not separate character scores.
 * Quality     | HF trait          | What household moments test
 * patient     | agreeableness     | tolerating frustration
 * honest      | honesty           | money and truthful answers
 * reliable    | conscientiousness | keeping arrangements
 * warm        | extraversion      | approaching and engaging others
 * hardworking | conscientiousness | persistence at work
 * discreet    | honesty           | keeping entrusted confidences
 * Primary keys above let testimony share HF impression vocabulary. quality() uses
 * these host composites: warm = 50% extraversion + 50% best care skill;
 * hardworking = 70% conscientiousness + 30% housework skill;
 * discreet = 75% honesty + 25% low extraversion. All are bounded 0..1.
 * These are game interpretations, not clinical claims.
 */
export const QUALITY_MAP: Record<Quality, keyof Person['traits']> = {
  patient: 'agreeableness',
  honest: 'honesty',
  reliable: 'conscientiousness',
  warm: 'extraversion',
  hardworking: 'conscientiousness',
  discreet: 'honesty',
};
export const ROLE_SKILL: Record<Role, string> = {
  nanny: 'childcare',
  cook: 'cooking',
  carer: 'eldercare',
  driver: 'driving',
  housekeeper: 'housework',
};
export function quality(person: Person, q: Quality): number {
  if (q === 'warm')
    return (
      0.5 * person.traits.extraversion +
      0.5 * Math.max(skillLevel(person, 'childcare'), skillLevel(person, 'eldercare'))
    );
  if (q === 'hardworking')
    return 0.7 * person.traits.conscientiousness + 0.3 * skillLevel(person, 'housework');
  if (q === 'discreet') return 0.75 * person.traits.honesty + 0.25 * (1 - person.traits.extraversion);
  return person.traits[QUALITY_MAP[q]];
}
const at = (day: number, hour = 9, minute = 0) => day * 1440 + hour * 60 + minute;

type CandidateRow = [
  string,
  string,
  number,
  Role[],
  Candidate['presentation'],
  string,
  number,
  number,
  string,
  number,
  string[],
];
const candidateRows: CandidateRow[] = [
  [
    'gul',
    'Gül',
    38,
    ['nanny', 'housekeeper'],
    'chatty',
    'A bright scarf; she greets everyone on the bench.',
    8000,
    35,
    'Buca',
    510,
    ['Has raised twins for a working couple.', 'Has kept a large flat.'],
  ],
  [
    'sevda',
    'Sevda',
    32,
    ['nanny', 'carer'],
    'reserved',
    'A carefully mended cuff; she waits for you to finish.',
    8000,
    25,
    'Bornova',
    510,
    ['Has looked after children from infancy.', 'Sat with her grandmother after an operation.'],
  ],
  [
    'pinar',
    'Pınar',
    29,
    ['nanny', 'housekeeper'],
    'polished',
    'An immaculate coat; her phone lights up twice.',
    8500,
    40,
    'Karşıyaka',
    510,
    ['Has worked for families on the waterfront.', 'Has collected children from school.'],
  ],
  [
    'fatma',
    'Fatma',
    51,
    ['cook', 'housekeeper'],
    'plain',
    'Burn marks on her wrist; a folded shopping list.',
    8500,
    20,
    'Alsancak',
    at(1),
    ['Has cooked daily for eight people.'],
  ],
  [
    'cem',
    'Cem',
    43,
    ['driver'],
    'chatty',
    'A clean collar; he knows the pharmacy downstairs.',
    9000,
    35,
    'Bornova',
    at(2),
    ['Has driven a school minibus.'],
  ],
  [
    'ayla',
    'Ayla',
    46,
    ['carer'],
    'reserved',
    'She turns down the radio before speaking.',
    8500,
    40,
    'Buca',
    at(3),
    ['Has helped an older man wash and dress.'],
  ],
  [
    'emine',
    'Emine',
    57,
    ['cook'],
    'chatty',
    'She has brought a jar of quince jam.',
    9000,
    30,
    'Göztepe',
    at(4),
    ['Has cooked for a boarding house.'],
  ],
  [
    'murat',
    'Murat',
    35,
    ['driver', 'carer'],
    'plain',
    'A motorcycle helmet and a small notebook.',
    8500,
    45,
    'Buca',
    at(5),
    ['Has driven hospital patients to appointments.'],
  ],
  [
    'dilek',
    'Dilek',
    26,
    ['nanny'],
    'polished',
    'A folder of certificates held against her knees.',
    9000,
    30,
    'Bornova',
    at(7),
    ['Has assisted in a nursery.'],
  ],
  [
    'hatice',
    'Hatice',
    48,
    ['housekeeper', 'cook'],
    'reserved',
    'She checks the bus timetable in her pocket.',
    8000,
    50,
    'Buca',
    at(8),
    ['Has cleaned a three-storey house.'],
  ],
  [
    'selim',
    'Selim',
    54,
    ['driver'],
    'polished',
    'A pressed jacket; his shoes have been resoled.',
    9500,
    25,
    'Alsancak',
    at(9),
    ['Has driven a company director.'],
  ],
  [
    'zehra',
    'Zehra',
    40,
    ['carer', 'housekeeper'],
    'chatty',
    'She moves a chair so another woman can sit.',
    8500,
    35,
    'Göztepe',
    at(10),
    ['Has cared for a woman who used a wheelchair.'],
  ],
  [
    'leyla',
    'Leyla',
    34,
    ['nanny', 'cook'],
    'plain',
    'A bag of library books; tired eyes.',
    8500,
    40,
    'Karşıyaka',
    at(11),
    ['Has cooked and cared for two schoolchildren.'],
  ],
  [
    'osman',
    'Osman',
    60,
    ['carer'],
    'reserved',
    'He folds his cap carefully before sitting.',
    8000,
    20,
    'Alsancak',
    at(12),
    ['Has accompanied an older neighbour for years.'],
  ],
  [
    'esra',
    'Esra',
    31,
    ['housekeeper'],
    'polished',
    'Her references are inside a plastic sleeve.',
    8000,
    35,
    'Bornova',
    at(14),
    ['Has managed laundry for a guesthouse.'],
  ],
  [
    'safiye',
    'Safiye',
    53,
    ['cook', 'carer'],
    'plain',
    'Flour on her coat; she came straight from work.',
    9000,
    45,
    'Buca',
    at(15),
    ['Has prepared meals for someone with diabetes.'],
  ],
  [
    'burak',
    'Burak',
    28,
    ['driver'],
    'chatty',
    'He offers to carry a parcel up the stairs.',
    8500,
    30,
    'Göztepe',
    at(16),
    ['Has worked as a delivery driver.'],
  ],
  [
    'meltem',
    'Meltem',
    44,
    ['nanny'],
    'reserved',
    'She lets the others speak first.',
    9000,
    45,
    'Karşıyaka',
    at(17),
    ['Has cared for a child with hearing loss.'],
  ],
  [
    'huriye',
    'Huriye',
    58,
    ['housekeeper', 'cook'],
    'chatty',
    'A shopping trolley parked neatly by the door.',
    8500,
    30,
    'Bornova',
    at(18),
    ['Has kept a household running for fifteen years.'],
  ],
  [
    'yusuf',
    'Yusuf',
    47,
    ['carer', 'driver'],
    'plain',
    'He asks whether the old man likes walks.',
    9000,
    35,
    'Göztepe',
    at(19),
    ['Has supported a man recovering from a stroke.'],
  ],
  [
    'aysun',
    'Aysun',
    36,
    ['nanny'],
    'polished',
    'She has written your address in careful capitals.',
    9000,
    40,
    'Buca',
    at(21),
    ['Has cared for three siblings after school.'],
  ],
  [
    'nurten',
    'Nurten',
    50,
    ['cook'],
    'reserved',
    'A thermos in her bag; she declines the sugar.',
    8500,
    25,
    'Alsancak',
    at(22),
    ['Has cooked at a neighbourhood lunch counter.'],
  ],
  [
    'ergun',
    'Ergün',
    41,
    ['driver', 'housekeeper'],
    'plain',
    'He wipes rain off his shoes before entering.',
    8500,
    45,
    'Bornova',
    at(23),
    ['Has driven and maintained a family car.'],
  ],
  [
    'feride',
    'Feride',
    45,
    ['carer', 'nanny'],
    'chatty',
    'She remembers meeting you at the market.',
    9000,
    35,
    'Karşıyaka',
    at(24),
    ['Has looked after a grandmother and her granddaughter.'],
  ],
];
export const CANDIDATES: Candidate[] = candidateRows.map(
  ([id, name, age, roles, presentation, look, wage, commute, home, arrives, skills]) => ({
    id,
    name,
    age,
    roles,
    presentation,
    look,
    wage,
    commute,
    home,
    arrives,
    skills,
    referees: [`ref-${id}`],
  }),
);

/** Every request has an authored pressure, private confidence, and actual household members. */
type FamilyRow = [
  string,
  string,
  string,
  string[][],
  Quality,
  string,
  Role,
  number,
  string,
  number,
  number,
  number,
  number,
  string,
];
const familyRows: FamilyRow[] = [
  [
    'arslans',
    'the Arslans',
    'Karşıyaka',
    [
      ['Ece', 'mother, returning to work'],
      ['Mert', 'father, a pharmacist'],
      ['Ada', 'daughter, three'],
      ['Saadet', 'grandmother, lives with them'],
      ['Deniz', 'son, three'],
    ],
    'patient',
    'Grandmother Saadet corrects every little thing.',
    'nanny',
    9000,
    'Someone patient with the twins, Ada and Deniz, both three. Grandmother Saadet will be there too.',
    510,
    at(1, 8),
    0.22,
    0.2,
    'Mert has been sleeping at his brother’s flat. Ece has told nobody.',
  ],
  [
    'kayas',
    'the Kayas',
    'Bornova',
    [
      ['Aylin', 'daughter, a teacher'],
      ['Kemal', 'father, needs help dressing'],
    ],
    'patient',
    'Kemal throws his plate when he cannot make himself understood.',
    'carer',
    9000,
    'Father is proud. Do not argue when he raises his voice.',
    at(0, 11),
    at(2, 8),
    0.78,
    0.3,
    'Aylin has not been paid for two months and borrows the wages.',
  ],
  [
    'demirs',
    'the Demirs',
    'Alsancak',
    [
      ['İpek', 'mother, an accountant'],
      ['Onur', 'father, works nights'],
      ['Deniz', 'son, seven'],
    ],
    'discreet',
    'Passengers ask questions about Onur’s late nights.',
    'driver',
    8500,
    'Drive Deniz to school and Onur to his night shift. Keep our journeys private.',
    at(0, 14),
    at(3, 8),
    0.49,
    0.45,
    'Onur is sitting with his ill sister at night, not drinking.',
  ],
  [
    'aks',
    'the Aks',
    'Göztepe',
    [
      ['Suna', 'retired headteacher'],
      ['Rauf', 'husband, recovering from surgery'],
    ],
    'warm',
    'Rauf refuses help from anyone who speaks over him.',
    'carer',
    9500,
    'Talk to him as a person. He was a teacher too.',
    at(4, 10),
    at(7, 8),
    0.29,
    0.65,
    'Suna is afraid her own memory is failing.',
  ],
  [
    'erdems',
    'the Erdems',
    'Karşıyaka',
    [
      ['Berrin', 'mother, runs a shop'],
      ['Levent', 'father, travels'],
      ['Ela', 'daughter, five'],
      ['Efe', 'son, five'],
      ['Naciye', 'grandmother'],
    ],
    'hardworking',
    'Berrin adds cleaning to the nanny’s day.',
    'nanny',
    10000,
    'The twins keep you busy. A little cleaning while they nap.',
    at(5, 10),
    at(8, 8),
    0.28,
    0.16,
    'The previous worker was owed three weeks of wages.',
  ],
  [
    'yilmazs',
    'the Yılmazs',
    'Buca',
    [
      ['Fikret', 'father, a mechanic'],
      ['Sevil', 'mother, a nurse'],
      ['Can', 'son, twelve'],
    ],
    'reliable',
    'Sevil’s hospital shift starts before the first bus.',
    'driver',
    9000,
    'At our door at six. That is the important part.',
    at(7, 9),
    at(9, 6),
    0.67,
    0.83,
    'Can has been missing school while his parents work.',
  ],
  [
    'celiks',
    'the Çeliks',
    'Bornova',
    [
      ['Tülay', 'mother, a lawyer'],
      ['Ali', 'father, an engineer'],
      ['İdil', 'daughter, nine'],
    ],
    'honest',
    'Tülay leaves shopping money loose on the kitchen counter.',
    'cook',
    9500,
    'Fresh food, and someone I can trust with the shopping.',
    at(8, 11),
    at(10, 9),
    0.85,
    0.26,
    'Ali has lost his job and still leaves each morning in his suit.',
  ],
  [
    'ozkans',
    'the Özkans',
    'Göztepe',
    [
      ['Nesrin', 'widow, lives upstairs'],
      ['Barış', 'son, lives downstairs'],
    ],
    'patient',
    'Nesrin asks the same question several times.',
    'carer',
    9000,
    'Mother forgets that she has eaten. Sit with her.',
    at(9, 10),
    at(11, 8),
    0.24,
    0.72,
    'Barış wants to sell the house but has not told his mother.',
  ],
  [
    'aydins',
    'the Aydıns',
    'Alsancak',
    [
      ['Selda', 'mother, a florist'],
      ['Hakan', 'father, a printer'],
      ['Bora', 'son, two'],
    ],
    'warm',
    'Bora cries whenever his mother leaves the room.',
    'nanny',
    9000,
    'He takes time to know people. Please do not rush him.',
    at(10, 11),
    at(12, 8),
    0.54,
    0.4,
    'Selda is expecting another baby and is frightened to tell Hakan.',
  ],
  [
    'tass',
    'the Taş family',
    'Buca',
    [
      ['Melek', 'mother, works at a bakery'],
      ['Halil', 'father, a porter'],
      ['Zeynep', 'daughter, sixteen'],
      ['Ömer', 'son, ten'],
    ],
    'hardworking',
    'There is laundry for four people and no machine this week.',
    'housekeeper',
    8500,
    'We need help until the washing machine is repaired.',
    at(11, 10),
    at(14, 9),
    0.73,
    0.78,
    'Zeynep wants to leave school to help pay the bills.',
  ],
  [
    'sahins',
    'the Şahins',
    'Karşıyaka',
    [
      ['Gaye', 'mother, works at the port'],
      ['Serdar', 'father, a surveyor'],
      ['Lale', 'daughter, eight'],
    ],
    'reliable',
    'The school gate closes at eight; Serdar cannot leave work.',
    'driver',
    9500,
    'School, then her music lesson. No last-minute changes.',
    at(14, 9),
    at(16, 7),
    0.18,
    0.27,
    'Gaye has arranged a separate flat and plans to take Lale there.',
  ],
  [
    'ugurs',
    'the Uğurs',
    'Bornova',
    [
      ['Perihan', 'retired seamstress'],
      ['Tahir', 'husband, retired bus driver'],
    ],
    'honest',
    'Tahir counts the change twice and forgets where he put it.',
    'housekeeper',
    8500,
    'Be straight with us about the hours and the money.',
    at(15, 10),
    at(17, 9),
    0.8,
    0.38,
    'Perihan is selling her jewellery to cover Tahir’s medicine.',
  ],
  [
    'karas',
    'the Karas',
    'Göztepe',
    [
      ['Aslı', 'mother, a doctor'],
      ['Tolga', 'father, a chef'],
      ['Nil', 'daughter, four'],
      ['Mina', 'daughter, one'],
    ],
    'patient',
    'The baby wakes just as Nil needs help with her breakfast.',
    'nanny',
    10500,
    'Someone steady. There will be two children asking at once.',
    at(16, 10),
    at(18, 8),
    0.35,
    0.69,
    'Aslı has been offered work in another city. Tolga does not know.',
  ],
  [
    'polats',
    'the Polats',
    'Alsancak',
    [
      ['Sevim', 'mother, hosts large lunches'],
      ['Erhan', 'father, a wholesaler'],
      ['Füsun', 'aunt, staying for winter'],
    ],
    'discreet',
    'At lunch the guests ask who has been visiting.',
    'cook',
    10000,
    'Eight for lunch on Saturdays. You need not join the conversation.',
    at(18, 11),
    at(21, 9),
    0.46,
    0.49,
    'Füsun is staying because her husband has thrown her out.',
  ],
  [
    'tekins',
    'the Tekins',
    'Buca',
    [
      ['Aysel', 'daughter, a librarian'],
      ['İsmail', 'father, limited mobility'],
      ['Rukiye', 'mother, exhausted from caring'],
    ],
    'warm',
    'İsmail refuses a wash until someone has had tea with him.',
    'carer',
    9500,
    'Let Mother rest. Father will need to get used to you.',
    at(21, 10),
    at(23, 8),
    0.64,
    0.74,
    'Rukiye has been hiding her own medical appointments.',
  ],
  [
    'inces',
    'the İnces',
    'Karşıyaka',
    [
      ['Derya', 'mother, an architect'],
      ['Cenk', 'father, a dentist'],
      ['Arda', 'son, six'],
      ['Eylül', 'daughter, eleven'],
    ],
    'reliable',
    'Derya changes the collection time by telephone.',
    'driver',
    10000,
    'Two schools, two timetables. Please write them down.',
    at(23, 10),
    at(25, 8),
    0.3,
    0.22,
    'Cenk has promised the children a move that Derya has refused.',
  ],
];
export const FAMILIES: Family[] = familyRows.map(
  ([
    id,
    name,
    district,
    members,
    pressure,
    pressureWords,
    role,
    wage,
    wants,
    arrives,
    deadline,
    x,
    y,
    secret,
  ]) => ({
    id,
    name,
    district,
    household: members.map(([memberName, who], i) => ({
      id: `${id}-${i}`,
      name: memberName ?? '',
      who: who ?? '',
    })),
    pressure,
    pressureWords,
    role,
    wage,
    wants,
    arrives,
    deadline,
    x,
    y,
    secret,
  }),
);
const refereeNames = [
  'Mrs Ak',
  'Mrs Uslu',
  'Mrs Eren',
  'Mr Bayram',
  'Mr Tunç',
  'Mrs Soyer',
  'Mrs Bulut',
  'Mr Şen',
  'Mrs Acar',
  'Mrs Öz',
  'Mr Kurt',
  'Mrs Baş',
  'Mrs Çam',
  'Mr Işık',
  'Mrs Koç',
  'Mrs Duman',
  'Mr Yalçın',
  'Mrs Güneş',
  'Mrs Kılıç',
  'Mr Ay',
  'Mrs Sezer',
  'Mrs Alkan',
  'Mr Yüce',
  'Mrs Toprak',
];
const biases: Referee['bias'][] = ['cagey', 'stingy', 'fond', 'fair'];
export const REFEREES: Referee[] = CANDIDATES.map((candidate, i) => ({
  id: `ref-${candidate.id}`,
  name: refereeNames[i] ?? 'Former employer',
  candidate: candidate.id,
  bias: biases[i % biases.length] ?? 'fair',
  reachableAt: i % 3 === 0 ? 14 * 60 : 9 * 60,
}));

/** Stable keyed randomness: authoring and iteration order cannot shift another person's truth. */
function draw(seed: number, key: string): number {
  let hash = (seed | 0) ^ 0x811c9dc5;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}
const personSeed = (seed: number, id: string) => Math.floor(draw(seed, `${id}:rng`) * 2147483646) + 1;

export function makePeople(seed: number): Record<string, Person> {
  const people: Record<string, Person> = {};
  people.nermin = createPerson({
    id: 'nermin',
    name: 'Nermin',
    seed: personSeed(seed, 'nermin'),
    now: 510,
    bornAt: -45 * 365.25 * 1440,
    sex: 'female',
    traits: {
      honesty: 0.75,
      agreeableness: 0.65,
      conscientiousness: 0.75,
      extraversion: 0.6,
      emotionality: 0.5,
      openness: 0.65,
    },
    skills: { interviewing: 0.75, placement: 0.7 },
    needs: { autonomy: 0.65, esteem: 0.55, safety: 0.5 },
  });
  for (const candidate of CANDIDATES) {
    // Exchange hidden profiles only within the same outward presentation. Seed one is authored.
    const band = CANDIDATES.filter((other) => other.presentation === candidate.presentation);
    const offset =
      seed === 1 ? 0 : 1 + Math.floor(draw(seed, `band:${candidate.presentation}`) * (band.length - 1));
    const donor = band[(band.indexOf(candidate) + offset) % band.length] ?? candidate;
    const value = (key: string) => 0.22 + 0.72 * draw(1, `${donor.id}:${key}`);
    const traits = {
      honesty: donor.id === 'gul' ? 0.16 : value('honesty'),
      conscientiousness: donor.id === 'pinar' ? 0.2 : value('conscientiousness'),
      agreeableness: donor.id === 'sevda' ? 0.94 : value('agreeableness'),
      // A reserved presentation stays reserved even as private profiles change.
      extraversion:
        candidate.presentation === 'reserved'
          ? 0.18 + 0.19 * draw(seed, `${candidate.id}:reserve`)
          : candidate.presentation === 'chatty'
            ? 0.72 + 0.22 * draw(seed, `${candidate.id}:chat`)
            : value('extraversion'),
      emotionality: value('emotionality'),
      openness: value('openness'),
    };
    const skills: Record<string, number> = {};
    for (const role of candidate.roles)
      skills[ROLE_SKILL[role]] =
        donor.id === 'sevda' && (role === 'nanny' || role === 'carer')
          ? 0.96
          : 0.38 + 0.57 * draw(1, `${donor.id}:skill:${role}`);
    people[candidate.id] = createPerson({
      id: candidate.id,
      name: candidate.name,
      seed: personSeed(seed, candidate.id),
      now: 510,
      bornAt: -candidate.age * 365.25 * 1440,
      sex: ['cem', 'murat', 'selim', 'osman', 'burak', 'yusuf', 'ergun'].includes(candidate.id)
        ? 'male'
        : 'female',
      traits,
      skills,
      needs: {
        safety: 0.35 + 0.3 * draw(seed, `${candidate.id}:safety`),
        autonomy: 0.45 + 0.3 * draw(seed, `${candidate.id}:autonomy`),
        esteem: 0.45,
        belonging: 0.55,
        leisure: 0.55,
        competence: 0.65,
        meaning: 0.6,
      },
    });
  }
  for (const family of FAMILIES) {
    for (const [i, member] of family.household.entries()) {
      const childAges: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        sixteen: 16,
      };
      const ageWord = member.who.split(', ')[1] ?? '';
      const age =
        childAges[ageWord] ??
        (/grandmother|retired|recovering|limited mobility|needs help dressing|widow/.test(member.who)
          ? 72
          : 43);
      people[member.id] = createPerson({
        id: member.id,
        name: member.name,
        seed: personSeed(seed, member.id),
        now: 510,
        bornAt: -age * 365.25 * 1440,
        sex: /father|husband|son|grandfather|uncle/.test(member.who) ? 'male' : 'female',
        traits: {
          honesty: 0.3 + 0.6 * draw(seed, `${member.id}:honesty`),
          agreeableness:
            family.pressure === 'patient' &&
            (family.id === 'arslans' ? /grandmother/.test(member.who) : i === 1)
              ? 0.2
              : 0.3 + 0.6 * draw(seed, `${member.id}:agreeable`),
          conscientiousness: 0.35 + 0.6 * draw(seed, `${member.id}:reliable`),
          extraversion: 0.25 + 0.65 * draw(seed, `${member.id}:social`),
          emotionality: 0.3 + 0.6 * draw(seed, `${member.id}:emotional`),
          openness: 0.3 + 0.5 * draw(seed, `${member.id}:open`),
        },
        needs: { autonomy: 0.4, belonging: 0.55, safety: 0.6, esteem: 0.5, leisure: 0.6 },
        relationships: family.household
          .filter((other) => other.id !== member.id)
          .map((other) => ({ otherId: other.id, affection: 0.55, familiarity: 0.9 })),
      });
    }
  }
  for (const referee of REFEREES) {
    people[referee.id] = createPerson({
      id: referee.id,
      name: referee.name,
      seed: personSeed(seed, referee.id),
      now: 510,
      bornAt: -55 * 365.25 * 1440,
      sex: referee.name.startsWith('Mr ') ? 'male' : 'female',
      traits: {
        honesty: referee.bias === 'fair' ? 0.85 : referee.bias === 'cagey' ? 0.3 : 0.48,
        agreeableness: referee.bias === 'stingy' ? 0.18 : referee.bias === 'fond' ? 0.85 : 0.55,
        extraversion: referee.bias === 'cagey' ? 0.3 : 0.6,
        conscientiousness: 0.65,
      },
      skills: { householdManagement: 0.7 },
      needs: { autonomy: 0.6, esteem: referee.bias === 'stingy' ? 0.35 : 0.6 },
      relationships: [
        {
          otherId: referee.candidate,
          affection: referee.bias === 'fond' ? 0.8 : referee.bias === 'stingy' ? -0.35 : 0.2,
          familiarity: 0.8,
        },
      ],
    });
  }
  for (const referee of REFEREES) {
    const worker = people[referee.candidate]!;
    const speaker = people[referee.id]!;
    acquaint(speaker, worker.id, 0.9, { traits: worker.traits }, 510);
    for (const q of ['warm', 'hardworking', 'discreet'] as const)
      hear(speaker, worker.id, `trait:goodhands:${q}`, quality(worker, q), 510, 1);
  }
  return people;
}
