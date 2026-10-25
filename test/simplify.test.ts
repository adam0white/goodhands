import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { workerNeed } from '../src/sim/dialogue.ts';
import { CANDIDATES } from '../src/sim/world.ts';
import { plainText } from '../src/ui/plain-english.ts';

it('keeps frozen-edition dialogue readable', () => {
  expect(plainText('₺18000 a month.')).toBe('I need ₺18000 a month.');
  expect(plainText('Nanny applicant 01: “₺8000 a month.”')).toBe(
    'Nanny applicant 01: “I need ₺8000 a month.”',
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
