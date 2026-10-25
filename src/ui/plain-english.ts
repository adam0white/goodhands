/** Display-only wording. Saved simulation editions, lookup keys and replay bytes stay unchanged. */
const replacements: readonly (readonly [string, string])[] = [
  [
    'Zeynep still keeps her daily family window.',
    'Zeynep still keeps her agreed daily time at home with her family.',
  ],
  [
    'Her two sons and daily home window remain part of the agreement.',
    'The agreement still protects her daily time at home with her two sons.',
  ],
  [
    'Offer a paid half-hour of agency menu costing before her home window',
    'Offer a paid half-hour to calculate menu costs before she goes home',
  ],
  [
    'The completed cold-supper trial and home window remain unchanged.',
    'Her completed cold-supper trial and agreed time at home remain unchanged.',
  ],
  ['Next Friday, then.', 'I will expect the rent next Friday, then.'],
  [
    'That is a missed rent. I cannot carry two.',
    'This counts as a missed rent payment. I cannot accept two missed payments.',
  ],
  [
    'Two children shouting at once? I tell them neither gets anything until they stop.',
    'If two children shout at once, I tell them neither gets anything until they stop.',
  ],
  [
    'The radio argument again? I would switch it off and tell them I had heard enough.',
    'If they argued about the radio again, I would switch it off and tell them I had heard enough.',
  ],
  ['Fifteen years teaches patience, mostly.', 'Fifteen years mostly taught me patience.'],
  ['Term ended.', 'The term ended.'],
  ['₺6000 if the worker agrees.', 'You receive ₺6000 if the worker agrees.'],
  ['₺1800. The worker trusted you with this.', 'You receive ₺1800. The worker trusted you with this.'],
  ['Her family window stays free.', 'Her time at home with her family stays free.'],
  ['I keep my voice down. Mostly.', 'I usually keep my voice down.'],
  ['After everything we had done.', 'I resented that after everything we had done.'],
  [
    'I will do the room again if they show me what they want. Not if they just keep saying it is wrong.',
    'I will do the room again if they show me what they want. I will not do it again if they just keep saying it is wrong.',
  ],
  [
    'There is a tomato taste I have never quite grown again.',
    'I have never managed to grow tomatoes with that same taste again.',
  ],
  [
    'I keep making calls into inspections since Mum died.',
    'Since Mum died, I turn ordinary calls into checks on the person I am calling.',
  ],
  ['An empty stomach changes its mind soon enough.', 'They change their mind when they become hungry.'],
  ['I will hold my judgment.', 'I will wait before deciding.'],
  [
    'Seasonal cover at the garden is arranged for this bounded month.',
    'Someone will cover her seasonal work at the garden for this month only.',
  ],
  [
    'A carefully mended cuff; she waits for you to finish.',
    'Her cuff has been carefully mended. She waits for you to finish.',
  ],
  [
    'A clean collar; he knows the pharmacy downstairs.',
    'His collar is clean. He knows the pharmacy downstairs.',
  ],
  [
    'A pressed jacket; his shoes have been resoled.',
    'He wears a pressed jacket. His shoes have been resoled.',
  ],
  [
    'Flour on her coat; she came straight from work.',
    'She has flour on her coat. She came straight from work.',
  ],
  [
    'Fresh food, and someone I can trust with the shopping.',
    'We need fresh food and someone I can trust with the shopping.',
  ],
  ['Be straight with us about the hours and the money.', 'Be honest with us about the hours and the money.'],
  [
    'Someone steady. There will be two children asking at once.',
    'We need someone patient. There will be two children asking at once.',
  ],
  ['Is that earlier engagement finished?', 'Has that job ended?'],
  ['What work can this reference speak about?', 'What work did you do for this former employer?'],
  ['Waiting with an application form.', 'This applicant is waiting with an application form.'],
  [
    'Baking and meal preparation only, with paid hours in writing.',
    'I only offer baking and meal preparation. I need the paid hours in writing.',
  ],
  [
    'A defined cooking or housekeeping trial; garden cover lasts this month only.',
    'I need a trial with clear cooking or housekeeping duties. Someone is covering my garden work for this month only.',
  ],
  [
    'Agreed duties, wages on the written date, and a six o’clock finish.',
    'I need agreed duties, wages on the written date, and a six o’clock finish.',
  ],
  [
    'Oven cook; bounded baking and meal preparation.',
    'She is an oven cook. She offers baking and meal preparation with agreed limits.',
  ],
  [
    'School kitchen cook; private meal preparation.',
    'She has worked as a school kitchen cook. She offers private meal preparation.',
  ],
  [
    'Tea-garden keeper and competent household cook.',
    'She has run a tea garden and can cook for a household.',
  ],
  [
    'A bright scarf; she greets everyone on the bench.',
    'She wears a bright scarf and greets everyone on the bench.',
  ],
  ['An immaculate coat; her phone lights up twice.', 'Her coat is spotless. Her phone lights up twice.'],
  [
    'Burn marks on her wrist; a folded shopping list.',
    'She has burn marks on her wrist and carries a folded shopping list.',
  ],
  ['A motorcycle helmet and a small notebook.', 'He carries a motorcycle helmet and a small notebook.'],
  [
    'A folder of certificates held against her knees.',
    'She holds a folder of certificates against her knees.',
  ],
  ['A bag of library books; tired eyes.', 'She carries a bag of library books. Her eyes look tired.'],
  [
    'A shopping trolley parked neatly by the door.',
    'She has parked her shopping trolley neatly by the door.',
  ],
  ['A thermos in her bag; she declines the sugar.', 'She has a thermos in her bag and declines the sugar.'],
  ['Sat with her grandmother after an operation.', 'She sat with her grandmother after an operation.'],
  ['Three years with twins, can you imagine?', 'I worked with twins for three years. Can you imagine?'],
  [
    'A little boy, from six months until school.',
    'I looked after a little boy from the age of six months until he started school.',
  ],
  [
    'A waterfront household: school collections, meals and a fairly demanding calendar.',
    'I worked for a household by the water. I collected the children from school, made meals and kept a busy schedule.',
  ],
  ['Nine until six, agreed in writing.', 'I can work from nine until six, with the hours agreed in writing.'],
  ['Extra evenings need notice.', 'I need advance notice for extra evening work.'],
  [
    'Eight at the table. Two separate pots because the grandfather could not eat salt.',
    'I cooked for eight people. I used two separate pots because the grandfather could not eat salt.',
  ],
  ['A kitchen budget before I shop.', 'I need money for the kitchen before I shop.'],
  [
    'A school minibus. Twelve children, twelve different ideas about which radio station to play.',
    'I drove a school minibus with twelve children. Each wanted a different radio station.',
  ],
  [
    'Early starts are fine. Finish by seven, unless we have arranged an airport run.',
    'Early starts are fine. I need to finish by seven, unless we have arranged an airport run.',
  ],
  ['No overnight stays.', 'I cannot stay overnight.'],
  [
    'A boarding house, twenty mouths when it was full!',
    'I cooked in a boarding house for twenty people when it was full!',
  ],
  ['Cakes all day; no thank you.', 'I did not want to make cakes all day.'],
  [
    'Hospital journeys with the same patients most weeks.',
    'I drove the same patients to hospital most weeks.',
  ],
  [
    'No lifting a person on my own. Two people or the proper equipment.',
    'I cannot lift a person on my own. I need another person or the proper equipment.',
  ],
  [
    'Three floors. I did one floor each morning, then the washing.',
    'I cleaned three floors. I did one floor each morning, then the washing.',
  ],
  ['Five days, please.', 'I want to work five days, please.'],
  [
    'A company director and his wife. I maintained the car as well as driving it.',
    'I drove for a company director and his wife. I maintained the car too.',
  ],
  [
    'Late journeys by arrangement, with the return time agreed.',
    'We must arrange late journeys and agree on a return time.',
  ],
  ['A woman who used a wheelchair.', 'I helped a woman who used a wheelchair.'],
  ['A proper lunch break, even a short one.', 'I need a proper lunch break, even a short one.'],
  [
    'Two schoolchildren. Lunch, homework, then dinner before their parents returned.',
    'I looked after two schoolchildren. I made lunch, helped with homework and made dinner before their parents returned.',
  ],
  ['Mornings until four.', 'I can work from the morning until four.'],
  [
    'A guesthouse. Laundry, room checks and keeping the linen cupboard in order.',
    'I worked at a guesthouse. I did the laundry, checked rooms and kept the linen cupboard in order.',
  ],
  ['Pay on a fixed date.', 'I need to be paid on a fixed date.'],
  ['A man with diabetes.', 'I worked for a man with diabetes.'],
  ['Deliveries round Göztepe.', 'I made deliveries around Göztepe.'],
  ['A fixed monthly wage.', 'I need a fixed monthly wage.'],
  ['A child with hearing loss.', 'I looked after a child with hearing loss.'],
  [
    'They moved nearer her school. Too far for me.',
    'They moved nearer her school. It was too far for me to travel.',
  ],
  [
    'Let the child meet me before deciding. Not just the parents.',
    'Let the child meet me before deciding. The parents should not be the only ones who meet me.',
  ],
  ['Fifteen years in one house.', 'I worked in one house for fifteen years.'],
  [
    'A man recovering from a stroke. Exercises, meals, and short walks when he could manage them.',
    'I helped a man recovering from a stroke. I helped with exercises, meals and short walks when he could manage them.',
  ],
  ['Three siblings after school.', 'I looked after three siblings after school.'],
  [
    'The lunch counter near the station. Soup, beans and rice, every day.',
    'I worked at the lunch counter near the station. I made soup, beans and rice every day.',
  ],
  ['No split shifts.', 'I cannot work separate morning and evening shifts.'],
  [
    'One family car: school run, shopping, servicing.',
    'I drove a family car for school journeys and shopping, and took it for servicing.',
  ],
  [
    'A grandmother who wanted the radio on and her granddaughter who wanted it off.',
    'I looked after a grandmother who wanted the radio on and her granddaughter who wanted it off.',
  ],
  ['One full day off every week.', 'I need one full day off every week.'],
  [
    'I can sit beside him a while. Not all morning.',
    'I can sit beside him for a while, but not all morning.',
  ],
  [
    'I can cook it again. Not three different dinners in one evening.',
    'I can cook it again, but I cannot make three different dinners in one evening.',
  ],
  ['Three floors to finish.', 'I have three floors to finish.'],
  [
    'A break usually helps with homework. Unless we have already lost the whole afternoon.',
    'A break usually helps with homework, unless we have already lost the whole afternoon.',
  ],
  [
    'Someone patient with the twins, Ada and Deniz, both three.',
    'We need someone patient with the twins, Ada and Deniz, who are both three.',
  ],
  [
    'The twins keep you busy. A little cleaning while they nap.',
    'The twins keep you busy. We also want a little cleaning while they nap.',
  ],
  [
    'At our door at six. That is the important part.',
    'You must be at our door at six. That is the important part.',
  ],
  [
    'School, then her music lesson. No last-minute changes.',
    'Take her to school and then her music lesson. We cannot accept last-minute changes.',
  ],
  ['Eight for lunch on Saturdays.', 'We need lunch for eight people on Saturdays.'],
  [
    'Two schools, two timetables. Please write them down.',
    'The children go to two schools with different timetables. Please write them down.',
  ],
  ['Nermin: “Excuse me, the phone.”', 'Nermin: “Excuse me. I need to answer the phone.”'],
  [
    'Two missed rents. Mr Hüsnü took back the office key. The month ended early.',
    'You missed two rent payments. Mr Hüsnü took back the office key. The month ended early.',
  ],
  [
    'She is at a trial. Wait for the family’s word.',
    'She is working a trial morning. Wait for the family’s report.',
  ],
  [
    'No one placed yet. Your word will go with them.',
    'You have not placed anyone yet. Families will remember the qualities you promise.',
  ],
  ['What you vouch for, they remember.', 'The family remembers the qualities you promise.'],
  ['The rent bar fills with fees.', 'Agency fees help you pay the rent.'],
  [
    'What she says goes on her card as says; what others say is heard; what you watch on a trial is seen.',
    'Her card labels her own claims as “says”. Reports from others are “heard”. What you watch during a trial is “seen”.',
  ],
  ['A doubted note is crossed out.', 'A note you doubt is crossed out.'],
  ['Your books hold the people you have met.', 'Your agency records list the people you have met.'],
  ['No word from the house yet.', 'The family has not reported back yet.'],
  [
    'The game’s own reckoning of agency outcomes, not a measure of people.',
    'This tally counts agency outcomes. It does not measure people’s worth.',
  ],
];

export function plainText(value: string): string {
  let text = value;
  for (const [before, after] of replacements) text = text.split(before).join(after);
  // Project after the copy table, including any addresses its replacements introduce.
  text = text
    .replace(/([\p{L}]+) Hanım(?=$|[^\p{L}])/gu, 'Ms $1')
    .replace(/([\p{L}]+) (?:Bey|Efendi)(?=$|[^\p{L}])/gu, 'Mr $1')
    .replace(/([\p{L}]+) abla(?=$|[^\p{L}])/gu, 'Ms $1')
    .replace(/\bHanım(?=$|[^\p{L}])/gu, 'Ms')
    .replace(/\bBey(?=$|[^\p{L}])/gu, 'Mr')
    .replace(/\b[Aa]bla(?=$|[^\p{L}])/gu, (address) => (address === 'Abla' ? 'My friend' : 'my friend'));
  const note = text.match(
    /^(Doubt: |Still unsure: )?(patient when someone needs time|straight about money|comes when promised|puts people at ease|finishes the work|keeps a household’s business private)$/u,
  );
  if (note) {
    const claims: Record<string, string> = {
      'patient when someone needs time': 'this person is patient when someone needs time',
      'straight about money': 'this person is honest about money',
      'comes when promised': 'this person arrives when promised',
      'puts people at ease': 'this person helps people feel comfortable',
      'finishes the work': 'this person finishes the work',
      'keeps a household’s business private': 'this person keeps a household’s business private',
    };
    return `${note[1] === 'Doubt: ' ? 'Nermin doubts that' : note[1] ? 'Nermin is still unsure whether' : 'Nermin thinks'} ${claims[note[2]!]}.`;
  }
  return text
    .replace(/(^|[“]\s*)Has ([^.]+)\./gu, '$1This person has $2.')
    .replace(
      /(^|[“]\s*)Reports experience in (nanny|driver|carer|housekeeper|cook) work; check the reference and trial\./gu,
      '$1This applicant reports experience as a $2. Check the reference and trial.',
    )
    .replace(/(^|[“]\s*)₺([\d,]+) a month\./gu, '$1I need ₺$2 a month.')
    .replace(
      /(^|[“]\s*)([\p{L} -]+)\. About (\d+) minutes from (?:the office|here)\./gu,
      '$1I live in $2. The journey from the office takes about $3 minutes.',
    )
    .replace(
      /(^|[“]\s*)Daytime work, finishing by (\d+:00)\. No unagreed evening return\./gu,
      '$1I can work during the day and finish by $2. I will not return for evening work unless we agree to it.',
    )
    .replace(
      /(^|[“]\s*)(Eight|Seven|Nine) until (four|five|six|seven)(, with a regular day off)?\./gu,
      (_match, prefix: string, start: string, end: string, dayOff: string | undefined) =>
        `${prefix}I can work from ${start.toLowerCase()} until ${end}${dayOff ?? ''}.`,
    )
    .replace(
      /(^|[“]\s*)A (nanny|carer|driver|cook|housekeeper) for the agreed hours\./gu,
      '$1We need a $2 for the agreed hours.',
    )
    .replace(/^(.+?) placed with (.+?)\. /u, '$1 was placed with $2. ');
}
