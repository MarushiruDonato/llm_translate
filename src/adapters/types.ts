import { ModelParams, ProtocolType, TranslationMemoryPair } from '../types';

export interface TranslateOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  targetLang: string;
  text: string;
  contextBefore?: string;
  contextAfter?: string;
  params?: ModelParams;
  streaming?: boolean;
  rawPrompt?: boolean;
  signal?: AbortSignal;
  /** 页面翻译记忆：渲染为历史对话轮次（user=原文摘录，assistant=译文） */
  memory?: TranslationMemoryPair[];
}

export interface AdapterError {
  message: string;
  canRetry: boolean;
  statusCode?: number;
}

export interface ProtocolAdapter {
  protocol: ProtocolType;
  translate(options: TranslateOptions): AsyncIterable<string>;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BuiltConversation {
  system: string;
  memoryTurns: ConversationTurn[];
  userMessage: string;
}

export const MEMORY_SYSTEM_NOTE =
  '此前对话轮次是同一网页上已翻译过的片段（用户消息为原文摘录，助手消息为对应译文），仅作为保持术语与人称一致的参考；请仍然只翻译当前用户请求中的文本，不要翻译或复述历史片段。';

/**
 * 统一构建「系统提示 + 记忆轮次 + 当前请求」的对话结构，三个协议适配器共用。
 * 记忆为空时与基础路径完全一致（不追加任何说明）。
 */
export function buildConversation(options: TranslateOptions): BuiltConversation {
  const memory = options.memory || [];
  const system = memory.length > 0 ? `${options.systemPrompt}\n\n${MEMORY_SYSTEM_NOTE}` : options.systemPrompt;
  const memoryTurns: ConversationTurn[] = memory.flatMap((m) => [
    { role: 'user' as const, content: m.source },
    { role: 'assistant' as const, content: m.translation },
  ]);
  return {
    system,
    memoryTurns,
    userMessage: formatUserMessage(options),
  };
}

export function formatUserMessage(options: TranslateOptions): string {
  if (options.rawPrompt) {
    return options.text;
  }
  let content = '';
  if (options.contextBefore || options.contextAfter) {
    content += '【周围上下文】：\n';
    if (options.contextBefore) {
      content += `...${options.contextBefore}\n`;
    }
    content += `[需翻译文本]: ${options.text}\n`;
    if (options.contextAfter) {
      content += `${options.contextAfter}...\n\n`;
    }
    content += `请只翻译[需翻译文本]为「${options.targetLang}」：\n${options.text}`;
  } else {
    content = `请将以下内容翻译为「${options.targetLang}」：\n\n${options.text}`;
  }
  return content;
}
