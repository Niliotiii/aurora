# Implementation Plan: Smart Chart Generation

**Branch**: `005-smart-chart-generation` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/005-smart-chart-generation/spec.md`

## Summary

O Aurora já gera gráficos Vega-Lite inteligentes em tempo real (decidindo automaticamente entre linha e barra com base nos dados SQL). A lacuna é que gráficos não são persistidos: ao recarregar a página ou alternar conversas, o histórico carrega sem gráficos. Esta feature adiciona uma coluna `vega_spec JSONB` à tabela `conversation_message`, persiste o spec ao salvar a resposta, e propaga o campo pelo pipeline backend→API→frontend para que o histórico carregue gráficos corretamente.

## Technical Context

**Language/Version**: Node.js 24.11.1 / TypeScript  
**Primary Dependencies**: Fastify, LangGraph, pg (PostgreSQL client), react-vega (Vega-Lite renderer)  
**Storage**: PostgreSQL — `aurora_app` role para `conversation_message`; read-only role para dados WHO  
**Testing**: Biome (lint/format), testes manuais via UI  
**Target Platform**: Web (Fastify backend + Vite/React frontend)  
**Project Type**: Web application (Node.js API + React SPA)  
**Performance Goals**: Nenhum impacto perceptível — JSONB adiciona <1ms ao save/load de mensagens  
**Constraints**: `vega_spec` sempre `NULL` para role `user`; schema JSONB segue Vega-Lite v5  
**Scale/Scope**: Feature isolada — 6 arquivos alterados, 1 migração SQL, 0 novas dependências

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Single Source of Truth (WHO GHO) | ✅ PASS | `vegaSpec` é gerado exclusivamente de `dbResults` — nenhuma fonte externa |
| II. Zero Medical Hallucination | ✅ PASS | Gráfico representa apenas dados numéricos do banco; nenhuma alegação causal |
| III. Mandatory Data Transparency | ✅ PASS | `buildVegaSpec()` já inclui "WHO estimates" no título do gráfico; atribuição mantida |
| IV. Read-Only Database Access | ✅ PASS | Migração ADD COLUMN usa role `aurora_app` (não read-only); path de query permanece SELECT-only |
| V. Schema Protection | ✅ PASS | `vega_spec` armazena specs Vega-Lite derivadas; nenhum schema interno exposto |

**Post-Design Re-check**: Todos os gates passam. A mudança de persistência não altera nenhum princípio constitucional.

## Project Structure

### Documentation (this feature)

```text
specs/005-smart-chart-generation/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Análise do codebase e decisões
├── data-model.md        # Schema e tipos
├── quickstart.md        # Guia de execução e teste
└── contracts/
    └── api.md           # Contrato do endpoint de mensagens
```

### Source Code (impacted files)

```text
storage/
└── migrations/
    └── 001_add_vega_spec.sql       # NEW: ADD COLUMN vega_spec JSONB NULL

src/
├── services/
│   └── conversationService.ts      # MODIFIED: saveMessage + getMessages
├── routes/
│   └── conversations.ts            # MODIFIED: messages endpoint inclui vegaSpec
└── server.ts                       # MODIFIED: passa state.vegaSpec a saveMessage

web/src/
├── api.ts                          # MODIFIED: ConversationMessage + vegaSpec
└── hooks/
    └── useConversations.ts         # MODIFIED: loadHistory mapeia vegaSpec
```

**Structure Decision**: Single project (backend + frontend no mesmo repo). Nenhuma mudança estrutural necessária.

## Implementation Steps

### Step 1 — DB Migration

Criar `storage/migrations/001_add_vega_spec.sql`:
```sql
ALTER TABLE conversation_message
  ADD COLUMN IF NOT EXISTS vega_spec JSONB NULL;
```

### Step 2 — ConversationService

`src/services/conversationService.ts`:
- Estender interface `ConversationMessage` com `vegaSpec: object | null`
- Atualizar `saveMessage(conversationId, role, content, vegaSpec?)` para persistir `vega_spec`
- Atualizar `getMessages()` para SELECT `vega_spec` e mapear no retorno

### Step 3 — Chat Route (server.ts)

`src/server.ts`:
- Passar `state.vegaSpec ?? null` como 4º argumento de `saveMessage()` ao salvar a resposta do assistente

### Step 4 — Messages Endpoint (conversations route)

`src/routes/conversations.ts`:
- O endpoint `GET /conversations/:id/messages` já delega para `svc.getMessages()` — após Step 2, o retorno já incluirá `vegaSpec`. Verificar que a serialização JSON do Fastify passa o campo corretamente (JSONB→object).

### Step 5 — Frontend API Type

`web/src/api.ts`:
- Adicionar `vegaSpec: object | null` à interface `ConversationMessage`

### Step 6 — Frontend History Hook

`web/src/hooks/useConversations.ts`:
- Em `loadHistory()`, mapear `m.vegaSpec` para `vegaSpec` no Turn

## Complexity Tracking

> Nenhuma violação da constituição — seção não aplicável.
