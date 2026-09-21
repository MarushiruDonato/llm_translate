import { TranslationMemoryPair } from '../types';
import {
  DEFAULT_MEMORY_WINDOW_SIZE,
  MAX_MEMORY_ENTRY_CHARS,
  MAX_MEMORY_TOTAL_CHARS,
  MAX_MEMORY_WINDOW_SIZE,
  MIN_MEMORY_WINDOW_SIZE,
} from './constants';

export interface MemoryLimits {
  windowSize: number;
  maxEntryChars: number;
  maxTotalChars: number;
}

export function defaultMemoryLimits(windowSize?: number): MemoryLimits {
  const size = Math.min(
    MAX_MEMORY_WINDOW_SIZE,
    Math.max(MIN_MEMORY_WINDOW_SIZE, Math.floor(windowSize ?? DEFAULT_MEMORY_WINDOW_SIZE))
  );
  return {
    windowSize: size,
    maxEntryChars: MAX_MEMORY_ENTRY_CHARS,
    maxTotalChars: MAX_MEMORY_TOTAL_CHARS,
  };
}

function totalChars(memory: TranslationMemoryPair[]): number {
  return memory.reduce((sum, m) => sum + m.source.length + m.translation.length, 0);
}

/**
 * 将单条记忆的 source 与 translation 各自截断到 maxEntryChars。
 */
export function truncateMemoryEntry(
  entry: TranslationMemoryPair,
  maxEntryChars: number
): TranslationMemoryPair {
  return {
    source: entry.source.slice(0, maxEntryChars),
    translation: entry.translation.slice(0, maxEntryChars),
  };
}

/**
 * 有界化：截取最近 windowSize 条 → 单条截断 → 总预算内 FIFO 淘汰最旧条目。
 */
export function boundMemory(
  memory: TranslationMemoryPair[],
  limits: MemoryLimits = defaultMemoryLimits()
): TranslationMemoryPair[] {
  const recent = memory.slice(-limits.windowSize).map((m) => truncateMemoryEntry(m, limits.maxEntryChars));
  while (recent.length > 1 && totalChars(recent) > limits.maxTotalChars) {
    recent.shift();
  }
  return recent;
}

/**
 * 追加一条记忆。同一 source（同一选区的重试或重新划选）不重复入列：
 * 先移除旧条目，再将最新译文追加到末尾（LRU 语义，最新翻译存活最久）。
 */
export function appendMemory(
  memory: TranslationMemoryPair[],
  source: string,
  translation: string,
  limits: MemoryLimits = defaultMemoryLimits()
): TranslationMemoryPair[] {
  const trimmedSource = source.trim();
  const trimmedTranslation = translation.trim();
  if (!trimmedSource || !trimmedTranslation) return boundMemory(memory, limits);

  const deduped = memory.filter((m) => m.source !== trimmedSource);
  deduped.push({ source: trimmedSource, translation: trimmedTranslation });
  return boundMemory(deduped, limits);
}
