import type { RunExport } from './export.ts';

export const RECEIVING_KEY = 'receiving';
export type NativeSnapshot = { value: unknown; token: string | null };
export type ReceivingJournal = {
  id: string;
  phase: 'prepared' | 'sending' | 'acknowledged';
  run: RunExport;
  expectedHeads: Record<string, string | null>;
  priorNative: NativeSnapshot;
  createdAt: number;
};
