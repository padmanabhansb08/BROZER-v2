const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, 'src', 'chrome');
  const userDataDir = path.join(__dirname, 'test-profile2');
  
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  let [background] = browserContext.serviceWorkers();
  if (!background) {
    background = await browserContext.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];

  const page = await browserContext.newPage();
  
  await page.goto(`chrome-extension://${extensionId}/ocr-test.html`);
  
  console.log('Capturing screenshot...');
  const screenshotBuffer = await page.screenshot();
  fs.writeFileSync('original_screenshot.png', screenshotBuffer);

  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
  
  // Go to test-vp.html to access the modules
  await page.goto(`chrome-extension://${extensionId}/test-vp.html`);
  await page.waitForFunction(() => window.vpReady === true);

  console.log('Running VisualDetector and PrivacyEngine inside extension...');
  const result = await page.evaluate(async (dataUrl) => {
    return await window.runVP(dataUrl);
  }, dataUrl);

  if (result.outDataUrl) {
    const base64Data = result.outDataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync('sanitized_screenshot.png', base64Data, 'base64');
    delete result.outDataUrl;
  }

  console.log('Result:', JSON.stringify(result, null, 2));

  await browserContext.close();
})();
