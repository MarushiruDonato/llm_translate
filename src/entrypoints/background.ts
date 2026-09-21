import { defineBackground } from 'wxt/sandbox';
import { getAdapter } from '../adapters';
import { addHistory, findHistoryByCacheKey, getProfileById, getProfiles, getSettings } from '../storage';
import { ClientMessage, ServerMessage } from '../types';
import { HEARTBEAT_INTERVAL_MS, MAX_SELECTION_LENGTH, PORT_NAME } from '../utils/constants';
import { generateCacheKey } from '../utils/crypto';

import { resolveLanguage, t } from '../utils/i18n';

export default defineBackground(() => {
  // 1. Initialize & Update Context Menus
  const updateContextMenu = async () => {
    const settings = await getSettings();
    const locale = resolveLanguage(settings.uiLang);
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'translate-selection-menu',
        title: t('contextMenuTranslate', undefined, locale),
        contexts: ['selection'],
      });
    });
  };

  chrome.runtime.onInstalled.addListener(() => {
    updateContextMenu();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['settings']) {
      updateContextMenu();
    }
  });

  // 2. Route Context Menu clicks to specific frame
  chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (info.menuItemId === 'translate-selection-menu' && tab?.id != null) {
      const settings = await getSettings();
      if (!settings.globalEnabled || !settings.triggers.contextMenu) return;

      chrome.tabs.sendMessage(
        tab.id,
        { type: 'TRIGGER_TRANSLATE' },
        { frameId: info.frameId }
      );
    }
  });

  // 3. Handle Keyboard Shortcuts (broadcast to all frames in active tab)
  chrome.commands.onCommand.addListener(async (command: string) => {
    if (command === 'translate-selection') {
      const settings = await getSettings();
      if (!settings.globalEnabled || !settings.triggers.shortcut) return;

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id != null) {
        chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_TRANSLATE' });
      }
    }
  });

  // 4. Handle open options page request
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'OPEN_OPTIONS_PAGE') {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return true;
    }
  });

  // 5. Long-lived Port for Streaming Translation
  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
    if (port.name !== PORT_NAME) return;

    let abortController: AbortController | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    };

    port.onDisconnect.addListener(() => {
      cleanup();
    });

    port.onMessage.addListener(async (msg: ClientMessage) => {
      if (msg.type !== 'translate') return;

      const { request } = msg;

      // Abort any existing ongoing request on this port
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      // Guard: Length limit
      if (request.text.length > MAX_SELECTION_LENGTH) {
        sendToPort(port, {
          type: 'error',
          message: `选中文本超过 ${MAX_SELECTION_LENGTH} 字符上限，请缩短选区后重试`,
          canRetry: false,
        });
        return;
      }

      // Check settings & global state
      const settings = await getSettings();
      if (!settings.globalEnabled) {
        sendToPort(port, {
          type: 'error',
          message: '翻译功能当前处于全局关闭状态，请在扩展图标中重新开启',
          canRetry: false,
        });
        return;
      }

      // Find profile
      let profile = await getProfileById(request.profileId);
      if (!profile) {
        const profiles = await getProfiles();
        profile = profiles.find((p) => p.models.some((m) => m.enabled)) || profiles[0];
      }

      if (!profile || !profile.apiKey?.trim()) {
        sendToPort(port, {
          type: 'error',
          message: '未配置有效的 API Key，请在扩展设置页面添加并保存配置档',
          canRetry: false,
        });
        return;
      }

      // Detect language locally
      const detectedLang = await detectLanguageLocally(request.text);

      // Compute deterministic cache key
      const cacheKey = await generateCacheKey({
        text: request.text,
        model: request.modelName,
        targetLang: request.targetLang,
        contextBefore: request.contextBefore,
        contextAfter: request.contextAfter,
        systemPrompt: request.systemPrompt || settings.systemPrompt,
        params: request.params,
      });

      // Check Cache
      if (!request.bypassCache) {
        const cached = await findHistoryByCacheKey(cacheKey);
        if (cached) {
          sendToPort(port, { type: 'meta', cached: true, detectedLang });
          sendToPort(port, { type: 'chunk', text: cached.translation });
          sendToPort(port, { type: 'done' });

          // Update sourceUrl and bump to top in history if available
          if (request.sourceUrl) {
            await addHistory({
              ...cached,
              sourceUrl: request.sourceUrl,
              sourceTitle: request.sourceTitle || cached.sourceTitle,
              timestamp: Date.now(),
            });
          }
          return;
        }
      }

      // Cache miss: initiate stream
      sendToPort(port, { type: 'meta', cached: false, detectedLang });

      // Setup Heartbeat to prevent SW idle shutdown
      heartbeatTimer = setInterval(() => {
        try {
          sendToPort(port, { type: 'ping' });
        } catch {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      let fullTranslation = '';
      try {
        const adapter = getAdapter(profile.protocol);
        const stream = adapter.translate({
          baseUrl: profile.baseUrl,
          apiKey: profile.apiKey,
          model: request.modelName,
          systemPrompt: request.systemPrompt || settings.systemPrompt,
          targetLang: request.targetLang,
          text: request.text,
          contextBefore: request.contextBefore,
          contextAfter: request.contextAfter,
          params: request.params,
          streaming: settings.streaming,
          signal: abortController.signal,
        });

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;
          fullTranslation += chunk;
          sendToPort(port, { type: 'chunk', text: chunk });
        }

        if (!abortController.signal.aborted) {
          sendToPort(port, { type: 'done' });

          // Save to History (which acts as cache)
          if (fullTranslation.trim()) {
            await addHistory({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              text: request.text,
              translation: fullTranslation,
              profileName: profile.name,
              modelName: request.modelName,
              targetLang: request.targetLang,
              timestamp: Date.now(),
              cacheKey,
              sourceUrl: request.sourceUrl,
              sourceTitle: request.sourceTitle,
            });
          }
        }
      } catch (err: any) {
        if (abortController?.signal.aborted) return;
        sendToPort(port, {
          type: 'error',
          message: err?.message || '翻译失败，请稍后重试',
          canRetry: err?.canRetry ?? true,
        });
      } finally {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      }
    });
  });
});

function sendToPort(port: chrome.runtime.Port, msg: ServerMessage) {
  try {
    port.postMessage(msg);
  } catch {
    // Port disconnected
  }
}

async function detectLanguageLocally(text: string): Promise<string | undefined> {
  if (typeof chrome !== 'undefined' && chrome.i18n?.detectLanguage) {
    try {
      const res = await new Promise<chrome.i18n.LanguageDetectionResult>((resolve) => {
        chrome.i18n.detectLanguage(text, resolve);
      });
      if (res?.languages?.length > 0) {
        return res.languages[0].language;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}
