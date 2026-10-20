/** Built-preview phone acceptance. Run: node scripts/verify-browser.ts [port=4410]. Real clock only. */
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { chromium, type Locator } from 'playwright-core';
import { preview } from 'vite';
import {
  advance,
  apply,
  fingerprint,
  type Input,
  type LoggedInput,
  newGame,
  type State,
  view,
} from '../src/sim/index.ts';
import { compactRun, exportRun, type RunExport, verifyImport } from '../src/ui/export.ts';
import { startCommandServer } from './browser-drive.ts';

function required<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, 'Required fixture value exists');
  return value;
}

const started = performance.now();
const port = Number(process.argv[2] ?? 4410);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' });
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
const shots = 'scratch/shots-p3';
let driver: Awaited<ReturnType<typeof startCommandServer>> | undefined;
const cliCommands: string[][] = [];
mkdirSync(`${shots}/${port}`, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 360, height: 690 },
    isMobile: true,
    hasTouch: true,
  });
  driver = await startCommandServer(page, port, async () => {});
  const cli = async (command: string, ...args: string[]) => {
    cliCommands.push([command, ...args]);
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['scripts/browser-drive.ts', String(port), command, ...args],
      { timeout: 10000 },
    );
    return stdout;
  };
  const tap = async (target: string | Locator) => {
    const label =
      typeof target === 'string' ? target : (await target.innerText()).replace(/\s+/g, ' ').trim();
    return cli('tap', label);
  };
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        if (document.querySelectorAll('dialog.sheet').length > 1)
          throw new Error('More than one dialog sheet opened');
      }).observe(document.body, { childList: true, subtree: true });
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(`Browser error: ${error.message}`);
  });
  const bounds: Record<string, unknown> = {};
  const fits = async (label: string, locator: Locator, touch = false) => {
    assert.ok(await locator.count(), `${label} exists`);
    const boxes = await locator.evaluateAll((elements) =>
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return {
          text: element.textContent,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      }),
    );
    assert.ok(
      boxes.every((b) => b.x >= 0 && b.y >= 0 && b.right <= 360 && b.bottom <= 690),
      `${label}: ${JSON.stringify(boxes)}`,
    );
    if (touch)
      assert.ok(
        boxes.every((b) => b.width >= 44 && b.height >= 44),
        `${label} has 44px targets: ${JSON.stringify(boxes)}`,
      );
    bounds[label] = boxes;
  };
  const choicesFit = async (label: string) => {
    await fits(`${label} box`, page.locator('.scene-choices'));
    const choices = page.getByTestId('scene-choice');
    for (let index = 0; index < (await choices.count()); index++) {
      const choice = choices.nth(index);
      await choice.scrollIntoViewIfNeeded();
      await fits(`${label} ${index}`, choice, true);
      const unclipped = await choice.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const box = element.closest('.scene-choices, .interview-finish')?.getBoundingClientRect();
        return {
          element: r.toJSON(),
          parent: box?.toJSON(),
          fits:
            !!box && r.top >= box.top && r.bottom <= box.bottom && r.left >= box.left && r.right <= box.right,
        };
      });
      assert.ok(
        unclipped.fits,
        `${label} ${index} is fully inside its response box: ${JSON.stringify(unclipped)}`,
      );
    }
    await page.locator('.scene-choices').evaluate((element) => {
      element.scrollTop = 0;
    });
  };
  const newestSpeechFitsTranscript = async (label: string) => {
    const geometry = await page
      .locator('.exchange p.speech')
      .last()
      .evaluate((element) => {
        const speech = element.getBoundingClientRect();
        const transcript = element.closest('.exchange')?.getBoundingClientRect();
        return {
          top: speech.top,
          bottom: speech.bottom,
          parentTop: transcript?.top,
          parentBottom: transcript?.bottom,
        };
      });
    assert.ok(
      geometry.parentTop !== undefined &&
        geometry.parentBottom !== undefined &&
        geometry.top >= geometry.parentTop &&
        geometry.bottom <= geometry.parentBottom,
      `${label} newest speech is fully visible inside transcript: ${JSON.stringify(geometry)}`,
    );
  };
  const open = async () => {
    await page.goto(`http://127.0.0.1:${port}/`);
    await tap('New month');
    await tap('Open the office');
    await page.getByTestId('office').waitFor();
    await Promise.race([
      page.evaluate(() => document.fonts.ready.then(() => undefined)),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
  };
  // Later-screen fixtures are real input histories, replay-checked and imported through the UI.
  // The live opening above and clock checks below never use browser clock mocking.
  const importState = async (state: State, inputs: LoggedInput[]) => {
    const run = exportRun(state, inputs);
    verifyImport(JSON.stringify(compactRun(run)));
    await page.getByRole('button', { name: 'Game menu', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a run', exact: true }).click();
    await (await chooser).setFiles({
      name: 'acceptance-run.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(compactRun(run))),
    });
    await page.getByTestId('office').waitFor();
    await page.waitForFunction(
      () => !document.querySelector('dialog.sheet') || !!document.querySelector('.sheet-status')?.textContent,
    );
    const importError = await page
      .locator('.sheet-status')
      .evaluateAll((elements) => elements[0]?.textContent ?? null);
    assert.ok(!importError, importError ?? 'Import succeeded');
    assert.equal(await page.locator('dialog.sheet').count(), 0, 'Import closes its menu sheet');
  };
  const scenario = () => {
    let state = newGame(1);
    const inputs: LoggedInput[] = [];
    return {
      get state() {
        return state;
      },
      inputs,
      send(input: Input) {
        inputs.push({ at: view(state).now, input });
        state = apply(state, input);
      },
      until(at: number, preserveTwoSides = false) {
        while (view(state).now < at) {
          const current = view(state);
          assert.ok(!current.ended, 'Fixture month remains open');
          if (current.dayCard && Math.floor(at / 1440) > Math.floor(current.now / 1440)) {
            this.send({ type: 'sleep' });
            continue;
          }
          if (current.scene && !(preserveTwoSides && current.scene.kind === 'two-sides')) {
            if (current.scene.canLeave) this.close();
            else {
              const choice = current.scene.choices.find((choice) => !choice.disabled);
              assert.ok(choice, 'Interrupted scene offers a response');
              this.send({ type: 'choose', scene: current.scene.id, choice: choice.id });
            }
            continue;
          }
          if (current.phoneRinging && !current.scene) {
            this.send({ type: 'answer-phone' });
            continue;
          }
          state = advance(state, Math.max(0, at - current.now));
          assert.ok(view(state).now > current.now, 'Fixture clock advances');
        }
        assert.equal(view(state).now, at, 'Fixture reaches its named screenshot time');
      },
      close() {
        const scene = view(state).scene;
        if (scene) this.send({ type: 'close-scene', scene: scene.id });
      },
    };
  };
  await open();
  assert.equal(await page.getByRole('combobox', { name: 'Clock speed' }).count(), 0, 'Clock has no select');
  for (const name of ['Gallop', 'Trot', 'Walk', 'Slow']) {
    await tap(name);
    const speed = page.getByRole('button', { name, exact: true });
    assert.equal(await speed.getAttribute('aria-pressed'), 'true', `${name} selects by visible label`);
    await fits(`speed ${name}`, speed, true);
    const colors = await speed.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.color, style.borderColor, style.outlineColor];
    });
    assert.ok(
      colors.every((color) => !['rgb(194, 65, 45)', 'rgb(226, 97, 74)'].includes(color)),
      'Speed never carries the accent',
    );
  }
  await page.keyboard.press('Tab');
  const unselectedSpeed = page.getByRole('button', { name: 'Trot', exact: true });
  await unselectedSpeed.focus();
  assert.equal(
    await unselectedSpeed.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(35, 32, 27)',
    'Keyboard focus on an unselected speed stays ink',
  );
  await fits('Task', page.getByTestId('task'));
  await fits('bench', page.getByTestId('bench'));
  await page.getByRole('button', { name: 'Task', exact: true }).click({ trial: true });
  for (const name of ['Gül', 'Sevda', 'Pınar']) {
    const candidate = page.getByRole('button', { name, exact: true });
    await fits(name, candidate, true);
    await candidate.click({ trial: true });
  }
  await page.screenshot({ path: `${shots}/01-office.png` });
  await tap('Sevda');
  await tap(page.getByRole('button', { name: /^Interview/ }));
  await page.getByTestId('scene').waitFor();
  await fits('scene', page.getByTestId('scene'));
  await choicesFit('scene choices');
  await fits('scene Task', page.getByTestId('task'));
  await fits('scene bench', page.getByTestId('bench'));
  await page.screenshot({ path: `${shots}/02-interview.png` });
  for (let answer = 0; answer < 3; answer++) {
    await tap(page.getByTestId('scene-choice').filter({ hasNotText: 'Coach her' }).first());
  }
  assert.equal(await page.getByText('Earlier words', { exact: true }).count(), 0);
  const transcript = page.locator('.exchange');
  assert.ok((await transcript.locator('p').count()) >= 4, 'Three answers keep the full transcript');
  await fits('newest interview line', transcript.locator('p').last());
  await fits('newest interview speech', transcript.locator('p.speech').last());
  await newestSpeechFitsTranscript('Interview');
  await page.getByRole('button', { name: 'Task', exact: true }).click({ trial: true });
  await fits('answer scene', page.getByTestId('scene'));
  await fits('finish interview choices', page.locator('.interview-finish button'), true);
  await choicesFit('answer choices');
  await fits('answer Task', page.getByTestId('task'));
  await fits('answer bench', page.getByTestId('bench'));
  await page.screenshot({ path: `${shots}/03-three-answers.png` });
  assert.equal(await page.evaluate(() => scrollY), 0, 'Interview needs no page scroll');
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal overflow',
  );
  assert.equal(await page.getByRole('button', { name: 'Other questions', exact: true }).count(), 0);
  const questionsBeforeInterrupt = await page.getByTestId('scene-choice').allTextContents();
  const beforeInterrupt = await transcript.innerText();
  const phone = page.getByRole('button', { name: /^Answer phone/ });
  await phone.waitFor({ timeout: 15000 });
  await tap(phone);
  assert.match(await page.locator('.held-scene').innerText(), /Interview with Sevda is waiting/);
  await fits('held conversation status', page.locator('.held-scene'));
  await choicesFit('interrupted phone choices');
  await cli('shot', 'phone-interrupt');
  await tap(page.getByTestId('scene-choice').first());
  const endCall = page.getByRole('button', { name: 'End the conversation', exact: true });
  if (await endCall.count()) await tap(endCall);
  assert.match(await page.getByTestId('scene').innerText(), /Interview: Sevda/);
  assert.ok(
    (await transcript.innerText()).includes(beforeInterrupt),
    'Phone returns to the same interview words',
  );
  assert.deepEqual(
    await page.getByTestId('scene-choice').allTextContents(),
    questionsBeforeInterrupt,
    'Resume preserves every remaining question',
  );
  assert.equal(await page.locator('.held-scene').count(), 0, 'Waiting notice clears on resume');
  await cli('shot', 'phone-resumed');
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this run', exact: true }).click();
  await (await downloadEvent).saveAs(`${shots}/${port}/downloaded-run.json`);
  const run = JSON.parse(readFileSync(`${shots}/${port}/downloaded-run.json`, 'utf8')) as RunExport;
  const interviewScene = required(view(verifyImport(JSON.stringify(run)).state).scene);
  const interviewWords = await transcript.textContent();
  assert.equal(interviewScene.kind, 'interview');
  for (const line of interviewScene.lines)
    assert.ok(interviewWords?.includes(line.text), `Interview preserves: ${line.text}`);
  for (const exported of [run, compactRun(run)]) {
    const imported = verifyImport(JSON.stringify(exported));
    assert.equal(fingerprint(imported.state), run.fingerprint, 'Downloaded and compact runs replay');
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('.sheet-status').filter({ hasText: 'Saved this month.' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/08-continue.png` });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByTestId('scene').waitFor();
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 690 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '34px';
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `No horizontal overflow at ${width}px and 200% text`,
    );
    await page.screenshot({ path: `${shots}/reflow-${width}-200.png`, fullPage: true });
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '17px';
  });
  await page.setViewportSize({ width: 360, height: 690 });
  const liveClock = scenario();
  liveClock.send({ type: 'speed', speed: 3 });
  liveClock.send({ type: 'interview', candidate: 'sevda' });
  await importState(liveClock.state, liveClock.inputs);
  assert.deepEqual(
    await page
      .getByTestId('scene-choice')
      .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.choice)),
    required(view(liveClock.state).scene).choices.map((choice) => choice.id),
    'Every remaining interview question and both endings appear together',
  );
  assert.equal(await page.getByRole('button', { name: 'Other questions', exact: true }).count(), 0);
  await page.screenshot({ path: `${shots}/interview-all-questions-and-endings.png` });
  assert.equal(
    await page.getByRole('button', { name: 'Gallop', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  const minuteOfDay = async () => {
    const [hours, minutes] = (await page.locator('[data-time]').innerText()).split(':').map(Number);
    return required(hours) * 60 + required(minutes);
  };
  const slowStart = await minuteOfDay();
  await page.waitForTimeout(2400);
  const slowElapsed = (await minuteOfDay()) - slowStart;
  assert.ok(slowElapsed >= 1 && slowElapsed <= 3, `Scene holds real clock slow: ${slowElapsed} minutes`);
  assert.match(await page.locator('[data-speed]').innerText(), /held slow.*Gallop/);
  await page.screenshot({ path: `${shots}/clock-slow-scene.png` });
  await fits('finish on bench', page.getByRole('button', { name: /^Ask her to wait on the bench/ }), true);
  await fits(
    'finish send home',
    page.getByRole('button', { name: /^Send her home; you have her number/ }),
    true,
  );
  await tap(page.getByRole('button', { name: /^Ask her to wait on the bench/ }));
  assert.equal(
    await page.getByTestId('bench').getByRole('button', { name: 'Sevda', exact: true }).count(),
    1,
    'Waiting leaves Sevda on the bench',
  );
  await page.screenshot({ path: `${shots}/interview-wait-bench-result.png` });
  await tap('End the conversation');
  const resumedStart = await minuteOfDay();
  await page.waitForTimeout(1100);
  const resumedElapsed = (await minuteOfDay()) - resumedStart;
  assert.ok(
    resumedElapsed >= 15 && resumedElapsed <= 30,
    `Chosen Gallop resumes after scene: ${resumedElapsed} minutes`,
  );
  assert.match(await page.locator('[data-speed]').innerText(), /Gallop.*clock moving/);
  await page.screenshot({ path: `${shots}/clock-resumed.png` });

  const cityCall = scenario();
  for (let step = 0; step < 12 && !view(cityCall.state).phoneRinging; step++)
    cityCall.send({ type: 'wait-for' });
  assert.ok(view(cityCall.state).phoneRinging, 'City fixture has a waiting caller');
  await importState(cityCall.state, cityCall.inputs);
  await tap('City');
  await fits('City phone strip', page.locator('.phone-strip'));
  await fits('City answer phone', page.getByRole('button', { name: /^Answer phone/ }), true);
  await page.screenshot({ path: `${shots}/city-ringing-phone.png` });
  await tap(page.getByRole('button', { name: /^Answer phone/ }));
  assert.ok(await page.getByTestId('scene').isVisible(), 'City phone opens the caller scene');
  await page.screenshot({ path: `${shots}/city-phone-answered.png` });

  const coaching = scenario();
  coaching.send({ type: 'interview', candidate: 'sevda' });
  coaching.send({ type: 'choose', scene: required(view(coaching.state).scene).id, choice: 'q-reliable' });
  const coach = required(
    required(view(coaching.state).scene).choices.find((choice) => choice.id === 'coach'),
  );
  await importState(coaching.state, coaching.inputs);
  assert.equal(
    await page.locator('[data-choice="coach"]').count(),
    1,
    'Contextual coaching stays visible beside interview questions',
  );
  assert.ok(
    (await page.locator('[data-choice="coach"]').innerText()).includes(coach.label),
    'Coaching keeps the authored promise',
  );
  await newestSpeechFitsTranscript('Contextual coaching');
  await choicesFit('contextual coaching choices');
  await fits('contextual coaching Task', page.getByTestId('task'));
  await fits('contextual coaching bench', page.getByTestId('bench'));
  await page.screenshot({ path: `${shots}/03-contextual-coaching.png` });
  assert.equal(await page.evaluate(() => scrollY), 0, 'Contextual coaching needs no page scroll');

  const reference = scenario();
  reference.send({ type: 'interview', candidate: 'sevda' });
  const firstQuestion = required(
    required(view(reference.state).scene).choices.find((choice) => choice.id === 'hours'),
  );
  reference.send({
    type: 'choose',
    scene: required(view(reference.state).scene).id,
    choice: firstQuestion.id,
  });
  reference.close();
  const referee = required(
    required([...view(reference.state).bench, ...view(reference.state).books].find((c) => c.id === 'sevda'))
      .referees[0],
  );
  reference.until(540);
  reference.send({ type: 'call-reference', candidate: 'sevda', referee: referee.id });
  const referenceCall = required(view(reference.state).scene);
  reference.send({ type: 'choose', scene: referenceCall.id, choice: 'ref-patient' });
  const referenceScene = required(view(reference.state).scene);
  assert.equal(referenceScene.kind, 'reference');
  await importState(reference.state, reference.inputs);
  const referenceTranscript = await page.locator('.exchange').innerText();
  for (const line of referenceScene.lines)
    assert.ok(referenceTranscript.includes(line.text), `Reference preserves: ${line.text}`);
  assert.equal(await page.getByText('Earlier words', { exact: true }).count(), 0);
  await choicesFit('reference choices');
  await fits('reference Task', page.getByTestId('task'));
  await fits('reference bench', page.getByTestId('bench'));
  assert.equal(await page.evaluate(() => scrollY), 0, 'Reference needs no page scroll');
  await fits('reference newest line', page.locator('[data-scene-line]').last());
  await page.screenshot({ path: `${shots}/04-reference.png` });
  reference.close();
  await importState(reference.state, reference.inputs);
  if (!(await page.getByRole('button', { name: 'Sevda', exact: true }).count())) {
    if (!(await page.getByRole('button', { name: /^Sevda ·/ }).count())) await tap('Your books');
    await tap(page.getByRole('button', { name: /^Sevda ·/ }));
  } else await tap('Sevda');
  const notes = page.locator('.notes-details');
  if ((await notes.getAttribute('open')) === null) await notes.locator('summary').click();
  assert.ok((await page.locator('.note-claim').count()) >= 1, 'Card quotes evidence claims');
  assert.match(await page.locator('.card-notes').innerText(), /says|heard/);
  assert.ok((await page.locator('.candidate-wants').count()) >= 1, 'Card shows worker needs');
  await page.screenshot({ path: `${shots}/05-candidate-card.png`, fullPage: true });
  await page.locator('[data-action="references"]').click();
  assert.equal(await page.locator('dialog.sheet').count(), 1, 'One reference sheet');
  await page.locator('dialog.sheet [data-referee]').first().click();
  await page.getByTestId('scene').waitFor();
  assert.equal(await page.locator('dialog.sheet').count(), 0, 'Reference sheet becomes the scene');
  await tap(page.locator('[data-choice="ref-reliable"]'));
  await tap(page.locator('[data-choice="finish"]'));
  await page.locator('[data-action="place"]').click();
  assert.equal(await page.locator('dialog.sheet').count(), 1, 'One matching sheet');
  await tap('reliable · heard');
  assert.equal(await page.locator('[data-vouch="reliable"]').getAttribute('aria-pressed'), 'true');
  await cli('shot', 'reliable-heard-selected');
  await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal(await page.locator('dialog.sheet').count(), 0, 'Matching sheet closes completely');

  const contradiction = scenario();
  contradiction.send({ type: 'interview', candidate: 'gul' });
  contradiction.send({
    type: 'choose',
    scene: required(view(contradiction.state).scene).id,
    choice: 'q-honest',
  });
  contradiction.close();
  contradiction.until(840);
  const gul = required(
    [...view(contradiction.state).bench, ...view(contradiction.state).books].find((c) => c.id === 'gul'),
  );
  contradiction.send({ type: 'call-reference', candidate: 'gul', referee: required(gul.referees[0]).id });
  contradiction.send({
    type: 'choose',
    scene: required(view(contradiction.state).scene).id,
    choice: 'ref-honest',
  });
  contradiction.close();
  const crossed = required(
    required(
      [...view(contradiction.state).bench, ...view(contradiction.state).books].find((c) => c.id === 'gul'),
    ).notes.find((note) => note.crossedOut),
  );
  await importState(contradiction.state, contradiction.inputs);
  await page.locator('[data-candidate="gul"]').first().click();
  assert.ok(
    (await page.locator('.note.crossed-out .note-claim').innerText()).includes(required(crossed.claim)),
    'Contradicted claim stays readable on the card',
  );
  assert.match(await page.locator('.card-notes').innerText(), /Gül says.*says[\s\S]*Mrs Ak.*heard/);
  await page.screenshot({ path: `${shots}/05-contradicted-claim.png`, fullPage: true });

  // These later scenes retain the same real simulation, including its scheduled consequences.
  const relationship = scenario();
  relationship.send({ type: 'interview', candidate: 'sevda' });
  relationship.close();
  relationship.send({ type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  relationship.until(1100, true);
  while (view(relationship.state).phoneRinging && !view(relationship.state).scene) {
    relationship.send({ type: 'answer-phone' });
    const scene = required(view(relationship.state).scene);
    if (scene.kind === 'two-sides') break;
    relationship.close();
  }
  assert.equal(view(relationship.state).scene?.kind, 'two-sides', 'First work disagreement has two accounts');
  const twoSides = required(view(relationship.state).scene);
  await importState(relationship.state, relationship.inputs);
  const twoSidesText = await page.locator('.exchange').innerText();
  for (const line of twoSides.lines)
    assert.ok(twoSidesText.includes(line.text), `Two sides preserves: ${line.text}`);
  for (const side of ['worker', 'family']) {
    assert.ok((await page.locator(`.side-${side}`).count()) >= 1, `${side} account labelled`);
  }
  await page.screenshot({ path: `${shots}/06-two-sides.png` });
  await newestSpeechFitsTranscript('Two sides');
  await choicesFit('two sides choices');
  await fits('two sides Task', page.getByTestId('task'));
  await fits('two sides bench', page.getByTestId('bench'));
  assert.equal(await page.evaluate(() => scrollY), 0, 'Two sides needs no page scroll');
  await page.screenshot({ path: `${shots}/06-two-sides.png` });
  await page.locator('.exchange').evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: `${shots}/06-two-sides-worker.png` });
  await page.locator('.exchange').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const settle = required(twoSides.choices.find((choice) => !choice.disabled && choice.id !== 'leave'));
  relationship.send({ type: 'choose', scene: twoSides.id, choice: settle.id });
  const settlement = view(relationship.state).scene;
  if (settlement?.choices.some((choice) => choice.id === 'accept-condition')) {
    relationship.send({ type: 'choose', scene: settlement.id, choice: 'accept-condition' });
  }
  relationship.close();
  const placement = required(view(relationship.state).placements[0]);
  assert.ok(
    placement.arrangement && placement.pending,
    'Agreement exposes arrangement and scheduled follow-up',
  );
  await importState(relationship.state, relationship.inputs);
  await page.getByRole('button', { name: 'Placed', exact: true }).click();
  assert.ok(
    (await page.locator('.placement-arrangement').innerText()).includes(required(placement.arrangement)),
  );
  const pendingText = await page.locator('.placement-pending').innerText();
  assert.ok(
    pendingText.includes(required(placement.pending).dateLabel),
    'Pending follow-up uses full English date',
  );
  assert.match(pendingText, /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
  await page.screenshot({ path: `${shots}/07-placed.png` });

  const waiting = scenario();
  waiting.send({ type: 'interview', candidate: 'sevda' });
  waiting.close();
  waiting.send({ type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  waiting.until(1080);
  for (const candidate of view(waiting.state).bench)
    waiting.send({ type: 'take-number', candidate: candidate.id });
  waiting.send({ type: 'speed', speed: 0 });
  const next = view(waiting.state).next;
  assert.ok(next, 'Idle office names the next scheduled event');
  const waitResult = view(apply(structuredClone(waiting.state), { type: 'wait-for' }));
  assert.ok(waitResult.now <= next.at, 'Waiting stops at or before named event');
  if (waitResult.now < next.at)
    assert.ok(
      waitResult.dayCard || waitResult.phoneRinging || waitResult.scene,
      'Earlier wait stop offers a response',
    );
  await importState(waiting.state, waiting.inputs);
  const waitButton = page.locator('[data-action="wait-for"]');
  assert.ok(
    (await waitButton.innerText()).includes(next.dateLabel),
    'Wait control names the scheduled English date',
  );
  await fits('Wait for', waitButton, true);
  const waitClockStart = await minuteOfDay();
  await page.waitForTimeout(2200);
  assert.ok((await minuteOfDay()) > waitClockStart, 'Idle slow clock advances in real time');
  await waitButton.click();
  assert.match(await page.locator('[data-speed]').innerText(), /Waiting for.*clock running fast/);
  assert.ok(
    await page.getByRole('button', { name: 'Slow', exact: true }).isDisabled(),
    'Wait sweep disables clock selection',
  );
  await page.screenshot({ path: `${shots}/clock-wait-sweep.png` });
  await page.waitForTimeout(1400);
  const targetTime = `${String(Math.floor((waitResult.now % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(waitResult.now % 60)).padStart(2, '0')}`;
  await page.locator('[data-time]').filter({ hasText: targetTime }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Slow', exact: true }).getAttribute('aria-pressed'),
    'true',
    'Wait preserves chosen speed',
  );
  await page.screenshot({ path: `${shots}/clock-wait-for.png` });
  const cityScenario = scenario();
  cityScenario.send({ type: 'interview', candidate: 'sevda' });
  cityScenario.close();
  cityScenario.send({ type: 'place', candidate: 'sevda', family: 'arslans', vouch: ['patient'] });
  for (const [label, minute] of [
    ['weekday-evening', 1100],
    ['friday-afternoon', 4 * 1440 + 965],
  ] as const) {
    cityScenario.until(minute);
    await importState(cityScenario.state, cityScenario.inputs);
    await page.getByRole('button', { name: 'City', exact: true }).click();
    const figures = page.getByTestId('city-figure');
    assert.ok((await figures.count()) > 0, `${label} has interactive people`);
    await figures.first().click();
    const group = page.getByRole('dialog', { name: 'People here', exact: true });
    if (await group.isVisible()) {
      assert.equal(await page.locator('dialog.sheet').count(), 1, 'One city group sheet');
      await group.getByRole('button', { name: 'Back', exact: true }).click();
      assert.ok(
        await page.evaluate(() => !!document.activeElement?.hasAttribute('data-city-group')),
        'City Back restores group focus',
      );
      await page.locator('[data-city-group]:focus').click();
      await group.locator('[data-city-figure]').first().click();
      assert.equal(await page.locator('dialog.sheet').count(), 0, 'Choosing a city person closes the group');
      assert.ok(
        await page.evaluate(() => !!document.activeElement?.hasAttribute('data-city-group')),
        'City selection restores group focus',
      );
    }
    assert.ok((await page.locator('[data-city-person]').innerText()).trim(), 'City person has a description');
    await fits(`${label} map`, page.locator('#city'));
    await fits(`${label} selected person`, page.locator('[data-city-person]'));
    assert.equal(await page.evaluate(() => scrollY), 0, `${label} city needs no page scroll`);
    await page.screenshot({ path: `${shots}/city-${label}.png` });
    await page.screenshot({ path: `${shots}/city-${label}-full.png`, fullPage: true });
  }
  // A fresh month is played through the public CLI. No imported fixture enacts this placement.
  await open();
  await cli('speed', 'Slow');
  await tap('Pınar');
  await tap(page.locator('[data-action="take-number"]'));
  assert.equal(
    await page.getByTestId('bench').getByRole('button', { name: 'Pınar', exact: true }).count(),
    0,
    'Taking her number removes Pınar from the waiting bench',
  );
  await tap('Gül');
  await tap(page.getByRole('button', { name: /^Interview/ }));
  await tap(page.getByTestId('scene-choice').filter({ hasText: 'last job' }));
  const patienceQuestion = page.getByTestId('scene-choice').filter({ hasText: 'child keeps crying' });
  assert.equal(await patienceQuestion.count(), 1, 'Patience question is in the full question list');
  await tap(patienceQuestion);
  await tap(page.getByRole('button', { name: /^Send her home; you have her number/ }));
  assert.equal(
    await page.getByTestId('bench').getByRole('button', { name: 'Gül', exact: true }).count(),
    0,
    'Sending Gül home removes her from the bench',
  );
  assert.match(await cli('text'), /Gül.*(home|books)/, 'Departure has a visible result');
  await page.screenshot({ path: `${shots}/interview-send-home-result.png` });
  await tap('End the conversation');
  await tap(page.locator('[data-action="place"]'));
  const toggles = page.locator('[data-vouch]');
  assert.equal(await toggles.count(), 6, 'Every quality has a vouch toggle');
  for (let index = 0; index < 6; index++) {
    const toggle = toggles.nth(index);
    const label = (await toggle.innerText()).trim();
    assert.match(label, /^[a-z]+ · (seen|heard|says|not checked)$/);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await toggle.scrollIntoViewIfNeeded();
    await fits(`vouch ${label}`, toggle, true);
    await tap(label);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true', `${label} selects through CLI`);
    await tap(label);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false', `${label} clears through CLI`);
  }
  await tap('Read the evidence');
  assert.equal(
    await page.getByText('Read the evidence', { exact: true }).locator('..').getAttribute('open'),
    '',
  );
  await tap('Read the evidence');
  await tap('patient · says');
  await cli('shot', 'harness-vouch-selected');
  await tap('Place with this family');
  assert.match(await cli('text'), /Gül placed with the Arslans|Works at the Arslans/);
  const publicRunPath = `${shots}/${port}/harness-placement.json`;
  await cli('export', publicRunPath);
  const publicRun = verifyImport(readFileSync(publicRunPath, 'utf8'));
  assert.ok(
    publicRun.inputs.some(({ input }) => input.type === 'take-number' && input.candidate === 'pinar'),
    'Export records the player taking Pınar’s number',
  );
  assert.ok(
    view(publicRun.state).books.some((candidate) => candidate.id === 'pinar'),
    'Pınar remains on the books after going home',
  );
  const placedInput = publicRun.inputs.find(({ input }) => input.type === 'place');
  assert.ok(placedInput && placedInput.input.type === 'place');
  assert.deepEqual(
    placedInput.input.vouch,
    ['patient'],
    'CLI placement preserves exactly the chosen promise',
  );
  await tap('City');
  await tap('People in the city');
  assert.equal(
    await page.locator('.city-people').getAttribute('open'),
    '',
    'City disclosure opens through visible label',
  );
  await cli('shot', 'harness-city-disclosure');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: `${shots}/14-dark.png` });
  assert.deepEqual(errors, []);
  const seconds = Math.round((performance.now() - started) / 10) / 100;
  writeFileSync(
    `${shots}/acceptance.json`,
    JSON.stringify(
      {
        viewport: [360, 690],
        realClock: true,
        reviewerMode: 'Builder acceptance; source read',
        laterScenes: 'Replay-checked simulation histories imported through the UI',
        seconds,
        cliCommands,
        bounds,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(`Phone acceptance passed in ${seconds}s. Evidence: ${shots}/`);
} finally {
  if (driver)
    await new Promise<void>((resolve, reject) =>
      driver?.close((error) => (error ? reject(error) : resolve())),
    );
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
