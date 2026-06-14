import { useCallback, useEffect, useState } from 'react';
import {
  type Conversation,
  deleteConversation as apiDeleteConversation,
  askQuestion,
  createConversation,
  getConversationMessages,
  listConversations,
} from '../api.ts';

const SESSION_KEY = 'aurora_active_conv';

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attribution?: string | null;
  vegaSpec?: object | null;
  followUps?: string[];
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (conversationId: string) => {
    try {
      const messages = await getConversationMessages(conversationId);
      const loadedTurns: Turn[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
      }));
      setTurns(loadedTurns);
    } catch {
      setTurns([]);
    }
  }, []);

  // On mount: load conversations, restore active from sessionStorage.
  useEffect(() => {
    (async () => {
      try {
        const list = await listConversations();
        setConversations(list);

        const savedId = sessionStorage.getItem(SESSION_KEY);
        const exists = savedId && list.some((c) => c.id === savedId);

        if (exists && savedId) {
          await loadHistory(savedId);
          setActiveConversationId(savedId);
        } else if (list.length > 0) {
          await loadHistory(list[0].id);
          setActiveConversationId(list[0].id);
          sessionStorage.setItem(SESSION_KEY, list[0].id);
        } else {
          // Auto-create first conversation if list is empty.
          const newConv = await createConversation();
          setConversations([newConv]);
          setActiveConversationId(newConv.id);
          sessionStorage.setItem(SESSION_KEY, newConv.id);
        }
      } catch {
        // Non-blocking — UI degrades gracefully.
      }
    })();
  }, [loadHistory]);

  const handleCreateConversation = useCallback(async () => {
    try {
      const newConv = await createConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setTurns([]);
      sessionStorage.setItem(SESSION_KEY, newConv.id);
    } catch {
      // Silently fail — user can retry.
    }
  }, []);

  const switchConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      sessionStorage.setItem(SESSION_KEY, id);
      await loadHistory(id);
    },
    [loadHistory],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await apiDeleteConversation(id);
        setConversations((prev) => {
          const remaining = prev.filter((c) => c.id !== id);

          if (id === activeConversationId) {
            if (remaining.length > 0) {
              // Switch to the first remaining conversation.
              switchConversation(remaining[0].id);
            } else {
              // No conversations left — show empty state.
              setActiveConversationId(null);
              setTurns([]);
              sessionStorage.removeItem(SESSION_KEY);
            }
          }

          return remaining;
        });
      } catch {
        // Silently fail.
      }
    },
    [activeConversationId, switchConversation],
  );

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (q.length < 3 || loading || !activeConversationId) return;

      setTurns((t) => [...t, { id: crypto.randomUUID(), role: 'user', text: q }]);
      setLoading(true);
      try {
        const res = await askQuestion(q, activeConversationId);
        setTurns((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: res.answer,
            attribution: res.attribution,
            vegaSpec: res.vegaSpec,
            followUps: res.followUpQuestions,
          },
        ]);
      } catch {
        setTurns((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Desculpe, algo deu errado. Por favor, tente novamente.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, activeConversationId],
  );

  return {
    conversations,
    activeConversationId,
    turns,
    loading,
    createConversation: handleCreateConversation,
    switchConversation,
    deleteConversation: handleDeleteConversation,
    send,
  };
}
