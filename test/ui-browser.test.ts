import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('accepts the phone stage, presence, negotiation, household calls, saves and desktop docking', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/verify-stage.ts', String(48000 + (process.pid % 1000))],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      timeout: 300000,
    },
  );
  expect(output).toContain('Phone stage acceptance passed');
}, 305000);
