import { defineTerms, downloadJson, glossaryPanel, introCard, term } from '@adam0white/lab-kit';
import * as sim from '../sim/index.ts';
import {
  type CandidateView,
  type Input,
  type LoggedInput,
  QUALITIES,
  type Quality,
  SPEEDS,
  type Speed,
  type State,
  type View,
} from '../sim/types.ts';
import { exportRun, type RunExport, verifyImport } from './export.ts';
import { lab, notebookRunOptions } from './lab.ts';
import { cityFigurePositions, drawCity, MAP_HEIGHT, MAP_WIDTH } from './map.ts';
import { drawOffice, officeSeats } from './office.ts';
import {
  candidateAvailability,
  clockLabels,
  evidence,
  escapeHtml as h,
  INTRO,
  money,
  noteText,
  phoneAvailability,
  placementLabel,
  resumeLine,
  SPEED_NAMES,
  speedLabel,
  vouchLabel,
} from './render.ts';
import { get, put, putNow } from './store.ts';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('Good Hands needs an app element.');
const root = host;
let state: State | null = null;
let inputs: LoggedInput[] = [];
let saved: ReturnType<typeof verifyImport> | null = null;
let playing = false;
let selected: string | null = null;
let tab: 'Bench' | 'Families' | 'Placed' = 'Bench';
let city = false;
let cityPerson: string | null = null;
let last = performance.now();
let shown = '';
let lastHour = -1;
let sheet: HTMLDialogElement | null = null;
let modal = '';
let updateInspection: (() => void) | null = null;
let screen = '';
let notice = '';
let waitAnimation: { before: View; start: number; end: number; label: string } | null = null;
let questionPage = 0;
let questionScene = '';
let heldQuestions: { id: string; page: number } | null = null;
let transcriptKey = '';
let saveReady = false;
const ALL_GAMES = 'https://human.adamwhite.work/games/';
const TERMS = {
  Hanım: 'a respectful title for a woman',
  Bey: 'a respectful title for a man',
  abla: 'older sister; also a warm form of address',
  Kültürpark: 'the city park in central Izmir',
  Alsancak: 'the neighbourhood around your office',
  Karşıyaka: 'the district across the bay',
  lira: 'Turkish money',
};
defineTerms(TERMS);

function button(label: string, fn: () => void, className = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = className;
  b.onclick = fn;
  return b;
}
function setScreen(name: 'title' | 'office' | 'city' | 'scene' | 'review' | 'menu'): void {
  if (screen === name) return;
  screen = name;
  lab.screen(name);
}
function current(): View {
  if (!state) throw new Error('No month is open.');
  return sim.view(state);
}
function candidates(v: View): CandidateView[] {
  return [...v.bench, ...v.books];
}
function person(v: View, id: string): string {
  return candidates(v).find((c) => c.id === id)?.name ?? v.families.find((f) => f.id === id)?.name ?? id;
}
function candidate(v: View): CandidateView | undefined {
  return candidates(v).find((c) => c.id === selected);
}
function save(): void {
  if (!state) return;
  const run = exportRun(state, inputs);
  void put('run', run).then((ok) => {
    if (!ok) {
      notice = 'This browser could not save. Download this run from Game menu.';
      showNotice();
    }
  });
}
function showNotice(): void {
  const el = root.querySelector<HTMLElement>('[data-status]');
  if (el) el.textContent = notice;
}
function changed(previous: View, next: View): void {
  // Views are copied before a tick because the simulation may mutate its state.
  for (const name of sim.milestones(previous, next)) lab.milestone(name);
}
function send(input: Input): void {
  if (!state || waitAnimation) return;
  const at = current().now;
  const previous = structuredClone(current());
  state = sim.apply(state, input);
  inputs.push({ at, input: structuredClone(input) });
  changed(previous, current());
  if (input.type === 'wait-for' && current().now > previous.now) {
    const start = performance.now();
    waitAnimation = {
      before: previous,
      start,
      end: start + 1200,
      label: previous.next?.label ?? 'the next event',
    };
  }
  const latest = current().log.at(-1);
  notice = latest && latest.id !== previous.log.at(-1)?.id ? latest.text : '';
  if (current().scene) closeSheet(false);
  render(true);
  root
    .querySelector<HTMLElement>(
      '[data-testid="scene-choice"]:not(:disabled), [data-action="interview"]:not(:disabled)',
    )
    ?.focus({ preventScroll: true });
  save();
}

function title(): void {
  playing = false;
  shown = '';
  setScreen('title');
  root.innerHTML = `<main class="title-page"><a class="hub" href="${ALL_GAMES}">◇ human framework</a><p class="eyebrow">Izmir · November 2026</p><div class="agency-mark" aria-hidden="true">G H<span>placement agency</span></div><h1>Good Hands</h1><p class="subtitle">A month at Nermin’s desk.</p><div class="title-actions"></div><p class="title-status" role="status">${saveReady ? '' : 'Looking for a saved month…'}</p><button type="button" data-action="menu">Game menu</button><a class="all-games" href="${ALL_GAMES}">All games</a></main>`;
  const actions = root.querySelector('.title-actions');
  if (saved) {
    actions?.append(button('Continue', () => begin(saved?.state ?? null, saved?.inputs ?? [])));
    const p = document.createElement('p');
    p.className = 'continue-line';
    p.textContent = resumeLine(sim.view(saved.state));
    actions?.append(p);
  }
  actions?.append(button('New month', newMonth));
}
function newMonth(): void {
  closeSheet();
  const start = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 20261102;
    begin(sim.newGame(seed), []);
    lab.milestone('run started');
  };
  const card = introCard({
    title: 'Good Hands',
    goal: INTRO,
    key: 'goodhands:intro:v1',
    storage: { getItem: () => null, setItem: () => {} },
    onClose: start,
  });
  if (card) {
    const b = card.querySelector('button');
    if (b) b.textContent = 'Open the office';
  } else start();
}
function begin(next: State | null, history: LoggedInput[]): void {
  if (!next) return;
  state = next;
  inputs = structuredClone(history);
  selected = null;
  tab = 'Bench';
  city = false;
  playing = true;
  last = performance.now();
  lastHour = Math.floor(current().now / 60);
  questionScene = '';
  heldQuestions = null;
  notice = '';
  render(true);
  save();
}
function shell(v: View): void {
  root.innerHTML = `<main class="game" data-testid="office"><header class="topbar"><a class="hub" href="${ALL_GAMES}" aria-label="human framework games">◇ human framework</a><button type="button" data-action="menu">Game menu</button><div class="clock"><span data-date></span> <strong data-time></strong></div><label class="speed-control">Clock <select aria-label="Clock speed">${SPEED_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select></label><p class="speed-status" data-speed></p><button type="button" data-action="wait-for" class="wait-for" hidden></button></header><div class="room"><canvas id="office" role="img" aria-label="Nermin’s desk, telephone, window and the waiting bench"></canvas><div class="seat-targets"></div><button class="phone-control" type="button" data-action="phone"></button></div><button class="task now" type="button" aria-label="Task" data-testid="task" data-action="task"><strong>Task</strong><span></span></button><p class="status" role="status" data-status></p><nav class="bench-strip" aria-label="Waiting bench" data-testid="bench"></nav><div data-content></div><footer><span data-money></span><a href="${ALL_GAMES}">All games</a></footer></main>`;
  const speeds = root.querySelector('select');
  speeds?.addEventListener('change', () => send({ type: 'speed', speed: Number(speeds.value) as Speed }));
  updateClock(v);
}
function updateClock(v: View): void {
  const text = (selector: string, value: string) => {
    const el = root.querySelector(selector);
    if (el && el.textContent !== value) el.textContent = value;
  };
  text('[data-date]', v.dateLabel);
  text('[data-time]', v.timeLabel);
  text(
    '[data-speed]',
    waitAnimation ? `Waiting for ${waitAnimation.label} · clock running fast` : speedLabel(v),
  );
  root.querySelector('.game')?.setAttribute('aria-busy', String(!!waitAnimation));
  const wait = root.querySelector<HTMLButtonElement>('[data-action="wait-for"]');
  if (wait) {
    wait.disabled = !!waitAnimation;
    wait.hidden = !v.next || v.slowed || !!v.scene || !!v.phoneRinging || !!v.dayCard;
    wait.textContent = v.next ? `Wait for ${v.next.label} · ${v.next.dateLabel}` : '';
  }
  const select = root.querySelector<HTMLSelectElement>('select');
  if (select) {
    select.disabled = !!waitAnimation;
    if (document.activeElement !== select) select.value = String(v.speed);
  }
  text('[data-money]', `${money(v.cash)} · Rent ${money(v.rent.amount)} ${v.rent.label}`);
}
function displayedView(): View {
  const v = current();
  if (!waitAnimation) return v;
  const { before, start, end } = waitAnimation;
  const progress = Math.max(0, Math.min(1, (performance.now() - start) / (end - start)));
  const now = before.now + (v.now - before.now) * progress;
  return { ...before, now, ...clockLabels(now) };
}
function render(force = false): void {
  if (!state || !playing) return;
  const v = displayedView();
  if (v.ended && v.review) {
    if (force || shown !== 'review') review(v);
    return;
  }
  if (!root.querySelector('.game')) shell(v);
  updateClock(v);
  updateInspection?.();
  const signature = JSON.stringify([
    v.task,
    v.next,
    v.phoneRinging,
    v.bench,
    v.books,
    v.requests,
    v.families,
    v.placements,
    v.scene,
    v.heldScene,
    v.dayCard,
    // Canvas positions update each frame without replacing the transcript or controls.
    city ? v.city.figures.map((f) => [f.id, f.name, f.place]) : null,
    city ? v.city.threads.map((t) => [t.id, t.consequence, v.now >= t.end]) : null,
    selected,
    tab,
    city,
    cityPerson,
    v.open,
  ]);
  if (!force && shown === signature) {
    if (city && !v.scene) updateCity(v);
    return;
  }
  if (v.scene && sheet && modal !== 'menu') closeSheet(false);
  shown = signature;
  const active =
    document.activeElement instanceof HTMLButtonElement && root.contains(document.activeElement)
      ? document.activeElement
      : null;
  const activeLabel = active?.getAttribute('aria-label') ?? active?.textContent;
  root.querySelector('.game')?.classList.toggle('has-scene', !!v.scene);
  root
    .querySelector('.game')
    ?.classList.toggle('has-phone-limit', !!v.phoneRinging && !!phoneAvailability(v));
  root.querySelector('.game')?.classList.toggle('has-city', city && !v.scene && !v.dayCard);
  root.querySelector('.game')?.classList.toggle('has-day-card', !!v.dayCard);
  const task = root.querySelector<HTMLElement>('.task span');
  if (task) task.textContent = v.task.text.charAt(0).toLocaleUpperCase('en-GB') + v.task.text.slice(1);
  const phone = root.querySelector<HTMLButtonElement>('.phone-control');
  if (phone) {
    phone.textContent = v.phoneRinging ? `Answer phone · ${v.phoneRinging.who}` : 'Telephone';
    phone.hidden = !v.phoneRinging;
    const reason = phoneAvailability(v);
    phone.disabled = !!reason;
    let line = root.querySelector<HTMLElement>('.phone-reason');
    if (!line) {
      line = document.createElement('p');
      line.id = 'phone-reason';
      line.className = 'phone-reason reason';
      phone.after(line);
      phone.setAttribute('aria-describedby', line.id);
    }
    line.textContent = v.phoneRinging ? (reason ?? '') : '';
  }
  drawOffice(root.querySelector<HTMLCanvasElement>('#office') as HTMLCanvasElement, v, selected);
  const targets = root.querySelector('.seat-targets');
  targets?.replaceChildren();
  for (const seat of officeSeats(v)) {
    const c = v.bench.find((c) => c.id === seat.id);
    if (!c) continue;
    const b = button('', () => selectCandidate(c.id), 'seat-target');
    if (seat.width * (root.querySelector<HTMLCanvasElement>('#office')?.clientWidth ?? 336) < 44) continue;
    b.setAttribute('aria-label', `Select ${c.name} on the bench`);
    b.setAttribute('aria-pressed', String(selected === c.id));
    b.style.cssText = `left:${seat.x * 100}%;top:${(v.scene ? 0.24 : seat.y) * 100}%;width:${seat.width * 100}%;height:${(v.scene ? 0.65 : seat.height) * 100}%`;
    targets?.append(b);
  }
  const bench = root.querySelector('.bench-strip');
  bench?.replaceChildren();
  for (const c of v.bench) {
    const b = button(c.name, () => selectCandidate(c.id));
    b.setAttribute('aria-label', c.name);
    b.setAttribute('aria-pressed', String(selected === c.id));
    b.title =
      c.posture === 'leaving'
        ? 'Picking up her bag'
        : c.posture === 'restless'
          ? 'Checking the time'
          : 'Waiting on the bench';
    bench?.append(b);
  }
  if (!v.bench.length && bench) bench.textContent = 'The bench is empty.';
  const content = root.querySelector<HTMLElement>('[data-content]');
  if (!content) return;
  const oldTranscript = content.querySelector<HTMLElement>('.exchange');
  const oldScroll =
    oldTranscript && oldTranscript.scrollTop + oldTranscript.clientHeight < oldTranscript.scrollHeight - 2
      ? oldTranscript.scrollTop
      : null;
  const nextTranscriptKey = v.scene ? JSON.stringify([v.scene.id, v.scene.lines]) : '';
  if (v.scene) {
    content.innerHTML = sceneHtml(v);
    setScreen(sheet ? 'menu' : 'scene');
  } else if (v.dayCard) {
    content.innerHTML = dayHtml(v);
    setScreen('office');
  } else {
    content.innerHTML = `<nav class="tabs" aria-label="Agency books">${(['Bench', 'Families', 'Placed'] as const).map((t) => `<button type="button" data-tab="${t}" aria-pressed="${!city && tab === t}">${t}</button>`).join('')}<button type="button" data-action="city" aria-pressed="${city}">City</button></nav><section class="desk-content">${city ? cityHtml(v) : tab === 'Bench' ? benchHtml(v) : tab === 'Families' ? familiesHtml(v) : placedHtml(v)}</section>`;
    if (city) updateCity(v);
    setScreen(sheet ? 'menu' : city ? 'city' : 'office');
  }
  gloss(content);
  const transcript = content.querySelector<HTMLElement>('.exchange');
  if (transcript)
    transcript.scrollTop =
      nextTranscriptKey === transcriptKey && oldScroll !== null ? oldScroll : transcript.scrollHeight;
  transcriptKey = nextTranscriptKey;
  if (activeLabel && document.activeElement === document.body) {
    const replacement = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent) === activeLabel,
    );
    replacement?.focus({ preventScroll: true });
  }
  showNotice();
}
function selectCandidate(id: string): void {
  selected = id;
  tab = 'Bench';
  city = false;
  if (current().scene) {
    notice = `${person(current(), id)} selected. Finish the conversation before another interview.`;
  }
  render(true);
}
function benchHtml(v: View): string {
  const c = candidate(v);
  if (!c)
    return `<div class="empty-card"><h1>Nermin’s desk</h1><p>Choose someone on the bench to open her card.</p>${v.books.length ? `<div class="book-list">${v.books.map((c) => `<button type="button" data-candidate="${h(c.id)}">${h(c.name)} · ${h(c.busy ?? c.status)}</button>`).join('')}</div>` : ''}</div>`;
  const unavailable =
    candidateAvailability(c) ?? (!v.open ? 'The office is closed. Sleep to open tomorrow.' : undefined);
  const reason = unavailable ? `<p class="reason">${h(unavailable)}</p>` : '';
  return `<article class="candidate-card"><div class="card-heading"><h2>${h(c.name)}</h2><span>${h(c.roles.join(' / '))}</span></div><p class="look">${h(c.look)}</p><div class="candidate-actions">${action('Interview', 'interview', unavailable, 'About 30 minutes')}${action('Call a reference', 'references', unavailable, 'About 15 minutes')}${action('Send for a trial', 'trial', unavailable, 'Her next morning away')}${action('Place', 'place', unavailable, 'Choose what to vouch for')}${c.status === 'bench' ? action('Take her number', 'take-number', unavailable, '2 minutes · she goes home; stays on the books') : ''}</div>${reason}${c.wants ? `<p class="candidate-wants handwritten">Needs: ${h(c.wants)}</p>` : ''}<details class="notes-details" open><summary>Nermin’s notes · ${c.wage === null ? 'Wage not yet asked' : `${money(c.wage)} a month`}</summary><div class="card-notes">${QUALITIES.map(
    (q) => {
      const notes = c.notes.filter((n) => n.quality === q);
      const read = notes.findLast((n) => !n.crossedOut) ?? notes.at(-1);
      return `<section class="quality-note"><h3>${q}</h3><p class="nermin-read handwritten">${read ? h(read.phrase) : 'Not asked yet.'}</p>${notes.map((n) => `<p class="note ${n.crossedOut ? 'crossed-out' : ''}"><small>${h(n.from)} · ${n.source}</small><span class="note-claim">${h(n.claim ?? n.phrase)}</span></p>`).join('')}</section>`;
    },
  ).join(
    '',
  )}</div><h3>Experience</h3>${c.experience.length ? c.experience.map((e) => `<p>${h(e)}</p>`).join('') : '<p>She has not told you yet.</p>'}<h3>Referees</h3>${c.referees.map((r) => `<p>${h(r.name)} · ${r.reachable ? 'reachable' : h(r.why ?? 'Not reachable now; try later')}${r.called ? ' · already called' : ''}</p>`).join('') || '<p>No referee yet. Ask in the interview.</p>'}</details><button type="button" data-action="all-cards">Other cards</button></article>`;
}
function action(label: string, key: string, disabled?: string, hint?: string): string {
  return `<button type="button" data-action="${key}" ${disabled ? 'disabled' : ''}><span>${h(label)}</span>${hint ? `<small>${h(hint)}</small>` : ''}</button>`;
}
function familiesHtml(v: View): string {
  return (
    v.requests
      .map(
        (r) =>
          `<article class="family-card"><h2>${h(person(v, r.family))}</h2><p>“${h(r.wants)}”</p><p>${h(r.role)} · ${money(r.wage)} a month</p><p class="deadline">By ${h(r.byLabel)} · ${r.status}</p><button type="button" data-family="${h(r.family)}">Household and request</button></article>`,
      )
      .join('') || '<p>No requests have reached Nermin.</p>'
  );
}
function placedHtml(v: View): string {
  return (
    v.placements
      .map(
        (p) =>
          `<article class="placement-card"><h2>${h(person(v, p.candidate))} · ${h(person(v, p.family))}</h2><p>${placementLabel(p)}</p>${p.arrangement ? `<p class="placement-arrangement">${h(p.arrangement)}</p>` : ''}${p.pending ? `<p class="placement-pending">${h(p.pending.dateLabel)}: ${h(p.pending.text)}</p>` : ''}<p>${h(p.lastWord ?? 'No word from the house yet.')}</p>${['trial', 'kept'].includes(p.status) ? `<button type="button" data-placement="${h(p.id)}">Check in or withdraw</button>` : ''}</article>`,
      )
      .join('') || '<p>No one placed yet. Your word will go with them.</p>'
  );
}
function sceneHtml(v: View): string {
  const s = v.scene;
  if (!s) return '';
  const held = v.heldScene?.title
    .replace(/^Interview:\s*/, 'Interview with ')
    .replace(/^Reference:\s*/, 'Reference call for ');
  const finish = s.canLeave
    ? s.choices.find((c) => (c.id === 'finish' || /^Finish/.test(c.label)) && !c.disabled)
    : undefined;
  if (questionScene !== s.id) {
    if (v.heldScene?.id === questionScene) heldQuestions = { id: questionScene, page: questionPage };
    questionScene = s.id;
    questionPage = heldQuestions?.id === s.id ? heldQuestions.page : 0;
    if (heldQuestions?.id === s.id) heldQuestions = null;
  }
  const available = s.choices.filter((c) => c !== finish);
  const questions = s.kind === 'interview' ? available.filter((c) => c.id !== 'coach') : [];
  const sharedHint =
    questions.length && questions.every((c) => c.hint === questions[0]?.hint)
      ? questions[0]?.hint
      : undefined;
  const details = s.choices.filter((c) => c.hint && (s.kind === 'two-sides' || c.id === 'coach'));
  const pages = Math.ceil(questions.length / 2);
  const choices =
    questions.length > 2
      ? [
          ...questions.slice((questionPage % pages) * 2, ((questionPage % pages) + 1) * 2),
          ...available.filter((c) => c.id === 'coach'),
        ]
      : available;
  return `<section class="scene-sheet" data-testid="scene" aria-label="${h(s.title)}"><div class="sheet-heading"><h2>${h(s.title)}</h2>${finish ? `<button type="button" data-choice="${h(finish.id)}">${h(finish.label)}</button>` : s.canLeave ? '<button type="button" data-action="leave-scene">Finish</button>' : ''}</div>${held ? `<p class="held-scene" role="status">${h(held)} is waiting.</p>` : ''}${finish?.hint ? `<p class="question-limit">${h(finish.hint)}</p>` : ''}<div class="exchange" role="region" aria-label="Conversation transcript" tabindex="0">${
    details.length
      ? `<details class="response-details"><summary>Response details</summary>${details
          .map((c) => `<p><strong>${h(c.label)}:</strong> ${h(c.hint ?? '')}</p>`)
          .join('')}</details>`
      : ''
  }${s.lines.map((l) => `<p data-scene-line ${l.side ? `data-scene-side="${l.side}"` : ''} class="${l.kind === 'speech' ? 'speech' : l.kind === 'notice' ? 'notice-line' : ''} ${l.side ? `side-${l.side}` : ''}">${l.speaker ? `<strong>${h(l.speaker)}:</strong> ` : l.side ? `<strong>${l.side === 'worker' ? 'Worker' : 'Family'}:</strong> ` : ''}${h(l.text)}</p>`).join('')}</div>${
    s.added?.length
      ? `<p class="added" role="status">Added to her card: ${s.added
          .filter((n) => !n.crossedOut)
          .map((n) => `${h(n.quality)} · ${n.source}`)
          .join('; ')}</p>`
      : ''
  }${sharedHint ? `<p class="question-cost">${h(sharedHint)} per question.</p>` : ''}<div class="scene-choices">${choices.map((c) => `<div class="choice"><button type="button" data-testid="scene-choice" data-choice="${h(c.id)}" ${c.disabled ? 'disabled' : ''}>${h(c.label)}${c.hint && s.kind !== 'two-sides' && c.id !== 'coach' && !(sharedHint && questions.includes(c)) ? `<small>${h(c.hint)}</small>` : ''}</button>${c.disabled ? `<p class="reason">${h(c.disabled)}</p>` : ''}</div>`).join('')}${questions.length > 2 ? '<button type="button" data-action="more-questions">Other questions</button>' : ''}</div></section>`;
}
function dayHtml(v: View): string {
  const d = v.dayCard;
  if (!d) return '';
  return `<section class="day-card"><h2>${h(d.dateLabel)} · Office closed</h2>${d.lines.map((l) => `<p>${h(l)}</p>`).join('')}<p class="tomorrow">${h(d.tomorrow)}</p><button type="button" data-action="sleep">Sleep</button></section>`;
}
function cityHtml(v: View): string {
  return `<h2>The city</h2><p data-city-person role="status"></p><div class="city-map"><canvas id="city" role="img" aria-label="Izmir across the bay: people at home, at work and travelling; dots carry talk"></canvas><div class="city-targets"></div></div><p class="map-key">Posture shows mood. Dots carry talk; trails remain.</p><details class="city-people"><summary>People in the city</summary>${v.city.figures.map((f) => `<button type="button" data-city-figure="${h(f.id)}" aria-pressed="${cityPerson === f.id}">${h(f.name)} · ${h(f.place ?? 'in the city')}</button>`).join('')}</details>${v.city.threads
    .filter((t) => t.consequence && v.now >= t.end)
    .slice(-2)
    .map((t) => `<p class="city-consequence">${h(t.consequence ?? '')}</p>`)
    .join('')}`;
}
function updateCity(v: View): void {
  const canvas = root.querySelector<HTMLCanvasElement>('#city');
  const targets = root.querySelector<HTMLElement>('.city-targets');
  if (!canvas || !targets) return;
  drawCity(canvas, v, cityPerson ?? undefined);
  const positions = cityFigurePositions(v);
  // Groups share a target and a labelled list, so dense meetings never stack hit areas.
  const groups: { x: number; y: number; right: number; bottom: number; ids: string[] }[] = [];
  for (const p of positions) {
    const x = Math.min(Math.max((p.x / MAP_WIDTH) * canvas.clientWidth - 22, 0), canvas.clientWidth - 44);
    const y = Math.min(Math.max((p.y / MAP_HEIGHT) * canvas.clientHeight - 22, 0), canvas.clientHeight - 44);
    const group = { x, y, right: x + 44, bottom: y + 44, ids: [p.figure.id] };
    // Merge intersecting hit rectangles until each group covers all of its figures.
    for (let i = 0; i < groups.length; ) {
      const other = groups[i];
      if (!other) break;
      if (
        group.x < other.right &&
        group.right > other.x &&
        group.y < other.bottom &&
        group.bottom > other.y
      ) {
        group.x = Math.min(group.x, other.x);
        group.y = Math.min(group.y, other.y);
        group.right = Math.max(group.right, other.right);
        group.bottom = Math.max(group.bottom, other.bottom);
        group.ids.push(...other.ids);
        groups.splice(i, 1);
        i = 0;
      } else i++;
    }
    groups.push(group);
  }
  const key = JSON.stringify(groups.map((g) => g.ids));
  if (targets.dataset.groups !== key) {
    targets.dataset.groups = key;
    targets.replaceChildren(
      ...groups.map((g) => {
        const names = g.ids.map((id) => v.city.figures.find((f) => f.id === id)?.name).join(', ');
        const b = button(
          '',
          () => {
            if (g.ids.length === 1) {
              cityPerson = g.ids[0] ?? null;
              updateCity(current());
            } else {
              openSheet(
                'People here',
                g.ids
                  .map((id) => {
                    const f = current().city.figures.find((f) => f.id === id);
                    return f
                      ? `<button type="button" data-city-figure="${h(id)}">${h(f.name)} · ${h(f.place ?? 'in the city')}</button>`
                      : '';
                  })
                  .join(''),
              );
            }
          },
          'city-figure',
        );
        b.dataset.testid = 'city-figure';
        b.dataset.cityGroup = [...g.ids].sort().join(',');
        b.setAttribute(
          'aria-label',
          g.ids.length === 1
            ? `${names} · ${v.city.figures.find((f) => f.id === g.ids[0])?.place ?? 'in the city'}`
            : `People here: ${names}`,
        );
        return b;
      }),
    );
  }
  [...targets.querySelectorAll<HTMLButtonElement>('button')].forEach((b, i) => {
    const g = groups[i];
    if (!g) return;
    b.style.left = `${g.x}px`;
    b.style.top = `${g.y}px`;
    b.style.width = `${g.right - g.x}px`;
    b.style.height = `${g.bottom - g.y}px`;
    b.setAttribute('aria-pressed', String(g.ids.includes(cityPerson ?? '')));
  });
  const selected = positions.find((p) => p.figure.id === cityPerson);
  const caption = root.querySelector('[data-city-person]');
  if (caption) caption.textContent = selected ? `${selected.figure.name} · ${selected.place}` : '';
}

function review(v: View): void {
  closeSheet(false);
  shown = 'review';
  setScreen('review');
  const r = v.review;
  if (!r) return;
  root.innerHTML = `<main class="review"><header><a href="${ALL_GAMES}">◇ human framework</a><button type="button" data-action="menu">Game menu</button></header><p class="eyebrow">${h(v.dateLabel)}</p><h1>A month in Good Hands</h1><p>${money(r.cash)} left. ${h(r.trustedBy.length ? `${r.trustedBy.map((id) => person(v, id)).join(', ')} trust Nermin.` : 'Her word has travelled through the city.')}</p><h2>Her notes beside the truth</h2>${r.people
    .map(
      (p) =>
        `<details><summary>${h(p.name)}</summary><table><thead><tr><th>Quality</th><th>Nermin’s notes</th><th>Truth</th></tr></thead><tbody>${QUALITIES.map(
          (q) =>
            `<tr><th>${q}</th><td>${
              p.notes
                .filter((n) => n.quality === q)
                .map((n) => `<span class="${n.crossedOut ? 'crossed-out' : ''}">${h(noteText(n))}</span>`)
                .join('<br>') || 'No note'
            }</td><td>${p.truth[q]}</td></tr>`,
        ).join('')}</tbody></table></details>`,
    )
    .join(
      '',
    )}<h2>Inside the houses</h2>${r.placements.map((p) => `<article>${p.story.map((line) => `<p>${h(line)}</p>`).join('')}</article>`).join('')}<h2>Where the talk went</h2><canvas id="review-city" role="img" aria-label="The city’s threads of talk at month end"></canvas>${r.threads.map((t) => `<p>${h(person(v, t.from))} → ${h(person(v, t.to))} · ${h(t.place)}${t.about ? ` · ${h(person(v, t.about))}` : ''}</p>`).join('')}<p class="review-question">${h(r.question)}</p><button type="button" data-action="new-month">New month</button><a href="${ALL_GAMES}">All games</a></main>`;
  const canvas = root.querySelector<HTMLCanvasElement>('#review-city');
  if (canvas) drawCity(canvas, { ...v, city: { ...v.city, threads: r.threads } });
  gloss(root);
}

function closeSheet(restore = true): void {
  if (!sheet) return;
  const old = sheet;
  sheet = null;
  modal = '';
  updateInspection = null;
  old.close();
  old.remove();
  last = performance.now();
  if (restore && playing) render(true);
}
function openSheet(title: string, content: string, kind = 'inspect'): HTMLDialogElement {
  const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const originLabel = origin?.getAttribute('aria-label') ?? origin?.textContent;
  const originAction = origin?.dataset.action;
  const originGroups = origin?.dataset.cityGroup;
  closeSheet(false);
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.setAttribute('aria-label', title);
  d.innerHTML = `<div class="sheet-heading"><h2>${h(title)}</h2><button type="button" data-close>Back</button></div><div class="sheet-content">${content}</div><p class="sheet-status" role="status"></p>`;
  sheet = d;
  modal = kind;
  document.body.append(d);
  d.querySelector('[data-close]')?.addEventListener('click', () => closeSheet());
  d.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSheet();
  });
  d.addEventListener('close', () => {
    if (origin?.isConnected) origin.focus();
    else {
      const replacement = [...root.querySelectorAll<HTMLElement>('button')].find((b) =>
        originGroups
          ? b.dataset.cityGroup?.split(',').some((id) => originGroups.split(',').includes(id))
          : originAction
            ? b.dataset.action === originAction
            : (b.getAttribute('aria-label') ?? b.textContent) === originLabel,
      );
      replacement?.focus({ preventScroll: true });
    }
  });
  d.addEventListener('click', handleClick);
  d.showModal();
  gloss(d);
  if (kind === 'menu') setScreen('menu');
  return d;
}
function menu(): void {
  const d = openSheet(
    'Game menu',
    `${state ? '<button type="button" data-action="save">Save</button><button type="button" data-action="download">Download this run</button><button type="button" data-action="send-run">Send this run to the notebook</button>' : ''}<button type="button" data-action="import">Import a run</button><label>Page theme <select data-theme aria-label="Page theme"><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label><details data-glossary><summary>Setting words</summary></details><a href="${ALL_GAMES}">All games</a><a href="https://human.adamwhite.work/lab/privacy/" target="_blank" rel="noreferrer">Lab privacy</a>`,
    'menu',
  );
  d.querySelector('[data-glossary]')?.append(glossaryPanel());
  const select = d.querySelector<HTMLSelectElement>('[data-theme]');
  if (select) {
    select.value = document.documentElement.dataset.theme ?? 'system';
    select.onchange = () => {
      if (select.value === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = select.value;
      redraw();
    };
  }
}
function redraw(): void {
  if (playing) render(true);
}
function referenceSheet(): void {
  const c = candidate(current());
  if (!c) return;
  const d = openSheet(
    `Call a reference · ${c.name}`,
    `<p>About 15 minutes on the telephone.</p>${c.referees.map((r) => `<div class="reference-option"><button type="button" data-referee="${h(r.id)}" ${!r.reachable ? 'disabled' : ''}>Call ${h(r.name)}${r.called ? ' again' : ''}</button><p data-referee-reason="${h(r.id)}">${r.reachable ? 'Reachable now' : h(r.why ?? 'Not reachable now. Try later.')}</p></div>`).join('') || '<p>No referee yet. Ask about her last family in the interview.</p>'}`,
  );
  updateInspection = () => {
    const latest = candidates(current()).find((p) => p.id === c.id);
    for (const referee of latest?.referees ?? []) {
      const b = [...d.querySelectorAll<HTMLButtonElement>('[data-referee]')].find(
        (b) => b.dataset.referee === referee.id,
      );
      const reason = [...d.querySelectorAll<HTMLElement>('[data-referee-reason]')].find(
        (el) => el.dataset.refereeReason === referee.id,
      );
      const busy = latest ? candidateAvailability(latest) : 'She is no longer on your books.';
      if (b) b.disabled = !referee.reachable || !!busy;
      if (reason)
        reason.textContent =
          busy ?? (referee.reachable ? 'Reachable now' : (referee.why ?? 'Not reachable now. Try later.'));
    }
  };
}
function familySheet(id: string): void {
  const v = current(),
    f = v.families.find((f) => f.id === id);
  if (!f) return;
  openSheet(
    f.name,
    `<p>${h(f.district)} · ${h(f.trust)}</p>${f.household.map((p) => `<p>${h(p.name)} · ${h(p.who)}</p>`).join('')}${f.line ? `<p class="speech">“${h(f.line)}”</p>` : ''}${v.requests
      .filter((r) => r.family === id)
      .map((r) => `<p>“${h(r.wants)}”</p><p>${money(r.wage)} a month · by ${h(r.byLabel)} · ${r.status}</p>`)
      .join('')}<button type="button" data-action="choose-worker">Choose a worker from the bench</button>`,
  );
}
function matchSheet(kind: 'trial' | 'place'): void {
  const v = current(),
    c = candidate(v);
  if (!c) return;
  const requests = v.requests.filter((r) => r.status === 'open');
  const d = openSheet(
    kind === 'trial' ? 'Send for a trial morning' : `Vouch for ${c.name}`,
    `<p ${kind === 'place' ? 'data-fee-terms' : ''}>${kind === 'trial' ? 'She will spend the next morning with the family. Their word comes back later.' : 'The family pays one week’s wage as a deposit now; the rest of the fee after the trial week if they keep her. They will remember what you vouch for.'}</p><label>Family <select aria-label="Family" data-match-family>${requests.map((r) => `<option value="${h(r.family)}">${h(person(v, r.family))} · ${h(r.role)}</option>`).join('')}</select></label>${!requests.length ? '<p>No open request. Answer a family’s call first.</p>' : ''}${kind === 'place' ? `<fieldset><legend>What will you put your word behind?</legend><div class="vouch-controls">${QUALITIES.map((q) => `<button type="button" class="vouch" data-vouch="${q}" aria-pressed="false">${h(vouchLabel(c, q))}</button>`).join('')}</div><details class="vouch-evidence"><summary>Read the evidence</summary>${QUALITIES.map((q) => `<p><strong>${q}</strong> — ${h(evidence(c, q))}</p>`).join('')}</details></fieldset>` : ''}<p data-match-reason class="reason"></p><button type="button" data-confirm-match ${!requests.length ? 'disabled' : ''}>${kind === 'trial' ? 'Send for a trial' : 'Place with this family'}</button>`,
  );
  const select = d.querySelector<HTMLSelectElement>('[data-match-family]'),
    confirm = d.querySelector<HTMLButtonElement>('[data-confirm-match]');
  const update = () => {
    const live = current();
    const request = live.requests.find((r) => r.status === 'open' && r.family === select?.value);
    const liveCandidate = candidates(live).find((p) => p.id === c.id) ?? c;
    const refusal =
      candidateAvailability(liveCandidate) ??
      liveCandidate.refuses?.find((r) => r.family === select?.value)?.words ??
      (!request ? 'This request is no longer open. Choose another family or answer the phone.' : undefined);
    const reason =
      refusal ??
      (request && !c.roles.includes(request.role)
        ? `She is looking for ${c.roles.join(' or ')} work. This family needs a ${request.role}.`
        : undefined);
    const line = d.querySelector('[data-match-reason]');
    if (line) line.textContent = reason ?? '';
    const terms = d.querySelector('[data-fee-terms]');
    if (terms)
      terms.textContent = `${live.placements.some((p) => p.family === select?.value) ? 'The earlier deposit covers this replacement.' : 'The family pays one week’s wage as a deposit now.'} The rest of the fee follows the trial week if they keep her. They will remember what you vouch for.`;
    if (confirm) confirm.disabled = !request || !!reason;
  };
  for (const toggle of d.querySelectorAll<HTMLButtonElement>('[data-vouch]')) {
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true'));
    });
  }
  select?.addEventListener('change', update);
  updateInspection = update;
  update();
  confirm?.addEventListener('click', () => {
    const family = select?.value;
    if (!family) return;
    const vouch = [...d.querySelectorAll<HTMLButtonElement>('[data-vouch][aria-pressed="true"]')].map(
      (toggle) => toggle.dataset.vouch as Quality,
    );
    closeSheet(false);
    send(
      kind === 'trial'
        ? { type: 'trial', candidate: c.id, family }
        : { type: 'place', candidate: c.id, family, vouch },
    );
  });
}
function placementSheet(id: string): void {
  const v = current(),
    p = v.placements.find((p) => p.id === id);
  if (!p) return;
  const d = openSheet(
    `${person(v, p.candidate)} at ${person(v, p.family)}`,
    `<p>${h(p.lastWord ?? 'No word yet.')}</p>${p.arrangement ? `<p>${h(p.arrangement)}</p>` : ''}${p.pending ? `<p>${h(p.pending.dateLabel)}: ${h(p.pending.text)}</p>` : ''}<p data-check-reason class="reason"></p><button type="button" data-check="phone" data-placement-id="${h(id)}">Phone the family<small>About 15 minutes</small></button><button type="button" data-check="visit" data-placement-id="${h(id)}">Visit the house<small>An hour, plus the ferry or road</small></button><button type="button" data-check="drop-by" data-placement-id="${h(id)}">Ask the worker to drop by<small>After work</small></button><details><summary>Bring her back</summary><p>She will leave this house and return to your books. The family loses its worker.</p><button type="button" data-withdraw="${h(id)}">Withdraw this worker</button></details>`,
  );
  updateInspection = () => {
    const live = current();
    const placement = live.placements.find((entry) => entry.id === id);
    const reason =
      !placement || !['trial', 'kept'].includes(placement.status)
        ? 'This placement has ended.'
        : placement.checkInAt !== undefined && live.now < placement.checkInAt
          ? `No new answer yet. Check again ${clockLabels(placement.checkInAt).dateLabel}, ${clockLabels(placement.checkInAt).timeLabel}.`
          : '';
    const line = d.querySelector('[data-check-reason]');
    if (line) line.textContent = reason;
    for (const control of d.querySelectorAll<HTMLButtonElement>('[data-check]')) control.disabled = !!reason;
  };
  updateInspection();
}
function importFile(): void {
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.onchange = async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      if (chosen.size > 20 * 1024 * 1024)
        throw new Error('This run is too large. Choose a JSON run below 20 MB.');
      const run = verifyImport(await chosen.text());
      closeSheet(false);
      begin(run.state, run.inputs);
      notice = 'Imported this run. The clock resumes from its saved minute.';
      showNotice();
    } catch (e) {
      const line = sheet?.querySelector('.sheet-status');
      if (line) line.textContent = e instanceof Error ? e.message : 'This run could not be imported.';
    }
  };
  file.click();
}
function task(): void {
  const v = current(),
    target = v.task.target;
  if (v.scene) {
    root.querySelector<HTMLElement>('[data-testid="scene-choice"]')?.focus();
    return;
  }
  if (!target) {
    if (v.bench[0]) selectCandidate(v.bench[0].id);
    return;
  }
  if (target.kind === 'candidate') selectCandidate(target.id);
  else if (target.kind === 'phone') send({ type: 'answer-phone' });
  else if (target.kind === 'family') {
    tab = 'Families';
    city = false;
    render(true);
    familySheet(target.id);
  } else if (target.kind === 'placement') placementSheet(target.id);
}
function handleClick(event: Event): void {
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b || b.disabled || waitAnimation) return;
  const v = state ? current() : null;
  if (b.dataset.cityFigure) {
    cityPerson = b.dataset.cityFigure;
    closeSheet(false);
    render(true);
    return;
  }
  if (b.dataset.candidate) {
    closeSheet(false);
    selectCandidate(b.dataset.candidate);
    return;
  }
  if (b.dataset.family) {
    familySheet(b.dataset.family);
    return;
  }
  if (b.dataset.placement) {
    placementSheet(b.dataset.placement);
    return;
  }
  if (b.dataset.tab) {
    tab = b.dataset.tab as typeof tab;
    selected = null;
    city = false;
    render(true);
    return;
  }
  if (b.dataset.choice && v?.scene) {
    send({ type: 'choose', scene: v.scene.id, choice: b.dataset.choice });
    return;
  }
  if (b.dataset.referee && selected) {
    closeSheet(false);
    send({ type: 'call-reference', candidate: selected, referee: b.dataset.referee });
    return;
  }
  if (b.dataset.check && b.dataset.placementId) {
    closeSheet(false);
    send({
      type: 'check-in',
      placement: b.dataset.placementId,
      how: b.dataset.check as 'phone' | 'visit' | 'drop-by',
    });
    return;
  }
  if (b.dataset.withdraw) {
    closeSheet(false);
    send({ type: 'withdraw', placement: b.dataset.withdraw });
    return;
  }
  switch (b.dataset.action) {
    case 'wait-for':
      send({ type: 'wait-for' });
      break;
    case 'more-questions':
      questionPage++;
      render(true);
      root.querySelector<HTMLElement>('[data-testid="scene-choice"]')?.focus({ preventScroll: true });
      break;
    case 'menu':
      menu();
      break;
    case 'new-month':
      title();
      newMonth();
      break;
    case 'phone':
      send({ type: 'answer-phone' });
      break;
    case 'task':
      task();
      break;
    case 'city':
      city = !city;
      render(true);
      break;
    case 'interview':
      if (selected) send({ type: 'interview', candidate: selected });
      break;
    case 'take-number':
      if (selected) send({ type: 'take-number', candidate: selected });
      break;
    case 'references':
      referenceSheet();
      break;
    case 'trial':
      matchSheet('trial');
      break;
    case 'place':
      matchSheet('place');
      break;
    case 'leave-scene':
      if (v?.scene) send({ type: 'close-scene', scene: v.scene.id });
      break;
    case 'sleep':
      send({ type: 'sleep' });
      break;
    case 'choose-worker':
      closeSheet(false);
      selected = null;
      tab = 'Bench';
      city = false;
      render(true);
      break;
    case 'all-cards':
      if (v)
        openSheet(
          'Cards on the books',
          candidates(v)
            .map(
              (c) =>
                `<button type="button" data-candidate="${h(c.id)}">${h(c.name)} · ${h(c.busy ?? c.status)}</button>`,
            )
            .join(''),
        );
      break;
    case 'download':
      if (state) downloadJson('goodhands-run.json', exportRun(state, inputs));
      break;
    case 'save':
      if (state) {
        void put('run', exportRun(state, inputs)).then((ok) => {
          const line = sheet?.querySelector('.sheet-status');
          if (line)
            line.textContent = ok
              ? 'Saved this month.'
              : 'This browser could not save. Download this run instead.';
        });
      }
      break;
    case 'send-run':
      if (state) {
        const run = exportRun(state, inputs);
        closeSheet();
        lab.openSendDialog({ getRun: () => run, ...notebookRunOptions });
      }
      break;
    case 'import':
      importFile();
      break;
    case 'terms': {
      const d = openSheet('Setting words', '');
      d.querySelector('.sheet-content')?.append(glossaryPanel());
      break;
    }
  }
}
function gloss(element: HTMLElement): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (
      !n.parentElement?.closest('button, a, option, .lk-term, script, style') &&
      /\b(Hanım|Bey|abla|Kültürpark|Alsancak|Karşıyaka|lira)\b/u.test(n.data)
    )
      nodes.push(n);
  }
  for (const n of nodes) {
    const fragment = document.createDocumentFragment();
    for (const part of n.data.split(/(Hanım|Bey|abla|Kültürpark|Alsancak|Karşıyaka|lira)/u))
      fragment.append(Object.hasOwn(TERMS, part) ? term(part) : document.createTextNode(part));
    n.replaceWith(fragment);
  }
}
root.addEventListener('click', handleClick);
function frame(now: number): void {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.5);
  last = now;
  if (playing && state && !document.hidden && modal !== 'menu') {
    const v = current();
    if (waitAnimation) {
      if (now >= waitAnimation.end) {
        waitAnimation = null;
        render(true);
      } else render();
    } else if (!v.ended && !v.dayCard) {
      const previous = structuredClone(v);
      state = sim.advance(state, (SPEEDS[v.slowed ? 0 : v.speed] ?? 2) * dt);
      changed(previous, current());
      const hour = Math.floor(current().now / 60);
      if (hour !== lastHour) {
        lastHour = hour;
        save();
      }
      render();
    }
  }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden && state) {
    putNow('run', exportRun(state, inputs));
    lab.flush();
  }
});
window.addEventListener('pagehide', () => {
  if (state) putNow('run', exportRun(state, inputs));
});
window.addEventListener('resize', redraw);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
title();
void get<RunExport>('run').then((row) => {
  if (row) {
    try {
      saved = verifyImport(JSON.stringify(row.value));
    } catch {
      saved = null;
    }
  }
  saveReady = true;
  if (!playing && !sheet) title();
});
requestAnimationFrame(frame);
