import { ModelParams, ProtocolType } from '../types';

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
