import { describe, expect, it } from 'vitest';
import { generateCacheKey, sha256 } from '../src/utils/crypto';

describe('sha256', () => {
  it('should compute deterministic hash', async () => {
    const h1 = await sha256('hello world');
    const h2 = await sha256('hello world');
    expect(h1).toBe(h2);
    expect(h1).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});

describe('generateCacheKey', () => {
  it('should produce identical key for identical parameters', async () => {
    const key1 = await generateCacheKey({
      text: 'Hello world',
      model: 'gpt-4o-mini',
      targetLang: 'zh-CN',
      systemPrompt: 'Translate this',
      params: { temperature: 0.7, max_tokens: 100 },
    });

    const key2 = await generateCacheKey({
      text: 'Hello world',
      model: 'gpt-4o-mini',
      targetLang: 'zh-CN',
      systemPrompt: 'Translate this',
      params: { max_tokens: 100, temperature: 0.7 }, // reversed object key order
    });

    expect(key1).toBe(key2);
  });

  it('should produce different keys when target language or text changes', async () => {
    const key1 = await generateCacheKey({
      text: 'Hello world',
      model: 'gpt-4o-mini',
      targetLang: 'zh-CN',
    });

    const key2 = await generateCacheKey({
      text: 'Hello world',
      model: 'gpt-4o-mini',
      targetLang: 'ja',
    });

    const key3 = await generateCacheKey({
      text: 'Hello world!',
      model: 'gpt-4o-mini',
      targetLang: 'zh-CN',
    });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
