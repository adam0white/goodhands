import {
  anchorPersonaLife,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  FEEDBACK_LABELS,
  initialPersonaLife,
  type PersonaEnvelope,
  type PersonaLife,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { ALLOCATION, CAST, CAST_KEYS, castKey } from '../sim/cast.ts';
import { agencyTransfer, prepareAgencyChapter } from '../sim/cast-chapter.ts';
import { type GuestAction, type GuestId, prepareGuest } from '../sim/guests.ts';
import { agencySource, publishNativeCheckpoint } from './checkpoint.ts';
import { type ContinuityBook, ContinuitySession, continuityRow, emptyContinuity } from './continuity.ts';
import '@adam0white/lab-kit/stage.css';
import {
  defineTerms,
  downloadJson,
  feedbackPersonaControl,
  feedbackSharePlay,
  glossaryPanel,
  personaControls,
  telemetryNotice,
  telemetryToggle,
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
  type State,
  type View,
} from '../sim/types.ts';
import {
  exportRun,
  guestCheckpointTransfer,
  type RunExport,
  validateContinuity,
  verifyImport,
} from './export.ts';
import { lab } from './lab.ts';
import { cityFigurePositions, drawCity, MAP_HEIGHT, MAP_WIDTH } from './map.ts';
import { drawOffice, officeSeats } from './office.ts';
import { familySpeech, plainText } from './plain-english.ts';
import {
  addedEvidence,
  automaticPace,
  candidateAvailability,
  canWait,
  clockLabels,
  escapeHtml,
  evidence,
  matchingReason,
  money,
  monthTally,
  noteSource,
  noteText,
  personName,
  phoneAvailability,
  placementDeadline,
  placementDepositWords,
  placementLabel,
  placementTiming,
  referenceReason,
  requestGroups,
  resumeLine,
  vouchLabel,
} from './render.ts';
import { resumeForPlay } from './resume.ts';
import { get, put, putNow } from './store.ts';

const h = (value: string) => escapeHtml(plainText(value));
const labTools = new URLSearchParams(location.search).get('lab') === '1';

const host = document.querySelector<HTMLDivElement>('#app');
if (!host) throw new Error('Good Hands needs an app element.');
const root = host;
const recordingNotice = telemetryNotice();
// Keep the SDK's actual node mounted outside the rerendered game.
const noticeFooter = document.createElement('footer');
noticeFooter.className = 'lab-notice-footer';
if (recordingNotice) noticeFooter.append(recordingNotice);
root.after(noticeFooter);
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
let sheet: HTMLElement | null = null;

const sheetOrigins: {
  node: HTMLElement;
  kind: string;
  inspection: (() => void) | null;
}[] = [];
let modal = '';
let updateInspection: (() => void) | null = null;
let screen = '';
let notice = '';
let waitAnimation: {
  before: View;
  start: number;
  end: number;
  label: string;
} | null = null;
let transcriptKey = '';
let saveReady = false;
let moreChoices = false;
let paceChoice: 'automatic' | 'slow' | 'steady' | 'fast' = 'automatic';
let overlay: HTMLElement | null = null;
let noticeUntil = 0;
const shelf = personaChannel();
const continuitySession = new ContinuitySession(shelf, lab, () => lab.build().c || 'development');
let continuity: ContinuityBook = emptyContinuity();
let stopTracking: (() => void) | undefined;
let checkpointQueue: Promise<void> = Promise.resolve();
let continuityStatus = '';
let pendingFork: unknown;
let generation = 0;
let openingMonth = false;
function runExport(): RunExport {
  if (!state) throw new Error('Open a month first.');
  return exportRun(state, inputs, continuity);
}
function attachRecording(): void {
  lab.setPersonaRecording(continuitySession.recordingKey);
  stopTracking?.();
  stopTracking = lab.trackRun(() => (state ? runExport() : null), {
    runKey: () => (state ? sim.view(state).seed : 'title'),
    getLogs: () =>
      state
        ? sim
            .view(state)
            .log.slice(-40)
            .map((line) => line.text)
        : [],
  });
}
const ALL_GAMES = 'https://human.adamwhite.work/games/';
const TERMS = {
  Kültürpark: 'the city park in central Izmir',
  Alsancak: 'the neighbourhood around your office',
  Karşıyaka: 'the district across the bay',
  lira: 'Turkish money',
};
defineTerms(TERMS);

function button(label: string, fn: () => void, className = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = plainText(label);
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
  return personName(v, id);
}
function candidate(v: View): CandidateView | undefined {
  return candidates(v).find((c) => c.id === selected);
}
function save(): void {
  if (!state) return;
  const run = runExport();
  lab.setPersonaRecording(continuitySession.recordingKey);
  lab.captureSave({ key: 'run', value: run });
  void put('run', run).then((ok) => {
    if (!ok) {
      notice = 'This browser could not save. Keep a copy from Feedback.';
      noticeUntil = Number.POSITIVE_INFINITY;
      showNotice();
    }
  });
}
function showNotice(): void {
  const el = root.querySelector<HTMLElement>('[data-status]');
  if (el) el.textContent = plainText(notice);
}
function changed(previous: View, next: View): void {
  // Views are copied before a tick because the simulation may mutate its state.
  for (const name of sim.milestones(previous, next)) lab.milestone(name);
  for (const guest of next.guests ?? []) {
    const before = previous.guests?.find((g) => g.id === guest.id);
    if (!before)
      lab.milestone(guest.id === 'zeynep-pass' ? 'onecast zeynep encounter' : 'onecast selin encounter');
    if (before?.status !== 'complete' && guest.status === 'complete') void checkpoint();
  }
}
function send(input: Input): void {
  if (openingMonth) return;
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
  noticeUntil = performance.now() + 6000;
  moreChoices = false;
  if (current().scene && sheet) closeSheet(false);
  render(true);
  root
    .querySelector<HTMLElement>(
      '[data-testid="scene-choice"]:not(:disabled), [data-action="interview"]:not(:disabled)',
    )
    ?.focus({ preventScroll: true });
  save();
  if (input.type === 'guest-action' || input.type === 'sleep') void checkpoint();
}

function topbar(label: string): string {
  return `<header class="topbar"><div class="topbar-label">${label}</div><button type="button" data-action="info" aria-label="Information">i</button><button type="button" data-action="menu" aria-label="Game menu">≡<span class="menu-label"> Menu</span></button></header>`;
}
function title(): void {
  closeSheet(false);
  if (state) saved = verifyImport(JSON.stringify(runExport()));
  playing = false;
  shown = '';
  setScreen('title');
  root.innerHTML = `<main class="title-page">${topbar(`<a href="${ALL_GAMES}" target="_top">All games</a>`)}<section class="title-body"><p class="eyebrow">Izmir · November 2026</p><div class="agency-mark" aria-hidden="true">G H<span>placement agency</span></div><h1>Good Hands</h1><p class="subtitle">You run Nermin’s agency for a month.</p><p class="goal">A household needs a nanny by Tuesday 08:00. Three applicants are waiting on your bench. Rent is due Friday.</p>${labTools ? '<button type="button" data-action="other-ways">Lab tools</button>' : ''}<p class="title-status" role="status">${saveReady ? '' : 'Looking for a saved month…'}</p></section><div class="title-actions lk-commit"></div></main>`;
  const actions = root.querySelector('.title-actions');
  if (saved) {
    actions?.append(
      button(
        'Resume',
        () => {
          if (saved) void begin(saved.state, saved.inputs, saved.continuity);
        },
        'primary',
      ),
    );
    const p = document.createElement('p');
    p.className = 'continue-line';
    p.textContent = resumeLine(sim.view(saved.state));
    actions?.append(p);
    actions?.append(
      button('New game', () => {
        const confirm = document.createElement('div');
        confirm.className = 'restart-confirm';
        confirm.innerHTML = '<p>Starting a new month will replace your saved month.</p>';
        confirm.append(
          button('Yes, start over', () => {
            void newMonth();
          }),
          button('No', () => confirm.remove()),
        );
        actions?.querySelector('.restart-confirm')?.remove();
        actions?.append(confirm);
      }),
    );
  } else
    actions?.append(
      button(
        'Open the office',
        () => {
          void newMonth();
        },
        'primary',
      ),
    );
  const credit = document.createElement('p');
  credit.className = 'credit';
  credit.textContent = 'People by the Human Framework';
  actions?.append(credit);
}
async function newMonth(fresh = false, file?: unknown): Promise<void> {
  if (openingMonth) return;
  openingMonth = true;
  const startup = ++generation;
  continuitySession.invalidate();
  const isCurrent = () => startup === generation;
  try {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 20261102;
    const book = emptyContinuity();
    await shelf.ready;
    if (!isCurrent()) return;
    let chapter = await prepareAgencyChapter([], seed);
    if (file) {
      const parent = await validatePersona(file);
      const { preparePersonaLife } = await import('@adam0white/lab-client');
      chapter = await prepareAgencyChapter([preparePersonaLife(parent, Date.now())], seed);
      book.fileOrigin = true;
      book.fileUnlinked = true;
    } else if (!fresh && shelf.enabled) {
      const batch = await claimCastChapterBatch(
        shelf,
        ALLOCATION.map((p) => p.castId),
        agencySource(lab.build().c || 'development'),
        async (inputs) => {
          const prepared = await prepareAgencyChapter(inputs, seed);
          sim.newGame(seed, 6, prepared.guests, prepared);
          return prepared;
        },
        { isCurrent },
      );
      if (!isCurrent()) return;
      if (batch) {
        chapter = batch.initial;
        book.initialClaims = batch.claims;
        book.heads = structuredClone(batch.claims);
      }
    }
    book.chapter = chapter;
    book.initialClaims ??= [];
    if (!isCurrent()) return;
    closeSheet(false);
    await begin(sim.newGame(seed, 6, chapter.guests, chapter), [], book, !!file);
    continuityStatus = chapter.inputs.length
      ? `Loaded ${chapter.inputs.length} people together with their earlier history. Their starting state and ages are saved.`
      : 'This month starts with a new local cast. Earlier history has not been reset.';
    lab.milestone('run started');
  } catch (e) {
    if (isCurrent()) {
      console.error('Could not open the agency month', e);
      continuityStatus = errorText(e);
      notice = labTools
        ? continuityStatus
        : 'This month could not start because its people could not be loaded safely. Your saved month is unchanged. Try again or use Feedback.';
      noticeUntil = Infinity;
      if (!playing) {
        const line = root.querySelector('[role="status"]');
        if (line) line.textContent = notice;
      } else {
        showNotice();
        const line = sheet?.querySelector('[role="status"]');
        if (line) line.textContent = notice;
      }
    }
  } finally {
    openingMonth = false;
  }
}
function errorText(e: unknown): string {
  return e instanceof Error
    ? e.message
    : 'People’s history between games is unavailable. You can still start a new game or load a local file.';
}
async function begin(
  next: State | null,
  history: LoggedInput[],
  book = emptyContinuity(),
  fromFile = false,
): Promise<void> {
  if (!next) return;
  const activeGeneration = ++generation;
  if (fromFile) {
    book.fileOrigin = true;
    book.fileUnlinked = true;
  }
  await validateContinuity(book, next, history);
  if (activeGeneration !== generation) return;
  playing = false;
  stopTracking?.();
  await continuitySession.recording(book, fromFile);
  if (activeGeneration !== generation) return;
  continuity = structuredClone(book);
  const resumed = labTools ? { state: next, inputs: structuredClone(history) } : resumeForPlay(next, history);
  state = resumed.state;
  inputs = resumed.inputs;
  selected = null;
  tab = 'Bench';
  city = false;
  playing = true;
  last = performance.now();
  lastHour = Math.floor(current().now / 60);
  notice = '';
  attachRecording();
  render(true);
  save();
}
function checkpoint(fork = false): Promise<void> {
  const activeGeneration = generation;
  const pinned = state ? structuredClone(state) : null;
  const sourceInputCount = inputs.length;
  checkpointQueue = checkpointQueue
    .catch(() => {})
    .then(async () => {
      await shelf.ready;
      if (!shelf.enabled || !pinned || activeGeneration !== generation) return;
      if (continuity.fileOrigin && !fork) {
        continuityStatus =
          'This file remains a local history. An explicit new branch is required before publishing it.';
        return;
      }
      if (
        !pinned.castPaused &&
        !continuity.heads.some((h) => !h.terminal && !pinned.people[castKey(h.castId)]?.body.alive)
      ) {
        continuityStatus =
          'Pause this agency month before saving people who can leave. End their active placements through play first.';
        return;
      }
      const dispositions: string[] = [];
      for (const id of CAST_KEYS) {
        const cast = CAST[id],
          person = pinned.people[id];
        if (!person) {
          dispositions.push(`${cast.name}: no person in this chapter.`);
          continue;
        }
        const parent = continuity.heads.find((p) => p.castId === cast.castId);
        try {
          const stamps = agencySource(lab.build().c || 'development');
          let envelope: PersonaEnvelope;
          if (!person.body.alive) {
            if (!parent) {
              dispositions.push(`${cast.name}: dead, with no owned branch to close.`);
              continue;
            }
            envelope = await closePersonaBranch(parent, stamps, person.now);
          } else {
            const transfer: Record<string, unknown> = await agencyTransfer(pinned, id);
            if (id === 'zeynep-pass' || id === 'selin-voice') {
              const g = (pinned.guests as Array<Record<string, unknown>>).find((g) => g.id === id);
              if (g) {
                const { person: _p, ...meta } = g;
                transfer.guestMetadata = meta;
              }
              const input = continuity.chapter?.inputs.find((p) => p.parent.castId === cast.castId);
              const original = (parent?.transfer.returnOrigin ?? input?.parent) as
                | PersonaEnvelope
                | undefined;
              if (
                original &&
                ((original.source.game === 'voice' && original.source.rules === 'voice-4') ||
                  original.source.game === 'pass')
              ) {
                Object.assign(transfer, await guestCheckpointTransfer(pinned, id as GuestId, original));
                transfer.returnOrigin = original;
              }
            }
            const branchId = fork || !parent ? crypto.randomUUID() : parent.branchId;
            const previous = parent?.transfer.life as PersonaLife | undefined;
            transfer.life = previous
              ? anchorPersonaLife(previous, cast.castId, Date.now())
              : initialPersonaLife(cast.castId, branchId, Date.now());
            envelope = await createPersona({
              format: 'hf-persona/1',
              castId: cast.castId,
              castRevision: cast.revision,
              branchId,
              parentRevision: fork ? null : (parent?.revision ?? null),
              source: stamps,
              transfer,
              limitations: (transfer.limitations as string[]) ?? [],
            });
          }
          if (activeGeneration !== generation) return;
          await publishNativeCheckpoint(
            shelf,
            continuity,
            envelope,
            parent,
            fork,
            () => activeGeneration === generation,
          );
          if (activeGeneration !== generation) return;
          const idx = continuity.heads.findIndex((p) => p.castId === cast.castId);
          if (idx < 0) continuity.heads.push(envelope);
          else continuity.heads[idx] = envelope;
          continuity.rows.push({
            ...continuityRow(
              envelope,
              'checkpoint',
              continuity.fileOrigin ? 'file' : 'shared',
              parent ? 'continuing' : 'fresh',
            ),
            sourceMinute: pinned.now,
            sourceInputCount,
          });
          dispositions.push(
            `${cast.name}: accepted ${envelope.terminal ? 'terminal closure' : 'paused chapter checkpoint'}.`,
          );
          await continuitySession.recording(continuity);
          save();
        } catch (e) {
          dispositions.push(`${cast.name}: refused — ${errorText(e)}`);
        } finally {
          if (activeGeneration === generation) continuityStatus = dispositions.join('\n');
        }
      }
    });
  return checkpointQueue;
}
watchPersonaCheckpoint(() => checkpoint());
function peoplePanel(): void {
  if (!labTools) return;
  const d = openSheet(
    'People between games',
    '<p data-continuity-status role="status"></p><div data-persona-controls></div><p>Loaded months keep their original people. Arrivals are considered only for a new month. Browser storage may be lost. Keep a file backup.</p><button type="button" data-persona-file>Load a person file into a new month</button><button type="button" data-persona-fresh>Start a fresh month without history</button><button type="button" data-persona-export>Download accepted people</button><button type="button" data-persona-pause>Pause / resume this agency chapter</button><button type="button" data-persona-checkpoint>Save people who are ready to return</button><button type="button" data-persona-fork>Create a separate copy of this history</button><p><a href="https://pass.adamwhite.work/">Return to The Pass</a> · <a href="https://human.adamwhite.work/voice/">Return to Voice</a>. To continue the earlier game, its departure must be saved in this browser. Otherwise, start a new game there.</p>',
  );
  const carry = document.createElement('p');
  carry.textContent =
    'Zeynep carries cold-food preparation, one attended work account and her family promise. Other kitchen skills, wages, equipment and Chef trust stay in The Pass. Selin brings an enquiry and her office schedule; the call grants no medical knowledge, placement or consent. Downloaded person files include the full omission report.';
  if (continuity.chapter?.inputs.length)
    carry.textContent = Object.values(continuity.chapter.facts)
      .map((f) => f?.line)
      .join(' ');
  d.querySelector('[data-persona-controls]')?.after(carry);
  const update = () => {
    const el = d.querySelector('[data-continuity-status]');
    if (el) el.textContent = continuityStatus;
  };
  update();
  void shelf.ready.then(() => {
    d.querySelector('[data-persona-controls]')?.append(
      personaControls({
        enabled: shelf.enabled,
        setEnabled(value) {
          generation++;
          continuitySession.invalidate();
          shelf.setEnabled(value);
          continuityStatus = value
            ? 'New months will use people’s history from earlier games.'
            : 'New months will not use people’s earlier history. You can keep playing.';
          update();
        },
        recordingAllowed: !continuity.heads.length || lab.personaRecordingAllowed,
        allowRecording(value) {
          void continuitySession
            .allow(continuity, value)
            .then(() => {
              save();
              update();
            })
            .catch((e) => {
              continuityStatus = errorText(e);
              update();
            });
        },
      }),
    );
  });
  const personaFile = d.querySelector<HTMLButtonElement>('[data-persona-file]');
  const personaFresh = d.querySelector<HTMLButtonElement>('[data-persona-fresh]');
  const personaExport = d.querySelector<HTMLButtonElement>('[data-persona-export]');
  const personaPause = d.querySelector<HTMLButtonElement>('[data-persona-pause]');
  const personaCheckpoint = d.querySelector<HTMLButtonElement>('[data-persona-checkpoint]');
  const personaFork = d.querySelector<HTMLButtonElement>('[data-persona-fork]');
  if (!personaFile || !personaFresh || !personaExport || !personaPause || !personaCheckpoint || !personaFork)
    throw new Error('Missing required persona controls.');
  personaFile.onclick = () => {
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.onchange = async () => {
      try {
        const f = file.files?.[0];
        if (!f) return;
        if (f.size > 256 * 1024) throw new Error('A person file must be below 256 KiB.');
        await newMonth(false, JSON.parse(await f.text()));
      } catch (e) {
        continuityStatus = errorText(e);
        update();
      }
    };
    file.click();
  };
  personaFresh.onclick = () => {
    void newMonth(true);
  };
  personaExport.onclick = () => {
    for (const head of continuity.heads) downloadJson(`${head.castId}.json`, head);
  };
  personaPause.onclick = () => {
    if (state) send({ type: state.castPaused ? 'resume-cast' : 'pause-cast' });
    update();
  };
  personaCheckpoint.onclick = () => {
    void checkpoint().then(update);
  };
  personaFork.onclick = () => {
    void (async () => {
      try {
        if (pendingFork) {
          const original = await validatePersona(pendingFork);
          await prepareGuest(original);
          const { revision: _revision, ...body } = original;
          const fork = await createPersona({
            ...body,
            branchId: crypto.randomUUID(),
            parentRevision: null,
          });
          await shelf.request({ action: 'put', envelope: fork, fork: true });
          pendingFork = undefined;
          await newMonth(false, fork);
        } else {
          await checkpoint(true);
          update();
        }
      } catch (e) {
        continuityStatus = errorText(e);
        update();
      }
    })();
  };
}
function shell(v: View): void {
  root.innerHTML = `<main class="game" data-testid="office">${topbar('<span data-date></span> · <strong data-time></strong>')}<div class="state-strip"><span data-money></span><progress class="rent-meter" max="${v.rent.amount}" value="${Math.max(0, v.cash)}" aria-label="Cash towards rent"></progress><span data-rent-due></span><span data-pace></span></div><section class="office-front" aria-label="The office"><div class="room"><canvas id="office" role="img" aria-label="Nermin’s desk, telephone, window and the waiting bench"></canvas><div class="seat-targets"></div><div class="city-map" hidden><canvas id="city" role="img" aria-label="Izmir across the bay"></canvas><div class="city-targets"></div></div></div><p class="scene-status" data-status role="status"></p><p data-city-person class="city-person"></p><div class="phone-strip" hidden><button class="phone-control" type="button" data-action="phone"></button><p id="phone-reason" class="phone-reason reason"></p></div><button class="city-toggle" type="button" data-action="city">City</button></section><div class="caption-row"><button class="task now" type="button" aria-label="Task" data-testid="task" data-action="task"><span></span></button><button type="button" data-action="wait-for" aria-label="Skip to the next event" class="until-event"></button></div><section class="desk-sheet" data-content aria-label="Nermin’s desk"></section></main>`;
  updateClock(v);
}
function pace(v: View): number {
  if (overlay || modal === 'menu' || modal === 'feedback' || waitAnimation) return 0;
  const inspecting = !!sheet || (tab === 'Bench' && selected !== null);
  const automatic = automaticPace(v, inspecting);
  if (automatic <= 0.5 || (inspecting && v.bench.length)) return automatic;
  return paceChoice === 'automatic' ? automatic : { slow: 0.5, steady: 2, fast: 20 }[paceChoice];
}
function paceWords(v: View): string {
  if (overlay) return 'Paused while you read.';
  if (modal === 'menu') return 'Paused while the menu is open.';
  if (modal === 'feedback') return 'Paused for Feedback.';
  if (waitAnimation) return 'Skipping to the next event.';
  if (v.scene)
    return `The clock is paused. ${v.scene.with ? `${person(v, v.scene.with).replace(/^the /, 'The ')} is talking.` : 'A conversation is in progress.'}`;
  if (v.phoneRinging) return 'Paused for the phone call.';
  if (v.dayCard || !v.open) return 'Paused. The office is closed.';
  if (v.heldScene) return `Paused for ${v.heldScene.title}.`;
  if (v.slowed) {
    const c = v.bench.find((c) => c.posture === 'leaving');
    return c
      ? `The clock is slow. ${c.name} is picking up a bag.`
      : 'The clock is slow. Someone needs an answer.';
  }
  if ((sheet || (tab === 'Bench' && selected !== null)) && v.bench[0])
    return `${v.bench[0].name} is waiting while you read.`;
  return '';
}
function updateClock(v: View): void {
  const text = (selector: string, value: string) => {
    const el = root.querySelector(selector);
    if (el && el.textContent !== plainText(value)) el.textContent = plainText(value);
  };
  text(
    '[data-date]',
    v.dateLabel
      .replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/g, (x) => x.slice(0, 3))
      .replace('November', 'Nov'),
  );
  text('[data-time]', v.timeLabel);
  text('[data-pace]', paceWords(v));
  const wait = root.querySelector<HTMLButtonElement>('[data-action="wait-for"]');
  if (wait) {
    wait.disabled = !!waitAnimation || !canWait(v) || !!sheet;
    wait.hidden = !canWait(v) || !!sheet || !!overlay;
    wait.innerHTML = `Skip ⏩<small>${v.next ? `${clockLabels(v.next.at).timeLabel} · ${h(v.next.label)}` : ''}</small>`;
  }
  text('[data-money]', money(v.cash));
  text('[data-rent-due]', `${money(v.rent.amount)} Fri ${v.rent.label.match(/\d{2}:\d{2}/)?.[0] ?? '17:00'}`);
  const meter = root.querySelector<HTMLProgressElement>('.rent-meter');
  if (meter) {
    meter.value = Math.max(0, v.cash);
    meter.max = v.rent.amount;
    meter.classList.toggle('short', v.rent.short);
  }
  root.querySelector('.game')?.classList.toggle('has-takeover', !!sheet);
  const caption = root.querySelector<HTMLElement>('.caption-row');
  if (caption) caption.hidden = !!v.scene || !!sheet || !!v.dayCard;
  const status = root.querySelector<HTMLElement>('[data-status]');
  if (status) status.hidden = !!v.phoneRinging || performance.now() > noticeUntil;
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
    v.guests,
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
  if (task)
    task.textContent = plainText(v.task.text.charAt(0).toLocaleUpperCase('en-GB') + v.task.text.slice(1));
  const phone = root.querySelector<HTMLButtonElement>('.phone-control');
  if (phone) {
    phone.textContent = v.phoneRinging ? `☎ Call from ${v.phoneRinging.who} · Answer` : '';
    const strip = root.querySelector<HTMLElement>('.phone-strip');
    if (strip) strip.hidden = !v.phoneRinging;
    phone.setAttribute('aria-describedby', 'phone-reason');
    const reason = phoneAvailability(v);
    phone.disabled = !!reason;
    const line = root.querySelector<HTMLElement>('.phone-reason');
    if (line) line.textContent = v.phoneRinging ? (reason ?? '') : '';
  }
  const officeCanvas = root.querySelector<HTMLCanvasElement>('#office');
  if (officeCanvas) {
    officeCanvas.hidden = city;
    drawOffice(officeCanvas, v, selected);
  }
  const cityMap = root.querySelector<HTMLElement>('.city-map');
  if (cityMap) cityMap.hidden = !city;
  const cityToggle = root.querySelector<HTMLElement>('.city-toggle');
  if (cityToggle) cityToggle.textContent = city ? 'Office' : 'City';
  if (city) updateCity(v);
  else {
    const caption = root.querySelector<HTMLElement>('[data-city-person]');
    if (caption) caption.hidden = true;
  }
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
    content.innerHTML = `<nav class="tabs lk-sheet-head" aria-label="Agency records">${(['Bench', 'Families', 'Placed'] as const).map((t) => `<button type="button" data-tab="${t}" aria-pressed="${tab === t}">${t}</button>`).join('')}</nav><section class="desk-content lk-sheet-body">${city && tab === 'Bench' ? cityHtml(v) : tab === 'Bench' ? benchHtml(v) + guestsHtml(v) : tab === 'Families' ? familiesHtml(v) : placedHtml(v)}<button type="button" data-action="day-notes">The day’s notes</button></section>`;
    if (city) updateCity(v);
    setScreen(sheet ? 'menu' : city ? 'city' : 'office');
  }
  const verbs = content.querySelector('.candidate-actions');
  if (verbs) content.append(verbs);
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
    return `<nav class="bench-strip" aria-label="Waiting bench" data-testid="bench">${v.bench.map((p) => `<button type="button" data-candidate="${h(p.id)}" aria-label="${h(p.name)}" aria-pressed="false">${p.posture === 'leaving' ? '◌' : p.posture === 'restless' ? '◐' : '●'} ${h(p.name)}</button>`).join('')}</nav><div class="empty-card"><h1>Nermin’s desk</h1><p>Choose an applicant on the bench to open the application card.</p>${v.books.length ? `<div class="book-list">${v.books.map((c) => `<button type="button" data-candidate="${h(c.id)}">${h(c.name)} · ${h(c.busy ?? (c.arrival ? `coming ${c.arrival.dateLabel}` : c.presence === 'home' ? 'at home' : c.status))}</button>`).join('')}</div>` : ''}</div>`;
  const unavailable =
    candidateAvailability(c) ?? (!v.open ? 'The office is closed. Sleep to open tomorrow.' : undefined);
  const interviewLimit =
    c.interviewUnavailable ??
    (c.interviewAfter
      ? `Call ${c.name} back after ${clockLabels(c.interviewAfter).dateLabel}, ${clockLabels(c.interviewAfter).timeLabel}.`
      : undefined);
  const reason =
    unavailable || interviewLimit ? `<p class="reason">${h(unavailable ?? interviewLimit ?? '')}</p>` : '';
  const card = `<article class="candidate-card"><div class="card-heading"><h2>${h(c.name)}</h2><span>${h(c.roles.join(' / '))}</span></div><p class="look">${h(c.look)}</p>${c.arrival ? `<p>${h(c.name)} is coming · ${h(c.arrival.dateLabel)}</p>` : ''}${(state?.version ?? 0) < 3 ? '<p class="reason">This month uses earlier rules. Start a new month for office visits and negotiated placements.</p>' : ''}<div class="candidate-actions">${(state?.version ?? 0) >= 3 && c.presence === 'home' ? action('Call in to the office', 'call-in', unavailable, 'The journey takes time.') : action('Interview', 'interview', unavailable ?? interviewLimit, 'This takes about 30 minutes.')}${action((state?.version ?? 0) >= 3 ? 'Negotiate placement' : 'Place', 'place', unavailable, (state?.version ?? 0) >= 3 ? 'Agree on the terms with both sides.' : 'Choose which qualities to promise.')}${action('Call a reference', 'references', unavailable, 'This takes about 15 minutes.')}${action('Send for a trial', 'trial', unavailable, 'The applicant will spend the next morning with the family.')}${action('Keep the phone number', 'take-number', unavailable ?? (c.status !== 'bench' ? 'You already have this applicant’s number.' : undefined), 'This takes 2 minutes. The applicant goes home, and you keep the phone number.')}</div>${reason}${c.wants ? `<p class="candidate-wants handwritten">Needs: ${h(c.wants)}</p>` : ''}<details class="notes-details"><summary>Nermin’s notes · ${c.wage === null ? 'Wage not yet asked' : `${money(c.wage)} a month`}</summary><div class="card-notes">${QUALITIES.map(
    (q) => {
      const notes = c.notes.filter((n) => n.quality === q);
      const read = notes.findLast((n) => !n.crossedOut) ?? notes.at(-1);
      return `<section class="quality-note"><h3>${q}</h3><p class="nermin-read handwritten">${read ? h(read.phrase) : 'You have not asked yet.'}</p>${notes.map((n) => `<p class="note ${n.crossedOut ? 'crossed-out' : ''}"><small>${h(noteSource(n))}</small><span class="note-claim">${h(n.claim ?? n.phrase)}</span></p>`).join('')}</section>`;
    },
  ).join(
    '',
  )}</div><h3>Experience</h3>${c.experience.length ? c.experience.map((e) => `<p>${h(e)}</p>`).join('') : '<p>This applicant has not told you yet.</p>'}<h3>Former employers</h3>${c.referees.map((r) => `<p>${h(r.name)} · ${r.reachable ? 'reachable' : h(r.why ?? 'You cannot reach this person now. Try later.')}${r.called ? ' · already called' : ''}</p>`).join('') || '<p>You have no former employer to call yet. Ask during the interview.</p>'}</details><button type="button" data-action="all-cards">Agency records</button></article>`;
  const chips = `<nav class="bench-strip" aria-label="Waiting bench" data-testid="bench">${v.bench.map((p) => `<button type="button" data-candidate="${h(p.id)}" aria-label="${h(p.name)}" aria-pressed="${selected === p.id}">${p.posture === 'leaving' ? '◌' : p.posture === 'restless' ? '◐' : '●'} ${h(p.name)}</button>`).join('')}</nav>`;
  return (
    chips +
    card
      .replace('<details class="notes-details"><summary>', '<section class="notes-details"><h3>')
      .replace('</summary><div class="card-notes">', '</h3><div class="card-notes">')
      .replace(
        '</details><button type="button" data-action="all-cards">Agency records</button>',
        '</section>',
      )
  );
}
function action(label: string, key: string, disabled?: string, hint?: string): string {
  return `<button type="button" data-action="${key}"${disabled || hint ? ` aria-description="${h(disabled ?? hint ?? '')}"` : ''} ${disabled ? 'disabled' : ''}><span>${h(label)}</span>${disabled || hint ? `<small>${h(disabled ?? hint ?? '')}</small>` : ''}</button>`;
}
function familiesHtml(v: View): string {
  const { open, lost } = requestGroups(v.requests);
  const active =
    open
      .map(
        (r) =>
          `<button type="button" class="family-card card-target" data-family="${h(r.family)}" aria-label="${h(person(v, r.family))}"><strong>${h(person(v, r.family))}</strong><span>“${h(r.wants)}”</span><span>${h(r.role)} · ${money(r.wage)} a month</span><span class="deadline">By ${h(r.byLabel)}</span></button>`,
      )
      .join('') || '<p>No families have open requests. Use Placed to see current placements.</p>';
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
      .map((p) => {
        const active = ['trial', 'kept'].includes(p.status);
        const content = `<strong>${h(person(v, p.candidate))} · ${h(person(v, p.family))}</strong><span>${placementLabel(p)}</span>${p.arrangement ? `<span class="placement-arrangement">${h(p.arrangement)}</span>` : ''}${p.pending ? `<span class="placement-pending">${h(p.pending.dateLabel)}: ${h(p.pending.text)}</span>` : ''}<span>${h(p.lastWord || 'The family has not reported back yet.')}</span>`;
        return active
          ? `<button type="button" class="placement-card card-target" data-placement="${h(p.id)}" aria-label="${h(person(v, p.candidate))} at ${h(person(v, p.family))}">${content}</button>`
          : `<article class="placement-card">${content}</article>`;
      })
      .join('') || '<p>You have not placed anyone yet. Families will remember the qualities you promise.</p>'
  );
}
function choiceHtml(c: NonNullable<View['scene']>['choices'][number], hint = true): string {
  return `<div class="choice"><button type="button" data-testid="scene-choice" data-choice="${h(c.id)}" ${c.disabled ? 'disabled' : ''}>${h(c.label)}${c.hint && hint ? `<small>${h(c.hint)}</small>` : ''}</button>${c.disabled ? `<p class="reason">${h(c.disabled)}</p>` : ''}</div>`;
}
function sceneHtml(v: View): string {
  const s = v.scene;
  if (!s) return '';
  const endings = s.choices.filter((c) =>
    ['wait-bench', 'send-home', 'finish', 'cancel', 'done'].includes(c.id),
  );
  const choices = s.choices.filter((c) => !endings.includes(c));
  const lastSpeech = s.lines.findLast((l) => l.kind === 'speech');
  const latest =
    s.kind === 'negotiation' || s.kind === 'two-sides'
      ? s.lines.filter((l) => l.kind === 'speech').slice(-2)
      : lastSpeech
        ? [lastSpeech]
        : s.lines.slice(-1);
  const visibleChoices = s.kind === 'negotiation' || s.kind === 'two-sides' ? 1 : 2;
  const line = (l: (typeof s.lines)[number]) => {
    const narration =
      !!l.speaker &&
      (l.text.startsWith(`${l.speaker} sat across from your desk.`) ||
        l.text.startsWith(`${l.speaker},`) ||
        l.text.startsWith(`${l.speaker} phones `));
    const householdSpeaker =
      l.side === 'family' ||
      v.families.some((f) => f.name === l.speaker || f.household.some((member) => member.name === l.speaker));
    return `<p data-scene-line ${l.side ? `data-scene-side="${l.side}"` : ''} class="${l.kind === 'speech' && !narration ? 'speech' : l.kind === 'notice' || narration ? 'notice-line' : ''} ${l.side ? `side-${l.side}` : ''}">${l.speaker && !narration ? `<strong>${h(l.speaker)}:</strong> ` : ''}${h(householdSpeaker ? familySpeech(l.text) : l.text)}</p>`;
  };
  return `<section class="scene-sheet ${moreChoices ? 'all-questions' : ''} ${s.kind === 'interview' ? 'interview-sheet' : ''}" data-testid="scene" data-scene-id="${h(s.id)}" aria-label="${h(s.title)}"><header class="sheet-heading lk-sheet-head"><h2>${moreChoices ? `All ${s.kind === 'interview' ? 'questions' : 'choices'} · ${choices.length}` : h(s.title)}</h2>${moreChoices ? '<button type="button" data-action="fewer-choices">Fewer</button>' : ''}</header><div class="lk-sheet-body scene-reading"><div class="exchange" role="region" aria-label="Latest words">${(moreChoices ? latest.slice(-1) : s.lines).map(line).join('')}</div>${s.kind === 'negotiation' && s.negotiation ? `<p class="terms-summary">${h(termsLine(s.negotiation.terms))}</p>` : ''}${
    s.added?.length ? `<p class="added" role="status">${h(addedEvidence(s.added))}</p>` : ''
  }</div><div class="lk-commit">${v.heldScene ? `<p class="held-scene">${h(v.heldScene.title)} is waiting.</p>` : ''}${s.kind === 'negotiation' && s.negotiation ? `<p class="placement-deadline">${h(placementDeadline(v, s.negotiation.family))}</p>` : ''}${s.interviewPace ? `<p class="question-cost">Each question takes 8–12 minutes. ${s.questionsRemaining === undefined ? h(s.interviewPace) : s.questionsRemaining > 0 ? `${s.questionsRemaining} ${s.questionsRemaining === 1 ? 'question remains' : 'questions remain'} before you must decide.` : `0 questions remain. ${h(s.interviewPace)}`}</p>` : ''}<div class="scene-choices">${choices
    .slice(0, moreChoices ? choices.length : visibleChoices)
    .map((c) => choiceHtml(c, false))
    .join(
      '',
    )}</div>${!moreChoices && choices.length > visibleChoices ? `<button type="button" data-action="more-choices">${s.kind === 'interview' ? 'More questions' : 'More choices'} · ${choices.length - visibleChoices}</button>` : ''}${s.kind === 'negotiation' && s.negotiation ? '<button type="button" data-action="edit-terms">Edit the offer</button>' : ''}${endings.length ? `<div class="interview-finish">${endings.map((c) => choiceHtml(c, false)).join('')}</div>` : s.canLeave ? '<button type="button" data-action="leave-scene">Finish</button>' : ''}</div></section>`;
}
function dayHtml(v: View): string {
  const d = v.dayCard;
  if (!d) return '';
  return `<section class="day-card lk-sheet-body"><h2>${h(d.dateLabel)} · Office closed</h2>${d.lines.map((l) => `<p>${h(l)}</p>`).join('')}${guestsHtml(v)}<p class="tomorrow">${h(d.tomorrow)}</p></section><div class="lk-commit"><button type="button" class="primary" data-action="sleep">Sleep · open ${h(d.tomorrow.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)?.[0] ?? 'tomorrow')} 08:30</button></div>`;
}
function cityHtml(v: View): string {
  return `<h2>In the city</h2>${v.city.figures.map((f) => `<button type="button" data-city-figure="${h(f.id)}" aria-pressed="${cityPerson === f.id}">${h(f.name)} · ${h(f.place ?? 'in the city')}</button>`).join('')}`;
}
function updateCity(v: View): void {
  const canvas = root.querySelector<HTMLCanvasElement>('#city');
  const targets = root.querySelector<HTMLElement>('.city-targets');
  if (!canvas || !targets) return;
  const positions = cityFigurePositions(v);
  const selected = positions.find((p) => p.figure.id === cityPerson);
  const caption = root.querySelector<HTMLElement>('[data-city-person]');
  if (caption) {
    caption.hidden = !city || !!v.phoneRinging;
    caption.textContent = [
      selected ? `${selected.figure.name} · ${selected.place}` : '',
      ...v.city.threads
        .filter((t) => t.consequence && v.now >= t.end)
        .slice(-2)
        .map((t) => t.consequence),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  drawCity(canvas, v, cityPerson ?? undefined);
  // Groups share a target and a labelled list, so dense meetings never stack hit areas.
  const groups: {
    x: number;
    y: number;
    right: number;
    bottom: number;
    ids: string[];
  }[] = [];
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
  root.innerHTML = `<main class="review">${topbar(`Month’s end · ${h(v.dateLabel.replace(/^\w+ /, '').replace('November', 'Nov'))}`)}<section class="review-body"><p class="eyebrow">${h(v.dateLabel)}</p><h1>A month in Good Hands</h1><p>You have ${money(r.cash)} left. ${h(r.trustedBy.length ? `${r.trustedBy.map((id) => person(v, id)).join(', ')} trust Nermin.` : 'People across the city have heard about Nermin’s agency.')}</p>${monthTally(v)}<h2>Her notes beside the truth</h2>${r.people
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
    )}<h2>Inside the houses</h2>${r.placements.map((p) => `<article>${p.story.map((line) => `<p>${h(line)}</p>`).join('')}</article>`).join('')}<h2>Who spoke to whom</h2><canvas id="review-city" role="img" aria-label="People who spoke to each other during the month"></canvas>${r.threads.map((t) => `<p>${h(person(v, t.from))} → ${h(person(v, t.to))} · ${h(t.place)}${t.about ? ` · ${h(person(v, t.about))}` : ''}</p>`).join('')}<p class="review-question">${h(r.question)}</p></section><div class="review-actions lk-commit"><button type="button" data-action="send-run">Feedback</button><button type="button" data-action="download">Download this run</button><button type="button" class="primary" data-action="new-month">New game</button></div></main>`;
  const canvas = root.querySelector<HTMLCanvasElement>('#review-city');
  if (canvas) drawCity(canvas, { ...v, city: { ...v.city, threads: r.threads } });
  gloss(root);
}

function closeSheet(restore = true): void {
  if (!sheet) return;
  sheet.remove();
  sheet = null;
  modal = '';
  updateInspection = null;
  const origin = restore ? sheetOrigins.pop() : undefined;
  if (origin) {
    sheet = origin.node;
    modal = origin.kind;
    updateInspection = origin.inspection;
    (root.querySelector('.game') ?? root.querySelector('main') ?? root).append(sheet);
  } else for (const previous of sheetOrigins.splice(0)) previous.node.remove();
  const panel = root.querySelector<HTMLElement>('[data-content]');
  if (panel) panel.hidden = !!sheet;
  last = performance.now();
  if (restore && playing && !sheet) render(true);
}
function openSheet(title: string, content: string, kind = 'inspect'): HTMLElement {
  if (sheet) {
    sheetOrigins.push({
      node: sheet,
      kind: modal,
      inspection: updateInspection,
    });
    sheet.remove();
  }
  const d = document.createElement('section');
  d.className = kind === 'menu' ? 'overlay menu-overlay' : 'sheet takeover';
  d.setAttribute('aria-label', title);
  d.innerHTML = `<div class="${kind === 'menu' ? 'menu-sheet' : 'takeover-inner'}"><header class="sheet-heading lk-sheet-head"><button type="button" data-close aria-label="${kind === 'menu' ? 'Close menu' : 'Back'}">${kind === 'menu' ? '×' : '←'}</button><h2>${h(title)}</h2></header><div class="sheet-content lk-sheet-body">${content}</div><p class="sheet-status" role="status"></p></div>`;
  sheet = d;
  modal = kind;
  updateInspection = null;
  (root.querySelector('.game') ?? root.querySelector('main') ?? root).append(d);
  const panel = root.querySelector<HTMLElement>('[data-content]');
  if (panel) panel.hidden = true;
  d.querySelector('[data-close]')?.addEventListener('click', () => closeSheet());
  if (kind === 'menu')
    d.addEventListener('click', (e) => {
      if (e.target === d) closeSheet();
    });
  gloss(d);
  d.querySelector<HTMLElement>('[data-close]')?.focus({ preventScroll: true });
  updateClockIfPlaying();
  return d;
}
function updateClockIfPlaying(): void {
  if (playing && state) updateClock(current());
}
function confirmNewGame(container: Element): void {
  container.querySelector('.restart-confirm')?.remove();
  const confirm = document.createElement('div');
  confirm.className = 'restart-confirm';
  confirm.innerHTML = '<p>A new month replaces your saved month after it starts successfully.</p>';
  confirm.append(
    button('Start new game', () => {
      void newMonth();
    }),
    button('Cancel', () => confirm.remove()),
  );
  container.append(confirm);
}
function menu(): void {
  if (state) save();
  const d = openSheet(
    'Game menu',
    `<button type="button" data-action="send-run">Feedback</button><button type="button" data-action="fullscreen">Full screen</button><a href="${ALL_GAMES}" target="_top">All games</a><div class="recording-footer"></div><button type="button" data-new-game>New game</button>${labTools ? `<details open><summary>Lab tools</summary><button type="button" data-action="title">To the title page</button>${state ? '<button type="button" data-action="day-notes">The day’s notes</button>' : ''}<div class="page-setting">Page ${['System', 'Light', 'Dark'].map((theme) => `<button type="button" data-theme-choice="${theme.toLowerCase()}">${theme}</button>`).join('')}</div><div class="pace-setting">${['Automatic', 'Slow', 'Steady', 'Fast'].map((speed) => `<button type="button" data-pace-choice="${speed.toLowerCase()}">${speed}</button>`).join('')}</div><button type="button" data-action="people">People between games</button><button type="button" data-action="import">Import a run</button>${state ? '<button type="button" data-action="download">Download this run</button>' : ''}</details>` : ''}`,
    'menu',
  );
  d.querySelector('.recording-footer')?.append(telemetryToggle(lab));
  const confirmationContent = d.querySelector<HTMLElement>('.sheet-content');
  if (!confirmationContent) throw new Error('Missing new-game confirmation content.');
  d.querySelector('[data-new-game]')?.addEventListener('click', () => confirmNewGame(confirmationContent));
  const commit = document.createElement('div');
  commit.className = 'lk-commit';
  commit.append(button('Resume', () => closeSheet(), 'primary'));
  d.querySelector('.menu-sheet')?.append(commit);
}
function redraw(): void {
  if (playing) render(true);
}
function referenceSheet(): void {
  const c = candidate(current());
  if (!c) return;
  const d = openSheet(
    `Call a reference · ${c.name}`,
    `<p>The phone call takes about 15 minutes.</p>${c.referees.map((r) => `<div class="reference-option"><button type="button" data-referee="${h(r.id)}" ${referenceReason(r) ? 'disabled' : ''}>Call ${h(r.name)}<small data-referee-reason="${h(r.id)}">${h(referenceReason(r) ?? 'Reachable now')}</small></button></div>`).join('') || '<p>You have no former employer to call yet. Ask about the last family during the interview.</p>'}`,
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
      const busy = latest
        ? candidateAvailability(latest)
        : 'This applicant is no longer in your agency records.';
      if (b) b.disabled = !!referenceReason(referee) || !!busy;
      if (reason) reason.textContent = busy ?? referenceReason(referee) ?? 'Reachable now';
    }
  };
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function termsLine(t: EmploymentTerms): string {
  const clock = (hour: number) =>
    `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
  return `The wage is ${money(t.wage)} a month. Work is from ${clock(t.startHour)} to ${clock(t.endHour)}, with ${DAYS[t.dayOff]} off. The trial lasts ${t.trialDays} working ${t.trialDays === 1 ? 'day' : 'days'}. The agency fee is ${money(t.fee)}.`;
}
function editTerms(): void {
  const scene = current().scene;
  if (scene?.kind !== 'negotiation' || !scene.negotiation) return;
  const terms = { ...scene.negotiation.terms };
  const rows = [
    ['wage', 'Monthly wage', 500],
    ['fee', 'Agency fee', 100],
    ['startHour', 'Start hour', 0.5],
    ['endHour', 'Finish hour', 0.5],
    ['trialDays', 'Trial working days', 1],
  ] as const;
  const d = openSheet(
    'Edit the offer',
    `<p data-terms-summary>${h(termsLine(terms))}</p>${rows.map(([key, label]) => `<div class="stepper"><span>${label}</span><button type="button" data-step="${key}" data-delta="-1" aria-label="Decrease ${label.toLowerCase()}">−</button><output data-term-output="${key}">${terms[key]}</output><button type="button" data-step="${key}" data-delta="1" aria-label="Increase ${label.toLowerCase()}">+</button></div>`).join('')}<fieldset><legend>Day off</legend><div class="day-chips">${DAYS.map((day, i) => `<button type="button" data-day="${i}" aria-pressed="${i === terms.dayOff}">${day.slice(0, 3)}</button>`).join('')}</div></fieldset>`,
  );
  const commit = document.createElement('div');
  commit.className = 'lk-commit';
  commit.innerHTML = `<p class="placement-deadline">${h(placementDeadline(current(), scene.negotiation.family))}</p><p class="reason" data-terms-error></p>`;
  const propose = button(
    'Say these terms to both sides',
    () => {
      if (validTerms(terms)) {
        closeSheet(false);
        send({ type: 'propose-terms', scene: scene.id, terms });
      }
    },
    'primary',
  );
  commit.append(propose);
  d.querySelector('.takeover-inner')?.append(commit);
  const update = () => {
    propose.disabled = !validTerms(terms);
    const error = d.querySelector('[data-terms-error]');
    if (error)
      error.textContent = propose.disabled
        ? 'Use a positive wage, finish after start (00:00–24:00), and a trial of 1–14 days.'
        : '';
    const summary = d.querySelector('[data-terms-summary]');
    if (summary) summary.textContent = termsLine(terms);
    for (const [key] of rows) {
      const output = d.querySelector(`[data-term-output="${key}"]`);
      if (output) output.textContent = String(terms[key]);
    }
  };
  for (const control of d.querySelectorAll<HTMLButtonElement>('[data-step]'))
    control.onclick = () => {
      const row = rows.find(([key]) => key === control.dataset.step);
      if (!row) return;
      const key = row[0];
      terms[key] += row[2] * Number(control.dataset.delta);
      update();
    };
  for (const control of d.querySelectorAll<HTMLButtonElement>('[data-day]'))
    control.onclick = () => {
      terms.dayOff = Number(control.dataset.day);
      for (const chip of d.querySelectorAll<HTMLButtonElement>('[data-day]'))
        chip.setAttribute('aria-pressed', String(chip === control));
      update();
    };
  update();
}
function householdPhone(familyId: string): void {
  const family = current().families.find((f) => f.id === familyId);
  if (!family) return;
  let member = family.household.find((m) => m.id && !m.phoneUnavailable);
  const topics = [
    ['progress', 'How is the household managing?'],
    ['complaint', 'Tell me what is wrong.'],
    ['smooth', 'Let us settle this calmly.'],
    ['worker', 'How is the worker being treated?'],
  ] as const;
  const d = openSheet(
    `Phone ${family.name}`,
    `<div class="member-chips">${family.household.map((m) => `<div><button type="button" data-member="${h(m.id ?? '')}" aria-pressed="${m === member}" ${!m.id || m.phoneUnavailable ? 'disabled' : ''}>${h(m.name)} · ${h(m.who)}</button>${m.phoneUnavailable ? `<p class="reason">${h(m.phoneUnavailable)}</p>` : ''}</div>`).join('')}</div>${topics.map(([topic, label]) => `<button type="button" data-topic="${topic}" ${member ? '' : 'disabled'}>${label}</button>`).join('')}`,
  );
  for (const control of d.querySelectorAll<HTMLButtonElement>('[data-member]'))
    control.onclick = () => {
      member = family.household.find((m) => m.id === control.dataset.member);
      for (const chip of d.querySelectorAll<HTMLButtonElement>('[data-member]'))
        chip.setAttribute('aria-pressed', String(chip === control));
    };
  for (const control of d.querySelectorAll<HTMLButtonElement>('[data-topic]'))
    control.onclick = () => {
      if (!member?.id) return;
      closeSheet(false);
      send({
        type: 'call-household',
        family: familyId,
        member: member.id,
        topic: control.dataset.topic as HouseholdTopic,
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
      )}${(state?.version ?? 0) >= 3 ? `<button type="button" data-phone-family="${h(id)}">Phone ${h(f.name)}</button>` : ''}<button type="button" data-action="choose-worker">Choose a worker from the bench</button>`,
  );
}
function matchSheet(kind: 'trial' | 'place'): void {
  const v = current(),
    c = candidate(v);
  if (!c) return;
  const requests = v.requests.filter((r) => r.status === 'open');
  const d = openSheet(
    kind === 'trial' ? 'Send for a trial morning' : `Negotiate for ${c.name}`,
    `<div class="family-chips">${requests.map((r, i) => `<button type="button" data-match-family="${h(r.family)}" aria-pressed="${i === 0}">${h(person(v, r.family))} · ${h(r.role)}</button>`).join('')}</div><p ${kind === 'place' ? 'data-fee-terms' : ''}>${kind === 'trial' ? 'The applicant will spend the next morning with the family. The family reports back later.' : `${h(placementDepositWords(state?.version ?? 1))} The rest of the fee is paid after the trial if the worker stays. The family remembers the qualities you promise.`}</p>${!requests.length ? '<p>No families have open requests. Answer a family’s call first.</p>' : ''}${kind === 'place' ? `<fieldset><legend>Which qualities will you promise?</legend><div class="vouch-controls">${QUALITIES.map((q) => `<button type="button" class="vouch" data-vouch="${q}" aria-pressed="false">${h(vouchLabel(c, q))}</button>`).join('')}</div><details class="vouch-evidence"><summary>Read the evidence</summary>${QUALITIES.map((q) => `<p><strong>${q}</strong> — ${h(evidence(c, q))}</p>`).join('')}</details></fieldset>` : ''}<p id="match-reason" data-match-reason class="reason"></p><button type="button" data-confirm-match aria-describedby="match-reason" ${!requests.length ? 'disabled' : ''}>${kind === 'trial' ? 'Send for a trial' : (state?.version ?? 0) >= 3 ? 'Propose to this family' : 'Place with this family'}</button>`,
  );
  const commit = document.createElement('div');
  commit.className = 'lk-commit';
  commit.innerHTML = '<p data-match-deadline class="placement-deadline"></p>';
  for (const element of d.querySelectorAll('[data-match-reason], [data-confirm-match]'))
    commit.append(element);
  d.querySelector('.takeover-inner')?.append(commit);
  let familyChoice = requests[0]?.family;
  const confirm = d.querySelector<HTMLButtonElement>('[data-confirm-match]');
  const update = () => {
    const live = current();
    const request = live.requests.find((r) => r.status === 'open' && r.family === familyChoice);
    const deadline = d.querySelector('[data-match-deadline]');
    if (deadline) deadline.textContent = placementDeadline(live, familyChoice ?? '');
    const liveCandidate = candidates(live).find((p) => p.id === c.id) ?? c;
    const reason = matchingReason(liveCandidate, request, kind, state?.version);
    const line = d.querySelector('[data-match-reason]');
    if (line) line.textContent = reason ?? '';
    const terms = d.querySelector('[data-fee-terms]');
    if (terms)
      terms.textContent = `${placementDepositWords(
        state?.version ?? 1,
        live.placements.some((p) => p.family === familyChoice),
      )} The rest of the fee is paid after the trial if the worker stays. The family remembers the qualities you promise.`;
    if (confirm) {
      confirm.disabled = !request || !!reason;
      confirm.classList.add('primary');
      confirm.textContent =
        kind === 'trial'
          ? `Send to ${person(live, familyChoice ?? '')} for a morning`
          : (state?.version ?? 0) >= 3
            ? `Propose to ${person(live, familyChoice ?? '')}`
            : 'Place with this family';
    }
  };
  for (const toggle of d.querySelectorAll<HTMLButtonElement>('[data-vouch]')) {
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true'));
    });
  }
  for (const chip of d.querySelectorAll<HTMLButtonElement>('[data-match-family]'))
    chip.onclick = () => {
      familyChoice = chip.dataset.matchFamily;
      for (const other of d.querySelectorAll<HTMLButtonElement>('[data-match-family]'))
        other.setAttribute('aria-pressed', String(other === chip));
      update();
    };
  updateInspection = update;
  update();
  confirm?.addEventListener('click', () => {
    const family = familyChoice;
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
    `<p>${h(placementTiming(p))}</p><p>${h(p.lastWord || 'The family has not reported back yet.')}</p>${p.terms ? `<p>${h(termsLine(p.terms))}</p>` : ''}${(state?.version ?? 0) >= 3 ? `<button type="button" data-phone-family="${h(p.family)}">Speak to someone in the house</button>` : ''}${p.arrangement ? `<p>${h(p.arrangement)}</p>` : ''}${p.pending ? `<p>${h(p.pending.dateLabel)}: ${h(p.pending.text)}</p>` : ''}<p data-check-reason class="reason"></p><button type="button" data-check="phone" data-placement-id="${h(id)}">Check in by phone<small>This takes about 15 minutes.</small></button><button type="button" data-check="visit" data-placement-id="${h(id)}">Visit the house<small>The visit takes an hour, plus the journey.</small></button><button type="button" data-check="drop-by" data-placement-id="${h(id)}">Ask the worker to drop by<small>After work</small></button><details><summary>Bring the worker back</summary><p>The worker will leave this house and return to your agency records. The family loses its worker.</p><button type="button" data-withdraw="${h(id)}">Withdraw this worker</button></details>`,
  );
  updateInspection = () => {
    const live = current();
    const placement = live.placements.find((entry) => entry.id === id);
    const reason =
      !placement || !['trial', 'kept'].includes(placement.status)
        ? 'This placement has ended.'
        : placement.checkInAt !== undefined && live.now < placement.checkInAt
          ? `The family has not given a new answer yet. Check again ${clockLabels(placement.checkInAt).dateLabel}, ${clockLabels(placement.checkInAt).timeLabel}.`
          : '';
    const line = d.querySelector('[data-check-reason]');
    if (line) line.textContent = plainText(reason);
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
      await validateContinuity(run.continuity, run.state, run.inputs);
      await begin(run.state, run.inputs, run.continuity, true);
      notice = 'This run has loaded. The clock resumes from its saved minute.';
      noticeUntil = performance.now() + 6000;
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
function guestsHtml(v: View): string {
  return (
    (v.castContacts ?? [])
      .map(
        (c) =>
          `<article class="guest-card"><h3>${h(c.name)} · ${h(c.role)}</h3><p>${h(c.text)}</p>${c.choices.map((q) => `<button type="button" data-cast-person="${h(c.id)}" data-cast-choice="${h(q.id)}">${h(q.label)}</button>`).join('')}</article>`,
      )
      .join('') +
    (v.guests ?? [])
      .map(
        (g) =>
          `<article class="guest-card"><h3>${h(g.name)} · ${g.id === 'zeynep-pass' ? 'guest cook' : 'telephone enquiry'}</h3><p>${h(g.text)}</p>${g.choices.map((c) => `<button type="button" data-guest="${h(g.id)}" data-guest-action="${h(c.action)}" ${c.disabled ? 'disabled' : ''}>${h(c.label)}${c.disabled ? `<small>${h(c.disabled)}</small>` : ''}</button>`).join('')}</article>`,
      )
      .join('')
  );
}
function handleClick(event: Event): void {
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b || b.disabled || waitAnimation) return;
  const v = state ? current() : null;
  if (b.dataset.castPerson && b.dataset.castChoice) {
    send({
      type: 'cast-talk',
      person: b.dataset.castPerson as import('../sim/cast.ts').CastKey,
      choice: b.dataset.castChoice,
    });
    return;
  }
  if (b.dataset.guest && b.dataset.guestAction) {
    send({
      type: 'guest-action',
      guest: b.dataset.guest as GuestId,
      action: b.dataset.guestAction as GuestAction,
    });
    return;
  }
  if (b.dataset.paceChoice) {
    paceChoice = b.dataset.paceChoice as typeof paceChoice;
    for (const control of root.querySelectorAll('[data-pace-choice]'))
      control.setAttribute(
        'aria-pressed',
        String((control as HTMLElement).dataset.paceChoice === paceChoice),
      );
    return;
  }
  if (b.dataset.themeChoice) {
    if (b.dataset.themeChoice === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = b.dataset.themeChoice;
    for (const control of root.querySelectorAll('[data-theme-choice]'))
      control.setAttribute(
        'aria-pressed',
        String(
          (control as HTMLElement).dataset.themeChoice ===
            (document.documentElement.dataset.theme ?? 'system'),
        ),
      );
    redraw();
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
    send({
      type: 'call-reference',
      candidate: selected,
      referee: b.dataset.referee,
    });
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
    case 'edit-terms':
      editTerms();
      break;
    case 'more-choices':
      moreChoices = true;
      render(true);
      break;
    case 'fewer-choices':
      moreChoices = false;
      render(true);
      break;
    case 'info':
      info();
      break;
    case 'people':
      peoplePanel();
      break;
    case 'other-ways':
      if (!labTools) break;
      openSheet(
        'Other ways in',
        '<button type="button" data-action="import">Load a playtest run</button><button type="button" data-action="people">People between games</button>',
      );
      break;
    case 'day-notes':
      if (v)
        openSheet(
          'The day’s notes',
          v.log
            .slice()
            .reverse()
            .map((l) => `<p>${h(l.text)}</p>`)
            .join(''),
        );
      break;
    case 'fullscreen':
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
      break;
    case 'title':
      closeSheet(false);
      title();
      break;
    case 'call-in':
      if (selected) send({ type: 'call-in', candidate: selected });
      break;
    case 'wait-for':
      if (!v || !canWait(v)) break;
      closeSheet(false);
      send({ type: 'wait-for' });
      break;
    case 'menu':
      menu();
      break;
    case 'new-month':
      confirmNewGame(root.querySelector('.review-actions') ?? root);
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
    case 'download':
      if (state) downloadJson('goodhands-run.json', runExport());
      break;
    case 'send-run':
      feedback();
      break;
    case 'import':
      if (labTools) importFile();
      break;
  }
}
function info(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
    return;
  }
  const v = playing && state ? current() : null;
  const phase = !v
    ? 'start'
    : v.ended
      ? 'review'
      : v.dayCard
        ? 'day'
        : v.scene?.kind === 'negotiation' || sheet?.getAttribute('aria-label')?.startsWith('Negotiate')
          ? 'negotiate'
          : v.scene
            ? 'conversation'
            : 'office';
  const content = {
    start: [
      'Good Hands',
      'You find workers for families who need help at home. Families pay an agency fee for a placement. They remember the qualities you promise. Rent is due every Friday.',
    ],
    office: [
      'The desk',
      'The clock runs during office hours and pauses while you talk. Applicants on the bench wait for a while, then leave. Take an applicant’s number so you can call the applicant in later. An interview takes about 30 minutes. A call to a former employer takes about 15 minutes. A visit takes an hour, plus the journey. Agency fees help you pay the rent.',
    ],
    conversation: [
      'Talking',
      'Each question takes 8–12 minutes. Applicants answer fewer questions as they get tired. Their cards name who gave each account. They distinguish what Nermin observed from what someone told her. Nermin’s reading can remain uncertain. A note Nermin doubts is crossed out.',
    ],
    negotiate: [
      'Your promises',
      `To vouch for a quality is to promise the family that a worker has it. You can promise something you have only heard, but the family remembers if it proves false. Both sides must accept the terms. ${placementDepositWords(state?.version ?? 6)} The rest is paid after the trial if the family keeps the worker.`,
    ],
    day: [
      'Evenings',
      'Life in the city continues after the office closes. Workers are at work, and families talk. You hear their reports tomorrow.',
    ],
    review: [
      'The month',
      'The tally counts placements that lasted and families that trust Nermin. It subtracts placements where workers returned, quit or were dismissed. It does not measure people’s worth.',
    ],
  }[phase];
  overlay = document.createElement('div');
  overlay.className = 'info-overlay';
  overlay.innerHTML = `<section class="info-panel" aria-label="Information"><header><h2>${h(content[0] ?? '')}</h2><button type="button" data-close-info aria-label="Close information">×</button></header><p>${h(content[1] ?? '')}</p><h3>Words</h3></section>`;
  overlay.querySelector('.info-panel')?.append(glossaryPanel());
  const close = () => {
    overlay?.remove();
    overlay = null;
    last = performance.now();
    updateClockIfPlaying();
    root.querySelector<HTMLElement>('[data-action="info"]')?.focus();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay || (e.target as HTMLElement).closest('[data-close-info]')) close();
  };
  root.append(overlay);
  overlay.querySelector<HTMLElement>('button')?.focus();
  updateClockIfPlaying();
}
function feedback(): void {
  closeSheet(false);
  const d = openSheet('Feedback', '', 'feedback');
  d.className = 'feedback-screen';
  const body = d.querySelector<HTMLElement>('.sheet-content');
  if (!body) return;
  let name = '';
  try {
    name = localStorage.getItem('hf-lab-feedback-name') ?? '';
  } catch {}
  body.innerHTML = `<p>Recording follows your choice in the menu. Keep a local copy or send feedback when you choose.</p><div class="verdict-chips">${[
    ['keep', 'I’d keep playing'],
    ['mixed', 'Not sure'],
    ['quit', 'I’d stop here'],
  ]
    .map(([id, label]) => `<button type="button" data-verdict="${id}" aria-pressed="false">${label}</button>`)
    .join('')}</div><div class="verdict-chips">${Object.entries(FEEDBACK_LABELS)
    .map(
      ([id, label]) =>
        `<button type="button" data-feedback-choice="${id}" aria-pressed="false">${h(label)}</button>`,
    )
    .join(
      '',
    )}</div><div data-feedback-persona></div><label class="feedback-note"><span class="sr-only">Your note</span><textarea rows="4" placeholder="Tell us what happened and what got in your way."></textarea></label><details class="feedback-name"><summary>+ Add a name</summary><label>Your name or tester ID (optional)<input data-feedback-name maxlength="60" value="${h(name)}" autocomplete="name"></label><p>It labels your earlier and later runs on this device.</p></details><details><summary>What is sent</summary><p>Your note and optional name are linked to your player ID. This ID does not contain your real name. ${state ? 'While recording is on, your run can include its seed, choices, clock, saved month and log. Recording off sends only your note and optional name.' : ''}</p><a href="https://human.adamwhite.work/lab/privacy/">Lab privacy</a></details>${state ? '<button type="button" data-action="download">Keep a copy of this run ⤓</button>' : ''}`;

  let verdict = '';
  for (const chip of body.querySelectorAll<HTMLButtonElement>('[data-verdict]'))
    chip.onclick = () => {
      verdict = chip.dataset.verdict ?? '';
      for (const c of body.querySelectorAll('[data-verdict]'))
        c.setAttribute('aria-pressed', String(c === chip));
    };
  let selectedLabel = '';
  for (const chip of body.querySelectorAll<HTMLButtonElement>('[data-feedback-choice]'))
    chip.onclick = () => {
      selectedLabel =
        selectedLabel === chip.dataset.feedbackChoice ? '' : (chip.dataset.feedbackChoice ?? '');
      for (const c of body.querySelectorAll<HTMLButtonElement>('[data-feedback-choice]'))
        c.setAttribute('aria-pressed', String(c.dataset.feedbackChoice === selectedLabel));
    };
  const commit = document.createElement('div');
  commit.className = 'lk-commit';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  let sent = false;
  let busy = false;
  const share = feedbackPersonaControl(lab);
  if (share) body.querySelector('[data-feedback-persona]')?.append(share);
  const sendButton = button(
    'Submit',
    () => {
      if (sent) {
        closeSheet();
        return;
      }
      if (busy) return;
      void (async () => {
        busy = true;
        const who = (body.querySelector<HTMLInputElement>('[data-feedback-name]')?.value ?? '')
          .trim()
          .slice(0, 60);
        const note = [
          selectedLabel ? FEEDBACK_LABELS[selectedLabel as keyof typeof FEEDBACK_LABELS] : '',
          verdict ? `Verdict: ${verdict}` : '',
          body.querySelector<HTMLTextAreaElement>('textarea')?.value.trim(),
        ]
          .filter(Boolean)
          .join('\n\n');
        sendButton.disabled = true;
        status.textContent = 'Sending…';
        try {
          let run: unknown;
          try {
            run = state ? runExport() : undefined;
          } catch {
            // An unavailable optional run does not block the note.
          }
          const sharePlay = feedbackSharePlay(share);
          await lab.sendFeedback(note, {
            name: who || undefined,
            run,
            sharePlay,
          });
          try {
            localStorage.setItem('hf-lab-feedback-name', who);
          } catch {}
          sent = true;
          status.textContent = 'Sent. Your note is stored.';
          sendButton.textContent = 'Back to the game';
          sendButton.disabled = false;
        } catch (error) {
          console.error('Feedback failed', error);
          status.textContent =
            labTools && error instanceof Error
              ? error.message
              : 'Your feedback could not be sent. Your note is still here. Try Submit again.';
        } finally {
          busy = false;
          update();
        }
      })();
    },
    'primary',
  );
  commit.append(status, sendButton);
  d.querySelector('.takeover-inner')?.append(commit);
  const update = () => {
    if (sent) return;
    sendButton.disabled = busy;
  };
  body.addEventListener('change', update);
  update();
  const resize = () => {
    d.style.setProperty('--viewport-height', `${window.visualViewport?.height ?? innerHeight}px`);
    d.style.setProperty('--viewport-offset', `${window.visualViewport?.offsetTop ?? 0}px`);
  };
  window.visualViewport?.addEventListener('resize', resize);
  resize();
}
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (overlay) {
    overlay.remove();
    overlay = null;
    last = performance.now();
    updateClockIfPlaying();
  } else closeSheet();
});
function gloss(element: HTMLElement): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (
      !n.parentElement?.closest('button, a, option, .lk-term, script, style') &&
      /\b(Kültürpark|Alsancak|Karşıyaka|lira)\b/u.test(n.data)
    )
      nodes.push(n);
  }
  for (const n of nodes) {
    const fragment = document.createDocumentFragment();
    for (const part of n.data.split(/(Kültürpark|Alsancak|Karşıyaka|lira)/u))
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
    !openingMonth &&
    !state?.castPaused &&
    state &&
    !document.hidden &&
    !overlay &&
    modal !== 'menu' &&
    modal !== 'feedback' &&
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
      state = sim.advance(state, pace(v) * dt);
      changed(previous, current());
      const latest = current().log.at(-1);
      if (latest && latest.id !== previous.log.at(-1)?.id) {
        notice = latest.text;
        noticeUntil = performance.now() + 6000;
      }
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
    const run = runExport();
    lab.setPersonaRecording(continuitySession.recordingKey);
    lab.captureSave({ key: 'run', value: run });
    putNow('run', run);
    lab.flush();
  }
});
window.addEventListener('pagehide', () => {
  if (state) {
    const run = runExport();
    lab.setPersonaRecording(continuitySession.recordingKey);
    lab.captureSave({ key: 'run', value: run });
    putNow('run', run);
  }
});
window.addEventListener('hf-persona-preference', () => {
  generation++;
  continuitySession.invalidate();
});
window.addEventListener('storage', (event) => {
  if (event.key === null || event.key === 'hf-persona-opt-in') {
    generation++;
    continuitySession.invalidate();
  }
});
window.addEventListener('resize', redraw);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
title();
void get<RunExport>('run').then(async (row) => {
  if (row) {
    try {
      const validated = verifyImport(JSON.stringify(row.value));
      await validateContinuity(validated.continuity, validated.state, validated.inputs);
      saved = validated;
    } catch {
      saved = null;
    }
  }
  saveReady = true;
  if (!playing && !sheet) title();
});
requestAnimationFrame(frame);
