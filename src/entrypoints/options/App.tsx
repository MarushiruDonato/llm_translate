import { useEffect, useState } from 'preact/hooks';
import { getAdapter } from '../../adapters';
import { clearHistory, getProfiles, getSettings, saveProfiles, saveSettings } from '../../storage';
import { AppSettings, ModelConfig, Profile, ProtocolType } from '../../types';
import { DEFAULT_SETTINGS, TARGET_LANGUAGES } from '../../utils/constants';
import { cleanBaseUrl, normalizeToMatchPattern } from '../../utils/url';
import './styles.css';

type Tab = 'profiles' | 'translation' | 'triggers' | 'about';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('profiles');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
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
      showAlert('danger', '配置档名称不能为空');
      return;
    }
    if (!editingProfile.baseUrl.trim()) {
      showAlert('danger', 'Base URL 不能为空');
      return;
    }
    if (!editingProfile.apiKey.trim()) {
      showAlert('danger', 'API Key 不能为空');
      return;
    }
    if (editingProfile.models.length === 0) {
      showAlert('danger', '请至少添加一个模型');
      return;
    }

    // Step 1: Standardize pattern synchronously
    let matchPattern: string;
    try {
      matchPattern = normalizeToMatchPattern(editingProfile.baseUrl);
    } catch (err: any) {
      showAlert('danger', err?.message || 'Base URL 格式无效');
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
      showAlert('danger', `请求权限时出错: ${err?.message}`);
      return;
    }

    if (!granted) {
      showAlert(
        'danger',
        `未获得端点 "${matchPattern}" 的网络访问权限。由于浏览器安全策略限制，未授权的端点无法发送翻译请求。`
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
    showAlert('success', `配置档 "${normalizedProfile.name}" 保存成功，已授权 ${matchPattern}`);
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      showAlert('warning', '请保留至少一个配置档');
      return;
    }
    if (confirm('确定要删除该配置档吗？')) {
      const updated = profiles.filter((p) => p.id !== id);
      await saveProfiles(updated);
      setProfiles(updated);
      showAlert('success', '配置档已删除');
    }
  };

  const handleSetDefaultModel = async (profileId: string, modelId: string) => {
    const updated = await saveSettings({
      defaultProfileId: profileId,
      defaultModelId: modelId,
    });
    setSettings(updated);
    showAlert('success', '已设为默认模型');
  };

  // Test Connection
  const handleTestConnection = async (profile: Profile) => {
    setTestingProfileId(profile.id);
    setTestResult(null);

    const activeModel = profile.models.find((m) => m.enabled) || profile.models[0];
    if (!activeModel) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message: '该配置档下没有已启用的模型',
      });
      setTestingProfileId(null);
      return;
    }

    const adapter = getAdapter(profile.protocol);
    try {
      const stream = adapter.translate({
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: activeModel.name,
        systemPrompt: 'You are a translator. Translate this directly without explanation.',
        targetLang: '中文',
        text: 'Hello, world!',
        params: activeModel.params,
        streaming: false,
      });

      let full = '';
      for await (const chunk of stream) {
        full += chunk;
      }

      setTestResult({
        profileId: profile.id,
        success: true,
        message: `连通成功！测试返回: "${full.trim().slice(0, 100)}"`,
      });
    } catch (err: any) {
      setTestResult({
        profileId: profile.id,
        success: false,
        message: err?.message || '连接失败，请检查 API Key 或端点地址',
      });
    } finally {
      setTestingProfileId(null);
    }
  };

  const handleSaveSettings = async (partial: Partial<AppSettings>) => {
    const updated = await saveSettings(partial);
    setSettings(updated);
    showAlert('success', '设置已保存');
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
            <h1 className="brand-title">LLM 划词翻译</h1>
            <p className="brand-subtitle">自由配置大模型端点，安全私密，零中转零数据收集</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          模型配置档
        </button>
        <button
          className={`tab-btn ${activeTab === 'translation' ? 'active' : ''}`}
          onClick={() => setActiveTab('translation')}
        >
          翻译选项
        </button>
        <button
          className={`tab-btn ${activeTab === 'triggers' ? 'active' : ''}`}
          onClick={() => setActiveTab('triggers')}
        >
          快捷与触发
        </button>
        <button
          className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          历史与关于
        </button>
      </nav>

      {/* Alert Banner */}
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

      {/* Tab 1: Profiles Management */}
      {activeTab === 'profiles' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="panel-title">LLM 配置档管理</h2>
              <p className="panel-desc">
                配置您自己的 API Key。保存配置时浏览器将弹出原生授权弹窗以申请端点访问权限。
              </p>
            </div>
            {!editingProfile && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setIsCreating(true);
                  setEditingProfile({
                    id: `profile-${Date.now()}`,
                    name: '新配置档',
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
                + 添加配置档
              </button>
            )}
          </div>

          {/* Edit / Create Form */}
          {editingProfile && (
            <div className="profile-card" style={{ borderColor: 'var(--primary)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                {isCreating ? '新建配置档' : `编辑配置档: ${editingProfile.name}`}
              </h3>

              <div className="form-group">
                <label className="form-label">配置档显示名称</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingProfile.name}
                  onInput={(e) =>
                    setEditingProfile({ ...editingProfile, name: (e.target as HTMLInputElement).value })
                  }
                  placeholder="例如: DeepSeek / OpenAI / 本地 Ollama"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Base URL (API 端点)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingProfile.baseUrl}
                  onInput={(e) =>
                    setEditingProfile({ ...editingProfile, baseUrl: (e.target as HTMLInputElement).value })
                  }
                  placeholder="例如: https://api.deepseek.com/v1"
                />
                <span className="form-hint">
                  保存时会自动提取并请求授权 Match Pattern (如 https://api.deepseek.com/*)
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  className="form-input"
                  value={editingProfile.apiKey}
                  onInput={(e) =>
                    setEditingProfile({ ...editingProfile, apiKey: (e.target as HTMLInputElement).value })
                  }
                  placeholder="sk-..."
                />
                <span className="form-hint">密钥仅保存在本地 chrome.storage.local，绝不上报或泄露</span>
              </div>

              <div className="form-group">
                <label className="form-label">API 协议格式</label>
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
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>包含模型列表</span>
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
                    + 添加模型
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
                        title="是否在悬浮卡片下拉列表中显示"
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
                        placeholder="模型名，如 deepseek-chat"
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
                      删除
                    </button>
                  </div>
                ))}
              </div>

              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  className="btn"
                  onClick={() => {
                    setEditingProfile(null);
                    setIsCreating(false);
                  }}
                >
                  取消
                </button>
                <button className="btn btn-primary" onClick={handleSaveProfile}>
                  保存配置并授权
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
                      {testingProfileId === profile.id ? '测试中...' : '测试连接'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingProfile(JSON.parse(JSON.stringify(profile)));
                      }}
                    >
                      编辑
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteProfile(profile.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  端点: <code>{profile.baseUrl}</code> | Key:{' '}
                  <code>{profile.apiKey ? `${profile.apiKey.slice(0, 7)}...` : '未配置'}</code>
                </div>

                {/* Test Result alert */}
                {testResult && testResult.profileId === profile.id && (
                  <div className={`alert alert-${testResult.success ? 'success' : 'danger'}`}>
                    {testResult.message}
                  </div>
                )}

                {/* Models List */}
                <div className="models-section">
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>模型列表:</span>
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
                          {isDefault && <span className="default-tag">默认模型</span>}
                        </div>

                        <div>
                          {!isDefault && (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleSetDefaultModel(profile.id, m.id)}
                            >
                              设为默认
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
            <h2 className="panel-title">翻译参数与行为</h2>
            <p className="panel-desc">定制目标语言、系统提示词与流式推流模式。</p>
          </div>

          <div className="form-group">
            <label className="form-label">默认目标语言</label>
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
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">系统提示词 (System Prompt)</label>
              <button
                className="btn btn-sm"
                onClick={() => handleSaveSettings({ systemPrompt: DEFAULT_SETTINGS.systemPrompt })}
              >
                恢复默认提示词
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
            <span className="form-hint">指导模型如何翻译文本与遵循输出格式要求。</span>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>周围上下文范围 (0–500 字符): {settings.contextChars} 字符</span>
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
            <span className="form-hint">
              设为 0 表示不提取周围上下文。设置大于 0 可辅助模型理解段落语境（但仅翻译用户划选文字）。
            </span>
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
              <span style={{ fontWeight: 500 }}>开启流式逐字输出 (SSE Stream)</span>
            </label>
            <span className="form-hint" style={{ marginLeft: '24px' }}>
              开启后模型将逐字打字推流展示；关闭后将在全部生成完毕后一次性呈现。
            </span>
          </div>
        </section>
      )}

      {/* Tab 3: Triggers & Shortcuts */}
      {activeTab === 'triggers' && (
        <section className="panel">
          <div>
            <h2 className="panel-title">触发方式与快捷键</h2>
            <p className="panel-desc">配置划词后弹窗触发机制与浏览器原生快捷键。</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                <div style={{ fontWeight: 500 }}>划词后显示轻量悬浮图标按钮</div>
                <div className="form-hint">划选网页文本后，在鼠标光标右上方弹出小翻译按钮，点击后开始翻译。</div>
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
                <div style={{ fontWeight: 500 }}>右键菜单提供「翻译所选内容」入口</div>
                <div className="form-hint">在选中文本上点击鼠标右键，直接点击菜单项发起翻译。</div>
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
                <div style={{ fontWeight: 500 }}>启用键盘快捷键（默认 Alt+T）</div>
                <div className="form-hint">选中网页文本后按下快捷键即可直接就地呼出翻译卡片。</div>
              </div>
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>自定义快捷键按键组合</div>
                <div className="form-hint">
                  受 Chrome 安全规范限制，扩展无法直接篡改系统按键，请点击前往 Chrome 扩展快捷键管理页自定义。
                </div>
              </div>
              <button className="btn" onClick={handleOpenShortcuts}>
                前往自定义快捷键 ↗
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: History & About */}
      {activeTab === 'about' && (
        <section className="panel">
          <div>
            <h2 className="panel-title">存储缓存与关于</h2>
            <p className="panel-desc">管理本地缓存与历史数据，了解扩展安全机制。</p>
          </div>

          <div className="form-group">
            <label className="form-label">历史记录容量</label>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              本地 LRU 自动淘汰，上限固定为 500 条。历史记录同时兼顾本地瞬时命中缓存。
            </div>
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (confirm('确定要清空全部翻译历史记录吗？')) {
                    await clearHistory();
                    showAlert('success', '所有本地历史记录已清空');
                  }
                }}
              >
                立即清空所有历史记录
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>隐私与安全保障</h3>
            <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>零后端服务器</strong>：浏览器直接请求用户配置的模型官方端点，不经过任何第三方中间层服务器。</li>
              <li><strong>零数据收集</strong>：不统计、不上报、不存储任何用户的浏览行为、网页内容或个人身份。</li>
              <li><strong>最小权限声明</strong>：不申请高危 tabs 权限，严格仅申请本地存储与按需 host 权限。</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
