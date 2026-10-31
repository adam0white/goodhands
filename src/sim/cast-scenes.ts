/** Voluntary, scoped discoveries. No biography import grants player knowledge.
 * These encounters author bounded choices, not therapeutic success or clinical work.
 */

import { CAST, type CastKey } from './cast.ts';
import { perceive, unavailable } from './hf4.ts';
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
      'Nermin agrees to review her own account. She covers the details that identify the client. “I said the worker and client were not suited to each other. The worker had warned me about unpaid nights. I made the warning sound less serious, then refunded the client before checking how much the worker had lost.”',
    choice: 'Help her correct the agency record and write to the worker first',
    outcome:
      'Nermin corrects the record. She writes that she failed to record the warning about unpaid nights. She drafts a private letter asking the worker to check the dates before she offers a payment based on those dates. She has not sent the letter or paid anything yet.',
    defer:
      'Nermin closes the file with the client’s details still covered. She has not corrected the old account today.',
  },
  hulya: {
    invite: 'Ask what would help her take on the baking and meal-preparation work',
    disclosure:
      'Hülya asks for a sunny ledge. “I kept seeds from the plants on the hotel windowsills. My adult stepdaughter says I can take my garden with me. I have never managed to grow tomatoes with that same taste again.”',
    choice: 'Keep a sunny office ledge free for her seedlings, with her agreement',
    outcome:
      'Hülya agrees to leave two labelled pots on the office ledge during the agency’s open hours. She keeps the seed envelopes. She will try growing the plants. This does not promise a harvest or a closer relationship with her stepdaughter.',
    defer:
      'Hülya keeps the seeds with her. Her private garden does not need to be part of any future cooking agreement.',
  },
  aylin: {
    invite: 'Ask whether she would consider evening work',
    disclosure:
      'Aylin declines evening work. “I have a dance class above a tyre shop. I concentrate so hard on counting that I get the steps wrong. It is nice being somewhere I do not have to be the sister everyone depends on.” She has not invited Dilan or told her family about the class.',
    choice: 'Keep the evening free without passing on her reason',
    outcome:
      'Nermin records Aylin’s finish time on her application. Any later offer will still need her agreement. The class stays private. She does not invite her family.',
    defer: 'Nermin makes no evening offer. Aylin has not accepted extra work, and her class remains private.',
  },
  hatice: {
    invite: 'Ask Hatice what she expects from this paid work',
    disclosure:
      'Hatice asks for a trial with clear duties. She says someone is covering her garden work for now. Then she chooses to tell you about an older mistake. “I gave money for a wedding and called it a gift, but I expected them to hold the reception at my garden. I complained that they were ungrateful without saying what I expected.”',
    choice: 'Invite her to explain that she expected business in return for the gift',
    outcome:
      'Hatice writes a correction to the complaint in her own words. She keeps it to take back to those who heard it. She has not spoken to them yet.',
    defer:
      'Hatice leaves the older complaint unresolved. Any future trial still needs written duties and an end date.',
  },
  derya: {
    invite: 'Call Derya after her morning sleep to discuss what care the agency can arrange',
    disclosure:
      'Derya is a night nurse. She explains that keeping someone company differs from care that needs training. She does not offer to provide that care herself. When asked about the limits of her work, she chooses to share this: “I reported a scheduling error before anyone was harmed. They stopped offering me training afterwards. I kept the letters. I do not know whether those things were connected.” She does not discuss any patient or her family’s private circumstances.',
    choice: 'Help her draft a precise question about the training decision',
    outcome:
      'Derya drafts and dates a request asking how training decisions are made. She keeps it for a colleague to review before she sends it. Nermin cannot arrange care that needs training through this call.',
    defer:
      'Derya ends the call after explaining what care the agency can arrange. She has not sent a training request.',
  },
  'zeynep-pass': {
    invite: 'After the cold-supper trial, ask whether she wants paid time to price another menu',
    disclosure:
      'Zeynep chooses to show her unsigned application to provide meals during the day. “I can work out the ingredient costs. I left my own salary blank.” The agreement still protects her daily time at home with her two sons.',
    choice: 'Offer a paid half-hour to calculate menu costs before she goes home',
    outcome:
      'Nermin offers ₺150 for a future half-hour to calculate menu costs. The offer names Zeynep as the menu’s creator and states when she can leave. Zeynep takes the written offer to consider. She has not accepted it or booked the half-hour. Her application stays unsigned.',
    defer:
      'Zeynep puts the application away. Her completed cold-supper trial and agreed time at home remain unchanged.',
  },
  'selin-voice': {
    invite: 'Ask whether she wants a written answer to take home',
    disclosure:
      'Selin asks Nermin to write clearly what help the agency can arrange. “Since Mum died, I turn ordinary calls into checks on the person I am calling. I deleted an ordinary message from her before I knew it would matter. There is no copy to recover.” Selin chooses to share this herself. It tells Nermin nothing about Halil’s health.',
    choice: 'Write what help the agency can arrange. Let her choose what to discuss with her family next.',
    outcome:
      'Selin keeps the written answer. The agency has not confirmed a suitable service or arranged a job. She says she wants to ask Halil what kind of visit he would like. She has not called him yet. The message is still gone.',
    defer:
      'Selin ends the conversation. The agency has not arranged help. The deleted message remains private.',
  },
};
function eligible(s: CastState, id: CastKey): boolean {
  if (unavailable(s, id) || s.ended || s.scene || !s.people[id] || s.now < s.people[id]!.now) return false;
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
      const life = (s.castChapter as import('./cast-chapter.ts').AgencyChapter | undefined)?.facts[id];
      return {
        id,
        name: CAST[id].name,
        role: `${CAST[id].age} · ${CAST[id].role}`,
        text:
          stage?.text ??
          `${life?.line ?? ''} ${CAST[id].name} can choose whether to discuss something besides the current work.`,
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
