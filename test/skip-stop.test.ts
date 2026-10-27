import { expect, it } from 'vitest';
import * as sim from '../src/sim/index.ts';
import { canWait } from '../src/ui/render.ts';

// The Skip label names skipStop; a quiet skip must land exactly there, never past it.
it('Skip stops where its label says, including an applicant leaving and the 19:00 closing', () => {
  let s = sim.newGame(7);
  const seen = new Set<string>();
  for (let i = 0; i < 400 && !sim.view(s).ended; i++) {
    const v = sim.view(s);
    if (v.dayCard) s = sim.apply(s, { type: 'sleep' });
    else if (v.scene) {
      const c = v.scene.choices.find((x) => !x.disabled);
      s = v.scene.canLeave
        ? sim.apply(s, { type: 'close-scene', scene: v.scene.id })
        : c
          ? sim.apply(s, { type: 'choose', scene: v.scene.id, choice: c.id })
          : sim.advance(s, 1);
    } else if (v.phoneRinging) s = sim.apply(s, { type: 'answer-phone' });
    else if (!canWait(v)) s = sim.advance(s, 5);
    else {
      const stop = sim.skipStop(s);
      expect(stop).not.toBeNull();
      const logLength = v.log.length;
      s = sim.apply(s, { type: 'wait-for' });
      const after = sim.view(s);
      expect(after.now).toBeLessThanOrEqual(stop!.at);
      const interrupted = after.log.slice(logLength).some((l) => l.kind === 'arrival' || l.kind === 'phone');
      if (!interrupted && !after.scene) expect(after.now).toBe(stop!.at);
      if (after.now === stop!.at) seen.add(stop!.label.split(' ').slice(-3).join(' '));
    }
  }
  expect(seen).toContain('waited three hours');
  expect(seen).toContain('for the day');
});
