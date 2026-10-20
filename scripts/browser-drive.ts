/**
 * Real-clock, player-facing phone browser. Node >=24; no simulation or save access.
 * Start (keeps running): node scripts/browser-drive.ts start 4310
 * Vite serves 4310; driver listens on 4311. Separate instances use separate port pairs.
 * Commands: node scripts/browser-drive.ts 4310 text
 *   ... 4310 shot opening | tap 'New month' | speed Gallop | wait 5 | export scratch/run.json | quit
 * Omit the port for commands to use 4310. Screenshots: scratch/shots-p1/<port>/<name>.png.
 */
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { createServer as createViteServer } from 'vite';

const argv = process.argv.slice(2);
const starting = argv[0] === 'start';
const explicitPort = /^\d+$/.test(argv[0] ?? '');
const port = Number(starting ? (argv[1] ?? 4310) : explicitPort ? argv.shift() : 4310);
if (!Number.isInteger(port) || port < 1024 || port > 65534) throw new Error('Use a port from 1024 to 65534.');

if (starting) {
  const vite = await createViteServer({ server: { host: '127.0.0.1', port, strictPort: true } });
  await vite.listen();
  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const page = await browser.newPage({
    viewport: { width: 360, height: 690 },
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  let queue = Promise.resolve();
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await browser.close();
    await vite.close();
    server.close();
  };
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.headers.origin) {
      response.writeHead(403).end('Local command client only.');
      return;
    }
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16384) request.destroy();
    });
    request.on('end', () => {
      queue = queue.then(async () => {
        try {
          const { command, args = [] } = JSON.parse(body) as { command: string; args: string[] };
          if (command === 'quit') {
            await close();
            response.end('Closed browser and Vite.');
            return;
          }
          response.end(await run(page, port, command, args));
        } catch (error) {
          response.writeHead(400).end(String(error));
        }
      });
    });
  });
  await new Promise<void>((ready, reject) => {
    server.once('error', reject);
    server.listen(port + 1, '127.0.0.1', ready);
  });
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
  console.log(
    `Game http://127.0.0.1:${port}/; driver ${port + 1}; PID ${process.pid}. The real clock keeps moving.`,
  );
} else {
  const [command = 'text', ...args] = argv;
  const response = await fetch(`http://127.0.0.1:${port + 1}/`, {
    method: 'POST',
    body: JSON.stringify({ command, args }),
  });
  console.log(await response.text());
  if (!response.ok) process.exitCode = 1;
}

async function run(page: Page, port: number, command: string, args: string[]): Promise<string> {
  if (command === 'text') return page.locator('body').innerText();
  if (command === 'shot') {
    const name = args.join(' ') || 'screen';
    if (!/^[\w-]+$/.test(name))
      throw new Error('Screenshot name may contain letters, numbers, underscores and hyphens.');
    const path = resolve(`scratch/shots-p1/${port}/${name}.png`);
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path });
    return path;
  }
  if (command === 'tap') {
    const label = args.join(' ');
    if (!label) throw new Error('Supply a visible button label.');
    const button = page.getByRole('button', { name: label, exact: true });
    const link = page.getByRole('link', { name: label, exact: true });
    const target = (await button.count()) ? button : link;
    if ((await target.count()) !== 1) throw new Error(`Expected one visible action named "${label}".`);
    await target.click({ timeout: 3000 });
    return page.locator('body').innerText();
  }
  if (command === 'speed') {
    const name = args.join(' ');
    if (!['Slow', 'Walk', 'Trot', 'Gallop'].includes(name))
      throw new Error('Speed must be Slow, Walk, Trot or Gallop.');
    await page.getByRole('combobox', { name: 'Clock speed', exact: true }).selectOption({ label: name });
    return page.locator('body').innerText();
  }
  if (command === 'wait') {
    const seconds = Number(args[0]);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600)
      throw new Error('Wait must be 0–600 real seconds.');
    await new Promise((done) => setTimeout(done, seconds * 1000));
    return page.locator('body').innerText();
  }
  if (command === 'export') {
    const path = resolve(args.join(' ') || 'scratch/run.json');
    mkdirSync(dirname(path), { recursive: true });
    const downloadButton = page.getByRole('button', { name: 'Download this run', exact: true });
    if (!(await downloadButton.isVisible()))
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    await download.saveAs(path);
    const close = page
      .getByRole('dialog', { name: 'Game menu', exact: true })
      .getByRole('button', { name: 'Back', exact: true });
    if (await close.isVisible()) await close.click();
    return `Saved ${path}`;
  }
  throw new Error(`Unknown command ${command}. Use text, shot, tap, speed, wait, export, quit.`);
}
