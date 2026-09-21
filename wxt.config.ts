import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    plugins: [preact() as any],
  }),
  manifest: {
    name: 'LLM 划词翻译',
    description: '基于大语言模型的网页划词翻译 Chrome 扩展，支持流式输出与多配置档',
    version: '0.1.0',
    permissions: ['storage', 'contextMenus'],
    optional_host_permissions: ['*://*/*'],
    commands: {
      'translate-selection': {
        suggested_key: {
          default: 'Alt+T',
        },
        description: '翻译当前选中文本',
      },
    },
    action: {
      default_title: 'LLM 划词翻译',
    },
    options_ui: {
      open_in_tab: true,
    },
    icons: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
