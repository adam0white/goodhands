import { verifyArchiveBytes } from './archive-import.ts';

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  void verifyArchiveBytes(event.data).then(
    (run) => self.postMessage({ ok: true, run }),
    (error: unknown) =>
      self.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : 'Archive verification failed.',
      }),
  );
};
