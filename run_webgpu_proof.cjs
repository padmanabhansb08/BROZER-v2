const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, 'src', 'chrome');
  const userDataDir = path.join(__dirname, 'test-profile-proof');

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

  let [background] = browserContext.serviceWorkers();
  if (!background) {
    background = await browserContext.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  background.on('console', msg => console.log('BACKGROUND:', msg.text()));

  browserContext.on('page', async (p) => {
    p.on('console', msg => console.log('OFFSCREEN:', msg.text()));
  });

  const page = await browserContext.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[')) console.log(text);
    else if (text.includes('GPU')) console.log(text);
  });

  await page.goto(`chrome-extension://${extensionId}/ocr-test.html`);
  const screenshotBuffer = fs.readFileSync('proof_sanitized_screenshot.png');
  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

  await page.goto(`chrome-extension://${extensionId}/test-vp.html`);
  await page.waitForFunction(() => window.vpReady === true);

  const result = await page.evaluate(async (dataUrl) => {
    try {
      console.log('[GPU-01] WebGPU available: ' + ('gpu' in navigator));
      
      const { WebGPUVisionProvider } = await import('./src/providers/webgpu.js');
      const provider = new WebGPUVisionProvider();
      
      console.log('Checking cache...');
      const { hasWebgpuVisionCache } = await import('./src/providers/webgpu.js');
      let cached = await hasWebgpuVisionCache(provider.model);
      if (!cached) {
         console.log('Model not cached. Downloading...');
         await chrome.storage.local.set({
           'webgpuVisionEnabled': true,
           'webgpuVisionConsentVersion': 2,
           'webgpuVisionDownloadState': { modelId: provider.model, status: 'downloading', progress: 0 }
         });
         await provider.preload();
         
         console.log('Waiting for model to download...');
         while (true) {
           const state = await chrome.storage.local.get('webgpuVisionDownloadState');
           const progress = state.webgpuVisionDownloadState?.progress || 0;
           console.log('Download progress: ' + progress.toFixed(1) + '%');
           if (state.webgpuVisionDownloadState?.status === 'ready') break;
           await new Promise(r => setTimeout(r, 2000));
         }
         
         console.log('[GPU-02] webbrain-vl-2-450M-onnx model downloaded');
      } else {
         console.log('[GPU-02] webbrain-vl-2-450M-onnx model downloaded');
      }
      console.log('[GPU-03] Worker instantiated');

      
      await chrome.storage.local.set({
        'webgpuVisionEnabled': true,
        'webgpuVisionConsentVersion': 2,
        'webgpuVisionDownloadState': { modelId: provider.model, status: 'ready' }
      });

      console.log('[GPU-04] Model inference started');

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: 'Where is the BUY NOW button?' }
          ]
        }
      ];

      const start = performance.now();
      const response = await provider.chat(messages, { visionProbe: false });
      const elapsed = performance.now() - start;

      console.log('[GPU-05] Model inference completed');
      console.log('[GPU-06] inference output received');
      console.log('Latency: ' + Math.round(elapsed) + ' ms');
      
      return { ok: true, response };
    } catch (e) {
      return { ok: false, error: e.message, stack: e.stack };
    }
  }, dataUrl);

  console.log('Result:', JSON.stringify(result, null, 2));

  await browserContext.close();
})();
