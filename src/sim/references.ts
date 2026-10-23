import { estimate, type Person } from '@adam0white/human-framework';
import { householdConsequence } from './backstories.ts';
import type { Quality, SceneChoice } from './types.ts';
import { CANDIDATES, FAMILIES, QUALITY_MAP, type Referee } from './world.ts';

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
const accounts: Record<string, ReferenceAccount> = Object.fromEntries(
  CANDIDATES.map((c) => [
    c.id,
    {
      opening: `I can speak about a finished ${c.roles[0]} engagement, not every part of ${c.name}’s life.`,
      patient: story(
        'patient',
        '{worker} listened when the instructions were repeated.',
        '{worker} argued when the instructions were repeated.',
      ),
      honest: story(
        'honest',
        '{worker} returned the change with the receipts.',
        '{worker} could not explain the missing change.',
      ),
      reliable: story(
        'reliable',
        '{worker} arrived at the agreed time.',
        '{worker} missed the agreed arrival without calling.',
      ),
      leaving: story(
        'reliable',
        '{worker} completed the agreed handover.',
        '{worker} left without the agreed handover.',
      ),
    },
  ]),
);

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
    {
      id: 'finish',
      label: 'End the call',
      hint: 'Ask what you need before hanging up. This employer has no new account to give on another call.',
    },
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

type FollowUpTopic = 'patient' | 'honest' | 'reliable' | 'leaving';
interface WorkerReferenceAccount {
  opening: string;
  patient: [good: string, bad: string];
  honest: [good: string, bad: string];
  reliable: [good: string, bad: string];
  leaving: [good: string, bad: string];
}

// These are the worker's account of the same event, not findings of fact.
// They depend on what the referee said, never on the worker's hidden traits.
const workerReferenceAccounts: Record<string, WorkerReferenceAccount> = Object.fromEntries(
  CANDIDATES.map((c) => [
    c.id,
    {
      opening: 'That reference concerns a finished work engagement; we may remember it differently.',
      patient: [
        'I listened to the repeated instructions.',
        'I argued about the instructions; I should have checked what was needed.',
      ],
      honest: [
        'I kept the change and receipts together.',
        'We need to compare the receipts before deciding what happened.',
      ],
      reliable: ['I arrived at the agreed time.', 'I missed the arrival; I should have called.'],
      leaving: ['I completed the handover.', 'We had not settled the handover before I left.'],
    },
  ]),
);

export function referenceFollowUp(
  candidateId: string,
  refName: string,
  claim: string,
  choiceId: string,
): { label: string; reply: string } {
  const account = accounts[candidateId];
  const workerAccount = workerReferenceAccounts[candidateId];
  const worker = CANDIDATES.find((candidate) => candidate.id === candidateId)?.name;
  if (!account || !workerAccount || !worker)
    throw new Error(`No authored reference follow-up for ${candidateId}`);
  const topic: FollowUpTopic | 'opening' =
    choiceId === 'ref-patient'
      ? 'patient'
      : choiceId === 'ref-honest'
        ? 'honest'
        : choiceId === 'ref-leaving'
          ? 'leaving'
          : choiceId === 'ref-opening'
            ? 'opening'
            : 'reliable';
  const bad = topic !== 'opening' && claim.includes(account[topic].bad.replaceAll('{worker}', worker));
  return {
    label: `${refName} says: “${claim}”`,
    reply: topic === 'opening' ? workerAccount.opening : workerAccount[topic][bad ? 1 : 0],
  };
}

interface HouseholdAccount {
  moments: Record<Quality, [good: string, bad: string]>;
  disagreement: string;
}
// Household names refer only to members in world.ts. These are separate events
// from referees' earlier households, not a common anecdote with names swapped.
const moments: Record<Quality, [string, string]> = {
  patient: [
    '{worker} let the household member finish explaining.',
    '{worker} interrupted and argued before the explanation finished.',
  ],
  honest: [
    '{worker} counted the change against the receipts.',
    '{worker} could not account for the shopping change.',
  ],
  reliable: ['{worker} arrived for the agreed start.', '{worker} missed the start without warning.'],
  warm: [
    '{worker} asked the person receiving help what they wanted.',
    '{worker} spoke about the person without asking them.',
  ],
  hardworking: ['{worker} finished the agreed tasks.', '{worker} left the agreed tasks unfinished.'],
  discreet: [
    '{worker} refused to repeat a private household matter.',
    '{worker} repeated a private household matter to a visitor.',
  ],
};
const households: Record<string, HouseholdAccount> = Object.fromEntries(
  FAMILIES.map((f) => [
    f.id,
    {
      moments,
      disagreement:
        'Household contact: “We asked {worker} to add work after the agreed finish. We need to settle the hours.”',
    },
  ]),
);

export function familyMoment(familyId: string, quality: Quality, good: boolean, worker: string): string {
  return [
    households[familyId]!.moments[quality][good ? 0 : 1].replaceAll('{worker}', worker),
    householdConsequence(familyId, quality, good),
  ]
    .filter(Boolean)
    .join(' ');
}

export function familyDisagreementWords(familyId: string, worker: string): string {
  return households[familyId]!.disagreement.replaceAll('{worker}', worker);
}
