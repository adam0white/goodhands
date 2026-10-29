/** Memory-only native export controller. No browser save or Shelf dependencies. */
import * as sim from '../sim/index.ts';
import type { Input } from '../sim/types.ts';
import { exportRun, exportWorkingRun, type RunExport, validateContinuity, verifyImport } from './export.ts';
import { resumeForPlay } from './resume.ts';

const MiB = 1024 * 1024;
const encoder = new TextEncoder();
type Original = {
  bytes: ArrayBuffer;
  size: number;
  name: string;
  type: string;
  lastModified: number;
  sha256: string;
};
type Held = ReturnType<typeof verifyImport> & { source: Record<string, unknown> };
export function createFileSession(
  bounds: { selectedBytes?: number; currentBytes?: number; aggregateBytes?: number } = {},
) {
  const selectedLimit = bounds.selectedBytes ?? 20 * MiB;
  const currentLimit = bounds.currentBytes ?? 20 * MiB;
  const aggregateLimit = bounds.aggregateBytes ?? 40 * MiB;
  // These bounds measure serialized files, not the reconstructed simulation's memory use.
  let epoch = 0;
  let held: Held | null = null;
  let original: Original | null = null;
  let running = false;
  let compact = false;
  function invalidate() {
    epoch++;
    running = false;
  }
  function complete(next: Held): RunExport & Record<string, unknown> {
    return { ...structuredClone(next.source), ...exportRun(next.state, next.inputs, next.continuity) };
  }
  function capacity(next: Held, rawSize = original?.size ?? 0) {
    const size = encoder.encode(JSON.stringify(working(next))).byteLength;
    if (size > currentLimit || rawSize + size > aggregateLimit) {
      running = false;
      throw new Error('File session capacity reached. Download the complete run or choose another file.');
    }
  }
  function working(next: Held) {
    return exportWorkingRun(next.state, next.inputs, next.continuity, next.source);
  }
  function stage(change: (next: Held) => void) {
    if (!held) throw new Error('Choose a run first.');
    const next = structuredClone(held);
    change(next);
    capacity(next);
    held = next;
  }
  return {
    invalidate,
    get epoch() {
      return epoch;
    },
    get running() {
      return running;
    },
    get compact() {
      return compact;
    },
    original: () => (original ? structuredClone(original) : null),
    snapshot: () => (held ? complete(held) : null),
    workingSnapshot: () => (held ? working(held) : null),
    loaded: () =>
      held ? structuredClone({ state: held.state, inputs: held.inputs, continuity: held.continuity }) : null,
    async select(file?: File): Promise<boolean> {
      invalidate();
      const selection = epoch;
      const current = () => selection === epoch;
      if (!file) return false;
      try {
        if (file.size > selectedLimit) throw new Error('Choose a run no larger than 20 MiB.');
        const bytes = await file.arrayBuffer();
        if (!current()) return false;
        if (bytes.byteLength !== file.size || bytes.byteLength > selectedLimit)
          throw new Error('File size changed.');
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        if (!current()) return false;
        let decoded = new Uint8Array(bytes);
        if (decoded[0] === 0x1f && decoded[1] === 0x8b) {
          const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          try {
            for (;;) {
              const part = await reader.read();
              if (!current()) {
                await reader.cancel();
                return false;
              }
              if (part.done) break;
              total += part.value.byteLength;
              if (total > selectedLimit) throw new Error('Expanded run exceeds 20 MiB.');
              chunks.push(part.value);
            }
          } finally {
            await reader.cancel();
          }
          if (!current()) return false;
          decoded = new Uint8Array(total);
          let at = 0;
          for (const chunk of chunks) {
            decoded.set(chunk, at);
            at += chunk.byteLength;
          }
        }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
        const source: unknown = JSON.parse(text);
        safeJson(source);
        const loaded = verifyImport(text);
        await validateContinuity(loaded.continuity, loaded.state, loaded.inputs);
        if (!current()) return false;
        const next = { ...loaded, source: source as Record<string, unknown> };
        capacity(next, bytes.byteLength);
        if (!current()) return false;
        held = next;
        original = {
          bytes: bytes.slice(0),
          size: bytes.byteLength,
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
          sha256: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(''),
        };
        compact = !Object.hasOwn(next.source, 'state');
        return true;
      } catch (error) {
        if (!current()) return false;
        throw error;
      }
    },
    resume() {
      invalidate();
      stage((next) => {
        const resumed = resumeForPlay(next.state, next.inputs);
        next.state = resumed.state;
        next.inputs = resumed.inputs;
      });
      running = true;
    },
    apply(input: Input) {
      if (!running) return;
      stage((next) => {
        const at = sim.view(next.state).now;
        next.state = sim.apply(next.state, input);
        next.inputs.push({ at, input: structuredClone(input) });
      });
    },
    advance(minutes: number) {
      if (!running) return;
      stage((next) => {
        next.state = sim.advance(next.state, minutes);
      });
    },
  };
}
function safeJson(root: unknown) {
  const stack = [{ value: root, depth: 0 }];
  while (stack.length) {
    const item = stack.pop()!;
    const value = item.value;
    if (item.depth > 256) throw new Error('The JSON is too deeply nested.');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid JSON number.');
    if (
      typeof value === 'string' &&
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)
    )
      throw new Error('Invalid JSON text.');
    if (value && typeof value === 'object')
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe JSON property.');
        stack.push({ value: key, depth: item.depth + 1 }, { value: child, depth: item.depth + 1 });
      }
  }
}
