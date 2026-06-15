<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/005-smart-chart-generation/plan.md` (with `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md` in the same folder). The base feature plan
remains at `specs/001-text-to-sql-base/plan.md`.

Active feature: **005-smart-chart-generation** — persist Vega-Lite chart specs in
conversation history so charts survive page reload and conversation switching; adds
`vega_spec JSONB` column to `conversation_message`, propagates through backend and
frontend API. Previous feature: **004-conversation-sessions** at
`specs/004-conversation-sessions/plan.md`. Base feature: **001-text-to-sql-base** —
conversational Text-to-SQL over WHO neonatal mortality data (indicator A4C49D3 /
WHOSIS_000003).
Stack: Node.js 24.11.1 + TypeScript, LangChain + LangGraph, PostgreSQL (read-only role
for analytics; aurora_app role for conversation state), OpenRouter/OpenAI/Anthropic (LLM),
Vega-Lite (charts), Mantine + React (web UI).
Constitution: `.specify/memory/constitution.md` (v1.1.0) — read-only SQL, mandatory
WHO-estimate attribution, no medical/causal claims, schema/secret protection.
<!-- SPECKIT END -->
