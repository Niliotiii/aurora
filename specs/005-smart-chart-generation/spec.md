# Feature Specification: Smart Chart Generation

**Feature Branch**: `005-smart-chart-generation`  
**Created**: 2026-06-14  
**Status**: Draft  
**Input**: User description: "Gostaria que inteligentemente ao fazer uma pergunta fosse avaliado se dá monstar um gráfico para responder e se caso sim, gerasse o gráfico na conversa"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resposta Automática com Gráfico (Priority: P1)

O usuário faz uma pergunta sobre dados (ex: "Qual a mortalidade neonatal do Brasil ao longo dos anos?") e o sistema detecta automaticamente que a resposta se beneficia de uma visualização. Um gráfico é gerado e exibido na conversa junto com a resposta textual, sem necessidade de o usuário solicitar explicitamente.

**Why this priority**: É o núcleo da feature — sem detecção automática e geração de gráfico, a feature não existe.

**Independent Test**: Pode ser testado completamente ao enviar uma pergunta sobre séries temporais ou comparações de países e verificar se o gráfico aparece na resposta, sem qualquer configuração adicional.

**Acceptance Scenarios**:

1. **Given** o usuário está em uma conversa ativa, **When** faz uma pergunta cujos dados retornados contêm série temporal ou comparação entre grupos, **Then** o sistema exibe um gráfico Vega-Lite renderizado inline abaixo da resposta textual com atribuição WHO.
2. **Given** o usuário faz uma pergunta cujo resultado é um único valor escalar ou texto sem dados comparáveis, **When** o sistema avalia a resposta, **Then** nenhum gráfico é gerado e apenas a resposta textual é exibida.
3. **Given** o gráfico é gerado, **When** o usuário visualiza a resposta, **Then** o gráfico inclui título, eixos rotulados e a atribuição "Dados: estimativas OMS/WHO GHO".

---

### User Story 2 - Múltiplos Tipos de Gráfico Contextuais (Priority: P2)

O sistema escolhe o tipo de gráfico mais adequado ao dado retornado: linha para séries temporais, barras para comparações categóricas, entre outros, sem intervenção do usuário.

**Why this priority**: Gráfico errado para os dados (ex: barras para série temporal longa) prejudica a clareza — o tipo de visualização deve ser contextual.

**Independent Test**: Pode ser testado independentemente enviando perguntas de diferentes tipos (série temporal vs. comparação por país) e verificando o tipo de gráfico gerado em cada caso.

**Acceptance Scenarios**:

1. **Given** a resposta contém dados de um indicador ao longo de múltiplos anos, **When** o gráfico é gerado, **Then** o tipo é linha (line chart).
2. **Given** a resposta contém comparação de um indicador entre múltiplos países para um único período, **When** o gráfico é gerado, **Then** o tipo é barras (bar chart).
3. **Given** os dados não se enquadram em padrões reconhecíveis, **When** o sistema avalia, **Then** usa barras como tipo padrão.

---

### User Story 3 - Gráfico Permanece no Histórico da Conversa (Priority: P3)

O gráfico gerado permanece visível no histórico da conversa quando o usuário rola para cima ou retorna à conversa em uma sessão futura.

**Why this priority**: Sem persistência visual, o valor da feature é reduzido a gráficos efêmeros — o histórico deve preservar o contexto visual.

**Independent Test**: Pode ser testado ao recarregar a página ou navegar entre conversas e verificar se o gráfico ainda aparece na mensagem correspondente.

**Acceptance Scenarios**:

1. **Given** um gráfico foi gerado em uma resposta anterior, **When** o usuário rola para cima no histórico, **Then** o gráfico renderiza corretamente.
2. **Given** o usuário fecha e reabre a mesma conversa, **When** o histórico carrega, **Then** as mensagens com gráficos os exibem corretamente.

---

### Edge Cases

- O que acontece quando a query SQL retorna 0 ou 1 linha de dados — gráfico não deve ser gerado.
- O que acontece quando os dados têm mais de 50 séries/países — gráfico deve limitar ou agrupar para manter legibilidade.
- O que acontece quando o LLM classifica erroneamente dados não-visualizáveis como visualizáveis — sistema deve ter fallback gracioso sem erros visíveis ao usuário.
- O que acontece se a geração do gráfico falhar — a resposta textual deve ser exibida mesmo sem o gráfico, com mensagem discreta de indisponibilidade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE avaliar automaticamente cada resposta gerada para determinar se os dados retornados podem ser representados como gráfico.
- **FR-002**: O sistema DEVE gerar um gráfico inline na conversa quando a avaliação indicar que a visualização agrega valor à resposta.
- **FR-003**: O sistema DEVE escolher o tipo de gráfico mais adequado aos dados (linha para séries temporais, barras para comparações categóricas).
- **FR-004**: O gráfico DEVE incluir título descritivo, eixos rotulados e atribuição às estimativas WHO.
- **FR-005**: O sistema DEVE exibir apenas a resposta textual quando os dados não se prestam à visualização (ex: resposta escalar, texto livre, dados insuficientes).
- **FR-006**: O gráfico DEVE ser persistido no histórico da conversa e renderizado corretamente em sessões futuras.
- **FR-007**: Falhas na geração do gráfico NÃO DEVEM bloquear a exibição da resposta textual.
- **FR-008**: O sistema DEVE funcionar dentro do fluxo de conversa existente, sem exigir ação adicional do usuário para solicitar o gráfico.

### Key Entities

- **ChartSpec**: Especificação do gráfico a ser renderizado (tipo, dados, eixos, título, atribuição); parte da resposta do agente.
- **VisualizationDecision**: Resultado da avaliação inteligente — indica se um gráfico deve ser gerado e qual tipo.
- **ConversationMessage**: Mensagem da conversa que pode conter tanto texto quanto uma ChartSpec opcional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Perguntas sobre séries temporais ou comparações entre grupos geram gráfico automaticamente em 100% dos casos onde dados suficientes estão disponíveis (≥ 2 pontos de dados).
- **SC-002**: Perguntas com resposta escalar ou textual não geram gráfico em 100% dos casos.
- **SC-003**: O tipo de gráfico correto (linha vs. barra) é selecionado em ≥ 90% das respostas com dados visualizáveis.
- **SC-004**: Falhas na geração do gráfico não impedem a exibição da resposta textual — disponibilidade da resposta textual mantida em 100%.
- **SC-005**: Gráficos gerados renderizam corretamente no histórico da conversa sem ação adicional do usuário.

## Assumptions

- O sistema já possui capacidade de gerar e renderizar gráficos Vega-Lite (feature base 001).
- A avaliação de visualizabilidade é feita pelo LLM como parte do pipeline de geração de resposta, não como etapa separada.
- Os dados para geração do gráfico são sempre derivados da query SQL executada — nenhuma fonte externa de dados é utilizada.
- O tipo de gráfico é determinado automaticamente; não há interface para o usuário personalizar o gráfico nesta versão.
- A atribuição às estimativas WHO é parte obrigatória do gráfico, conforme Princípio III da Constituição.
- Suporte inicial para dois tipos de gráfico: linha (série temporal) e barras (comparação categórica).
