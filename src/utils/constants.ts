import { AppSettings, Profile } from '../types';

export const MAX_SELECTION_LENGTH = 5000;
export const MAX_HISTORY_ITEMS = 500;
export const PORT_NAME = 'translate-stream';
export const HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds

export const DEFAULT_SYSTEM_PROMPT =
  '你是一个专业、准确、地道的翻译专家。请直接将用户提供的文本翻译为指定的目标语言。保持原有段落、排版与语调，除译文本身外不要包含任何解释、注记或前言后语。如果提供了周围上下文，请利用上下文辅助理解语境，但只翻译用户选中的核心文本。';

export const TARGET_LANGUAGES = [
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
];

export const UI_LANGUAGES = [
  { code: 'auto', labelZh: '跟随浏览器', labelEn: 'Auto (Follow Browser)' },
  { code: 'zh_CN', labelZh: '简体中文', labelEn: '简体中文' },
  { code: 'en', labelZh: 'English', labelEn: 'English' },
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  uiLang: 'auto',
  globalEnabled: true,
  triggers: {
    selectionButton: true,
    contextMenu: true,
    shortcut: true,
  },
  targetLang: 'zh-CN',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  contextChars: 0,
  streaming: true,
  defaultProfileId: 'default-deepseek',
  defaultModelId: 'deepseek-chat',
};

export const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'default-deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    protocol: 'openai-messages',
    models: [
      {
        id: 'deepseek-chat',
        name: 'deepseek-chat',
        params: { temperature: 0.2 },
        enabled: true,
      },
    ],
  },
];
