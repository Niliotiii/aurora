# Quickstart: Conversation Sessions

**Feature**: 004-conversation-sessions
**Date**: 2026-06-14

Cenários de integração para validar a feature end-to-end.

---

## Cenário 1 — Fluxo básico de criação e uso

```bash
# 1. Criar nova conversa
curl -X POST http://localhost:4000/conversations
# → { "id": "abc-123", "title": "Conversa 1", "createdAt": "..." }

# 2. Enviar primeira mensagem nessa conversa
curl -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question": "Qual a taxa do Brasil em 2000?", "conversationId": "abc-123"}'
# → { "answer": "...", "attribution": "...", ... }

# 3. Verificar que a mensagem foi persistida
curl http://localhost:4000/conversations/abc-123/messages
# → [{ "role": "user", ... }, { "role": "assistant", ... }]
```

---

## Cenário 2 — Memória isolada entre conversas

```bash
# Criar duas conversas
curl -X POST http://localhost:4000/conversations
# → { "id": "conv-1", "title": "Conversa 1" }

curl -X POST http://localhost:4000/conversations
# → { "id": "conv-2", "title": "Conversa 2" }

# Perguntar sobre Brasil em conv-1
curl -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question": "Fale sobre o Brasil", "conversationId": "conv-1"}'

# Perguntar sobre Angola em conv-2
curl -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question": "Fale sobre Angola", "conversationId": "conv-2"}'

# Verificar que conv-1 tem apenas mensagens do Brasil
curl http://localhost:4000/conversations/conv-1/messages
# → mensagens com "Brasil", SEM referência a Angola

# Verificar que conv-2 tem apenas mensagens de Angola
curl http://localhost:4000/conversations/conv-2/messages
# → mensagens com "Angola", SEM referência ao Brasil
```

---

## Cenário 3 — Continuidade de contexto (memória da conversa)

```bash
# Criar conversa
curl -X POST http://localhost:4000/conversations
# → { "id": "conv-mem", "title": "Conversa 1" }

# Primeira pergunta — estabelece contexto
curl -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question": "Qual a taxa de mortalidade neonatal do Brasil em 2000?", "conversationId": "conv-mem"}'
# → resposta com taxa do Brasil

# Segunda pergunta — referencia contexto anterior (pronome "lá")
curl -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question": "E em 2010?", "conversationId": "conv-mem"}'
# → resposta sobre Brasil em 2010 (manteve contexto do país)
```

---

## Cenário 4 — Exclusão de conversa

```bash
# Listar conversas
curl http://localhost:4000/conversations
# → [{ "id": "abc-123", ... }, { "id": "def-456", ... }]

# Apagar primeira conversa
curl -X DELETE http://localhost:4000/conversations/abc-123
# → 204 No Content

# Verificar que foi removida
curl http://localhost:4000/conversations
# → [{ "id": "def-456", ... }]  (apenas a segunda)

# Verificar que mensagens foram removidas (cascade)
curl http://localhost:4000/conversations/abc-123/messages
# → 404 Not Found
```

---

## Validação Frontend

1. Abrir `http://localhost:5173` no navegador
2. Sidebar deve exibir lista de conversas (ou estado vazio)
3. Clicar em "Nova Conversa" → nova entrada aparece na sidebar e fica selecionada
4. Enviar mensagem → aparece na área de chat
5. Clicar em outra conversa → histórico muda para o da conversa selecionada
6. Recarregar a página → conversa ativa é restaurada automaticamente
7. Clicar em "Apagar" em uma conversa → modal de confirmação aparece
8. Confirmar exclusão → conversa desaparece da sidebar
