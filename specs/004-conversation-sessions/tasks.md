# Tasks: Conversation Sessions

**Input**: Design documents from `specs/004-conversation-sessions/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: User Story de origem (US1, US2, US3)
- Todos os caminhos são relativos à raiz do repositório

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuração de ambiente e nova role de banco para conversas

- [X] T001 Add `postgresApp` config block to `src/config.ts` after `postgresReadOnly`: fields `host` (PGHOST), `port` (PGPORT), `database` (PGDATABASE), `user` (PGAPP_USER, default `'aurora_app'`), `password` (PGAPP_PASSWORD, default `'apppass'`)
- [X] T002 [P] Add env vars to `.env.example` under new `# --- Conversation DB (aurora_app role) ---` section: `PGAPP_USER=aurora_app` and `PGAPP_PASSWORD=apppass`
- [X] T003 [P] Add `PGAPP_USER: ${PGAPP_USER:-aurora_app}` and `PGAPP_PASSWORD: ${PGAPP_PASSWORD:-apppass}` to the `app` service environment in `docker-compose.yaml`

**Checkpoint**: Configuração de ambiente pronta — prosseguir para Foundational

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Banco, serviço e roteamento — base para todas as User Stories

**⚠️ CRITICAL**: Todas as tarefas desta fase devem ser concluídas antes das User Stories

- [X] T004 Add conversation DDL to `data/schema.sql` after the analytics tables: `CREATE TABLE IF NOT EXISTS conversation (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`, `CREATE TABLE IF NOT EXISTS conversation_message (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('user', 'assistant')), content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`, `CREATE INDEX IF NOT EXISTS idx_conv_msg_conv_id ON conversation_message (conversation_id, created_at ASC)`
- [X] T005 Update `data/seed.ts` to create the `aurora_app` role and grant after existing grants: use a `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aurora_app') THEN CREATE ROLE aurora_app LOGIN PASSWORD '${appPassword}'; END IF; END $$` block (note: `CREATE ROLE ... IF NOT EXISTS` is NOT valid PostgreSQL syntax); then `GRANT SELECT, INSERT, UPDATE, DELETE ON conversation, conversation_message TO aurora_app` and `GRANT USAGE ON SCHEMA public TO aurora_app`; also ensure the DDL in T004 runs via the admin connection before the grants
- [X] T006 [P] Create `src/services/conversationService.ts`: class `ConversationService` that opens a write-capable `pg.Pool` using `config.postgresApp`; implement methods: `createConversation(): Promise<{id,title,createdAt}>` (counts existing, inserts "Conversa N"), `listConversations(): Promise<Conversation[]>` (ORDER BY created_at DESC), `getConversation(id): Promise<Conversation|null>`, `deleteConversation(id): Promise<void>`, `getMessages(conversationId): Promise<ConversationMessage[]>` (ORDER BY created_at ASC), `saveMessage(conversationId, role, content): Promise<void>`, `close(): Promise<void>`; export TypeScript interfaces `Conversation` and `ConversationMessage` matching `data-model.md`
- [X] T007 Create `src/routes/conversations.ts`: Fastify plugin (using `FastifyPluginAsync`) that receives `ConversationService` via options and registers: `POST /conversations` → 201 + conversation object; `GET /conversations` → 200 + array; `DELETE /conversations/:id` → 404 if not found, 204 on success; `GET /conversations/:id/messages` → 404 if not found, 200 + messages array. All errors sanitized via `sanitizeError`.
- [X] T008 Update `src/server.ts`: instantiate `ConversationService` from `config.postgresApp`; register `conversationRoutes` plugin via `app.register(conversationRoutes, { conversationService })`; add `await conversationService.close()` to `onClose` hook

**Checkpoint**: `node --experimental-strip-types src/index.ts` deve iniciar sem erros com as novas rotas disponíveis

---

## Phase 3: User Story 1 — Criar Nova Conversa (Priority: P1) 🎯 MVP

**Goal**: O usuário cria uma nova conversa via botão na sidebar; a conversa aparece na lista e fica ativa com histórico vazio

**Independent Test**: `POST /conversations` retorna 201 com `{id, title, createdAt}`; sidebar exibe a nova conversa selecionada

### Implementation

- [X] T009 [US1] Modify `POST /chat` in `src/server.ts`: add `conversationId` (string, format `uuid`) as required field to body JSON schema (Fastify will return 400 automatically for malformed UUID format); validate that the conversation exists via `conversationService.getConversation(conversationId)` and return 404 with `{ error: 'Conversa não encontrada' }` if not found; for now, keep the existing graph invocation (history loading and persistence come in US2)
- [X] T010 [P] [US1] Update `web/src/api.ts`: add `export interface Conversation { id: string; title: string; createdAt: string }`, add `listConversations(): Promise<Conversation[]>` (GET /conversations), add `createConversation(): Promise<Conversation>` (POST /conversations); modify `askQuestion(question: string, conversationId: string)` to include `conversationId` in the request body
- [X] T011 [US1] Create `web/src/hooks/useConversations.ts`: custom hook returning `{ conversations, activeConversationId, turns, loading, createConversation, switchConversation, deleteConversation, send }`. On mount: call `listConversations()`, restore `activeConversationId` from `sessionStorage` (key `aurora_active_conv`), or auto-create a first conversation if list is empty. `createConversation()`: calls API, prepends to list, sets as active, clears `turns`, saves to sessionStorage. State: `turns: Turn[]` (same interface as current App.tsx), `loading: boolean`.
- [X] T012 [P] [US1] Create `web/src/components/ConversationSidebar.tsx` using Mantine `Stack`, `ScrollArea`, `NavLink`, `Button`, `ActionIcon`, `Text`: top "Nova Conversa" button calls `createConversation()`; below, a scrollable list of `NavLink` items (one per conversation, highlighted when active), each with an `ActionIcon` delete button (trash icon). Props: `{ conversations, activeConversationId, onSelect, onCreate, onDelete }`.
- [X] T013 [US1] Update `web/src/App.tsx`: import `useConversations` hook and `ConversationSidebar`; change `AppShell` to include `navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: false } }}`; add `<AppShell.Navbar>` containing `<ConversationSidebar ...>`; replace local `turns/input/loading/send` state with values from `useConversations`; pass `conversationId` to `send()`

**Checkpoint**: US1 verificada — botão "Nova Conversa" cria conversa, sidebar lista conversas, chat fica funcional

---

## Phase 4: User Story 2 — Alternar Entre Conversas (Priority: P2)

**Goal**: Ao selecionar uma conversa na sidebar, o histórico completo é restaurado e novas mensagens continuam o contexto

**Independent Test**: Criar duas conversas, enviar mensagens em cada uma, alternar entre elas e verificar histórico isolado e correto

### Implementation

- [X] T014 [US2] Implement conversation history loading in `POST /chat` handler in `src/server.ts`: after validating `conversationId`, call `conversationService.getMessages(conversationId)`, convert each message to `HumanMessage` (role='user') or `AIMessage` (role='assistant') from `@langchain/core/messages`, prepend to the new `HumanMessage`, pass the full array as `messages` in `graph.invoke({ messages: [...history, new HumanMessage(question)] })`
- [X] T015 [US2] Implement message persistence in `POST /chat` handler in `src/server.ts`: after `graph.invoke()` resolves, call `conversationService.saveMessage(conversationId, 'user', question)` and `conversationService.saveMessage(conversationId, 'assistant', state.answer ?? '')` in sequence
- [X] T016 [US2] Add `getConversationMessages(conversationId: string): Promise<ConversationMessage[]>` to `web/src/api.ts` (GET /conversations/:id/messages); implement `switchConversation(id: string)` in `web/src/hooks/useConversations.ts`: set `activeConversationId`, save to sessionStorage, fetch messages via `getConversationMessages(id)`, map them to `Turn[]` and set `turns`
- [X] T017 [P] [US2] Update `web/src/hooks/useConversations.ts` `send()` function: call `askQuestion(question, activeConversationId!)` (passing conversationId), optimistically add user turn, await response, add assistant turn; handle error with fallback turn

**Checkpoint**: US2 verificada — alternar conversas restaura histórico correto; respostas usam contexto da conversa ativa

---

## Phase 5: User Story 3 — Apagar Conversa (Priority: P3)

**Goal**: O usuário apaga uma conversa com confirmação; se for a ativa, o sistema muda para outra automaticamente

**Independent Test**: `DELETE /conversations/:id` retorna 204 e GET /conversations não lista mais a conversa apagada

### Implementation

- [X] T018 [P] [US3] Add `deleteConversation(id: string): Promise<void>` to `web/src/api.ts` (DELETE /conversations/:id, expects 204)
- [X] T019 [US3] Implement delete confirmation in `web/src/components/ConversationSidebar.tsx`: use `useDisclosure` from `@mantine/hooks` and Mantine `Modal` from `@mantine/core` for confirmation dialog; when user clicks delete icon, open modal storing the target conversation id; on confirm, call `onDelete(id)` and close modal; on cancel, close modal only
- [X] T020 [US3] Implement `deleteConversation(id)` in `web/src/hooks/useConversations.ts`: call `api.deleteConversation(id)`, remove from `conversations` list; if deleted id === `activeConversationId` AND remaining list is non-empty, call `switchConversation(remaining[0].id)`; if remaining list is empty, set `activeConversationId` to null, clear `turns`, and clear sessionStorage key — the empty state in the chat area must display the message "Crie uma nova conversa para começar" (spec edge case: apagar única conversa)

**Checkpoint**: US3 verificada — exclusão com confirmação funciona; conversa ativa é substituída automaticamente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Qualidade de código e verificação final

- [X] T021 Run `npx biome check --write` on all new/modified backend files: `src/config.ts`, `src/services/conversationService.ts`, `src/routes/conversations.ts`, `src/server.ts`, `data/schema.sql`, `data/seed.ts`. Fix any lint/format issues.
- [X] T022 [P] Run `npx biome check --write` on all new/modified frontend files: `web/src/api.ts`, `web/src/hooks/useConversations.ts`, `web/src/components/ConversationSidebar.tsx`, `web/src/App.tsx`. Fix any lint/format issues.
- [X] T023 Run full backend deterministic test suite to confirm no regressions: `node --experimental-strip-types --test tests/providers/factory-wiring.test.ts tests/providers/provider-config.test.ts tests/providers/provider-failure.test.ts tests/safeguard/safeguard-unit.test.ts` — all must pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — T002 e T003 paralelos com T001
- **Foundational (Phase 2)**: Requer Setup; T006 e T007 paralelos entre si; T005 requer T004; T008 requer T006+T007
- **US1 (Phase 3)**: Requer Foundational; T010 e T012 paralelos entre si; T011 requer T010; T013 requer T011+T012
- **US2 (Phase 4)**: Requer US1; T014 e T015 sequenciais (mesmo arquivo server.ts); T017 requer T016
- **US3 (Phase 5)**: Requer US2; T018 paralelo com T019; T020 requer T018+T019
- **Polish (Phase 6)**: Requer US3; T021 e T022 paralelos; T023 após T021

### User Story Dependencies

- **US1 (P1)**: Pode começar após Foundational — MVP independente
- **US2 (P2)**: Depende de US1 (modifica mesmo handler POST /chat e mesmo hook)
- **US3 (P3)**: Depende de US2 (usa hook e sidebar já finalizados)

### Parallel Opportunities

- T002, T003 paralelos com T001
- T006, T007 paralelos entre si
- T010, T012 paralelos entre si (arquivos diferentes)
- T021, T022 paralelos entre si

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: US1 (T009–T013)
4. **STOP e VALIDAR**: Criar conversa via UI, enviar mensagem, verificar que funciona end-to-end

### Incremental Delivery

1. Setup + Foundational → infraestrutura de conversas pronta
2. US1 → criar conversa + sidebar (MVP demonstrável)
3. US2 → alternância com histórico (feature completa)
4. US3 → exclusão com confirmação (polish de UX)
5. Polish → lint, regressão, Docker

---

## Notes

- [P] tasks = arquivos diferentes, sem dependências pendentes
- `ConversationService` usa pool separado (`aurora_app`) — `aurora_readonly` inalterado
- `POST /chat` ganha `conversationId` obrigatório — a UI deve sempre criar/selecionar uma conversa antes de enviar mensagem
- Confirmação de exclusão usa `Modal` + `useDisclosure` (já disponíveis) — sem instalar `@mantine/modals`
- Testes e2e de conversa (com PGHOST real) podem ser adicionados em v2 — quickstart.md cobre a validação manual
