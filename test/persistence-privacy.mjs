import assert from 'node:assert/strict';
import { PrivacyEngine } from '../src/chrome/src/providers/privacy-engine.js';
import { projectTraceRun, projectTraceEventData } from '../src/chrome/src/trace/privacy.js';
import { serializeConversationForSession, sanitizeLoadedConversation } from '../src/chrome/src/agent/conversation-persistence.js';
import { compactRunUiData, compactRunUiSnapshotForPersist } from '../src/chrome/src/run-ui-journal.js';
import { addUserMemoryRecord, looksLikeSensitiveMemoryText, normalizeUserMemoryRecord } from '../src/chrome/src/agent/user-memory.js';
import { saveStagedScreenshot, loadStagedScreenshots } from '../src/chrome/src/ui/staged-screenshot-store.js';
import { SecretStore } from '../src/chrome/src/agent/secret-store.js';

class MockStorageArea {
  constructor() {
    this.store = new Map();
  }
  async get(keys) {
    if (keys == null) {
      const obj = {};
      for (const [k, v] of this.store.entries()) obj[k] = v;
      return obj;
    }
    if (typeof keys === 'string') return { [keys]: this.store.get(keys) };
    if (Array.isArray(keys)) {
      const obj = {};
      for (const k of keys) {
        if (this.store.has(k)) obj[k] = this.store.get(k);
      }
      return obj;
    }
    return {};
  }
  async set(items) {
    for (const [k, v] of Object.entries(items)) {
      this.store.set(k, JSON.parse(JSON.stringify(v)));
    }
  }
  async remove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) this.store.delete(k);
  }
  async getKeys() {
    return Array.from(this.store.keys());
  }
}

async function runTests() {
  console.log('--- Starting Phase 4 Local Persistence & Trace Privacy Test Suite ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ Pass: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  const CANARY = 'PHASE4_CANARY_SECRET_7b91';

  // 1. Trace recorder includeContent: true
  await test('01. Trace recorder includeContent: true sanitizes PII in lossless trace tier', () => {
    const rawData = {
      text: `User email is test.user@example.com and phone is 555-123-4567. Secret: ${CANARY}`,
      userMessage: `My secret key is ${CANARY}`,
    };
    const projected = projectTraceEventData('note', rawData, { includeContent: true });
    assert.ok(projected.text.includes('<EMAIL_1>'));
    assert.ok(!projected.text.includes('test.user@example.com'));
    assert.ok(!projected.text.includes(CANARY));
    assert.ok(!projected.userMessage.includes(CANARY));
  });

  // 2. Trace recorder screenshot persistence
  await test('02. Trace recorder screenshot event persistence', () => {
    const eventData = {
      step: 1,
      caption: `Captured screenshot containing user@company.org and ${CANARY}`,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };
    const projected = projectTraceEventData('screenshot', eventData, { includeContent: false });
    assert.ok(projected.caption.includes('<EMAIL_1>'));
    assert.ok(!projected.caption.includes('user@company.org'));
    assert.ok(!projected.caption.includes(CANARY));
    assert.strictEqual(projected.dataUrl, undefined);
  });

  // 3. Conversation history write boundary sanitization
  await test('03. Conversation history write boundary sanitizes messages array', () => {
    const rawMessages = [
      { role: 'user', content: `Contact me at john@example.com or ${CANARY}` },
      { role: 'assistant', content: `Stored secret was ${CANARY}` },
    ];
    const result = serializeConversationForSession(rawMessages);
    assert.ok(Array.isArray(result.messages));
    assert.ok(result.messages[0].content.includes('<EMAIL_1>'));
    assert.ok(!result.messages[0].content.includes('john@example.com'));
    assert.ok(!result.messages[0].content.includes(CANARY));
    assert.ok(!result.messages[1].content.includes(CANARY));
  });

  // 4. Conversation history legacy read boundary
  await test('04. Conversation history legacy read boundary sanitizes loaded records', () => {
    const legacyRecord = {
      messages: [
        { role: 'user', content: `Legacy record containing secret@domain.com and ${CANARY}` },
      ],
    };
    const sanitized = sanitizeLoadedConversation(legacyRecord);
    assert.ok(sanitized !== null);
    assert.ok(sanitized.messages[0].content.includes('<EMAIL_1>'));
    assert.ok(!sanitized.messages[0].content.includes('secret@domain.com'));
    assert.ok(!sanitized.messages[0].content.includes(CANARY));
  });

  // 5. UI Journal checkpoint write sanitization
  await test('05. UI Journal checkpoint write sanitizes DOM snippets and action state', () => {
    const snapshot = {
      tabId: 1,
      requestId: 'req_1_test',
      finalContent: `Final answer with contact info@company.com and ${CANARY}`,
      events: [
        { seq: 1, type: 'text', data: { content: `DOM text snippet with ${CANARY} and admin@site.com` } },
      ],
    };
    const compacted = compactRunUiSnapshotForPersist(snapshot);
    assert.ok(compacted.finalContent.includes('<EMAIL_1>'));
    assert.ok(!compacted.finalContent.includes(CANARY));
    assert.ok(compacted.events[0].data.content.includes('<EMAIL_1>'));
    assert.ok(!compacted.events[0].data.content.includes(CANARY));
  });

  // 6. User memory credential exclusion
  await test('06. User memory credential exclusion completely excludes passwords & keys', () => {
    assert.strictEqual(looksLikeSensitiveMemoryText(`My password is Password123`), true);
    assert.strictEqual(looksLikeSensitiveMemoryText(`API key: sk-proj-1234567890abcdef12345`), true);
    assert.strictEqual(looksLikeSensitiveMemoryText(`Canary key: ${CANARY}`), true);

    const store = { records: [] };
    const res = addUserMemoryRecord(store, `My password is Secret123`);
    assert.strictEqual(res.record, null);
    assert.strictEqual(res.changed, false);
    assert.strictEqual(res.reason, 'invalid_or_sensitive');
  });

  // 7. User memory contact sanitization / exclusion
  await test('07. User memory raw contact identifier exclusion', () => {
    assert.strictEqual(looksLikeSensitiveMemoryText(`Call me at 555-867-5309`), true);
    assert.strictEqual(looksLikeSensitiveMemoryText(`Email me at user@service.io`), true);
  });

  // 8. Staged screenshot persistence metadata sanitization
  await test('08. Staged screenshot persistence metadata sanitization', async () => {
    const mockStorage = new MockStorageArea();
    const attachment = {
      stagedAttachmentId: 'screenshot-1234567890',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      name: `Screenshot for user@domain.com with ${CANARY}`,
      size: 100,
    };
    const saved = await saveStagedScreenshot(mockStorage, 1, attachment);
    assert.strictEqual(saved, true);
    const loaded = await loadStagedScreenshots(mockStorage, 1);
    assert.strictEqual(loaded.length, 1);
    assert.ok(loaded[0].name.includes('<EMAIL_1>'));
    assert.ok(!loaded[0].name.includes('user@domain.com'));
    assert.ok(!loaded[0].name.includes(CANARY));
  });

  // 9. SecretStore non-persistence assertion
  await test('09. SecretStore non-persistence (0% presence in storage representations)', () => {
    SecretStore.clearSessionSecrets();
    SecretStore.register('<PASSWORD_1>', 'MySuperSecretPassword123', 'PASSWORD');
    assert.strictEqual(SecretStore.has('<PASSWORD_1>'), true);

    // Check JSON serialization
    const jsonStr = JSON.stringify(SecretStore);
    assert.ok(!jsonStr.includes('MySuperSecretPassword123'));
    assert.strictEqual(jsonStr, '"[SecretStore Memory-Only Vault]"');
  });

  // 10. Fail-closed trace write failure
  await test('10. Fail-closed trace write safety on null / malformed data', () => {
    const res = projectTraceEventData('llm_request', null, { includeContent: true });
    assert.strictEqual(res, null);
  });

  // 11. Fail-closed conversation write failure
  await test('11. Fail-closed conversation write safety', () => {
    const result = serializeConversationForSession('invalid_non_array_input');
    assert.ok(Array.isArray(result.messages));
    assert.strictEqual(result.messages.length, 0);
  });

  // 12. Fail-closed UI journal write failure
  await test('12. Fail-closed UI journal write safety', () => {
    const compacted = compactRunUiSnapshotForPersist(null);
    assert.ok(compacted !== null);
    assert.ok(compacted.status === 'running' || compacted.status === 'error');
  });

  // 13. Fail-closed memory write failure
  await test('13. Fail-closed memory write safety', () => {
    const record = normalizeUserMemoryRecord(null);
    assert.strictEqual(record, null);
  });

  // 14. Legacy un-sanitized trace cleanup on read
  await test('14. Legacy un-sanitized trace run projection', () => {
    const run = {
      userMessage: `Legacy run text with admin@domain.org and ${CANARY}`,
      finalContent: `Legacy response with ${CANARY}`,
    };
    const projected = projectTraceRun(run, { includeContent: true });
    assert.ok(projected.userMessage.includes('<EMAIL_1>'));
    assert.ok(!projected.userMessage.includes('admin@domain.org'));
    assert.ok(!projected.userMessage.includes(CANARY));
    assert.ok(!projected.finalContent.includes(CANARY));
  });

  // 15. Console & runtime log exception protection
  await test('15. Exception error strings do not leak raw secret values', () => {
    try {
      throw new Error(`Operation failed for key: ${CANARY}`);
    } catch (err) {
      const sanitizedMessage = PrivacyEngine.sanitizeText(err.message);
      assert.ok(!sanitizedMessage.includes(CANARY));
    }
  });

  // 16. Multimodal content block persistence sanitization
  await test('16. Multimodal [text, image] blocks sanitized before write', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Here is my key: ${CANARY} and mail: secret@corp.com` },
        ],
      },
    ];
    const result = serializeConversationForSession(messages);
    const block = result.messages[0].content[0];
    assert.ok(block.text.includes('<EMAIL_1>'));
    assert.ok(!block.text.includes('secret@corp.com'));
    assert.ok(!block.text.includes(CANARY));
  });

  // 17. Block order preservation in history
  await test('17. Content block sequence order preserved in history', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'First block' },
          { type: 'text', text: 'Second block' },
        ],
      },
    ];
    const result = serializeConversationForSession(messages);
    assert.strictEqual(result.messages[0].content.length, 2);
    assert.strictEqual(result.messages[0].content[0].text, 'First block');
    assert.strictEqual(result.messages[0].content[1].text, 'Second block');
  });

  // 18. Immutability of persisted objects
  await test('18. In-memory original objects remain unmutated during persistence', () => {
    const originalText = `Raw message with secret@test.com and ${CANARY}`;
    const originalMsg = { role: 'user', content: originalText };
    const originalArr = [originalMsg];

    serializeConversationForSession(originalArr);

    assert.strictEqual(originalMsg.content, originalText);
    assert.strictEqual(originalMsg.content.includes(CANARY), true);
  });

  // 19. Multi-session storage isolation
  await test('19. Multi-session storage isolation across tab IDs', async () => {
    const mockStorage = new MockStorageArea();
    const attachment1 = {
      stagedAttachmentId: 'screenshot-1111111111',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      name: 'tab1.png',
      size: 100,
    };
    const attachment2 = {
      stagedAttachmentId: 'screenshot-2222222222',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      name: 'tab2.png',
      size: 100,
    };
    await saveStagedScreenshot(mockStorage, 101, attachment1);
    await saveStagedScreenshot(mockStorage, 202, attachment2);

    const tab1List = await loadStagedScreenshots(mockStorage, 101);
    const tab2List = await loadStagedScreenshots(mockStorage, 202);

    assert.strictEqual(tab1List.length, 1);
    assert.strictEqual(tab1List[0].stagedAttachmentId, 'screenshot-1111111111');
    assert.strictEqual(tab2List.length, 1);
    assert.strictEqual(tab2List[0].stagedAttachmentId, 'screenshot-2222222222');
  });

  // 20. Canary Zero-Leak Assertion across all storage representations
  await test(`20. Canary Zero-Leak Assertion (${CANARY} 0% presence in persisted states)`, async () => {
    const mockStorage = new MockStorageArea();

    // Surface 1: Trace
    const traceProjected = projectTraceEventData('note', { text: `Trace note with ${CANARY}` }, { includeContent: true });
    // Surface 2: Conversation History
    const historySerialized = serializeConversationForSession([{ role: 'user', content: `User message with ${CANARY}` }]);
    // Surface 3: UI Journal
    const journalCompacted = compactRunUiSnapshotForPersist({ finalContent: `Final content with ${CANARY}` });
    // Surface 4: User Memory
    const memoryRecord = normalizeUserMemoryRecord({ text: `User memory containing ${CANARY}` });
    // Surface 5: Staged Screenshot Store
    await saveStagedScreenshot(mockStorage, 999, {
      stagedAttachmentId: 'screenshot-9999999999',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      name: `Screenshot containing ${CANARY}`,
      size: 100,
    });
    const loadedStaged = await loadStagedScreenshots(mockStorage, 999);

    const aggregatedOutputs = JSON.stringify({
      traceProjected,
      historySerialized,
      journalCompacted,
      memoryRecord,
      loadedStaged,
    });

    assert.strictEqual(aggregatedOutputs.includes(CANARY), false, `CRITICAL LEAK: ${CANARY} found in persisted output representation!`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error in Phase 4 test suite:', err);
  process.exit(1);
});
