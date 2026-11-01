export type DownloadProgress = { received: number; total: number | null };
const CHUNK_BYTES = 512 * 1024;

class DownloadError extends Error {
  constructor(message: string, readonly retryable = false) { super(message); }
}

type DownloadOptions = {
  headers: Record<string, string>;
  signal?: AbortSignal;
  onProgress: (progress: DownloadProgress) => void;
  idleTimeoutMs?: number;
  maxRetries?: number;
  onRetry?: () => void;
};

/** Download bounded ranges when supported. Retrying a failed block preserves
 * completed blocks, while If-Range prevents combining different file builds. */
export async function downloadFileBlob(
  url: string,
  options: DownloadOptions,
): Promise<Blob> {
  const parts: Blob[] = [];
  let received = 0;
  let total: number | null = null;
  let etag: string | undefined;
  let displayed = 0;
  do {
    options.signal?.throwIfAborted();
    let result: Awaited<ReturnType<typeof downloadBlock>> | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await downloadBlock(url, options, received, total, etag, (count, size) => {
          displayed = Math.max(displayed, received + count);
          options.onProgress({ received: size === null ? displayed : Math.min(displayed, size), total: size });
        });
        break;
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        const retryable = error instanceof TypeError
          || (error instanceof DownloadError && error.retryable)
          || (error instanceof Error && error.name === "TimeoutError");
        if (!retryable || attempt >= (options.maxRetries ?? 3)) throw error;
        options.onRetry?.();
      }
    }
    parts.push(result.blob);
    received += result.blob.size;
    total = result.total;
    etag = result.etag;
    if (!result.ranged) return result.blob;
  } while (total !== null && received < total);
  return new Blob(parts, { type: parts[0]?.type ?? "application/octet-stream" });
}

async function downloadBlock(
  url: string,
  options: DownloadOptions,
  start: number,
  expectedTotal: number | null,
  expectedEtag: string | undefined,
  progress: (received: number, total: number | null) => void,
): Promise<{ blob: Blob; total: number | null; etag?: string; ranged: boolean }> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  let timer: ReturnType<typeof setTimeout>;
  const resetTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new DOMException("Download stalled", "TimeoutError")), options.idleTimeoutMs ?? 60_000);
  };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let complete = false;
  try {
    resetTimeout();
    const end = Math.min(start + CHUNK_BYTES - 1, expectedTotal === null ? Infinity : expectedTotal - 1);
    const headers = { ...options.headers, Range: `bytes=${start}-${end}`, ...(expectedEtag ? { "If-Range": expectedEtag } : {}) };
    const response = await fetch(url, {
      credentials: "include",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (start === 0 && response.status === 416 && response.headers.get("content-range") === "bytes */0") {
      complete = true;
      return { blob: new Blob([]), total: 0, ranged: true };
    }
    if (!response.ok) throw new DownloadError(`Download HTTP ${response.status}`, response.status >= 500 || response.status === 408 || response.status === 429);
    if (!response.body) throw new DownloadError("Download has no body");
    const ranged = response.status === 206;
    let total: number | null;
    let expectedBytes: number | null;
    let etag: string | undefined;
    if (ranged) {
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
      etag = response.headers.get("etag") ?? undefined;
      if (!range || !etag || etag.startsWith("W/")) throw new DownloadError("Invalid download range validator");
      const first = Number(range[1]), last = Number(range[2]), size = Number(range[3]);
      if (![first, last, size].every(Number.isSafeInteger) || first !== start || last < first || last > end || last >= size) throw new DownloadError("Invalid download range");
      if ((expectedTotal !== null && expectedTotal !== size) || (expectedEtag && expectedEtag !== etag)) throw new DownloadError("File changed during download");
      if (response.headers.has("content-encoding") && response.headers.get("content-encoding") !== "identity") throw new DownloadError("Encoded download range");
      total = size;
      expectedBytes = last - first + 1;
    } else {
      if (start > 0) throw new DownloadError("File changed during download");
      // Encoded Content-Length describes compressed bytes, not the decoded stream.
      const length = response.headers.get("content-encoding") ? NaN : Number(response.headers.get("content-length"));
      total = Number.isSafeInteger(length) && length > 0 ? length : null;
      expectedBytes = total;
    }
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    progress(received, total);
    reader = response.body.getReader();
    while (true) {
      resetTimeout();
      const { done, value } = await reader.read();
      // A cancelled reader may report EOF; never save the partial file.
      controller.signal.throwIfAborted();
      if (done) break;
      parts.push(new Uint8Array(value));
      received += value.byteLength;
      if (expectedBytes !== null && received > expectedBytes) throw new DownloadError("Oversized download block");
      progress(received, total);
    }
    if (expectedBytes !== null && received !== expectedBytes) throw new DownloadError("Incomplete download", true);
    complete = true;
    return { blob: new Blob(parts, { type: response.headers.get("content-type") ?? "application/octet-stream" }), total, etag, ranged };
  } finally {
    clearTimeout(timer!);
    options.signal?.removeEventListener("abort", abort);
    if (!complete) {
      controller.abort();
      void reader?.cancel().catch(() => {});
    }
    reader?.releaseLock();
  }
}

/** Give the browser time to consume a large blob before revoking its URL. */
export function saveDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
