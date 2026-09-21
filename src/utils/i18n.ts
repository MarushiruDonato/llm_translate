import { UILanguage } from '../types';

export type SupportedLocale = 'zh_CN' | 'en';

export const MESSAGES = {
  zh_CN: {
    // 通用
    extName: 'LLM 划词翻译',
    extDesc: '基于大语言模型的网页划词翻译 Chrome 扩展，支持流式输出与多配置档',
    save: '保存',
    saved: '已保存',
    cancel: '取消',
    delete: '删除',
    confirm: '确定',
    copy: '复制',
    copied: '已复制',
    copiedCheck: '已复制 ✓',
    retry: '重试',
    close: '关闭',
    settings: '设置',
    shortcuts: '快捷键',
    success: '成功',
    failed: '失败',
    loading: '加载中...',

    // 悬浮卡片 (Content Script)
    cardTitle: '划词翻译',
    sourceLangPrefix: '源: {lang}',
    pinCard: '固定卡片',
    unpinCard: '取消固定',
    translating: '正在翻译中...',
    goToSettings: '前往设置 ↗',
    noModelConfigured: '未找到可用的翻译模型，请在设置中配置',
    requestFailed: '发起请求失败',
    cached: 'cached',
    triggerButtonTitle: '点击翻译选中文本',
    bypassCacheTitle: '重新请求（绕过缓存）',
    copyTranslationTitle: '复制译文',

    // Popup 工具栏
    popupTitle: 'LLM 划词翻译',
    searchHistoryPlaceholder: '搜索历史...',
    clearHistory: '清空历史',
    clearHistoryConfirm: '确定要清空所有历史记录吗？',
    emptyHistory: '暂无翻译历史',
    emptyHistorySub: '选中文本后点击浮动图标开始翻译',
    globallyDisabledBanner: '划词翻译已全局暂停',
    openWebpage: '打开网页 ↗',
    loadMore: '加载更多',
    totalEntries: '共 {count} 条记录',

    // Options 设置页
    optionsTitle: 'LLM 划词翻译 设置',
    generalTab: '常规与界面',
    profilesTab: '模型配置档',
    translationTab: '翻译参数',
    aboutTab: '存储与关于',
    generalAndTriggers: '通用与触发',
    uiLanguageLabel: '界面语言',
    uiLanguageDesc: '选择扩展界面显示的语言（中文/英文/跟随浏览器）',
    langAuto: '跟随浏览器 (Auto)',
    langAutoDesc: '根据浏览器语言环境自动切换',
    langZh: '简体中文',
    langZhDesc: '界面始终显示简体中文',
    langEn: 'English',
    langEnDesc: '界面始终显示 English',
    globalEnabledLabel: '全局启用',
    globalEnabledDesc: '开启后方可在网页上划词、使用右键菜单或快捷键翻译',
    selectionButtonLabel: '划词浮动按钮',
    selectionButtonDesc: '在网页上选中文字时紧贴鼠标显示翻译悬浮按钮',
    contextMenuLabel: '右键菜单项',
    contextMenuDesc: '在网页选中文本时右键菜单中显示「翻译所选内容」',
    shortcutLabel: '快捷键触发',
    shortcutDesc: '按全局快捷键直接翻译当前网页选中文本',
    editShortcuts: '修改全局快捷键 ↗',

    translationSettings: '翻译设置',
    targetLangLabel: '目标语言',
    targetLangDesc: '默认翻译输出的目标语言',
    contextCharsLabel: '上下文范围 (字符)',
    contextCharsDesc: '划词时自动提取选区前后的字符数作为辅助上下文 (0 表示不提供)',
    systemPromptLabel: '系统提示词 (System Prompt)',
    systemPromptDesc: '向大模型说明翻译角色、风格及排版要求的系统指令',
    streamingLabel: '流式输出',
    streamingDesc: '使用 Server-Sent Events (SSE) 逐字返回翻译结果，体验更敏捷',

    profilesTitle: '模型配置档 (Profiles)',
    addProfile: '+ 添加配置档',
    profileName: '配置档名称',
    apiEndpoint: 'API 端点 (Base URL)',
    apiKey: 'API 密钥 (API Key)',
    protocol: '协议类型',
    testConnection: '测试连接',
    testingConnection: '测试中...',
    testSuccess: '连接成功 ({ms}ms)',
    testFailed: '连接失败: {err}',
    modelsList: '模型列表',
    addModel: '+ 添加模型',
    modelName: '模型名称',
    temperature: '温度 (Temperature)',
    defaultModel: '默认模型',
    setDefault: '设为默认',
    deleteProfile: '删除配置档',
    deleteProfileConfirm: '确定要删除配置档「{name}」吗？',
    saveProfile: '保存配置档',
    profileSaved: '配置档已保存',
    needAtLeastOneProfile: '至少需要保留一个配置档',
    needAtLeastOneModel: '每个配置档至少需要一个模型',

    historySettingsTitle: '历史记录设置',
    historyStorageLabel: '历史存储',
    historyStorageDesc: '最多在本地存储 500 条翻译历史（超出自动淘汰最旧记录）',
    clearAllHistory: '清空历史记录',
    historyCleared: '历史已清空',
    saveSettings: '保存设置',
    settingsSaved: '设置已保存',

    // 右键菜单
    contextMenuTranslate: '翻译所选内容',
  },
  en: {
    // Common
    extName: 'LLM Selection Translate',
    extDesc: 'LLM-powered webpage selection translation extension with streaming output and multi-profile support',
    save: 'Save',
    saved: 'Saved',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    copy: 'Copy',
    copied: 'Copied',
    copiedCheck: 'Copied ✓',
    retry: 'Retry',
    close: 'Close',
    settings: 'Settings',
    shortcuts: 'Shortcuts',
    success: 'Success',
    failed: 'Failed',
    loading: 'Loading...',

    // Floating Card (Content Script)
    cardTitle: 'Translate',
    sourceLangPrefix: 'Src: {lang}',
    pinCard: 'Pin card',
    unpinCard: 'Unpin card',
    translating: 'Translating...',
    goToSettings: 'Settings ↗',
    noModelConfigured: 'No available model found. Please configure in Settings.',
    requestFailed: 'Failed to send request',
    cached: 'cached',
    triggerButtonTitle: 'Click to translate selected text',
    bypassCacheTitle: 'Retry (Bypass cache)',
    copyTranslationTitle: 'Copy translation',

    // Popup Toolbar
    popupTitle: 'LLM Translate',
    searchHistoryPlaceholder: 'Search history...',
    clearHistory: 'Clear History',
    clearHistoryConfirm: 'Are you sure you want to clear all translation history?',
    emptyHistory: 'No translation history',
    emptyHistorySub: 'Select text on any webpage to start translating',
    globallyDisabledBanner: 'Translation is globally paused',
    openWebpage: 'Open webpage ↗',
    loadMore: 'Load more',
    totalEntries: '{count} records',

    // Options Page
    optionsTitle: 'LLM Translate Settings',
    generalTab: 'General & UI',
    profilesTab: 'Model Profiles',
    translationTab: 'Translation Settings',
    aboutTab: 'Storage & About',
    generalAndTriggers: 'General & Triggers',
    uiLanguageLabel: 'Interface Language',
    uiLanguageDesc: 'Select display language for extension UI (Chinese / English / Auto)',
    langAuto: 'Auto (Follow Browser)',
    langAutoDesc: 'Automatically match browser language',
    langZh: '简体中文',
    langZhDesc: 'Always display Simplified Chinese',
    langEn: 'English',
    langEnDesc: 'Always display English',
    globalEnabledLabel: 'Globally Enabled',
    globalEnabledDesc: 'Enable selection button, context menu, and shortcuts across all pages',
    selectionButtonLabel: 'Selection Button',
    selectionButtonDesc: 'Display a floating translation button adjacent to mouse release on text selection',
    contextMenuLabel: 'Context Menu',
    contextMenuDesc: 'Show "Translate selection" in browser context menu upon right-clicking',
    shortcutLabel: 'Keyboard Shortcut',
    shortcutDesc: 'Trigger translation for current selection via global keyboard shortcut',
    editShortcuts: 'Edit Shortcuts ↗',

    translationSettings: 'Translation Settings',
    targetLangLabel: 'Target Language',
    targetLangDesc: 'Default target language for translations',
    contextCharsLabel: 'Context Range (chars)',
    contextCharsDesc: 'Surrounding characters included as reference context (0 to disable)',
    systemPromptLabel: 'System Prompt',
    systemPromptDesc: 'System prompt specifying translation tone, style, and guidelines',
    streamingLabel: 'Streaming Output',
    streamingDesc: 'Stream translation incrementally via Server-Sent Events (SSE)',

    profilesTitle: 'Model Profiles',
    addProfile: '+ Add Profile',
    profileName: 'Profile Name',
    apiEndpoint: 'API Endpoint (Base URL)',
    apiKey: 'API Key',
    protocol: 'Protocol',
    testConnection: 'Test Connection',
    testingConnection: 'Testing...',
    testSuccess: 'Connected ({ms}ms)',
    testFailed: 'Connection failed: {err}',
    modelsList: 'Models',
    addModel: '+ Add Model',
    modelName: 'Model Name',
    temperature: 'Temperature',
    defaultModel: 'Default Model',
    setDefault: 'Set Default',
    deleteProfile: 'Delete Profile',
    deleteProfileConfirm: 'Are you sure you want to delete profile "{name}"?',
    saveProfile: 'Save Profile',
    profileSaved: 'Profile saved',
    needAtLeastOneProfile: 'At least one profile must be retained',
    needAtLeastOneModel: 'Each profile must have at least one model',

    historySettingsTitle: 'History Settings',
    historyStorageLabel: 'History Storage',
    historyStorageDesc: 'Stores up to 500 translation entries locally (FIFO eviction)',
    clearAllHistory: 'Clear History',
    historyCleared: 'History cleared',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved',

    // Context Menu
    contextMenuTranslate: 'Translate selection',
  },
} as const;

export type TranslationKey = keyof typeof MESSAGES['zh_CN'];

let currentResolvedLocale: SupportedLocale = 'zh_CN';

/**
 * 根据用户偏好及系统环境解析出最终生效语言
 */
export function resolveLanguage(preference?: UILanguage): SupportedLocale {
  if (preference === 'zh_CN') return 'zh_CN';
  if (preference === 'en') return 'en';

  // preference 为 'auto' 或未定义，检查浏览器界面语言
  let browserLang = '';
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
      browserLang = chrome.i18n.getUILanguage();
    } else if (typeof navigator !== 'undefined' && navigator.language) {
      browserLang = navigator.language;
    }
  } catch {
    // ignore
  }

  if (browserLang.toLowerCase().startsWith('zh')) {
    return 'zh_CN';
  }
  return 'en';
}

/**
 * 设置全局生效语言（用于单例快速渲染）
 */
export function setGlobalLocale(locale: SupportedLocale): void {
  currentResolvedLocale = locale;
}

/**
 * 获取当前生效语言
 */
export function getGlobalLocale(): SupportedLocale {
  return currentResolvedLocale;
}

/**
 * 翻译指定 key，支持可选插值替换与强制指定语言
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale?: SupportedLocale
): string {
  const targetLocale = locale || currentResolvedLocale;
  const localeDict = MESSAGES[targetLocale] || MESSAGES['zh_CN'];
  let msg: string = (localeDict as any)[key] || (MESSAGES['zh_CN'] as any)[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return msg;
}
