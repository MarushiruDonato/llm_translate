import { cleanBaseUrl } from '../utils/url';
import { handleResponseError, parseSseStream } from './sse-parser';
import { buildConversation, ProtocolAdapter, TranslateOptions } from './types';

export class OpenAIResponsesAdapter implements ProtocolAdapter {
  protocol = 'openai-responses' as const;

  async *translate(options: TranslateOptions): AsyncIterable<string> {
    const url = `${cleanBaseUrl(options.baseUrl)}/responses`;
    const isStreaming = options.streaming !== false;

    const conversation = buildConversation(options);
    const body: Record<string, any> = {
      model: options.model,
      input: [
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

    const contentType = res.headers.get('content-type') || '';
    if (!isStreaming || !contentType.includes('text/event-stream')) {
      const json = await res.json();
      const text =
        json.output_text ||
        json.output?.[0]?.content?.[0]?.text ||
        json.choices?.[0]?.message?.content ||
        '';
      yield text;
      return;
    }

    if (!res.body) {
      throw { message: '响应体为空', canRetry: true };
    }

    for await (const message of parseSseStream(res.body, options.signal)) {
      if (message.data === '[DONE]') {
        break;
      }
      try {
        const json = JSON.parse(message.data);
        // Look for delta in response.output_text.delta or standard delta text
        if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') {
          yield json.delta;
        } else if (json.delta && typeof json.delta === 'string') {
          yield json.delta;
        } else if (json.type === 'response.done' || json.type === 'response.completed') {
          break;
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }
}
