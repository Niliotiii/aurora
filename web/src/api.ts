const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000';

export interface ChatResponse {
  answer: string;
  attribution: string | null;
  vegaSpec: object | null;
  followUpQuestions: string[];
  query: string | null;
}

export async function askQuestion(question: string): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error('Request failed');
  }
  return (await res.json()) as ChatResponse;
}
