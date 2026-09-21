# LLM 划词翻译 (LLM Selection Translate)

一款纯粹简洁的大模型划词翻译浏览器扩展，采用 **BYOK (Bring Your Own Key)** 模式，纯客户端直连各大模型服务商，无中间服务器，注重速度与隐私安全。

## 特性

- **纯粹简洁**：专注于纯粹简洁的大模型划词翻译体验，轻量克制，无冗余功能。
- **BYOK 模式**：自带 API Key，兼容 OpenAI 协议（DeepSeek / OpenAI / SiliconFlow 等）、Anthropic (Claude) 以及本地模型（Ollama 等）。
- **客户端直连**：浏览器直接向目标端点发起请求，零第三方服务器中转。
- **流式输出**：支持 SSE 流式推流，逐字实时返回翻译内容。
- **便捷交互**：支持划词浮动图标、全局快捷键与右键菜单，悬浮卡片支持拖拽与自由缩放。
- **隐私安全**：API Key 及历史记录均仅保存在本地浏览器中，绝不上报或收集任何用户数据。
- **双语界面**：完整支持中英文界面与手动/自动切换。

## 安装与使用

1. 克隆项目并构建产物：
   ```bash
   git clone https://github.com/your-username/llm_translate.git
   cd llm_translate
   pnpm install
   pnpm build
   ```
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
3. 开启右上角「开发者模式」，点击「加载已解压的扩展程序」。
4. 选择本项目生成的 `.output/chrome-mv3` 目录。
5. 打开扩展设置页，填入你的 API Key 与端点配置即可使用。

## 常用命令

- `pnpm dev`：启动开发调试模式
- `pnpm build`：构建生产版本（产物位于 `.output/chrome-mv3`）
- `pnpm zip`：打包为可发布的 zip 压缩包
- `pnpm test`：运行自动化测试

## 开源协议

[MIT](LICENSE)
