import type { Quality, Role } from './types.ts';
import { CANDIDATES } from './world.ts';

interface Voice {
  lastFamily: string;
  whyLeft: string;
  hours: string;
  need: string;
  reason: string;
  finishBy: number;
  patience: string;
}

// Public accounts and working boundaries, not hidden character. A good story is
// still only something the candidate says. These stay attached to the speaker
// when the seed changes their HF traits.
const VOICES: Record<string, Voice> = {
  gul: {
    lastFamily:
      'Three years with twins, can you imagine? One wanted a story while the other wanted breakfast.',
    whyLeft:
      'Their aunt moved in, so there were two of us giving orders in one kitchen. You can guess how that went.',
    hours: 'Mornings suit me. I can stay until six, but tell me before lunch if you need longer.',
    need: 'I want Sundays to myself. My daughter comes with the children, and I am not missing that for another family.',
    reason: 'Sunday visits with my daughter and grandchildren',
    finishBy: 18 * 60,
    patience: 'With twins, I let the first child finish crying before asking the second what happened.',
  },
  sevda: {
    lastFamily: 'A little boy, from six months until school. Mrs Uslu can tell you.',
    whyLeft: 'Two months of wages were late. She did not like me asking for them.',
    hours: 'Eight until six. I need the 18:10 bus because my mother is alone at home.',
    need: 'I need the 18:10 bus. My mother is alone; I cannot leave her waiting all evening.',
    reason: 'the 18:10 bus; my mother is alone at home',
    finishBy: 18 * 60,
    patience: 'I sat beside him. He stopped crying when he was ready.',
  },
  pinar: {
    lastFamily:
      'A waterfront household: school collections, meals and a fairly demanding calendar. I can give you the reference.',
    whyLeft:
      'The position expanded beyond our agreement. I prefer to settle the duties before accepting another one.',
    hours: 'Nine until six, agreed in writing. Extra evenings need notice.',
    need: 'I want a defined role. If I am hired for the children, the whole house cannot quietly become my job.',
    reason: 'the duties we agree before I start',
    finishBy: 18 * 60,
    patience:
      'I give a child two clear choices and time to choose. Raising my voice would defeat the purpose.',
  },
  fatma: {
    lastFamily: 'Eight at the table. Two separate pots because the grandfather could not eat salt.',
    whyLeft: 'They moved to Ankara. I did not.',
    hours: 'Seven until five. If they want dinner later, I can leave it ready.',
    need: 'A kitchen budget before I shop. I will not keep buying their food with my own money.',
    reason: 'shopping money supplied before I go to the market',
    finishBy: 17 * 60,
    patience: 'I ask what is wrong with the food before I put another pot on.',
  },
  cem: {
    lastFamily:
      'A school minibus. Twelve children, twelve different ideas about which radio station to play.',
    whyLeft: 'They sold the second minibus. I was the newer driver, so that was that.',
    hours: 'Early starts are fine. Finish by seven, unless we have arranged an airport run.',
    need: 'Tell me the journeys the night before. My son borrows the car for his evening class; we need to arrange it.',
    reason: 'advance notice so my son can get to evening class',
    finishBy: 19 * 60,
    patience:
      'In the minibus I pull over before sorting out an argument. Nobody listens while I am shouting over the engine.',
  },
  ayla: {
    lastFamily: 'I helped an older man wash and dress. His daughter was there at night.',
    whyLeft: 'He went to live with his son.',
    hours: 'Eight until five. No overnight stays.',
    need: 'Someone must take over before I leave. I will not leave a person alone who cannot get out of the chair.',
    reason: 'a relative taking over before I leave',
    finishBy: 17 * 60,
    patience: 'I move the plate out of reach. Then I wait with him.',
  },
  emine: {
    lastFamily: 'A boarding house, twenty mouths when it was full! Someone always wanted more soup.',
    whyLeft: 'The owner retired and her son wanted a café instead. Cakes all day; no thank you.',
    hours: 'I start at seven. By five the evening meal will be ready for them to warm.',
    need: 'Let me cook proper meals. I do not want a house where nobody tells me they will be eating out.',
    reason: 'knowing how many people will eat before I cook',
    finishBy: 17 * 60,
    patience: 'I take the bowl away without an argument. An empty stomach changes its mind soon enough.',
  },
  murat: {
    lastFamily:
      'Hospital journeys with the same patients most weeks. I kept the appointment times in this notebook.',
    whyLeft: 'The clinic gave the work to a transport company.',
    hours: 'Eight until six. Hospital appointments can run late; I need a call before adding another trip.',
    need: 'No lifting a person on my own. Two people or the proper equipment.',
    reason: 'another person helping with any lifting',
    finishBy: 18 * 60,
    patience:
      'I stop the car somewhere safe. We can be late to the appointment; we cannot have a fight on the road.',
  },
  dilek: {
    lastFamily: 'I assisted in the younger room at a nursery. My certificates are here.',
    whyLeft: 'The next contract offered fewer hours. I need a full wage.',
    hours: 'Eight until five. My course meets two evenings each week.',
    need: 'I want to keep my Tuesday and Thursday classes. They are part of qualifying for this work.',
    reason: 'my Tuesday and Thursday evening classes',
    finishBy: 17 * 60,
    patience: 'At nursery we sat at the child’s level. I would try that before introducing another activity.',
  },
  hatice: {
    lastFamily: 'Three floors. I did one floor each morning, then the washing.',
    whyLeft: 'They wanted six days for the same money as five.',
    hours: 'Eight until five. It is a long bus ride.',
    need: 'Five days, please. On Saturday I take my father to the market.',
    reason: 'Saturdays with my father',
    finishBy: 17 * 60,
    patience: 'I ask which part needs doing again. Then I look at it with them.',
  },
  selim: {
    lastFamily: 'A company director and his wife. I maintained the car as well as driving it.',
    whyLeft: 'The director retired and began driving himself. We parted on good terms.',
    hours: 'Seven until six. Late journeys by arrangement, with the return time agreed.',
    need: 'One person should give me the day’s route. I cannot follow three contradictory sets of instructions.',
    reason: 'one agreed list of journeys',
    finishBy: 18 * 60,
    patience:
      'I tell the passenger the likely delay and offer another route. The traffic cannot hear my complaints.',
  },
  zehra: {
    lastFamily: 'A woman who used a wheelchair. We used to go down to the sea when the pavement was dry.',
    whyLeft: 'Her sister moved in to help. There was no longer a full day’s work for me.',
    hours: 'Eight until six. I can start later if they need company through supper.',
    need: 'A proper lunch break, even a short one. I cannot eat standing over someone’s bed every day.',
    reason: 'a lunch break away from the bedside',
    finishBy: 18 * 60,
    patience:
      'I would ask if the plate was too hot. Sometimes what sounds like anger is a small thing nobody has noticed.',
  },
  leyla: {
    lastFamily: 'Two schoolchildren. Lunch, homework, then dinner before their parents returned.',
    whyLeft: 'The children started staying at school until evening.',
    hours: 'Eight until five. I collect my own child after that.',
    need: 'I must leave at five to collect my child. Someone has to be there for mine, too.',
    reason: 'collecting my own child at five',
    finishBy: 17 * 60,
    patience: 'I put the homework aside for ten minutes. Hunger and fractions are a bad combination.',
  },
  osman: {
    lastFamily: 'We walked and played backgammon, my neighbour and I. Later I helped him dress.',
    whyLeft: 'He died in August.',
    hours: 'Mornings until four. I do not stay overnight.',
    need: 'I would like a house close enough to walk to. I can work longer than I can stand on a crowded bus.',
    reason: 'a journey I can manage on foot',
    finishBy: 16 * 60,
    patience: 'I leave the pieces on the board. We can finish the game later.',
  },
  esra: {
    lastFamily: 'A guesthouse. Laundry, room checks and keeping the linen cupboard in order.',
    whyLeft: 'They closed for renovation. The reopening date kept changing.',
    hours: 'Eight until six, with a regular day off.',
    need: 'Pay on a fixed date. I have rent to arrange; “next week” is not a date.',
    reason: 'wages on the agreed date',
    finishBy: 18 * 60,
    patience: 'I ask them to point out what they want changed. That gives us something definite to resolve.',
  },
  safiye: {
    lastFamily: 'A man with diabetes. I cooked his meals and left each portion marked.',
    whyLeft: 'His daughter took him to live with her.',
    hours: 'Seven until five. I can prepare supper before I go.',
    need: 'Give me the dietary instructions directly. I will not guess from what a neighbour remembers.',
    reason: 'clear dietary instructions from the family',
    finishBy: 17 * 60,
    patience: 'I find out whether he feels ill before arguing about what he has eaten.',
  },
  burak: {
    lastFamily: 'Deliveries round Göztepe. I know which streets look wide until two vans meet in them.',
    whyLeft: 'They paid by the parcel. A quiet week still costs me the same rent.',
    hours: 'Eight until seven. Just tell me when the last journey is actually the last journey.',
    need: 'A fixed monthly wage. I came here to stop counting parcels before I can buy groceries.',
    reason: 'a fixed monthly wage instead of payment per journey',
    finishBy: 19 * 60,
    patience: 'I park and phone. Going round the same block angrily only uses more petrol.',
  },
  meltem: {
    lastFamily: 'A child with hearing loss. We faced each other when we spoke.',
    whyLeft: 'They moved nearer her school. Too far for me.',
    hours: 'Eight until six. I need the finish time to stay the same.',
    need: 'Let the child meet me before deciding. Not just the parents.',
    reason: 'meeting the child before accepting the place',
    finishBy: 18 * 60,
    patience: 'I make sure she can see my face. Then I say it again.',
  },
  huriye: {
    lastFamily:
      'Fifteen years in one house. I knew where the spare key was before their youngest could walk.',
    whyLeft: 'They sold the house. An apartment does not need me six days a week, apparently.',
    hours: 'Seven until five. I like to get the market done before the queue starts.',
    need: 'A house that wants someone to stay. I do not want to start again every few months at my age.',
    reason: 'steady work beyond the first month',
    finishBy: 17 * 60,
    patience: 'After fifteen years you learn which complaint needs an answer and which needs a cup of tea.',
  },
  yusuf: {
    lastFamily:
      'A man recovering from a stroke. Exercises, meals, and short walks when he could manage them.',
    whyLeft: 'His sons arranged residential care.',
    hours: 'Eight until six. I can drive to appointments during those hours.',
    need: 'Tell me what the doctor actually recommended. I will not force someone to walk because a relative says so.',
    reason: 'care instructions agreed with the person’s doctor',
    finishBy: 18 * 60,
    patience: 'I let him set the walking pace. Getting to the corner tomorrow is still getting there.',
  },
  aysun: {
    lastFamily:
      'Three siblings after school. Each had a different collection time, so I kept a written schedule.',
    whyLeft: 'Their mother changed jobs and began working at home.',
    hours: 'Eight until six. Changes to collection times must reach me before I leave the house.',
    need: 'I need the parents to agree on the rules. I cannot enforce one rule and be blamed by the other parent.',
    reason: 'both parents agreeing on the children’s rules',
    finishBy: 18 * 60,
    patience:
      'I separate the argument from the child. We can settle whose turn it was after everyone has calmed down.',
  },
  nurten: {
    lastFamily: 'The lunch counter near the station. Soup, beans and rice, every day.',
    whyLeft: 'It closed. The rent went up.',
    hours: 'Seven until four. I can leave dinner ready.',
    need: 'No split shifts. Once I go home, I need to stay home.',
    reason: 'one continuous shift with no evening return',
    finishBy: 16 * 60,
    patience: 'I ask if they want something else. There is usually soup.',
  },
  ergun: {
    lastFamily: 'One family car: school run, shopping, servicing. I cleaned it too.',
    whyLeft: 'They moved abroad and took the car.',
    hours: 'Seven until six. A late return needs to be arranged before that morning.',
    need: 'If the car needs a repair, they pay the garage. I will not advance the money.',
    reason: 'the household paying directly for car repairs',
    finishBy: 18 * 60,
    patience: 'I wait somewhere I can park legally. I tell them where I am.',
  },
  feride: {
    lastFamily:
      'A grandmother who wanted the radio on and her granddaughter who wanted it off. I heard every programme twice.',
    whyLeft: 'The grandmother moved to her daughter’s. The little one started full-time school.',
    hours: 'Eight until six. I can do a Saturday if we agree on another day off.',
    need: 'One full day off every week. My sisters expect me for lunch; they will come looking if I disappear.',
    reason: 'one full day off each week',
    finishBy: 18 * 60,
    patience: 'I let them each tell me their version. Usually the radio was only half the argument.',
  },
};

const PERSONAL_QUESTIONS = [
  { id: 'wage', label: 'What wage do you need?' },
  { id: 'last-family', label: 'Tell me about your last job' },
  { id: 'hours', label: 'What hours can you work?' },
  { id: 'home', label: 'Where will you travel from?' },
  { id: 'why-left', label: 'Why did you leave?' },
  { id: 'need', label: 'What must the next family agree to?' },
] as const;

export function personalQuestions(candidateId: string): { id: string; label: string }[] {
  return VOICES[candidateId] ? PERSONAL_QUESTIONS.map((question) => ({ ...question })) : [];
}

export function personalAnswer(candidateId: string, questionId: string): string {
  const candidate = CANDIDATES.find((person) => person.id === candidateId);
  const voice = VOICES[candidateId];
  if (!candidate || !voice) return '';
  switch (questionId) {
    case 'wage':
      return `₺${candidate.wage} a month.${candidate.presentation === 'chatty' ? ' I need to know what is coming in, same as anyone.' : ''}`;
    case 'last-family':
      return voice.lastFamily;
    case 'why-left':
      return voice.whyLeft;
    case 'hours':
      return voice.hours;
    case 'home':
      return `${candidate.home}. About ${candidate.commute} minutes from here.`;
    case 'need':
      return voice.need;
    default:
      return '';
  }
}

export function workerNeed(candidateId: string): { words: string; finishBy: number; reason: string } {
  const voice = VOICES[candidateId];
  if (!voice) throw new Error(`No authored worker need for ${candidateId}`);
  return { words: voice.need, finishBy: voice.finishBy, reason: voice.reason };
}

export function workerDisagreement(candidateId: string, familyName: string, toldNermin = false): string {
  const voice = VOICES[candidateId];
  if (!voice) return '';
  if (candidateId === 'sevda') {
    return `${familyName === 'the Arslans' ? 'Saadet' : 'The family'} wanted the windows done before I left. I left at six for my 18:10 bus${toldNermin ? ', as I told you I needed to' : ' because my mother is alone'}; ${familyName === 'the Arslans' ? 'she was' : 'they were'} not pleased.`;
  }
  return `${familyName} asked me to change what we agreed today. ${toldNermin ? 'As I told you, I need' : 'I need'} ${voice.reason}; please settle that before my next shift.`;
}

const PATIENCE_LIMITS: Record<string, readonly [string, string]> = {
  gul: [
    'Twins can wear anyone down. I sometimes sent one to their father while I settled the other.',
    'Two children shouting at once? I tell them neither gets anything until they stop.',
  ],
  sevda: [
    'I sat beside him. I think it helped. Some days I needed a minute outside.',
    'I can sit beside him a while. Not all morning.',
  ],
  pinar: [
    'Two clear choices usually work. If neither is accepted, I would need the parents to intervene.',
    'I set out the choices clearly. I do expect a child to accept one of them.',
  ],
  fatma: [
    'I can cook it again. Not three different dinners in one evening.',
    'They can tell me what is wrong with the food. Sending plates back makes me sharp.',
  ],
  cem: [
    'Twelve children test you. Most days I kept my temper; the afternoon run was harder.',
    'After a day in that minibus, I have no patience for another argument in the car.',
  ],
  ayla: [
    'I move the plate. Sometimes I need someone else to sit with him a minute.',
    'I move the plate away. I cannot keep clearing food off the floor.',
  ],
  emine: [
    'I can offer soup instead. By the third rejected bowl, I want someone else to ask.',
    'There are twenty people waiting to eat. I will not argue over one bowl.',
  ],
  murat: [
    'I pull over. If the passenger keeps shouting, I call their relative.',
    'I have other patients waiting. I tell them we cannot spend the day arguing.',
  ],
  dilek: [
    'At nursery there was another adult to help. Alone, I might need a little longer to settle things.',
    'In nursery they learned when an activity was over. I would expect that at home too.',
  ],
  hatice: [
    'I will do the room again if they show me what they want. Not if they just keep saying it is wrong.',
    'Three floors to finish. They cannot keep sending me back to the same room.',
  ],
  selim: [
    'I explain the delay. Repeated criticism of my route can get to me.',
    'I chose the route. Repeated advice from the back seat will get an answer.',
  ],
  zehra: [
    'I ask if something hurts. If nothing helps, I need a short break myself.',
    'I cannot spend the whole meal persuading someone to take one mouthful.',
  ],
  leyla: [
    'A break usually helps with homework. Unless we have already lost the whole afternoon.',
    'There is dinner to cook as well. I will not spend an hour arguing about one sum.',
  ],
  osman: [
    'I leave the game for a while. Sometimes I go quiet myself.',
    'If he sweeps the pieces off the board, we are finished playing.',
  ],
  esra: [
    'I ask which part needs changing. I find vague complaints difficult to answer calmly.',
    'If they want the room changed again, they should have given proper instructions.',
  ],
  safiye: [
    'I check whether he feels ill. Refusing every meal still wears me down.',
    'I cooked what was on the diet sheet. I cannot keep cooking alternatives.',
  ],
  burak: [
    'I park and phone. I do get annoyed if nobody answers after asking me to hurry.',
    'If they keep me waiting outside, I will tell them exactly how long I have been there.',
  ],
  meltem: [
    'I face her and repeat it. I sometimes need a quiet minute too.',
    'I repeat it once. After that, I need someone else to help.',
  ],
  huriye: [
    'Fifteen years teaches patience, mostly. Some mornings the same complaint still got to me.',
    'After fifteen years I had heard enough complaints about the same cupboard. I said so.',
  ],
  yusuf: [
    'I let him choose the pace. I do find it hard when he refuses to try at all.',
    'He needs to do the exercises. I get cross when we have the same refusal every morning.',
  ],
  aysun: [
    'I hear both children out. If the argument continues, I ask a parent to step in.',
    'I give each child a turn to speak. Then I expect the argument to end.',
  ],
  nurten: [
    'I offer soup. Sometimes that is all I can think to do.',
    'There is soup or the main meal. I will not cook a third choice.',
  ],
  ergun: [
    'I find somewhere to park. If they keep changing the pickup time, I can get short with them.',
    'I arrived at the agreed time. They should be ready instead of keeping me waiting.',
  ],
  feride: [
    'I hear both sides. By evening, two versions of every little argument can wear me out.',
    'The radio argument again? I would switch it off and tell them I had heard enough.',
  ],
};

export function authoredTraitAnswer(
  candidateId: string,
  quality: Quality,
  grade: 'good' | 'uncertain' | 'poor',
): string | undefined {
  if (quality !== 'patient') return undefined;
  if (grade === 'good') return VOICES[candidateId]?.patience;
  return PATIENCE_LIMITS[candidateId]?.[grade === 'uncertain' ? 0 : 1];
}

export function contextualConcern(candidateId: string, role: Role): { concern: string; promise: string } {
  const task: Record<Role, string> = {
    nanny: 'settling the children before leaving',
    cook: 'having supper ready before leaving',
    carer: 'handing over care before leaving',
    driver: 'finishing the last journey before leaving',
    housekeeper: 'finishing the agreed rooms before leaving',
  };
  const voice = VOICES[candidateId];
  const hour = voice ? Math.floor(voice.finishBy / 60) : 18;
  return {
    concern: `I am unsure about ${task[role]} by ${String(hour).padStart(2, '0')}:00.`,
    promise: `Tell them you can finish everything by ${String(hour).padStart(2, '0')}:00.`,
  };
}
