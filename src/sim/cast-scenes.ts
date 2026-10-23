/** Voluntary, scoped discoveries. No biography import grants player knowledge.
 * These encounters author bounded choices, not therapeutic success or clinical work.
 */
import { perceive } from '@adam0white/human-framework';
import { CAST, type CastKey } from './cast.ts';
import type { State } from './types.ts';

export interface CastContact {
  id: CastKey;
  name: string;
  role: string;
  text: string;
  choices: { id: string; label: string }[];
}
type Stage = { step: 1 | 2; text: string };
type CastState = State & { castTalk?: Partial<Record<CastKey, Stage>> };
const STORY: Record<
  CastKey,
  { invite: string; disclosure: string; choice: string; outcome: string; defer: string }
> = {
  nermin: {
    invite: 'Ask Nermin whether she wants to review an earlier agency decision',
    disclosure:
      'Nermin agrees to review her own account, with client identifiers covered. “I called it a mismatch. I softened a worker’s warning about unpaid nights, then refunded the client before checking the worker’s loss.”',
    choice: 'Help her correct the agency account and write the worker first',
    outcome:
      'Nermin corrects “mismatch” to her own failure to record the unpaid-night warning. She drafts a private letter asking the worker to check the dates before any substantiated payment offer. Nothing has been sent or paid yet.',
    defer: 'Nermin closes the covered file. The old account remains uncorrected today.',
  },
  hulya: {
    invite: 'Ask what would make the baking placement workable beyond its paid hours',
    disclosure:
      'Hülya asks for a sunny ledge. “I kept seeds from the hotel windowsills. My adult stepdaughter calls them my portable garden. There is a tomato taste I have never quite grown again.”',
    choice: 'Keep a sunny office ledge free for her seedlings, with her agreement',
    outcome:
      'Hülya agrees to leave two labelled pots on the office ledge during the agency’s open hours. She keeps the seed envelopes. This is a small experiment, not a promise of a harvest or reconciliation.',
    defer:
      'Hülya keeps the seeds with her. Any future cooking agreement need not include her private garden.',
  },
  aylin: {
    invite: 'Ask whether she would consider evening work',
    disclosure:
      'Aylin declines evening work. “I have a dance class above a tyre shop. I count too hard and get it wrong. It is nice being somewhere I am not the dependable sister.” She has not invited Dilan or made this family news.',
    choice: 'Keep the evening free without passing on her reason',
    outcome:
      'Nermin records Aylin’s finish time on her application. Any later offer will still need her agreement. The class stays private. She makes no family invitation.',
    defer: 'Nermin makes no evening offer. Aylin has not accepted extra work, and her class remains private.',
  },
  hatice: {
    invite: 'Ask Hatice to define what she expects from this paid exchange',
    disclosure:
      'Hatice asks for a defined trial and says her garden has temporary cover, then volunteers an older mistake. “I called a wedding contribution a gift, but expected the reception at my garden. I complained about ingratitude without saying what I expected.”',
    choice: 'Invite her to separate the gift from the business expectation',
    outcome:
      'Hatice writes a correction to the complaint in her own words. She keeps it to take back to those who heard it. She has not spoken to them yet.',
    defer:
      'Hatice leaves the older complaint unresolved. Any future trial still needs written duties and an end date.',
  },
  derya: {
    invite: 'Call Derya after her morning sleep to discuss the boundary of agency care',
    disclosure:
      'Derya, a night nurse, distinguishes household company from skilled care without offering to cover the gap. When asked about boundaries she volunteers: “I reported a scheduling error before anyone was harmed. Training stopped being offered afterwards. I kept the letters; I do not know whether those things were connected.” She does not discuss any patient or her family’s private circumstances.',
    choice: 'Help her draft a precise question about the training decision',
    outcome:
      'Derya drafts a dated request for the training criteria and keeps it for a colleague to review. She will check it with a colleague before sending it. Nermin cannot arrange skilled care through this call.',
    defer: 'Derya ends the call with the care boundary clear. She has not submitted a training request.',
  },
  'zeynep-pass': {
    invite: 'After the cold-supper trial, ask whether she wants paid time to price another menu',
    disclosure:
      'Zeynep chooses to show her unsigned daytime meal-service application. “I can price the ingredients. I left my own salary blank.” Her two sons and daily home window remain part of the agreement.',
    choice: 'Offer a paid half-hour of agency menu costing before her home window',
    outcome:
      'Nermin offers ₺150 for a future half-hour of menu costing, with menu credit and a stated leaving time. Zeynep takes the written offer to consider. She has not accepted or booked the half-hour, and her application stays unsigned.',
    defer:
      'Zeynep puts the application away. The completed cold-supper trial and home window remain unchanged.',
  },
  'selin-voice': {
    invite: 'Ask whether she wants the enquiry answer in words she can take home',
    disclosure:
      'Selin asks Nermin to write the limit plainly. “I keep making calls into inspections since Mum died. I deleted an ordinary message from her before I knew it would matter. There is no copy to recover.” She is sharing this herself; it does not grant knowledge of Halil’s health.',
    choice: 'Write only the actual service limit; let her choose the next family conversation',
    outcome:
      'Selin keeps the written answer: no suitable service or placement has been confirmed. She says she wants to ask Halil what visit he would welcome. She has not called him yet; the message is still gone.',
    defer:
      'Selin ends the conversation. The enquiry remains an enquiry, and the deleted message remains private.',
  },
};
function eligible(s: CastState, id: CastKey): boolean {
  if (s.ended || s.scene || !s.people[id] || s.now < s.people[id]!.now) return false;
  const t = s.now % 1440;
  if (id === 'nermin') return t >= 510 && t < 1080;
  if (id === 'derya') return s.now >= 1440 + 840 && t >= 840 && t < 1020;
  if (id === 'zeynep-pass' || id === 'selin-voice') {
    const guests = s.guests as { id: string; status: string }[] | undefined;
    return (
      !!guests?.some((g) => g.id === id && g.status === 'complete') &&
      (id === 'selin-voice' ? t >= 1080 && t < 1260 : t >= 600 && t < 960)
    );
  }
  const cards = s.cards as Record<string, { met: boolean; status: string }>;
  return !!cards[id]?.met && cards[id]?.status === 'bench' && t >= 540 && t < 1020;
}
export function castContacts(state: State): CastContact[] {
  const s = state as CastState;
  return (Object.keys(CAST) as CastKey[])
    .filter((id) => eligible(s, id))
    .map((id) => {
      const stage = s.castTalk?.[id];
      const story = STORY[id];
      return {
        id,
        name: CAST[id].name,
        role: `${CAST[id].age} · ${CAST[id].role}`,
        text:
          stage?.text ??
          `${CAST[id].name} can choose whether to discuss something beyond the immediate work.`,
        choices:
          stage?.step === 2
            ? []
            : stage?.step === 1
              ? [
                  { id: 'respect', label: story.choice },
                  { id: 'defer', label: 'Leave this decision with her for now' },
                ]
              : [{ id: 'invite', label: story.invite }],
      };
    });
}
export function applyCastTalk(state: State, id: CastKey, choice: string): boolean {
  const s = state as CastState;
  const contact = castContacts(s).find((c) => c.id === id);
  if (!contact?.choices.some((c) => c.id === choice)) return false;
  s.castTalk ??= {};
  const story = STORY[id];
  const text = choice === 'invite' ? story.disclosure : choice === 'respect' ? story.outcome : story.defer;
  s.castTalk[id] = { step: choice === 'invite' ? 1 : 2, text };
  const p = s.people[id]!;
  perceive(p, [
    {
      kind: 'speech',
      channel: 'told',
      at: p.now,
      actorId: id,
      targetId: 'nermin',
      valence: 0,
      salience: 1,
      summary: text,
    },
  ]);
  if (id !== 'nermin') {
    const observer = s.people.nermin!;
    perceive(observer, [
      {
        kind: 'speech',
        channel: 'told',
        at: observer.now,
        actorId: id,
        targetId: 'nermin',
        valence: 0,
        salience: 1,
        summary: text,
      },
    ]);
  }
  const logs = s.log as { id: number; at: number; kind: string; text: string }[];
  logs.push({ id: logs.length + 1, at: s.now, kind: 'word', text: `${CAST[id].name}: ${text}` });
  return true;
}
