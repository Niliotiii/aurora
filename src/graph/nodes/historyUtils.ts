import type { BaseMessage } from '@langchain/core/messages';

/** Formats messages[0..-2] (everything before the current turn) as a readable dialogue string.
 * Returns undefined when there is no prior history. */
export function formatMessageHistory(messages: BaseMessage[]): string | undefined {
  const history = messages.slice(0, -1);
  if (history.length === 0) return undefined;
  return history
    .map((m) => {
      const role = m.getType() === 'human' ? 'User' : 'Assistant';
      const content = typeof m.content === 'string' ? m.content : '';
      return `${role}: ${content}`;
    })
    .filter((line) => line.trim())
    .join('\n');
}
