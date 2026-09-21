# LLM 划词翻译 Chrome 扩展 — 设计文档

> 状态：已确认。实现计划见 [IMPLEMENTATION.md](./IMPLEMENTATION.md)。

## 一、产品定位

Chrome 浏览器扩展。用户在任意普通网页上划选文字，通过 LLM 翻译成目标语言（默认中文），结果展示在选区附近的悬浮卡片中。用户自带 API Key（BYOK），插件零后端、零服务器。

## 二、核心决策总表

| # | 分支 | 决策 |
|---|------|------|
| 1 | 触发方式 | 混合模式：划词弹按钮 + 右键菜单 + 快捷键（`chrome.commands` 原生命令，默认 `Alt+T`），均可在设置中独立开关 |
| 2 | 结果展示 | 选区附近悬浮卡片（不做行内替换、不做侧边栏）；基于 Shadow DOM 强隔离 |
| 3 | LLM 接入 | BYOK，多配置档，OpenAI 兼容端点为一等公民 |
| 4 | 语言处理 | 源语言 LLM 自动识别；目标语言为设置项（默认中文） |
| 5 | 流式输出 | 默认开启（SSE 逐字显示），设置可关；通过 `chrome.runtime.connect` (Port) 双向流式通信，支持 `onDisconnect` 触发 `AbortController` 掐断请求 |
| 6 | 请求内容 | 默认只发选中文本；系统提示词用户可编辑；周围上下文范围可配置（默认 0 = 关闭） |
| 7 | 卡片功能 | 富功能：译文 + 复制 + 重试 + 切换模型 + 钉住 + 历史记录入口 |
| 8 | 模型配置 | 配置档（Profile）→ 多模型（Model）→ 每模型独立参数；协议为配置档级字段 |
| 9 | 协议支持 | 适配器架构；首发三协议：OpenAI `messages`、OpenAI `responses`、Anthropic 原生 |
| 10 | 历史记录 | 工具栏 popup 查看；`chrome.storage.local` 存储；上限 500 条自动淘汰；可搜索、复制、清空 |
| 11 | 缓存 | 历史即缓存（键 = 选中文本 + 模型 + 目标语言 + 上下文哈希 + Prompt哈希 + 模型参数哈希 + 翻译记忆哈希），命中秒显；「重试」永远绕过缓存 |
| 12 | 长度上限 | 5000 字符硬上限（常量），超出卡片内友好提示 |
| 13 | 页面兼容 | 普通网页 + iframe（`all_frames: true`，各 frame 独立处理，跨 frame 精确路由）；输入框、PDF 出 v1 范围 |
| 14 | 技术栈 | WXT + TypeScript + Preact；Content Script 卡片采用 WXT `createShadowRootUi` 彻底防样式污染 |
| 15 | 安全与权限 | Key 存 `chrome.storage.local`（仅 SW 与 Options 访问）；API 调用仅在 SW 发起；按配置档端点动态申请 `optional_host_permissions`（Options 页面用户手势首行同步调用） |
| 16 | 页面翻译记忆 | 同一页面内复用最近 N 条「原文→译文」滚动上下文提升术语/人称一致性；有界（默认 3 条）、可关、计入缓存键；Content Script 按 frame 持有 |

## 三、配置模型

```
Profile（配置档）
├── name            显示名（如 "DeepSeek"、"OpenAI"）
├── baseUrl         API 端点（如 "https://api.deepseek.com/v1"）
├── apiKey          密钥（仅 Options 页写入、Service Worker 读取）
├── protocol        "openai-messages" | "openai-responses" | "anthropic"
└── models[]        模型列表
    ├── name        模型名（如 "deepseek-chat"）
    ├── params      独立参数（temperature、max_tokens 等）
    └── enabled     是否出现在卡片切换列表中
```

- 可建任意多个配置档；其中一个模型被标记为全局默认。
- 卡片「切换模型」= 在所有配置档中已启用的模型之间切换（扁平列表，显示「配置档 / 模型」）。
- **动态 Host 权限规范**：
  - 用户在 Options 页面点击「保存配置档」时，必须由 Options 页面直接在用户点击事件同一步骤**同步调用** `chrome.permissions.request({ origins: [matchPattern] })`（MV3 强制要求必须存在直接的用户手势，不可跨异步转发至 Service Worker 调用）。
  - `baseUrl` 自动标准化提取为 Match Pattern（例如将 `https://api.openai.com/v1` 提取为 `https://api.openai.com/*`）。
  - Manifest 预先声明 `"optional_host_permissions": ["*://*/*"]`。

## 四、悬浮卡片规范

- **渲染隔离（Shadow DOM）**：
  - Content Script 必须使用 WXT 的 `createShadowRootUi` 挂载 Preact 卡片组件，样式完全封装在 Shadow Root 内部，杜绝宿主网页全局样式（如 `box-sizing`、Tailwind preflight 等）干扰，亦不污染宿主 DOM。
  - 容器外层赋予最高级层叠保护（`z-index: 2147483647`）。
  - 卡片内部交互事件（`pointerdown`, `click` 等）阻止向宿主网页冒泡，防止误触发网页本身的折叠或导航逻辑。
- **触发与定位**：
  - 划词触发：选区附近自动弹出轻量小按钮，点击按钮发起翻译并展开卡片。
  - 右键菜单触发：Background 捕获 `contextMenus.onClicked` 后，通过 `chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_TRANSLATE' }, { frameId: info.frameId })` 唤醒对应 frame 的 Content Script，由 Content Script 基于选区 Range 计算坐标直接弹窗并开始翻译。
  - 快捷键触发：捕获 `chrome.commands` 触发命令后唤醒当前活动标签页选区。注意 `onCommand` 回调**不携带 `frameId`**，因此需向该标签页所有 frame 广播触发消息（不带 frameId 的 `tabs.sendMessage`），无选区的 frame 静默忽略，有选区者响应。
  - 边界与防截断：卡片出现时计算视口边界（含 iframe 视口限制），自适应调整位置（Flip / Shift 翻转避让），避免超出视口或被小型 iframe 裁剪。
- **内容与操作**：
  - 内容：流式译文（或缓存命中秒显）、源语言识别结果。
  - 操作：复制 / 重试（绕过缓存）/ 切换模型 / 钉住（钉住后不因点击外部自动关闭）/ 关闭。
  - 关闭：点击卡片外部、Esc、关闭按钮。
  - 可拖动；译文区域可滚动；卡片 UI 跟随页面或系统深浅色（`prefers-color-scheme`）。

## 五、Popup（工具栏）

- 最近历史列表（原文 + 译文 + 模型 + 时间），可搜索、单条复制、一键清空。
- 全局开关：临时禁用全部触发方式。
- 设置入口。

## 六、Settings 页面

1. **触发设置**：划词按钮 / 右键菜单 / 快捷键，各自独立开关。
   - 快捷键支持：默认 `Alt+T`，基于 `chrome.commands` 实现。由于浏览器安全策略限制扩展无法直接用脚本改写命令按键，设置页提供一键跳转至 `chrome://extensions/shortcuts` 的引导按钮供用户自由修改按键。
2. **目标语言**：默认「中文」，可选常用语言列表。
3. **翻译设置**：系统提示词（多行编辑）；上下文范围（0–N 字符，默认 0）；流式输出开关；长度上限固定 5000 不可改。
4. **配置档管理**：增删改配置档 → 模型列表 → 每模型参数；标记默认模型；保存配置档时原地同步触发浏览器 `chrome.permissions.request` 原生授权弹窗。
5. **历史设置**：查看上限（固定 500）、清空按钮。
6. **翻译记忆**：页面级滚动上下文开关（默认开启）、窗口大小（1–10 条，默认 3）。

## 七、页面翻译记忆（Page Translation Memory）

同一页面内多次划词翻译时，复用此前「原文→译文」作为对话上下文，提升术语、人称、语气一致性。

- **不采用字面意义的"同一对话"**（如 Responses API 的 `previous_response_id` 服务端会话）：供应商锁定、翻译历史留存于服务端的隐私风险、无法计入本地缓存键。改为**客户端滚动记忆**：每次请求携带最近 N 条翻译对，适配器按各协议渲染为历史轮次（user = 原文摘录，assistant = 译文），三协议通用。
- **状态归属**：记忆由 Content Script 在内存中持有——MV3 SW 会被回收不适合持有状态，而 Content Script 生命周期恰为页面生命周期：刷新/导航即重置，SPA 软导航保留，天然匹配"同一网页"语义。按 frame 隔离（主文档与各 iframe 各自独立），跨 frame 共享列为 v2。
- **有界性**（防 token 失控）：滚动窗口默认 3 条；单条摘录截断 300 字符；总预算 4000 字符，超出 FIFO 淘汰。
- **语义**：翻译成功后追加记忆；同一选区重试成功后**覆盖**末条而非重复追加；重试、切换模型不清空记忆（术语一致性跨模型依然有效）；记忆为空时请求体与基础路径完全一致。
- **缓存键联动**：缓存键追加记忆内容哈希。同页记忆增长后再次翻译同一选区将命中新键（带更丰富上下文重新翻译，属预期）；跨页面/跨会话因记忆不同更易缓存不命中，接受该代价。
- **隐私**：开启后单次请求发送内容随记忆增长（仍仅发往用户自配端点）；设置页开关默认开启，可随时关闭。

## 八、协议适配与通信架构

### 1. 通信通道（Long-lived Port）
MV3 的 `sendMessage` 为单次请求-响应，无法支持增量分块推流。Content Script 与 Background 之间采用 **Long-lived Connection (`chrome.runtime.connect`)**：

```
Content Script (卡片 UI)                    Background Service Worker
        |                                              |
        | --- connect({ name: 'translate-stream' }) -> | (onConnect 建立连接)
        | --- postMessage(TranslateRequest) ---------> | (解析请求，调用适配器)
        |                                              | (fetch SSE Stream)
        | <-- postMessage({ type: 'chunk', text }) --- | (逐 chunk 推流)
        | <-- postMessage({ type: 'done' }) ---------- | (推流完毕)
        | <-- postMessage({ type: 'error', ... }) --- | (失败时携带错误与可重试标记)
        |                                              |
        | (若用户关闭卡片 / Esc / 点击重试)              |
        | --- port.disconnect() ---------------------> | (onDisconnect 触发)
        |                                              | -> abortController.abort()
```

- **生命周期保护与 Token 节省**：Background 必须监听 `port.onDisconnect`。若连接非正常或提前断开（用户关闭卡片、切换页面等），立即调用 `AbortController.abort()` 掐断与 LLM 端点的 fetch 请求，避免无谓消耗用户 Token 与后台资源。
- **错误通道**：Port 协议除 `chunk` / `done` 外必须定义 `{ type: 'error', message, canRetry }`；卡片据此渲染错误态，`canRetry` 时自动点亮重试按钮（网络错误、429 限流均属可重试）。
- **Service Worker 保活**：流式期间 chunk 消息会持续重置 SW 空闲计时器；但非流式长请求可能超过 30s 无任何消息，存在 MV3 回收 SW 导致端口中断的风险。Background 应在等待期间每 20s 向 Port 发送 `{ type: 'ping' }` 心跳，Content Script 收到后静默忽略。
- **端点不支持流式时**：适配器捕获后单次发送全量 `{ type: ''chunk'', text: fullText }` 并立刻 `{ type: ''done'' }` 完成优雅降级。

### 2. 协议适配层
```ts
interface ProtocolAdapter {
  protocol: "openai-messages" | "openai-responses" | "anthropic";
  translate(req: TranslateRequest, signal?: AbortSignal): AsyncIterable<string>;
}
```

- 三个首发适配器各自处理认证头、请求体、SSE 解析差异及错误码映射。
- `TranslateRequest`：选中文本 +（可选）上下文 + 系统提示词 + 目标语言 + 模型名 + 模型参数。

## 九、安全边界与权限声明

- **API Key 隔离**：仅存于 `chrome.storage.local`，仅 Options 页面（配置时写入）和 Background Service Worker 读取；Content Script 及宿主页面无法访问敏感 Key。
- **所有 LLM 请求由 Service Worker 发起**：绕过页面 CSP 与 CORS 限制，杜绝宿主页面脚本侦测与拦截。
- **权限最小化原则**：
  - 静态必需权限：`["storage", "contextMenus"]`。
  - **不申请 `tabs` 权限**：仅通过事件回调携带的 `tab.id` 和 `frameId` 完成精准通信，无需读取标签页 URL 与 Title，避免安装时触发敏感的高风险权限警告。
  - 动态可选权限：`optional_host_permissions: ["*://*/*"]`。仅在用户保存特定配置档时，针对性动态请求该端点域名授权（如 `https://api.openai.com/*`）。
- **无中间服务器（BYOK）**：插件客户端直连用户配置的模型端点，零遥测、零中转。
- **防明文落盘**：不做设置明文导出功能。

## 十、明确不做（v1）

- 输入框内文字翻译（`selectionStart/End` 特判）→ v2
- PDF 翻译（需自建 PDF.js 查看器）→ 不排期
- 行内替换 / 全文翻译 → 另一产品方向
- 设置导入导出、多目标语言并排、会话 TTL 缓存 → 已否决
- `chrome://` 页面、Chrome 商店页 → 浏览器禁区

## 十一、技术栈与工程

- **框架**：WXT（manifest 自动生成、HMR、跨浏览器支持、Shadow Root UI 工具链）
- **语言**：TypeScript（类型严格约束）
- **UI**：Preact（设置页、Popup 及 Content Script 卡片）
- **构建产物**：MV3，Service Worker 后台 + Content Script（`all_frames: true`）
- **目录结构**（WXT 约定）：

```
llm_translate/
├── wxt.config.ts
├── package.json
├── src/
│   ├── entrypoints/
│   │   ├── background.ts        # Service Worker：Port 连接管理、流式中转、右键/快捷键路由
│   │   ├── content.ts           # 选区监听、WXT createShadowRootUi 挂载 Preact 卡片
│   │   ├── popup/               # 工具栏：历史记录 + 全局开关
│   │   └── options/             # 设置页：配置档管理 + 权限动态申请
│   ├── adapters/                # 协议适配器 ×3 (openai-messages, openai-responses, anthropic)
│   ├── components/              # Preact UI 组件（卡片、配置表单、历史列表等）
│   ├── types/                   # Profile / ModelConfig / TranslateRequest / MessageTypes
│   ├── utils/                   # 缓存与 Hash 计算、URL 规范化、坐标防溢出
│   └── storage/                 # chrome.storage.local 封装与历史记录 LRU
```

## 十二、待实现时敲定的小项（不阻塞开工）

- 卡片视觉设计细节（主题配色、动画过渡、高对比度模式）
- 历史记录分页展示条数（首屏 20 条，虚拟滚动或分页加载）
- 常用目标语言预置候选列表（中、英、日、韩、法、德、西等）

## 十三、Chrome Web Store 上线与合规规范

1. **图标资产（严格执行规范）**：
   - 提供真实独立的 PNG 图标文件：`icons/icon-16.png`（16×16px）、`icons/icon-48.png`（48×48px）、`icons/icon-128.png`（128×128px）。严禁缺漏或单图复用缩放。
2. **权限理由（Permissions Justification）**：
   - `storage`：用于本地持久化存储用户 LLM 配置档和离线翻译历史记录。
   - `contextMenus`：用于在网页选区右键菜单中提供便捷翻译入口。
   - `optional_host_permissions`：用于根据用户自定义配置，按需向指定 AI API 端点发送翻译请求。
3. **数据隐私合规（Privacy & Data Use）**：
   - 确立“零后端、零数据收集”原则：所有用户选中文本直接由浏览器发往用户配置的端点，不收集任何用户个人身份信息与浏览行为。
   - 在项目根目录维护 `CHROMEWEBSTORE.md` 作为 Web Store 上架元数据单一事实来源。
