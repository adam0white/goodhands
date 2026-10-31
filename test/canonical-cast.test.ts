import { exportRun as frameworkArchive } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { runFor } from '../src/sim/hf4.ts';

describe('canonical cast identity', () => {
  it('does not exchange Hatice’s profile with a donor across new months', () => {
    const opening = newGame(1);
    const a = opening.people.hatice!;
    const b = newGame(71).people.hatice!;
    expect(b.traits).toEqual(a.traits);
    expect(b.values).toEqual(a.values);
    expect(
      frameworkArchive(runFor(opening)).initial.people.find((person) => person.id === 'hatice')!.state.traits
        .honesty,
    ).toBe(0.85);
    expect(a.traits.honesty).toBeCloseTo(0.85, 12);
  });
  it('uses the exact baseline for unspecified guest traits and values', () => {
    const opening = newGame(1);
    const p = opening.people['zeynep-pass']!;
    const authored = frameworkArchive(runFor(opening)).initial.people.find(
      (person) => person.id === 'zeynep-pass',
    )!;
    expect(authored.state.traits.emotionality).toBe(0.5);
    expect(Object.values(authored.state.values).every((value) => value === 0.5)).toBe(true);
    expect(p.traits.emotionality).toBeCloseTo(0.5, 12);
    for (const value of Object.values(p.values)) expect(value).toBeCloseTo(0.5, 12);
  });
});

import { advance, apply, fingerprint, newGame, replay, view } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';

it('requires an actual encounter before a private conversation and replays the choice', () => {
  const s = newGame(1);
  const before = fingerprint(s);
  apply(s, { type: 'cast-talk', person: 'hulya', choice: 'invite' });
  expect(fingerprint(s)).toBe(before);
  expect(JSON.stringify(view(s))).not.toContain('unpaid nights');
  apply(s, { type: 'cast-talk', person: 'nermin', choice: 'respect' });
  expect(fingerprint(s)).toBe(before);
  apply(s, { type: 'cast-talk', person: 'nermin', choice: 'invite' });
  expect(view(s).castContacts?.find((c) => c.id === 'nermin')?.text).toContain('unpaid nights');
  apply(s, { type: 'cast-talk', person: 'nermin', choice: 'respect' });
  expect(view(s).log.at(-1)?.text).toContain(
    'She keeps the draft. This game has no step that sends the letter or makes a payment, so nothing has been sent or paid.',
  );
  for (const run of [exportRun(s, s.inputs), compactRun(exportRun(s, s.inputs))]) {
    const loaded = verifyImport(JSON.stringify(run));
    expect(fingerprint(loaded.state)).toBe(fingerprint(s));
  }
  expect(fingerprint(replay(s.seed, s.inputs, s.now))).toBe(fingerprint(s));
  const run = compactRun(exportRun(s, s.inputs));
  const original = { ...run, simulation: 5 };
  const bytes = JSON.stringify(original);
  expect(() => verifyImport(bytes)).toThrow('Keep the original saved game or file and start a new game.');
  expect(JSON.stringify(original)).toBe(bytes);
  expect(fingerprint(s)).toBe(run.fingerprint);
});

it('keeps the former fixed roster unnamed and gives new cooks only their actual role', () => {
  const s = newGame(3);
  expect(s.people.hulya?.name).toBe('Hülya');
  expect(s.people.aylin?.name).toBe('Aylin');
  expect(s.people.derya?.name).toBe('Derya');
  expect(s.people.fatma).toBeUndefined();
  expect(s.people['tass-2']).toBeUndefined();
  expect(s.people['inces-0']?.name).not.toBe('Derya');
  expect(s.people['kayas-0']?.name).not.toBe('Aylin');
  expect(s.people.hulya?.skills.childcare).toBeUndefined();
});

it('lets Hülya disclose the seed envelopes after an interview without granting a harvest', () => {
  const s = newGame(1);
  while (s.now < 1980) advance(s, Math.min(60, 1980 - s.now));
  apply(s, { type: 'interview', candidate: 'hulya' });
  const scene = view(s).scene;
  expect(scene).toBeTruthy();
  if (scene) apply(s, { type: 'close-scene', scene: scene.id });
  expect(JSON.stringify(view(s))).not.toContain('I can take my garden with me');
  apply(s, { type: 'cast-talk', person: 'hulya', choice: 'invite' });
  expect(view(s).castContacts?.find((c) => c.id === 'hulya')?.text).toContain('I can take my garden with me');
  apply(s, { type: 'cast-talk', person: 'hulya', choice: 'defer' });
  expect(view(s).log.at(-1)?.text).toContain('keeps the seeds');
  expect(fingerprint(replay(s.seed, s.inputs, s.now))).toBe(fingerprint(s));
}, 420_000);
