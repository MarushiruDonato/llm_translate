import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    plugins: [preact() as any],
  }),
  manifest: {
    default_locale: 'zh_CN',
    name: '__MSG_extName__',
    description: '__MSG_extDesc__',
    version: '0.1.0',
    permissions: ['storage', 'contextMenus'],
    optional_host_permissions: ['*://*/*'],
    commands: {
      'translate-selection': {
        suggested_key: {
          default: 'Alt+T',
        },
        description: '__MSG_contextMenuTranslate__',
      },
    },
    action: {
      default_title: '__MSG_extName__',
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
