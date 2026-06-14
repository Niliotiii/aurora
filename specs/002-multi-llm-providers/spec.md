# Feature Specification: Multi-Provider LLM Compatibility (Anthropic & OpenAI)

**Feature Branch**: `002-multi-llm-providers`
**Created**: 2026-06-14
**Status**: Draft
**Input**: User description: "Atualmente esta implementada a compatibilidade com OpenRouter, implemente a compatibilidade com a Anthropic e OpenAi"

## User Scenarios & Testing *(mandatory)*

Aurora today reaches its language model exclusively through OpenRouter. This feature
broadens that to let an operator run Aurora directly against **Anthropic** or **OpenAI**
as alternatives to OpenRouter, chosen through configuration, while every existing
behavior and safety guarantee stays identical regardless of the provider in use.

The primary actor is the **operator** (the person deploying/running Aurora). The
**end user** asking questions is unaffected and should not be able to tell which
provider is active.

### User Story 1 - Run Aurora on a chosen provider (Priority: P1)

An operator selects which LLM provider Aurora uses — OpenRouter, Anthropic, or OpenAI —
through configuration, supplies that provider's credential and model, and Aurora serves
questions using that provider for every model-backed step of the pipeline.

**Why this priority**: This is the core of the feature. Without the ability to pick and
run on Anthropic or OpenAI, nothing else has value. It removes the hard dependency on a
single upstream and lets the operator pick the provider that best fits their cost,
reliability, and account constraints.

**Independent Test**: Configure Aurora for Anthropic (then separately for OpenAI), ask a
known question (e.g., neonatal mortality for an available country/year), and confirm a
grounded answer with WHO attribution is returned — using only that provider, with no
code changes.

**Acceptance Scenarios**:

1. **Given** Aurora is configured to use Anthropic with a valid credential and model,
   **When** an end user asks a question answerable from the dataset, **Then** Aurora
   returns a grounded answer with the mandatory WHO attribution.
2. **Given** Aurora is configured to use OpenAI with a valid credential and model,
   **When** an end user asks the same question, **Then** Aurora returns an equivalent
   grounded answer with the mandatory WHO attribution.
3. **Given** no provider is explicitly selected, **When** Aurora starts, **Then** it
   defaults to OpenRouter so existing deployments keep working unchanged.

---

### User Story 2 - Switch providers safely via configuration (Priority: P2)

An operator changes the active provider (and its credential/model) using only
configuration, and Aurora validates that configuration before serving traffic, refusing
to start with a clear message when something required is missing or invalid.

**Why this priority**: Switching must be low-risk and operationally safe. Fast,
fail-loud validation prevents a misconfigured deployment from silently failing on the
first user question and turns provider changes into a routine config edit.

**Independent Test**: Point Aurora at a provider but omit its credential; confirm Aurora
refuses to start (or clearly reports it is not ready) with a message that names the
missing setting without revealing any secret. Then supply the credential and confirm it
starts and answers.

**Acceptance Scenarios**:

1. **Given** the active provider is set but its required credential is absent, **When**
   Aurora starts, **Then** it fails fast with a clear message identifying the missing
   configuration and does not begin serving requests.
2. **Given** a valid provider configuration, **When** the operator changes only the
   configuration to a different supported provider, **Then** Aurora runs on the new
   provider with no code changes.
3. **Given** any startup or configuration error, **When** the message is produced,
   **Then** it never contains API keys, secrets, or connection details.

---

### User Story 3 - Identical guarantees and graceful failure across providers (Priority: P3)

Regardless of the active provider, Aurora upholds every constitutional guarantee, and
when the provider is slow, unavailable, or rate-limited, the end user receives a
safe, Portuguese error message instead of an indefinite wait or a leaked internal error.

**Why this priority**: The provider must be an implementation detail to the end user.
Safety guarantees and resilience cannot regress just because the upstream changed. This
builds on US1/US2 and protects the experience under failure conditions.

**Independent Test**: For each provider, run the existing guardrail scenarios (mutating
SQL blocked, medical request refused, prompt-injection refused, attribution present,
Portuguese output) and confirm identical outcomes; then simulate provider
unavailability/timeout and confirm a safe Portuguese error is returned within a bounded
time.

**Acceptance Scenarios**:

1. **Given** any supported provider is active, **When** an end user sends a
   medical/causal request, a prompt-injection attempt, or a question requiring a
   mutating statement, **Then** Aurora refuses or blocks identically to the OpenRouter
   baseline and discloses no internals.
2. **Given** any supported provider is active and returns data, **When** Aurora answers,
   **Then** the WHO-estimate attribution is present and the answer is in Portuguese.
3. **Given** the active provider stalls or is rate-limited, **When** the configured
   timeout elapses, **Then** the end user receives a safe Portuguese error and the
   request does not hang indefinitely.
4. **Given** any active provider, **When** a single question runs end to end, **Then** all
   model-backed steps use the same configured provider (no step falls back to a different
   one).

---

### Edge Cases

- **Missing credential/model** for the selected provider → fail fast at startup with a
  clear, secret-free message (US2).
- **Invalid or unavailable model identifier** for the selected provider → user receives a
  safe Portuguese error; the underlying provider error is logged but not exposed.
- **Provider rate limit (e.g., quota exhausted)** → safe Portuguese error to the user; no
  leakage of provider account details.
- **Provider stall / network timeout** → bounded by a uniform request timeout so the
  request fails fast rather than hanging.
- **Structured-output differences across providers** (how each returns intent
  classification, SQL, and the final structured answer) → Aurora still obtains usable
  structured results or treats the turn as a safe failure; it never forwards malformed
  model output as a data answer.
- **Unknown/unsupported provider value** in configuration → fail fast with a clear
  message listing supported providers.
- **Partial credentials** (e.g., key present but model absent) → treated the same as a
  missing required setting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow selecting exactly one active LLM provider among
  **OpenRouter**, **Anthropic**, and **OpenAI** through configuration.
- **FR-002**: System MUST use the selected provider for ALL model-backed pipeline steps
  (intent classification, SQL generation, bounded SQL correction, and final response
  generation); no step may silently use a different provider.
- **FR-003**: System MUST accept, per provider, the provider-specific credential and the
  provider-specific model identifier via configuration.
- **FR-004**: System MUST preserve identical behavioral guarantees across all providers:
  read-only SQL enforcement, mandatory WHO-estimate attribution, medical/causal
  refusals, prompt-injection refusals, schema/secret non-disclosure, and
  Portuguese-language responses.
- **FR-005**: System MUST default to OpenRouter when no provider is explicitly selected,
  preserving backward compatibility with existing deployments.
- **FR-006**: System MUST validate the active provider's configuration at startup and
  fail fast with a clear message when a required credential or model is missing,
  malformed, or names an unsupported provider.
- **FR-007**: System MUST NOT expose API keys, provider secrets, or connection details
  in any user-facing response, log entry, or error message.
- **FR-008**: System MUST obtain consistent structured results (intent classification,
  generated SQL, and final structured answer) across providers, accommodating
  provider-specific differences in structured-output behavior; malformed model output
  MUST result in a safe failure, never a fabricated data answer.
- **FR-009**: System MUST apply a uniform request timeout and bounded retry policy across
  all providers so a stalled or failing provider cannot hang a request indefinitely.
- **FR-010**: System MUST return a user-safe error message in Portuguese when the active
  provider is unavailable, rate-limited, errors, or times out, without leaking internals.
- **FR-011**: Switching the active provider (and its credential/model) MUST require only
  configuration changes, with no code changes.
- **FR-012**: Configuration guidance MUST document how to configure each of the three
  supported providers (selection, credential, model).

### Key Entities *(include if feature involves data)*

- **LLM Provider**: An upstream model service Aurora can use — one of OpenRouter,
  Anthropic, or OpenAI. Key attributes: a selection identifier, a credential, and a
  model identifier. Only one is active per deployment.
- **Provider Configuration**: The resolved settings that determine which provider is
  active and the credential/model/timeout/retry values applied to it. It is the single
  point that downstream pipeline steps consult to reach the model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can switch Aurora between OpenRouter, Anthropic, and OpenAI by
  changing configuration only (no code changes) in under 5 minutes.
- **SC-002**: For an identical question and identical guardrail scenarios, all three
  providers produce outcomes that pass the same guardrail checks (attribution present on
  data answers, medical/injection refusals enforced, mutating SQL blocked,
  Portuguese output) — 100% parity on guardrail behaviors.
- **SC-003**: Misconfiguration of the active provider (missing/invalid credential or
  model, or unsupported provider) is detected at startup 100% of the time, before any
  end-user request is served.
- **SC-004**: Zero API keys or secrets appear in any user-facing response, log line, or
  error message across all providers.
- **SC-005**: When the active provider stalls, the end user receives a safe Portuguese
  error within the configured timeout in 100% of stalled calls, with no indefinite hang.
- **SC-006**: Existing OpenRouter deployments continue to work with no configuration
  change after this feature ships (default provider remains OpenRouter).

## Assumptions

- **Single active provider per deployment**: Aurora uses one provider at a time, selected
  by configuration. Simultaneous use of multiple providers and per-request/per-user
  provider routing are out of scope for this feature.
- **No automatic cross-provider failover**: If the active provider fails, Aurora returns a
  safe error; it does not automatically retry the request on a different provider.
- **Guarantees and pipeline unchanged**: The existing staged pipeline and all
  constitutional guarantees are unchanged; this feature only broadens the provider behind
  the existing model-backed steps.
- **Operator-supplied credentials/models**: Operators provide valid credentials and a
  model that supports the structured-output behavior Aurora requires for each provider.
- **Configuration via environment variables**: Provider selection and settings are
  supplied through the existing environment-variable configuration mechanism, consistent
  with the current approach.
- **Constitution alignment**: This feature touches query-generation/response paths, so it
  remains subject to the Constitution's security and transparency gates (read-only
  enforcement, attribution, refusals, non-disclosure).
