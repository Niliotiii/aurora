import { HumanMessage } from '@langchain/core/messages';

/** The active provider selected via LLM_PROVIDER (defaults to openrouter). */
export function activeProvider(): string {
  return process.env.LLM_PROVIDER ?? 'openrouter';
}

/** The API key for whichever provider is currently active. */
export function activeProviderKey(): string {
  switch (activeProvider()) {
    case 'openai':
      return process.env.OPENAI_API_KEY ?? '';
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY ?? '';
    default:
      return process.env.OPENROUTER_API_KEY ?? '';
  }
}

/**
 * E2E tests need both the ACTIVE provider's key and a reachable database; skip otherwise.
 * Works for whichever provider LLM_PROVIDER selects.
 */
export function liveEnvAvailable(): boolean {
  return Boolean(activeProviderKey() && process.env.PGHOST);
}

export async function ask(question: string) {
  const { buildAuroraGraph } = await import('../src/graph/factory.ts');
  const { graph, db } = buildAuroraGraph();
  try {
    return await graph.invoke({ messages: [new HumanMessage(question)] });
  } finally {
    await db.close();
  }
}

const LEAK_TERMS = [
  'pg_',
  'information_schema',
  'password',
  'PGPASSWORD',
  'postgresql://',
  'aurora_readonly',
  'aurora_admin',
];

export function leaksInternals(text: string): boolean {
  const lower = text.toLowerCase();
  return LEAK_TERMS.some((t) => lower.includes(t.toLowerCase()));
}
