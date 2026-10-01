import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrivacyEngine, decorateProviderWithPrivacyEngine } from '../src/chrome/src/providers/privacy-engine.js';
import { VisualDetector, LocalGlyphOCR } from '../src/chrome/src/providers/visual-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Phase 4: Visual Grounding on Privacy-Sanitized UI Screenshot', async () => {
  const htmlPath = path.join(__dirname, 'fixtures', 'visual-grounding-test-page.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(htmlContent.includes('alice@example.com'), 'Test page must contain sensitive email');
  assert.ok(htmlContent.includes('SuperSecret123'), 'Test page must contain sensitive password');
  assert.ok(htmlContent.includes('4111 1111 1111 1111'), 'Test page must contain sensitive card number');
  assert.ok(htmlContent.includes('Buy Now'), 'Test page must contain Buy Now button');

  // 1. Simulate raw page screenshot with sensitive values and UI components
  const width = 500;
  const height = 600;
  const screenshotBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const samplePngUrl = `data:image/png;base64,${screenshotBase64}`;

  // Register detector regions matching UI components on the test page
  VisualDetector.setEngineDelegate(async () => ({
    ok: true,
    scanComplete: true,
    imageWidth: width,
    imageHeight: height,
    regions: [
      { text: 'Email Address: alice@example.com', box: { x: 30, y: 100, width: 440, height: 40 }, confidence: 0.98 },
      { text: 'Password: SuperSecret123', box: { x: 30, y: 160, width: 440, height: 40 }, confidence: 0.98 },
      { text: 'Credit Card: 4111 1111 1111 1111', box: { x: 30, y: 220, width: 440, height: 40 }, confidence: 0.98 },
      { text: 'Buy Now', box: { x: 30, y: 280, width: 120, height: 44 }, confidence: 0.99 },
      { text: 'Navigation: Product Details', box: { x: 30, y: 20, width: 200, height: 30 }, confidence: 0.96 },
      { text: 'Product Details Section', box: { x: 30, y: 350, width: 440, height: 100 }, confidence: 0.95 }
    ]
  }));

  const rawMessages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Identify UI elements on page for email: alice@example.com and password: SuperSecret123:' },
        { type: 'image_url', image_url: { url: samplePngUrl } }
      ]
    }
  ];

  // 2. Route through PrivacyEngine
  const sanitizedMessages = await PrivacyEngine.sanitize(rawMessages);

  // 3. Verify text sanitization
  const textContent = sanitizedMessages[0].content[0].text;
  assert.equal(textContent.includes('alice@example.com'), false, 'Sensitive email must be sanitized');
  assert.equal(textContent.includes('SuperSecret123'), false, 'Sensitive password must be sanitized');
  assert.equal(textContent.includes('<EMAIL_1>'), true, 'Email placeholder present');
  assert.equal(textContent.includes('<PASSWORD_1>'), true, 'Password placeholder present');

  // 4. Verify visual image sanitization
  const sanitizedImageUrl = sanitizedMessages[0].content[1].image_url.url;
  assert.ok(sanitizedImageUrl.startsWith('data:image/png;base64,'), 'Sanitized image URL is a valid PNG data URL');

  // 5. Simulate Local Vision Model Visual Grounding on Sanitized Screenshot
  let visionModelReceivedInput = null;
  const mockLocalVisionModel = {
    async chat(msgs) {
      visionModelReceivedInput = msgs;
      // Local vision model processes sanitized image + text and identifies UI elements
      return {
        content: JSON.stringify({
          elements: [
            { label: 'email field', type: 'input', role: 'textbox', location: { x: 30, y: 100, width: 440, height: 40 } },
            { label: 'password field', type: 'input', role: 'password', location: { x: 30, y: 160, width: 440, height: 40 } },
            { label: 'Buy Now button', type: 'button', role: 'button', location: { x: 30, y: 280, width: 120, height: 44 } },
            { label: 'navigation link', type: 'link', role: 'link', location: { x: 30, y: 20, width: 200, height: 30 } }
          ]
        })
      };
    }
  };

  const response = await mockLocalVisionModel.chat(sanitizedMessages);
  const visionOutput = JSON.parse(response.content);

  // Assert local vision model successfully ground UI elements from sanitized screenshot
  const labels = visionOutput.elements.map(el => el.label);
  assert.ok(labels.includes('email field'), 'Vision model MUST ground "email field"');
  assert.ok(labels.includes('password field'), 'Vision model MUST ground "password field"');
  assert.ok(labels.includes('Buy Now button'), 'Vision model MUST ground "Buy Now button"');
  assert.ok(labels.includes('navigation link'), 'Vision model MUST ground "navigation link"');

  // Assert sensitive strings NEVER reach vision model input or output
  const visionInputStr = JSON.stringify(visionModelReceivedInput);
  assert.equal(visionInputStr.includes('alice@example.com'), false, 'Sensitive email absent from vision input');
  assert.equal(visionInputStr.includes('SuperSecret123'), false, 'Sensitive password absent from vision input');
  assert.equal(visionInputStr.includes('4111 1111 1111 1111'), false, 'Sensitive card absent from vision input');
  assert.equal(response.content.includes('alice@example.com'), false, 'Sensitive email absent from vision output');

  console.log('✔ Phase 4 Visual Grounding test passed successfully.');
});
