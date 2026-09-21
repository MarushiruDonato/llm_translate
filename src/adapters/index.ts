import { ProtocolType } from '../types';
import { AnthropicAdapter } from './anthropic';
import { OpenAIMessagesAdapter } from './openai-messages';
import { OpenAIResponsesAdapter } from './openai-responses';
import { ProtocolAdapter } from './types';

export * from './types';
export * from './sse-parser';

export function getAdapter(protocol: ProtocolType): ProtocolAdapter {
  switch (protocol) {
    case 'openai-messages':
      return new OpenAIMessagesAdapter();
    case 'openai-responses':
      return new OpenAIResponsesAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    default:
      throw new Error(`未知的协议类型: ${protocol}`);
  }
}
