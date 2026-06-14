const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000';

export interface ChatResponse {
  answer: string;
  attribution: string | null;
  vegaSpec: object | null;
  followUpQuestions: string[];
  query: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export async function askQuestion(question: string, conversationId: string): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversationId }),
  });
  if (!res.ok) {
    throw new Error('Request failed');
  }
  return (await res.json()) as ChatResponse;
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_URL}/conversations`);
  if (!res.ok) throw new Error('Failed to list conversations');
  return (await res.json()) as Conversation[];
}

export async function createConversation(): Promise<Conversation> {
  const res = await fetch(`${API_URL}/conversations`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create conversation');
  return (await res.json()) as Conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/conversations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function getConversationMessages(id: string): Promise<ConversationMessage[]> {
  const res = await fetch(`${API_URL}/conversations/${id}/messages`);
  if (!res.ok) throw new Error('Failed to load messages');
  return (await res.json()) as ConversationMessage[];
}
