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
import { drawCity } from './map.ts';
import { drawOffice, officeSeats } from './office.ts';
import {
  candidateAvailability,
  evidence,
  escapeHtml as h,
  INTRO,
  money,
  noteText,
  placementLabel,
  resumeLine,
  SPEED_NAMES,
  speedLabel,
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
let last = performance.now();
let shown = '';
let lastHour = -1;
let sheet: HTMLDialogElement | null = null;
let modal = '';
let updateInspection: (() => void) | null = null;
let screen = '';
let notice = '';
let questionPage = 0;
let questionScene = '';
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
  if (!state) return;
  const at = current().now;
  const previous = structuredClone(current());
  state = sim.apply(state, input);
  inputs.push({ at, input: structuredClone(input) });
  changed(previous, current());
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
  render(true);
  save();
}
function shell(v: View): void {
  root.innerHTML = `<main class="game" data-testid="office"><header class="topbar"><a class="hub" href="${ALL_GAMES}" aria-label="human framework games">◇ human framework</a><button type="button" data-action="menu">Game menu</button><div class="clock"><span data-date></span> <strong data-time></strong></div><label class="speed-control">Clock <select aria-label="Clock speed">${SPEED_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select></label><p class="speed-status" data-speed></p></header><div class="room"><canvas id="office" role="img" aria-label="Nermin’s desk, telephone, window and the waiting bench"></canvas><div class="seat-targets"></div><button class="phone-control" type="button" data-action="phone"></button></div><button class="task now" type="button" aria-label="Task" data-testid="task" data-action="task"><strong>Task</strong><span></span></button><nav class="bench-strip" aria-label="Waiting bench" data-testid="bench"></nav><div data-content></div><p class="status" role="status" data-status></p><footer><span data-money></span><a href="${ALL_GAMES}">All games</a></footer></main>`;
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
  text('[data-speed]', speedLabel(v));
  const select = root.querySelector<HTMLSelectElement>('select');
  if (select && document.activeElement !== select) select.value = String(v.speed);
  text('[data-money]', `${money(v.cash)} · Rent ${money(v.rent.amount)} ${v.rent.label}`);
}
function render(force = false): void {
  if (!state || !playing) return;
  const v = current();
  if (v.ended && v.review) {
    if (force || shown !== 'review') review(v);
    return;
  }
  if (!root.querySelector('.game')) shell(v);
  updateClock(v);
  const signature = JSON.stringify([
    v.task,
    v.phoneRinging,
    v.bench,
    v.books,
    v.requests,
    v.families,
    v.placements,
    v.scene,
    v.dayCard,
    city ? v.city : null,
    selected,
    tab,
    city,
    v.open,
  ]);
  if (!force && shown === signature) return;
  if (v.scene && sheet && modal !== 'menu') closeSheet(false);
  updateInspection?.();
  shown = signature;
  const active =
    document.activeElement instanceof HTMLButtonElement && root.contains(document.activeElement)
      ? document.activeElement
      : null;
  const activeLabel = active?.getAttribute('aria-label') ?? active?.textContent;
  root.querySelector('.game')?.classList.toggle('has-scene', !!v.scene);
  root.querySelector('.game')?.classList.toggle('has-day-card', !!v.dayCard);
  const task = root.querySelector<HTMLElement>('.task span');
  if (task) task.textContent = v.task.text;
  const phone = root.querySelector<HTMLButtonElement>('.phone-control');
  if (phone) {
    phone.textContent = v.phoneRinging ? `Answer phone · ${v.phoneRinging.who}` : 'Telephone';
    phone.hidden = !v.phoneRinging;
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
  if (v.scene) {
    content.innerHTML = sceneHtml(v);
    setScreen(sheet ? 'menu' : 'scene');
  } else if (v.dayCard) {
    content.innerHTML = dayHtml(v);
    setScreen('office');
  } else {
    content.innerHTML = `<nav class="tabs" aria-label="Agency books">${(['Bench', 'Families', 'Placed'] as const).map((t) => `<button type="button" data-tab="${t}" aria-pressed="${!city && tab === t}">${t}</button>`).join('')}<button type="button" data-action="city" aria-pressed="${city}">City</button></nav><section class="desk-content">${city ? cityHtml(v) : tab === 'Bench' ? benchHtml(v) : tab === 'Families' ? familiesHtml(v) : placedHtml(v)}</section>`;
    if (city) {
      const canvas = content.querySelector<HTMLCanvasElement>('#city');
      if (canvas) drawCity(canvas, v);
    }
    setScreen(sheet ? 'menu' : city ? 'city' : 'office');
  }
  gloss(content);
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
  return `<article class="candidate-card"><div class="card-heading"><h2>${h(c.name)}</h2><span>${h(c.roles.join(' / '))}</span></div><p class="look">${h(c.look)}</p><div class="candidate-actions">${action('Interview', 'interview', unavailable, 'About 30 minutes')}${action('Call a reference', 'references', unavailable, 'About 15 minutes')}${action('Send for a trial', 'trial', unavailable, 'Her next morning away')}${action('Place', 'place', unavailable, 'Choose what to vouch for')}</div>${reason}<details class="notes-details"><summary>Nermin’s notes · ${c.wage === null ? 'Wage not yet asked' : `${money(c.wage)} a month`}</summary><div class="handwritten">${QUALITIES.map(
    (q) =>
      `<p><strong>${q}</strong> ${
        c.notes
          .filter((n) => n.quality === q)
          .map(
            (n) =>
              `<span class="note ${n.crossedOut ? 'crossed-out' : ''}">${h(n.phrase)} <small>${n.source} · ${h(n.from)}</small></span>`,
          )
          .join('') || '<span class="unknown">not asked yet</span>'
      }</p>`,
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
          `<article class="placement-card"><h2>${h(person(v, p.candidate))} · ${h(person(v, p.family))}</h2><p>${placementLabel(p)}</p><p>${h(p.lastWord ?? 'No word from the house yet.')}</p>${['trial', 'kept'].includes(p.status) ? `<button type="button" data-placement="${h(p.id)}">Check in or withdraw</button>` : ''}</article>`,
      )
      .join('') || '<p>No one placed yet. Your word will go with them.</p>'
  );
}
function sceneHtml(v: View): string {
  const s = v.scene;
  if (!s) return '';
  const recentSpeech = s.lines.findLast((l) => l.kind === 'speech');
  const lastLine = recentSpeech ?? s.lines.at(-1);
  const lastNotice = s.lines.at(-1)?.kind === 'notice' ? s.lines.at(-1) : undefined;
  const finish = s.canLeave ? s.choices.find((c) => /^Finish/.test(c.label) && !c.disabled) : undefined;
  if (questionScene !== s.id) {
    questionScene = s.id;
    questionPage = 0;
  }
  const available = s.choices.filter((c) => c !== finish);
  const questions = s.kind === 'interview' ? available.filter((c) => c.label !== 'Coach her') : [];
  const sharedHint =
    questions.length && questions.every((c) => c.hint === questions[0]?.hint)
      ? questions[0]?.hint
      : undefined;
  const pages = Math.ceil(questions.length / 2);
  const choices =
    questions.length > 2
      ? [
          ...questions.slice((questionPage % pages) * 2, ((questionPage % pages) + 1) * 2),
          ...available.filter((c) => c.label === 'Coach her'),
        ]
      : available;
  return `<section class="scene-sheet" data-testid="scene" aria-label="${h(s.title)}"><div class="sheet-heading"><h2>${h(s.title)}</h2>${finish ? `<button type="button" data-choice="${h(finish.id)}">${h(finish.label)}</button>` : s.canLeave ? '<button type="button" data-action="leave-scene">Finish</button>' : ''}</div><div class="exchange">${lastLine ? `<p class="${lastLine.kind === 'speech' ? 'speech' : ''}">${lastLine.speaker ? `<strong>${h(lastLine.speaker)}:</strong> ` : ''}${h(lastLine.text)}</p>` : ''}${lastNotice && lastNotice !== lastLine ? `<p class="notice-line">${h(lastNotice.text)}</p>` : ''}${
    s.lines.length > 1
      ? `<details><summary>Earlier words</summary>${s.lines
          .slice(0, -1)
          .map(
            (l) =>
              `<p class="${l.kind === 'speech' ? 'speech' : ''}">${l.speaker ? `<strong>${h(l.speaker)}:</strong> ` : ''}${h(l.text)}</p>`,
          )
          .join('')}</details>`
      : ''
  }</div>${
    s.added?.length
      ? `<p class="added" role="status">Added to her card: ${s.added
          .filter((n) => !n.crossedOut)
          .map((n) => `${h(n.quality)} · ${n.source}`)
          .join('; ')}</p>`
      : ''
  }${sharedHint ? `<p class="question-cost">${h(sharedHint)} per question.</p>` : ''}<div class="scene-choices">${choices.map((c) => `<div class="choice"><button type="button" data-testid="scene-choice" data-choice="${h(c.id)}" ${c.disabled ? 'disabled' : ''}>${h(c.label)}${c.hint && !(sharedHint && questions.includes(c)) ? `<small>${h(c.hint)}</small>` : ''}</button>${c.disabled ? `<p class="reason">${h(c.disabled)}</p>` : ''}</div>`).join('')}${questions.length > 2 ? '<button type="button" data-action="more-questions">Other questions</button>' : ''}</div></section>`;
}
function dayHtml(v: View): string {
  const d = v.dayCard;
  if (!d) return '';
  return `<section class="day-card"><h2>${h(d.dateLabel)} · Office closed</h2>${d.lines.map((l) => `<p>${h(l)}</p>`).join('')}<p class="tomorrow">${h(d.tomorrow)}</p><button type="button" data-action="sleep">Sleep</button></section>`;
}
function cityHtml(v: View): string {
  return `<h2>The city</h2><canvas id="city" role="img" aria-label="Izmir across the bay: Alsancak, Karşıyaka, Bornova, Göztepe and Buca; houses, workers and threads of talk"></canvas><p class="map-key">Houses are families. Figures are people. Lines show talk that has happened.</p>${v.city.threads
    .slice(-3)
    .map((t) => `<p>${h(person(v, t.from))} spoke with ${h(person(v, t.to))} · ${h(t.place)}</p>`)
    .join('')}`;
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
    else root.querySelector<HTMLElement>('[data-action="menu"]')?.focus({ preventScroll: true });
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
    `<p>${kind === 'trial' ? 'She will spend the next morning with the family. Their word comes back later.' : 'Half the fee is paid on placement; the rest if the family keeps her through the trial week. The family will remember what you vouch for.'}</p><label>Family <select aria-label="Family" data-match-family>${requests.map((r) => `<option value="${h(r.family)}">${h(person(v, r.family))} · ${h(r.role)}</option>`).join('')}</select></label>${!requests.length ? '<p>No open request. Answer a family’s call first.</p>' : ''}${kind === 'place' ? `<fieldset><legend>What will you put your word behind?</legend>${QUALITIES.map((q) => `<label class="vouch"><input type="checkbox" value="${q}" name="vouch"><span><strong>${q}</strong><small>${h(evidence(c, q))}</small></span></label>`).join('')}</fieldset>` : ''}<p data-match-reason class="reason"></p><button type="button" data-confirm-match ${!requests.length ? 'disabled' : ''}>${kind === 'trial' ? 'Send for a trial' : 'Place with this family'}</button>`,
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
    if (confirm) confirm.disabled = !request || !!reason;
  };
  select?.addEventListener('change', update);
  updateInspection = update;
  update();
  confirm?.addEventListener('click', () => {
    const family = select?.value;
    if (!family) return;
    const vouch = [...d.querySelectorAll<HTMLInputElement>('input[name="vouch"]:checked')].map(
      (i) => i.value as Quality,
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
  openSheet(
    `${person(v, p.candidate)} at ${person(v, p.family)}`,
    `<p>${h(p.lastWord ?? 'No word yet.')}</p><button type="button" data-check="phone" data-placement-id="${h(id)}">Phone the family<small>About 15 minutes</small></button><button type="button" data-check="visit" data-placement-id="${h(id)}">Visit the house<small>An hour, plus the ferry or road</small></button><button type="button" data-check="drop-by" data-placement-id="${h(id)}">Ask the worker to drop by<small>After work</small></button><details><summary>Bring her back</summary><p>She will leave this house and return to your books. The family loses its worker.</p><button type="button" data-withdraw="${h(id)}">Withdraw this worker</button></details>`,
  );
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
  if (!b || b.disabled) return;
  const v = state ? current() : null;
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
    if (!v.ended && !v.dayCard) {
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
