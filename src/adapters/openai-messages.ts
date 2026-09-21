import { cleanBaseUrl } from '../utils/url';
import { handleResponseError, parseSseStream } from './sse-parser';
import { buildConversation, ProtocolAdapter, TranslateOptions } from './types';

export class OpenAIMessagesAdapter implements ProtocolAdapter {
  protocol = 'openai-messages' as const;

  async *translate(options: TranslateOptions): AsyncIterable<string> {
    const url = `${cleanBaseUrl(options.baseUrl)}/chat/completions`;
    const isStreaming = options.streaming !== false;

    const conversation = buildConversation(options);
    const body: Record<string, any> = {
      model: options.model,
      messages: [
        { role: 'system', content: conversation.system },
        ...conversation.memoryTurns,
        { role: 'user', content: conversation.userMessage },
      ],
      stream: isStreaming,
      ...(options.params || {}),
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      throw {
        message: `网络连接失败: ${err?.message || '无法连接到 API 端点'}`,
        canRetry: true,
      };
    }

    if (!res.ok) {
      await handleResponseError(res);
    }

    // Handle non-streaming response fallback
    const contentType = res.headers.get('content-type') || '';
    if (!isStreaming || !contentType.includes('text/event-stream')) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      yield text;
      return;
    }

    // Stream SSE
    if (!res.body) {
      throw { message: '响应体为空', canRetry: true };
    }

    for await (const message of parseSseStream(res.body, options.signal)) {
      if (message.data === '[DONE]') {
        break;
      }
      try {
        const json = JSON.parse(message.data);
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          yield delta;
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }
}
