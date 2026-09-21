import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  main() {
    console.log('LLM Translate content script initialized');
  },
});
