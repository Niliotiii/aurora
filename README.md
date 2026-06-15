# Aurora

Agente conversacional **Text-to-SQL** sobre o dataset **WHO Global Health Observatory**
"Deaths per 1,000 live births" (indicador `MORT_200`). Faça uma pergunta em linguagem
natural; Aurora traduz para SQL, executa contra um banco PostgreSQL **somente-leitura** e
devolve uma resposta fundamentada com gráfico interativo **Vega-Lite**.

Cobertura: **194 países · 2000–2017 · 3 faixas etárias · 14 causas de morte**.

## Demo

![Aurora Demo](video/out/aurora-demo.mp4)

Construído segundo a [constituição](.specify/memory/constitution.md) do projeto (v1.1.0):
fonte única de verdade, **zero alucinação médica**, atribuição obrigatória a estimativas
OMS, acesso **somente-leitura** em profundidade e proteção de esquema/injeção de prompt.

## Arquitetura

Stack **Node.js 24.11.1 + TypeScript**, estruturado após `./repo-exemplo` (agente
Text-to-Cypher), reimplementado para SQL relacional:

```
Pergunta → extractQuestion → queryPlanner → sqlGenerator → sqlExecutor → analyticalResponse
                                  │                            │  ▲
              (fora do escopo / médico / injeção)              └─ sqlCorrection (limitado, 1x)
                                  └──────────► recusa segura
```

- **Orquestração**: LangChain + **LangGraph** (`src/graph`)
- **LLM**: OpenRouter (`src/services/openrouterService.ts`) — configurável para OpenAI ou Anthropic
- **BD**: PostgreSQL via role `SELECT`-only (`src/services/postgresService.ts`)
- **Guards** (defesa em profundidade): `src/guards/sqlGuard.ts` (bloqueia DML/DDL),
  `errorSanitizer.ts` (sem vazamento), `audit.ts` (log de auditoria)
- **Gráficos**: spec Vega-Lite gerado em `src/viz/vegaSpec.ts`, persistido como JSONB
- **UI**: container separado — Vite + **React + Mantine** (`web/`), renderiza via `react-vega`

## Quick start (Docker — recomendado)

```bash
cp .env.example .env          # configure OPENROUTER_API_KEY (ou OPENAI/ANTHROPIC)
docker compose up             # postgres + app (seed automático) + web
```

- API: http://localhost:4000  (`POST /chat`)
- Web UI: http://localhost:8080

Um único `docker compose up` sobe o Postgres (com healthcheck), a API (que aguarda o BD e
**executa o seed automaticamente**) e a UI web.

### Provedores LLM (OpenRouter / OpenAI / Anthropic)

Aurora suporta três provedores, selecionados com uma única variável de ambiente. OpenRouter
é o padrão, mantendo compatibilidade com deployments existentes.

```dotenv
LLM_PROVIDER=openrouter        # openrouter (padrão) | openai | anthropic

# Configure o bloco do provedor escolhido:
OPENROUTER_API_KEY=...   OPENROUTER_MODEL=anthropic/claude-sonnet-4-6
OPENAI_API_KEY=...       OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=...    ANTHROPIC_MODEL=claude-sonnet-4-6

LLM_TIMEOUT_MS=30000           # uniforme entre provedores
LLM_MAX_RETRIES=2
```

Trocar de provedor é **apenas configuração** (sem alteração de código). Misconfigurações
falham na inicialização com mensagem clara e sem expor segredos. Veja
`specs/002-multi-llm-providers/quickstart.md` para detalhes.

### Local (sem Docker)

```bash
npm install
npm run docker:infra:up       # apenas Postgres
npm run seed                  # carrega o Excel + cria roles somente-leitura
npm run dev                   # API em :4000
cd web && npm install && npm run dev   # UI em :5173
```

## Exemplo

```bash
curl -X POST -H 'Content-Type: application/json' \
  --data '{"question": "Qual a taxa de mortalidade neonatal do Brasil entre 2000 e 2017?"}' \
  http://localhost:4000/chat
```

Retorna `{ answer, attribution, vegaSpec, followUpQuestions, query }`. Todo response com
dados carrega atribuição obrigatória às estimativas da OMS.

## Testes

```bash
npm run test:e2e
```

Verificações determinísticas (SQL guard / bloqueio de mutações, spec Vega-Lite) rodam em
qualquer ambiente. Os testes end-to-end com LLM+BD (grounding, indisponível, injeção,
médico) rodam quando `OPENROUTER_API_KEY` e banco populado estão disponíveis, e são
ignorados caso contrário.

## Dados

**Fonte**: `data/Mortes infantis por 1000 nascidos vivos.xlsx`
(WHO Global Health Observatory — indicador MORT_200, _Deaths per 1,000 live births_).

O seed (`data/seed.ts`) carrega o Excel com SheetJS e popula um **esquema estrela**:

```
dim_geography    geo_code (ISO alpha-3), geo_name, region_code, region_name
dim_time         time_year (2000–2017)
dim_age_group    age_code, age_name, age_label (em português)
dim_cause        cause_code, cause_name
fact_observation geo_code FK, time_year FK, age_code FK, cause_code FK, rate_per_1000
```

**Faixas etárias** (`age_code`):

| Código | Descrição |
|--------|-----------|
| `AGEGROUP_DAYS0-27` | Neonatal (0-27 dias) — padrão |
| `AGEGROUP_MONTHS1-59` | Pós-neonatal (1-59 meses) |
| `AGEGROUP_YEARS0-4` | Abaixo de 5 anos (0-4 anos) |

**Causas** (`cause_code`): 14 causas específicas (prematuridade, asfixia, sepse, malária,
diarreia, sarampo, tétano, HIV/AIDS, meningite, IVAS, anomalias congênitas, outras
infecciosas, outras DCNT, lesões) + `ALL_CAUSES` (total sintético, computado via SQL `SUM`
agrupado por país/ano/faixa).

Total carregado: ~157 mil observações · 194 países · 18 anos · 3 faixas · 15 causas.

Veja `specs/001-text-to-sql-base/` para a spec base e `specs/005-smart-chart-generation/`
para a feature de gráficos persistidos.
