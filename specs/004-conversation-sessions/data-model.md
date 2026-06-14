# Data Model: Conversation Sessions

**Feature**: 004-conversation-sessions
**Date**: 2026-06-14

---

## Entities

### Conversation

Representa uma sessão de diálogo independente entre o usuário e a Aurora.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `title` | TEXT | NOT NULL | Nome da conversa (ex: "Conversa 1") |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Data/hora de criação |

**Ordering**: Exibida da mais recente para a mais antiga (`ORDER BY created_at DESC`).

---

### ConversationMessage

Representa uma mensagem individual dentro de uma conversa.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `conversation_id` | UUID | FK → conversation(id) ON DELETE CASCADE | Conversa à qual pertence |
| `role` | TEXT | NOT NULL, CHECK IN ('user', 'assistant') | Autor da mensagem |
| `content` | TEXT | NOT NULL | Conteúdo da mensagem |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Timestamp de criação |

**Ordering**: Dentro de uma conversa, ordenada por `created_at ASC` (cronológica).

**Cascade**: `ON DELETE CASCADE` garante que apagar uma `conversation` remove todas as suas mensagens automaticamente.

---

## Relationships

```
conversation (1) ──────── (N) conversation_message
    id ◄──────────────── conversation_id
```

---

## SQL DDL

```sql
-- Tabelas de estado da aplicação (schema padrão `public`)
-- Gerenciadas pela role aurora_app (INSERT/UPDATE/DELETE/SELECT)

CREATE TABLE IF NOT EXISTS conversation (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_message (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_msg_conv_id
  ON conversation_message (conversation_id, created_at ASC);
```

---

## Role: aurora_app

Role de escrita restrita às tabelas de conversas.

```sql
CREATE ROLE aurora_app LOGIN PASSWORD '<password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation, conversation_message TO aurora_app;
GRANT USAGE ON SCHEMA public TO aurora_app;
```

**Nota**: `aurora_readonly` continua sem acesso às tabelas de conversa (isolamento de concerns).

---

## Frontend State (TypeScript)

```typescript
// Tipos espelhados no frontend a partir do contrato da API
interface Conversation {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
```
