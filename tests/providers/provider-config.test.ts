import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertValidProvider } from '../../src/services/llmFactory.ts';

// US2 / FR-006 / SC-003 / contract §3: fail-fast validation of the active provider.
// Messages MUST name the env var but never echo the secret value.

const SECRET = 'sk-super-secret-value-1234567890';

test('unsupported LLM_PROVIDER throws and lists supported values', () => {
  assert.throws(
    () => assertValidProvider('grok', 'key', 'model'),
    /Unsupported LLM_PROVIDER.*openrouter.*openai.*anthropic/s,
  );
});

test('missing API key throws naming the env var, without the secret', () => {
  assert.throws(
    () => assertValidProvider('anthropic', '', 'claude-sonnet-4-6'),
    (err: Error) => {
      assert.match(err.message, /ANTHROPIC_API_KEY/);
      return true;
    },
  );
});

test('missing model throws naming the model env var', () => {
  assert.throws(
    () => assertValidProvider('openai', SECRET, ''),
    (err: Error) => {
      assert.match(err.message, /OPENAI_MODEL/);
      assert.equal(err.message.includes(SECRET), false, 'error must not contain the secret value');
      return true;
    },
  );
});

test('valid selection does not throw', () => {
  assert.doesNotThrow(() => assertValidProvider('openrouter', 'sk-or-x', 'some/model'));
});
