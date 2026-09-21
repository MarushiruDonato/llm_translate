import { useEffect, useRef, useState } from 'preact/hooks';
import { getProfiles, getSettings } from '../../storage';
import { FlatModelOption, ServerMessage } from '../../types';
import { PORT_NAME } from '../../utils/constants';
import { calculateButtonPosition, calculateFloatingPosition } from '../../utils/position';

export function App() {
  const [showButton, setShowButton] = useState(false);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });

  const [showCard, setShowCard] = useState(false);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [isPinned, setIsPinned] = useState(false);

  const [selectedText, setSelectedText] = useState('');
  const [contextBefore, setContextBefore] = useState('');
  const [contextAfter, setContextAfter] = useState('');

  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [copied, setCopied] = useState(false);

  const [models, setModels] = useState<FlatModelOption[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState<string>(''); // "profileId:modelName"

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Load available models and default settings
  useEffect(() => {
    async function init() {
      const settings = await getSettings();
      const profiles = await getProfiles();

      const flatList: FlatModelOption[] = [];
      for (const p of profiles) {
        for (const m of p.models) {
          if (m.enabled) {
            flatList.push({
              profileId: p.id,
              profileName: p.name,
              modelId: m.id,
              modelName: m.name,
              label: `${p.name} / ${m.name}`,
            });
          }
        }
      }
      setModels(flatList);

      // Default model
      const defaultOption =
        flatList.find((opt) => opt.profileId === settings.defaultProfileId && opt.modelId === settings.defaultModelId) ||
        flatList[0];

      if (defaultOption) {
        setSelectedModelKey(`${defaultOption.profileId}:${defaultOption.modelName}`);
      }
    }
    init();
  }, []);

  // Helper to disconnect port
  const disconnectPort = () => {
    if (portRef.current) {
      try {
        portRef.current.disconnect();
      } catch {
        // ignore
      }
      portRef.current = null;
    }
  };

  // Start translation
  const startTranslation = async (bypassCache = false, overrideModelKey?: string) => {
    disconnectPort();

    const targetModelKey = overrideModelKey || selectedModelKey;
    const [profileId, modelName] = targetModelKey.split(':');
    if (!profileId || !modelName) {
      setError('未找到可用的翻译模型，请在设置中配置');
      return;
    }

    const settings = await getSettings();

    setShowButton(false);
    setShowCard(true);
    setIsLoading(true);
    setError(null);
    setTranslation('');
    setIsCached(false);

    try {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      portRef.current = port;

      port.onMessage.addListener((msg: ServerMessage) => {
        if (msg.type === 'meta') {
          setIsCached(msg.cached);
          if (msg.detectedLang) {
            setDetectedLang(msg.detectedLang);
          }
        } else if (msg.type === 'chunk') {
          setTranslation((prev) => prev + msg.text);
          setIsLoading(false);
        } else if (msg.type === 'done') {
          setIsLoading(false);
        } else if (msg.type === 'error') {
          setError(msg.message);
          setCanRetry(msg.canRetry);
          setIsLoading(false);
        }
      });

      port.onDisconnect.addListener(() => {
        portRef.current = null;
      });

      port.postMessage({
        type: 'translate',
        request: {
          text: selectedText,
          contextBefore,
          contextAfter,
          targetLang: settings.targetLang,
          profileId,
          modelName,
          bypassCache,
        },
      });
    } catch (err: any) {
      setError(err?.message || '发起请求失败');
      setIsLoading(false);
    }
  };

  // Listen for selection changes
  useEffect(() => {
    let timer: any = null;

    const handleMouseUp = async (e: MouseEvent) => {
      // Avoid reacting if clicking inside our card/button
      if (cardRef.current && cardRef.current.contains(e.target as Node)) {
        return;
      }

      const clientX = e.clientX;
      const clientY = e.clientY;

      clearTimeout(timer);
      timer = setTimeout(async () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          if (!isPinned) {
            setShowButton(false);
          }
          return;
        }

        const text = selection.toString().trim();
        if (!text || text.length > 5000) {
          setShowButton(false);
          return;
        }

        const settings = await getSettings();
        if (!settings.globalEnabled || !settings.triggers.selectionButton) {
          setShowButton(false);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        // Context extraction
        let ctxBefore = '';
        let ctxAfter = '';
        if (settings.contextChars > 0) {
          try {
            const fullPageText = range.startContainer.parentElement?.textContent || '';
            const idx = fullPageText.indexOf(text);
            if (idx >= 0) {
              ctxBefore = fullPageText.slice(Math.max(0, idx - settings.contextChars), idx);
              ctxAfter = fullPageText.slice(idx + text.length, idx + text.length + settings.contextChars);
            }
          } catch {
            // ignore context extraction error
          }
        }

        setSelectedText(text);
        setContextBefore(ctxBefore);
        setContextAfter(ctxAfter);

        const btnPos = calculateButtonPosition(rect, { clientX, clientY });
        setButtonPos(btnPos);

        const calculatedCardPos = calculateFloatingPosition(rect, 360, 220);
        setCardPos(calculatedCardPos);

        if (!showCard) {
          setShowButton(true);
        }
      }, 150);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPinned) {
        disconnectPort();
        setShowCard(false);
        setShowButton(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (isPinned) return;
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        disconnectPort();
        setShowCard(false);
        setShowButton(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPinned, showCard]);

  // Handle TRIGGER_TRANSLATE from background (context menu / keyboard shortcut)
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === 'TRIGGER_TRANSLATE') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (!text) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const calculatedPos = calculateFloatingPosition(rect, 360, 220);

        setSelectedText(text);
        setCardPos(calculatedPos);
        setShowButton(false);
        setShowCard(true);

        // Immediate translate
        setTimeout(() => {
          startTranslation(false);
        }, 50);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [selectedModelKey]);

  // Dragging logic
  const handleDragStart = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialPos = { ...cardPos };

    const handleDragMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setCardPos({
        x: initialPos.x + dx,
        y: initialPos.y + dy,
      });
    };

    const handleDragEnd = () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!translation) return;
    let ok = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(translation);
        ok = true;
      } catch {
        // fallback
      }
    }
    if (!ok) {
      const textarea = document.createElement('textarea');
      textarea.value = translation;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Model selection switch
  const handleModelChange = (newKey: string) => {
    setSelectedModelKey(newKey);
    startTranslation(false, newKey);
  };

  return (
    <div
      className="theme-container"
      ref={cardRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Floating Trigger Button */}
      {showButton && !showCard && (
        <div
          className="llm-trigger-btn"
          style={{ left: `${buttonPos.x}px`, top: `${buttonPos.y}px` }}
          onClick={() => startTranslation(false)}
          title="点击翻译选中文本"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
          </svg>
        </div>
      )}

      {/* Floating Translate Card */}
      {showCard && (
        <div
          className="llm-card"
          style={{ left: `${cardPos.x}px`, top: `${cardPos.y}px` }}
        >
          {/* Header */}
          <div className="llm-card-header" onMouseDown={handleDragStart}>
            <div className="llm-header-left">
              <span className="llm-badge">
                {detectedLang ? `源: ${detectedLang.toUpperCase()}` : '划词翻译'}
              </span>
              {models.length > 0 && (
                <select
                  className="llm-model-select"
                  value={selectedModelKey}
                  onChange={(e) => handleModelChange((e.target as HTMLSelectElement).value)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {models.map((opt) => (
                    <option key={`${opt.profileId}:${opt.modelName}`} value={`${opt.profileId}:${opt.modelName}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="llm-header-actions" onMouseDown={(e) => e.stopPropagation()}>
              {/* Pin button */}
              <button
                className={`llm-icon-btn ${isPinned ? 'active' : ''}`}
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? '取消固定' : '固定卡片'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
              </button>

              {/* Close button */}
              <button
                className="llm-icon-btn"
                onClick={() => {
                  disconnectPort();
                  setShowCard(false);
                  setShowButton(false);
                  setIsPinned(false);
                }}
                title="关闭"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="llm-card-body">
            {isLoading && !translation && (
              <div className="llm-loading-indicator">
                <div className="llm-spinner"></div>
                <span>正在翻译中...</span>
              </div>
            )}

            {error && (
              <div className="llm-error-box">
                <span>{error}</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {error.includes('设置') && (
                    <button
                      className="llm-action-btn"
                      onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })}
                      title="打开扩展设置页面"
                    >
                      前往设置 ↗
                    </button>
                  )}
                  {canRetry && (
                    <button
                      className="llm-action-btn"
                      onClick={() => startTranslation(true)}
                    >
                      重试
                    </button>
                  )}
                </div>
              </div>
            )}

            {translation && <div>{translation}</div>}
          </div>

          {/* Footer */}
          <div className="llm-card-footer">
            <div className="llm-footer-left">
              {isCached && <span className="llm-cached-tag">cached</span>}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`llm-action-btn ${copied ? 'success' : ''}`}
                onClick={handleCopy}
                disabled={!translation}
                title="复制译文"
              >
                {copied ? '已复制 ✓' : '复制'}
              </button>
              <button
                className="llm-action-btn"
                onClick={() => startTranslation(true)}
                title="重新请求（绕过缓存）"
              >
                重试
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
