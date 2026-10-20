/** Minimal terminal driver. Every command uses the same public API as the browser. */
import { createInterface } from 'node:readline';
import { advance, apply, fingerprint, type Input, newGame, view } from '../src/sim/index.ts';

let state = newGame(1);
function status() {
  const v = view(state);
  console.log(JSON.stringify({ ...v, fingerprint: fingerprint(state) }));
}
console.log('Commands: new [seed], status, do <Input JSON>, wait [minutes], quit');
const lines = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});
lines.on('line', (line) => {
  try {
    const command = line.trim();
    if (command === 'quit' || command === 'exit') {
      lines.close();
      return;
    }
    if (/^new(?:\s|$)/.test(command)) {
      const seed = Number(command.slice(3).trim() || 1);
      if (!Number.isFinite(seed)) throw new Error('Seed must be finite.');
      state = newGame(seed);
    } else if (command.startsWith('do ')) state = apply(state, JSON.parse(command.slice(3)) as Input);
    else if (/^wait(?:\s|$)/.test(command)) {
      const minutes = Number(command.slice(4).trim() || 30);
      if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Wait must be finite and nonnegative.');
      state = advance(state, minutes);
    } else if (command !== 'status')
      throw new Error('Use new [seed], status, do <Input JSON>, wait [minutes], or quit.');
    status();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
});
