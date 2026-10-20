/** Minimal terminal driver. Every command uses the same public API as the browser. */
import { createInterface } from 'node:readline';
import { advance, apply, type Input, newGame, view } from '../src/sim/index.ts';

let state = newGame(1);
function status() {
  const v = view(state);
  console.log(
    `\n${v.dateLabel}, ${v.timeLabel} · ${v.open ? 'Office open' : 'Office closed'}${v.slowed ? ' · Clock slowed' : ''}`,
  );
  console.log(`Cash: ₺${v.cash}. Rent: ₺${v.rent.amount}, due ${v.rent.label}.`);
  console.log(`Now: ${v.task.text}`);
  if (v.next) console.log(`Next: ${v.next.label} · ${v.next.dateLabel}. Use {"type":"wait-for"}.`);
  if (v.phoneRinging) console.log(`Telephone: ${v.phoneRinging.who} is waiting.`);
  if (v.scene) {
    console.log(`\n${v.scene.title} [${v.scene.id}]`);
    for (const line of v.scene.lines) console.log(`${line.speaker ? `${line.speaker}: ` : ''}${line.text}`);
    for (const choice of v.scene.choices)
      console.log(
        `  ${choice.id}: ${choice.label}${choice.hint ? ` — ${choice.hint}` : ''}${choice.disabled ? ` [Unavailable: ${choice.disabled}]` : ''}`,
      );
    if (v.scene.canLeave) console.log(`  Leave: {"type":"close-scene","scene":"${v.scene.id}"}`);
  }
  console.log('\nBench and books:');
  for (const c of [...v.bench, ...v.books]) {
    console.log(
      `${c.id} · ${c.name} · ${c.status}${c.posture ? `, ${c.posture}` : ''}${c.busy ? `, ${c.busy}` : ''}${c.wage !== null ? ` · asks ₺${c.wage}` : ''}`,
    );
    console.log(`  ${c.look} Roles: ${c.roles.join(', ')}.${c.wants ? ` Wants: ${c.wants}` : ''}`);
    for (const n of c.notes)
      console.log(
        `  ${n.crossedOut ? 'Crossed out: ' : ''}${n.quality}: ${n.phrase} [${n.source}: ${n.from}]${n.claim ? ` · ${n.claim}` : ''}`,
      );
    for (const r of c.referees)
      console.log(
        `  ${r.id}: ${r.name}${r.called ? ' (called)' : r.reachable ? ' (reachable)' : ` (${r.why})`}`,
      );
  }
  console.log('\nRequests:');
  for (const r of v.requests)
    console.log(
      `${r.id} · ${r.family} · ${r.role} · ${r.status} · ₺${r.wage} · by ${r.byLabel}\n  “${r.wants}”`,
    );
  console.log('\nPlacements:');
  for (const p of v.placements)
    console.log(
      `${p.id}: ${p.candidate} at ${p.family} · ${p.status}${p.lastWord ? ` · “${p.lastWord}”` : ''}${p.arrangement ? ` · ${p.arrangement}` : ''}${p.pending ? ` · ${p.pending.text} (${p.pending.dateLabel})` : ''}`,
    );
  if (v.dayCard)
    console.log(`\n${v.dayCard.lines.join('\n')}\n${v.dayCard.tomorrow}\nUse {"type":"sleep"} to sleep.`);
  if (v.review) {
    console.log('\nThe month ended. Notes beside the truth:');
    for (const p of v.review.people)
      console.log(
        `${p.name}: ${Object.entries(p.truth)
          .map(([q, read]) => `${q}: ${read}`)
          .join('; ')}`,
      );
    for (const p of v.review.placements) console.log(p.story.join('\n'));
    console.log(v.review.question);
  }
  console.log('\nLatest words:');
  for (const l of v.log.slice(-4)) console.log(`  ${l.text}`);
}
console.log('Commands: new [seed], status, city, do <Input JSON>, next, wait [minutes], quit');
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
    else if (command === 'city') {
      const v = view(state);
      for (const f of v.city.figures)
        console.log(`${f.name}: ${f.place ?? 'in the city'}${f.mood ? `, ${f.mood}` : ''}`);
      for (const t of v.city.threads.slice(-10))
        console.log(`${t.from} → ${t.to}, ${t.place}${t.consequence ? `: ${t.consequence}` : ''}`);
    } else if (command === 'next') state = apply(state, { type: 'wait-for' });
    else if (/^wait(?:\s|$)/.test(command)) {
      const minutes = Number(command.slice(4).trim() || 30);
      if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Wait must be finite and nonnegative.');
      state = advance(state, minutes);
    } else if (command !== 'status')
      throw new Error('Use new [seed], status, do <Input JSON>, next, wait [minutes], or quit.');
    status();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
});
