import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('accepts CLI placement and vouch toggles, transcript, relationship, city and clock behavior on the built phone screen', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/verify-browser.ts', String(48000 + (process.pid % 1000))],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      timeout: 120000,
    },
  );
  expect(output).toContain('Phone acceptance passed');
}, 125000);
