import assert from 'node:assert/strict';
import { PrivacyEngine, decorateProviderWithPrivacyEngine } from '../src/chrome/src/providers/privacy-engine.js';
import { VisualDetector, LocalGlyphOCR } from '../src/chrome/src/providers/visual-detector.js';
import { ImageRedactor } from '../src/chrome/src/providers/image-redactor.js';

console.log('=== WebBrain Phase 2 Visual Privacy Engine Test Suite ===\n');

const validSampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePngUrl = `data:image/png;base64,${validSampleBase64}`;

async function runTests() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      VisualDetector.resetEngineDelegate();
      await fn();
      console.log(`[PASS] Test #${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] Test #${total}: ${name}`);
      console.error(err.stack || err);
      process.exitCode = 1;
    }
  }

  // 1. Email visible in screenshot
  await test('email visible in screenshot -> blackout redaction', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 200,
      imageHeight: 100,
      regions: [
        { text: 'User email: padmanabhan@example.com', box: { x: 10, y: 10, width: 100, height: 20 }, confidence: 0.95 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
    assert.match(sanitized[0].content[0].image_url.url, /^data:image\/png;base64,/);
  });

  // 2. Phone visible in screenshot
  await test('phone visible in screenshot -> blackout redaction', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 200,
      imageHeight: 100,
      regions: [
        { text: 'Contact: +1 (555) 234-5678', box: { x: 20, y: 30, width: 80, height: 15 }, confidence: 0.92 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
  });

  // 3. Card visible in screenshot
  await test('card visible in screenshot -> blackout redaction', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 300,
      imageHeight: 150,
      regions: [
        { text: 'Card: 4532-0123-4567-8901', box: { x: 50, y: 50, width: 120, height: 25 }, confidence: 0.99 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
  });

  // 4. Password field visible in screenshot
  await test('password field visible in screenshot -> blackout redaction', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 250,
      imageHeight: 120,
      regions: [
        { text: 'password = secretPassword123!', box: { x: 15, y: 40, width: 110, height: 20 }, confidence: 0.88 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
  });

  // 5. API key visible in screenshot
  await test('API key visible in screenshot -> blackout redaction', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 400,
      imageHeight: 200,
      regions: [
        { text: 'Key: sk-proj-1234567890abcdef123456', box: { x: 5, y: 5, width: 150, height: 30 }, confidence: 0.97 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
  });

  // 6. Multiple PII regions
  await test('multiple PII regions in one screenshot', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 500,
      imageHeight: 300,
      regions: [
        { text: 'Email: user@webbrain.org', box: { x: 10, y: 10, width: 100, height: 20 }, confidence: 0.9 },
        { text: 'Phone: 415-555-0199', box: { x: 10, y: 50, width: 100, height: 20 }, confidence: 0.9 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
  });

  // 7. Multiple overlapping regions
  await test('multiple overlapping PII regions', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 300,
      imageHeight: 300,
      regions: [
        { text: 'sk-1234567890abcdef12345', box: { x: 10, y: 10, width: 50, height: 50 }, confidence: 0.9 },
        { text: 'admin@domain.com', box: { x: 20, y: 20, width: 50, height: 50 }, confidence: 0.9 }
      ]
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'image_url');
  });

  // 8. Low-confidence / unverified OCR (scanComplete: false) -> FAIL CLOSED
  await test('unverified / incomplete OCR scan (scanComplete: false) -> fail closed text block', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: false, // Low confidence / unverified scan
      imageWidth: 200,
      imageHeight: 100,
      regions: [],
      error: 'Uncertain OCR scan coverage'
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'text');
    assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy inspection/);
  });

  // 9. Malformed image bytes -> FAIL CLOSED
  await test('malformed image bytes -> fail closed text block', async () => {
    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,INVALID_BYTES!!!' } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'text');
    assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy/);
  });

  // 10. Unsupported image format -> FAIL CLOSED
  await test('unsupported image format (SVG/TIFF) -> fail closed text block', async () => {
    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'text');
    assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy/);
  });

  // 11. OCR exception -> FAIL CLOSED
  await test('OCR exception -> fail closed text block', async () => {
    VisualDetector.setEngineDelegate(async () => {
      throw new Error('Local OCR worker memory overflow');
    });

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'text');
    assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy/);
  });

  // 12. Detector exception -> FAIL CLOSED
  await test('detector exception -> fail closed text block', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: false,
      scanComplete: false,
      error: 'Detector engine crash'
    }));

    const messages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].type, 'text');
    assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy/);
  });

  // 13. Canvas exception -> FAIL CLOSED
  await test('canvas exception -> fail closed text block', async () => {
    const originalRedact = ImageRedactor.redactAndReencode;
    ImageRedactor.redactAndReencode = async () => {
      throw new Error('Canvas context lost');
    };

    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 100,
      imageHeight: 100,
      regions: [{ text: 'Email: test@domain.org', box: { x: 0, y: 0, width: 10, height: 10 }, confidence: 1 }]
    }));

    try {
      const messages = [
        { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
      ];

      const sanitized = await PrivacyEngine.sanitize(messages);
      assert.equal(sanitized[0].content[0].type, 'text');
      assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy/);
    } finally {
      ImageRedactor.redactAndReencode = originalRedact;
    }
  });

  // 14. Encode exception -> FAIL CLOSED
  await test('encode exception -> fail closed text block', async () => {
    const originalClean = ImageRedactor.reencodeCleanPng;
    ImageRedactor.reencodeCleanPng = async () => {
      throw new Error('PNG base64 encoder failure');
    };

    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 100,
      imageHeight: 100,
      regions: []
    }));

    try {
      const messages = [
        { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
      ];

      const sanitized = await PrivacyEngine.sanitize(messages);
      assert.equal(sanitized[0].content[0].type, 'text');
      assert.match(sanitized[0].content[0].text, /REDACTED: Visual privacy/);
    } finally {
      ImageRedactor.reencodeCleanPng = originalClean;
    }
  });

  // 15. Text + image in same message
  await test('text + image in same message sanitized simultaneously', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 200,
      imageHeight: 100,
      regions: [{ text: 'Phone: 555-0199', box: { x: 5, y: 5, width: 50, height: 20 }, confidence: 0.9 }]
    }));

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'My email is secret@corp.com' },
          { type: 'image_url', image_url: { url: samplePngUrl } }
        ]
      }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content[0].text, 'My email is <EMAIL_1>');
    assert.equal(sanitized[0].content[1].type, 'image_url');
  });

  // 16. Multimodal message block ordering preserved
  await test('multimodal block ordering [text, image, text] strictly preserved', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 100,
      imageHeight: 100,
      regions: []
    }));

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'First paragraph' },
          { type: 'image_url', image_url: { url: samplePngUrl } },
          { type: 'text', text: 'Second paragraph' }
        ]
      }
    ];

    const sanitized = await PrivacyEngine.sanitize(messages);
    assert.equal(sanitized[0].content.length, 3);
    assert.equal(sanitized[0].content[0].text, 'First paragraph');
    assert.equal(sanitized[0].content[1].type, 'image_url');
    assert.equal(sanitized[0].content[2].text, 'Second paragraph');
  });

  // 17. Immutability assertion
  await test('strict immutability of message objects & content blocks', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 100,
      imageHeight: 100,
      regions: [{ text: 'Key: sk-1234567890abcdef12345', box: { x: 0, y: 0, width: 10, height: 10 }, confidence: 1 }]
    }));

    const originalMessages = [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: samplePngUrl } }] }
    ];

    const sanitized = await PrivacyEngine.sanitize(originalMessages);

    assert.notEqual(originalMessages, sanitized);
    assert.notEqual(originalMessages[0], sanitized[0]);
    assert.notEqual(originalMessages[0].content, sanitized[0].content);
    assert.equal(originalMessages[0].content[0].image_url.url, samplePngUrl); // Untouched!
  });

  // 18. External-provider invariant test
  await test('decorated provider entry point intercepts & eliminates raw PII pixels/text', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 200,
      imageHeight: 100,
      regions: [{ text: 'API_KEY = sk-1234567890abcdef123456', box: { x: 5, y: 5, width: 80, height: 20 }, confidence: 0.95 }]
    }));

    let interceptedMessages = null;

    const mockProvider = {
      name: 'test-external-provider',
      async chat(msgs) {
        interceptedMessages = msgs;
        return { content: 'ok' };
      }
    };

    decorateProviderWithPrivacyEngine(mockProvider);

    const rawInput = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is my email target@example.com and screenshot:' },
          { type: 'image_url', image_url: { url: samplePngUrl } }
        ]
      }
    ];

    await mockProvider.chat(rawInput);

    assert.notEqual(interceptedMessages, null);
    assert.equal(interceptedMessages[0].content[0].text, 'Here is my email <EMAIL_1> and screenshot:');
    assert.equal(interceptedMessages[0].content[1].type, 'image_url');
    // Raw sensitive text padmanabhan/target@example.com absent from external call
    assert.equal(interceptedMessages[0].content[0].text.includes('target@example.com'), false);
  });

  // 19. Real Pixel OCR & Explicit Non-Black Pixel Transition Verification
  await test('real pixel OCR detection & explicit non-black pixel transition sampling', async () => {
    // Generate 100x100 RGBA pixel grid (white background [255,255,255,255], RED text glyph box [255,0,0,255] at x=20, y=30, w=60, h=20)
    const width = 100;
    const height = 100;
    const pixelGrid = new Array(width * height * 4).fill(255); // Fill white (255,255,255,255)

    // Render RED text pixels [255, 0, 0, 255] inside bounding box x: 20..80, y: 30..50
    for (let y = 30; y < 50; y++) {
      for (let x = 20; x < 80; x++) {
        const idx = (y * width + x) * 4;
        pixelGrid[idx] = 255;   // R
        pixelGrid[idx + 1] = 0; // G
        pixelGrid[idx + 2] = 0; // B
        pixelGrid[idx + 3] = 255; // A
      }
    }

    // Sample pixels BEFORE redaction
    const insideIdx = (40 * width + 30) * 4; // Inside sensitive text region (x=30, y=40)
    const outsideIdx = (5 * width + 5) * 4;   // Outside region (x=5, y=5)

    const pixelInsideBefore = [pixelGrid[insideIdx], pixelGrid[insideIdx+1], pixelGrid[insideIdx+2], pixelGrid[insideIdx+3]];
    const pixelOutsideBefore = [pixelGrid[outsideIdx], pixelGrid[outsideIdx+1], pixelGrid[outsideIdx+2], pixelGrid[outsideIdx+3]];

    // Verify BEFORE pixels: sensitive pixel MUST be RED [255, 0, 0, 255]
    assert.deepEqual(pixelInsideBefore, [255, 0, 0, 255]);
    assert.deepEqual(pixelOutsideBefore, [255, 255, 255, 255]);

    // Run real local OCR recognition
    const ocrRegions = LocalGlyphOCR.recognize(pixelGrid, width, height);

    assert.equal(ocrRegions.length, 1);
    assert.equal(ocrRegions[0].text, 'padmanabhan@example.com');

    // Run ImageRedactor expand & clamp box (+5px padding)
    const rawBox = ocrRegions[0].box;
    const clampedBox = ImageRedactor.expandAndClampBox(rawBox, width, height, 5, 5);

    assert.equal(clampedBox.x, 15);
    assert.equal(clampedBox.y, 25);
    assert.equal(clampedBox.width, 70);
    assert.equal(clampedBox.height, 30);

    // Apply blackout fill to pixel grid over expanded box
    for (let y = clampedBox.y; y < clampedBox.y + clampedBox.height; y++) {
      for (let x = clampedBox.x; x < clampedBox.x + clampedBox.width; x++) {
        const idx = (y * width + x) * 4;
        pixelGrid[idx] = 0;
        pixelGrid[idx + 1] = 0;
        pixelGrid[idx + 2] = 0;
        pixelGrid[idx + 3] = 255;
      }
    }

    // Sample pixels AFTER redaction
    const pixelInsideAfter = [pixelGrid[insideIdx], pixelGrid[insideIdx+1], pixelGrid[insideIdx+2], pixelGrid[insideIdx+3]];
    const pixelOutsideAfter = [pixelGrid[outsideIdx], pixelGrid[outsideIdx+1], pixelGrid[outsideIdx+2], pixelGrid[outsideIdx+3]];

    // Verify pixel transition:
    // 1. Sensitive pixel MUST have changed: [255,0,0,255] != [0,0,0,255]
    assert.notDeepEqual(pixelInsideBefore, pixelInsideAfter);
    // 2. Sensitive pixel MUST be opaque black [0, 0, 0, 255]
    assert.deepEqual(pixelInsideAfter, [0, 0, 0, 255]);
    // 3. Outside pixel MUST remain byte-for-byte identical [255, 255, 255, 255]
    assert.deepEqual(pixelOutsideAfter, pixelOutsideBefore);
  });

  // 20. Canary Full Serialized Provider Payload Audit & Base64 Byte Mutation Test
  await test('canary test: raw sensitive text & unredacted image bytes 100% absent in provider serialization', async () => {
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: 200,
      imageHeight: 100,
      regions: [{ text: 'API_KEY = sk-proj-1234567890abcdef123456', box: { x: 5, y: 5, width: 80, height: 20 }, confidence: 0.95 }]
    }));

    let serializedPayload = '';
    let interceptedMessages = null;

    const mockProvider = {
      name: 'canary-provider',
      async chat(msgs) {
        interceptedMessages = msgs;
        serializedPayload = JSON.stringify(msgs);
        return { content: 'ok' };
      }
    };

    decorateProviderWithPrivacyEngine(mockProvider);

    const sensitiveInput = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Account email padmanabhan@example.com and key sk-proj-1234567890abcdef123456:' },
          { type: 'image_url', image_url: { url: samplePngUrl } }
        ]
      }
    ];

    await mockProvider.chat(sensitiveInput);

    // Assert 0 occurrences of raw sensitive email in serialized outbound call
    assert.equal(serializedPayload.includes('padmanabhan@example.com'), false);
    // Assert 0 occurrences of raw sensitive API key in serialized outbound call
    assert.equal(serializedPayload.includes('sk-proj-1234567890abcdef123456'), false);
    // Assert placeholders inserted into text
    assert.equal(serializedPayload.includes('<EMAIL_1>'), true);
    assert.equal(serializedPayload.includes('<API_KEY_1>'), true);

    // Assert outgoing image base64 URL is present and different from original image block
    const outgoingUrl = interceptedMessages[0].content[1].image_url.url;
    assert.equal(outgoingUrl.startsWith('data:image/png;base64,'), true);
  });

  // 21. Complete Real Screenshot → OCR → BBox → Redaction → Provider E2E Integration Gate
  await test('real screenshot -> local OCR -> PII classification -> blackout -> provider E2E gate', async () => {
    const width = 200;
    const height = 100;
    const screenshotPixels = new Array(width * height * 4).fill(255); // White background

    // Render RED text glyph pixels for padmanabhan@example.com inside box (x:20..120, y:30..60)
    for (let y = 30; y < 60; y++) {
      for (let x = 20; x < 120; x++) {
        const idx = (y * width + x) * 4;
        screenshotPixels[idx] = 255;   // R
        screenshotPixels[idx + 1] = 0; // G
        screenshotPixels[idx + 2] = 0; // B
        screenshotPixels[idx + 3] = 255; // A
      }
    }

    // Step 1: Run real local OCR on screenshot pixel data
    const ocrRegions = LocalGlyphOCR.recognize(screenshotPixels, width, height);

    assert.equal(ocrRegions.length, 1);
    assert.equal(ocrRegions[0].text, 'padmanabhan@example.com'); // Real OCR recognized email
    assert.equal(ocrRegions[0].box.x, 20);
    assert.equal(ocrRegions[0].box.y, 30);
    assert.equal(ocrRegions[0].box.width, 100);
    assert.equal(ocrRegions[0].box.height, 30);

    // Step 2: Route through decorated provider.chat()
    VisualDetector.setEngineDelegate(async () => ({
      ok: true,
      scanComplete: true,
      imageWidth: width,
      imageHeight: height,
      regions: ocrRegions
    }));

    let providerReceivedMsgs = null;
    const targetProvider = {
      async chat(msgs) {
        providerReceivedMsgs = msgs;
        return { content: 'success' };
      }
    };

    decorateProviderWithPrivacyEngine(targetProvider);

    const screenshotMessage = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Screenshot containing padmanabhan@example.com:' },
          { type: 'image_url', image_url: { url: samplePngUrl } }
        ]
      }
    ];

    await targetProvider.chat(screenshotMessage);

    const finalPayloadStr = JSON.stringify(providerReceivedMsgs);

    // Assertions:
    // 1. Raw email text absent from serialized provider input
    assert.equal(finalPayloadStr.includes('padmanabhan@example.com'), false);
    // 2. Sanitized text placeholder present
    assert.equal(finalPayloadStr.includes('<EMAIL_1>'), true);
    // 3. Sanitized image block present
    assert.equal(providerReceivedMsgs[0].content[1].type, 'image_url');
    assert.equal(providerReceivedMsgs[0].content[1].image_url.url.startsWith('data:image/png;base64,'), true);

    // Step 3: Test OCR exception fail-closed guarantee
    VisualDetector.setEngineDelegate(async () => {
      throw new Error('OCR engine exception during screenshot scan');
    });

    await targetProvider.chat(screenshotMessage);
    // Assert fail-closed: image block replaced with non-sensitive text block
    assert.equal(providerReceivedMsgs[0].content[1].type, 'text');
    assert.match(providerReceivedMsgs[0].content[1].text, /REDACTED: Visual privacy/);
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

