import { cleanBaseUrl } from '../utils/url';
import { handleResponseError, parseSseStream } from './sse-parser';
import { formatUserMessage, ProtocolAdapter, TranslateOptions } from './types';

export class OpenAIResponsesAdapter implements ProtocolAdapter {
  protocol = 'openai-responses' as const;

  async *translate(options: TranslateOptions): AsyncIterable<string> {
    const url = `${cleanBaseUrl(options.baseUrl)}/responses`;
    const isStreaming = options.streaming !== false;

    const { thinking, reasoning_effort, ...restParams } = options.params || {};

    const body: Record<string, any> = {
      model: options.model,
      input: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: formatUserMessage(options) },
      ],
      stream: isStreaming,
      ...restParams,
    };

    if (thinking !== undefined) {
      if (thinking) {
        const effort = reasoning_effort || 'high';
        body.thinking = { type: 'enabled' };
        body.reasoning_effort = effort;
        body.reasoning = { effort };
      } else {
        body.thinking = { type: 'disabled' };
        body.reasoning_effort = 'none';
        body.reasoning = { effort: 'none' };
      }
    } else if (reasoning_effort) {
      body.reasoning_effort = reasoning_effort;
      body.reasoning = { effort: reasoning_effort };
    }

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
      let text = '';
      if (typeof json.output_text === 'string' && json.output_text) {
        text = json.output_text;
      } else if (Array.isArray(json.output)) {
        // Look for the message item, skipping any reasoning items
        const messageItem =
          json.output.find((item: any) => item.type === 'message') ||
          json.output.find((item: any) => item.type !== 'reasoning') ||
          json.output[json.output.length - 1];

        if (messageItem) {
          if (typeof messageItem.content === 'string') {
            text = messageItem.content;
          } else if (Array.isArray(messageItem.content)) {
            const textPart =
              messageItem.content.find((p: any) => p.type === 'output_text' || p.type === 'text') ||
              messageItem.content[0];
            text = textPart?.text || '';
          }
        }
      } else if (json.choices?.[0]?.message?.content) {
        text = json.choices[0].message.content;
      }
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

        // Explicitly ignore reasoning / thinking delta events
        if (
          json.type === 'response.reasoning_text.delta' ||
          json.type?.startsWith('response.reasoning')
        ) {
          continue;
        }

        // Output text delta (OpenAI Responses API / DeepSeek Responses API)
        if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') {
          yield json.delta;
        } else if (json.type === 'response.done' || json.type === 'response.completed') {
          break;
        } else if (
          (!json.type || json.type === 'message.delta' || json.type === 'content_block.delta') &&
          typeof json.delta === 'string'
        ) {
          yield json.delta;
        } else if (typeof json.choices?.[0]?.delta?.content === 'string') {
          yield json.choices[0].delta.content;
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }
}
