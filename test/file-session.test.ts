import { expect, it, vi } from 'vitest';
import { advance, apply, newGame } from '../src/sim/index.ts';
import { compactRun, exportRun, verifyImport } from '../src/ui/export.ts';
import { createFileSession } from '../src/ui/file-session.ts';
import { pausedRun } from './paused-run.ts';

const file = (data: unknown) =>
  new File([JSON.stringify(data)], 'run.json', { type: 'application/json', lastModified: 123 });
it('preserves exact source bytes and paused full/compact histories until explicit replayable Resume', async () => {
  const original = await pausedRun(true);
  for (const run of [original, compactRun(original)]) {
    const session = createFileSession();
    const source = file({ ...run, futureMetadata: { note: 'retain me' } });
    expect(await session.select(source)).toBe(true);
    expect(session.snapshot()?.state).toEqual(original.state);
    expect(session.snapshot()?.inputs).toEqual(original.inputs);
    expect(new Uint8Array(session.original()!.bytes)).toEqual(new Uint8Array(await source.arrayBuffer()));
    expect(session.original()).toMatchObject({ name: 'run.json', lastModified: 123, size: source.size });
    expect(session.original()?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(session.compact).toBe(!('state' in run));
    const held = session.snapshot();
    session.advance(1);
    expect(session.snapshot()).toEqual(held);
    session.resume();
    session.apply({ type: 'speed', speed: 2 });
    session.advance(1);
    const state = structuredClone(original.state);
    apply(state, { type: 'resume-cast' });
    apply(state, { type: 'speed', speed: 2 });
    advance(state, 1);
    expect(session.snapshot()?.state).toEqual(state);
    expect(session.snapshot()).toHaveProperty('futureMetadata.note', 'retain me');
    expect(verifyImport(JSON.stringify(session.snapshot())).state).toEqual(state);
  }
});
it('invalid, empty and canceled selections retire pending reads without replacing the held complete run', async () => {
  const run = exportRun(newGame(19), []);
  const session = createFileSession();
  await session.select(file(run));
  const held = session.snapshot();
  let release!: (value: ArrayBuffer) => void;
  const delayed = file(exportRun(newGame(20), []));
  const bytes = await delayed.arrayBuffer();
  delayed.arrayBuffer = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  for (const cancel of [
    () => session.select(file({})).catch(() => {}),
    () => session.select(),
    () => session.invalidate(),
  ]) {
    const pending = session.select(delayed);
    await cancel();
    release(bytes);
    expect(await pending).toBe(false);
    expect(session.snapshot()).toEqual(held);
  }
});
it('refuses whole staged input/frame histories at capacity and keeps the last complete original and export', async () => {
  const run = exportRun(newGame(21), []);
  const raw = file(run);
  const currentBytes = new TextEncoder().encode(JSON.stringify(run)).length;
  const session = createFileSession({ currentBytes, aggregateBytes: currentBytes + raw.size });
  await session.select(raw);
  session.resume();
  const held = session.snapshot();
  expect(() => session.apply({ type: 'speed', speed: 2 })).toThrow(/capacity/i);
  expect(session.snapshot()).toEqual(held);
  expect(session.running).toBe(false);
  expect(session.original()?.size).toBe(raw.size);
  session.resume();
  expect(() => session.advance(0.01)).toThrow(/capacity/i);
  expect(session.snapshot()).toEqual(held);
});

it('retires a validation already waiting for SHA-256, and bounds decompression without dropping the original', async () => {
  const run = exportRun(newGame(22), []);
  const session = createFileSession({ selectedBytes: 300_000 });
  await session.select(file(run));
  const held = session.snapshot();
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    entered();
    await gate;
    return digest(...args);
  });
  try {
    const pending = session.select(file(exportRun(newGame(23), [])));
    await waiting;
    session.invalidate(); // pagehide/close retires a digest already in flight.
    release();
    expect(await pending).toBe(false);
    expect(session.snapshot()).toEqual(held);
  } finally {
    spy.mockRestore();
  }
  const expanded = new Blob([JSON.stringify({ ...run, retained: 'a'.repeat(300_000) })]);
  const gzip = await new Response(expanded.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  await expect(session.select(new File([gzip], 'run.json.gz'))).rejects.toThrow(/Expanded/);
  expect(session.snapshot()).toEqual(held);
});
