/** Read-only use of the sibling HF playtester; output is verbatim JSON, optionally gzipped. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { make } from './adapter.ts';

const hfPath =
  process.env.HF_PLAYTESTER ??
  new URL('../../../human-framework/packages/playtester/src/index.ts', import.meta.url).pathname;
const { PERSONAS, playSession, readSession, runCohort } = await import(pathToFileURL(hfPath).href);
const [command = 'run', ...args] = process.argv.slice(2);
const arg = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1) ?? fallback;
const ids = arg('personas', 'completionist,mischief,rulesLawyer').split(',');
const personas = ids.map((id) => {
  if (!PERSONAS[id]) throw new Error(`No persona ${id}`);
  return PERSONAS[id];
});
const seeds = Array.from({ length: Number(arg('seeds', '3')) }, (_, i) => i + 1);
const minutes = Number(arg('minutes', '60'));
const games: ReturnType<typeof make>[] = [];
const trackedMake = (seed: number) => {
  const game = make(seed);
  games.push(game);
  return game;
};
let result: Record<string, unknown>;
if (command === 'session') {
  const seed = Number(arg('seed', '1'));
  const trace = playSession(trackedMake(seed), personas[0], seed, { maxMinutes: minutes });
  result = { report: readSession(trace), trace };
} else if (command === 'run') {
  result = runCohort({
    game: 'goodhands-0.1.0',
    build: arg('build', 'local'),
    make: trackedMake,
    personas,
    seeds,
    maxMinutes: minutes,
  });
} else throw new Error('Use run or session');
const output = { ...result, finalGames: games.map((game) => game.result()) };
const json = `${JSON.stringify(output, null, 2)}\n`;
const out = arg('out', '');
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, out.endsWith('.gz') ? gzipSync(json) : json);
  console.log(
    JSON.stringify(
      {
        out,
        sessions: games.length,
        finalGames: output.finalGames.map(({ minute, ended, fingerprint, visible }) => ({
          minute,
          ended,
          fingerprint,
          cash: visible.cash,
          placements: visible.placements.length,
        })),
        ...('summary' in result ? { summary: result.summary } : { report: result.report }),
      },
      null,
      2,
    ),
  );
} else console.log(json);
