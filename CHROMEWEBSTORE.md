# Chrome Web Store Listing — LLM 划词翻译

> Last Updated: 2026-09-21

## Store Listing

**Extension Name** [REQUIRED]
LLM 划词翻译 — 智能大模型即时网页翻译

**Short Description** [REQUIRED]
划选任意网页文字，利用 DeepSeek、OpenAI 等大模型进行精准流畅的即时流式翻译，零后端服务器，自带 Key 安全私密。

**Detailed Description** [REQUIRED]
LLM 划词翻译是一款基于先进大语言模型的网页即时划词翻译扩展，专为追求高质量、地道译文与隐私安全的用户设计。

无需忍受生硬机械的传统机器翻译。通过接入 DeepSeek、OpenAI、Anthropic 等前沿大模型，您可以获得结合上下文语境、优雅地道的自然语言翻译。

主要功能特性：
1. 灵活便捷的触发体验：划选文字即可在鼠标旁弹出轻量翻译按钮，亦可使用右键菜单或快捷键（默认 Alt+T）一键翻译。
2. 逐字流式呈现：支持打字机般的流式推流效果，无需漫长等待即可瞬间开始阅读译文。
3. 自由自带 Key (BYOK)：用户使用自己的 API Key 直连官方端点，扩展没有中转服务器，不收取订阅费用。
4. 本地即时缓存：历史记录自动兼任本地秒显缓存，重复出现的生词短句瞬间显示，极大节省 API 消耗。
5. 悬浮自由卡片：精致的就地悬浮卡片设计，支持自由拖动、钉住固定、一键复制译文、快速重试及多模型切换。
6. 深浅色自适应：卡片 UI 自动跟随您的系统或浏览器深浅色外观，阅读体验舒适不刺眼。

使用方法：
1. 安装扩展后，点击扩展图标或前往设置页面，填入您的模型 API 端点与 Key 并点击保存（浏览器将提示授权访问对应端点）。
2. 在任意普通网页上划选想要翻译的一段外语文字。
3. 点击选区右上角的小翻译图标，或按下 Alt+T 快捷键，即可在悬浮卡片中即时查看流式译文。
4. 点击卡片底部的「复制」按钮即可轻松将译文复制到剪贴板。

隐私与安全承诺：
本扩展为 100% 客户端架构。您的 API 密钥与翻译文本仅存在于您的本地浏览器中，翻译请求由浏览器直接发送到您指定的 AI 官方端点，没有任何第三方中间服务器，绝不收集、追踪或转售您的任何个人数据与浏览历史。

技术支持与反馈：
如有任何问题或改进建议，欢迎访问项目主页或通过 GitHub 提交反馈。

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
划选网页文本并在就地悬浮卡片中即时翻译为目标语言。

**Primary Language** [REQUIRED]
Chinese (Simplified)

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280×800 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes
- 截图 1：展示在英文文章页面划选文字后，就地弹出的流式翻译卡片，展示源语言标签与地道中文译文。
- 截图 2：展示扩展工具栏 Popup 历史记录面板与即时关键词搜索。
- 截图 3：展示 Options 设置页面中的配置档管理与多模型选择。

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | 用于在本地持久化保存用户的自定义模型配置档、快捷键与触发偏好，以及离线翻译历史记录。 |
| contextMenus | permissions | 用于在网页划选文本的右键菜单中提供便捷的「翻译所选内容」操作入口。 |
| *://*/* | optional_host_permissions | 用于根据用户在设置中自定义配置的 AI API 服务端点（如 api.deepseek.com），在用户保存并明确授权后向该端点发起翻译请求。按需动态申请，默认不获取全局访问。 |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

本扩展不收集、不存储、不传输任何个人身份信息、健康信息、财务信息、位置信息、浏览记录或网站内容至除用户配置的 AI API 端点之外的任何地方。所有翻译请求由浏览器端直接向用户自定义的模型端点发起。

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
https://github.com/my-org/llm-translate/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
LLM Translate Team

**Contact Email** [REQUIRED]
support@example.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-09-21 | 首个正式版本发布：支持划词悬浮卡片、流式推流、多配置档、历史与缓存、快捷键触发 | Draft |
