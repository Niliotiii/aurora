# Research: Input Safeguard

**Feature**: 003-input-safeguard
**Date**: 2026-06-14

## R1 — Posicionamento do nó no grafo (pipeline placement)

**Decision**: Inserir `inputSafeguard` entre `extractQuestion` e `queryPlanner`.

**Rationale**: `extractQuestion` produz `state.question` (string limpa) que o safeguard precisa para classificar. Rodar antes de `queryPlanner` garante que nenhum acesso ao banco ou geração de SQL ocorra para requisições bloqueadas — mínima superfície de ataque. O grafo existente já tem a aresta condicional correta: se `state.intent !== 'data'`, o `queryPlanner` encaminha para `analyticalResponse`. O safeguard pode definir `intent` antes do `queryPlanner`, causando roteamento idêntico.

**Alternatives considered**:
- Middleware HTTP (antes do LangGraph): descartado — perderia o acesso a `state.question` já extraída; duplicaria a extração de pergunta.
- Dentro de `extractQuestion`: descartado — viola separação de responsabilidades; `extractQuestion` deve permanecer puro e sem LLM.
- Nó pós-`queryPlanner`: descartado — `queryPlanner` já consome recursos do LLM principal antes da triagem.

---

## R2 — `SafeguardService` vs reutilizar `LlmFactory`

**Decision**: Criar `SafeguardService` separado (`src/services/safeguardService.ts`) que implementa `LlmService`, usando `ChatOpenAI` com `baseURL: openrouter.ai` e `SAFEGUARD_MODEL`.

**Rationale**: O `llmFactory` é o ponto único de seleção do provider ANALÍTICO (`LLM_PROVIDER`). O safeguard usa um modelo FIXO (`openai/gpt-oss-safeguard-20b`) independentemente do `LLM_PROVIDER` — é um componente de segurança especializado, não intercambiável. Criar um serviço dedicado mantém essa separação explícita e testável.

**Alternatives considered**:
- Reutilizar `OpenRouterService` com modelo diferente: descartado — `OpenRouterService` lê o modelo de `config.openrouter.model`; mudar isso quebraria o provider analítico.
- Parâmetro `model` no `LlmFactory`: descartado — aumenta acoplamento; o factory não deve conhecer o safeguard.

---

## R3 — Schema de classificação do safeguard

**Decision**: `SafeguardSchema` com campos `classification: enum(['safe','injection','out_of_scope','malicious'])`, `reason: string`.

**Rationale**: Campo `confidence` (0–1) foi considerado mas omitido — o modelo de safeguard especializado deve ser decisivo; limiares de confiança adicionariam complexidade de tunagem sem benefício claro dado o modelo `gpt-oss-safeguard-20b` (otimizado para classificação). `reason` é mantido para audit logging (FR-008) sem expor ao usuário.

**Alternatives considered**:
- Schema binário (`safe: boolean`): descartado — perde granularidade para logging e para potencial tunagem futura de resposta por categoria.
- Incluir `confidence`: omitido na v1 (ver acima).

---

## R4 — Falha do modelo safeguard: fail-open vs fail-closed

**Decision**: Fail-open — em exceção ou `success: false`, o nó retorna `{}` (sem `intent`), deixando `queryPlanner` como segunda linha.

**Rationale**: A constituição exige que o sistema não trave indefinidamente (especificação FR-009). Fail-closed (bloquear em falha) impediria usuários legítimos durante instabilidade de rede — custo maior que o risco, dado que `queryPlanner` já classifica `injection`/`out_of_scope`. Defense-in-depth funciona mesmo com fail-open na primeira camada.

**Alternatives considered**:
- Fail-closed: retornar `intent: 'injection'` em falha. Descartado — muitos falsos positivos em instabilidade de rede.
- Retornar erro explícito ao usuário: descartado — o usuário não deve ver erros de infraestrutura de segurança.

---

## R5 — Configuração: nova `OPENROUTER_API_KEY` ou reutilizar?

**Decision**: Reutilizar `OPENROUTER_API_KEY` existente. Adicionar apenas `SAFEGUARD_MODEL` (default: `openai/gpt-oss-safeguard-20b`) e `SAFEGUARD_TIMEOUT_MS` (default: `5000`).

**Rationale**: O safeguard usa a mesma API do OpenRouter já configurada. Não há necessidade de chave separada. Timeout menor (5 s vs 30 s padrão do LLM analítico) porque o safeguard deve falhar rápido e deixar o pipeline seguir. `maxRetries = 0` no `SafeguardService` para o mesmo motivo.

**Alternatives considered**:
- `SAFEGUARD_API_KEY` separada: descartado — desnecessária; aumenta fricção de configuração.
- Usar `LLM_TIMEOUT_MS`: descartado — o safeguard tem SLA mais agressivo (5 s) que o analítico (30 s).

---

## R6 — Audit logging: estender `audit.ts` ou novo arquivo?

**Decision**: Estender `src/guards/audit.ts` com `logSafeguardAudit()` e `SafeguardAuditRecord`.

**Rationale**: `audit.ts` já define o padrão de logging estruturado do projeto (FR-008). Adicionar `logSafeguardAudit` mantém consistência e evita duplicação. O registro NUNCA inclui o texto bruto da mensagem — apenas `classification` e `reason` (privacidade de usuário, spec Assumptions).

**Alternatives considered**:
- `src/guards/safeguardAudit.ts` separado: descartado — pequena adição que não justifica novo arquivo.
- Logging apenas com `console.log`: descartado — inconsistente com o padrão estabelecido de `logAudit`.

---

## R7 — Padrão de prompt para o modelo `gpt-oss-safeguard-20b`

**Decision**: System prompt JSON compacto (mesmo padrão do `queryAnalyzer.ts`) com categorias explícitas, exemplos concretos e regra de idioma.

**Rationale**: O modelo `gpt-oss-safeguard-20b` é otimizado para classificação de segurança. O padrão de prompt JSON compacto com exemplos few-shot é o mesmo usado em `queryAnalyzer.ts` e funciona bem com modelos OpenAI via OpenRouter. A regra de idioma garante detecção em PT/EN/ES.

**Alternatives considered**:
- Prompt em linguagem natural (markdown): descartado — JSON compacto é mais eficiente em tokens e mais determinístico.
- Sem exemplos few-shot: descartado — exemplos concretos reduzem ambiguidade para o modelo de classificação.

---

## R8 — Integração com o grafo: nova aresta ou reutilizar lógica existente?

**Decision**: Adicionar aresta condicional `inputSafeguard → analyticalResponse` quando `state.intent !== 'data'`; caso contrário `inputSafeguard → queryPlanner`. Reutilizar o campo `state.intent` existente.

**Rationale**: `AuroraStateAnnotation` já tem `intent: z.enum(['data','out_of_scope','medical','injection'])` e `refusalReason`. O `analyticalResponse` já lida com todos os casos de recusa. Não é necessário novo campo de estado — o safeguard simplesmente popula `intent` mais cedo.

**Alternatives considered**:
- Novo campo `safeguardBlocked: boolean`: descartado — duplicaria semântica já coberta por `intent`.
- Modificar a aresta existente `extractQuestion → queryPlanner`: descartado — a aresta atual só roteia em `state.error`; adicionar lógica de intent nela violaria separação de responsabilidades.
