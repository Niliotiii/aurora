# Contract: inputSafeguardNode

**Feature**: 003-input-safeguard
**Date**: 2026-06-14
**Version**: 1.0.0

## §1 — Interface do Nó

O `inputSafeguardNode` é um nó LangGraph que recebe `LlmService` (o `SafeguardService`) como dependência injetada e retorna um `Partial<GraphState>`.

```
function createInputSafeguardNode(llm: LlmService): (state: GraphState) => Promise<Partial<GraphState>>
```

**Pré-condições**:
- `state.question` DEVE estar preenchida (garantido por `extractQuestion`).
- Se `state.question` estiver vazia ou undefined, o nó retorna `{}` (fail-open silencioso — `extractQuestion` já teria reportado erro).

**Pós-condições**:

| Caso | Campos retornados |
|---|---|
| Classificação `safe` | `{}` (sem alteração de estado) |
| Classificação `injection` | `{ intent: 'injection', refusalReason: reason }` |
| Classificação `out_of_scope` | `{ intent: 'out_of_scope', refusalReason: reason }` |
| Classificação `malicious` | `{ intent: 'injection', refusalReason: reason }` (mapeado para `injection`) |
| Falha do modelo (success: false) | `{}` (fail-open — sem alteração de estado) |
| Exceção não tratada | `{}` (fail-open — capturada em try/catch) |

**Invariante de segurança**:
- O `refusalReason` NUNCA é exposto ao usuário — é usado apenas para logging interno.
- Nenhum dado do schema, credencial ou instrução interna é incluído em nenhum campo retornado.

---

## §2 — Roteamento no Grafo

```
extractQuestion → inputSafeguard → queryPlanner   (quando intent === undefined ou 'data')
                                 → analyticalResponse (quando intent !== 'data')
```

A aresta condicional da saída de `inputSafeguard`:

```typescript
(state: GraphState) => {
  if (state.intent && state.intent !== 'data') return 'analyticalResponse';
  return 'queryPlanner';
}
```

---

## §3 — SafeguardService

```
class SafeguardService implements LlmService {
  generateStructured<T>(systemPrompt, userPrompt, schema): Promise<StructuredResult<T>>
}
```

**Configuração**:
- Baseada em `config.safeguard.*`
- `apiKey`: `OPENROUTER_API_KEY` (reutilizado)
- `model`: `SAFEGUARD_MODEL` (default `openai/gpt-oss-safeguard-20b`)
- `timeout`: `SAFEGUARD_TIMEOUT_MS` (default 5000 ms)
- `maxRetries`: 0 (fixo — fail fast)
- `baseURL`: `https://openrouter.ai/api/v1` (fixo — sempre OpenRouter)

---

## §4 — Cenários de Teste Obrigatórios

| ID | Tipo | Descrição | Resultado esperado |
|---|---|---|---|
| T-SG-01 | Determinístico | Stub LLM retorna `injection` | `state.intent === 'injection'`, pipeline analítico não invocado |
| T-SG-02 | Determinístico | Stub LLM retorna `out_of_scope` | `state.intent === 'out_of_scope'`, pipeline analítico não invocado |
| T-SG-03 | Determinístico | Stub LLM retorna `safe` | `state.intent === undefined`, fluxo continua para `queryPlanner` |
| T-SG-04 | Determinístico | Stub LLM retorna `success: false` | `state.intent === undefined` (fail-open), pipeline continua |
| T-SG-05 | Determinístico | Stub LLM lança exceção | `state.intent === undefined` (fail-open), sem crash |
| T-SG-06 | Determinístico | Resposta bloqueada — sem vazamento | `leaksInternals(answer) === false` |
| T-SG-07 | Live (requer chave) | Injeção conhecida enviada ao sistema completo | Bloqueada antes de `queryPlanner`, sem SQL gerado |
| T-SG-08 | Live (requer chave) | Pergunta válida de dados | Passa safeguard, SQL gerado, resposta com atribuição WHO |

---

## §5 — Audit Contract

`logSafeguardAudit` DEVE ser chamado:
- Para toda classificação `injection`, `out_of_scope` ou `malicious` (decision: 'rejected')
- Opcionalmente para `safe` em modo debug

O log NUNCA inclui o texto bruto da mensagem. Formato: JSON em uma linha, prefixado com `⛔ SAFEGUARD REJECT` ou `✅ SAFEGUARD ALLOW`.

---

## §6 — Garantias de Segurança (ligadas à Constituição)

| Princípio | Garantia do safeguard |
|---|---|
| Princípio V | Injeções bloqueadas antes do pipeline; `reason` nunca exposto ao usuário |
| Princípio IV | Requisições bloqueadas nunca chegam ao `sqlGenerator` ou `sqlExecutor` |
| Princípio II | Requisições médicas detectadas como `out_of_scope` ou passam ao `queryPlanner` existente |
