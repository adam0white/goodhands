import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('accepts speed labels, City phone, interview endings, full questions and placement on the built phone screen', () => {
  const output = execFileSync(
    process.execPath,
    ['scripts/verify-browser.ts', String(48000 + (process.pid % 1000))],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      timeout: 300000,
    },
  );
  expect(output).toContain('Phone acceptance passed');
}, 305000);
