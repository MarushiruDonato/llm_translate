import { AdapterError } from './types';

export interface SseMessage {
  event?: string;
  data: string;
}

/**
 * Parses an incoming ReadableStream of Uint8Array as Server-Sent Events (SSE).
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncIterable<SseMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent: string | undefined;

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = undefined;
          continue;
        }

        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          yield { event: currentEvent, data };
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      yield { event: currentEvent, data: buffer.trim().slice(5).trim() };
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Formats standard HTTP response errors into user-friendly AdapterError objects.
 */
export async function handleResponseError(res: Response): Promise<never> {
  let errorDetail = '';
  try {
    const errorJson = await res.json();
    errorDetail =
      errorJson?.error?.message ||
      errorJson?.message ||
      (typeof errorJson === 'string' ? errorJson : JSON.stringify(errorJson));
  } catch {
    try {
      errorDetail = await res.text();
    } catch {
      // ignore
    }
  }

  const detailSuffix = errorDetail ? `: ${errorDetail.slice(0, 150)}` : '';

  if (res.status === 401 || res.status === 403) {
    const err: AdapterError = {
      message: `API Key 无效或未获得授权 (HTTP ${res.status})${detailSuffix}`,
      canRetry: false,
      statusCode: res.status,
    };
    throw err;
  }

  if (res.status === 429) {
    const err: AdapterError = {
      message: `触发 API 速率或额度限制 (HTTP 429)${detailSuffix}`,
      canRetry: true,
      statusCode: res.status,
    };
    throw err;
  }

  if (res.status >= 500) {
    const err: AdapterError = {
      message: `模型服务商服务器故障 (HTTP ${res.status})${detailSuffix}`,
      canRetry: true,
      statusCode: res.status,
    };
    throw err;
  }

  const err: AdapterError = {
    message: `请求失败 (HTTP ${res.status})${detailSuffix}`,
    canRetry: true,
    statusCode: res.status,
  };
  throw err;
}
