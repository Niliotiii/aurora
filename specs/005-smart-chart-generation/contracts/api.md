# API Contracts: Smart Chart Generation

**Feature**: 005-smart-chart-generation  
**Date**: 2026-06-14

## Modified Endpoints

### `GET /conversations/:id/messages`

Retorna o histórico de mensagens de uma conversa. **Atualizado** para incluir `vegaSpec`.

**Response (200 OK)**:
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid",
    "role": "user",
    "content": "Qual a taxa de mortalidade neonatal do Brasil ao longo dos anos?",
    "vegaSpec": null,
    "createdAt": "2026-06-14T10:00:00.000Z"
  },
  {
    "id": "uuid",
    "conversationId": "uuid",
    "role": "assistant",
    "content": "A taxa de mortalidade neonatal do Brasil diminuiu de 24,1 por mil nascidos vivos em 1990 para 6,2 em 2021. Esses são dados estimados pela OMS/WHO GHO.",
    "vegaSpec": {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      "title": "Neonatal mortality rate over time (WHO estimates)",
      "mark": { "type": "line", "point": true },
      "data": { "values": [{ "time_year": 1990, "rate_per_1000": 24.1 }, "..."] },
      "encoding": {
        "x": { "field": "time_year", "type": "temporal", "title": "Year" },
        "y": { "field": "rate_per_1000", "type": "quantitative", "title": "Rate per 1,000 live births" }
      },
      "width": "container",
      "height": 280
    },
    "createdAt": "2026-06-14T10:00:01.000Z"
  }
]
```

**Change from current**: Adicionado campo `vegaSpec: object | null` em cada item da resposta.

---

### `POST /chat` (unchanged interface, behavior extended)

O contrato externo permanece inalterado. A mudança é interna: `vegaSpec` gerado em runtime agora também é persistido no banco.

**Response (200 OK)** — sem mudança:
```json
{
  "answer": "string",
  "attribution": "string | null",
  "vegaSpec": "object | null",
  "followUpQuestions": ["string"],
  "query": "string | null"
}
```

## No New Endpoints

Nenhum endpoint novo é necessário para esta feature.
