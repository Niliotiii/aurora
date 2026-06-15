# Research: Smart Chart Generation

**Feature**: 005-smart-chart-generation  
**Date**: 2026-06-14  
**Status**: Complete

## Findings

### 1. Estado Atual da Geração de Gráficos

**Decision**: A feature de geração de gráficos já está parcialmente implementada no codebase.

**Rationale**: Análise do codebase revelou:
- `src/viz/vegaSpec.ts` — `buildVegaSpec()` já faz avaliação inteligente: retorna `null` para dados insuficientes (<2 linhas), seleciona linha para série temporal (detecção via `year`/`time_year`/`ano`), barras para comparação categórica.
- `src/graph/nodes/analyticalResponseNode.ts` — já chama `buildVegaSpec()` e inclui `vegaSpec` no estado do grafo em respostas de sucesso.
- `/chat` endpoint já retorna `vegaSpec` na resposta JSON.
- `web/src/App.tsx` já renderiza `<VegaLite>` quando `turn.vegaSpec` existe (via `react-vega`).
- `web/src/hooks/useConversations.ts` já captura `res.vegaSpec` em novas mensagens.

**Gap identificado**: Gráficos aparecem apenas em mensagens novas durante a sessão atual. Ao recarregar a página ou alternar conversas, os gráficos somem porque:
1. `conversation_message` table não tem coluna `vega_spec`
2. `ConversationService.saveMessage()` não persiste `vegaSpec`
3. `ConversationService.getMessages()` não retorna `vegaSpec`
4. `loadHistory()` no frontend não mapeia `vegaSpec` das mensagens carregadas

---

### 2. Estratégia de Persistência de JSONB no PostgreSQL

**Decision**: Usar coluna `vega_spec JSONB NULL` na tabela `conversation_message`.

**Rationale**: 
- PostgreSQL tem suporte nativo a JSONB — eficiente para leitura/escrita de specs Vega-Lite (objetos JSON estruturados).
- Coluna nullable: `user` messages e respostas sem gráfico ficam com `NULL`, sem overhead.
- Vega-Lite specs são objetos JSON determinísticos derivados dos dados SQL — seguros para serializar.
- Alternativa (tabela separada `chart_spec`) foi rejeitada: adicionaria join desnecessário sem benefício real para a escala atual.

**Alternatives considered**:
- Armazenar como `TEXT` (JSON stringify): rejeitado — JSONB é mais eficiente para query e validação.
- Tabela separada `chart_spec`: rejeitado — complexidade desnecessária para 1-1 com mensagem.

---

### 3. Migração de Schema

**Decision**: Adicionar coluna via `ALTER TABLE` com script de migração idempotente.

**Rationale**: 
- O schema atual é gerenciado por `data/schema.sql` (recriação completa). Para dados de produção, usar `ALTER TABLE IF NOT EXISTS`.
- Coluna com `DEFAULT NULL` não quebra inserções existentes.
- Script de migração separado `storage/migrations/001_add_vega_spec.sql` para rastreabilidade.

---

### 4. Escopo da Inteligência de Seleção de Gráfico

**Decision**: Manter a abordagem heurística existente (`buildVegaSpec()`). Não adicionar decisão via LLM nesta feature.

**Rationale**:
- A heurística atual (detecção de campos `year*`, `rate*`, `country*` etc.) é suficiente para os dados WHO estruturados.
- Adicionar LLM para decisão de gráfico introduziria latência e custo sem melhoria de qualidade significativa para dados tabelares estruturados.
- O LLM na `analyticalResponseNode` já tem contexto para decidir quando não gerar resposta de dados (via `state.intent`); o gráfico é consequência natural dos dados retornados.
- Alternativa (LLM decision node para gráfico): rejeitado — prematuro para o conjunto de dados atual.

---

### 5. Impacto na API de Mensagens

**Decision**: Atualizar endpoint `GET /conversations/:id/messages` para incluir `vegaSpec` na resposta.

**Rationale**: 
- O frontend precisa de `vegaSpec` ao carregar histórico para renderizar gráficos passados.
- Interface `ConversationMessage` deve ser estendida com `vegaSpec: object | null`.
- Sem essa mudança, o histórico sempre carregará sem gráficos mesmo após a migração.

---

### 6. Compatibilidade com react-vega

**Decision**: Reutilizar o componente `<VegaLite>` já instalado — nenhuma mudança de dependência necessária.

**Rationale**:
- `react-vega` já está instalado no frontend (`web/package.json`).
- `App.tsx` já renderiza `<VegaLite spec={turn.vegaSpec as never} actions={false} />`.
- A spec Vega-Lite serializada no banco é idêntica à gerada em tempo real — nenhuma transformação adicional necessária.

---

## Summary of Changes Required

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| DB Schema | `storage/migrations/001_add_vega_spec.sql` | ADD COLUMN `vega_spec JSONB NULL` |
| Backend Service | `src/services/conversationService.ts` | `saveMessage()` aceita `vegaSpec?`; `getMessages()` retorna vegaSpec |
| Backend Route | `src/routes/conversations.ts` | Endpoint messages inclui vegaSpec na resposta |
| Backend Server | `src/server.ts` | Passa `state.vegaSpec` para `saveMessage()` |
| Frontend API | `web/src/api.ts` | `ConversationMessage` inclui `vegaSpec: object | null` |
| Frontend Hook | `web/src/hooks/useConversations.ts` | `loadHistory()` mapeia vegaSpec para Turn |
