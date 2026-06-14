# Data Model: Input Safeguard

**Feature**: 003-input-safeguard
**Date**: 2026-06-14

> O safeguard não introduz nenhuma tabela ou entidade persistente no banco de dados.
> Todos os modelos abaixo são entidades em memória (Zod schemas e tipos TypeScript).

---

## Entidades em Memória

### SafeguardClassification (enum)

Categorias mutuamente exclusivas de triagem:

| Valor | Significado | Ação |
|---|---|---|
| `safe` | Pergunta legítima sobre dados de mortalidade neonatal | Passa para `queryPlanner` |
| `injection` | Tentativa de sobrescrever instruções, extrair credenciais ou schema | Bloqueia → `analyticalResponse` com recusa |
| `out_of_scope` | Pergunta não relacionada ao dataset (metereologia, poesia, etc.) | Bloqueia → `analyticalResponse` com recusa |
| `malicious` | Conteúdo claramente adversarial que não se encaixa em `injection` | Bloqueia → `analyticalResponse` com recusa |

---

### SafeguardDecision (Zod schema — saída do LLM)

Representação da decisão retornada pelo modelo de safeguard via `generateStructured`.

```
SafeguardDecision {
  classification : SafeguardClassification   // obrigatório
  reason         : string                    // breve explicação para logging interno (nunca exposto ao usuário)
}
```

**Validation rules**:
- `classification` deve ser um dos quatro valores do enum (validação Zod antes de usar).
- `reason` é truncado para logging — nunca exposto na resposta ao usuário.
- Em falha de parsing (modelo retornou estrutura inválida), o nó trata como fail-open (`safe`).

---

### SafeguardAuditRecord (estende QueryAuditRecord)

Registro de auditoria para requisições bloqueadas. Persistido apenas em stdout/stderr estruturado (sem banco de dados).

```
SafeguardAuditRecord {
  timestamp      : string (ISO 8601)
  decision       : 'allowed' | 'rejected'
  classification : SafeguardClassification   // presente sempre
  reason         : string                    // motivo da classificação (interno)
  // NOTA: o texto bruto da mensagem do usuário NÃO é registrado (privacidade)
}
```

**Validation rules**:
- `timestamp` gerado automaticamente (`new Date().toISOString()`).
- `decision: 'rejected'` sempre que `classification !== 'safe'`.
- `decision: 'allowed'` quando `classification === 'safe'` (registrado apenas opcionalmente em debug level).
- O campo `question` de `QueryAuditRecord` é omitido intencionalmente (privacidade).

---

### Mudanças no Estado do Grafo (AuroraStateAnnotation)

Nenhum campo novo no `AuroraStateAnnotation`. O safeguard reutiliza campos existentes:

| Campo existente | Uso pelo safeguard |
|---|---|
| `intent` | Definido pelo safeguard como `'injection'` / `'out_of_scope'` em bloqueios; deixado undefined em `safe` |
| `refusalReason` | Populado com `SafeguardDecision.reason` (interno) em bloqueios — não exposto ao usuário |

O `analyticalResponse` já trata `intent !== 'data'` com mensagens de recusa em PT. Nenhuma mudança de schema de estado necessária.

---

## Configuração (config.ts)

Novo bloco `safeguard` no objeto `config`:

```
config.safeguard {
  apiKey         : string   // process.env.OPENROUTER_API_KEY (reutilizado)
  model          : string   // process.env.SAFEGUARD_MODEL ?? 'openai/gpt-oss-safeguard-20b'
  requestTimeoutMs : number // process.env.SAFEGUARD_TIMEOUT_MS ?? 5000
  maxRetries     : 0        // fixo — fail fast, sem retry
}
```
