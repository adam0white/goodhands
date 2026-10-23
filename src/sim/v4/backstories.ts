import type { Quality } from './types.ts';

// Public recollections belong to their speakers. They do not reveal seeded traits.
export const candidateMemories: Record<string, { last: string; leaving: string }> = {
  gul: {
    last: 'I still have the paper crowns they made for my birthday. One says Gül, the other says Auntie.',
    leaving: 'I took the crowns home. The spare key stayed beside their kettle.',
  },
  sevda: {
    last: 'He used to leave one boot under my chair so I could not go before his story.',
    leaving:
      'I went back for my wages with the dates written down. I left his picture book there; it was his.',
  },
  pinar: {
    last: 'The children kept the concert tickets in my blue folder. There was no space left for my own papers.',
    leaving: 'I bought another folder. This time I want the duties on the first page.',
  },
  fatma: {
    last: 'The grandfather called every soup wedding soup, even lentils. His wife would correct him from the doorway.',
    leaving:
      'I gave them the recipes in a school notebook. They asked me to come to Ankara; my life is here.',
  },
  cem: {
    last: 'The smallest boy checked every morning whether I had remembered his booster cushion.',
    leaving:
      'I went round the empty bus twice before handing it over. There were still crayons under the seats.',
  },
  ayla: {
    last: 'He wanted his good shirt on Tuesdays, though nobody came. I stopped asking why.',
    leaving: 'I showed his son which buttons he could manage himself. He wanted to keep doing those.',
  },
  emine: {
    last: 'One lodger worked nights. I left his supper in a covered bowl while everyone else ate breakfast.',
    leaving: 'They kept my big ladle for the café. I would rather have kept cooking lunches.',
  },
  murat: {
    last: 'A woman always asked for the window open, even in winter. She said the hospital smell stayed in her coat.',
    leaving:
      'I copied the appointment numbers out for the new driver. They were people who expected a familiar face.',
  },
  dilek: {
    last: 'A girl drew my certificates with crayons because she wanted a folder like mine.',
    leaving: 'I could not pay for my course on the new hours. Leaving the children was harder to explain.',
  },
  hatice: {
    last: 'The upstairs room was never used. They still wanted it cleaned before I could go downstairs.',
    leaving:
      'My father had already written our Saturday market list. I did not want him waiting another week.',
  },
  selim: {
    last: 'The director liked the radio off on the way in and the news on the way home.',
    leaving: 'He drove me to the bus stop on my last day. Neither of us knew quite what to say.',
  },
  zehra: {
    last: 'She chose the route to the sea. Some days we only went as far as the bakery; that was her choice too.',
    leaving:
      'Her sister asked where we bought our bread. I wrote the bakery down, not a timetable for their walks.',
  },
  leyla: {
    last: 'Their library books came home in my bag. My own child read them before I returned them.',
    leaving: 'We got our own library card afterwards. I still check the clock at their old collection time.',
  },
  osman: {
    last: 'He always kept the white backgammon pieces. I learned to leave them on his side of the table.',
    leaving: 'His daughter offered me the board. I have not opened it yet.',
  },
  esra: {
    last: 'I could tell which guest was leaving by which towel they left folded on the bed.',
    leaving: 'I kept being told Monday. After the fourth Monday, I started looking for work.',
  },
  safiye: {
    last: 'He marked the meals he liked with a pencil tick. The diet sheet became quite grubby.',
    leaving:
      'His daughter took that sheet with her. I made a clean copy, but he wanted the one with his ticks.',
  },
  burak: {
    last: 'At one address an old woman came downstairs for every parcel because nobody rang her bell otherwise.',
    leaving: 'The last week was quiet. I rode just as far and brought home less money.',
  },
  meltem: {
    last: 'She would tap the table when I forgot to face her. She had every right to remind me.',
    leaving:
      'She showed me the new school on a map. I was pleased for her, though it meant I could not follow.',
  },
  huriye: {
    last: 'The youngest rang me from university to ask how long rice takes. Fifteen years, and that was what he needed.',
    leaving:
      'I knew every cupboard. In the new flat they said there was no room for all their things, or for my job.',
  },
  yusuf: {
    last: 'He measured his walks by shop windows. Reaching the shoemaker was a good morning.',
    leaving: 'His sons asked for the exercise times. I told them to ask him which walk he wanted too.',
  },
  aysun: {
    last: 'The youngest crossed each collection off my schedule herself. She liked knowing who came next.',
    leaving:
      'Their mother kept the schedule on the fridge. She said she understood my afternoons better after trying one.',
  },
  nurten: {
    last: 'The station workers brought their own bread. I knew who needed a second bowl before they asked.',
    leaving:
      'We scrubbed the counter on the last afternoon. It was strange cleaning a kitchen nobody would use tomorrow.',
  },
  ergun: {
    last: 'There was a toy bus in the glove compartment. The child said I should keep it beside the real keys.',
    leaving: 'I left the toy in the car. The servicing receipts went in a separate envelope.',
  },
  feride: {
    last: 'The little one learned the grandmother’s favourite songs and sang them when the radio was off.',
    leaving:
      'They both asked whether I would visit. I said we should choose a day, rather than keep saying soon.',
  },
};

type HouseholdMemory = { voices: string[]; good: string; bad: string; quality: Quality };
// These details surface in calls and witnessed or reported household moments.
// Outcomes describe this day's response, never a permanent resolution of a private problem.
export const householdMemories: Record<string, HouseholdMemory> = {
  arslans: {
    quality: 'patient',
    voices: [
      'I ironed my work blouse twice last night. It has been three years since I needed it.',
      'I know the pharmacy hours better than the twins’ bedtime lately.',
      'Ada counts the ferries from the window.',
      'I raised children without a written schedule. Now everyone asks me to follow one.',
      'Deniz wants the same cup as Ada, even when his is full.',
    ],
    good: 'Ece left for work without coming back upstairs to settle the twins.',
    bad: 'Ece returned from the landing when she heard the breakfast argument.',
  },
  kayas: {
    quality: 'patient',
    voices: [
      'I mark schoolbooks after Father sleeps. Sometimes I wake with the pen still in my hand.',
      'I used to set this table myself. Ask me before moving my chair.',
    ],
    good: 'Kemal chose where to sit for lunch instead of having his chair moved for him.',
    bad: 'Kemal pushed his chair away and would not return to the table.',
  },
  demirs: {
    quality: 'discreet',
    voices: [
      'People at the school gate ask where the car goes at night. They never ask Onur.',
      'There is a blanket in the boot. Leave it there, please.',
      'I know the way to school. At night we take a different turn.',
    ],
    good: 'Onur left the blanket in the car without explaining it to the neighbours.',
    bad: 'İpek had another question to answer at the school gate about the night journeys.',
  },
  aks: {
    quality: 'warm',
    voices: [
      'I label the tea tins now. Rauf thinks it is for whoever helps us.',
      'They ask my wife what I want while I am sitting beside her.',
    ],
    good: 'Rauf chose the afternoon newspaper and asked for the crossword page.',
    bad: 'Rauf folded the newspaper shut when the conversation continued over him.',
  },
  erdems: {
    quality: 'hardworking',
    voices: [
      'The shop cannot close every time something spills at home.',
      'I am away so often that everyone leaves the household questions for when I return.',
      'Ela wants her picture put on the fridge.',
      'Efe hides the dustpan because he wants someone to play.',
      'The last worker knew where everything went. I still call the new one by her name.',
    ],
    good: 'Berrin crossed the agreed chores off her list before leaving for the shop.',
    bad: 'Berrin added another chore while the children were still asking for lunch.',
  },
  yilmazs: {
    quality: 'reliable',
    voices: [
      'The workshop opens after Sevil leaves. It is that hour between us that nobody can cover.',
      'I put my uniform out before bed. I cannot be the nurse who holds up the next shift.',
      'Can says the school register is not the only thing they count in the morning.',
    ],
    good: 'Sevil reached the hospital handover before the night nurse had to leave.',
    bad: 'Sevil phoned the ward from the front door to say she would be late.',
  },
  celiks: {
    quality: 'honest',
    voices: [
      'I check columns of figures all day. At home I would like to put the receipts down and stop.',
      'I still leave early. It is easier than answering questions over breakfast.',
      'İdil can tell which market stall the fruit came from by the paper bags.',
    ],
    good: 'Tülay put the checked receipts away and sat down to eat while the food was warm.',
    bad: 'Tülay let her dinner cool while checking the shopping figures again.',
  },
  ozkans: {
    quality: 'patient',
    voices: [
      'That cupboard was made for this room. People keep telling me smaller rooms are easier.',
      'I come upstairs every evening. Mother asks whether I am staying for tea each time.',
    ],
    good: 'Nesrin fetched a second teacup and asked the worker to sit beside her.',
    bad: 'Nesrin put the second teacup back and asked when her son would come.',
  },
  aydins: {
    quality: 'warm',
    voices: [
      'At the flower shop I can finish an order. At home I never know when I have finished anything.',
      'I bring flowers home, but Selda says we have enough things to water.',
      'Bora keeps one hand on his mother’s apron.',
    ],
    good: 'Selda reached the flower shop before checking her phone for the first time.',
    bad: 'Selda stayed beside the door with her coat on until Bora stopped crying.',
  },
  tass: {
    quality: 'hardworking',
    voices: [
      'I bring home bread from the bakery. Zeynep has started counting what that saves us.',
      'I can carry other people’s washing machines all day. Ours is still waiting for a part.',
      'I can help after school. Everyone hears the first half of that sentence.',
      'Ömer needs his football shirt dry by Saturday.',
    ],
    good: 'Zeynep cleared a space for her schoolbooks after the laundry was done.',
    bad: 'Zeynep closed her schoolbook to finish the washing before bed.',
  },
  sahins: {
    quality: 'reliable',
    voices: [
      'Lale asks which key she should carry. I have not given her a clear answer yet.',
      'I can measure a site to the minute, but I cannot leave it for the school gate.',
      'Lale keeps her music book in her bag even on days without a lesson.',
    ],
    good: 'Lale arrived with time to tune before her music lesson.',
    bad: 'Lale waited outside her music lesson with the book still in her bag.',
  },
  ugurs: {
    quality: 'honest',
    voices: [
      'I used to keep spare buttons in the small velvet box. Tahir still calls it my jewellery box.',
      'I count the change twice because I forget whether I have counted it.',
    ],
    good: 'Tahir put the checked change in the same drawer as the medicine receipt.',
    bad: 'Tahir emptied the medicine drawer to count the money once more.',
  },
  karas: {
    quality: 'patient',
    voices: [
      'I can leave instructions at the hospital. At home I keep rewriting them.',
      'I cook for strangers all evening. Nil saves her breakfast questions for me.',
      'Nil wants someone to watch her pour the milk herself.',
      'Mina wakes when the breakfast spoon touches the bowl.',
    ],
    good: 'Nil poured her own milk while Mina finished breakfast beside her.',
    bad: 'Nil left her milk untouched while Mina cried beside the breakfast chair.',
  },
  polats: {
    quality: 'discreet',
    voices: [
      'I set eight places every Saturday. Füsun sets a ninth and then puts it away.',
      'Guests ask questions they would never answer about themselves.',
      'I brought a small case. Sevim made room in the cupboard without asking how long.',
    ],
    good: 'Füsun stayed at the lunch table through coffee.',
    bad: 'Füsun took her coffee upstairs before the guests had finished their questions.',
  },
  tekins: {
    quality: 'warm',
    voices: [
      'At the library I can reserve a book. I wish arranging an hour of help were as simple.',
      'Tea first. After that we can discuss what I need help with.',
      'I have a coat ready by the door. It has been there all week.',
    ],
    good: 'Rukiye put on the waiting coat while İsmail and the worker finished their tea.',
    bad: 'Rukiye took off her coat and put it back beside the door.',
  },
  inces: {
    quality: 'reliable',
    voices: [
      'The children ask me about a new bedroom. I am still trying to arrange this week’s collections.',
      'I told them we would have more room. I should have spoken to Derya first.',
      'Arda draws both schools on every route map.',
      'Eylül writes changes in pencil because they keep changing again.',
    ],
    good: 'Eylül wrote the next collection in pen after both parents confirmed it.',
    bad: 'Eylül rubbed out the collection time until the paper began to tear.',
  },
};

export function householdVoice(family: string, member: number): string {
  return householdMemories[family]?.voices[member] ?? '';
}
export function householdConsequence(family: string, quality: Quality, good: boolean): string {
  const memory = householdMemories[family];
  return memory?.quality === quality ? memory[good ? 'good' : 'bad'] : '';
}
