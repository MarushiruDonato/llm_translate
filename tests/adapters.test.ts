import { describe, expect, it } from 'vitest';
import { handleResponseError, parseSseStream } from '../src/adapters/sse-parser';
import { OpenAIMessagesAdapter } from '../src/adapters/openai-messages';
import { OpenAIResponsesAdapter } from '../src/adapters/openai-responses';
import { AnthropicAdapter } from '../src/adapters/anthropic';
import { formatUserMessage, getAdapter } from '../src/adapters';

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('parseSseStream', () => {
  it('should parse standard SSE events split across chunks', async () => {
    const stream = createMockStream([
      'data: {"message": "hel',
      'lo"}\n\n',
      'event: custom\ndata: {"message": "world"}\n\n',
    ]);

    const messages = [];
    for await (const msg of parseSseStream(stream)) {
      messages.push(msg);
    }

    expect(messages.length).toBe(2);
    expect(JSON.parse(messages[0].data)).toEqual({ message: 'hello' });
    expect(messages[1].event).toBe('custom');
    expect(JSON.parse(messages[1].data)).toEqual({ message: 'world' });
  });
});

describe('handleResponseError', () => {
  it('should format 401 as non-retryable error', async () => {
    const res = new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      await handleResponseError(res);
      expect.unreachable();
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.canRetry).toBe(false);
      expect(err.message).toContain('API Key 无效');
    }
  });

  it('should format 429 as retryable error', async () => {
    const res = new Response('Rate limit reached', { status: 429 });
    try {
      await handleResponseError(res);
      expect.unreachable();
    } catch (err: any) {
      expect(err.statusCode).toBe(429);
      expect(err.canRetry).toBe(true);
      expect(err.message).toContain('触发 API 速率或额度限制');
    }
  });
});

describe('getAdapter factory', () => {
  it('should return the correct adapter instance', () => {
    expect(getAdapter('openai-messages')).toBeInstanceOf(OpenAIMessagesAdapter);
    expect(getAdapter('openai-responses')).toBeInstanceOf(OpenAIResponsesAdapter);
    expect(getAdapter('anthropic')).toBeInstanceOf(AnthropicAdapter);
  });
});

describe('formatUserMessage with ping pong and rawPrompt', () => {
  it('should return verbatim text when rawPrompt is true', () => {
    const msg = formatUserMessage({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      systemPrompt: 'Respond pong',
      targetLang: 'pong',
      text: 'ping',
      rawPrompt: true,
    });
    expect(msg).toBe('ping');
  });

  it('should wrap text in translation instructions when rawPrompt is false', () => {
    const msg = formatUserMessage({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      systemPrompt: 'Translate',
      targetLang: '中文',
      text: 'hello',
      rawPrompt: false,
    });
    expect(msg).toContain('请将以下内容翻译为「中文」');
    expect(msg).toContain('hello');
  });
});

describe('OpenAIResponsesAdapter thinking and reasoning support', () => {
  it('should ignore reasoning_text.delta and only yield output_text.delta in streaming', async () => {
    const adapter = new OpenAIResponsesAdapter();
    const stream = createMockStream([
      'data: {"type": "response.created"}\n\n',
      'data: {"type": "response.reasoning_text.delta", "delta": "Thinking step 1..."}\n\n',
      'data: {"type": "response.reasoning_text.delta", "delta": "Thinking step 2..."}\n\n',
      'data: {"type": "response.output_text.delta", "delta": "你好"}\n\n',
      'data: {"type": "response.output_text.delta", "delta": "，世界"}\n\n',
      'data: [DONE]\n\n',
    ]);

    const origFetch = global.fetch;
    global.fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });

    try {
      const results: string[] = [];
      for await (const chunk of adapter.translate({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
        systemPrompt: 'Translate',
        targetLang: 'zh-CN',
        text: 'hello world',
      })) {
        results.push(chunk);
      }

      expect(results).toEqual(['你好', '，世界']);
      expect(results.join('')).not.toContain('Thinking');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('should extract message output text and skip reasoning in non-streaming', async () => {
    const adapter = new OpenAIResponsesAdapter();
    const mockJson = {
      output: [
        {
          id: 'item_1',
          type: 'reasoning',
          content: [{ type: 'reasoning_text', text: 'Internal chain of thought' }],
        },
        {
          id: 'item_2',
          type: 'message',
          content: [{ type: 'output_text', text: '你好世界' }],
        },
      ],
    };

    const origFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify(mockJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      const results: string[] = [];
      for await (const chunk of adapter.translate({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
        systemPrompt: 'Translate',
        targetLang: 'zh-CN',
        text: 'hello world',
        streaming: false,
      })) {
        results.push(chunk);
      }

      expect(results).toEqual(['你好世界']);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('should send correct body payload for enabled and disabled thinking mode', async () => {
    const adapter = new OpenAIResponsesAdapter();
    let capturedBody: any = null;

    const origFetch = global.fetch;
    global.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ output_text: 'pong' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    try {
      // 1. Enabled with xhigh effort
      for await (const _ of adapter.translate({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
        systemPrompt: 'Respond pong',
        targetLang: 'pong',
        text: 'ping',
        rawPrompt: true,
        streaming: false,
        params: { thinking: true, reasoning_effort: 'xhigh', temperature: 0.2 },
      })) {}

      expect(capturedBody.thinking).toEqual({ type: 'enabled' });
      expect(capturedBody.reasoning_effort).toBe('xhigh');
      expect(capturedBody.reasoning).toEqual({ effort: 'xhigh' });
      expect(capturedBody.temperature).toBe(0.2);

      // 2. Disabled
      for await (const _ of adapter.translate({
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
        systemPrompt: 'Respond pong',
        targetLang: 'pong',
        text: 'ping',
        rawPrompt: true,
        streaming: false,
        params: { thinking: false, temperature: 0.2 },
      })) {}

      expect(capturedBody.thinking).toEqual({ type: 'disabled' });
      expect(capturedBody.reasoning_effort).toBe('none');
      expect(capturedBody.reasoning).toEqual({ effort: 'none' });
    } finally {
      global.fetch = origFetch;
    }
  });
});

