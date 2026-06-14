import Fastify from 'fastify';
import cors from '@fastify/cors';
import { HumanMessage } from '@langchain/core/messages';
import { buildAuroraGraph } from './graph/factory.ts';
import { config } from './config.ts';
import { sanitizeError } from './guards/errorSanitizer.ts';

export function createServer() {
  const app = Fastify({ logger: false });
  const { graph, db } = buildAuroraGraph();

  app.register(cors, {
    origin: config.server.corsOrigin === '*' ? true : config.server.corsOrigin.split(','),
  });

  app.addHook('onClose', async () => {
    await db.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post(
    '/chat',
    {
      schema: {
        body: {
          type: 'object',
          required: ['question'],
          properties: {
            question: { type: 'string', minLength: 3 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { question } = request.body as { question: string };
        console.log('\n' + '═'.repeat(60));
        console.log(`📊 Aurora: "${question}"`);

        const state = await graph.invoke({ messages: [new HumanMessage(question)] });

        return {
          answer: state.answer ?? 'Nenhuma resposta foi gerada.',
          attribution: state.attribution ?? null,
          vegaSpec: state.vegaSpec ?? null,
          followUpQuestions: state.followUpQuestions ?? [],
          // Only expose the executed SELECT (redacted to null on blocked/refused turns).
          query: state.query ?? null,
        };
      } catch (error) {
        // Never leak internals (FR-011).
        return reply.status(500).send({ error: sanitizeError(error) });
      }
    },
  );

  return app;
}
