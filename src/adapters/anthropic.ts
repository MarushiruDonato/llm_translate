import { cleanBaseUrl } from '../utils/url';
import { handleResponseError, parseSseStream } from './sse-parser';
import { formatUserMessage, ProtocolAdapter, TranslateOptions } from './types';

export class AnthropicAdapter implements ProtocolAdapter {
  protocol = 'anthropic' as const;

  async *translate(options: TranslateOptions): AsyncIterable<string> {
    const url = `${cleanBaseUrl(options.baseUrl)}/messages`;
    const isStreaming = options.streaming !== false;

    const body: Record<string, any> = {
      model: options.model,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: formatUserMessage(options) }],
      max_tokens: options.params?.max_tokens || 4096,
      stream: isStreaming,
      ...(options.params || {}),
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      throw {
        message: `网络连接失败: ${err?.message || '无法连接到 Anthropic 端点'}`,
        canRetry: true,
      };
    }

    if (!res.ok) {
      await handleResponseError(res);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!isStreaming || !contentType.includes('text/event-stream')) {
      const json = await res.json();
      const text = json.content?.[0]?.text || '';
      yield text;
      return;
    }

    if (!res.body) {
      throw { message: '响应体为空', canRetry: true };
    }

    for await (const message of parseSseStream(res.body, options.signal)) {
      if (message.event === 'message_stop') {
        break;
      }
      try {
        const json = JSON.parse(message.data);
        if (
          json.type === 'content_block_delta' &&
          json.delta?.type === 'text_delta' &&
          typeof json.delta.text === 'string'
        ) {
          yield json.delta.text;
        }
      } catch {
        // Skip non-JSON or ping lines
      }
    }
  }
}
