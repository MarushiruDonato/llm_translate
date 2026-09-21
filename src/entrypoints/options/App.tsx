import { useEffect, useState } from 'preact/hooks';
import { getAdapter } from '../../adapters';
import { clearHistory, getProfiles, getSettings, saveProfiles, saveSettings } from '../../storage';
import { AppSettings, ModelConfig, Profile, ProtocolType } from '../../types';
import { DEFAULT_SETTINGS, TARGET_LANGUAGES, UI_LANGUAGES } from '../../utils/constants';
import { resolveLanguage, SupportedLocale, t } from '../../utils/i18n';
import { cleanBaseUrl, normalizeToMatchPattern } from '../../utils/url';
import './styles.css';

type Tab = 'general' | 'profiles' | 'translation' | 'about';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const locale: SupportedLocale = resolveLanguage(settings.uiLang);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning'; message: string } | null>(null);

  // Edit Profile modal/state
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Test connection state
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ profileId: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      const s = await getSettings();
      const p = await getProfiles();
      setSettings(s);
      setProfiles(p);
    }
    load();
  }, []);

  const showAlert = (type: 'success' | 'danger' | 'warning', message: string) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert(null);
    }, 4000);
  };

  // 1. Synchronous permission request & profile saving
  const handleSaveProfile = async () => {
    if (!editingProfile) return;

    if (!editingProfile.name.trim()) {
      showAlert('danger', locale === 'zh_CN' ? '配置档名称不能为空' : 'Profile name cannot be empty');
      return;
    }
    if (!editingProfile.baseUrl.trim()) {
      showAlert('danger', locale === 'zh_CN' ? 'Base URL 不能为空' : 'Base URL cannot be empty');
      return;
    }
    if (!editingProfile.apiKey.trim()) {
      showAlert('danger', locale === 'zh_CN' ? 'API Key 不能为空' : 'API Key cannot be empty');
      return;
    }
    if (editingProfile.models.length === 0) {
      showAlert('danger', t('needAtLeastOneModel', undefined, locale));
      return;
    }

    // Step 1: Standardize pattern synchronously
    let matchPattern: string;
    try {
      matchPattern = normalizeToMatchPattern(editingProfile.baseUrl);
    } catch (err: any) {
      showAlert('danger', err?.message || (locale === 'zh_CN' ? 'Base URL 格式无效' : 'Invalid Base URL'));
      return;
    }

    // Step 2: Request origin permission immediately in the user gesture
    let granted = false;
    try {
      if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
        granted = await chrome.permissions.request({
          origins: [matchPattern],
        });
      } else {
        granted = true; // Fallback for dev/mock
      }
    } catch (err: any) {
      showAlert('danger', `Error requesting permission: ${err?.message}`);
      return;
    }

    if (!granted) {
      showAlert(
        'danger',
        locale === 'zh_CN'
          ? `未获得端点 "${matchPattern}" 的网络访问权限。由于浏览器安全策略限制，未授权的端点无法发送翻译请求。`
          : `Network permission for "${matchPattern}" was not granted. Due to browser security policies, translation requests cannot be sent to unauthorized endpoints.`
      );
      return;
    }

    // Step 3: Save to storage
    const normalizedProfile: Profile = {
      ...editingProfile,
      baseUrl: cleanBaseUrl(editingProfile.baseUrl),
    };

    let updatedProfiles: Profile[];
    if (isCreating) {
      updatedProfiles = [...profiles, normalizedProfile];
    } else {
      updatedProfiles = profiles.map((p) => (p.id === normalizedProfile.id ? normalizedProfile : p));
    }

    await saveProfiles(updatedProfiles);
    setProfiles(updatedProfiles);
    setEditingProfile(null);
    setIsCreating(false);
    showAlert('success', locale === 'zh_CN' ? `配置档 "${normalizedProfile.name}" 保存成功` : `Profile "${normalizedProfile.name}" saved successfully`);
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      showAlert('warning', t('needAtLeastOneProfile', undefined, locale));
      return;
    }
    const target = profiles.find((p) => p.id === id);
    if (confirm(t('deleteProfileConfirm', { name: target?.name || '' }, locale))) {
      const updated = profiles.filter((p) => p.id !== id);
      await saveProfiles(updated);
      setProfiles(updated);
      showAlert('success', locale === 'zh_CN' ? '配置档已删除' : 'Profile deleted');
    }
  };

  const handleSetDefaultModel = async (profileId: string, modelId: string) => {
    const updated = await saveSettings({
      defaultProfileId: profileId,
      defaultModelId: modelId,
    });
    setSettings(updated);
    showAlert('success', locale === 'zh_CN' ? '已设为默认模型' : 'Set as default model');
  };

  // Test Connection (Ping -> Pong)
  const handleTestConnection = async (profile: Profile) => {
    setTestingProfileId(profile.id);
    setTestResult(null);

    if (!profile.baseUrl?.trim()) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message: locale === 'zh_CN' ? 'Base URL 不能为空' : 'Base URL cannot be empty',
      });
      setTestingProfileId(null);
      return;
    }

    if (!profile.apiKey?.trim()) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message: locale === 'zh_CN' ? 'API Key 不能为空' : 'API Key cannot be empty',
      });
      setTestingProfileId(null);
      return;
    }

    const activeModel = profile.models.find((m) => m.enabled) || profile.models[0];
    if (!activeModel) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message: locale === 'zh_CN' ? '该配置档下没有已启用的模型' : 'No enabled models under this profile',
      });
      setTestingProfileId(null);
      return;
    }

    // Ensure permissions if needed
    try {
      const matchPattern = normalizeToMatchPattern(profile.baseUrl);
      if (typeof chrome !== 'undefined' && chrome.permissions?.contains) {
        const hasPerm = await chrome.permissions.contains({ origins: [matchPattern] });
        if (!hasPerm && chrome.permissions?.request) {
          const granted = await chrome.permissions.request({ origins: [matchPattern] });
          if (!granted) {
            setTestResult({
              profileId: profile.id,
              success: false,
              message:
                locale === 'zh_CN'
                  ? `未获得对端点 "${matchPattern}" 的访问权限，无法发起测试`
                  : `Permission not granted for "${matchPattern}", unable to test`,
            });
            setTestingProfileId(null);
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    const adapter = getAdapter(profile.protocol);
    const startTime = Date.now();
    try {
      const stream = adapter.translate({
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: activeModel.name,
        systemPrompt:
          'You are an API health test responder. When the user sends "ping", reply with "pong" only. Do not output any punctuation, prefix, or explanation.',
        targetLang: 'pong',
        text: 'ping',
        rawPrompt: true,
        params: { ...(activeModel.params || {}), max_tokens: 20 },
        streaming: false,
      });

      let full = '';
      for await (const chunk of stream) {
        full += chunk;
      }

      const elapsed = Date.now() - startTime;
      const cleanOutput = full.trim();

      setTestResult({
        profileId: profile.id,
        success: true,
        message:
          locale === 'zh_CN'
            ? `连通成功！发送: ping -> 响应: ${cleanOutput || 'pong'} (耗时 ${elapsed}ms)`
            : `Connected! ping -> ${cleanOutput || 'pong'} (${elapsed}ms)`,
      });
    } catch (err: any) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message:
          err?.message ||
          (locale === 'zh_CN' ? '连接失败，请检查 API Key 或端点地址' : 'Connection failed. Please check API Key or Base URL'),
      });
    } finally {
      setTestingProfileId(null);
    }
  };

  const handleSaveSettings = async (partial: Partial<AppSettings>) => {
    const updated = await saveSettings(partial);
    setSettings(updated);
    showAlert('success', t('settingsSaved', undefined, locale));
  };

  const handleOpenShortcuts = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
  };

  return (
    <div className="options-layout">
      {/* Header */}
      <header className="options-header">
        <div className="header-brand">
          <img src="/icons/icon-48.png" alt="Logo" className="brand-logo" />
          <div>
            <h1 className="brand-title">{t('optionsTitle', undefined, locale)}</h1>
            <p className="brand-subtitle">
              {locale === 'zh_CN'
                ? '自由配置大模型端点，安全私密，零中转零数据收集'
                : 'Directly connect to your LLM endpoints with privacy, zero tracking, and no intermediary servers'}
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          {t('generalTab', undefined, locale)}
        </button>
        <button
          className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          {t('profilesTab', undefined, locale)}
        </button>
        <button
          className={`tab-btn ${activeTab === 'translation' ? 'active' : ''}`}
          onClick={() => setActiveTab('translation')}
        >
          {t('translationTab', undefined, locale)}
        </button>
        <button
          className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          {t('aboutTab', undefined, locale)}
        </button>
      </nav>

      {/* Alert Banner */}
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

      {/* Tab 1: General & UI */}
      {activeTab === 'general' && (
        <section className="panel">
          <div>
            <h2 className="panel-title">{t('generalTab', undefined, locale)}</h2>
            <p className="panel-desc">
              {locale === 'zh_CN'
                ? '配置界面显示语言、全局生效开关及划词触发机制。'
                : 'Configure interface display language, global master switch, and selection triggers.'}
            </p>
          </div>

          {/* Interface Language Setting Card */}
          <div className="setting-card">
            <div className="setting-card-header">
              <div>
                <h3 className="setting-card-title">{t('uiLanguageLabel', undefined, locale)}</h3>
                <p className="setting-card-desc">{t('uiLanguageDesc', undefined, locale)}</p>
              </div>
            </div>

            <div className="lang-options-grid">
              <button
                type="button"
                className={`lang-card-option ${settings.uiLang === 'auto' ? 'active' : ''}`}
                onClick={() => handleSaveSettings({ uiLang: 'auto' })}
              >
                <div className="lang-card-radio">
                  <span className={`radio-dot ${settings.uiLang === 'auto' ? 'selected' : ''}`} />
                </div>
                <div className="lang-card-content">
                  <div className="lang-card-title">{t('langAuto', undefined, locale)}</div>
                  <div className="lang-card-desc">{t('langAutoDesc', undefined, locale)}</div>
                </div>
              </button>

              <button
                type="button"
                className={`lang-card-option ${settings.uiLang === 'zh_CN' ? 'active' : ''}`}
                onClick={() => handleSaveSettings({ uiLang: 'zh_CN' })}
              >
                <div className="lang-card-radio">
                  <span className={`radio-dot ${settings.uiLang === 'zh_CN' ? 'selected' : ''}`} />
                </div>
                <div className="lang-card-content">
                  <div className="lang-card-title">{t('langZh', undefined, locale)}</div>
                  <div className="lang-card-desc">{t('langZhDesc', undefined, locale)}</div>
                </div>
              </button>

              <button
                type="button"
                className={`lang-card-option ${settings.uiLang === 'en' ? 'active' : ''}`}
                onClick={() => handleSaveSettings({ uiLang: 'en' })}
              >
                <div className="lang-card-radio">
                  <span className={`radio-dot ${settings.uiLang === 'en' ? 'selected' : ''}`} />
                </div>
                <div className="lang-card-content">
                  <div className="lang-card-title">{t('langEn', undefined, locale)}</div>
                  <div className="lang-card-desc">{t('langEnDesc', undefined, locale)}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Master Switch Card */}
          <div className="setting-card">
            <label className="checkbox-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.globalEnabled}
                onChange={(e) =>
                  handleSaveSettings({ globalEnabled: (e.target as HTMLInputElement).checked })
                }
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{t('globalEnabledLabel', undefined, locale)}</div>
                <div className="form-hint">{t('globalEnabledDesc', undefined, locale)}</div>
              </div>
            </label>
          </div>

          {/* Triggers Card */}
          <div className="setting-card">
            <h3 className="setting-card-title">
              {locale === 'zh_CN' ? '划词触发方式' : 'Selection Triggers'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.triggers.selectionButton}
                  onChange={(e) =>
                    handleSaveSettings({
                      triggers: { ...settings.triggers, selectionButton: (e.target as HTMLInputElement).checked },
                    })
                  }
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{t('selectionButtonLabel', undefined, locale)}</div>
                  <div className="form-hint">{t('selectionButtonDesc', undefined, locale)}</div>
                </div>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.triggers.contextMenu}
                  onChange={(e) =>
                    handleSaveSettings({
                      triggers: { ...settings.triggers, contextMenu: (e.target as HTMLInputElement).checked },
                    })
                  }
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{t('contextMenuLabel', undefined, locale)}</div>
                  <div className="form-hint">{t('contextMenuDesc', undefined, locale)}</div>
                </div>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.triggers.shortcut}
                  onChange={(e) =>
                    handleSaveSettings({
                      triggers: { ...settings.triggers, shortcut: (e.target as HTMLInputElement).checked },
                    })
                  }
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{t('shortcutLabel', undefined, locale)} (Alt+T)</div>
                  <div className="form-hint">{t('shortcutDesc', undefined, locale)}</div>
                </div>
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {locale === 'zh_CN' ? '自定义快捷键按键组合' : 'Custom Keyboard Shortcut'}
                </div>
                <div className="form-hint">
                  {locale === 'zh_CN'
                    ? '受 Chrome 安全规范限制，扩展无法直接篡改系统按键，请点击前往 Chrome 扩展快捷键管理页自定义。'
                    : 'Due to browser security rules, shortcuts must be customized via Chrome Extension Shortcuts page.'}
                </div>
              </div>
              <button className="btn" onClick={handleOpenShortcuts}>
                {t('editShortcuts', undefined, locale)}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tab 2: Profiles Management */}
      {activeTab === 'profiles' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="panel-title">{t('profilesTitle', undefined, locale)}</h2>
              <p className="panel-desc">
                {locale === 'zh_CN'
                  ? '配置您自己的 API Key。保存配置时浏览器将弹出原生授权弹窗以申请端点访问权限。'
                  : 'Configure your own API Keys. When saving, the browser requests native origin permissions.'}
              </p>
            </div>
            {!editingProfile && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsCreating(true);
                  setEditingProfile({
                    id: `profile-${Date.now()}`,
                    name: locale === 'zh_CN' ? '新配置档' : 'New Profile',
                    baseUrl: 'https://api.openai.com/v1',
                    apiKey: '',
                    protocol: 'openai-messages',
                    models: [
                      {
                        id: `model-${Date.now()}`,
                        name: 'gpt-4o-mini',
                        params: { temperature: 0.7 },
                        enabled: true,
                      },
                    ],
                  });
                }}
              >
                {t('addProfile', undefined, locale)}
              </button>
            )}
          </div>

          {/* Edit / Create Form */}
          {editingProfile && (
            <div className="profile-card" style={{ borderColor: 'var(--primary)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                {isCreating
                  ? (locale === 'zh_CN' ? '新建配置档' : 'New Profile')
                  : `${locale === 'zh_CN' ? '编辑配置档' : 'Edit Profile'}: ${editingProfile.name}`}
              </h3>

              <div className="form-group">
                <label className="form-label">{t('profileName', undefined, locale)}</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingProfile.name}
                  onInput={(e) =>
                    setEditingProfile({ ...editingProfile, name: (e.target as HTMLInputElement).value })
                  }
                  placeholder="DeepSeek / OpenAI / Ollama"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('apiEndpoint', undefined, locale)}</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingProfile.baseUrl}
                  onInput={(e) =>
                    setEditingProfile({ ...editingProfile, baseUrl: (e.target as HTMLInputElement).value })
                  }
                  placeholder="https://api.deepseek.com/v1"
                />
                <span className="form-hint">
                  {locale === 'zh_CN'
                    ? '保存时会自动提取并请求授权 Match Pattern (如 https://api.deepseek.com/*)'
                    : 'Origin match pattern will be extracted and requested upon saving (e.g. https://api.openai.com/*)'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">{t('apiKey', undefined, locale)}</label>
                <input
                  type="password"
                  className="form-input"
                  value={editingProfile.apiKey}
                  onInput={(e) =>
                    setEditingProfile({ ...editingProfile, apiKey: (e.target as HTMLInputElement).value })
                  }
                  placeholder="sk-..."
                />
                <span className="form-hint">
                  {locale === 'zh_CN' ? '密钥仅保存在本地 chrome.storage.local' : 'API Key is securely stored in local chrome.storage.local only'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">{t('protocol', undefined, locale)}</label>
                <select
                  className="form-select"
                  value={editingProfile.protocol}
                  onChange={(e) =>
                    setEditingProfile({
                      ...editingProfile,
                      protocol: (e.target as HTMLSelectElement).value as ProtocolType,
                    })
                  }
                >
                  <option value="openai-messages">OpenAI Chat Completions (/chat/completions)</option>
                  <option value="openai-responses">OpenAI Responses API (/responses)</option>
                  <option value="anthropic">Anthropic Messages API (/messages)</option>
                </select>
              </div>

              {/* Models sub-list */}
              <div className="models-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{t('modelsList', undefined, locale)}</span>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const newModel: ModelConfig = {
                        id: `model-${Date.now()}`,
                        name: 'new-model',
                        params: { temperature: 0.7 },
                        enabled: true,
                      };
                      setEditingProfile({
                        ...editingProfile,
                        models: [...editingProfile.models, newModel],
                      });
                    }}
                  >
                    {t('addModel', undefined, locale)}
                  </button>
                </div>

                {editingProfile.models.map((m, idx) => (
                  <div key={m.id} className="model-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) => {
                          const updatedModels = [...editingProfile.models];
                          updatedModels[idx] = { ...m, enabled: (e.target as HTMLInputElement).checked };
                          setEditingProfile({ ...editingProfile, models: updatedModels });
                        }}
                        title={locale === 'zh_CN' ? '是否在悬浮卡片下拉列表中显示' : 'Enable in model dropdown list'}
                      />
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '12px', width: '180px' }}
                        value={m.name}
                        onInput={(e) => {
                          const updatedModels = [...editingProfile.models];
                          updatedModels[idx] = { ...m, name: (e.target as HTMLInputElement).value };
                          setEditingProfile({ ...editingProfile, models: updatedModels });
                        }}
                        placeholder={locale === 'zh_CN' ? '模型名，如 deepseek-chat' : 'Model name, e.g. gpt-4o-mini'}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Temp:
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '12px', width: '60px' }}
                        value={m.params?.temperature ?? 0.7}
                        onInput={(e) => {
                          const val = parseFloat((e.target as HTMLInputElement).value);
                          const updatedModels = [...editingProfile.models];
                          updatedModels[idx] = { ...m, params: { ...m.params, temperature: isNaN(val) ? 0.7 : val } };
                          setEditingProfile({ ...editingProfile, models: updatedModels });
                        }}
                      />
                    </div>

                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        const updatedModels = editingProfile.models.filter((_, i) => i !== idx);
                        setEditingProfile({ ...editingProfile, models: updatedModels });
                      }}
                    >
                      {t('delete', undefined, locale)}
                    </button>
                  </div>
                ))}
              </div>

              {testResult && testResult.profileId === editingProfile.id && (
                <div className={`alert alert-${testResult.success ? 'success' : 'danger'}`} style={{ marginTop: '10px' }}>
                  {testResult.message}
                </div>
              )}

              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  className="btn"
                  onClick={() => handleTestConnection(editingProfile)}
                  disabled={testingProfileId === editingProfile.id}
                >
                  {testingProfileId === editingProfile.id ? t('testingConnection', undefined, locale) : `${t('testConnection', undefined, locale)} (ping)`}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setEditingProfile(null);
                    setIsCreating(false);
                  }}
                >
                  {t('cancel', undefined, locale)}
                </button>
                <button className="btn btn-primary" onClick={handleSaveProfile}>
                  {locale === 'zh_CN' ? '保存配置并授权' : 'Save & Grant Permissions'}
                </button>
              </div>
            </div>
          )}

          {/* Profiles Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profiles.map((profile) => (
              <div key={profile.id} className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-name-tag">
                    <span>{profile.name}</span>
                    <span className="protocol-badge">{profile.protocol}</span>
                  </div>

                  <div className="btn-group">
                    <button
                      className="btn btn-sm"
                      onClick={() => handleTestConnection(profile)}
                      disabled={testingProfileId === profile.id}
                    >
                      {testingProfileId === profile.id ? t('testingConnection', undefined, locale) : t('testConnection', undefined, locale)}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingProfile(JSON.parse(JSON.stringify(profile)));
                      }}
                    >
                      {locale === 'zh_CN' ? '编辑' : 'Edit'}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      {t('delete', undefined, locale)}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {locale === 'zh_CN' ? '端点' : 'Endpoint'}: <code>{profile.baseUrl}</code> | Key:{' '}
                  <code>{profile.apiKey ? `${profile.apiKey.slice(0, 7)}...` : (locale === 'zh_CN' ? '未配置' : 'None')}</code>
                </div>

                {/* Test Result alert */}
                {testResult && testResult.profileId === profile.id && (
                  <div className={`alert alert-${testResult.success ? 'success' : 'danger'}`}>
                    {testResult.message}
                  </div>
                )}

                {/* Models List */}
                <div className="models-section">
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('modelsList', undefined, locale)}:</span>
                  {profile.models.map((m) => {
                    const isDefault =
                      settings.defaultProfileId === profile.id && settings.defaultModelId === m.id;
                    return (
                      <div key={m.id} className="model-row">
                        <div className="model-info">
                          <span style={{ fontWeight: 500 }}>{m.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            (Temp: {m.params?.temperature ?? 0.7})
                          </span>
                          {isDefault && <span className="default-tag">{t('defaultModel', undefined, locale)}</span>}
                        </div>

                        <div>
                          {!isDefault && (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleSetDefaultModel(profile.id, m.id)}
                            >
                              {t('setDefault', undefined, locale)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 2: Translation Options */}
      {activeTab === 'translation' && (
        <section className="panel">
          <div>
            <h2 className="panel-title">{t('translationSettings', undefined, locale)}</h2>
            <p className="panel-desc">
              {locale === 'zh_CN'
                ? '定制界面语言、目标语言、系统提示词与流式推流模式。'
                : 'Customize interface language, target language, system prompt, and streaming.'}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">{t('targetLangLabel', undefined, locale)}</label>
            <select
              className="form-select"
              value={settings.targetLang}
              onChange={(e) =>
                handleSaveSettings({ targetLang: (e.target as HTMLSelectElement).value })
              }
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label} ({lang.code})
                </option>
              ))}
            </select>
            <span className="form-hint">{t('targetLangDesc', undefined, locale)}</span>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">{t('systemPromptLabel', undefined, locale)}</label>
              <button
                className="btn btn-sm"
                onClick={() => handleSaveSettings({ systemPrompt: DEFAULT_SETTINGS.systemPrompt })}
              >
                {locale === 'zh_CN' ? '恢复默认提示词' : 'Reset to Default'}
              </button>
            </div>
            <textarea
              className="form-textarea"
              rows={4}
              value={settings.systemPrompt}
              onInput={(e) =>
                setSettings({ ...settings, systemPrompt: (e.target as HTMLTextAreaElement).value })
              }
              onBlur={() => handleSaveSettings({ systemPrompt: settings.systemPrompt })}
            />
            <span className="form-hint">{t('systemPromptDesc', undefined, locale)}</span>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>
                {t('contextCharsLabel', undefined, locale)}: {settings.contextChars}{' '}
                {locale === 'zh_CN' ? '字符' : 'chars'}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="500"
              step="50"
              value={settings.contextChars}
              onInput={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10);
                handleSaveSettings({ contextChars: val });
              }}
            />
            <span className="form-hint">{t('contextCharsDesc', undefined, locale)}</span>
          </div>

          <div className="form-group">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.streaming}
                onChange={(e) =>
                  handleSaveSettings({ streaming: (e.target as HTMLInputElement).checked })
                }
              />
              <span style={{ fontWeight: 500 }}>{t('streamingLabel', undefined, locale)} (SSE Stream)</span>
            </label>
            <span className="form-hint" style={{ marginLeft: '24px' }}>
              {t('streamingDesc', undefined, locale)}
            </span>
          </div>
        </section>
      )}

      {/* Tab 4: History & About */}
      {activeTab === 'about' && (
        <section className="panel">
          <div>
            <h2 className="panel-title">{t('historySettingsTitle', undefined, locale)}</h2>
            <p className="panel-desc">
              {locale === 'zh_CN'
                ? '管理本地缓存与历史数据，了解扩展安全机制。'
                : 'Manage local history, cache entries, and review privacy guarantees.'}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">{t('historyStorageLabel', undefined, locale)}</label>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {t('historyStorageDesc', undefined, locale)}
            </div>
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (confirm(t('clearHistoryConfirm', undefined, locale))) {
                    await clearHistory();
                    showAlert('success', t('historyCleared', undefined, locale));
                  }
                }}
              >
                {t('clearAllHistory', undefined, locale)}
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
              {locale === 'zh_CN' ? '隐私与安全保障' : 'Privacy & Security Guarantees'}
            </h3>
            <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>
                <strong>{locale === 'zh_CN' ? '零后端服务器' : 'Zero Intermediary Servers'}</strong>：
                {locale === 'zh_CN'
                  ? '浏览器直接请求用户配置的模型官方端点，不经过任何第三方中间层服务器。'
                  : 'Direct HTTPS communication with your designated LLM endpoints.'}
              </li>
              <li>
                <strong>{locale === 'zh_CN' ? '零数据收集' : 'Zero Data Collection'}</strong>：
                {locale === 'zh_CN'
                  ? '不统计、不上报、不存储任何用户的浏览行为、网页内容或个人身份。'
                  : 'No tracking, telemetry, or storage of user browsing data.'}
              </li>
              <li>
                <strong>{locale === 'zh_CN' ? '最小权限声明' : 'Minimal Permissions'}</strong>：
                {locale === 'zh_CN'
                  ? '不申请高危 tabs 权限，严格仅申请本地存储与按需 host 权限。'
                  : 'Only local storage and user-authorized endpoint host permissions are requested.'}
              </li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
