import '@adam0white/lab-kit/stage.css';
import {
  defineTerms,
  downloadJson,
  glossaryPanel,
  introCard,
  type PhoneStage,
  phoneStage,
  term,
} from '@adam0white/lab-kit';
import * as sim from '../sim/index.ts';
import { validTerms } from '../sim/negotiation.ts';
import {
  type CandidateView,
  type EmploymentTerms,
  type HouseholdTopic,
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
  matchingReason,
  money,
  noteText,
  phoneAvailability,
  placementLabel,
  referenceReason,
  requestGroups,
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
let stage: PhoneStage | null = null;
const sheetOrigins: { node: HTMLDialogElement; kind: string; inspection: (() => void) | null }[] = [];
let modal = '';
let updateInspection: (() => void) | null = null;
let screen = '';
let notice = '';
let waitAnimation: { before: View; start: number; end: number; label: string } | null = null;
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
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
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
    if (b) {
      b.textContent = 'Open the office';
      // The kit's close event runs later. Render while the click still owns the screen.
      b.addEventListener('click', start);
    }
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
  notice = '';
  render(true);
  save();
}
function shell(v: View): void {
  stage?.destroy();
  root.innerHTML = `<main class="game lk-stage" data-sheet="fit" data-testid="office"><header class="lk-strip"><div class="topbar"><a class="hub" href="${ALL_GAMES}" aria-label="human framework games">◇ human framework</a><button type="button" data-action="menu">Game menu</button></div><div class="lk-chips"><span class="lk-chip clock"><span data-date></span> <strong data-time></strong></span><button type="button" data-action="time" data-speed class="speed-summary"></button><span class="lk-chip" data-money></span><span class="lk-chip" data-waiting></span></div><button class="task now" type="button" aria-label="Task" data-testid="task" data-action="task"><strong>Task</strong><span></span></button></header><section class="office-front lk-scene" aria-label="The office"><div class="room"><canvas id="office" role="img" aria-label="Nermin’s desk, telephone, window and the waiting bench"></canvas><div class="seat-targets"></div></div><div class="phone-strip" hidden><button class="phone-control" type="button" data-action="phone"></button><p id="phone-reason" class="phone-reason reason"></p></div><nav class="bench-strip" aria-label="Waiting bench" data-testid="bench"></nav></section><section class="desk-sheet lk-sheet" data-content aria-label="Nermin’s desk"></section></main>`;
  stage = phoneStage(root.querySelector<HTMLElement>('.lk-stage')!, {
    observeOnly: true,
    onSceneRect: () => {
      if (state && playing)
        drawOffice(root.querySelector<HTMLCanvasElement>('#office')!, current(), selected);
    },
  });
  updateClock(v);
}
function updateClock(v: View): void {
  const text = (selector: string, value: string) => {
    const el = root.querySelector(selector);
    if (el && el.textContent !== value) el.textContent = value;
  };
  text('[data-date]', v.dateLabel);
  text('[data-time]', v.timeLabel);
  text('[data-speed]', waitAnimation ? 'Waiting fast' : v.slowed ? 'Slow ↓' : SPEED_NAMES[v.speed]);
  root.querySelector('[data-speed]')?.setAttribute('aria-label', `${speedLabel(v)}. Change clock speed`);
  root.querySelector('.game')?.setAttribute('aria-busy', String(!!waitAnimation));
  const wait = root.querySelector<HTMLButtonElement>('[data-action="wait-for"]');
  if (wait) {
    wait.disabled = !!waitAnimation;
    wait.hidden = !v.next || v.slowed || !!v.scene || !!v.phoneRinging || !!v.dayCard;
    wait.textContent = v.next ? `Wait for ${v.next.label} · ${v.next.dateLabel}` : '';
  }
  for (const speed of root.querySelectorAll<HTMLButtonElement>('[data-speed-choice]')) {
    speed.disabled = !!waitAnimation;
    speed.setAttribute('aria-pressed', String(Number(speed.dataset.speedChoice) === v.speed));
  }
  text('[data-money]', `${money(v.cash)} · Rent ${money(v.rent.amount)} ${v.rent.label}`);
  text(
    '[data-waiting]',
    `${v.bench.length} waiting${v.books.filter((c) => c.arrival).length ? ` · ${v.books.filter((c) => c.arrival).length} coming` : ''}`,
  );
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
  const basePanel = root.querySelector<HTMLElement>('[data-content]');
  if (basePanel) basePanel.hidden = !!sheet;
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
  root.querySelector('.game')?.classList.toggle('has-interview', v.scene?.kind === 'interview');
  root.querySelector('.game')?.classList.toggle('has-ringing-phone', !!v.phoneRinging);
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
    const strip = root.querySelector<HTMLElement>('.phone-strip');
    if (strip) strip.hidden = !v.phoneRinging;
    phone.setAttribute('aria-describedby', 'phone-reason');
    const reason = phoneAvailability(v);
    phone.disabled = !!reason;
    const line = root.querySelector<HTMLElement>('.phone-reason');
    if (line) line.textContent = v.phoneRinging ? (reason ?? '') : '';
  }
  drawOffice(root.querySelector<HTMLCanvasElement>('#office') as HTMLCanvasElement, v, selected);
  const targets = root.querySelector('.seat-targets');
  targets?.replaceChildren();
  for (const seat of officeSeats(v)) {
    const c = v.bench.find((c) => c.id === seat.id);
    if (!c) continue;
    const b = button('', () => selectCandidate(c.id), 'seat-target');
    if (
      seat.width * (root.querySelector<HTMLCanvasElement>('#office')?.clientWidth ?? 336) < 44 ||
      (root.querySelector<HTMLCanvasElement>('#office')?.clientHeight ?? 0) < 100
    )
      continue;
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
  const oldChoices = content.querySelector<HTMLElement>('.scene-choices');
  const choicesScroll = oldChoices?.scrollTop ?? 0;
  const oldSceneId = content.querySelector<HTMLElement>('[data-scene-id]')?.dataset.sceneId;
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
    content.innerHTML = `<nav class="tabs lk-sheet-head" aria-label="Agency books">${(['Bench', 'Families', 'Placed'] as const).map((t) => `<button type="button" data-tab="${t}" aria-pressed="${!city && tab === t}">${t}</button>`).join('')}<button type="button" data-action="city" aria-pressed="${city}">City</button></nav><section class="desk-content lk-sheet-body"><p class="status" role="status" data-status></p>${city ? cityHtml(v) : tab === 'Bench' ? benchHtml(v) : tab === 'Families' ? familiesHtml(v) : placedHtml(v)}</section>`;
    if (city) updateCity(v);
    setScreen(sheet ? 'menu' : city ? 'city' : 'office');
  }
  gloss(content);
  const choices = content.querySelector<HTMLElement>('.scene-choices');
  if (choices && oldSceneId === v.scene?.id) choices.scrollTop = choicesScroll;
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
  stage?.refresh();
}
function selectCandidate(id: string): void {
  closeSheet(false);
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
  const interviewLimit =
    c.interviewUnavailable ??
    (c.interviewAfter
      ? `Call ${c.name} back after ${clockLabels(c.interviewAfter).dateLabel}, ${clockLabels(c.interviewAfter).timeLabel}.`
      : undefined);
  const reason =
    unavailable || interviewLimit ? `<p class="reason">${h(unavailable ?? interviewLimit!)}</p>` : '';
  const card = `<article class="candidate-card"><div class="card-heading"><h2>${h(c.name)}</h2><span>${h(c.roles.join(' / '))}</span></div><p class="look">${h(c.look)}</p>${c.arrival ? `<p>${h(c.name)} is coming · ${h(c.arrival.dateLabel)}</p>` : ''}${state?.version !== 3 ? '<p class="reason">This month uses earlier rules. Start a new month for office visits and negotiated placements.</p>' : ''}<div class="candidate-actions">${action('Interview', 'interview', unavailable ?? interviewLimit, 'About 30 minutes')}${state?.version === 3 && c.presence === 'home' ? action('Call in to the office', 'call-in', unavailable, 'Ask them to come; travel takes time') : ''}${action(state?.version === 3 ? 'Negotiate placement' : 'Place', 'place', unavailable, state?.version === 3 ? 'Agree the terms with both sides' : 'Choose what to vouch for')}${c.status === 'bench' ? action('Take her number', 'take-number', unavailable, '2 min · goes home; keep contact') : ''}${action('Other actions', 'candidate-actions', undefined, 'References and trial mornings')}</div>${reason}${c.wants ? `<p class="candidate-wants handwritten">Needs: ${h(c.wants)}</p>` : ''}<details class="notes-details"><summary>Nermin’s notes · ${c.wage === null ? 'Wage not yet asked' : `${money(c.wage)} a month`}</summary><div class="card-notes">${QUALITIES.map(
    (q) => {
      const notes = c.notes.filter((n) => n.quality === q);
      const read = notes.findLast((n) => !n.crossedOut) ?? notes.at(-1);
      return `<section class="quality-note"><h3>${q}</h3><p class="nermin-read handwritten">${read ? h(read.phrase) : 'Not asked yet.'}</p>${notes.map((n) => `<p class="note ${n.crossedOut ? 'crossed-out' : ''}"><small>${h(n.from)} · ${n.source}</small><span class="note-claim">${h(n.claim ?? n.phrase)}</span></p>`).join('')}</section>`;
    },
  ).join(
    '',
  )}</div><h3>Experience</h3>${c.experience.length ? c.experience.map((e) => `<p>${h(e)}</p>`).join('') : '<p>She has not told you yet.</p>'}<h3>Referees</h3>${c.referees.map((r) => `<p>${h(r.name)} · ${r.reachable ? 'reachable' : h(r.why ?? 'Not reachable now; try later')}${r.called ? ' · already called' : ''}</p>`).join('') || '<p>No referee yet. Ask in the interview.</p>'}</details><button type="button" data-action="all-cards">Your books</button></article>`;
  const extra = card.indexOf('<p class="candidate-wants');
  const notes = extra >= 0 ? extra : card.indexOf('<details class="notes-details');
  return `${card.slice(0, notes)}<button type="button" data-action="candidate-notes">Notes, needs and your books</button></article>`;
}
function action(label: string, key: string, disabled?: string, hint?: string): string {
  return `<button type="button" data-action="${key}" ${disabled ? 'disabled' : ''}><span>${h(label)}</span>${hint ? `<small>${h(hint)}</small>` : ''}</button>`;
}
function familiesHtml(v: View): string {
  const { open, lost } = requestGroups(v.requests);
  const active =
    open
      .map(
        (r) =>
          `<article class="family-card"><h2>${h(person(v, r.family))}</h2><p>“${h(r.wants)}”</p><p>${h(r.role)} · ${money(r.wage)} a month</p><p class="deadline">By ${h(r.byLabel)}</p><button type="button" data-family="${h(r.family)}">${h(person(v, r.family).replace(/^the /, 'The '))}: household and request</button></article>`,
      )
      .join('') || '<p>No open requests. Current placements are in Placed.</p>';
  return (
    active +
    (lost.length
      ? `<details class="lost-requests"><summary>Lost requests · ${lost.length}</summary>${lost.map((r) => `<p>${h(person(v, r.family))} — ${h(r.lostReason ?? 'The family went elsewhere.')}</p>`).join('')}</details>`
      : '')
  );
}
function placedHtml(v: View): string {
  return (
    v.placements
      .map(
        (p) =>
          `<article class="placement-card"><h2>${h(person(v, p.candidate))} · ${h(person(v, p.family))}</h2><p>${placementLabel(p)}</p>${p.arrangement ? `<p class="placement-arrangement">${h(p.arrangement)}</p>` : ''}${p.pending ? `<p class="placement-pending">${h(p.pending.dateLabel)}: ${h(p.pending.text)}</p>` : ''}<p>${h(p.lastWord ?? 'No word from the house yet.')}</p>${['trial', 'kept'].includes(p.status) ? `<button type="button" data-placement="${h(p.id)}">${h(person(v, p.candidate))} at ${h(person(v, p.family))}: check in or withdraw</button>` : ''}</article>`,
      )
      .join('') || '<p>No one placed yet. Your word will go with them.</p>'
  );
}
function choiceHtml(c: NonNullable<View['scene']>['choices'][number], hint = true): string {
  return `<div class="choice"><button type="button" data-testid="scene-choice" data-choice="${h(c.id)}" ${c.disabled ? 'disabled' : ''}>${h(c.label)}${c.hint && hint ? `<small>${h(c.hint)}</small>` : ''}</button>${c.disabled ? `<p class="reason">${h(c.disabled)}</p>` : ''}</div>`;
}
function sceneHtml(v: View): string {
  const s = v.scene;
  if (!s) return '';
  const endings = s.choices.filter((c) => ['wait-bench', 'send-home', 'finish', 'cancel'].includes(c.id));
  const choices = s.choices.filter((c) => !endings.includes(c));
  const lastSpeech = s.lines.findLast((l) => l.kind === 'speech');
  const latest =
    s.kind === 'negotiation' || s.kind === 'two-sides'
      ? s.lines.filter((l) => l.kind === 'speech').slice(-2)
      : lastSpeech
        ? [lastSpeech]
        : s.lines.slice(-1);
  const visibleChoices = s.kind === 'negotiation' || s.kind === 'two-sides' ? 1 : 2;
  const line = (l: (typeof s.lines)[number]) =>
    `<p data-scene-line ${l.side ? `data-scene-side="${l.side}"` : ''} class="${l.kind === 'speech' ? 'speech' : l.kind === 'notice' ? 'notice-line' : ''} ${l.side ? `side-${l.side}` : ''}">${l.speaker ? `<strong>${h(l.speaker)}:</strong> ` : ''}${h(l.text)}</p>`;
  return `<section class="scene-sheet ${s.kind === 'interview' ? 'interview-sheet' : ''}" data-testid="scene" data-scene-id="${h(s.id)}" aria-label="${h(s.title)}"><header class="sheet-heading lk-sheet-head"><h2>${h(s.title)}</h2><button type="button" data-action="conversation">Conversation</button></header><div class="lk-sheet-body scene-reading"><div class="exchange" role="region" aria-label="Latest words">${latest.map(line).join('')}</div>${s.kind === 'negotiation' && s.negotiation ? `<p class="terms-summary">${h(termsLine(s.negotiation.terms))}</p>` : ''}${v.heldScene ? `<p class="held-scene">${h(v.heldScene.title)} is waiting.</p>` : ''}${
    s.added?.length
      ? `<p class="added" role="status">Added to her card: ${s.added
          .filter((n) => !n.crossedOut)
          .map((n) => h(n.quality))
          .join(', ')}</p>`
      : ''
  }${s.interviewPace ? `<p class="question-cost">Each question takes 8–12 minutes. ${h(s.interviewPace)}</p>` : ''}</div><div class="lk-commit"><div class="scene-choices">${choices
    .slice(0, visibleChoices)
    .map((c) => choiceHtml(c, false))
    .join(
      '',
    )}</div>${choices.length > visibleChoices ? `<button type="button" data-action="more-choices">${s.kind === 'interview' ? 'More questions' : 'More choices'} · ${choices.length - visibleChoices}</button>` : ''}${s.kind === 'negotiation' && s.negotiation ? '<button type="button" data-action="edit-terms">Edit the offer</button>' : ''}${endings.length ? `<div class="interview-finish">${endings.map((c) => choiceHtml(c, false)).join('')}</div>` : s.canLeave ? '<button type="button" data-action="leave-scene">Finish</button>' : ''}</div></section>`;
}
function dayHtml(v: View): string {
  const d = v.dayCard;
  if (!d) return '';
  return `<section class="day-card lk-sheet-body"><h2>${h(d.dateLabel)} · Office closed</h2>${d.lines.map((l) => `<p>${h(l)}</p>`).join('')}<p class="tomorrow">${h(d.tomorrow)}</p><button type="button" data-action="sleep">Sleep</button></section>`;
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
  const positions = cityFigurePositions(v);
  const selected = positions.find((p) => p.figure.id === cityPerson);
  const caption = root.querySelector('[data-city-person]');
  if (caption) caption.textContent = selected ? `${selected.figure.name} · ${selected.place}` : '';
  const map = canvas.parentElement;
  if (map) {
    const height = Math.max(120, Math.min(200, window.innerHeight - map.getBoundingClientRect().top - 8));
    map.style.height = `${height}px`;
    canvas.style.height = `${height}px`;
  }
  drawCity(canvas, v, cityPerson ?? undefined);
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
  const origin = restore ? sheetOrigins.pop() : undefined;
  if (origin) {
    sheet = origin.node;
    modal = origin.kind;
    updateInspection = origin.inspection;
    root.querySelector('.game')?.append(sheet);
    sheet.show();
  } else {
    for (const previous of sheetOrigins.splice(0)) previous.node.remove();
  }
  const panel = root.querySelector<HTMLElement>('[data-content]');
  if (panel) panel.hidden = !!sheet;
  last = performance.now();
  if (restore && playing && !sheet) render(true);
  stage?.refresh();
}
function openSheet(title: string, content: string, kind = 'inspect'): HTMLDialogElement {
  const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const originLabel = origin?.getAttribute('aria-label') ?? origin?.textContent;
  if (sheet) {
    sheetOrigins.push({ node: sheet, kind: modal, inspection: updateInspection });
    sheet.close();
    sheet.remove();
  }
  const d = document.createElement('dialog');
  const game = root.querySelector<HTMLElement>('.game');
  d.className = game ? 'sheet lk-sheet' : 'sheet';
  d.setAttribute('aria-label', title);
  d.innerHTML = `<div class="sheet-heading lk-sheet-head"><h2>${h(title)}</h2><button type="button" data-close>Back</button></div><div class="sheet-content lk-sheet-body">${content}</div><p class="sheet-status" role="status"></p>`;
  sheet = d;
  modal = kind;
  updateInspection = null;
  if (game) {
    game.append(d);
    const panel = root.querySelector<HTMLElement>('[data-content]');
    if (panel) panel.hidden = true;
  } else document.body.append(d);
  d.querySelector('[data-close]')?.addEventListener('click', () => closeSheet());
  d.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSheet();
  });
  d.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
    }
  });
  d.addEventListener('close', () => {
    if (origin?.isConnected) origin.focus({ preventScroll: true });
    else
      [...root.querySelectorAll<HTMLElement>('button')]
        .find((b) => (b.getAttribute('aria-label') ?? b.textContent) === originLabel)
        ?.focus({ preventScroll: true });
  });
  if (!game) d.addEventListener('click', handleClick);
  if (game) d.show();
  else d.showModal();
  gloss(d);
  stage?.refresh();
  d.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
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
    `<p>About 15 minutes on the telephone.</p>${c.referees.map((r) => `<div class="reference-option"><button type="button" data-referee="${h(r.id)}" ${referenceReason(r) ? 'disabled' : ''}>Call ${h(r.name)}</button><p data-referee-reason="${h(r.id)}">${h(referenceReason(r) ?? 'Reachable now')}</p></div>`).join('') || '<p>No referee yet. Ask about her last family in the interview.</p>'}`,
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
      if (b) b.disabled = !!referenceReason(referee) || !!busy;
      if (reason) reason.textContent = busy ?? referenceReason(referee) ?? 'Reachable now';
    }
  };
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function termsLine(t: EmploymentTerms): string {
  const clock = (hour: number) =>
    `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
  return `${money(t.wage)} a month · ${clock(t.startHour)}–${clock(t.endHour)} · ${DAYS[t.dayOff]} off · ${t.trialDays}-day trial · fee ${money(t.fee)}`;
}
function editTerms(): void {
  const scene = current().scene;
  if (scene?.kind !== 'negotiation' || !scene.negotiation) return;
  const t = scene.negotiation.terms;
  const labels = {
    wage: 'Monthly wage',
    startHour: 'Start hour',
    endHour: 'Finish hour',
    trialDays: 'Trial days',
    fee: 'Agency fee',
  } as const;
  const d = openSheet(
    'Edit the offer',
    `<p>The worker and family must both accept. Changing the offer asks both again.</p>${Object.entries(
      labels,
    )
      .map(
        ([key, label]) =>
          `<label>${label}<input type="number" data-term="${key}" value="${t[key as keyof typeof labels]}" min="${key === 'trialDays' ? 1 : 0}" max="${key === 'endHour' ? 24 : key === 'startHour' ? 23 : key === 'trialDays' ? 14 : 100000}"></label>`,
      )
      .join(
        '',
      )}<label>Day off<select data-term="dayOff">${DAYS.map((day, i) => `<option value="${i}" ${t.dayOff === i ? 'selected' : ''}>${day}</option>`).join('')}</select></label>`,
  );
  const commit = document.createElement('div');
  commit.className = 'lk-commit';
  const propose = button('Say these terms to both sides', () => {
    const terms = { ...t };
    for (const input of d.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-term]'))
      terms[input.dataset.term as keyof EmploymentTerms] = Number(input.value);
    const valid = validTerms(terms);
    if (!valid) {
      const reason = d.querySelector('.sheet-status');
      if (reason)
        reason.textContent =
          'Use a positive wage and a fee up to ₺1,000,000. Use whole-minute hours, finish after start (00:00–24:00), and a trial of 1–14 whole days.';
      return;
    }
    closeSheet(false);
    send({ type: 'propose-terms', scene: scene.id, terms });
  });
  commit.append(propose);
  d.append(commit);
}
function householdPhone(familyId: string): void {
  const family = current().families.find((f) => f.id === familyId);
  if (!family) return;
  const d = openSheet(
    `Phone ${family.name}`,
    `<p>Choose whom to ask. Each person speaks from what they know.</p>${family.household.map((member) => `<div class="household-person"><h3>${h(member.name)} · ${h(member.who)}</h3>${member.phoneUnavailable ? `<p class="reason">${h(member.phoneUnavailable)}</p>` : ''}<button type="button" data-call-member="${h(member.id ?? '')}" ${!member.id || member.phoneUnavailable ? 'disabled' : ''}>Speak to ${h(member.name)}</button></div>`).join('')}`,
  );
  for (const b of d.querySelectorAll<HTMLButtonElement>('[data-call-member]'))
    b.onclick = () => {
      const member = family.household.find((m) => m.id === b.dataset.callMember);
      if (!member?.id) return;
      openSheet(
        `Speak to ${member.name}`,
        `<p>What will you say?</p>${(
          [
            ['progress', 'How is the household managing?'],
            ['complaint', 'Tell me what is wrong.'],
            ['smooth', 'Let us settle this calmly.'],
            ['worker', 'How is the worker being treated?'],
          ] as const
        )
          .map(([topic, label]) => `<button type="button" data-call-topic="${topic}">${label}</button>`)
          .join('')}`,
      )
        .querySelectorAll<HTMLButtonElement>('[data-call-topic]')
        .forEach((control) => {
          control.onclick = () => {
            closeSheet(false);
            send({
              type: 'call-household',
              family: familyId,
              member: member.id!,
              topic: control.dataset.callTopic as HouseholdTopic,
            });
          };
        });
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
      .join(
        '',
      )}${state?.version === 3 ? `<button type="button" data-phone-family="${h(id)}">Phone the household</button>` : ''}<button type="button" data-action="choose-worker">Choose a worker from the bench</button>`,
  );
}
function matchSheet(kind: 'trial' | 'place'): void {
  const v = current(),
    c = candidate(v);
  if (!c) return;
  const requests = v.requests.filter((r) => r.status === 'open');
  const d = openSheet(
    kind === 'trial' ? 'Send for a trial morning' : `Negotiate for ${c.name}`,
    `<p ${kind === 'place' ? 'data-fee-terms' : ''}>${kind === 'trial' ? 'She will spend the next morning with the family. Their word comes back later.' : 'The family pays one week’s wage as a deposit now; the rest of the fee after the trial week if they keep her. They will remember what you vouch for.'}</p><label>Family <select aria-label="Family" data-match-family>${requests.map((r) => `<option value="${h(r.family)}">${h(person(v, r.family))} · ${h(r.role)}</option>`).join('')}</select></label>${!requests.length ? '<p>No open request. Answer a family’s call first.</p>' : ''}${kind === 'place' ? `<fieldset><legend>What will you put your word behind?</legend><div class="vouch-controls">${QUALITIES.map((q) => `<button type="button" class="vouch" data-vouch="${q}" aria-pressed="false">${h(vouchLabel(c, q))}</button>`).join('')}</div><details class="vouch-evidence"><summary>Read the evidence</summary>${QUALITIES.map((q) => `<p><strong>${q}</strong> — ${h(evidence(c, q))}</p>`).join('')}</details></fieldset>` : ''}<p id="match-reason" data-match-reason class="reason"></p><button type="button" data-confirm-match aria-describedby="match-reason" ${!requests.length ? 'disabled' : ''}>${kind === 'trial' ? 'Send for a trial' : state?.version === 3 ? 'Propose to this family' : 'Place with this family'}</button>`,
  );
  const commit = document.createElement('div');
  commit.className = 'lk-commit';
  for (const element of d.querySelectorAll('[data-match-reason], [data-confirm-match]'))
    commit.append(element);
  d.append(commit);
  const select = d.querySelector<HTMLSelectElement>('[data-match-family]'),
    confirm = d.querySelector<HTMLButtonElement>('[data-confirm-match]');
  const update = () => {
    const live = current();
    const request = live.requests.find((r) => r.status === 'open' && r.family === select?.value);
    const liveCandidate = candidates(live).find((p) => p.id === c.id) ?? c;
    const reason = matchingReason(liveCandidate, request, kind, state?.version);
    const line = d.querySelector('[data-match-reason]');
    if (line) line.textContent = reason ?? '';
    const terms = d.querySelector('[data-fee-terms]');
    if (terms && state?.version === 3)
      terms.textContent =
        'Agree the wage, hours, trial and fee before any payment. Half the agreed fee is paid on placement; the rest after the agreed trial if the family keeps the worker.';
    else if (terms)
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
    `<p>${h(p.lastWord ?? 'No word yet.')}</p>${p.terms ? `<p>${h(termsLine(p.terms))}</p>` : ''}${state?.version === 3 ? `<button type="button" data-phone-family="${h(p.family)}">Phone someone in the household</button>` : ''}${p.arrangement ? `<p>${h(p.arrangement)}</p>` : ''}${p.pending ? `<p>${h(p.pending.dateLabel)}: ${h(p.pending.text)}</p>` : ''}<p data-check-reason class="reason"></p><button type="button" data-check="phone" data-placement-id="${h(id)}">Phone the family<small>About 15 minutes</small></button><button type="button" data-check="visit" data-placement-id="${h(id)}">Visit the house<small>An hour, plus the ferry or road</small></button><button type="button" data-check="drop-by" data-placement-id="${h(id)}">Ask the worker to drop by<small>After work</small></button><details><summary>Bring her back</summary><p>She will leave this house and return to your books. The family loses its worker.</p><button type="button" data-withdraw="${h(id)}">Withdraw this worker</button></details>`,
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
  if (b.dataset.speedChoice) {
    send({ type: 'speed', speed: Number(b.dataset.speedChoice) as Speed });
    return;
  }
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
  if (b.dataset.phoneFamily) {
    householdPhone(b.dataset.phoneFamily);
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
    closeSheet(false);
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
    case 'candidate-actions': {
      const c = v && candidate(v);
      if (c) {
        const reason = candidateAvailability(c);
        openSheet(
          `${c.name}: other actions`,
          `${action('Call a reference', 'references', reason, 'About 15 minutes')}${action('Send for a trial', 'trial', reason, 'Her next morning away')}`,
        );
      }
      break;
    }
    case 'candidate-notes': {
      const c = v && candidate(v);
      if (c) {
        const content = `<p class="candidate-wants handwritten">${h(c.wants ?? 'No needs discussed yet.')}</p>${QUALITIES.map(
          (q) =>
            `<section class="quality-note"><h3>${q}</h3><p>${h(evidence(c, q))}</p>${c.notes
              .filter((n) => n.quality === q)
              .map((n) => `<p class="${n.crossedOut ? 'crossed-out' : ''}">${h(noteText(n))}</p>`)
              .join('')}</section>`,
        ).join(
          '',
        )}<h3>Experience</h3>${c.experience.map((e) => `<p>${h(e)}</p>`).join('') || '<p>Not asked yet.</p>'}<button type="button" data-action="all-cards">Your books</button>`;
        openSheet(`${c.name}: Nermin’s notes`, content);
      }
      break;
    }
    case 'edit-terms':
      editTerms();
      break;
    case 'time':
      if (v)
        openSheet(
          'Clock speed',
          `<p>Time is paused while these options are open.</p><div class="speed-control">${SPEED_NAMES.map((name, i) => `<button type="button" data-speed-choice="${i}" aria-pressed="${v.speed === i}">${name}</button>`).join('')}</div>${v.next ? `<button type="button" data-action="wait-for">Wait for ${h(v.next.label)} · ${h(v.next.dateLabel)}</button>` : ''}`,
          'menu',
        );
      break;
    case 'conversation':
      if (v?.scene)
        openSheet(
          'Conversation',
          v.scene.lines
            .map(
              (l) =>
                `<p class="${l.kind === 'speech' ? 'speech' : ''}">${l.speaker ? `<strong>${h(l.speaker)}:</strong> ` : ''}${h(l.text)}</p>`,
            )
            .join(''),
        );
      break;
    case 'more-choices':
      if (v?.scene)
        openSheet(
          v.scene.kind === 'interview' ? 'All interview questions' : 'All responses',
          v.scene.choices
            .filter((c) => !['wait-bench', 'send-home', 'finish', 'cancel'].includes(c.id))
            .map((c) => choiceHtml(c))
            .join(''),
        );
      break;
    case 'call-in':
      if (selected) send({ type: 'call-in', candidate: selected });
      break;
    case 'wait-for':
      closeSheet(false);
      send({ type: 'wait-for' });
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
          'Your books',
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
  if (
    playing &&
    state &&
    !document.hidden &&
    modal !== 'menu' &&
    !sheetOrigins.some((origin) => origin.kind === 'menu') &&
    !document.querySelector('.hflab-veil')
  ) {
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
