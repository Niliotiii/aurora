# Research: Conversation Sessions

**Feature**: 004-conversation-sessions
**Date**: 2026-06-14

---

## R1 — Persistência das conversas

**Decision**: PostgreSQL — novas tabelas `conversation` e `conversation_message` no banco já existente.

**Rationale**: O banco já está em execução via Docker. Persistência em banco sobrevive a recarregamentos de página E a reinicializações do servidor, diferente de localStorage (browser-only) ou memória (perdida no restart). Não requer nova infraestrutura.

**Alternatives considered**:
- localStorage: browser-only, perdido em outros dispositivos e ao limpar o navegador. Inadequado se o backend for replicado.
- In-memory no servidor: perdido ao reiniciar. Descartado.
- Arquivo JSON local: sem suporte a consultas, sem concorrência. Descartado.

---

## R2 — Role de banco para escrita de conversas

**Decision**: Nova role `aurora_app` com `INSERT/UPDATE/DELETE/SELECT` apenas nas tabelas `conversation` e `conversation_message`. A role `aurora_readonly` continua SELECT-only nas tabelas analíticas (Princípio IV inalterado).

**Rationale**: O Princípio IV refere-se ao acesso ao dado analítico WHO (tabelas `fact_*`, `dim_*`, `indicator`). Dados de estado da aplicação (conversas e mensagens) são diferentes — precisam de escrita. Separar os roles mantém o espírito do Princípio IV.

**Implementation**: `data/seed.ts` cria/atualiza as roles e tabelas. O servidor usa `config.postgresApp` para a connection pool de conversas.

**Alternatives considered**:
- Usar `aurora_readonly` com grant de escrita extra: confunde o propósito, acopla concerns. Descartado.
- Usar `aurora_admin` para conversas: poder excessivo, viola least-privilege. Descartado.

---

## R3 — Como o histórico de conversa flui pelo LangGraph

**Decision**: O endpoint `POST /chat` recebe `conversationId`. O servidor busca as mensagens anteriores do banco, constrói a lista `BaseMessage[]` (alternando `HumanMessage`/`AIMessage`), e a passa como `messages` inicial do `graph.invoke()`. A mensagem nova é adicionada ao fim antes do invoke.

**Rationale**: O `AuroraStateAnnotation` já tem `messages: BaseMessage[]` com `MessagesZodMeta` — o grafo foi projetado para histórico. Zero mudança no grafo. A responsabilidade de carregar/salvar histórico fica no servidor (camada correta).

**After invoke**: O servidor salva a nova mensagem do usuário e a resposta do assistente no banco, associadas ao `conversationId`.

**Alternatives considered**:
- Novo nó LangGraph para buscar histórico: acoplamento desnecessário; o grafo não deve saber sobre persistência. Descartado.
- Passar apenas o resumo da conversa: perde o histórico exato; incompatível com SC-003. Descartado.

---

## R4 — Nomeação automática de conversas

**Decision**: Nome sequencial gerado no servidor: "Conversa 1", "Conversa 2", etc. O número é calculado como `COUNT(*) + 1` no momento da criação.

**Rationale**: Simples, sem depender de geração por LLM, instantâneo. A spec define explicitamente este comportamento.

**Alternatives considered**:
- Nome gerado por LLM baseado na primeira mensagem: latência adicional, custo, falhas possíveis. Descartado para v1.
- UUID como nome: não legível por humanos. Descartado.

---

## R5 — Frontend: componente sidebar

**Decision**: Usar `AppShell.Navbar` do Mantine (já está no projeto como UI library) com `NavLink` para cada conversa. O `AppShell` atual usa só `header` — adicionar `navbar={{ width: 260, breakpoint: 'sm' }}`.

**Rationale**: Mantine já é a UI library mandatada (Constitution). `AppShell.Navbar` é o componente canônico para sidebars. Zero novas dependências.

**Alternatives considered**:
- Drawer/modal para listar conversas: esconde a lista por padrão, piora UX. Descartado.
- UI library nova: viola a Constitution. Descartado.

---

## R6 — Persistência da conversa ativa entre recarregamentos

**Decision**: O frontend armazena o `conversationId` ativo em `sessionStorage` (não localStorage, para não persistir entre abas). Ao carregar, busca `GET /conversations` e restaura a conversa ativa pelo ID salvo.

**Rationale**: SC-004 exige persistência após reload. `sessionStorage` é suficiente para manter a seleção na aba atual sem poluir outras abas.

**Alternatives considered**:
- URL param (`?conversation=<id>`): funciona, mas complica o roteamento (sem React Router). Deixar para v2.
- localStorage: persiste entre abas e sessões; pode confundir usuário. sessionStorage é mais conservador.

---

## R7 — Confirmação de exclusão

**Decision**: Modal de confirmação do Mantine (`modals.openConfirmModal`) antes de deletar. Requisito explícito na US3.

**Rationale**: Evita exclusões acidentais. Mantine tem `@mantine/modals` para isso.

**Alternatives considered**:
- Botão com double-click: não convencional, fácil de acionar por acidente. Descartado.
- Nenhuma confirmação: viola o acceptance scenario 1 da US3. Descartado.
