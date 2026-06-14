# Implementation Plan: Input Safeguard

**Branch**: `003-input-safeguard` | **Date**: 2026-06-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-input-safeguard/spec.md`

## Summary

Adiciona um nó `inputSafeguard` ao pipeline LangGraph do Aurora, executado imediatamente após `extractQuestion` e antes de `queryPlanner`. O nó usa um modelo de classificação de segurança dedicado (`openai/gpt-oss-safeguard-20b` via OpenRouter) para classificar cada mensagem em `safe`, `injection`, `out_of_scope` ou `malicious` antes de qualquer operação analítica. Mensagens bloqueadas são encaminhadas ao `analyticalResponse` via o mecanismo de `intent` já existente, garantindo recusas em português sem vazamento de internos. Falhas do modelo de safeguard são tratadas como `safe` (fail-open), confiando no `queryPlanner` como segunda linha de defesa.

## Technical Context

**Language/Version**: Node.js 24.11.1 + TypeScript (mandado pela constituição)
**Primary Dependencies**: LangChain / LangGraph (nó do grafo), `@langchain/openai` (ChatOpenAI para OpenRouter), Zod (schema de saída estruturada) — todas já presentes
**Storage**: N/A — nenhum dado persistido; apenas logging estruturado em stdout/stderr
**Testing**: Node.js native test runner (`node:test`) com `--experimental-strip-types`; Biome para lint/format
**Target Platform**: Linux (Docker container) + macOS local (desenvolvimento)
**Project Type**: Middleware node dentro de um pipeline LangGraph existente (web-service)
**Performance Goals**: Triagem completa em ≤ 5 s p95; latência adicional ≤ 5 s para requisições aceitas (SC-003)
**Constraints**: Fail-open em falha de modelo; zero vazamento de internos (Princípio V); `OPENROUTER_API_KEY` reutilizada (sem nova chave de API)
**Scale/Scope**: Uma instância de `SafeguardService` por processo; sem estado compartilhado entre requisições

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Observação |
|---|---|---|
| I — Single Source of Truth (WHO GHO) | ✅ PASS | Safeguard não toca em dados; nenhuma resposta numérica é gerada por ele |
| II — Zero Medical Hallucination | ✅ PASS | Safeguard detecta e bloqueia perguntas médicas antes do pipeline; não gera conteúdo médico |
| III — Mandatory Data Transparency | ✅ PASS | Respostas de recusa do safeguard não contêm dados numéricos → sem obrigação de atribuição |
| IV — Read-Only Database Access | ✅ PASS | Safeguard roda antes de qualquer acesso ao banco; nenhuma query gerada para requisições bloqueadas |
| V — Schema Protection & Prompt-Injection Resistance | ✅ PASS DIRETO | Esta feature é o mecanismo primário de aplicação do Princípio V — adiciona triagem dedicada de injeção |

**Gates de desenvolvimento** (mandados pela constituição):
- Segurança: testes DEVEM cobrir (a) rejeição de padrões de injeção conhecidos, (b) recusas sem vazamento de internos, (c) comportamento fail-open quando o modelo falha
- Transparência: recusas do safeguard NÃO devem conter dados numéricos (sem necessidade de atribuição WHO)
- Revisão: nenhum Princípio enfraquecido — o `queryPlanner` continua como segunda linha de defesa

**Conclusão pré-design**: Todos os gates passam. Prosseguir para Fase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-input-safeguard/
├── plan.md              ← este arquivo
├── research.md          ← decisões técnicas (Phase 0)
├── data-model.md        ← entidades em memória (Phase 1)
├── quickstart.md        ← cenários de integração (Phase 1)
├── contracts/
│   └── safeguard-node.md  ← contrato do nó safeguard (Phase 1)
└── tasks.md             ← gerado por /speckit-tasks (não criado aqui)
```

### Source Code (repository root)

```text
src/
├── config.ts                               ← MODIFICAR: adicionar bloco `safeguard`
├── services/
│   ├── llmService.ts                       ← sem alteração (interface reutilizada)
│   ├── llmFactory.ts                       ← sem alteração
│   └── safeguardService.ts                 ← NOVO: ChatOpenAI + OpenRouter + SAFEGUARD_MODEL
├── guards/
│   └── audit.ts                            ← MODIFICAR: adicionar logSafeguardAudit()
├── prompts/v1/
│   └── inputSafeguard.ts                   ← NOVO: SafeguardSchema + prompts
└── graph/
    ├── factory.ts                           ← MODIFICAR: instanciar SafeguardService
    ├── graph.ts                             ← MODIFICAR: adicionar nó + arestas inputSafeguard
    └── nodes/
        └── inputSafeguardNode.ts            ← NOVO: nó LangGraph do safeguard

tests/
├── safeguard/
│   ├── safeguard-unit.test.ts               ← NOVO: testes determinísticos (sem chave)
│   └── safeguard-e2e.test.ts                ← NOVO: testes ao vivo (requer OPENROUTER_API_KEY)
├── helpers.ts                               ← MODIFICAR: adicionar leaksSafeguard()

.env.example                                 ← MODIFICAR: adicionar SAFEGUARD_MODEL, SAFEGUARD_TIMEOUT_MS
docker-compose.yaml                          ← MODIFICAR: adicionar novas env vars
CLAUDE.md                                    ← MODIFICAR: atualizar ponteiro de feature
```

**Structure Decision**: Segue exatamente o padrão do `queryPlannerNode` (repo-exemplo confirmado): serviço LLM separado → nó de grafo separado → prompts separados. Nenhum novo pacote npm ou nova chave de API. `SafeguardService` reutiliza `OPENROUTER_API_KEY` com um model diferente.

## Complexity Tracking

> Nenhuma violação constitucional identificada. Seção preenchida apenas como registro.

| Decisão | Justificativa |
|---|---|
| Fail-open em falha do safeguard | `queryPlanner` permanece como segunda linha de defesa; fail-closed travaria usuários legítimos em falhas de rede |
| SAFEGUARD_MODEL sempre via OpenRouter | `openai/gpt-oss-safeguard-20b` é um modelo OpenRouter; não há suporte nativo no cliente Anthropic ou OpenAI direto |
| maxRetries = 0 no SafeguardService | Retries adicionam latência; safeguard deve falhar rápido e deixar o pipeline principal resolver |
