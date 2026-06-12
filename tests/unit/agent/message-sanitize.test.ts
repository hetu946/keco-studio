import { sanitizeMessagesForLlm } from '../../../src/lib/agent/conversation-store';
import type { ChatMessage } from '../../../src/lib/agent/types';

describe('sanitizeMessagesForLlm', () => {
  it('injects placeholder tool messages when tool_calls lack responses', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_1', function: { name: 'query_assets', arguments: '{}' } }],
      },
      { role: 'user', content: 'next' },
    ];

    const fixed = sanitizeMessagesForLlm(messages);
    expect(fixed).toHaveLength(4);
    expect(fixed[2].role).toBe('tool');
    expect(fixed[2].tool_call_id).toBe('call_1');
    expect(fixed[3].content).toBe('next');
  });

  it('preserves valid assistant + tool sequences', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_1', function: { name: 'query_assets', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"success":true}' },
      { role: 'assistant', content: 'done' },
    ];

    const fixed = sanitizeMessagesForLlm(messages);
    expect(fixed).toEqual(messages);
  });
});
