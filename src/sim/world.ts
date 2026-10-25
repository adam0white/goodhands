/** Authored Izmir households and public presentations. Hidden truth lives only in HF Persons. */
import { acquaint, createPerson, hear, type Person, skillLevel } from '@adam0white/human-framework';
import { castProfile, freshCast } from './cast.ts';
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

/** Unnamed work episodes; only the allocated canonical candidates retain identities. */
export const CANDIDATES: Candidate[] = [
  {
    id: 'gul',
    name: 'Nanny applicant 01',
    age: 38,
    roles: ['nanny', 'housekeeper'],
    presentation: 'chatty',
    look: 'This applicant is waiting with an application form.',
    wage: 8000,
    commute: 35,
    home: 'Buca',
    arrives: 510,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-gul'],
  },
  {
    id: 'sevda',
    name: 'Nanny applicant 02',
    age: 32,
    roles: ['nanny', 'carer'],
    presentation: 'reserved',
    look: 'This applicant is waiting with an application form.',
    wage: 8000,
    commute: 25,
    home: 'Bornova',
    arrives: 510,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-sevda'],
  },
  {
    id: 'pinar',
    name: 'Nanny applicant 03',
    age: 29,
    roles: ['nanny', 'housekeeper'],
    presentation: 'polished',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 40,
    home: 'Karşıyaka',
    arrives: 510,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-pinar'],
  },
  {
    id: 'hulya',
    name: 'Hülya',
    age: 38,
    roles: ['cook'],
    presentation: 'reserved',
    look: 'She asks for the baking duties in writing.',
    wage: 8500,
    commute: 20,
    home: 'Alsancak',
    arrives: 1980,
    skills: ['She is an oven cook. She offers baking and meal preparation with agreed limits.'],
    referees: ['ref-hulya'],
  },
  {
    id: 'cem',
    name: 'Driver applicant 05',
    age: 43,
    roles: ['driver'],
    presentation: 'chatty',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 35,
    home: 'Bornova',
    arrives: 3420,
    skills: ['This applicant reports experience as a driver. Check the reference and trial.'],
    referees: ['ref-cem'],
  },
  {
    id: 'ayla',
    name: 'Carer applicant 06',
    age: 46,
    roles: ['carer'],
    presentation: 'reserved',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 40,
    home: 'Buca',
    arrives: 4860,
    skills: ['This applicant reports experience as a carer. Check the reference and trial.'],
    referees: ['ref-ayla'],
  },
  {
    id: 'aylin',
    name: 'Aylin',
    age: 36,
    roles: ['cook'],
    presentation: 'plain',
    look: 'She checks the agreed leaving time.',
    wage: 9000,
    commute: 30,
    home: 'Alsancak',
    arrives: 6300,
    skills: ['She has worked as a school kitchen cook. She offers private meal preparation.'],
    referees: ['ref-aylin'],
  },
  {
    id: 'murat',
    name: 'Driver applicant 08',
    age: 35,
    roles: ['driver', 'carer'],
    presentation: 'plain',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 45,
    home: 'Buca',
    arrives: 7740,
    skills: ['This applicant reports experience as a driver. Check the reference and trial.'],
    referees: ['ref-murat'],
  },
  {
    id: 'dilek',
    name: 'Nanny applicant 09',
    age: 26,
    roles: ['nanny'],
    presentation: 'polished',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 30,
    home: 'Bornova',
    arrives: 10620,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-dilek'],
  },
  {
    id: 'hatice',
    name: 'Hatice',
    age: 48,
    roles: ['housekeeper', 'cook'],
    presentation: 'reserved',
    look: 'She asks when the cooking trial ends.',
    wage: 8000,
    commute: 50,
    home: 'Alsancak',
    arrives: 12060,
    skills: [
      'She has run a tea garden and can cook for a household.',
      'Someone will cover her seasonal work at the garden for this month only.',
    ],
    referees: ['ref-hatice'],
  },
  {
    id: 'selim',
    name: 'Driver applicant 11',
    age: 54,
    roles: ['driver'],
    presentation: 'polished',
    look: 'This applicant is waiting with an application form.',
    wage: 9500,
    commute: 25,
    home: 'Alsancak',
    arrives: 13500,
    skills: ['This applicant reports experience as a driver. Check the reference and trial.'],
    referees: ['ref-selim'],
  },
  {
    id: 'zehra',
    name: 'Carer applicant 12',
    age: 40,
    roles: ['carer', 'housekeeper'],
    presentation: 'chatty',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 35,
    home: 'Göztepe',
    arrives: 14940,
    skills: ['This applicant reports experience as a carer. Check the reference and trial.'],
    referees: ['ref-zehra'],
  },
  {
    id: 'leyla',
    name: 'Nanny applicant 13',
    age: 34,
    roles: ['nanny', 'cook'],
    presentation: 'plain',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 40,
    home: 'Karşıyaka',
    arrives: 16380,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-leyla'],
  },
  {
    id: 'osman',
    name: 'Carer applicant 14',
    age: 60,
    roles: ['carer'],
    presentation: 'reserved',
    look: 'This applicant is waiting with an application form.',
    wage: 8000,
    commute: 20,
    home: 'Alsancak',
    arrives: 17820,
    skills: ['This applicant reports experience as a carer. Check the reference and trial.'],
    referees: ['ref-osman'],
  },
  {
    id: 'esra',
    name: 'Housekeeper applicant 15',
    age: 31,
    roles: ['housekeeper'],
    presentation: 'polished',
    look: 'This applicant is waiting with an application form.',
    wage: 8000,
    commute: 35,
    home: 'Bornova',
    arrives: 20700,
    skills: ['This applicant reports experience as a housekeeper. Check the reference and trial.'],
    referees: ['ref-esra'],
  },
  {
    id: 'safiye',
    name: 'Cook applicant 16',
    age: 53,
    roles: ['cook', 'carer'],
    presentation: 'plain',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 45,
    home: 'Buca',
    arrives: 22140,
    skills: ['This applicant reports experience as a cook. Check the reference and trial.'],
    referees: ['ref-safiye'],
  },
  {
    id: 'burak',
    name: 'Driver applicant 17',
    age: 28,
    roles: ['driver'],
    presentation: 'chatty',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 30,
    home: 'Göztepe',
    arrives: 23580,
    skills: ['This applicant reports experience as a driver. Check the reference and trial.'],
    referees: ['ref-burak'],
  },
  {
    id: 'meltem',
    name: 'Nanny applicant 18',
    age: 44,
    roles: ['nanny'],
    presentation: 'reserved',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 45,
    home: 'Karşıyaka',
    arrives: 25020,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-meltem'],
  },
  {
    id: 'huriye',
    name: 'Housekeeper applicant 19',
    age: 58,
    roles: ['housekeeper', 'cook'],
    presentation: 'chatty',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 30,
    home: 'Bornova',
    arrives: 26460,
    skills: ['This applicant reports experience as a housekeeper. Check the reference and trial.'],
    referees: ['ref-huriye'],
  },
  {
    id: 'yusuf',
    name: 'Carer applicant 20',
    age: 47,
    roles: ['carer', 'driver'],
    presentation: 'plain',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 35,
    home: 'Göztepe',
    arrives: 27900,
    skills: ['This applicant reports experience as a carer. Check the reference and trial.'],
    referees: ['ref-yusuf'],
  },
  {
    id: 'aysun',
    name: 'Nanny applicant 21',
    age: 36,
    roles: ['nanny'],
    presentation: 'polished',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 40,
    home: 'Buca',
    arrives: 30780,
    skills: ['This applicant reports experience as a nanny. Check the reference and trial.'],
    referees: ['ref-aysun'],
  },
  {
    id: 'nurten',
    name: 'Cook applicant 22',
    age: 50,
    roles: ['cook'],
    presentation: 'reserved',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 25,
    home: 'Alsancak',
    arrives: 32220,
    skills: ['This applicant reports experience as a cook. Check the reference and trial.'],
    referees: ['ref-nurten'],
  },
  {
    id: 'ergun',
    name: 'Driver applicant 23',
    age: 41,
    roles: ['driver', 'housekeeper'],
    presentation: 'plain',
    look: 'This applicant is waiting with an application form.',
    wage: 8500,
    commute: 45,
    home: 'Bornova',
    arrives: 33660,
    skills: ['This applicant reports experience as a driver. Check the reference and trial.'],
    referees: ['ref-ergun'],
  },
  {
    id: 'feride',
    name: 'Carer applicant 24',
    age: 45,
    roles: ['carer', 'nanny'],
    presentation: 'chatty',
    look: 'This applicant is waiting with an application form.',
    wage: 9000,
    commute: 35,
    home: 'Karşıyaka',
    arrives: 35100,
    skills: ['This applicant reports experience as a carer. Check the reference and trial.'],
    referees: ['ref-feride'],
  },
];

/** Every request has an authored pressure, private confidence, and actual household members. */
export const FAMILIES: Family[] = [
  {
    id: 'arslans',
    name: 'household request 01',
    district: 'Karşıyaka',
    household: [
      {
        id: 'arslans-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'arslans-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'patient',
    pressureWords: 'A frustrated household member repeats the instructions.',
    role: 'nanny',
    wage: 9000,
    wants: 'We need a nanny for the agreed hours. A frustrated household member repeats the instructions.',
    arrives: 510,
    deadline: 1920,
    x: 0.22,
    y: 0.2,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'kayas',
    name: 'household request 02',
    district: 'Bornova',
    household: [
      {
        id: 'kayas-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'kayas-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'patient',
    pressureWords: 'A frustrated household member repeats the instructions.',
    role: 'carer',
    wage: 9000,
    wants: 'We need a carer for the agreed hours. A frustrated household member repeats the instructions.',
    arrives: 660,
    deadline: 3360,
    x: 0.78,
    y: 0.3,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'demirs',
    name: 'household request 03',
    district: 'Alsancak',
    household: [
      {
        id: 'demirs-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'demirs-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'discreet',
    pressureWords: 'A visitor asks about private household business.',
    role: 'driver',
    wage: 8500,
    wants: 'We need a driver for the agreed hours. A visitor asks about private household business.',
    arrives: 840,
    deadline: 4800,
    x: 0.49,
    y: 0.45,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'aks',
    name: 'household request 04',
    district: 'Göztepe',
    household: [
      {
        id: 'aks-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'aks-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'warm',
    pressureWords: 'The person receiving help wants to be addressed directly.',
    role: 'carer',
    wage: 9500,
    wants: 'We need a carer for the agreed hours. The person receiving help wants to be addressed directly.',
    arrives: 6360,
    deadline: 10560,
    x: 0.29,
    y: 0.65,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'erdems',
    name: 'household request 05',
    district: 'Karşıyaka',
    household: [
      {
        id: 'erdems-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'erdems-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'hardworking',
    pressureWords: 'The household asks for extra tasks.',
    role: 'nanny',
    wage: 10000,
    wants: 'We need a nanny for the agreed hours. The household asks for extra tasks.',
    arrives: 7800,
    deadline: 12000,
    x: 0.28,
    y: 0.16,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'yilmazs',
    name: 'household request 06',
    district: 'Buca',
    household: [
      {
        id: 'yilmazs-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'yilmazs-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'reliable',
    pressureWords: 'The household needs the worker to arrive at the agreed time.',
    role: 'driver',
    wage: 9000,
    wants:
      'We need a driver for the agreed hours. The household needs the worker to arrive at the agreed time.',
    arrives: 10620,
    deadline: 13320,
    x: 0.67,
    y: 0.83,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'celiks',
    name: 'household request 07',
    district: 'Bornova',
    household: [
      {
        id: 'celiks-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'celiks-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'honest',
    pressureWords: 'The worker must check the shopping change against the receipts.',
    role: 'cook',
    wage: 9500,
    wants:
      'We need a cook for the agreed hours. The worker must check the shopping change against the receipts.',
    arrives: 12180,
    deadline: 14940,
    x: 0.85,
    y: 0.26,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'ozkans',
    name: 'household request 08',
    district: 'Göztepe',
    household: [
      {
        id: 'ozkans-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'ozkans-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'patient',
    pressureWords: 'A frustrated household member repeats the instructions.',
    role: 'carer',
    wage: 9000,
    wants: 'We need a carer for the agreed hours. A frustrated household member repeats the instructions.',
    arrives: 13560,
    deadline: 16320,
    x: 0.24,
    y: 0.72,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'aydins',
    name: 'household request 09',
    district: 'Alsancak',
    household: [
      {
        id: 'aydins-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'aydins-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'warm',
    pressureWords: 'The person receiving help wants to be addressed directly.',
    role: 'nanny',
    wage: 9000,
    wants: 'We need a nanny for the agreed hours. The person receiving help wants to be addressed directly.',
    arrives: 15060,
    deadline: 17760,
    x: 0.54,
    y: 0.4,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'tass',
    name: 'household request 10',
    district: 'Buca',
    household: [
      {
        id: 'tass-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'tass-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'hardworking',
    pressureWords: 'The household asks for extra tasks.',
    role: 'housekeeper',
    wage: 8500,
    wants: 'We need a housekeeper for the agreed hours. The household asks for extra tasks.',
    arrives: 16440,
    deadline: 20700,
    x: 0.73,
    y: 0.78,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'sahins',
    name: 'household request 11',
    district: 'Karşıyaka',
    household: [
      {
        id: 'sahins-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'sahins-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'reliable',
    pressureWords: 'The household needs the worker to arrive at the agreed time.',
    role: 'driver',
    wage: 9500,
    wants:
      'We need a driver for the agreed hours. The household needs the worker to arrive at the agreed time.',
    arrives: 20700,
    deadline: 23460,
    x: 0.18,
    y: 0.27,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'ugurs',
    name: 'household request 12',
    district: 'Bornova',
    household: [
      {
        id: 'ugurs-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'ugurs-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'honest',
    pressureWords: 'The worker must check the shopping change against the receipts.',
    role: 'housekeeper',
    wage: 8500,
    wants:
      'We need a housekeeper for the agreed hours. The worker must check the shopping change against the receipts.',
    arrives: 22200,
    deadline: 25020,
    x: 0.8,
    y: 0.38,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'karas',
    name: 'household request 13',
    district: 'Göztepe',
    household: [
      {
        id: 'karas-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'karas-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'patient',
    pressureWords: 'A frustrated household member repeats the instructions.',
    role: 'nanny',
    wage: 10500,
    wants: 'We need a nanny for the agreed hours. A frustrated household member repeats the instructions.',
    arrives: 23640,
    deadline: 26400,
    x: 0.35,
    y: 0.69,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'polats',
    name: 'household request 14',
    district: 'Alsancak',
    household: [
      {
        id: 'polats-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'polats-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'discreet',
    pressureWords: 'A visitor asks about private household business.',
    role: 'cook',
    wage: 10000,
    wants: 'We need a cook for the agreed hours. A visitor asks about private household business.',
    arrives: 26580,
    deadline: 30780,
    x: 0.46,
    y: 0.49,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'tekins',
    name: 'household request 15',
    district: 'Buca',
    household: [
      {
        id: 'tekins-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'tekins-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'warm',
    pressureWords: 'The person receiving help wants to be addressed directly.',
    role: 'carer',
    wage: 9500,
    wants: 'We need a carer for the agreed hours. The person receiving help wants to be addressed directly.',
    arrives: 30840,
    deadline: 33600,
    x: 0.64,
    y: 0.74,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
  {
    id: 'inces',
    name: 'household request 16',
    district: 'Karşıyaka',
    household: [
      {
        id: 'inces-0',
        name: 'Household contact',
        who: 'adult, arranging the work',
      },
      {
        id: 'inces-1',
        name: 'Household member',
        who: 'adult, receiving help',
      },
    ],
    pressure: 'reliable',
    pressureWords: 'The household needs the worker to arrive at the agreed time.',
    role: 'driver',
    wage: 10000,
    wants:
      'We need a driver for the agreed hours. The household needs the worker to arrive at the agreed time.',
    arrives: 33720,
    deadline: 36480,
    x: 0.3,
    y: 0.22,
    secret:
      'The household has asked for a revised payment date. This is private until they choose to tell others.',
  },
];
for (const family of FAMILIES) {
  if (family.role === 'nanny') family.household[1]!.who = 'child, three';
}
const biases: Referee['bias'][] = ['cagey', 'stingy', 'fond', 'fair'];
export const REFEREES: Referee[] = CANDIDATES.map((candidate, i) => ({
  id: `ref-${candidate.id}`,
  name: `Former employer ${i + 1}`,
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
    ...castProfile('nermin'),
    skills: { interviewing: 0.75, placement: 0.7 },
    needs: { autonomy: 0.65, esteem: 0.55, safety: 0.5 },
  });
  people.derya = freshCast('derya', personSeed(seed, 'derya'), 510);
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
      traits: ['hatice', 'hulya', 'aylin'].includes(candidate.id)
        ? castProfile(candidate.id as 'hatice' | 'hulya' | 'aylin').traits
        : traits,
      values: ['hatice', 'hulya', 'aylin'].includes(candidate.id)
        ? castProfile(candidate.id as 'hatice' | 'hulya' | 'aylin').values
        : undefined,
      skills:
        candidate.id === 'hulya'
          ? { cooking: 0.75, oven: 0.75 }
          : candidate.id === 'aylin'
            ? { cooking: 0.7 }
            : candidate.id === 'hatice'
              ? { cooking: 0.65, housework: 0.65 }
              : skills,
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
        child: 3,
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
  for (const person of Object.values(people)) person.lexicon = { ...person.lexicon, plainEnglish: true };
  return people;
}
