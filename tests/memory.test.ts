import { describe, expect, it } from 'vitest';
import {
  appendMemory,
  boundMemory,
  defaultMemoryLimits,
  truncateMemoryEntry,
} from '../src/utils/memory';
import { buildConversation, MEMORY_SYSTEM_NOTE } from '../src/adapters/types';
import { generateCacheKey } from '../src/utils/crypto';

describe('defaultMemoryLimits', () => {
  it('clamps window size into [1, 10]', () => {
    expect(defaultMemoryLimits(0).windowSize).toBe(1);
    expect(defaultMemoryLimits(99).windowSize).toBe(10);
    expect(defaultMemoryLimits(undefined).windowSize).toBe(3);
  });
});

describe('truncateMemoryEntry', () => {
  it('truncates source and translation independently', () => {
    const entry = {
      source: 'a'.repeat(500),
      translation: 'b'.repeat(500),
    };
    const result = truncateMemoryEntry(entry, 300);
    expect(result.source.length).toBe(300);
    expect(result.translation.length).toBe(300);
  });
});

describe('boundMemory', () => {
  it('keeps only the most recent windowSize entries', () => {
    const memory = [1, 2, 3, 4, 5].map((i) => ({
      source: `src-${i}`,
      translation: `trans-${i}`,
    }));
    const result = boundMemory(memory, { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    expect(result.map((m) => m.source)).toEqual(['src-3', 'src-4', 'src-5']);
  });

  it('evicts oldest entries when total budget is exceeded', () => {
    const memory = [1, 2, 3].map((i) => ({
      source: 'a'.repeat(300),
      translation: 'b'.repeat(300),
    }));
    // Each entry is 600 chars; budget of 1300 allows only 2 entries (1200 <= 1300)
    const result = boundMemory(memory, { windowSize: 3, maxEntryChars: 300, maxTotalChars: 1300 });
    expect(result.length).toBe(2);
    expect(result[0].source.startsWith('a')).toBe(true);
  });
});

describe('appendMemory', () => {
  it('appends new entries and bounds the window', () => {
    let memory = appendMemory([], 'one', '一', { windowSize: 2, maxEntryChars: 300, maxTotalChars: 4000 });
    memory = appendMemory(memory, 'two', '二', { windowSize: 2, maxEntryChars: 300, maxTotalChars: 4000 });
    memory = appendMemory(memory, 'three', '三', { windowSize: 2, maxEntryChars: 300, maxTotalChars: 4000 });
    expect(memory.map((m) => m.source)).toEqual(['two', 'three']);
  });

  it('replaces duplicates anywhere and moves the fresh entry to the end (LRU)', () => {
    let memory = appendMemory([], 'hello', '你好', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    memory = appendMemory(memory, 'world', '世界', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    memory = appendMemory(memory, 'hello', '你好！', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    expect(memory.length).toBe(2);
    expect(memory[0]).toEqual({ source: 'world', translation: '世界' });
    expect(memory[1]).toEqual({ source: 'hello', translation: '你好！' });
  });

  it('retrying the most recent source keeps it in the last position', () => {
    let memory = appendMemory([], 'hello', '你好', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    memory = appendMemory(memory, 'world', '世界', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    memory = appendMemory(memory, 'world', '世界！', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    expect(memory).toEqual([
      { source: 'hello', translation: '你好' },
      { source: 'world', translation: '世界！' },
    ]);
  });

  it('ignores empty source or translation', () => {
    const memory = appendMemory([], '  ', '译文', { windowSize: 3, maxEntryChars: 300, maxTotalChars: 4000 });
    expect(memory).toEqual([]);
  });
});

describe('buildConversation', () => {
  it('renders memory as alternating user/assistant turns and appends system note', () => {
    const conv = buildConversation({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'test-model',
      systemPrompt: 'BASE PROMPT',
      targetLang: 'zh-CN',
      text: 'new text',
      memory: [
        { source: 'old text 1', translation: '旧译文一' },
        { source: 'old text 2', translation: '旧译文二' },
      ],
    });
    expect(conv.system).toBe(`BASE PROMPT\n\n${MEMORY_SYSTEM_NOTE}`);
    expect(conv.memoryTurns).toEqual([
      { role: 'user', content: 'old text 1' },
      { role: 'assistant', content: '旧译文一' },
      { role: 'user', content: 'old text 2' },
      { role: 'assistant', content: '旧译文二' },
    ]);
    expect(conv.userMessage).toContain('new text');
  });

  it('is identical to the base path when memory is empty', () => {
    const base = buildConversation({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'test-model',
      systemPrompt: 'BASE PROMPT',
      targetLang: 'zh-CN',
      text: 'new text',
    });
    expect(base.system).toBe('BASE PROMPT');
    expect(base.memoryTurns).toEqual([]);
  });
});

describe('generateCacheKey with memory', () => {
  it('empty memory produces the same key as no memory field', async () => {
    const common = {
      text: 'Hello',
      model: 'm',
      targetLang: 'zh-CN',
    };
    const k1 = await generateCacheKey(common);
    const k2 = await generateCacheKey({ ...common, memory: [] });
    expect(k1).toBe(k2);
  });

  it('different memory produces different keys', async () => {
    const common = {
      text: 'Hello',
      model: 'm',
      targetLang: 'zh-CN',
    };
    const k1 = await generateCacheKey({
      ...common,
      memory: [{ source: 'a', translation: '一' }],
    });
    const k2 = await generateCacheKey({
      ...common,
      memory: [{ source: 'a', translation: '二' }],
    });
    const k3 = await generateCacheKey(common);
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
  });
});
