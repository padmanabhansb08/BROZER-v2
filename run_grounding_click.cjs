const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, 'src', 'chrome');

  // Test scales: 1x, 1.25x, 1.5x
  const scales = [1, 1.25, 1.5];
  
  for (const scale of scales) {
    console.log(`\n=== Testing E2E Grounding Click at Device Scale Factor: ${scale}x ===`);
    const userDataDir = path.join(__dirname, `test-profile-owl-e2e-${scale}`);
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      deviceScaleFactor: scale,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--enable-unsafe-webgpu',
        '--disable-gpu-sandbox',
        '--ignore-gpu-blocklist'
      ]
    });

    const page = await browserContext.newPage();
    let [background] = browserContext.serviceWorkers();
    if (!background) {
      background = await browserContext.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];

    await page.goto(`chrome-extension://${extensionId}/ocr-test.html`);
    await page.evaluate(() => {
      document.body.style.margin = '0';
      document.body.style.width = '100vw';
      document.body.style.height = '100vh';
      document.body.style.position = 'relative';
      document.body.innerHTML = `
        <button id="tl" onclick="window.clicked='tl'" style="position: absolute; top: 10px; left: 10px; padding: 10px;">BTN TL</button>
        <button id="c" onclick="window.clicked='c'" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 10px;">BTN CENTER</button>
        <button id="br" onclick="window.clicked='br'" style="position: absolute; bottom: 10px; right: 10px; padding: 10px;">BTN BR</button>
      `;
    });

    const screenshotBuffer = await page.screenshot();
    const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

    // Calculate transformations in the page
    const result = await page.evaluate(async ({ dataUrl, extensionUrl, scale }) => {
      try {
        const { pipeline, env } = await import(extensionUrl + 'vendor/transformers/transformers.web.js');
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

        const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
           device: 'webgpu'
        });
        
        const targets = ['BTN TL', 'BTN CENTER', 'BTN BR'];
        let clicks = [];
        
        for (const target of targets) {
           const out = await detector(dataUrl, [target], { threshold: 0.1 });
           const best = out.length > 0 ? out[0] : null;
           
           if (best && best.box) {
               const box = best.box;
               // Geometric validation (Gate)
               const validCoords = Number.isFinite(box.xmin) && Number.isFinite(box.ymin) 
                                && Number.isFinite(box.xmax) && Number.isFinite(box.ymax);
               const validSize = (box.xmax - box.xmin) > 5 && (box.ymax - box.ymin) > 5;
               
               if (validCoords && validSize && best.score > 0.15) {
                   // Model coordinates -> Viewport coordinates
                   // Since device scale factor is applied, the screenshot is scale times larger than the viewport logical size.
                   const modelX = (box.xmin + box.xmax) / 2;
                   const modelY = (box.ymin + box.ymax) / 2;
                   
                   const viewportX = modelX / scale;
                   const viewportY = modelY / scale;
                   
                   clicks.push({ target, viewportX, viewportY, score: best.score, rawBox: box });
               }
           }
        }
        return { ok: true, clicks };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }, { dataUrl, extensionUrl: `chrome-extension://${extensionId}/`, scale });

    if (result.ok) {
        for (const click of result.clicks) {
           console.log(`[CDP] Attempting click for ${click.target} at logical coords (${click.viewportX.toFixed(2)}, ${click.viewportY.toFixed(2)}) derived from scaled raw box`);
           await page.mouse.click(click.viewportX, click.viewportY);
           
           const clickedId = await page.evaluate(() => {
              const c = window.clicked;
              window.clicked = null;
              return c;
           });
           
           let expected = click.target.split(' ')[1].toLowerCase();
           console.log(`[VERIFY] Clicked element ID: ${clickedId} (Expected: ${expected}) => ${clickedId === expected ? 'PASS' : 'FAIL'}`);
        }
    } else {
        console.error("Inference Error:", result.error);
    }
    
    await browserContext.close();
  }
})();
