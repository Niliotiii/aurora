# Implementation Plan: Conversation Sessions

**Branch**: `004-conversation-sessions` | **Date**: 2026-06-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-conversation-sessions/spec.md`

## Summary

Adicionar suporte a múltiplas conversas independentes ao Aurora. Cada conversa tem histórico próprio persistido no PostgreSQL. O backend expõe novos endpoints REST para criar/listar/apagar conversas e carrega o histórico de mensagens antes de invocar o LangGraph. O frontend ganha uma sidebar Mantine listando as conversas e permite alternância instantânea entre elas.

## Technical Context

**Language/Version**: Node.js 24.11.1 + TypeScript (mandated by Constitution)
**Primary Dependencies**: Fastify (HTTP), LangChain/LangGraph (graph), Mantine + React (web UI), `pg` (PostgreSQL client — já instalado via `postgresService.ts`)
**Storage**: PostgreSQL — duas novas tabelas: `conversation` e `conversation_message`
**Testing**: Node.js `--experimental-strip-types --test` (padrão do projeto)
**Target Platform**: Linux container (Docker) + desenvolvimento local
**Project Type**: Web service (Fastify API) + Web application (React/Vite)
**Performance Goals**: Alternância de conversa em < 1 segundo (SC-002)
**Constraints**: Princípio IV — escrita nas tabelas de conversa via role `aurora_app`; analytics continua via `aurora_readonly`
**Scale/Scope**: Usuário único, conversas ilimitadas por sessão

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I — Single Source of Truth | ✅ PASS | Conversas não afetam a origem do dado analítico WHO |
| II — Zero Medical Hallucination | ✅ PASS | Histórico de conversa passa pelo mesmo pipeline, sem adicionar dados externos |
| III — Mandatory Data Transparency | ✅ PASS | Atribuição WHO persiste por mensagem no `content` do assistente |
| IV — Read-Only Database Access | ✅ PASS* | `aurora_readonly` inalterado; nova role `aurora_app` escreve APENAS em `conversation`/`conversation_message` |
| V — Schema Protection | ✅ PASS | Endpoints não expõem schema; mensagens salvas não incluem system prompts |

*A escrita nas tabelas de conversa não viola o Princípio IV porque esse princípio refere-se especificamente ao acesso ao dado analítico WHO. State da aplicação (conversas) é um concern separado, gerido por uma role distinta com grants mínimos.

## Project Structure

### Documentation (this feature)

```text
specs/004-conversation-sessions/
├── plan.md              # Este arquivo
├── research.md          # R1–R7: decisões técnicas
├── data-model.md        # Entidades conversation + conversation_message
├── quickstart.md        # 4 cenários de integração
├── contracts/
│   └── conversation-api.md  # API REST completa
└── tasks.md             # Gerado por /speckit-tasks
```

### Source Code (repository root)

```text
# Backend — novos arquivos
src/
├── services/
│   └── conversationService.ts   # CRUD de conversas + mensagens (usa aurora_app pool)
├── routes/
│   └── conversations.ts         # Fastify routes: POST/GET /conversations, DELETE /conversations/:id, GET /conversations/:id/messages
└── config.ts                    # + bloco postgresApp { host, port, database, user, password }

# Backend — arquivos modificados
src/
├── server.ts                    # Registra conversationRoutes; modifica POST /chat para aceitar conversationId
└── graph/
    └── factory.ts               # Sem mudança no grafo em si

# Database
data/
├── schema.sql                   # + CREATE TABLE conversation, conversation_message, role aurora_app
└── seed.ts                      # Executa as novas DDLs (idempotente)

# Web — novos arquivos
web/src/
├── components/
│   ├── ConversationSidebar.tsx  # Sidebar: lista conversas, botão nova conversa, botão apagar
│   └── ConfirmDeleteModal.tsx   # Modal de confirmação de exclusão
└── hooks/
    └── useConversations.ts      # Estado das conversas: lista, ativa, CRUD

# Web — arquivos modificados
web/src/
├── App.tsx                      # AppShell com navbar; passa conversationId ao askQuestion
└── api.ts                       # + funções: listConversations, createConversation, deleteConversation, getMessages; modifica askQuestion para aceitar conversationId

# Testes
tests/
└── conversations/
    ├── conversation-api.test.ts  # Testes determinísticos: CRUD com DB stub
    └── conversation-e2e.test.ts  # Testes live: skip sem PGHOST
```

## Architecture Decisions

### Fluxo de dados: POST /chat com histórico

```
Frontend                  Backend                      LangGraph
──────────────────────    ──────────────────────────   ──────────────────────
[user digita mensagem]
[POST /chat { question, conversationId }]
                          1. Valida conversationId (404 se não existe)
                          2. Carrega messages[] do banco (aurora_app pool)
                          3. Monta BaseMessage[] (HumanMessage + AIMessage alternados)
                          4. Adiciona nova HumanMessage ao fim
                          5. graph.invoke({ messages })
                                                        [executa pipeline completo]
                          6. Persiste user message no banco
                          7. Persiste assistant message no banco
                          8. Retorna { answer, attribution, vegaSpec, ... }
[exibe resposta na UI]
```

### Connection pools

O `PostgresService` atual usa `aurora_readonly`. Para conversas, criamos `ConversationService` com um pool separado usando `config.postgresApp` (role `aurora_app`). Os dois pools coexistem sem interferência.

### Frontend: gerenciamento de estado

`useConversations` hook centraliza:
- `conversations: Conversation[]` — lista completa
- `activeConversationId: string | null` — conversa ativa (salvo em `sessionStorage`)
- `turns: Turn[]` — mensagens exibidas na conversa ativa
- `createConversation()`, `deleteConversation(id)`, `switchConversation(id)`

## Complexity Tracking

> Nenhuma violação de Princípio detectada. Seção preenchida apenas por completude.

| Concern | Decision | Justification |
|---|---|---|
| Write access para conversas | Role `aurora_app` separada | Dados de aplicação ≠ dados analíticos; mínimo de privilégio preservado |
