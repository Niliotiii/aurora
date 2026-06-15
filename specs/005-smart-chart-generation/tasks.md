# Tasks: Smart Chart Generation

**Input**: Design documents from `specs/005-smart-chart-generation/`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

**Organization**: Tasks agrupadas por user story para implementação e teste independentes.

> **Nota de contexto**: US1 (gráfico automático na resposta) e US2 (tipos de gráfico contextuais)
> **já estão implementados** no codebase (`buildVegaSpec()`, `analyticalResponseNode.ts`,
> `App.tsx`). As fases correspondentes contêm apenas validação do comportamento existente.
> O trabalho de implementação novo está todo em US3 (persistência no histórico).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: User story correspondente (US1, US2, US3)

---

## Phase 1: Setup (Infra Compartilhada)

**Purpose**: Criar estrutura de migração de banco de dados.

- [x] T001 Criar diretório `storage/migrations/` e arquivo `storage/migrations/001_add_vega_spec.sql` com `ALTER TABLE conversation_message ADD COLUMN IF NOT EXISTS vega_spec JSONB NULL`

**Checkpoint**: Arquivo de migração criado e pronto para execução.

---

## Phase 2: Foundational (Pré-requisito Bloqueador)

**Purpose**: Executar a migração de banco e confirmar que a coluna existe antes de qualquer alteração no código.

**⚠️ CRÍTICO**: Nenhum trabalho de US3 pode começar até esta fase estar completa.

- [x] T002 Aplicar migração `storage/migrations/001_add_vega_spec.sql` no banco PostgreSQL (via psql ou `docker compose exec`) e verificar com `\d conversation_message` que coluna `vega_spec JSONB` aparece

**Checkpoint**: Coluna `vega_spec JSONB NULL` existe em `conversation_message` — implementação pode começar.

---

## Phase 3: User Story 1 — Resposta Automática com Gráfico (Priority: P1) 🎯

**Goal**: Confirmar que o sistema já avalia automaticamente se dados SQL são visualizáveis e gera gráfico Vega-Lite inline em novas respostas na sessão atual.

**Independent Test**: Enviar pergunta sobre série temporal (ex: "Mortalidade neonatal do Brasil 1990–2021") e verificar que gráfico de linha aparece na resposta sem configuração adicional.

### Validação de US1 (já implementado)

- [x] T003 [P] [US1] Verificar `src/viz/vegaSpec.ts`: confirmar que `buildVegaSpec()` retorna `null` para arrays com < 2 linhas e retorna spec Vega-Lite v5 válida para ≥ 2 linhas com campo numérico
- [x] T004 [P] [US1] Verificar `src/graph/nodes/analyticalResponseNode.ts`: confirmar que `handleSuccess()` chama `buildVegaSpec(state.dbResults)` e inclui `vegaSpec` em `finalize()`
- [x] T005 [US1] Verificar `src/server.ts` endpoint `/chat`: confirmar que `state.vegaSpec` é retornado no response JSON como `vegaSpec: state.vegaSpec ?? null`
- [x] T006 [US1] Verificar `web/src/App.tsx`: confirmar que `{turn.vegaSpec && <VegaLite spec={turn.vegaSpec as never} actions={false} />}` renderiza gráfico em novas mensagens

**Checkpoint**: US1 verificado — gráficos aparecem automaticamente em novas mensagens de série temporal e comparação categórica.

---

## Phase 4: User Story 2 — Tipos de Gráfico Contextuais (Priority: P2)

**Goal**: Confirmar que o sistema seleciona automaticamente linha para série temporal e barras para comparação categórica.

**Independent Test**: Enviar pergunta de série temporal → verificar gráfico de linha. Enviar pergunta de comparação por país → verificar gráfico de barras.

### Validação de US2 (já implementado)

- [x] T007 [P] [US2] Verificar lógica em `src/viz/vegaSpec.ts`: quando `yearKey` detectado e `isNumeric(sample[yearKey])` → marca `line`; quando apenas `labelKey` → marca `bar`; sem nenhum dos dois → retorna `null`
- [x] T008 [US2] Verificar que `YEAR_KEYS = ['year', 'time_year', 'ano']` e `LABEL_KEYS = ['country', 'geo_name_short', 'sex', 'age', 'category']` cobrem os campos reais retornados pelas queries WHO (validar contra schema `fact_observation`)

**Checkpoint**: US2 verificado — tipo de gráfico correto selecionado automaticamente para cada padrão de dados.

---

## Phase 5: User Story 3 — Gráfico Permanece no Histórico (Priority: P3)

**Goal**: Gráficos gerados em respostas anteriores devem aparecer ao recarregar a página ou alternar entre conversas.

**Independent Test**: Gerar resposta com gráfico → recarregar página → navegar de volta à conversa → gráfico deve aparecer no histórico sem ação do usuário.

### Implementação de US3 (novo trabalho)

- [x] T009 [US3] Atualizar interface `ConversationMessage` e assinatura de `saveMessage()` em `src/services/conversationService.ts`: adicionar `vegaSpec: object | null` à interface; atualizar `saveMessage()` para aceitar `vegaSpec?: object | null` como 4º parâmetro e persistir com `INSERT INTO conversation_message (conversation_id, role, content, vega_spec) VALUES ($1, $2, $3, $4)` (passar `vegaSpec ?? null` — objeto JS direto, pg serializa JSONB automaticamente)
- [x] T010 [US3] Atualizar `getMessages()` em `src/services/conversationService.ts` para incluir `vega_spec` no SELECT e mapear `vegaSpec: r.vega_spec ?? null` no retorno (depende de T009)
- [x] T011 [US3] Atualizar handler `/chat` em `src/server.ts`: na chamada `saveMessage()` do assistente, passar `state.vegaSpec ?? null` como 4º argumento (depende de T009)
- [x] T012 [P] [US3] Atualizar interface `ConversationMessage` em `web/src/api.ts`: adicionar `vegaSpec: object | null` ao tipo (depende de T009; arquivo diferente — pode rodar em paralelo com T011)
- [x] T013 [US3] Atualizar `loadHistory()` em `web/src/hooks/useConversations.ts`: mapear `vegaSpec: m.vegaSpec` em cada `Turn` carregado do histórico (depende de T010, T012)

**Checkpoint**: US3 completo — recarregar a página ou alternar conversas preserva e exibe gráficos do histórico.

---

## Phase 6: Polish & Verificação End-to-End

**Purpose**: Validação integrada de todos os user stories juntos.

- [x] T014 [P] Executar cenário do `quickstart.md`: pergunta série temporal → verificar que gráfico aparece e que `encoding.x.title`, `encoding.y.title` e `title` contêm "WHO estimates" — reload → gráfico permanece no histórico
- [x] T015 [P] Verificar edge case: query com 1 linha de resultado → sem gráfico → reload → sem gráfico (vega_spec null persiste como null no banco)
- [x] T016 Verificar que `GET /conversations/:id/messages` serializa `vega_spec` JSONB corretamente como `object` (não string) via `curl http://localhost:4000/conversations/:id/messages` e inspecionar campo `vegaSpec`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — iniciar imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — **BLOQUEIA** US3
- **US1 (Phase 3)**: Pode iniciar após Phase 2 (verificação apenas — não depende da migração)
- **US2 (Phase 4)**: Pode iniciar após Phase 2, em paralelo com US1
- **US3 (Phase 5)**: Depende de Phase 2 (coluna no banco) — implementação principal
- **Polish (Phase 6)**: Depende de US3 completo

### User Story Dependencies

- **US1 (P1)**: Independente — verificação de código existente
- **US2 (P2)**: Independente — verificação de código existente
- **US3 (P3)**: Depende de Foundational (migração de banco)

### Within US3

- T009 primeiro (interface + saveMessage no mesmo arquivo)
- T010 depende de T009 (getMessages no mesmo arquivo)
- T011 depende de T009 (server.ts — arquivo diferente de T012, podem ser paralelos)
- T012 depende de T009 (web/src/api.ts — arquivo diferente de T011, podem ser paralelos)
- T013 depende de T010 + T012

### Parallel Opportunities

- T003, T004 paralelos (arquivos distintos)
- T007, T008 paralelos (validações independentes)
- T011, T012 paralelos (arquivos distintos: server.ts e api.ts)
- T014, T015 paralelos (cenários de validação distintos)

---

## Parallel Example: User Story 3

```bash
# Sequencial 1 — service (mesmo arquivo, sem conflito):
Task T009: "Atualizar interface + saveMessage() em src/services/conversationService.ts"
Task T010: "Atualizar getMessages() em src/services/conversationService.ts"  # após T009

# Bloco paralelo — arquivos distintos (após T009):
Task T011: "Passar state.vegaSpec a saveMessage() em src/server.ts"
Task T012: "Adicionar vegaSpec a ConversationMessage em web/src/api.ts"

# Sequencial final (T013 — depende de T010 + T012):
Task T013: "Mapear vegaSpec em loadHistory() em web/src/hooks/useConversations.ts"
```

---

## Implementation Strategy

### MVP (US3 apenas — trabalho novo)

1. ✅ Phase 1: Criar migração SQL
2. ✅ Phase 2: Aplicar migração no banco
3. ✅ Phase 5: Implementar persistência (T009–T014)
4. **PARAR e VALIDAR**: reload → gráfico persiste no histórico
5. Phases 3 e 4 são verificação de código existente — podem ser feitas a qualquer momento

### Incremental Delivery

1. T001–T002: Migração → banco pronto
2. T009–T010: Service atualizado → backend persiste e lê vegaSpec
3. T011: Server.ts atualizado → pipeline completo no backend
4. T012–T013: Frontend atualizado → histórico exibe gráficos
5. T014–T016: Validação end-to-end

---

## Notes

- [P] = arquivos diferentes ou seções independentes, sem dependências de tasks incompletas
- US1 e US2 já estão implementados — as phases 3 e 4 são verificação, não desenvolvimento
- Todo o trabalho novo (6 mudanças de código + 1 migração) está em Phase 1, 2 e 5
- `vega_spec` deve ser `NULL` para mensagens `role = 'user'` — `saveMessage()` para user nunca recebe vegaSpec
- Fastify serializa JSONB do pg como `object` automaticamente — sem parse manual necessário no route handler
