<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/003-input-safeguard/plan.md` (with `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md` in the same folder). The base feature plan
remains at `specs/001-text-to-sql-base/plan.md`.

Active feature: **003-input-safeguard** — dedicated LLM-based pre-pipeline guard
(model `openai/gpt-oss-safeguard-20b` via OpenRouter) that classifies every incoming
message as safe/injection/out_of_scope/malicious before the analytical pipeline runs,
enforcing Constitution Principle V. Previous feature: **002-multi-llm-providers** at
`specs/002-multi-llm-providers/plan.md`. Base feature: **001-text-to-sql-base** —
conversational Text-to-SQL over WHO neonatal mortality data (indicator A4C49D3 / WHOSIS_000003).
Stack: Node.js 24.11.1 + TypeScript, LangChain + LangGraph, PostgreSQL (read-only role),
OpenRouter/OpenAI/Anthropic (LLM), Vega-Lite (charts); structure mirrors `./repo-exemplo`.
Constitution: `.specify/memory/constitution.md` (v1.1.0) — read-only SQL, mandatory
WHO-estimate attribution, no medical/causal claims, schema/secret protection.
<!-- SPECKIT END -->
