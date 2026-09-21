export type ProtocolType = 'openai-messages' | 'openai-responses' | 'anthropic';

export interface ModelParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  [key: string]: any;
}

export interface ModelConfig {
  id: string;
  name: string;
  params: ModelParams;
  enabled: boolean;
}

export interface Profile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  protocol: ProtocolType;
  models: ModelConfig[];
}

export interface TriggerSettings {
  selectionButton: boolean;
  contextMenu: boolean;
  shortcut: boolean;
}

export interface AppSettings {
  globalEnabled: boolean;
  triggers: TriggerSettings;
  targetLang: string;
  systemPrompt: string;
  contextChars: number;
  streaming: boolean;
  memoryEnabled: boolean;
  memoryWindowSize: number;
  defaultProfileId: string;
  defaultModelId: string;
}

/** 页面翻译记忆：同一页面内已翻译过的「原文摘录 → 译文」对 */
export interface TranslationMemoryPair {
  source: string;
  translation: string;
}

export interface TranslateRequest {
  text: string;
  contextBefore?: string;
  contextAfter?: string;
  systemPrompt?: string;
  targetLang: string;
  profileId: string;
  modelName: string;
  params?: ModelParams;
  bypassCache?: boolean;
  sourceUrl?: string;
  sourceTitle?: string;
  /** 页面翻译记忆（Content Script 按 frame 维护，随请求重发） */
  memory?: TranslationMemoryPair[];
}

// Port stream message types: Client -> Background
export type ClientMessage = {
  type: 'translate';
  request: TranslateRequest;
};

// Port stream message types: Background -> Client
export type ServerMessage =
  | { type: 'meta'; cached: boolean; detectedLang?: string }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string; canRetry: boolean }
  | { type: 'ping' };

export interface HistoryEntry {
  id: string;
  text: string;
  translation: string;
  profileName: string;
  modelName: string;
  targetLang: string;
  timestamp: number;
  cacheKey: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface FlatModelOption {
  profileId: string;
  profileName: string;
  modelId: string;
  modelName: string;
  label: string; // e.g. "DeepSeek / deepseek-chat"
}
