import type { FastifyPluginAsync } from 'fastify';
import { sanitizeError } from '../guards/errorSanitizer.ts';
import type { ConversationService } from '../services/conversationService.ts';

interface ConversationRouteOptions {
  conversationService: ConversationService;
}

export const conversationRoutes: FastifyPluginAsync<ConversationRouteOptions> = async (
  app,
  opts,
) => {
  const svc = opts.conversationService;

  app.post('/conversations', async (_req, reply) => {
    try {
      const conversation = await svc.createConversation();
      return reply.status(201).send(conversation);
    } catch (error) {
      return reply.status(500).send({ error: sanitizeError(error) });
    }
  });

  app.get('/conversations', async (_req, reply) => {
    try {
      const conversations = await svc.listConversations();
      return reply.status(200).send(conversations);
    } catch (error) {
      return reply.status(500).send({ error: sanitizeError(error) });
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/conversations/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req, reply) => {
      try {
        const existing = await svc.getConversation(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Conversa não encontrada' });
        await svc.deleteConversation(req.params.id);
        return reply.status(204).send();
      } catch (error) {
        return reply.status(500).send({ error: sanitizeError(error) });
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req, reply) => {
      try {
        const existing = await svc.getConversation(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Conversa não encontrada' });
        const messages = await svc.getMessages(req.params.id);
        return reply.status(200).send(messages);
      } catch (error) {
        return reply.status(500).send({ error: sanitizeError(error) });
      }
    },
  );
};
