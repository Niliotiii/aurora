# Contract: Conversation Management API

**Feature**: 004-conversation-sessions
**Date**: 2026-06-14
**Base URL**: `http://localhost:4000`

---

## POST /conversations

Cria uma nova conversa com nome sequencial automático.

**Request**: sem body

**Response** `201 Created`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Conversa 3",
  "createdAt": "2026-06-14T21:00:00.000Z"
}
```

**Errors**:
- `500` — falha interna (nunca expõe detalhes)

---

## GET /conversations

Lista todas as conversas, da mais recente para a mais antiga.

**Response** `200 OK`:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Conversa 3",
    "createdAt": "2026-06-14T21:00:00.000Z"
  },
  {
    "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    "title": "Conversa 2",
    "createdAt": "2026-06-14T20:00:00.000Z"
  }
]
```

---

## DELETE /conversations/:id

Remove permanentemente a conversa e todas as suas mensagens.

**Response** `204 No Content`

**Errors**:
- `404` — conversa não encontrada
- `500` — falha interna

---

## GET /conversations/:id/messages

Retorna todas as mensagens de uma conversa em ordem cronológica.

**Response** `200 OK`:
```json
[
  {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "content": "Qual a taxa de mortalidade neonatal do Brasil em 2000?",
    "createdAt": "2026-06-14T21:01:00.000Z"
  },
  {
    "id": "a1b2c3d4-0000-0000-0000-000000000002",
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "assistant",
    "content": "Em 2000, a taxa de mortalidade neonatal do Brasil foi de 15,4 por 1.000 nascidos vivos (estimativas WHO/GHO).",
    "createdAt": "2026-06-14T21:01:05.000Z"
  }
]
```

**Errors**:
- `404` — conversa não encontrada

---

## POST /chat (modificado)

Envia uma mensagem dentro de uma conversa existente. O backend carrega o histórico, invoca o grafo, e persiste a nova troca.

**Request**:
```json
{
  "question": "Qual a taxa de mortalidade neonatal do Brasil em 2000?",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Campos**:
- `question` (string, obrigatório, mínimo 3 chars): a pergunta do usuário
- `conversationId` (string UUID, obrigatório): a conversa à qual a mensagem pertence

**Response** `200 OK` (inalterado):
```json
{
  "answer": "Em 2000, a taxa de mortalidade neonatal do Brasil foi de 15,4 por 1.000 nascidos vivos.",
  "attribution": "Estimativas WHO/GHO — Global Health Observatory",
  "vegaSpec": null,
  "followUpQuestions": ["Como foi a evolução nos anos seguintes?"],
  "query": "SELECT ..."
}
```

**Behavior**:
1. Carrega mensagens anteriores de `conversation_id` ordenadas por `created_at ASC`
2. Constrói `messages: BaseMessage[]` com o histórico
3. Adiciona a nova `HumanMessage` ao fim
4. Invoca `graph.invoke({ messages })`
5. Persiste a mensagem do usuário e a resposta do assistente no banco
6. Retorna a resposta

**Errors**:
- `400` — `question` ausente/muito curta ou `conversationId` ausente/inválido
- `404` — `conversationId` não encontrado
- `500` — falha interna (sanitizada)
