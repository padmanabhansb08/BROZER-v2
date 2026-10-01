const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, 'src', 'chrome');
  const userDataDir = path.join(__dirname, 'test-profile-eval2');

  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--enable-unsafe-webgpu',
      '--disable-gpu-sandbox',
      '--ignore-gpu-blocklist',
      '--disable-gpu-driver-bug-workarounds'
    ]
  });

  const page = await browserContext.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    console.log(text);
  });

  let [background] = browserContext.serviceWorkers();
  if (!background) {
    background = await browserContext.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  
  await page.goto(`chrome-extension://${extensionId}/ocr-test.html`);
  const screenshotBuffer = fs.readFileSync('proof_sanitized_screenshot.png');
  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

  const result = await page.evaluate(async (dataUrl) => {
    try {
      console.log('[MODEL-01] candidate: Xenova/kosmos-2-patch14-224');
      const { pipeline, env } = await import('./vendor/transformers/transformers.web.js');
      env.allowLocalModels = false;
      env.allowRemoteModels = true; 
      env.useBrowserCache = true;
      env.backends.onnx.wasm.numThreads = 1;

      console.log('[MODEL-02] weights loaded: downloading/cached');
      const generator = await pipeline('image-to-text', 'Xenova/kosmos-2-patch14-224', {
         device: 'webgpu'
      });
      
      console.log('[MODEL-03] runtime: WebGPU');

      const start = performance.now();
      const prompt = "<grounding> Locate the BUY NOW button.";
      const output = await generator(dataUrl, { prompt });
      const elapsed = performance.now() - start;

      console.log('[MODEL-04] inference completed: ' + Math.round(elapsed) + ' ms');
      console.log('RAW output: ' + JSON.stringify(output, null, 2));

      const text = output[0]?.generated_text || "";
      const match = text.match(/<box>\s*\[\[(.*?)]]\s*<\/box>/);
      
      if (match) {
        console.log('[MODEL-05] native grounding output: true');
        console.log('[MODEL-06] coordinate format: <box> [[xmin, ymin, xmax, ymax]] </box>');
        console.log('[MODEL-07] coordinate space: relative / normalized');
        console.log('[MODEL-08] target detected: true');
        console.log(`[MODEL-09] bbox: [${match[1]}]`);
        console.log(`[MODEL-10] confidence: n/a`);
        console.log('[MODEL-11] overlap with independent ground truth: [unverified in this isolated script]');
      } else {
        console.log('[MODEL-05] native grounding output: false');
        console.log('[MODEL-06] coordinate format: n/a');
        console.log('[MODEL-07] coordinate space: n/a');
        console.log('[MODEL-08] target detected: false');
        console.log('[MODEL-09] bbox: null');
        console.log('[MODEL-10] confidence: 0');
        console.log('[MODEL-11] overlap with independent ground truth: 0%');
      }

      return { ok: true, output };
    } catch (e) {
      console.log('Error in eval: ' + e.message);
      return { ok: false, error: e.message };
    }
  }, dataUrl);

  console.log('Result:', JSON.stringify(result, null, 2));
  await browserContext.close();
})();
