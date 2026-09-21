import { beforeEach, describe, expect, it } from 'vitest';
import {
  addHistory,
  clearHistory,
  findHistoryByCacheKey,
  getHistory,
  getSettings,
  saveSettings,
} from '../src/storage';
import { MAX_HISTORY_ITEMS } from '../src/utils/constants';

describe('storage and LRU history', () => {
  beforeEach(async () => {
    await clearHistory();
  });

  it('should save and retrieve settings correctly', async () => {
    const settings = await getSettings();
    expect(settings.targetLang).toBe('zh-CN');
    expect(settings.streaming).toBe(true);

    await saveSettings({ targetLang: 'ja', streaming: false });
    const updated = await getSettings();
    expect(updated.targetLang).toBe('ja');
    expect(updated.streaming).toBe(false);
  });

  it('should add history entries and find by cacheKey', async () => {
    await addHistory({
      id: '1',
      text: 'Apple',
      translation: '苹果',
      profileName: 'DeepSeek',
      modelName: 'deepseek-chat',
      targetLang: 'zh-CN',
      timestamp: 1000,
      cacheKey: 'key-apple',
    });

    const found = await findHistoryByCacheKey('key-apple');
    expect(found).toBeDefined();
    expect(found?.translation).toBe('苹果');

    const notFound = await findHistoryByCacheKey('key-banana');
    expect(notFound).toBeUndefined();
  });

  it('should enforce LRU 500 maximum items', async () => {
    // Add 510 items
    for (let i = 0; i < 510; i++) {
      await addHistory({
        id: `id-${i}`,
        text: `Text ${i}`,
        translation: `Translation ${i}`,
        profileName: 'DeepSeek',
        modelName: 'deepseek-chat',
        targetLang: 'zh-CN',
        timestamp: i,
        cacheKey: `key-${i}`,
      });
    }

    const history = await getHistory();
    expect(history.length).toBe(MAX_HISTORY_ITEMS);
    // Most recent is item 509
    expect(history[0].id).toBe('id-509');
    // Oldest surviving is item 10 (items 0 to 9 evicted)
    expect(history[history.length - 1].id).toBe('id-10');
  });

  it('should bump re-translated entry to the top (LRU deduplication)', async () => {
    await addHistory({
      id: '1',
      text: 'Apple',
      translation: '苹果',
      profileName: 'DeepSeek',
      modelName: 'deepseek-chat',
      targetLang: 'zh-CN',
      timestamp: 1000,
      cacheKey: 'key-apple',
    });

    await addHistory({
      id: '2',
      text: 'Banana',
      translation: '香蕉',
      profileName: 'DeepSeek',
      modelName: 'deepseek-chat',
      targetLang: 'zh-CN',
      timestamp: 2000,
      cacheKey: 'key-banana',
    });

    // Re-translate Apple with updated translation
    await addHistory({
      id: '3',
      text: 'Apple',
      translation: '苹果 (新)',
      profileName: 'DeepSeek',
      modelName: 'deepseek-chat',
      targetLang: 'zh-CN',
      timestamp: 3000,
      cacheKey: 'key-apple',
    });

    const history = await getHistory();
    expect(history.length).toBe(2);
    expect(history[0].cacheKey).toBe('key-apple');
    expect(history[0].translation).toBe('苹果 (新)');
    expect(history[1].cacheKey).toBe('key-banana');
  });
});
