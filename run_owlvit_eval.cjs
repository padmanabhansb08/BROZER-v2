const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function computeIoU(box1, box2) {
  const xA = Math.max(box1.xmin, box2.xmin);
  const yA = Math.max(box1.ymin, box2.ymin);
  const xB = Math.min(box1.xmax, box2.xmax);
  const yB = Math.min(box1.ymax, box2.ymax);
  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const box1Area = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const box2Area = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
  const iou = interArea / (box1Area + box2Area - interArea);
  return isNaN(iou) ? 0 : iou;
}

function computeCenterError(box1, box2) {
  const c1x = (box1.xmin + box1.xmax) / 2;
  const c1y = (box1.ymin + box1.ymax) / 2;
  const c2x = (box2.xmin + box2.xmax) / 2;
  const c2y = (box2.ymin + box2.ymax) / 2;
  return Math.sqrt(Math.pow(c1x - c2x, 2) + Math.pow(c1y - c2y, 2));
}

(async () => {
  const pathToExtension = path.join(__dirname, 'src', 'chrome');
  const userDataDir = path.join(__dirname, 'test-profile-owl');

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
    if (text.startsWith('[OWL-') || text.startsWith('RAW')) {
      console.log(text);
    }
  });

  let [background] = browserContext.serviceWorkers();
  if (!background) {
    background = await browserContext.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  
  // 1. Get ground truth for base targets
  await page.goto(`chrome-extension://${extensionId}/ocr-test.html`);
  const gtBoxes = await page.evaluate(() => {
    const b = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { xmin: rect.left, ymin: rect.top, xmax: rect.right, ymax: rect.bottom };
    };
    return {
      'BUY NOW': b('normal1'),
      'PRODUCT DETAILS': b('normal2'),
      'HOME': b('normal3'),
      'SEARCH': b('normal4'),
      'button': b('normal1'),
      'text': b('normal1'), // generic
      'input field': null, // none present
      'navigation link': b('normal3'),
    };
  });

  const screenshotBuffer = fs.readFileSync('proof_sanitized_screenshot.png');
  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

  const result = await page.evaluate(async ({ dataUrl, gtBoxes, extensionUrl }) => {
    try {
      const { pipeline, env } = await import('./vendor/transformers/transformers.web.js');
      env.allowLocalModels = false;
      env.allowRemoteModels = true; 
      env.useBrowserCache = true;
      
      const wasm = env.backends?.onnx?.wasm;
      if (wasm) {
        wasm.numThreads = 1;
        wasm.wasmPaths = {
          mjs: extensionUrl + 'vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs',
          wasm: extensionUrl + 'vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm',
        };
      }

      console.log('[OWL-SYS] Downloading/Caching OWL-ViT model...');
      const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
         device: 'webgpu'
      });
      
      console.log('[OWL-SYS] Model Ready.');

      // --- HELPER ---
      function evalTarget(target, outputBox, score, gtBox, imgDims) {
        console.log(`[OWL-01] target: ${target}`);
        console.log(`[OWL-02] raw label: ${target}`);
        console.log(`[OWL-03] score: ${score}`);
        if (outputBox) {
           console.log(`[OWL-04] bbox: [${outputBox.xmin}, ${outputBox.ymin}, ${outputBox.xmax}, ${outputBox.ymax}]`);
        } else {
           console.log(`[OWL-04] bbox: null`);
        }
        console.log(`[OWL-05] image dimensions: ${imgDims.width}x${imgDims.height}`);
        
        let iou = 0;
        let cErr = 0;
        let accepted = false;

        if (outputBox && gtBox) {
           // Compute programmatic IoU
           const xA = Math.max(outputBox.xmin, gtBox.xmin);
           const yA = Math.max(outputBox.ymin, gtBox.ymin);
           const xB = Math.min(outputBox.xmax, gtBox.xmax);
           const yB = Math.min(outputBox.ymax, gtBox.ymax);
           const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
           const box1Area = (outputBox.xmax - outputBox.xmin) * (outputBox.ymax - outputBox.ymin);
           const box2Area = (gtBox.xmax - gtBox.xmin) * (gtBox.ymax - gtBox.ymin);
           iou = interArea / (box1Area + box2Area - interArea);
           if (isNaN(iou)) iou = 0;
           
           const c1x = (outputBox.xmin + outputBox.xmax) / 2;
           const c1y = (outputBox.ymin + outputBox.ymax) / 2;
           const c2x = (gtBox.xmin + gtBox.xmax) / 2;
           const c2y = (gtBox.ymin + gtBox.ymax) / 2;
           cErr = Math.sqrt(Math.pow(c1x - c2x, 2) + Math.pow(c1y - c2y, 2));

           const validCoords = Number.isFinite(outputBox.xmin) && Number.isFinite(outputBox.ymin) && Number.isFinite(outputBox.xmax) && Number.isFinite(outputBox.ymax);
           const validWidthHeight = (outputBox.xmax - outputBox.xmin) > 0 && (outputBox.ymax - outputBox.ymin) > 0;
           const insideBounds = outputBox.xmin >= 0 && outputBox.ymin >= 0 && outputBox.xmax <= imgDims.width && outputBox.ymax <= imgDims.height;
           const scoreValid = score >= 0.1; // Experimental threshold
           
           accepted = iou >= 0.50 && scoreValid && insideBounds && validCoords && validWidthHeight;
        } else if (!outputBox && !gtBox) {
           accepted = true; // correctly rejected non-existent target
        }
        
        console.log(`[OWL-06] IoU: ${iou.toFixed(4)}`);
        console.log(`[OWL-07] center error: ${cErr.toFixed(2)}`);
        console.log(`[OWL-08] accepted/rejected: ${accepted ? 'accepted' : 'rejected'}`);
      }

      const imgDims = { width: 800, height: 600 }; // Standard browser viewport screenshot size in proof

      // 4. Test basic targets
      const baseTargets = ['BUY NOW', 'PRODUCT DETAILS', 'HOME', 'SEARCH', 'button', 'text', 'input field', 'navigation link'];
      for (const t of baseTargets) {
        const out = await detector(dataUrl, [t], { threshold: 0.05 });
        const best = out.length > 0 ? out[0] : null;
        evalTarget(t, best?.box, best?.score || 0, gtBoxes[t], imgDims);
      }

      // 10. Negative tests
      console.log('[OWL-SYS] Running negative tests...');
      const negativeTargets = ['password field', 'profile avatar', 'shopping cart', 'close button'];
      for (const t of negativeTargets) {
        const out = await detector(dataUrl, [t], { threshold: 0.1 });
        const best = out.length > 0 ? out[0] : null;
        evalTarget(t, best?.box, best?.score || 0, null, imgDims);
      }

      // Return ok
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, { dataUrl, gtBoxes, extensionUrl: `chrome-extension://${extensionId}/` });

  console.log('Phase 1 Result:', result);
  await browserContext.close();
})();
