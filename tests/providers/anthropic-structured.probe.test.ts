import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod/v3';

// U1 / T017: verify the structured-output path works on Anthropic BEFORE relying on it in
// the pipeline. If this fails (e.g. providerStrategy is incompatible with ChatAnthropic),
// switch AnthropicService to `withStructuredOutput(schema)` per research R1.
// Skipped unless an Anthropic key is configured.

const skip = !process.env.ANTHROPIC_API_KEY;

test('[anthropic] structured output returns a schema-valid object', { skip }, async () => {
  const { AnthropicService } = await import('../../src/services/anthropicService.ts');
  const schema = z.object({
    country: z.string(),
    year: z.number(),
  });

  const svc = new AnthropicService();
  const result = await svc.generateStructured(
    'Return the requested fields as structured data.',
    'country=Brazil, year=2000',
    schema,
  );

  assert.equal(
    result.success,
    true,
    `expected success, got: ${result.success ? '' : result.error}`,
  );
  assert.doesNotThrow(
    () => schema.parse(result.data),
    'returned data must validate against the schema',
  );
});
