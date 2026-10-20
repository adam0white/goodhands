import { estimate, type Person } from '@adam0white/human-framework';
import type { Quality, SceneChoice } from './types.ts';
import { CANDIDATES, QUALITY_MAP, type Referee } from './world.ts';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const cue = (quality: Quality) =>
  ['warm', 'hardworking', 'discreet'].includes(quality)
    ? `trait:goodhands:${quality}`
    : `trait:${QUALITY_MAP[quality]}`;

interface Story {
  quality: Quality;
  good: string;
  bad: string;
  wageDispute?: boolean;
}
const story = (quality: Quality, good: string, bad: string): Story => ({ quality, good, bad });
interface ReferenceAccount {
  opening: string;
  patient: Story;
  honest: Story;
  reliable: Story;
  leaving: Story;
}

// Each speaker owns these events. A bias affects the claim, never which quality
// an event is evidence about. {worker} is grammatical and works for every sex.
const accounts: Record<string, ReferenceAccount> = {
  gul: {
    opening:
      'On the last morning I found the flat keys beside the kettle. I would want the hours written down next time.',
    patient: story(
      'patient',
      'The twins fought over a red cup. {worker} sat between them until they could take turns.',
      'When the twins fought over a red cup, {worker} slammed it into the sink and told them to stop.',
    ),
    honest: story(
      'honest',
      'A market stall charged us twice for eggs. {worker} showed me both slips before asking for more money.',
      'I found two charges for the same eggs. {worker} insisted there had only been one trip, despite the slips.',
    ),
    reliable: story(
      'reliable',
      'When the Buca bus broke down, {worker} called before breakfast and arranged another way here.',
      '{worker} missed breakfast after the Buca bus broke down. I only learned why when I rang at noon.',
    ),
    leaving: story(
      'reliable',
      '{worker} left the keys beside the kettle after completing the notice we agreed, despite our argument about hours.',
      'After our argument about hours, {worker} left the keys beside the kettle without agreeing a handover day.',
    ),
  },
  sevda: {
    opening:
      'One evening {worker} stood by my coat rack and asked me to count the wages. After everything we had done.',
    patient: story(
      'patient',
      'My little boy refused his winter boots. {worker} loosened every buckle and waited while he tried again.',
      '{worker} pulled the boots off my little boy and left him crying by the coat rack.',
    ),
    honest: story(
      'honest',
      '{worker} marked each extra evening in a pocket calendar. The dates matched my own diary.',
      '{worker} claimed three extra evenings, but the pocket calendar included a night we were away.',
    ),
    reliable: story(
      'reliable',
      'On my exam-marking evenings, {worker} checked the handover time with me each morning.',
      'During exam marking, {worker} twice left before the handover time we had written in my diary.',
    ),
    leaving: {
      ...story(
        'honest',
        '{worker} said, “You owe me the last fortnight.” I counted meals as pay; our agreement said wages. That ended it.',
        '{worker} said, “You owe me the last fortnight.” I counted meals as pay; our agreement said wages. That ended it.',
      ),
      wageDispute: true,
    },
  },
  pinar: {
    opening:
      '{worker} kept the nursery certificates in a blue folder. I still remember how carefully the children put it away.',
    patient: story(
      'patient',
      'Our eldest could not tie a bow for the school concert. {worker} practised with a dressing-gown cord all afternoon.',
      '{worker} told our eldest the concert bow was easy and put the cord away while the child was still struggling.',
    ),
    honest: story(
      'honest',
      'The concert ticket seller gave an extra ticket. {worker} returned it before we left the hall.',
      '{worker} sold the extra concert ticket and denied receiving any money when I asked.',
    ),
    reliable: story(
      'reliable',
      '{worker} had both concert costumes ready by the collection time, including the missing sash.',
      'The concert costumes were still damp when I arrived to collect them; {worker} had forgotten the time.',
    ),
    leaving: story(
      'reliable',
      'We cut our household hours. {worker} stayed through the final concert week as promised.',
      'After we cut our household hours, {worker} missed the final concert week despite agreeing to stay.',
    ),
  },
  fatma: {
    opening:
      'We discussed the boarding-house kitchen over a sack of onions. {worker} wanted to know exactly how many meals we served.',
    patient: story(
      'patient',
      'A lodger rejected the soup twice. {worker} asked what upset his stomach and made a small fresh pan.',
      'After a lodger rejected the soup twice, {worker} tipped his bowl away and refused to discuss it.',
    ),
    honest: story(
      'honest',
      '{worker} weighed the butcher’s delivery and showed me the missing half kilo before paying.',
      '{worker} signed for a full meat delivery and kept the refund for the missing half kilo.',
    ),
    reliable: story(
      'reliable',
      'When our gas cylinder emptied, {worker} moved lunch to the courtyard burner and served at one.',
      'The gas cylinder emptied and {worker} went home without telling anyone lunch would not be served.',
    ),
    leaving: story(
      'reliable',
      'The boarding house closed for repairs. {worker} labelled the frozen meals before the agreed final shift ended.',
      'The boarding house closed for repairs. {worker} missed the agreed final shift, leaving the freezer unlabelled.',
    ),
  },
  cem: {
    opening:
      '{worker} knew the school route better than I did. I asked for a written collection list, all the same.',
    patient: story(
      'patient',
      'A boy was sick on the minibus. {worker} stopped safely and reassured him while we cleaned up.',
      'When a boy was sick on the minibus, {worker} shouted about the upholstery until the boy hid his face.',
    ),
    honest: story(
      'honest',
      '{worker} found a parent’s wallet under the rear seat and handed it back with the fare money untouched.',
      'A parent’s wallet came back from {worker} without the fare money; the parent and I had counted it before the journey.',
    ),
    reliable: story(
      'reliable',
      '{worker} drove the detour past roadworks the evening before, so the school pickup stayed on time.',
      '{worker} ignored the roadworks notice and left the school children waiting outside the closed gate.',
    ),
    leaving: story(
      'reliable',
      'Our school contract ended. {worker} handed over the route book on the last contracted Friday.',
      'Our school contract ended. {worker} kept the route book past the agreed handover, delaying the next driver.',
    ),
  },
  ayla: {
    opening:
      '{worker} noticed the bedroom radio was too loud for my father. It was a small thing, but I remember it.',
    patient: story(
      'patient',
      'Father refused the clean shirt because of its buttons. {worker} let him choose another and dress at his own pace.',
      '{worker} snapped at Father over the shirt buttons and tried to force his arm into the sleeve.',
    ),
    honest: story(
      'honest',
      'The pharmacy substituted a cheaper dressing. {worker} brought back the price difference and explained it.',
      '{worker} charged me for the expensive dressing even though the pharmacy supplied the cheaper one.',
    ),
    reliable: story(
      'reliable',
      '{worker} wrote down the district nurse’s new arrival time and was there to open the door.',
      'The nurse found the door locked after {worker} forgot the changed appointment time.',
    ),
    leaving: story(
      'reliable',
      'Father moved into residential care. {worker} packed his labelled shirts on the day we had agreed.',
      'Father moved into residential care. {worker} did not come on the agreed packing day, so his shirts went missing in the move.',
    ),
  },
  emine: {
    opening:
      'We served breakfast to sixteen guests when the ferry was cancelled. {worker} remembers the marmalade running out.',
    patient: story(
      'patient',
      'A guest complained that every breakfast egg was wrong. {worker} asked how he wanted one cooked and listened.',
      '{worker} answered the guest’s egg complaint by banging his plate down in front of the other guests.',
    ),
    honest: story(
      'honest',
      '{worker} found an unopened tin on the supplier’s bill that had not arrived and called for a correction.',
      'I paid for an extra tin because {worker} said it had arrived; the supplier later confirmed it had not.',
    ),
    reliable: story(
      'reliable',
      'With an early ferry group due, {worker} soaked the beans overnight and opened the kitchen at six.',
      'The ferry group arrived to an empty kitchen after {worker} forgot our six o’clock start.',
    ),
    leaving: story(
      'reliable',
      'We stopped serving winter breakfasts. {worker} completed the agreed stock count before leaving.',
      'When we stopped winter breakfasts, {worker} left before the stock count we had agreed to do together.',
    ),
  },
  murat: {
    opening:
      'Our hospital appointments filled a whole notebook. {worker} checked the lift entrance before the first trip.',
    patient: story(
      'patient',
      'My husband froze at the hospital ramp. {worker} waited beside him and asked which handrail he preferred.',
      '{worker} hurried my husband up the hospital ramp after he asked for a rest.',
    ),
    honest: story(
      'honest',
      'The hospital parking machine returned an extra note. {worker} took it to the attendant in front of me.',
      '{worker} claimed two parking payments for one hospital visit; the attendant confirmed there had been only one.',
    ),
    reliable: story(
      'reliable',
      '{worker} checked the clinic text the night before and brought us to the rescheduled appointment.',
      'The clinic had moved our appointment, but {worker} never checked the message we had forwarded.',
    ),
    leaving: story(
      'reliable',
      'Our hospital trips ended. {worker} returned the appointment notebook at the last scheduled visit.',
      'Our hospital trips ended, but {worker} missed the arranged return of the appointment notebook.',
    ),
  },
  dilek: {
    opening:
      'At the nursery, {worker} asked where we kept the spare clothes before asking where to leave a coat.',
    patient: story(
      'patient',
      'A nursery child spilled paint on three drawings. {worker} helped each child start again without blame.',
      '{worker} scolded the nursery child over the paint until the other children stopped drawing.',
    ),
    honest: story(
      'honest',
      '{worker} told me immediately about a broken nursery thermometer and wrote the accident in our book.',
      '{worker} hid the broken nursery thermometer and said it had been missing before the shift.',
    ),
    reliable: story(
      'reliable',
      'For the nursery trip, {worker} checked each permission slip before the coach arrived.',
      'At the coach door we found {worker} had not collected the permission slips as agreed.',
    ),
    leaving: story(
      'reliable',
      'The nursery term ended. {worker} completed the promised handover of the children’s folders.',
      'The nursery term ended. {worker} left the children’s folders unfinished despite promising a handover.',
    ),
  },
  hatice: {
    opening:
      'There were three flights of stairs in that house. {worker} asked where the buckets could be emptied.',
    patient: story(
      'patient',
      'I kept changing which room needed cleaning first. {worker} asked me to choose an order and waited for an answer.',
      '{worker} lost patience with my room changes and threw the cleaning cloth onto the landing.',
    ),
    honest: story(
      'honest',
      'A banknote fell from a coat in the laundry. {worker} clipped it to the coat label for me.',
      'I watched a banknote fall from a coat; {worker} pocketed it and denied finding anything.',
    ),
    reliable: story(
      'reliable',
      '{worker} finished the top-floor guest room before my sister’s train arrived, as arranged.',
      'My sister arrived from the train to find the top-floor bed still stripped; {worker} had changed the plan without asking.',
    ),
    leaving: story(
      'reliable',
      'We sold the house. {worker} met the buyers for the cleaning cupboard handover on the appointed day.',
      'After the sale, {worker} missed the buyers’ agreed cleaning cupboard handover.',
    ),
  },
  selim: {
    opening: '{worker} put a spare umbrella in the company car. I asked for punctuality more than ceremony.',
    patient: story(
      'patient',
      'My meeting ran over twice. {worker} waited outside and checked whether I needed another pickup time.',
      '{worker} complained loudly at reception when my meeting ran over, while clients were waiting.',
    ),
    honest: story(
      'honest',
      'A fuel pump failed halfway through. {worker} kept the cancelled slip and the replacement, so the account was clear.',
      '{worker} submitted both the cancelled fuel slip and the replacement as separate expenses.',
    ),
    reliable: story(
      'reliable',
      '{worker} checked the flight delay and met the director at the revised arrival gate.',
      'The director’s delayed flight landed, but {worker} had left despite agreeing to check the new time.',
    ),
    leaving: story(
      'reliable',
      'The company leased a different car. {worker} returned our vehicle and mileage book together on Friday.',
      'When the lease changed, {worker} returned the vehicle late and omitted the mileage book we needed.',
    ),
  },
  zehra: {
    opening:
      '{worker} measured the space beside the wheelchair before moving any furniture in our sitting room.',
    patient: story(
      'patient',
      'My wife needed several tries to cross the door sill. {worker} let her direct each attempt.',
      '{worker} pushed the wheelchair across the sill while my wife was still asking to stop.',
    ),
    honest: story(
      'honest',
      'The wheelchair repairer gave us a discount. {worker} corrected the amount in our household envelope.',
      '{worker} kept the wheelchair repair discount and gave me the original quoted price as the bill.',
    ),
    reliable: story(
      'reliable',
      '{worker} checked the lift service notice and arranged the accessible entrance before our outing.',
      '{worker} ignored the lift service notice, and my wife missed the outing we had arranged.',
    ),
    leaving: story(
      'reliable',
      'We moved to an accessible flat. {worker} came for the agreed final transfer with the chair.',
      'On moving day {worker} did not come for the wheelchair transfer we had agreed.',
    ),
  },
  leyla: {
    opening: 'The children left library books everywhere. {worker} made a shelf out of an empty fruit crate.',
    patient: story(
      'patient',
      'Our son kept losing his place while reading. {worker} made a paper marker and listened to the page again.',
      '{worker} closed our son’s book when he lost his place and told him he should know it by now.',
    ),
    honest: story(
      'honest',
      '{worker} showed me the overdue library fine and said plainly which return had been forgotten.',
      '{worker} called the library fine a new membership fee, though the printed notice said overdue books.',
    ),
    reliable: story(
      'reliable',
      '{worker} wrote the two school collection times on the fridge and met both children at their gates.',
      '{worker} mixed up the two school collection times even after we wrote them on the fridge.',
    ),
    leaving: story(
      'reliable',
      'The children moved to full-day school. {worker} cooked the final agreed week of lunches.',
      'When full-day school began, {worker} skipped the final week of lunches we had agreed.',
    ),
  },
  osman: {
    opening:
      '{worker} and my neighbour used to play backgammon by the window. I arranged the paid hours later.',
    patient: story(
      'patient',
      'My neighbour accused the board of being crooked. {worker} reset the pieces and let him choose his seat.',
      '{worker} swept the backgammon pieces into their box when my neighbour questioned the board.',
    ),
    honest: story(
      'honest',
      '{worker} returned my neighbour’s pension envelope sealed when he was taken into hospital.',
      'My neighbour’s pension envelope came back opened, and {worker} denied opening it despite having signed for it.',
    ),
    reliable: story(
      'reliable',
      'On the rainiest mornings, {worker} still arrived for the walk and offered to sit indoors instead.',
      '{worker} stopped coming on rainy mornings without telling us the walking arrangement had changed.',
    ),
    leaving: story(
      'reliable',
      'My neighbour moved to his daughter’s. {worker} brought the backgammon set over on the agreed Sunday.',
      'After my neighbour moved, {worker} did not bring the backgammon set on the Sunday we arranged.',
    ),
  },
  esra: {
    opening:
      'The guesthouse sheets were labelled by floor. {worker} asked to see the linen ledger before starting.',
    patient: story(
      'patient',
      'A guest sent three pillows back. {worker} asked about the neck support and found a flatter one.',
      '{worker} told the guest to make do after the third pillow request, in front of the breakfast queue.',
    ),
    honest: story(
      'honest',
      '{worker} found a ring caught in a pillowcase and logged it with the room number.',
      'A guest’s ring turned up in {worker}’s laundry bag after its loss had been denied.',
    ),
    reliable: story(
      'reliable',
      '{worker} had the extra linen ready before the wedding party checked in.',
      'The wedding party checked in before {worker} had collected the linen ordered for them.',
    ),
    leaving: story(
      'reliable',
      'Our guesthouse changed owners. {worker} counted the linen with the new manager on the agreed morning.',
      'When the guesthouse changed owners, {worker} missed the arranged linen count with the new manager.',
    ),
  },
  safiye: {
    opening: 'My husband’s meal chart lived on the fridge. {worker} asked which foods he actually enjoyed.',
    patient: story(
      'patient',
      'My husband refused his measured lunch. {worker} offered the allowed alternatives without arguing over each mouthful.',
      '{worker} argued over every mouthful of my husband’s measured lunch until he pushed the plate away.',
    ),
    honest: story(
      'honest',
      '{worker} said a sweet sauce had gone into the wrong meal and showed us the packet before serving.',
      '{worker} denied using sweet sauce, though its empty packet was beside my husband’s plate.',
    ),
    reliable: story(
      'reliable',
      '{worker} prepared the labelled meal boxes before our regular Friday delivery left.',
      'The Friday meal delivery left without the boxes because {worker} had not followed the agreed preparation time.',
    ),
    leaving: story(
      'reliable',
      'My husband began a meal service. {worker} shared the recipes on the handover day we set.',
      'When the meal service began, {worker} did not attend the recipe handover we had arranged.',
    ),
  },
  burak: {
    opening:
      '{worker} brought a delivery route scribbled on a bread bag. We copied it into our dispatch book.',
    patient: story(
      'patient',
      'A customer took ten minutes to reach the intercom. {worker} waited and helped with the parcel.',
      '{worker} kicked the customer’s parcel after waiting at the intercom, then drove away.',
    ),
    honest: story(
      'honest',
      '{worker} spotted an extra cash-on-delivery payment and went back to return it.',
      'The dispatch book showed two cash payments, but {worker} handed over only one and denied the other.',
    ),
    reliable: story(
      'reliable',
      '{worker} checked the bakery’s closing time and delivered the flour before the shutters came down.',
      'The flour stayed in the van after {worker} missed the bakery’s closing time we had confirmed.',
    ),
    leaving: story(
      'reliable',
      'Our delivery round was sold. {worker} returned the insulated bags at the promised final collection.',
      'After we sold the round, {worker} missed the promised final collection of the insulated bags.',
    ),
  },
  meltem: {
    opening:
      '{worker} sat where our daughter could see a face clearly. I did not need to explain that twice.',
    patient: story(
      'patient',
      'Our daughter asked for the story to be signed again. {worker} slowed down and started the page over.',
      '{worker} refused to repeat the signed story and turned away while our daughter was still watching.',
    ),
    honest: story(
      'honest',
      '{worker} told me a hearing-aid battery had been lost and showed me where it last worked.',
      '{worker} said the hearing-aid battery was new when I had watched it being taken from the used-battery jar.',
    ),
    reliable: story(
      'reliable',
      '{worker} learned the changed speech-session time and had our daughter ready at the door.',
      'Our daughter missed speech practice after {worker} forgot the changed session time.',
    ),
    leaving: story(
      'reliable',
      'We moved nearer the specialist school. {worker} kept the agreed final week and handed over the signs notebook.',
      'Before our move, {worker} left without completing the agreed signs-notebook handover.',
    ),
  },
  huriye: {
    opening:
      'For fifteen years that pantry key hung by our calendar. {worker} knew every jar without a label.',
    patient: story(
      'patient',
      'I asked for the pantry shelves to be moved twice. {worker} asked me to show the final height before starting again.',
      'After my second request about shelf height, {worker} shoved the jars aside and refused to finish.',
    ),
    honest: story(
      'honest',
      '{worker} found our old emergency cash behind the rice tin and brought it straight to me.',
      '{worker} denied finding emergency cash behind the rice tin, though I saw the envelope in the shopping trolley.',
    ),
    reliable: story(
      'reliable',
      '{worker} checked the water-cut notice and filled the cooking pots the night before.',
      'The kitchen had no water after {worker} forgot the water-cut preparation we had agreed.',
    ),
    leaving: story(
      'reliable',
      'We downsized after retirement. {worker} sorted the pantry on the last day we had booked.',
      'After we downsized, {worker} missed the final booked pantry-sorting day without calling.',
    ),
  },
  yusuf: {
    opening:
      'After my brother’s stroke, {worker} asked which side he liked people to stand on when speaking.',
    patient: story(
      'patient',
      'My brother struggled to say which park path he wanted. {worker} waited for him to finish the sentence.',
      '{worker} chose a park path over my brother’s unfinished answer and told him to hurry.',
    ),
    honest: story(
      'honest',
      '{worker} corrected the taxi voucher when it listed a journey my brother had cancelled.',
      '{worker} claimed the cancelled taxi journey as completed and asked me to sign the voucher.',
    ),
    reliable: story(
      'reliable',
      '{worker} kept the physiotherapy booking card in the car and brought my brother to every scheduled session.',
      'My brother missed physiotherapy after {worker} lost the booking card and guessed the session time.',
    ),
    leaving: story(
      'reliable',
      'My brother regained enough mobility to manage. {worker} finished the agreed exercise handover with us.',
      'When my brother regained mobility, {worker} skipped the exercise handover promised to us.',
    ),
  },
  aysun: {
    opening:
      'The three siblings argued about whose homework came first. {worker} asked for each school’s timetable.',
    patient: story(
      'patient',
      'The youngest tore a homework sheet. {worker} found spare paper and helped reconstruct it without shouting.',
      '{worker} called the youngest careless over a torn homework sheet and refused to help repair it.',
    ),
    honest: story(
      'honest',
      '{worker} admitted the school payment envelope was still in the bag, rather than claiming it had been delivered.',
      '{worker} claimed to have delivered the school payment envelope, but I found it unopened in the bag.',
    ),
    reliable: story(
      'reliable',
      '{worker} checked which sibling had chess club and brought the right bags to the right gates.',
      'The chess-club child waited outside because {worker} had ignored the collection rota.',
    ),
    leaving: story(
      'reliable',
      'The oldest sibling began collecting the others. {worker} rehearsed the route on the handover afternoon.',
      'When the oldest took over collections, {worker} missed the route rehearsal we had arranged.',
    ),
  },
  nurten: {
    opening:
      '{worker} could tell the lunch rush by the sound of the street. I still wanted the menu written before noon.',
    patient: story(
      'patient',
      'A lunch-counter customer could not read the menu. {worker} described each dish quietly, twice.',
      '{worker} snapped at a customer who asked for the lunch menu to be read a second time.',
    ),
    honest: story(
      'honest',
      '{worker} noticed the till held too much after lunch and traced the duplicate charge to its customer.',
      '{worker} took the duplicate lunch charge out of the till and called it a tip without asking the customer.',
    ),
    reliable: story(
      'reliable',
      '{worker} started the chickpeas early enough for the factory workers’ short lunch break.',
      'The factory lunch break ended while the chickpeas {worker} had promised were still uncooked.',
    ),
    leaving: story(
      'reliable',
      'The lunch counter shut for renovation. {worker} cleaned the griddle on the last paid shift as agreed.',
      'Before renovation, {worker} missed the last paid griddle-cleaning shift we had agreed.',
    ),
  },
  ergun: {
    opening: '{worker} looked under the family car before discussing wages. There had been a small oil leak.',
    patient: story(
      'patient',
      'My father wanted the seat adjusted four times. {worker} made each adjustment and checked he was comfortable.',
      '{worker} refused my father’s fourth seat adjustment and set off while he was still uncomfortable.',
    ),
    honest: story(
      'honest',
      '{worker} showed me the garage’s written estimate before agreeing to the oil-leak repair.',
      '{worker} inflated the oil-leak repair charge; the garage showed me its lower invoice.',
    ),
    reliable: story(
      'reliable',
      '{worker} booked the car inspection before the expiry date we marked on the dashboard.',
      'Our car inspection expired after {worker} forgot the booking date on the dashboard.',
    ),
    leaving: story(
      'reliable',
      'We gave up the car. {worker} took it to the buyer at the time written in the sale agreement.',
      'When we sold the car, {worker} missed the buyer’s agreed collection slot.',
    ),
  },
  feride: {
    opening:
      'My mother and granddaughter both wanted the window chair. {worker} brought another chair before sitting.',
    patient: story(
      'patient',
      'Mother interrupted the granddaughter’s puzzle repeatedly. {worker} gave them separate pieces to sort together.',
      '{worker} pushed the puzzle away after Mother interrupted and told both of them to be quiet.',
    ),
    honest: story(
      'honest',
      '{worker} found an error in the granddaughter’s pocket-money envelope and asked us to count it together.',
      '{worker} took money from the granddaughter’s envelope and called it an agreed advance, though none had been agreed.',
    ),
    reliable: story(
      'reliable',
      '{worker} matched Mother’s rest time to the granddaughter’s school return as we had arranged.',
      'Mother was left waiting alone when {worker} changed the school-return arrangement without calling.',
    ),
    leaving: story(
      'reliable',
      'Mother went to stay with my sister. {worker} completed the agreed overlap with the after-school club.',
      'When Mother moved, {worker} skipped the overlap promised to the after-school club.',
    ),
  },
};

/** The worker supplies only name here, never hidden qualities. */
export function referenceOpening(ref: Referee, person: Person): string {
  return accounts[ref.candidate]!.opening.replaceAll('{worker}', person.name);
}

export function referenceChoices(ref: Referee, asked: string[]): SceneChoice[] {
  return [
    { id: 'ref-patient', label: 'Ask about patience', hint: 'Ask for an example.' },
    { id: 'ref-honest', label: 'Ask about money and honesty' },
    { id: 'ref-reliable', label: 'Ask about keeping arrangements' },
    { id: 'ref-leaving', label: 'Ask why the job ended' },
    { id: 'ref-return', label: 'Ask whether they would hire again' },
    {
      id: 'distrust',
      label: `I'm not sure I believe ${ref.name.startsWith('Mr ') ? 'him' : 'her'}`,
      hint: 'Their claims will count less.',
    },
    { id: 'finish', label: 'End the call' },
  ].filter((choice) => !asked.includes(choice.id));
}

/** Claims come from the referee's impression, distorted by that speaker's motives. */
export function referenceReply(
  ref: Referee,
  speaker: Person,
  question: string,
  now: number,
): { text: string; quality: Quality; value: number; wageDispute?: boolean } {
  const account = accounts[ref.candidate]!;
  const claim =
    question === 'ref-patient'
      ? account.patient
      : question === 'ref-honest'
        ? account.honest
        : question === 'ref-leaving'
          ? account.leaving
          : account.reliable;
  const remembered = estimate(speaker, ref.candidate, cue(claim.quality), now).value;
  const dishonesty = 1 - speaker.traits.honesty;
  const distortion =
    ref.bias === 'fond'
      ? 0.12 + dishonesty * 0.23
      : ref.bias === 'stingy'
        ? -0.15 - dishonesty * 0.3
        : ref.bias === 'cagey'
          ? -dishonesty * 0.18
          : 0;
  const value = clamp(remembered + distortion);
  const good = value >= 0.55;
  const worker = CANDIDATES.find((candidate) => candidate.id === ref.candidate)!.name;
  let text = (good ? claim.good : claim.bad).replaceAll('{worker}', worker);
  if (question === 'ref-return')
    text = `${good ? 'Yes, if the hours suited us both.' : 'I would look for someone else.'} ${text}`;
  return { text, quality: claim.quality, value, ...(claim.wageDispute ? { wageDispute: true } : {}) };
}

interface HouseholdAccount {
  moments: Record<Quality, [good: string, bad: string]>;
  disagreement: string;
}
// Household names refer only to members in world.ts. These are separate events
// from referees' earlier households, not a common anecdote with names swapped.
const households: Record<string, HouseholdAccount> = {
  arslans: {
    moments: {
      patient: [
        'Saadet corrected the way Ada’s cardigan was fastened. {worker} listened, then asked Ada which fastening felt comfortable.',
        'Saadet corrected Ada’s cardigan fastening. {worker} snapped at her across Ada and Deniz’s breakfast table.',
      ],
      honest: [
        'Ece left nursery money under a saucer. {worker} checked the amount with her before taking it to pay the twins’ bill.',
        'Ece’s nursery money was short after {worker} took some without asking and denied touching the saucer.',
      ],
      reliable: [
        'Mert’s pharmacy opened early. {worker} arrived for the agreed handover before he left with his keys.',
        'Mert could not open the pharmacy on time because {worker} missed the agreed handover without a call.',
      ],
      warm: [
        'Deniz hid behind the sofa. {worker} rolled a toy car within reach and waited until he rolled it back.',
        'Deniz tried to show a toy car. {worker} turned away each time he came near.',
      ],
      hardworking: [
        'Ada and Deniz scattered their play dough before lunch. {worker} saved their models, cleared the table and finished the meal.',
        '{worker} abandoned the twins’ play-dough mess and left lunch unfinished on the stove.',
      ],
      discreet: [
        'A neighbour asked why Mert’s overnight bag was packed. {worker} referred the question to Ece.',
        '{worker} told the neighbour about Mert’s overnight bag and his brother’s flat.',
      ],
    },
    disagreement:
      'Saadet: “I asked {worker} to wash our windows while Ada and Deniz slept. Ece said childcare came first. We cannot give two different instructions.”',
  },
  kayas: {
    moments: {
      patient: [
        'Kemal pushed his plate away when words failed him. {worker} moved the hot food aside and waited for him to point.',
        'Kemal pushed his plate away. {worker} shouted that he would eat what he was given.',
      ],
      honest: [
        'Aylin handed over an envelope for Kemal’s supplies. {worker} opened it with her and wrote down exactly what was there.',
        '{worker} changed the amount written on Kemal’s supplies envelope and could not account for the difference.',
      ],
      reliable: [
        'Before Aylin’s first lesson, {worker} arrived with the dressing routine written in the care notebook.',
        'Aylin’s pupils waited while she stayed home because {worker} missed the morning dressing handover.',
      ],
      warm: [
        'Kemal pointed toward an old class photograph. {worker} sat close enough to listen as he named his friends.',
        'Kemal tried to share his old class photograph. {worker} put it face down and carried on without answering.',
      ],
      hardworking: [
        'Kemal needed a fresh shirt twice that morning. {worker} changed the bedding too and left clean clothes within reach.',
        '{worker} left Kemal in the damp shirt and put off the bedding change until Aylin returned.',
      ],
      discreet: [
        'Aylin’s colleague asked about the unpaid salary letters. {worker} said Aylin would need to answer that herself.',
        '{worker} showed Aylin’s unpaid salary letter to a colleague who came to the door.',
      ],
    },
    disagreement:
      'Aylin: “The school called me in early. I asked {worker} to dress Father before the agreed start, but we had never arranged that extra hour.”',
  },
  demirs: {
    moments: {
      patient: [
        'Deniz could not find his school compass. {worker} helped retrace his morning without scolding him.',
        'When Deniz lost his school compass, {worker} called him careless until he stopped asking for help.',
      ],
      honest: [
        'İpek found an extra parking charge on the journey sheet. {worker} explained it was a personal stop and paid it back at once.',
        '{worker} charged İpek for a personal parking stop and denied having made it.',
      ],
      reliable: [
        '{worker} waited outside Onur’s workplace at his agreed pickup time after his night shift.',
        '{worker} missed Onur’s agreed pickup after his night shift and left him waiting outside work.',
      ],
      warm: [
        'İpek came home exhausted. {worker} offered tea and made room at the cleared table without pressing for a conversation.',
        'İpek greeted {worker} after a long shift and received no answer, even when she repeated the greeting.',
      ],
      hardworking: [
        'After Deniz’s muddy football pickup, {worker} cleaned the car seats and checked the route for İpek’s early journey.',
        '{worker} left the Demirs’ car seats muddy and stopped preparing the route for İpek’s early journey.',
      ],
      discreet: [
        'A visitor asked where Onur spent his nights. {worker} said his private arrangements were for him to explain.',
        '{worker} told a visitor that Onur was sitting with his ill sister at night, without asking him.',
      ],
    },
    disagreement:
      'İpek: “I asked {worker} to stay silent about Onur, then asked what the neighbours were saying. That put the worker in an impossible conversation.”',
  },
  aks: {
    moments: {
      patient: [
        'Rauf took several minutes to stand after surgery. {worker} held the chair steady and let him set the pace.',
        '{worker} pulled at Rauf’s arm and complained about the time he needed to stand.',
      ],
      honest: [
        'Suna paid the same care invoice twice. {worker} pointed out the duplicate before accepting the second envelope.',
        '{worker} accepted Suna’s duplicate care payment and claimed it covered a visit that never happened.',
      ],
      reliable: [
        '{worker} checked Rauf’s hospital discharge time and was home for the agreed return.',
        'Rauf returned from hospital to find {worker} absent despite the arranged arrival time.',
      ],
      warm: [
        'Rauf began describing his old classroom. {worker} asked him about the pupils before offering help with his wash.',
        '{worker} spoke over Rauf’s account of teaching and addressed every question to Suna instead.',
      ],
      hardworking: [
        '{worker} cleaned and dried Rauf’s walking frame after the wet garden path, then finished the evening care.',
        '{worker} left mud on Rauf’s frame and stopped the evening care halfway through.',
      ],
      discreet: [
        'Suna asked about her own memory appointment in confidence. {worker} kept the appointment note in its closed folder.',
        '{worker} told a visiting former pupil about Suna’s memory appointment.',
      ],
    },
    disagreement:
      'Suna: “I kept answering for Rauf during his wash. {worker} asked me to let him speak, and I took that as criticism.”',
  },
  erdems: {
    moments: {
      patient: [
        'Ela and Efe refused to share a puzzle. {worker} gave them each an edge to build and stayed beside them.',
        '{worker} swept away Ela and Efe’s puzzle after they argued over a piece.',
      ],
      honest: [
        'Berrin confused an advance with that week’s wages. {worker} laid out the dated envelopes so they could count together.',
        '{worker} claimed a second advance from Berrin while denying the first signed envelope.',
      ],
      reliable: [
        '{worker} wrote down Berrin’s agreed shop-closing handover and had the twins ready at that time.',
        'Berrin returned at the agreed shop-closing handover, but {worker} had already left Ela and Efe with Naciye.',
      ],
      warm: [
        'Naciye watched the twins draw. {worker} invited her to choose a colour and join them at the table.',
        'Naciye tried to join Ela and Efe’s drawing, but {worker} moved their chairs away from her without answering.',
      ],
      hardworking: [
        'While the twins napped, {worker} finished the agreed toy cleanup and prepared their afternoon snack.',
        '{worker} stopped the agreed toy cleanup halfway through and left the twins’ snack unprepared.',
      ],
      discreet: [
        'A shop customer asked why the previous nanny left. {worker} referred the customer to Berrin without sharing the wage dispute.',
        '{worker} described Berrin’s unpaid wages to a shop customer at the front door.',
      ],
    },
    disagreement:
      'Berrin: “I added mopping the shop floor to the nanny’s afternoon. {worker} said Ela and Efe would have no one watching them. I said Naciye could manage.”',
  },
  yilmazs: {
    moments: {
      patient: [
        'Can was angry about an early start. {worker} gave him time to collect his bag and asked what was wrong.',
        '{worker} mocked Can for being tired and kept sounding the horn beneath his window.',
      ],
      honest: [
        'Fikret left repair money in the glovebox. {worker} reported the unused notes before returning the car.',
        '{worker} took repair money from the glovebox and told Fikret the garage had charged it.',
      ],
      reliable: [
        'At six, {worker} was at the Yılmazs’ door so Sevil could catch her hospital shift.',
        'Sevil missed the start of her hospital shift after {worker} failed to arrive at six or call.',
      ],
      warm: [
        'Can said nobody would notice if he missed school. {worker} listened and asked him which teacher he trusted.',
        'Can tried to talk about missing school. {worker} turned up the car radio over his voice.',
      ],
      hardworking: [
        '{worker} cleared frost from every window before the Yılmazs’ early drive, then checked the lights.',
        '{worker} left the windscreen partly iced over and stopped preparing the Yılmazs’ car before it was safe to leave.',
      ],
      discreet: [
        'A mechanic asked why Can was out of school. {worker} suggested he speak privately with Fikret.',
        '{worker} told Fikret’s workshop customers about Can’s missed school days.',
      ],
    },
    disagreement:
      'Sevil: “My ward changed the rota. I told {worker} we needed a five o’clock pickup, as though the six o’clock agreement covered any hour.”',
  },
  celiks: {
    moments: {
      patient: [
        'İdil rejected the dinner vegetables one by one. {worker} let her choose a small portion without turning it into a fight.',
        '{worker} argued with İdil over every vegetable until dinner ended in tears.',
      ],
      honest: [
        'Tülay left loose shopping notes on the counter. {worker} counted them with her and returned the itemised change.',
        '{worker} took a loose note from Tülay’s shopping money and denied the amount left on the counter.',
      ],
      reliable: [
        '{worker} had the Çeliks’ dinner ready for the time Tülay wrote beside her late court hearing.',
        'Tülay returned from court at the written dinner time, but {worker} had not begun cooking.',
      ],
      warm: [
        'Ali came back before lunch. {worker} offered him a seat and a portion without demanding an explanation.',
        'Ali came home before lunch. {worker} ignored his greeting and cleared away the spare place in front of him.',
      ],
      hardworking: [
        'The Çeliks’ oven failed mid-meal. {worker} finished the dishes on the hob and cleaned the pans afterward.',
        'When the Çeliks’ oven failed, {worker} abandoned the half-cooked meal without trying the working hob.',
      ],
      discreet: [
        'İdil asked why Ali still dressed for work. {worker} left that explanation to her parents.',
        '{worker} told İdil that Ali had lost his job before her parents had spoken with her.',
      ],
    },
    disagreement:
      'Tülay: “I left shopping cash without counting it, then asked {worker} to sign for a figure I named afterward. We need to count it together.”',
  },
  ozkans: {
    moments: {
      patient: [
        'Nesrin asked again whether she had eaten. {worker} showed her the dated lunch note and sat with her.',
        'Nesrin asked whether she had eaten. {worker} pointed at the lunch note and shouted that she had already been told.',
      ],
      honest: [
        'Barış paid for two medicine trips by mistake. {worker} returned the second fare before leaving downstairs.',
        '{worker} charged Barış for a second medicine trip that never took place.',
      ],
      reliable: [
        '{worker} rang Barış downstairs at the agreed handover time before leaving Nesrin upstairs.',
        '{worker} left Nesrin upstairs before Barış had returned for their agreed handover.',
      ],
      warm: [
        'Nesrin brought out her wedding album. {worker} asked about the dress and listened as she turned each page.',
        '{worker} pushed Nesrin’s wedding album aside and told her old pictures were no use now.',
      ],
      hardworking: [
        '{worker} washed Nesrin’s lunch things, aired her room and finished the agreed upstairs cleaning.',
        '{worker} left Nesrin’s lunch dishes crusted and the agreed upstairs cleaning untouched.',
      ],
      discreet: [
        'An estate agent asked about Nesrin’s routines. {worker} said any viewing needed Barış and Nesrin’s agreement.',
        '{worker} told the estate agent when Nesrin would be away, revealing the sale plans before Barış had told her.',
      ],
    },
    disagreement:
      'Barış: “I wanted {worker} to take Mother out while an estate agent came. Mother has not agreed to a sale. The worker refused to hide the visit.”',
  },
  aydins: {
    moments: {
      patient: [
        'Bora cried as Selda left for the flower shop. {worker} stayed nearby without forcing him away from the door.',
        '{worker} dragged Bora away from the door while he cried for Selda.',
      ],
      honest: [
        'Hakan overpaid a taxi fare for Bora’s outing. {worker} brought the driver’s refund back to him.',
        '{worker} kept the taxi refund from Bora’s outing and said the meter had cost the full amount.',
      ],
      reliable: [
        '{worker} brought Bora home before Selda’s agreed flower-delivery handover.',
        'Selda waited with her flower delivery because {worker} returned late with Bora and did not call.',
      ],
      warm: [
        'Bora offered a crushed flower. {worker} found a small jar for it and thanked him.',
        'Bora held out a flower. {worker} dropped it into the bin while he watched.',
      ],
      hardworking: [
        'After Bora spilled soil from a flowerpot, {worker} cleaned the floor and finished his lunch preparation.',
        '{worker} left Bora’s spilled potting soil across the floor and his lunch ingredients unopened.',
      ],
      discreet: [
        'Selda hid a clinic leaflet among the seed catalogues. {worker} returned it privately without discussing it with Hakan.',
        '{worker} showed Hakan the clinic leaflet Selda had kept among the seed catalogues.',
      ],
    },
    disagreement:
      'Selda: “I asked {worker} to keep Bora at the flower shop through an evening delivery. We had only agreed daytime care at home.”',
  },
  tass: {
    moments: {
      patient: [
        'Ömer mixed his clean clothes back into the wash. {worker} helped him sort the piles again without scolding.',
        '{worker} shouted at Ömer over the mixed laundry and tipped both piles onto his bed.',
      ],
      honest: [
        'Melek paid for soap that was already in the cupboard. {worker} pointed it out and returned the unused money.',
        '{worker} claimed to have bought new soap while using the Taş family’s existing supply and keeping the money.',
      ],
      reliable: [
        '{worker} finished Ömer’s school shirt before the morning departure they had agreed with Halil.',
        'Ömer had no dry school shirt after {worker} missed the washing time agreed with Halil.',
      ],
      warm: [
        'Zeynep arrived carrying bakery trays. {worker} cleared her a chair and asked if she had eaten.',
        'Zeynep came home from the bakery, but {worker} dismissed her greeting and left her standing with the trays.',
      ],
      hardworking: [
        'With the machine broken, {worker} rinsed the final basin by hand and hung all four people’s clothes.',
        '{worker} left half the hand-washed laundry in dirty water after saying the job was finished.',
      ],
      discreet: [
        'A bakery customer asked whether Zeynep had quit school. {worker} said Zeynep should speak for herself.',
        '{worker} repeated Zeynep’s plan to leave school to a bakery customer.',
      ],
    },
    disagreement:
      'Melek: “The washing machine broke again. I asked {worker} for all four people’s bedding by hand at the same rate as one machine load.”',
  },
  sahins: {
    moments: {
      patient: [
        'Lale struggled with the buckle on her violin case. {worker} held the case steady while she tried again.',
        '{worker} snatched Lale’s violin case away when she struggled with the buckle.',
      ],
      honest: [
        'Gaye paid for a music lesson that was cancelled. {worker} returned the teacher’s refunded fee.',
        '{worker} kept the refunded music-lesson fee and told Gaye the lesson had gone ahead.',
      ],
      reliable: [
        '{worker} reached Lale’s school gate before eight and checked the music-lesson collection afterward.',
        'Lale’s school gate had closed by the time {worker} arrived, despite the written eight o’clock deadline.',
      ],
      warm: [
        'Lale practised a new tune in the parked car. {worker} listened to the end and asked its name.',
        '{worker} cut off Lale’s tune in the parked car and told her nobody wanted to hear it.',
      ],
      hardworking: [
        '{worker} cleaned a spilled drink from Lale’s seat, checked the violin straps and finished preparing the school run.',
        '{worker} left Lale’s seat wet and the violin straps tangled, then stopped preparing the school run.',
      ],
      discreet: [
        'Serdar asked about an address in Gaye’s bag. {worker} said Gaye needed to explain her own papers.',
        '{worker} told Serdar where Gaye had arranged the separate flat.',
      ],
    },
    disagreement:
      'Serdar: “I changed Lale’s lesson collection with one message and assumed {worker} could wait two more hours. The old finish time was still the agreement.”',
  },
  ugurs: {
    moments: {
      patient: [
        'Tahir counted his change for the third time. {worker} laid the coins out where he could see each one.',
        '{worker} swept Tahir’s coins into a pile and scolded him for counting them again.',
      ],
      honest: [
        'Tahir thought he had lost a note. {worker} helped find it in his old bus-driver’s wallet before settling the shopping account.',
        '{worker} hid Tahir’s misplaced note and then said the shopping had cost that much extra.',
      ],
      reliable: [
        '{worker} reached the Uğurs before the pharmacy closed, as promised for Tahir’s medicine collection.',
        'Tahir’s medicine stayed at the closed pharmacy after {worker} missed the promised collection time.',
      ],
      warm: [
        'Perihan showed a jacket she had sewn. {worker} asked about the stitching and listened to her explanation.',
        '{worker} dismissed Perihan’s sewing story and put the jacket out of sight.',
      ],
      hardworking: [
        '{worker} finished the Uğurs’ mending pile and swept the sewing threads from under Perihan’s table.',
        '{worker} abandoned the Uğurs’ mending pile and left pins among the threads on the floor.',
      ],
      discreet: [
        'The jeweller asked why Perihan was selling a bracelet. {worker} said only Perihan could answer that.',
        '{worker} told the jeweller that Perihan’s bracelet would pay for Tahir’s medicine.',
      ],
    },
    disagreement:
      'Perihan: “Tahir accused {worker} over change he had put in his other pocket. I asked the worker to apologise to keep him calm instead of correcting the mistake.”',
  },
  karas: {
    moments: {
      patient: [
        'Mina woke while Nil needed breakfast help. {worker} settled Mina within sight and let Nil finish her own spoonful.',
        '{worker} shouted at Nil to hurry while Mina cried beside the unfinished breakfast.',
      ],
      honest: [
        'Aslı left cash for baby supplies. {worker} showed her the shop’s substitution and its lower price.',
        '{worker} charged Aslı for the dearer baby supplies while buying the cheaper substitute and hiding the difference.',
      ],
      reliable: [
        '{worker} had Nil and Mina ready for the handover before Aslı’s hospital round began.',
        'Aslı’s hospital round began while she was still waiting for {worker} to complete the agreed handover.',
      ],
      warm: [
        'Nil wanted to feed her doll beside Mina. {worker} set a safe little place for both sisters’ games.',
        '{worker} pushed Nil’s doll out of the way and ignored her attempt to join Mina’s game.',
      ],
      hardworking: [
        '{worker} washed Mina’s bibs, cleared Nil’s cereal and completed the agreed breakfast cleanup.',
        '{worker} left Mina’s bibs soaking and Nil’s cereal hardening after saying the breakfast cleanup was done.',
      ],
      discreet: [
        'Tolga asked about a letter from another city. {worker} gave it to Aslı privately rather than interpreting it for him.',
        '{worker} told Tolga about Aslı’s job offer in another city before she had decided how to tell him.',
      ],
    },
    disagreement:
      'Tolga: “I asked {worker} to prepare food for my restaurant while the girls napped. A nanny’s break became restaurant prep without any agreement.”',
  },
  polats: {
    moments: {
      patient: [
        'Füsun changed her lunch choice after the pan was hot. {worker} asked what she could eat and adjusted one portion.',
        '{worker} banged the hot pan down when Füsun changed her lunch choice and refused to speak to her.',
      ],
      honest: [
        'Erhan’s supplier delivered fewer portions than billed. {worker} counted the trays with him before signing.',
        '{worker} signed for extra lunch trays, then kept the supplier’s cash adjustment without telling Erhan.',
      ],
      reliable: [
        '{worker} had eight Saturday lunches ready for the time Sevim wrote on the kitchen board.',
        'Sevim’s eight guests arrived at the written lunch time, but {worker} had not finished the first dish.',
      ],
      warm: [
        'Füsun hovered outside the kitchen. {worker} offered her tea and a place at the small preparation table.',
        'Füsun asked for company in the kitchen. {worker} shut the door in her face.',
      ],
      hardworking: [
        'After the Polats’ lunch guests left, {worker} finished the last serving dish and wiped the greasy hob.',
        '{worker} left the last serving dishes and greasy hob untouched after the Polats’ lunch guests left.',
      ],
      discreet: [
        'A lunch guest asked why Füsun stayed for winter. {worker} returned to serving and left the question for Füsun.',
        '{worker} told a lunch guest that Füsun’s husband had thrown her out.',
      ],
    },
    disagreement:
      'Sevim: “I said eight for lunch, then invited six more and called it a small change. {worker} pointed to the quantities we had bought for eight.”',
  },
  tekins: {
    moments: {
      patient: [
        'İsmail refused a wash until his tea cooled. {worker} sat with him and returned to the wash when he was ready.',
        '{worker} poured away İsmail’s tea and insisted on the wash while he protested.',
      ],
      honest: [
        'Aysel gave money for a replacement wash basin. {worker} found the old one intact and returned the whole amount.',
        '{worker} kept Aysel’s basin money and said a new basin had been bought, though the old one was still in use.',
      ],
      reliable: [
        '{worker} arrived for the agreed afternoon relief so Rukiye could leave for her appointment.',
        'Rukiye missed her appointment because {worker} failed to arrive for the agreed relief or telephone.',
      ],
      warm: [
        'İsmail began talking about the old neighbourhood over tea. {worker} asked which street he missed before offering the washcloth.',
        '{worker} ignored İsmail’s neighbourhood story and spoke about him to Aysel as if he were absent.',
      ],
      hardworking: [
        '{worker} dried the bathroom floor, put away İsmail’s wash things and completed the agreed care notes.',
        '{worker} left the bathroom floor wet and İsmail’s wash things scattered, with the care notes unfinished.',
      ],
      discreet: [
        'A neighbour asked why Rukiye had gone to a clinic. {worker} said Rukiye’s appointments were private.',
        '{worker} told the neighbour about the medical appointment Rukiye had been hiding.',
      ],
    },
    disagreement:
      'Aysel: “Mother needed her own appointment. I asked {worker} for an overnight stay instead of the afternoon relief we had agreed. Nobody had discussed a night rate.”',
  },
  inces: {
    moments: {
      patient: [
        'Arda refused to leave without his model bridge. {worker} helped him find a box that would carry it safely.',
        '{worker} broke off Arda’s model bridge while rushing him out of the house.',
      ],
      honest: [
        'Cenk gave two toll payments by mistake. {worker} compared the journey record with him and returned the duplicate.',
        '{worker} claimed two toll crossings from Cenk for a journey that used the bridge once.',
      ],
      reliable: [
        'Derya changed the collection time by telephone. {worker} read it back and wrote both schools’ new times down.',
        '{worker} accepted Derya’s changed collection time without writing it down, then went to the wrong school first.',
      ],
      warm: [
        'Eylül described a school exhibition on the ride home. {worker} asked which model was hers and listened.',
        '{worker} told Eylül her school exhibition was boring and cut off her story in the car.',
      ],
      hardworking: [
        'After muddy school pickups, {worker} cleaned the İnces’ seat belts and mats and checked the next morning’s route.',
        '{worker} left the İnces’ muddy seat belts and mats untouched and never finished checking the next route.',
      ],
      discreet: [
        'Arda asked whether the family was moving. {worker} left Cenk and Derya to explain their plans together.',
        '{worker} repeated Cenk’s promised move to the children even though Derya had refused it.',
      ],
    },
    disagreement:
      'Derya: “I changed the two school collections twice by telephone, then blamed {worker} for using the first timetable. We need one written version.”',
  },
};

export function familyMoment(familyId: string, quality: Quality, good: boolean, worker: string): string {
  return households[familyId]!.moments[quality][good ? 0 : 1].replaceAll('{worker}', worker);
}

export function familyDisagreementWords(familyId: string, worker: string): string {
  return households[familyId]!.disagreement.replaceAll('{worker}', worker);
}
