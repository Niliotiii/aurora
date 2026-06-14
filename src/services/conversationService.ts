import pg from 'pg';
import { config } from '../config.ts';

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

export class ConversationService {
  private pool: pg.Pool;

  constructor() {
    this.pool = new pg.Pool(config.postgresApp);
  }

  async createConversation(): Promise<Conversation> {
    const countRes = await this.pool.query<{ count: string }>('SELECT COUNT(*) FROM conversation');
    const n = Number(countRes.rows[0].count) + 1;
    const title = `Conversa ${n}`;
    const res = await this.pool.query<{ id: string; title: string; created_at: Date }>(
      'INSERT INTO conversation (title) VALUES ($1) RETURNING id, title, created_at',
      [title],
    );
    return this.mapConversation(res.rows[0]);
  }

  async listConversations(): Promise<Conversation[]> {
    const res = await this.pool.query<{ id: string; title: string; created_at: Date }>(
      'SELECT id, title, created_at FROM conversation ORDER BY created_at DESC',
    );
    return res.rows.map(this.mapConversation);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const res = await this.pool.query<{ id: string; title: string; created_at: Date }>(
      'SELECT id, title, created_at FROM conversation WHERE id = $1',
      [id],
    );
    return res.rows.length > 0 ? this.mapConversation(res.rows[0]) : null;
  }

  async deleteConversation(id: string): Promise<void> {
    await this.pool.query('DELETE FROM conversation WHERE id = $1', [id]);
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const res = await this.pool.query<{
      id: string;
      conversation_id: string;
      role: 'user' | 'assistant';
      content: string;
      created_at: Date;
    }>(
      'SELECT id, conversation_id, role, content, created_at FROM conversation_message WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    await this.pool.query(
      'INSERT INTO conversation_message (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversationId, role, content],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private mapConversation(row: { id: string; title: string; created_at: Date }): Conversation {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
    };
  }
}
