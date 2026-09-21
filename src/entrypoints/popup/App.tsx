import { useEffect, useState } from 'preact/hooks';
import { clearHistory, deleteHistoryItem, getHistory, getSettings, saveSettings } from '../../storage';
import { AppSettings, HistoryEntry } from '../../types';
import { resolveLanguage, SupportedLocale, t } from '../../utils/i18n';
import './styles.css';

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [locale, setLocale] = useState<SupportedLocale>('zh_CN');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    const s = await getSettings();
    setSettings(s);
    setLocale(resolveLanguage(s.uiLang));
    const h = await getHistory();
    setHistory(h);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleGlobal = async () => {
    if (!settings) return;
    const updated = await saveSettings({ globalEnabled: !settings.globalEnabled });
    setSettings(updated);
  };

  const handleOpenOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  const handleClearHistory = async () => {
    if (confirm(t('clearHistoryConfirm', undefined, locale))) {
      await clearHistory();
      setHistory([]);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const updated = await deleteHistoryItem(id);
    setHistory(updated);
  };

  const handleCopy = async (id: string, text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenUrl = (url: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const extractHost = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return u.hostname;
    } catch {
      return locale === 'zh_CN' ? '对应网页' : 'Page';
    }
  };

  const filteredHistory = history.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.text.toLowerCase().includes(q) || item.translation.toLowerCase().includes(q);
  });

  const visibleItems = filteredHistory.slice(0, visibleCount);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // in seconds
    if (locale === 'zh_CN') {
      if (diff < 60) return '刚刚';
      if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    } else {
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <div className="header-title-group">
          <img src="/icons/icon-48.png" alt="Logo" className="app-logo" />
          <span className="header-title">{t('popupTitle', undefined, locale)}</span>
        </div>

        <div className="header-controls">
          {/* Global Enable Toggle */}
          <label className="switch" title={settings?.globalEnabled ? (locale === 'zh_CN' ? '点击暂停翻译' : 'Click to pause translation') : (locale === 'zh_CN' ? '点击开启翻译' : 'Click to enable translation')}>
            <input
              type="checkbox"
              checked={settings?.globalEnabled ?? true}
              onChange={handleToggleGlobal}
            />
            <span className="slider"></span>
          </label>

          {/* Settings button */}
          <button className="icon-btn" onClick={handleOpenOptions} title={t('settings', undefined, locale)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Pause Notification Banner */}
      {settings && !settings.globalEnabled && (
        <div className="pause-banner">
          <span>{t('globallyDisabledBanner', undefined, locale)}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder={t('searchHistoryPlaceholder', undefined, locale)}
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Subheader Stats */}
      <div className="history-stats">
        <span>{t('totalEntries', { count: filteredHistory.length }, locale)}</span>
        {history.length > 0 && (
          <button className="clear-btn" onClick={handleClearHistory}>
            {t('clearHistory', undefined, locale)}
          </button>
        )}
      </div>

      {/* History List */}
      <div className="history-list">
        {visibleItems.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{search ? (locale === 'zh_CN' ? '未找到匹配的翻译历史' : 'No matching history found') : t('emptyHistory', undefined, locale)}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {t('emptyHistorySub', undefined, locale)}
            </span>
          </div>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="history-card">
              <div className="card-top">
                <div className="card-meta">
                  <span className="model-tag">{item.modelName}</span>
                  <span className="model-tag">{item.targetLang}</span>
                </div>
                <span className="card-time">{formatTime(item.timestamp)}</span>
              </div>

              {/* Source webpage link pointing to exact text fragment */}
              {item.sourceUrl && (
                <div className="card-url-row">
                  <a
                    href={item.sourceUrl}
                    className="source-url-link"
                    title={item.sourceUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenUrl(item.sourceUrl!);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                    </svg>
                    <span>{item.sourceTitle || extractHost(item.sourceUrl)}</span>
                  </a>
                </div>
              )}

              <div className="card-source" title={item.text}>
                {item.text}
              </div>

              <div className="card-target">{item.translation}</div>

              <div className="card-bottom">
                {item.sourceUrl && (
                  <button
                    className="mini-btn primary-link"
                    onClick={() => handleOpenUrl(item.sourceUrl!)}
                    title={t('openWebpage', undefined, locale)}
                  >
                    {t('openWebpage', undefined, locale)}
                  </button>
                )}
                <button
                  className={`mini-btn ${copiedId === item.id ? 'copied' : ''}`}
                  onClick={() => handleCopy(item.id, item.translation)}
                  title={t('copyTranslationTitle', undefined, locale)}
                >
                  {copiedId === item.id ? t('copiedCheck', undefined, locale) : t('copy', undefined, locale)}
                </button>
                <button
                  className="mini-btn"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => handleDeleteItem(item.id)}
                  title={t('delete', undefined, locale)}
                >
                  {t('delete', undefined, locale)}
                </button>
              </div>
            </div>
          ))
        )}

        {filteredHistory.length > visibleCount && (
          <button
            className="load-more-btn"
            onClick={() => setVisibleCount((prev) => prev + 20)}
          >
            {t('loadMore', undefined, locale)} ({filteredHistory.length - visibleCount})
          </button>
        )}
      </div>
    </div>
  );
}
