export class RequestBodyError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RequestBodyError';
    this.status = status;
  }
}

type BodySource = Pick<Request, 'headers' | 'body'>;

// Also accepts a Response, so signed provider payloads can keep their exact bytes.
export async function readRequestBytes(source: BodySource, maxBytes: number, timeoutMs = 5000): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('Positive byte and timeout limits are required.');
  }
  const length = source.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes)) {
    void source.body?.cancel().catch(() => {});
    throw new RequestBodyError('Request too large.', 413);
  }
  if (!source.body) return new Uint8Array();
  const reader = source.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestBodyError('Request body timed out.', 408)), timeoutMs);
  });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RequestBodyError('Request too large.', 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    // Cancellation itself may stall; never wait for it before rejecting the read.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function readRequestText(source: BodySource, maxBytes: number, timeoutMs = 5000): Promise<string> {
  const bytes = await readRequestBytes(source, maxBytes, timeoutMs);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new RequestBodyError('Request body must be valid UTF-8.', 400); }
}
