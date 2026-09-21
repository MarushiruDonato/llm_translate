import { useEffect, useState } from 'preact/hooks';
import { clearHistory, deleteHistoryItem, getHistory, getSettings, saveSettings } from '../../storage';
import { AppSettings, HistoryEntry } from '../../types';
import './styles.css';

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    const s = await getSettings();
    setSettings(s);
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
    if (confirm('确定要清空所有翻译历史记录吗？此操作不可撤销。')) {
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

  const filteredHistory = history.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.text.toLowerCase().includes(q) || item.translation.toLowerCase().includes(q);
  });

  const visibleItems = filteredHistory.slice(0, visibleCount);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // in seconds
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <div className="header-title-group">
          <img src="/icons/icon-48.png" alt="Logo" className="app-logo" />
          <span className="header-title">LLM 划词翻译</span>
        </div>

        <div className="header-controls">
          {/* Global Enable Toggle */}
          <label className="switch" title={settings?.globalEnabled ? '点击暂停翻译' : '点击开启翻译'}>
            <input
              type="checkbox"
              checked={settings?.globalEnabled ?? true}
              onChange={handleToggleGlobal}
            />
            <span className="slider"></span>
          </label>

          {/* Settings button */}
          <button className="icon-btn" onClick={handleOpenOptions} title="打开设置">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Pause Notification Banner */}
      {settings && !settings.globalEnabled && (
        <div className="pause-banner">
          <span>⚠️ 划词翻译已全局暂停，在此处可随时重新开启</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="搜索历史记录（原文或译文）..."
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Subheader Stats */}
      <div className="history-stats">
        <span>共 {filteredHistory.length} 条记录</span>
        {history.length > 0 && (
          <button className="clear-btn" onClick={handleClearHistory}>
            清空历史
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
            <span>{search ? '未找到匹配的翻译历史' : '暂无翻译历史'}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              在网页上划选文字即可快速翻译
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

              <div className="card-source" title={item.text}>
                {item.text}
              </div>

              <div className="card-target">{item.translation}</div>

              <div className="card-bottom">
                <button
                  className={`mini-btn ${copiedId === item.id ? 'copied' : ''}`}
                  onClick={() => handleCopy(item.id, item.translation)}
                >
                  {copiedId === item.id ? '已复制 ✓' : '复制'}
                </button>
                <button
                  className="mini-btn"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => handleDeleteItem(item.id)}
                  title="删除该条记录"
                >
                  删除
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
            加载更多 ({filteredHistory.length - visibleCount})
          </button>
        )}
      </div>
    </div>
  );
}
