import { estimate, type Person } from '@adam0white/human-framework';
import type { Quality, SceneChoice } from './types.ts';
import { CANDIDATES, QUALITY_MAP, type Referee } from './world.ts';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const cue = (quality: Quality) =>
  ['warm', 'hardworking', 'discreet'].includes(quality)
    ? `trait:goodhands:${quality}`
    : `trait:${QUALITY_MAP[quality]}`;

/** The worker supplies only name and pronouns here, never hidden qualities. */
export function referenceOpening(ref: Referee, person: Person): string {
  const subject = person.life.sex === 'male' ? 'He' : 'She';
  const object = person.life.sex === 'male' ? 'him' : 'her';
  switch (ref.bias) {
    case 'fond':
      return `I was sorry to lose ${object}. ${subject} brought a chair into the kitchen so my mother did not have to eat alone. You must find ${object} a good house.`;
    case 'stingy':
      return `I would be careful about taking ${object} on. ${subject} stopped at the door one evening and asked me to count the wages before leaving. After everything we had done.`;
    case 'cagey':
      return `${subject} worked here, yes. I would want the arrangement very clear next time. On the last morning I found the keys on the kitchen table. I would rather answer a specific question.`;
    case 'fair':
      return `I can give you a reference, with reservations. ${subject} and I went through the work list at the kitchen table before the first morning. Ask me what matters to the next household.`;
  }
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
  const quality: Quality =
    question === 'ref-patient'
      ? 'patient'
      : question === 'ref-honest' || question === 'ref-leaving'
        ? 'honest'
        : 'reliable';
  const remembered = estimate(speaker, ref.candidate, cue(quality), now).value;
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
  const worker = CANDIDATES.find((candidate) => candidate.id === ref.candidate)?.name ?? 'The worker';
  let text: string;
  switch (question) {
    case 'ref-patient':
      text = good
        ? `My mother asked the same question three times. ${worker} pulled up a chair and answered each time.`
        : `My mother asked the same question again. ${worker} said, “I have already told you,” and walked out of the room.`;
      break;
    case 'ref-honest':
      text = good
        ? `I left money for the shopping. ${worker} put the receipt and every coin of change beside it.`
        : `The shopping money came back short. ${worker} and I never agreed about where the difference went.`;
      if (ref.bias === 'stingy') text += ' There was always another question about wages.';
      break;
    case 'ref-leaving':
      if (ref.bias === 'stingy') {
        return {
          text: `${worker} said, “You still owe me for the last fortnight.” I said we had paid enough, with meals included. Then came, “I will not come back until you pay what we agreed.” That is how it ended.`,
          quality,
          value,
          wageDispute: true,
        };
      }
      text =
        ref.bias === 'fond'
          ? `We could no longer afford the arrangement. ${worker} stayed through the last week. I still wish it had worked out.`
          : ref.bias === 'cagey'
            ? `There was a disagreement. ${worker} left the keys on the table. I do not want to repeat everything that was said.`
            : good
              ? `Our hours changed. ${worker} told us those hours would not work and stayed until the date we agreed.`
              : `We disagreed about the hours and the pay. ${worker} said we had changed the arrangement; I remember it differently.`;
      break;
    case 'ref-return':
      text = good
        ? `Yes, if the hours suited us both. When I had an early appointment, ${worker} arrived before I needed to leave.`
        : `I would look for someone else. Twice I was standing at the door with my coat on, still waiting for ${worker}.`;
      break;
    default:
      text = good
        ? `When the bus was late, ${worker} called before the agreed time. I could arrange the morning.`
        : `${worker} missed the agreed time more than once. I had to telephone to find out whether anyone was coming.`;
  }
  if (ref.bias === 'fond') text += ' Please remember the good work too.';
  if (ref.bias === 'cagey') text += ' That is all I am prepared to say about it.';
  return { text, quality, value };
}
