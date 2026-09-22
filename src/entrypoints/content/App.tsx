import { useEffect, useRef, useState } from 'preact/hooks';
import { getProfiles, getSettings } from '../../storage';
import { FlatModelOption, ServerMessage } from '../../types';
import { PORT_NAME } from '../../utils/constants';
import { resolveLanguage, SupportedLocale, t } from '../../utils/i18n';
import { calculateButtonPosition, calculateFloatingPosition } from '../../utils/position';
import { generateTextFragmentUrl } from '../../utils/url';

export function App() {
  const [uiLocale, setUiLocale] = useState<SupportedLocale>('zh_CN');
  const [showButton, setShowButton] = useState(false);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });

  const [showCard, setShowCard] = useState(false);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [cardSize, setCardSize] = useState<{ width: number; height?: number }>({ width: 360 });
  const cardSizeRef = useRef(cardSize);
  cardSizeRef.current = cardSize;
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

  const selectedTextRef = useRef(selectedText);
  selectedTextRef.current = selectedText;
  const contextBeforeRef = useRef(contextBefore);
  contextBeforeRef.current = contextBefore;
  const contextAfterRef = useRef(contextAfter);
  contextAfterRef.current = contextAfter;
  const selectedModelKeyRef = useRef(selectedModelKey);
  selectedModelKeyRef.current = selectedModelKey;


  // Load available models and default settings
  useEffect(() => {
    async function init() {
      const settings = await getSettings();
      setUiLocale(resolveLanguage(settings.uiLang));

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

    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes['settings']?.newValue) {
        setUiLocale(resolveLanguage(changes['settings'].newValue.uiLang));
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
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
  const startTranslation = async (
    bypassCache = false,
    overrideModelKey?: string,
    overrideText?: string,
    overrideContext?: { before?: string; after?: string }
  ) => {
    disconnectPort();

    const targetModelKey = overrideModelKey || selectedModelKeyRef.current;
    const [profileId, modelName] = targetModelKey.split(':');
    if (!profileId || !modelName) {
      setError(t('noModelConfigured', undefined, uiLocale));
      return;
    }

    const currentText = overrideText !== undefined ? overrideText : selectedTextRef.current;
    const currentCtxBefore = overrideContext?.before !== undefined ? overrideContext.before : contextBeforeRef.current;
    const currentCtxAfter = overrideContext?.after !== undefined ? overrideContext.after : contextAfterRef.current;

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

      const sourceUrl = generateTextFragmentUrl(window.location.href, currentText);
      const sourceTitle = document.title || '';

      port.postMessage({
        type: 'translate',
        request: {
          text: currentText,
          contextBefore: currentCtxBefore,
          contextAfter: currentCtxAfter,
          targetLang: settings.targetLang,
          profileId,
          modelName,
          bypassCache,
          sourceUrl,
          sourceTitle,
        },
      });
    } catch (err: any) {
      setError(err?.message || t('requestFailed', undefined, uiLocale));
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

        selectedTextRef.current = text;
        contextBeforeRef.current = ctxBefore;
        contextAfterRef.current = ctxAfter;
        setSelectedText(text);
        setContextBefore(ctxBefore);
        setContextAfter(ctxAfter);

        const btnPos = calculateButtonPosition(rect, { clientX, clientY });
        setButtonPos(btnPos);

        const calculatedCardPos = calculateFloatingPosition(
          rect,
          cardSizeRef.current.width,
          cardSizeRef.current.height || 220
        );
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
    const handleMessage = async (msg: any) => {
      if (msg?.type === 'TRIGGER_TRANSLATE') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (!text) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const calculatedPos = calculateFloatingPosition(
          rect,
          cardSizeRef.current.width,
          cardSizeRef.current.height || 220
        );

        const settings = await getSettings();
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

        selectedTextRef.current = text;
        contextBeforeRef.current = ctxBefore;
        contextAfterRef.current = ctxAfter;

        setSelectedText(text);
        setContextBefore(ctxBefore);
        setContextAfter(ctxAfter);
        setCardPos(calculatedPos);
        setShowButton(false);
        setShowCard(true);

        // Immediate translate with latest text & context explicitly
        startTranslation(false, undefined, text, { before: ctxBefore, after: ctxAfter });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

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

  // Window resizing logic
  const handleResizeStart = (e: MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const cardEl = cardRef.current?.querySelector('.llm-card') as HTMLElement;
    if (!cardEl) return;

    const rect = cardEl.getBoundingClientRect();
    const initialWidth = rect.width;
    const initialHeight = rect.height;
    const initialLeft = cardPos.x;
    const initialTop = cardPos.y;

    const minWidth = 280;
    const maxWidth = Math.max(minWidth, window.innerWidth - 20);
    const minHeight = 140;
    const maxHeight = Math.max(minHeight, window.innerHeight - 20);

    const hasEast = dir.includes('e');
    const hasWest = dir.includes('w');
    const hasSouth = dir.includes('s');
    const hasNorth = dir.includes('n');

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newWidth = initialWidth;
      let newLeft = initialLeft;
      let newHeight = initialHeight;
      let newTop = initialTop;

      if (hasEast) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, initialWidth + dx));
      } else if (hasWest) {
        const rawW = initialWidth - dx;
        if (rawW < minWidth) {
          newWidth = minWidth;
          newLeft = initialLeft + (initialWidth - minWidth);
        } else if (rawW > maxWidth) {
          newWidth = maxWidth;
          newLeft = initialLeft - (maxWidth - initialWidth);
        } else {
          newWidth = rawW;
          newLeft = initialLeft + dx;
        }
      }

      if (hasSouth) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, initialHeight + dy));
      } else if (hasNorth) {
        const rawH = initialHeight - dy;
        if (rawH < minHeight) {
          newHeight = minHeight;
          newTop = initialTop + (initialHeight - minHeight);
        } else if (rawH > maxHeight) {
          newHeight = maxHeight;
          newTop = initialTop - (maxHeight - initialHeight);
        } else {
          newHeight = rawH;
          newTop = initialTop + dy;
        }
      }

      setCardSize((prev) => ({
        width: hasEast || hasWest ? newWidth : prev.width,
        height: hasNorth || hasSouth ? newHeight : prev.height,
      }));

      if (hasWest || hasNorth) {
        setCardPos({
          x: hasWest ? newLeft : initialLeft,
          y: hasNorth ? newTop : initialTop,
        });
      }
    };

    const handleResizeEnd = () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
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
          title={t('triggerButtonTitle', undefined, uiLocale)}
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
          style={{
            left: `${cardPos.x}px`,
            top: `${cardPos.y}px`,
            width: `${cardSize.width}px`,
            height: cardSize.height ? `${cardSize.height}px` : undefined,
          }}
        >
          {/* Edge and corner resize handles */}
          <div className="llm-resize-handle llm-resize-n" onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className="llm-resize-handle llm-resize-s" onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className="llm-resize-handle llm-resize-w" onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className="llm-resize-handle llm-resize-e" onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className="llm-resize-handle llm-resize-nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="llm-resize-handle llm-resize-ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="llm-resize-handle llm-resize-sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div className="llm-resize-handle llm-resize-se" onMouseDown={(e) => handleResizeStart(e, 'se')}>
            <div className="llm-resize-corner-grip" />
          </div>

          {/* Header */}
          <div className="llm-card-header" onMouseDown={handleDragStart}>
            <div className="llm-header-left">
              <span className="llm-badge">
                {detectedLang
                  ? t('sourceLangPrefix', { lang: detectedLang.toUpperCase() }, uiLocale)
                  : t('cardTitle', undefined, uiLocale)}
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
                title={isPinned ? t('unpinCard', undefined, uiLocale) : t('pinCard', undefined, uiLocale)}
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
                title={t('close', undefined, uiLocale)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            className="llm-card-body"
            style={cardSize.height ? { flex: 1, maxHeight: 'none' } : undefined}
          >
            {isLoading && !translation && (
              <div className="llm-loading-indicator">
                <div className="llm-spinner"></div>
                <span>{t('translating', undefined, uiLocale)}</span>
              </div>
            )}

            {error && (
              <div className="llm-error-box">
                <span>{error}</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {(error.includes('设置') || error.includes('Settings')) && (
                    <button
                      className="llm-action-btn"
                      onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })}
                      title={t('settings', undefined, uiLocale)}
                    >
                      {t('goToSettings', undefined, uiLocale)}
                    </button>
                  )}
                  {canRetry && (
                    <button
                      className="llm-action-btn"
                      onClick={() => startTranslation(true)}
                    >
                      {t('retry', undefined, uiLocale)}
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
                title={t('copyTranslationTitle', undefined, uiLocale)}
              >
                {copied ? t('copiedCheck', undefined, uiLocale) : t('copy', undefined, uiLocale)}
              </button>
              <button
                className="llm-action-btn"
                onClick={() => startTranslation(true)}
                title={t('bypassCacheTitle', undefined, uiLocale)}
              >
                {t('retry', undefined, uiLocale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
