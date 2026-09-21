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

export type UILanguage = 'auto' | 'zh_CN' | 'en';

export interface AppSettings {
  uiLang: UILanguage;
  globalEnabled: boolean;
  triggers: TriggerSettings;
  targetLang: string;
  systemPrompt: string;
  contextChars: number;
  streaming: boolean;
  defaultProfileId: string;
  defaultModelId: string;
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
