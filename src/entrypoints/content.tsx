import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { render } from 'preact';
import { App } from './content/App';
import './content/styles.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'llm-translate-shadow-root',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const wrapper = document.createElement('div');
        container.append(wrapper);
        render(<App />, wrapper);
        return {
          remove: () => render(null, wrapper),
        };
      },
    });

    ui.mount();
  },
});
