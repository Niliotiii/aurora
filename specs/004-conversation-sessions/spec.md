# Feature Specification: Conversation Sessions

**Feature Branch**: `004-conversation-sessions`
**Created**: 2026-06-14
**Status**: Draft
**Input**: User description: "Quero poder ter diferentes conversas e alternar entre elas onde cada uma terá a sua memória individual. Devo conseguir criar novas conversas e apagar conversas existentes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Criar Nova Conversa (Priority: P1)

O usuário quer iniciar uma conversa completamente nova, isolada das anteriores. Ao criar uma nova conversa, ela começa com histórico vazio e não herda contexto de conversas existentes.

**Why this priority**: Sem a capacidade de criar conversas, o restante da feature não existe. É o pré-requisito de todo o fluxo.

**Independent Test**: Pode ser testado criando uma conversa, fazendo uma pergunta, criando outra conversa e verificando que o histórico está vazio e isolado.

**Acceptance Scenarios**:

1. **Given** o usuário está em qualquer conversa, **When** ele clica em "Nova Conversa", **Then** uma nova conversa é criada com histórico vazio e se torna a conversa ativa.
2. **Given** uma nova conversa foi criada, **When** o usuário envia uma mensagem, **Then** a resposta não faz referência a nenhuma conversa anterior.
3. **Given** uma nova conversa foi criada, **When** o usuário olha para a lista de conversas, **Then** a nova conversa aparece com um nome padrão (ex: "Conversa 1", "Conversa 2") e data de criação.

---

### User Story 2 — Alternar Entre Conversas (Priority: P2)

O usuário quer navegar entre conversas existentes para retomar uma discussão anterior. Ao selecionar uma conversa, todo o histórico é restaurado e a próxima mensagem continua de onde parou.

**Why this priority**: É a proposta de valor central da feature — a memória individual por conversa. Depende de US1 para existir.

**Independent Test**: Pode ser testado criando duas conversas com perguntas diferentes, alternando entre elas e verificando que cada uma preserva seu próprio histórico.

**Acceptance Scenarios**:

1. **Given** o usuário tem múltiplas conversas, **When** ele seleciona uma conversa na lista, **Then** o histórico completo daquela conversa é exibido e a conversa fica ativa.
2. **Given** o usuário está em uma conversa e faz perguntas, **When** ele muda para outra conversa e volta, **Then** todas as mensagens anteriores estão preservadas na ordem original.
3. **Given** o usuário alterna para uma conversa diferente, **When** ele envia uma nova mensagem, **Then** o contexto da conversa selecionada é usado (não o de outra conversa).

---

### User Story 3 — Apagar Conversa (Priority: P3)

O usuário quer remover permanentemente uma conversa que não precisa mais. A exclusão remove o histórico completo da conversa.

**Why this priority**: Funcionalidade de manutenção, não bloqueia o uso principal. Pode ser adicionada depois das US1 e US2.

**Independent Test**: Pode ser testado criando uma conversa, apagando-a e verificando que ela não aparece mais na lista.

**Acceptance Scenarios**:

1. **Given** o usuário seleciona uma conversa na lista, **When** ele escolhe "Apagar", **Then** uma confirmação é solicitada antes de excluir.
2. **Given** o usuário confirma a exclusão, **When** a exclusão ocorre, **Then** a conversa desaparece da lista e seu histórico é removido permanentemente.
3. **Given** o usuário apaga a conversa ativa, **When** a exclusão ocorre, **Then** o sistema muda automaticamente para outra conversa existente (ou exibe estado vazio se não houver outras).
4. **Given** o usuário cancela a confirmação de exclusão, **When** ele descarta a ação, **Then** a conversa permanece intacta.

---

### Edge Cases

- O que acontece quando o usuário apaga a única conversa existente? → Sistema exibe estado vazio com convite para criar uma nova.
- O que acontece se o usuário tentar criar muitas conversas? → Nenhum limite imposto na v1; o sistema suporta qualquer quantidade razoável.
- O que acontece se o histórico de uma conversa estiver muito longo? → O histórico completo é preservado; rolagem da lista de mensagens é responsabilidade da UI.
- O que acontece se o usuário renomear uma conversa? → Fora do escopo da v1; o nome padrão é suficiente por enquanto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que o usuário crie novas conversas independentes a qualquer momento.
- **FR-002**: O sistema DEVE manter histórico individual e isolado por conversa — mensagens de uma conversa não afetam outras.
- **FR-003**: O sistema DEVE exibir uma lista das conversas existentes, com nome e data de criação, ordenadas da mais recente para a mais antiga.
- **FR-004**: O usuário DEVE conseguir selecionar qualquer conversa da lista para torná-la ativa e ver seu histórico completo.
- **FR-005**: O sistema DEVE passar o histórico da conversa ativa como contexto ao processar novas mensagens.
- **FR-006**: O usuário DEVE conseguir apagar qualquer conversa existente, com confirmação prévia.
- **FR-007**: Ao apagar a conversa ativa, o sistema DEVE alternar automaticamente para outra conversa ou exibir estado vazio.
- **FR-008**: O sistema DEVE persistir as conversas de forma que sobrevivam ao recarregamento da página.
- **FR-009**: Cada nova conversa DEVE receber um nome padrão sequencial (ex: "Conversa 1", "Conversa 2").

### Key Entities

- **Conversa**: identificador único, nome, data de criação, lista de mensagens.
- **Mensagem**: conteúdo, papel (usuário ou assistente), timestamp, pertence a uma conversa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue criar uma nova conversa e enviar a primeira mensagem em menos de 10 segundos.
- **SC-002**: Ao alternar entre conversas, o histórico correto é exibido em menos de 1 segundo.
- **SC-003**: O histórico de cada conversa é 100% isolado — nenhuma mensagem de uma conversa aparece em outra.
- **SC-004**: Conversas persistem após recarregamento da página em 100% dos casos.
- **SC-005**: A exclusão de uma conversa remove permanentemente seu histórico sem afetar outras conversas.

## Assumptions

- A aplicação é de usuário único (sem autenticação multi-usuário) — as conversas pertencem à sessão local.
- A persistência das conversas é local (navegador ou servidor local), não requer sincronização entre dispositivos na v1.
- O nome das conversas não é editável pelo usuário na v1 — apenas o nome padrão sequencial.
- O limite de conversas simultâneas não é definido na v1 — qualquer quantidade razoável é suportada.
- A interface de listagem de conversas é um painel lateral (sidebar) na UI existente.
