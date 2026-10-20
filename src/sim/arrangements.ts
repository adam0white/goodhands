import { workerNeed } from './dialogue.ts';
import { CANDIDATES } from './world.ts';

type Moment =
  | 'finish'
  | 'funds'
  | 'handover'
  | 'instructions'
  | 'break'
  | 'day-off'
  | 'pay'
  | 'route'
  | 'duties';

interface ArrangementSpec {
  request: string;
  terms: string;
  test: string;
  at: number;
  workerKept: string;
  workerBroken: string;
  familyKept: string;
  familyBroken: string;
  moment: Moment;
}

interface Terms {
  moment: Moment;
  minute: number;
  weekday?: number[];
  request: string;
  terms: string;
  test: string;
  workerKept: string;
  workerBroken: string;
  familyKept: string;
  familyBroken: string;
}

const TERMS: Record<string, Terms> = {
  gul: {
    moment: 'day-off',
    minute: 720,
    weekday: [6],
    request: 'Keep Sunday free for Gül’s daughter and grandchildren.',
    terms: 'Gül has Sundays off to see her daughter and grandchildren.',
    test: 'Will Gül have Sunday lunch with her grandchildren?',
    workerKept:
      'The children are here and I have not had one call asking me to come in. We can eat our lunch in peace.',
    workerBroken:
      'My daughter brought the children over, and then the family asked me to come in. You knew Sunday was mine.',
    familyKept: 'We arranged Sunday ourselves. Gül has the day off.',
    familyBroken: 'We needed help today and asked Gül to come in after all.',
  },
  sevda: {
    moment: 'finish',
    minute: 1080,
    request: 'Let Sevda leave at 18:00 for the 18:10 bus; her mother is alone.',
    terms: 'Sevda leaves at 18:00 to catch the 18:10 bus home to her mother.',
    test: 'Will Sevda catch the 18:10 bus home to her mother?',
    workerKept: 'They took over at six. I caught the 18:10 bus; my mother was waiting.',
    workerBroken:
      'They asked me to finish the kitchen after six. I missed the 18:10 bus and my mother was alone.',
    familyKept: 'We took over at six, as arranged. Sevda left for her bus.',
    familyBroken: 'The kitchen was still unfinished at six. We asked Sevda to stay.',
  },
  pinar: {
    moment: 'duties',
    minute: 600,
    request: 'Keep Pınar’s work to the duties agreed before she started.',
    terms: 'Pınar does the agreed duties; extra household work must be discussed first.',
    test: 'Will Pınar be asked to do work outside the agreed role?',
    workerKept: 'The list matched our agreement. There were no extra household duties slipped into it.',
    workerBroken:
      'They added the whole flat to my list. That is exactly the expansion I asked you to prevent.',
    familyKept: 'We kept the work to the duties we agreed.',
    familyBroken: 'There was other work that needed doing, so we added it to the list.',
  },
  fatma: {
    moment: 'funds',
    minute: 540,
    request: 'Give Fatma the shopping budget before she goes to the market.',
    terms: 'The household gives Fatma shopping money before each market trip.',
    test: 'Will Fatma get the shopping money before the market trip?',
    workerKept: 'The shopping money was ready. I bought their food with their money.',
    workerBroken: 'No shopping money again. They expected me to pay and claim it back.',
    familyKept: 'We left the shopping money ready before Fatma set out.',
    familyBroken: 'We had no cash ready and asked Fatma to cover the shopping.',
  },
  cem: {
    moment: 'route',
    minute: 1080,
    request: 'Give Cem tomorrow’s journeys before he arranges the car with his son.',
    terms:
      'Cem receives the next day’s journeys the evening before, so he and his son can arrange transport.',
    test: 'Will Cem get tomorrow’s journeys in time to arrange his son’s evening class?',
    workerKept: 'Tomorrow’s trips are written down. My son and I have sorted out how he gets to class.',
    workerBroken:
      'They still will not tell me tomorrow’s journeys. My son cannot arrange his class around a guess.',
    familyKept: 'We gave Cem tomorrow’s journeys before the evening.',
    familyBroken: 'We have not decided tomorrow’s journeys yet. Cem will have to wait.',
  },
  ayla: {
    moment: 'handover',
    minute: 1020,
    request: 'Have a relative take over before Ayla leaves at 17:00.',
    terms: 'A relative takes over care at 17:00 before Ayla leaves.',
    test: 'Will someone arrive to take over care before Ayla leaves?',
    workerKept: 'His daughter arrived before five. I told her how the day went and left him with her.',
    workerBroken: 'Nobody came to take over at five. I could not leave him alone in that chair.',
    familyKept: 'A relative arrived before five and took over care.',
    familyBroken: 'Nobody could get there at five. We expected Ayla to wait with him.',
  },
  emine: {
    moment: 'instructions',
    minute: 540,
    request: 'Tell Emine how many people will eat before she starts cooking.',
    terms: 'The household confirms the number eating before Emine begins the meal.',
    test: 'Will Emine know how many people to cook for?',
    workerKept: 'They told me four for supper before I put the pot on. Four portions, no guessing.',
    workerBroken:
      'I had the meal cooking before anyone mentioned they were all going out. A whole pot for nobody.',
    familyKept: 'We confirmed who would eat before Emine started cooking.',
    familyBroken: 'Our supper plans changed after Emine began cooking. We forgot to tell her.',
  },
  murat: {
    moment: 'handover',
    minute: 600,
    request: 'Provide a second person or proper equipment when Murat needs to lift someone.',
    terms: 'Murat has another person or appropriate equipment for any lifting.',
    test: 'Will Murat have help for the morning transfer?',
    workerKept: 'Someone helped with the transfer. Neither of us had to take his whole weight alone.',
    workerBroken:
      'They asked me to lift him alone. I said we needed another person or the equipment we agreed.',
    familyKept: 'We arranged help for the transfer.',
    familyBroken: 'No one was free to help. We asked Murat to manage the transfer alone.',
  },
  dilek: {
    moment: 'finish',
    minute: 1020,
    weekday: [1, 3],
    request: 'Let Dilek leave at 17:00 for her Tuesday and Thursday classes.',
    terms: 'Dilek leaves at 17:00 on Tuesdays and Thursdays to attend her course.',
    test: 'Will Dilek leave in time for her evening class?',
    workerKept: 'I left at five and got to class. They treated it as part of our agreement.',
    workerBroken:
      'They asked me to stay through the class. I told you those evenings were part of qualifying.',
    familyKept: 'We took over at five so Dilek could attend her course.',
    familyBroken: 'We needed Dilek this evening and asked her to miss the class.',
  },
  hatice: {
    moment: 'day-off',
    minute: 600,
    weekday: [5],
    request: 'Keep Saturday free so Hatice can take her father to the market.',
    terms: 'Hatice works five days and keeps Saturday free for her father.',
    test: 'Will Hatice have Saturday free to take her father to the market?',
    workerKept: 'I took my father to the market. Nobody asked me to work the sixth day.',
    workerBroken: 'They called me in on Saturday. My father was waiting for me with his shopping bag.',
    familyKept: 'We covered Saturday ourselves, as agreed.',
    familyBroken: 'We asked Hatice to work Saturday as well. There was too much left to do.',
  },
  selim: {
    moment: 'route',
    minute: 480,
    request: 'Give Selim one agreed list of journeys from one household contact.',
    terms: 'One household contact gives Selim the day’s agreed list of journeys.',
    test: 'Will Selim receive one agreed route instead of conflicting instructions?',
    workerKept: 'One list, from the agreed contact. I could plan the day properly.',
    workerBroken:
      'Three people gave me three different journeys for the same hour. No one would settle which came first.',
    familyKept: 'We agreed the journeys and gave Selim one list.',
    familyBroken: 'We each gave Selim our own journeys. We expected him to fit them together.',
  },
  zehra: {
    moment: 'break',
    minute: 750,
    request: 'Arrange cover so Zehra can take a proper lunch break away from the bedside.',
    terms: 'Someone takes over care while Zehra has a lunch break away from the bedside.',
    test: 'Will Zehra get her lunch break away from the bedside?',
    workerKept: 'Someone sat with her while I ate in the kitchen. I had time to sit down myself.',
    workerBroken: 'They left my plate beside the bed again. There was no one to take over while I ate.',
    familyKept: 'We covered care while Zehra took her lunch break.',
    familyBroken: 'We could not arrange cover at lunch. Zehra had to eat while keeping watch.',
  },
  leyla: {
    moment: 'finish',
    minute: 1020,
    request: 'Let Leyla leave at 17:00 to collect her own child.',
    terms: 'Leyla leaves at 17:00 to collect her own child.',
    test: 'Will Leyla leave in time to collect her child?',
    workerKept: 'I left at five and collected my child. Nobody asked me to finish another job first.',
    workerBroken: 'They kept adding one more job after five. My child was left waiting.',
    familyKept: 'We took over at five so Leyla could collect her child.',
    familyBroken: 'There was still work at five, and we asked Leyla to stay.',
  },
  osman: {
    moment: 'route',
    minute: 480,
    request: 'Keep Osman’s work at the agreed house within walking distance.',
    terms: 'Osman works at the agreed house and is not sent to a distant address.',
    test: 'Will Osman be able to walk to work without a crowded bus journey?',
    workerKept: 'The work stayed at the house we agreed. I walked there without needing the bus.',
    workerBroken:
      'They sent me to another address across the city. That is the bus journey I said I could not manage.',
    familyKept: 'Osman’s work stayed at the agreed address.',
    familyBroken: 'We asked Osman to help at a relative’s house across the city.',
  },
  esra: {
    moment: 'pay',
    minute: 1020,
    weekday: [4],
    request: 'Confirm Friday as Esra’s agreed payday and pay on that date.',
    terms: 'The household pays Esra on the agreed Friday payday.',
    test: 'Will Esra receive her wages on the agreed payday?',
    workerKept: 'The wages arrived on the date we agreed. I could arrange my rent.',
    workerBroken: 'They said “next week” again. I cannot give my landlord that answer.',
    familyKept: 'We paid Esra on the agreed date.',
    familyBroken: 'We asked Esra to wait until next week for her wages.',
  },
  safiye: {
    moment: 'instructions',
    minute: 540,
    request: 'Give Safiye the dietary instructions directly before she prepares meals.',
    terms: 'Safiye receives clear dietary instructions directly from the family before cooking.',
    test: 'Will Safiye have the dietary instructions before preparing breakfast?',
    workerKept: 'The family gave me the dietary instructions directly. I knew what to prepare.',
    workerBroken:
      'The neighbour told me what she thought he could eat. The family still had not given me the instructions.',
    familyKept: 'We gave Safiye the dietary instructions before she began cooking.',
    familyBroken: 'We had not written the diet down. We thought the neighbour could explain it.',
  },
  burak: {
    moment: 'pay',
    minute: 540,
    request: 'Confirm Burak’s fixed monthly wage regardless of the number of journeys.',
    terms: 'Burak receives a fixed monthly wage rather than payment per journey.',
    test: 'Will the household confirm Burak’s fixed wage instead of paying per trip?',
    workerKept: 'They confirmed the monthly wage. A quiet day will not cut it.',
    workerBroken:
      'Now they want to pay by the journey. I came here to get away from counting trips for rent.',
    familyKept: 'We confirmed a fixed monthly wage for Burak.',
    familyBroken: 'We decided payment per journey would suit us better.',
  },
  meltem: {
    moment: 'duties',
    minute: 600,
    request: 'Let Meltem and the child meet before making the placement permanent.',
    terms: 'Meltem and the child have time to meet before either side commits to continuing.',
    test: 'Will Meltem meet the child before the family decides?',
    workerKept: 'We met without being hurried. The child had time to get used to me.',
    workerBroken: 'They decided without letting me meet the child. Only the adults got a say.',
    familyKept: 'We gave Meltem and the child time together before deciding.',
    familyBroken: 'We made the decision ourselves before arranging a meeting with the child.',
  },
  huriye: {
    moment: 'duties',
    minute: 720,
    request: 'Tell Huriye whether the household intends to keep the role beyond this month.',
    terms: 'The household confirms whether Huriye’s position continues beyond the first month.',
    test: 'Will Huriye get a clear answer about work beyond this month?',
    workerKept:
      'They confirmed they want the position to continue next month. I can stop looking over my shoulder for the next job.',
    workerBroken: 'They say they only wanted someone for a few weeks. Nobody told me that when I accepted.',
    familyKept: 'We confirmed that the role continues beyond this month.',
    familyBroken: 'We only need temporary help for a few weeks. We had not made that clear.',
  },
  yusuf: {
    moment: 'instructions',
    minute: 600,
    request: 'Give Yusuf the doctor’s care instructions before asking him to help with exercises.',
    terms: 'Yusuf follows care instructions confirmed by the person’s doctor.',
    test: 'Will Yusuf have the doctor’s instructions before the morning exercises?',
    workerKept: 'They showed me the doctor’s instructions. We did the exercises at the recommended pace.',
    workerBroken:
      'A relative insisted on a longer walk without any instructions from the doctor. I would not force it.',
    familyKept: 'We gave Yusuf the doctor’s instructions before the exercises.',
    familyBroken: 'We asked Yusuf to do more than the doctor’s instructions covered.',
  },
  aysun: {
    moment: 'instructions',
    minute: 540,
    request: 'Have both parents agree on the children’s rules before asking Aysun to enforce them.',
    terms: 'Both parents agree on the children’s rules and give Aysun the same instructions.',
    test: 'Will both parents give Aysun the same rules for the children?',
    workerKept: 'Both parents gave me the same rules. I knew they would back me up.',
    workerBroken:
      'One parent told me to enforce a rule and the other blamed me for it. They still have not agreed.',
    familyKept: 'We agreed the children’s rules and explained them together.',
    familyBroken: 'We gave Aysun different rules and left her to decide between them.',
  },
  nurten: {
    moment: 'finish',
    minute: 960,
    request: 'Keep Nurten’s work to one continuous shift ending at 16:00.',
    terms: 'Nurten leaves at 16:00 with no return for a second evening shift.',
    test: 'Will Nurten finish at 16:00 without being asked back in the evening?',
    workerKept: 'I finished at four. They did not ask me to come back for supper.',
    workerBroken: 'They wanted me back to serve supper after I went home. That makes it two shifts.',
    familyKept: 'Nurten finished at four; we handled the evening ourselves.',
    familyBroken: 'We asked Nurten to return in the evening to serve supper.',
  },
  ergun: {
    moment: 'funds',
    minute: 540,
    request: 'Have the household pay the garage directly for car repairs.',
    terms: 'The household pays the garage directly; Ergün does not advance repair costs.',
    test: 'Will the household settle the garage bill without asking Ergün to advance it?',
    workerKept: 'They paid the garage directly. I did not have to advance the repair money.',
    workerBroken:
      'The garage wanted payment and they told me to cover it. I said I would not advance repair costs.',
    familyKept: 'We settled the garage bill directly.',
    familyBroken: 'We asked Ergün to pay the garage and claim the cost back later.',
  },
  feride: {
    moment: 'day-off',
    minute: 720,
    weekday: [6],
    request: 'Keep a full day off for Feride’s lunch with her sisters.',
    terms: 'Feride has a full Sunday off to see her sisters.',
    test: 'Will Feride have a full day off with her sisters?',
    workerKept: 'I had the whole day with my sisters. Nobody called me back halfway through lunch.',
    workerBroken:
      'They called me in halfway through lunch with my sisters. Half a Sunday is not a full day off.',
    familyKept: 'We covered the full day so Feride could have Sunday off.',
    familyBroken: 'We asked Feride to come back for the afternoon, though Sunday was meant to be free.',
  },
};

export function arrangementSpec(candidateId: string, now: number): ArrangementSpec {
  const candidate = CANDIDATES.find((candidate) => candidate.id === candidateId);
  const need = workerNeed(candidateId);
  const terms = TERMS[candidateId];
  if (!candidate || !terms) throw new Error(`No authored arrangement for ${candidateId}`);
  // The next day is the earliest possible test. Sunday is reserved for days off;
  // work tasks run Monday–Saturday, including a deferred Monday after Sunday.
  let day = Math.floor(now / 1440) + 1;
  while (terms.weekday ? !terms.weekday.includes(day % 7) : day % 7 === 6) day++;
  const { minute, weekday: _weekday, ...spec } = terms;
  return { ...spec, at: day * 1440 + minute, terms: spec.terms || need.words };
}
