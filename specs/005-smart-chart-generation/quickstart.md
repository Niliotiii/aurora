# Quickstart: Smart Chart Generation

**Feature**: 005-smart-chart-generation  
**Date**: 2026-06-14

## Como funciona

Esta feature garante que gráficos Vega-Lite gerados em respostas do Aurora sejam persistidos no histórico de conversas e exibidos ao recarregar ou alternar conversas.

## Execução da migração

Antes de testar, execute a migração para adicionar a coluna `vega_spec`:

```bash
# Com psql (role aurora_app ou admin)
psql $DATABASE_URL -f storage/migrations/001_add_vega_spec.sql
```

Ou via Docker Compose:

```bash
docker compose exec postgres psql -U aurora_app -d aurora -f /migrations/001_add_vega_spec.sql
```

## Testando manualmente

1. Inicie o backend e frontend:
   ```bash
   # Terminal 1 — backend
   npm run dev

   # Terminal 2 — frontend
   cd web && npm run dev
   ```

2. Abra o navegador em `http://localhost:5173`

3. Faça uma pergunta que gera série temporal:
   ```
   Qual foi a evolução da taxa de mortalidade neonatal do Brasil de 1990 a 2021?
   ```

4. Verifique que o gráfico aparece na resposta.

5. Recarregue a página (F5).

6. Navegue de volta para a conversa — o gráfico deve aparecer no histórico.

## Verificar no banco

```sql
SELECT id, role, LEFT(content, 50), vega_spec IS NOT NULL AS has_chart
FROM conversation_message
ORDER BY created_at DESC
LIMIT 10;
```

## Comportamento esperado

| Tipo de pergunta | Gráfico gerado? | Persistido? |
|------------------|----------------|-------------|
| Série temporal (múltiplos anos) | ✅ Linha | ✅ |
| Comparação entre países (único ano) | ✅ Barras | ✅ |
| Valor escalar (único número) | ❌ Texto apenas | N/A |
| Pergunta fora do escopo | ❌ Recusa | N/A |
