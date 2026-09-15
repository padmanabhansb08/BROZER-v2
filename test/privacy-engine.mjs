import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrivacyEngine, decorateProviderWithPrivacyEngine } from '../src/chrome/src/providers/privacy-engine.js';

test('PrivacyEngine - Email sanitization', () => {
  const messages = [
    { role: 'user', content: 'Send the report to john@example.com and CC john@example.com' }
  ];
  const sanitized = PrivacyEngine.sanitize(messages);
  assert.equal(sanitized[0].content, 'Send the report to <EMAIL_1> and CC <EMAIL_1>');
});

test('PrivacyEngine - Phone number sanitization', () => {
  const messages = [
    { role: 'user', content: 'Call +91 9876543210 or (123) 456-7890' }
  ];
  const sanitized = PrivacyEngine.sanitize(messages);
  assert.equal(sanitized[0].content, 'Call <PHONE_1> or <PHONE_2>');
});

test('PrivacyEngine - Multiple distinct email values', () => {
  const messages = [
    { role: 'user', content: 'Email john@example.com and alice@example.com' }
  ];
  const sanitized = PrivacyEngine.sanitize(messages);
  assert.equal(sanitized[0].content, 'Email <EMAIL_1> and <EMAIL_2>');
});

test('PrivacyEngine - Tool call JSON arguments sanitization', () => {
  const messages = [
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'type_text',
            arguments: JSON.stringify({ ref_id: 'ref_42', text: 'john@example.com' })
          }
        }
      ]
    }
  ];
  const sanitized = PrivacyEngine.sanitize(messages);
  const parsedArgs = JSON.parse(sanitized[0].tool_calls[0].function.arguments);
  assert.equal(parsedArgs.ref_id, 'ref_42');
  assert.equal(parsedArgs.text, '<EMAIL_1>');
});

test('PrivacyEngine - Tool result message sanitization', () => {
  const messages = [
    {
      role: 'tool',
      tool_call_id: 'call_1',
      content: '<untrusted_page_content>Found user: john@example.com phone: +91 9876543210</untrusted_page_content>'
    }
  ];
  const sanitized = PrivacyEngine.sanitize(messages);
  assert.equal(
    sanitized[0].content,
    '<untrusted_page_content>Found user: <EMAIL_1> phone: <PHONE_1></untrusted_page_content>'
  );
});

test('PrivacyEngine - Multimodal content blocks preservation', async () => {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Inspect this account for john@example.com' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' } }
      ]
    }
  ];
  const sanitized = await PrivacyEngine.sanitize(messages);
  assert.equal(sanitized[0].content[0].text, 'Inspect this account for <EMAIL_1>');
  assert.equal(sanitized[0].content[1].type, 'image_url');
  assert.match(
    sanitized[0].content[1].image_url.url,
    /^data:image\/png;base64,/
  );
});

test('PrivacyEngine - Original message object immutability', () => {
  const original = [
    { role: 'user', content: 'Contact john@example.com' }
  ];
  const originalJson = JSON.stringify(original);
  const sanitized = PrivacyEngine.sanitize(original);

  assert.notStrictEqual(original, sanitized);
  assert.notStrictEqual(original[0], sanitized[0]);
  assert.equal(JSON.stringify(original), originalJson);
  assert.equal(original[0].content, 'Contact john@example.com');
  assert.equal(sanitized[0].content, 'Contact <EMAIL_1>');
});

test('PrivacyEngine - Provider decoration (chat and chatStream)', async () => {
  let receivedChatMessages = null;
  let receivedStreamMessages = null;

  const mockProvider = {
    async chat(messages, options) {
      receivedChatMessages = messages;
      return { content: 'OK' };
    },
    async *chatStream(messages, options) {
      receivedStreamMessages = messages;
      yield { type: 'text', content: 'OK' };
    }
  };

  const decorated = decorateProviderWithPrivacyEngine(mockProvider);

  const rawMessages = [
    { role: 'user', content: 'My key is sk-1234567890abcdef1234 and email is john@example.com' }
  ];

  await decorated.chat(rawMessages);
  assert.ok(receivedChatMessages);
  assert.equal(
    receivedChatMessages[0].content,
    'My key is <API_KEY_1> and email is <EMAIL_1>'
  );

  const chunks = [];
  for await (const chunk of decorated.chatStream(rawMessages)) {
    chunks.push(chunk);
  }

  assert.ok(receivedStreamMessages);
  assert.equal(
    receivedStreamMessages[0].content,
    'My key is <API_KEY_1> and email is <EMAIL_1>'
  );
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].content, 'OK');
});

test('PrivacyEngine - End-to-End Synthetic Payload PII Redaction Audit', async () => {
  const rawPayload = [
    {
      role: 'system',
      content: 'You are an AI assistant. User password: password=SuperSecret123!'
    },
    {
      role: 'user',
      content: 'Please process john@example.com with phone +91 9876543210 using card 4532 0123 4567 8910 and API key sk-proj-1234567890abcdef1234 on URL https://api.example.com/v1?api_key=secret_token_123456'
    },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_99',
          type: 'function',
          function: {
            name: 'set_field',
            arguments: JSON.stringify({ ref_id: 'ref_1', text: 'john@example.com' })
          }
        }
      ]
    },
    {
      role: 'tool',
      tool_call_id: 'call_99',
      content: '<untrusted_page_content>Result: john@example.com confirmed</untrusted_page_content>'
    }
  ];

  let deliveredPayload = null;
  const mockProvider = {
    async chat(messages) {
      deliveredPayload = messages;
      return { content: 'Done' };
    }
  };

  const decorated = decorateProviderWithPrivacyEngine(mockProvider);
  await decorated.chat(rawPayload);

  const deliveredStr = JSON.stringify(deliveredPayload);

  // Assert 0 raw PII occurrences
  assert.equal(deliveredStr.includes('john@example.com'), false, 'Raw email must not exist');
  assert.equal(deliveredStr.includes('+91 9876543210'), false, 'Raw phone must not exist');
  assert.equal(deliveredStr.includes('4532 0123 4567 8910'), false, 'Raw card must not exist');
  assert.equal(deliveredStr.includes('SuperSecret123!'), false, 'Raw password must not exist');
  assert.equal(deliveredStr.includes('sk-proj-1234567890abcdef1234'), false, 'Raw API key must not exist');
  assert.equal(deliveredStr.includes('secret_token_123456'), false, 'Raw secret URL param must not exist');

  // Assert placeholders exist
  assert.equal(deliveredStr.includes('<EMAIL_1>'), true, '<EMAIL_1> placeholder must exist');
  assert.equal(deliveredStr.includes('<PHONE_1>'), true, '<PHONE_1> placeholder must exist');
  assert.equal(deliveredStr.includes('<CARD_1>'), true, '<CARD_1> placeholder must exist');
  assert.equal(deliveredStr.includes('<PASSWORD_1>'), true, '<PASSWORD_1> placeholder must exist');
  assert.equal(deliveredStr.includes('<API_KEY_1>'), true, '<API_KEY_1> placeholder must exist');
  assert.equal(deliveredStr.includes('<SECRET_URL_1>'), true, '<SECRET_URL_1> placeholder must exist');
  assert.equal(deliveredStr.includes('<untrusted_page_content>'), true, 'Untrusted wrapper must be preserved');
});

test('PrivacyEngine - Provider Entry Raw Input Verification (Senior Audit Assertion)', async () => {
  const rawInput = 'my email is padmanabhan@example.com';
  const messages = [{ role: 'user', content: rawInput }];

  let chatEntryPayload = null;
  let streamEntryPayload = null;

  const mockProvider = {
    async chat(messages) {
      chatEntryPayload = messages;
      return { content: 'OK' };
    },
    async *chatStream(messages) {
      streamEntryPayload = messages;
      yield { type: 'text', content: 'OK' };
    }
  };

  const decorated = decorateProviderWithPrivacyEngine(mockProvider);

  // Test chat entry
  await decorated.chat(messages);
  assert.equal(chatEntryPayload[0].content, 'my email is <EMAIL_1>');
  const chatPayloadStr = JSON.stringify(chatEntryPayload);
  assert.equal(chatPayloadStr.includes('padmanabhan@example.com'), false, 'padmanabhan@example.com === 0 occurrences');
  assert.equal(chatPayloadStr.includes('<EMAIL_1>'), true, '<EMAIL_1> >= 1 occurrence');

  // Test chatStream entry
  for await (const chunk of decorated.chatStream(messages)) {}
  assert.equal(streamEntryPayload[0].content, 'my email is <EMAIL_1>');
  const streamPayloadStr = JSON.stringify(streamEntryPayload);
  assert.equal(streamPayloadStr.includes('padmanabhan@example.com'), false, 'padmanabhan@example.com === 0 occurrences');
  assert.equal(streamPayloadStr.includes('<EMAIL_1>'), true, '<EMAIL_1> >= 1 occurrence');
});

test('PrivacyEngine - Provider Decoration Idempotency (Decorated Exactly Once)', () => {
  const mockProvider = {
    async chat(messages) { return { content: 'OK' }; }
  };

  const decorated1 = decorateProviderWithPrivacyEngine(mockProvider);
  const originalChatFn = decorated1.chat;
  assert.equal(decorated1._privacyEngineDecorated, true);

  const decorated2 = decorateProviderWithPrivacyEngine(decorated1);
  assert.strictEqual(decorated2, decorated1);
  assert.strictEqual(decorated2.chat, originalChatFn);
});
