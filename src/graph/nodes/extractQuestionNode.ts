import type { GraphState } from '../graph.ts';

export function createExtractQuestionNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      if (!state.messages?.length) {
        return { error: 'Nenhuma pergunta foi fornecida.' };
      }

      const last = state.messages.at(-1) as { text?: string; content?: unknown } | undefined;
      const question = (
        last?.text ?? (typeof last?.content === 'string' ? last.content : '')
      ).trim();

      if (!question) {
        return { error: 'Nenhuma pergunta válida foi encontrada.' };
      }

      console.log(`📝 Question: "${question}"`);
      return { question };
    } catch (error) {
      console.error('Error extracting question:', error instanceof Error ? error.message : error);
      return { error: 'Não foi possível ler a pergunta.' };
    }
  };
}
