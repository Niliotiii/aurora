# Data Model: Smart Chart Generation

**Feature**: 005-smart-chart-generation  
**Date**: 2026-06-14

## Schema Changes

### Table: `conversation_message` (existing — extended)

Nova coluna adicionada:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `vega_spec` | `JSONB` | YES | `NULL` | Especificação Vega-Lite do gráfico gerado para esta mensagem. NULL para mensagens de usuário e para respostas sem gráfico. |

**Migration**: `storage/migrations/001_add_vega_spec.sql`

```sql
ALTER TABLE conversation_message
  ADD COLUMN IF NOT EXISTS vega_spec JSONB NULL;
```

### Invariants

- `vega_spec` é sempre `NULL` quando `role = 'user'` (usuários não geram gráficos).
- `vega_spec` é `NULL` para respostas assistentes onde os dados não atingem o limiar mínimo de visualização (< 2 linhas, dados não-numéricos).
- `vega_spec` é um objeto JSON válido seguindo o schema Vega-Lite v5 quando presente.

## Domain Types

### `VegaSpec` (tipo interno)
```typescript
// Qualquer objeto JSON válido compatível com o schema Vega-Lite v5.
// Gerado por buildVegaSpec() em src/viz/vegaSpec.ts.
type VegaSpec = Record<string, unknown> | null;
```

### `ConversationMessage` (estendido)
```typescript
interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  vegaSpec: object | null;   // NOVO: null para mensagens sem gráfico
  createdAt: string;
}
```

### `Turn` (frontend — estendido via useConversations)
```typescript
interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attribution?: string | null;
  vegaSpec?: object | null;   // Já existe; agora também populado do histórico
  followUps?: string[];
}
```

## No New Tables

Nenhuma tabela nova é necessária. A feature estende a tabela `conversation_message` existente com uma coluna JSONB.
