import { authoredTraitAnswer } from './dialogue.ts';
import { outwardSigns, type Person, selfReport } from './hf4.ts';
import { QUALITIES, type Quality, type Role } from './types.ts';
import { quality, ROLE_SKILL } from './world.ts';

export {
  contextualConcern,
  personalAnswer,
  personalQuestions,
  workerDisagreement,
  workerNeed,
} from './dialogue.ts';

type Band = 'chatty' | 'quiet' | 'polished' | 'nervous' | 'blunt';
type Grade = 'good' | 'uncertain' | 'poor';
type Six = readonly [string, string, string, string, string, string];

const LABELS: Record<Role, Six> = {
  nanny: [
    'What if a child keeps crying?',
    'What if you break something?',
    'Can you get here before school?',
    'How do you meet a shy child?',
    'What do you do after the children fall asleep?',
    'What would you tell another nanny about the family?',
  ],
  cook: [
    'What if dinner is sent back?',
    'How do you account for the shopping money?',
    'Can you have lunch ready at one?',
    'What if someone eats very little?',
    'Who cleans up after dinner?',
    'What would you tell a neighbour about the household?',
  ],
  carer: [
    'What do you do if the older man throws his plate?',
    'What if you make a mistake with his routine?',
    'Can the family depend on your morning visit?',
    'How do you get to know someone in your care?',
    'What if the washing piles up?',
    'Who would you tell about his private troubles?',
  ],
  driver: [
    'What if you are kept waiting in traffic?',
    'How do you account for petrol money?',
    'Can you manage an early airport pickup?',
    'How do you help an anxious passenger?',
    'What do you do between journeys?',
    'What do you do with private conversations you hear in the car?',
  ],
  housekeeper: [
    'What if they ask you to clean the room again?',
    'What if you find money under a chair?',
    'Can they depend on you on laundry day?',
    'How do you work around people at home?',
    'What do you do if the whole house needs cleaning?',
    'What do you do with private things you see in the bedrooms?',
  ],
};

export function questions(role: Role): { id: string; label: string; quality: Quality }[] {
  return QUALITIES.map((q, index) => ({ id: `q-${q}`, label: LABELS[role][index] ?? '', quality: q }));
}

// Each answer has six authored versions at each level. Presentation changes the delivery,
// never the evidence. The engine owns how often a person has answered each question.
function lines(q: Quality, grade: Grade, role: Role): Six {
  const welcome = {
    nanny: 'I learn what makes each child feel safe.',
    cook: 'I learn what everyone likes to eat.',
    carer: 'I learn the small things that make their day easier.',
    driver: 'I check that everyone is comfortable before we set off.',
    housekeeper: 'I learn which rooms people need quiet in.',
  }[role];
  const task = {
    nanny: 'the bedtime routine',
    cook: 'the kitchen',
    carer: 'the evening washing',
    driver: 'the car',
    housekeeper: 'the laundry',
  }[role];
  const pools: Record<Quality, Record<Grade, Six>> = {
    patient: {
      good: [
        'I wait a moment. Getting angry makes it worse.',
        'I lower my voice and try again.',
        'I can wait. There is usually a reason.',
        'First I listen. We can sort the rest out slowly.',
        'I take a breath before I answer.',
        'Repeating myself is part of the work.',
      ],
      uncertain: [
        'I manage, unless it goes on all morning.',
        'I try again. Sometimes I need a minute outside.',
        'It depends how tired I am that day.',
        'I can stay patient through quite a lot.',
        'I am better if someone explains what is wrong.',
        'I usually keep my voice down.',
      ],
      poor: [
        'Once I have explained, I expect to be listened to.',
        'I cannot keep having the same argument.',
        'I would tell them to stop making a fuss.',
        'There is work to do. We cannot wait all day.',
        'I speak angrily if it keeps happening.',
        'I can do the work, but I will answer back.',
      ],
    },
    honest: {
      good: [
        'I tell them straight away, even if it costs me.',
        'I keep the receipts and return the change.',
        'I would rather admit it than have them find out later.',
        'If it is my mistake, I say it was mine.',
        'Their money stays separate from mine.',
        'I leave a note if they are out. They should hear it from me.',
      ],
      uncertain: [
        'I tell them if it is something that matters.',
        'I try to keep all the receipts.',
        'I would explain, once I had put it right.',
        'A small mistake is sometimes better fixed quietly.',
        'I do not like being questioned over every coin.',
        'I would first want to know how they might react.',
      ],
      poor: [
        'If no harm is done, why upset everyone?',
        'Small things disappear in every house.',
        'I would put it right without mentioning it.',
        'They can afford to lose a little change.',
        'I would say it was like that when I arrived.',
        'There is no need to tell them everything.',
      ],
    },
    reliable: {
      good: [
        'I check the route the night before.',
        'I leave time for a missed bus.',
        'If there is trouble, I phone before they are waiting.',
        'Once I agree a time, I arrange my day around it.',
        'I write the hours down and check them back.',
        'They will know ahead of time if I cannot come.',
      ],
      uncertain: [
        'I usually arrive on time, though the buses can be difficult.',
        'I can manage if the hours stay the same.',
        'I would try to telephone if I was running late.',
        'I need a little notice for an early start.',
        'Some mornings are harder to arrange than others.',
        'I have been late, but never by very much.',
      ],
      poor: [
        'They will have to allow a little flexibility.',
        'I cannot promise the same time every morning.',
        'Sometimes something more urgent comes up.',
        'I do not like having to keep exact hours.',
        'If I am late, they can wait a few minutes.',
        'I might need to leave early without much notice.',
      ],
    },
    warm: {
      good: [
        welcome,
        'I ask how they like things before I start.',
        'I sit and listen if someone needs company.',
        'I remember the little things they tell me.',
        'I give people time to get used to me.',
        'I notice when someone has gone quiet.',
      ],
      uncertain: [
        'I am friendly once I know people.',
        'I do the work first. We get acquainted later.',
        'I am not always sure what to say.',
        'Some people like me straight away. Others need time.',
        'I help if they ask me.',
        'I prefer them to tell me what they need.',
      ],
      poor: [
        'I am there to work, not to make friends.',
        'I prefer everyone to let me work alone.',
        'I do not have time to sit and listen.',
        'They must say what they want. I cannot guess.',
        'I keep my distance. It is easier that way.',
        'I do not get involved when people are upset.',
      ],
    },
    hardworking: {
      good: [
        `I finish ${task} before I sit down.`,
        'I look for what needs doing next.',
        'I make a list so the small jobs do not get forgotten.',
        'I put things ready for the next morning.',
        'I do the awkward jobs before they pile up.',
        'If something needs a second go, I do it again.',
      ],
      uncertain: [
        `I do ${task}, if there is time.`,
        'I finish the main jobs. The rest may have to wait.',
        'I work better with a clear list.',
        'Some days I get more done than others.',
        'I will need someone to show me their way first.',
        'I do what we agreed, and ask about anything extra.',
      ],
      poor: [
        `I would leave ${task} until tomorrow.`,
        'I do enough to keep things going.',
        'If nobody notices, it can wait.',
        'I need plenty of breaks to get through a day.',
        'I do not go looking for extra work.',
        'They would need to remind me about the small jobs.',
      ],
    },
    discreet: {
      good: [
        'I say I cannot discuss another household.',
        'I keep what happens in the household private.',
        'I would talk to the family, not the neighbours.',
        'I would ask before passing on a private message.',
        'I do not share their private troubles.',
        'I can talk about my work without naming people.',
      ],
      uncertain: [
        'I might ask someone for advice, without names.',
        'I do not repeat the serious things.',
        'I sometimes talk to my sister about a difficult day.',
        'I would need to know what they consider private.',
        'People ask questions. I try not to say much.',
        'I have shared private information by mistake before. I regretted it.',
      ],
      poor: [
        'People find out anyway. It is a small city.',
        'If they ask me, I tell them what I know.',
        'My friends and I compare the houses we work in.',
        'A good story helps the day pass.',
        'I would tell you. You should know who you are dealing with.',
        'I do not see the harm if it is true.',
      ],
    },
  };
  return pools[q][grade];
}

function bandOf(presentation: string): Band {
  if (/quiet|reserved|shy/i.test(presentation)) return 'quiet';
  if (/polished|smooth/i.test(presentation)) return 'polished';
  if (/nervous|anxious/i.test(presentation)) return 'nervous';
  if (/blunt|direct|plain/i.test(presentation)) return 'blunt';
  return 'chatty';
}

function deliver(text: string, band: Band, index: number): string {
  const openings: Record<Exclude<Band, 'quiet'>, Six> = {
    chatty: [
      'Well, I will tell you: ',
      'You know, ',
      'I was just thinking about that: ',
      'That comes up often: ',
      'Let me put it this way: ',
      'We were talking about this yesterday: ',
    ],
    polished: [
      'My approach is straightforward: ',
      'I have a clear rule: ',
      'I can be quite clear: ',
      'I take it seriously: ',
      'I would explain it this way: ',
      'To answer your question: ',
    ],
    nervous: [
      'Let me think: ',
      'I hope I can explain this: ',
      'I have not been asked that before, but ',
      'Well, ',
      'I do not know how to put it, but ',
      'If I understand you, ',
    ],
    blunt: [
      'Look, ',
      'Simply put: ',
      'I will be direct: ',
      'Here is my answer: ',
      'It is simple: ',
      'To be clear: ',
    ],
  };
  return band === 'quiet' ? text : `${openings[band][index]}${text}`;
}

type InterviewCondition = {
  fatigue: number;
  fear: number;
  pain: number;
  mood?: number;
};

function notice(person: Pick<Person, 'name'>, signs: InterviewCondition, variant: number): string {
  let pool: Six;
  if (signs.fatigue > 0.3) {
    pool = [
      '{possessive} eyelids droop between answers.',
      '{person} stifles a yawn behind one hand.',
      '{person} rubs {possessive} eyes before continuing.',
      '{possessive} shoulders settle lower in the chair.',
      '{person} blinks slowly, then sits up again.',
      '{person} pauses before starting the next sentence.',
    ];
  } else if (signs.fear > 0.2) {
    pool = [
      '{possessive} fingers hold the edge of the chair.',
      '{person} looks towards the door before answering.',
      '{possessive} voice catches on the first word.',
      '{person} presses {possessive} palms together in {possessive} lap.',
      '{person} takes a shallow breath before continuing.',
      '{possessive} hands move, then go still.',
    ];
  } else if (signs.pain > 0.2) {
    pool = [
      '{person} shifts {possessive} weight carefully in the chair.',
      '{person} winces before settling again.',
      '{person} moves one shoulder with care.',
      '{person} pauses to find a more comfortable position.',
      '{possessive} face tightens as {person} sits forward.',
      '{person} braces a hand on the chair before moving.',
    ];
  } else if ((signs.mood ?? 0) < -0.15) {
    pool = [
      '{possessive} mouth tightens after the answer.',
      '{person} looks down at {possessive} hands for a moment.',
      'The last words come out quietly.',
      '{person} lets out a long breath.',
      '{possessive} face still looks tired as {person} waits.',
      '{person} looks away before the next question.',
    ];
  } else if ((signs.mood ?? 0) > 0.15) {
    pool = [
      '{person} keeps a small smile after answering.',
      '{possessive} face brightens as {person} speaks.',
      '{person} settles easily into the chair.',
      '{person} meets Nermin’s eyes and smiles.',
      '{possessive} shoulders loosen as {person} continues.',
      '{person} gives a brief, easy laugh.',
    ];
  } else {
    pool = [
      'Nermin cannot read much from {possessive} expression.',
      '{possessive} expression does not show much.',
      '{person} finishes speaking and waits.',
      '{possessive} expression stays much the same.',
      'Nermin watches, but sees no clear change.',
      '{person} pauses before the next question.',
    ];
  }
  return (pool[variant] ?? pool[0])
    .replaceAll('{possessive}', `${person.name}’s`)
    .replaceAll('{person}', person.name);
}

export function answer(
  person: Person,
  presentation: string,
  role: Role,
  questionId: string,
  variant: number,
): { text: string; quality: Quality; claim: number; notice: string } {
  const q = QUALITIES.find((item) => `q-${item}` === questionId) ?? 'reliable';
  return answerFromReadings(
    person,
    { outwardSigns: outwardSigns(person), selfReport: selfReport(person) },
    {
      quality: quality(person, q),
      skill: person.skills[ROLE_SKILL[role]]?.level ?? 0,
      honesty: person.traits.honesty,
    },
    presentation,
    role,
    questionId,
    variant,
  );
}

/** The HF4 bridge supplies explicit condition projections. Host dialogue owns the claims. */
export function answerFromReadings(
  person: { id: string; name: string },
  condition: { outwardSigns: InterviewCondition; selfReport: InterviewCondition },
  character: { quality: number; skill: number; honesty: number },
  presentation: string,
  role: Role,
  questionId: string,
  variant: number,
): { text: string; quality: Quality; claim: number; notice: string } {
  const q = QUALITIES.find((item) => `q-${item}` === questionId) ?? 'reliable';
  const band = bandOf(presentation);
  // Each person starts from their own place in the six versions, so two people at the same
  // grade do not repeat each other word for word. The grade and the evidence are unchanged.
  const offset = [...person.id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 6, 0);
  const index = (((Math.trunc(variant) + offset) % 6) + 6) % 6;
  const report = condition.selfReport;
  // HF selfReport covers condition, not character. Character claims are host-authored
  // from HF traits/skills via quality(), with concealment and modesty applied here.
  const strain = report.fatigue * 0.08 + report.pain * 0.04 + report.fear * 0.06;
  const skill = character.skill;
  const skillWeight = q === 'patient' || q === 'hardworking' ? 0.12 : 0;
  const truth = character.quality * (1 - skillWeight) + skill * skillWeight;
  const honesty = character.honesty;
  const ideal = 0.9;
  const concealment = Math.max(0, (0.65 - honesty) / 0.65);
  let claim = (honesty < 0.35 ? ideal : truth + (ideal - truth) * concealment) - strain;
  if (band === 'quiet') claim -= 0.19;
  if (band === 'nervous') claim -= 0.09;
  if (band === 'polished') claim += 0.06;
  claim = Math.max(0.05, Math.min(0.97, claim));
  const grade: Grade = claim >= 0.62 ? 'good' : claim >= 0.38 ? 'uncertain' : 'poor';
  const text =
    authoredTraitAnswer(person.id, q, grade) ??
    (q === 'reliable'
      ? (lines(q, grade, role)[index] ?? '')
      : deliver(lines(q, grade, role)[index] ?? '', band, index));
  return {
    text,
    quality: q,
    claim,
    notice: notice(person, condition.outwardSigns, index),
  };
}
