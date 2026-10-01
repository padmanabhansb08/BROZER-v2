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
  // background.on('console', msg => console.log('BACKGROUND:', msg.text()));

  browserContext.on('page', async (p) => {
    p.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('[GPU-') || text.startsWith('[GROUND-') || text.startsWith('RAW')) {
        console.log(text);
      }
    });
  });

  const page = await browserContext.newPage();
  
  await page.goto(`chrome-extension://${extensionId}/ocr-test.html`);
  const screenshotBuffer = fs.readFileSync('proof_sanitized_screenshot.png');
  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

  await page.goto(`chrome-extension://${extensionId}/test-vp.html`);
  await page.waitForFunction(() => window.vpReady === true);

  const result = await page.evaluate(async (dataUrl) => {
    try {
      const { WebGPUVisionProvider } = await import('./src/providers/webgpu.js');
      const provider = new WebGPUVisionProvider();
      
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
         
         while (true) {
           const state = await chrome.storage.local.get('webgpuVisionDownloadState');
           if (state.webgpuVisionDownloadState?.status === 'ready') break;
           await new Promise(r => setTimeout(r, 2000));
         }
         
      }
      
      await chrome.storage.local.set({
        'webgpuVisionEnabled': true,
        'webgpuVisionConsentVersion': 2,
        'webgpuVisionDownloadState': { modelId: provider.model, status: 'ready' }
      });

      const prompts = [
        "Locate the BUY NOW button. Return only its bounding box as [x1,y1,x2,y2].",
        "Find the BUY NOW button. Return only JSON:\n{\n  \"x\": number,\n  \"y\": number,\n  \"width\": number,\n  \"height\": number\n}",
        "Identify the BUY NOW button and give its center point as [x,y].",
        "List all visible UI elements and their bounding boxes."
      ];

      let anyCoordinates = false;
      let modelOutputText = "";

      for (let i = 0; i < prompts.length; i++) {
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: prompts[i] }
            ]
          }
        ];
        
        console.log(`[GPU-04] Model inference started for prompt ${i+1}`);
        const response = await provider.chat(messages, { visionProbe: false });
        console.log(`[GPU-05] Model inference completed for prompt ${i+1}`);
        
        const content = response?.content || "";
        console.log(`RAW RESPONSE ${i+1}:\n${content}\n`);
        
        // Simple heuristic to check if it looks like coordinates
        if (content.match(/\[\d+,\s*\d+/g) || content.match(/\{\s*"x"/)) {
           anyCoordinates = true;
           modelOutputText = content;
        }
      }

      console.log(`[GROUND-01] model returned coordinates: ${anyCoordinates}`);
      
      if (!anyCoordinates) {
        console.log(`[GROUND-02] coordinate format: none`);
        console.log(`[GROUND-03] coordinate space: unknown`);
        console.log(`[GROUND-04] target detected: false`);
        console.log(`[GROUND-05] target bbox: null`);
        console.log(`[GROUND-06] overlap with ground truth: 0%`);
        console.log(`[GROUND-07] confidence: 0`);
      } else {
        // If we actually get coordinates, we'd log the formats. For now, assume it fails based on previous observation, but handle just in case
        console.log(`[GROUND-02] coordinate format: ${modelOutputText.substring(0, 30)}...`);
        console.log(`[GROUND-03] coordinate space: unknown`);
        console.log(`[GROUND-04] target detected: true`);
        console.log(`[GROUND-05] target bbox: [unverified]`);
        console.log(`[GROUND-06] overlap with ground truth: unknown`);
        console.log(`[GROUND-07] confidence: unknown`);
      }
      
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message, stack: e.stack };
    }
  }, dataUrl);

  await browserContext.close();
})();
