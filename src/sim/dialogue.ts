/** Current edition work episodes. Canonical private discoveries live in cast-scenes. */
import type { Quality, Role } from './types.ts';
import { CANDIDATES } from './world.ts';

const QUESTIONS = [
  { id: 'wage', label: 'What wage do you need?' },
  { id: 'last-family', label: 'What work did you do for this former employer?' },
  { id: 'hours', label: 'What hours can you work?' },
  { id: 'home', label: 'Where will you travel from?' },
  { id: 'why-left', label: 'Has that job ended?' },
  { id: 'need', label: 'What must the next household agree to?' },
];
export function personalQuestions(id: string): { id: string; label: string }[] {
  return CANDIDATES.some((c) => c.id === id) ? QUESTIONS.map((q) => ({ ...q })) : [];
}
export function workerNeed(id: string): { words: string; finishBy: number; reason: string } {
  if (id === 'hulya')
    return {
      words: 'I only offer baking and meal preparation. I need the paid hours in writing.',
      finishBy: 17 * 60,
      reason: 'written baking duties and a five o’clock finish',
    };
  if (id === 'aylin')
    return {
      words: 'I finish preparing meals at five. I keep my evenings free.',
      finishBy: 17 * 60,
      reason: 'a five o’clock finish with no extra evening work',
    };
  if (id === 'hatice')
    return {
      words:
        'I need a trial with clear cooking or housekeeping duties. Someone is covering my garden work for this month only.',
      finishBy: 17 * 60,
      reason: 'a defined trial and a five o’clock finish',
    };
  const c = CANDIDATES.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown work episode ${id}`);
  return {
    words: 'I need agreed duties, wages on the written date, and a six o’clock finish.',
    finishBy: 18 * 60,
    reason: 'the written duties, pay date and finish time',
  };
}
export function personalAnswer(id: string, question: string): string {
  const c = CANDIDATES.find((c) => c.id === id);
  if (!c) return '';
  switch (question) {
    case 'wage':
      return `I need ₺${c.wage} a month.`;
    case 'last-family':
      return c.skills.join(' ');
    case 'hours':
      return `I can work during the day and finish by ${Math.floor(workerNeed(id).finishBy / 60)}:00. I will not return for evening work unless we agree to it.`;
    case 'home':
      return `I live in ${c.home}. The journey from the office takes about ${c.commute} minutes.`;
    case 'why-left':
      return 'That job has ended. I am applying for a new job with its own written agreement.';
    case 'need':
      return workerNeed(id).words;
    default:
      return '';
  }
}
export function workerDisagreement(id: string, household: string, told = false): string {
  return `${household} asked for more than the agreement. ${told ? 'As I explained, I' : 'I'} need ${workerNeed(id).reason}.`;
}
export function authoredTraitAnswer(
  _id: string,
  _q: Quality,
  _grade: 'good' | 'uncertain' | 'poor',
): string | undefined {
  return undefined;
}
export function contextualConcern(id: string, role: Role): { concern: string; promise: string } {
  const hour = Math.floor(workerNeed(id).finishBy / 60);
  return {
    concern: `Can the agreed ${role} duties finish by ${hour}:00?`,
    promise: `Tell the household you can finish the agreed duties by ${hour}:00.`,
  };
}
