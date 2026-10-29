import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('accepts the phone stage, presence, negotiation, household calls, saves and desktop docking', async () => {
  const child = spawn(process.execPath, ['scripts/verify-stage.ts', String(48000 + (process.pid % 1000))], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    // Snapshot this child's descendants before termination; never target unrelated processes.
    const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number));
    const owned = new Set([child.pid!]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [pid, parent] of rows)
        if (pid && parent && owned.has(parent) && !owned.has(pid)) {
          owned.add(pid);
          changed = true;
        }
    }
    for (const pid of [...owned].reverse())
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* Already exited. */
      }
  }, 300000);
  const status = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  }).finally(() => clearTimeout(timer));
  if (timedOut || status !== 0) console.error('UI stage child failure:', { timedOut, status }, output);
  expect(timedOut, output).toBe(false);
  expect(status, output).toBe(0);
  expect(output).toContain('UI grammar verified');
}, 310000);
