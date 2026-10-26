import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { runPolicy } from '../scripts/policy.ts';
import { workerNeed } from '../src/sim/dialogue.ts';
import { advance, apply, fingerprint, newGame, view } from '../src/sim/index.ts';
import type { LogEntry } from '../src/sim/types.ts';
import { CANDIDATES } from '../src/sim/world.ts';
import { familySpeech, plainText } from '../src/ui/plain-english.ts';

it('keeps frozen-edition dialogue readable', () => {
  expect(plainText('₺18000 a month.')).toBe('I need ₺18,000 a month.');
  expect(plainText('Nanny applicant 01: “₺8000 a month.”')).toBe(
    'Nanny applicant 01: “I need ₺8,000 a month.”',
  );
  expect(plainText('Still unsure: straight about money')).toBe(
    'Nermin is still unsure whether this person is honest about money.',
  );
  expect(plainText('Doubt: comes when promised')).toBe(
    'Nermin doubts that this person arrives when promised.',
  );
  expect(plainText('Buca. About 45 minutes from the office.')).toBe(
    'I live in Buca. The journey from the office takes about 45 minutes.',
  );
  expect(CANDIDATES[0]?.look).toBe('This applicant is waiting with an application form.');
  expect(plainText('Meal preparation ends at five; evenings are my own.')).toBe(
    'Meal preparation ends at five; evenings are my own.',
  );
  expect(plainText('Eight until six. I need the 18:10 bus because my mother is alone at home.')).toBe(
    'I can work from eight until six. I need the 18:10 bus because my mother is alone at home.',
  );
});
it('gates lab tools with the exact URL flag and keeps the actual footer node', () => {
  const app = readFileSync(new URL('../src/ui/app.ts', import.meta.url), 'utf8');
  expect(app).toContain("new URLSearchParams(location.search).get('lab') === '1'");
  expect(app).toContain('noticeFooter.append(recordingNotice)');
  expect(app).not.toContain('recordingNoticeDone');
  expect(app).not.toContain("openSheet('Send word'");
});

it('projects the same hours and experience when quoted in day notes', () => {
  expect(plainText('Gül: “Eight until six. I need the 18:10 bus.”')).toBe(
    'Gül: “I can work from eight until six. I need the 18:10 bus.”',
  );
  expect(
    plainText('Nanny applicant 01: “Daytime work, finishing by 18:00. No unagreed evening return.”'),
  ).toBe(
    'Nanny applicant 01: “I can work during the day and finish by 18:00. I will not return for evening work unless we agree to it.”',
  );
  expect(
    plainText('Nanny applicant 01: “Reports experience in nanny work; check the reference and trial.”'),
  ).toBe(
    'Nanny applicant 01: “This applicant reports experience as a nanny. Check the reference and trial.”',
  );
});
it('keeps the garden-cover arrangement and the patience clue, and expands uncertain fragments', () => {
  expect(workerNeed('hatice').words).toBe(
    'I need a trial with clear cooking or housekeeping duties. Someone is covering my garden work for this month only.',
  );
  expect(plainText('Someone steady. There will be two children asking at once.')).toBe(
    'We need someone patient. There will be two children asking at once.',
  );
  expect(plainText('I keep my voice down. Mostly.')).toBe('I usually keep my voice down.');
  expect(
    plainText(
      'One evening Gül stood by my coat rack and asked me to count the wages. After everything we had done.',
    ),
  ).toBe(
    'One evening Gül stood by my coat rack and asked me to count the wages. I resented that after everything we had done.',
  );
});

it('translates generated addresses without changing people or places', () => {
  expect(plainText('Nermin abla, Aylin Hanım and Halil Bey are in Alsancak.')).toBe(
    'Ms Nermin, Ms Aylin and Mr Halil are in Alsancak.',
  );
  expect(plainText('Abla, I live in Karşıyaka near Kültürpark.')).toBe(
    'My friend, I live in Karşıyaka near Kültürpark.',
  );
  expect(plainText('Nermin abla is here.')).toBe('Ms Nermin is here.');
  expect(plainText('Rıza Efendi asked Selin Hanım.')).toBe('Mr Rıza asked Ms Selin.');
});

it('projects family accounts as speech while preserving agreed placement terms', () => {
  expect(
    familySpeech(
      'Nurgül let the household member finish explaining. The household could follow the agreed routine.',
    ),
  ).toBe('Nurgül let us finish explaining. We could follow the agreed routine.');
  expect(plainText('We need a carer for the agreed hours. We can pay ₺10000.')).toBe(
    'We need a carer for the hours we discuss. We can pay ₺10,000.',
  );
  expect(plainText('Please keep the agreed hours clear.')).toBe('Please keep the agreed hours clear.');
  expect(plainText('At the office: Hatice says: “Please keep my phone number.”')).toBe(
    'Hatice says: “Please keep my phone number.”',
  );
  expect(plainText('Selin: Selin phones after office work.')).toBe('Selin phones after office work.');
});

it('names the quiet-office caller without rewriting replay state', () => {
  const state = newGame(1);
  for (const candidate of [...view(state).bench])
    apply(state, { type: 'take-number', candidate: candidate.id });
  while (state.now < 570) advance(state, 1);
  const before = fingerprint(state);
  const account = view(state).log.find((line) => line.kind === 'city');
  expect(account?.text).toMatch(/^Mr Hüsnü says: “/);
  expect((state.log as LogEntry[]).find((line) => line.kind === 'city')?.text).toMatch(/^At the office: /);
  expect(fingerprint(state)).toBe(before);
});

it('preserves punctuation after grouped and ungrouped money', () => {
  expect(plainText('The deposit, ₺2250, is in the cash box.')).toBe(
    'The deposit, ₺2,250, is in the cash box.',
  );
  expect(plainText('The deposit, ₺2,250, is in the cash box.')).toBe(
    'The deposit, ₺2,250, is in the cash box.',
  );
  expect(plainText('Pay ₺0, ₺9, ₺10000 and ₺10,000.')).toBe('Pay ₺0, ₺9, ₺10,000 and ₺10,000.');
});

it('keeps an actual visit observation in report voice and known family speech in first person', () => {
  const state = runPolicy(1, 'careful', 2600, 6 as 4);
  expect(view(state).scene?.title).toBe('Visit: Şebnem Eren at the Kaya family');
  const observation = view(state).placements[0]!.lastWord!;
  expect(observation).toBe(
    'Şebnem Eren let the household member finish explaining. The household could follow the agreed routine.',
  );
  const before = fingerprint(state);
  expect(plainText(observation)).toBe(observation);
  expect(familySpeech(observation)).toBe(
    'Şebnem Eren let us finish explaining. We could follow the agreed routine.',
  );
  expect(fingerprint(state)).toBe(before);
});
