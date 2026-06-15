import cors from '@fastify/cors';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import Fastify from 'fastify';
import { config } from './config.ts';
import { buildAuroraGraph } from './graph/factory.ts';
import { sanitizeError } from './guards/errorSanitizer.ts';
import { conversationRoutes } from './routes/conversations.ts';
import { ConversationService } from './services/conversationService.ts';

export function createServer() {
  const app = Fastify({ logger: false });
  const { graph, db } = buildAuroraGraph();
  const conversationService = new ConversationService();

  app.register(cors, {
    origin: config.server.corsOrigin === '*' ? true : config.server.corsOrigin.split(','),
  });

  app.register(conversationRoutes, { conversationService });

  app.addHook('onClose', async () => {
    await db.close();
    await conversationService.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post(
    '/chat',
    {
      schema: {
        body: {
          type: 'object',
          required: ['question', 'conversationId'],
          properties: {
            question: { type: 'string', minLength: 3 },
            conversationId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { question, conversationId } = request.body as {
          question: string;
          conversationId: string;
        };

        const conversation = await conversationService.getConversation(conversationId);
        if (!conversation) {
          return reply.status(404).send({ error: 'Conversa não encontrada' });
        }

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`📊 Aurora: "${question}"`);

        // Load conversation history and build message list.
        const history = await conversationService.getMessages(conversationId);
        const historyMessages = history.map((m) =>
          m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
        );
        const messages = [...historyMessages, new HumanMessage(question)];

        const state = await graph.invoke({ messages });

        // Persist the new exchange.
        await conversationService.saveMessage(conversationId, 'user', question);
        await conversationService.saveMessage(
          conversationId,
          'assistant',
          state.answer ?? 'Nenhuma resposta foi gerada.',
          state.vegaSpec ?? null,
        );

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
