const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, 'src', 'chrome');
  const userDataDir = path.join(__dirname, 'test-profile');
  
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  // Find the extension ID
  let [background] = browserContext.serviceWorkers();
  if (!background) {
    background = await browserContext.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  console.log(`Extension ID: ${extensionId}`);

  const page = await browserContext.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  const testUrl = `chrome-extension://${extensionId}/ocr-test.html`;
  console.log(`Navigating to ${testUrl}`);
  await page.goto(testUrl);

  // Capture a screenshot of the DOM
  console.log('Capturing screenshot...');
  const screenshotBuffer = await page.screenshot();
  const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

  console.log('Running OCR via Tesseract worker in extension context...');
  const ocrWords = await page.evaluate(async (dataUrl) => {
    return await window.runOCR(dataUrl);
  }, dataUrl);

  if (ocrWords.error) {
    console.error('OCR Error:', ocrWords.error, ocrWords.stack);
    process.exit(1);
  }

  console.log('OCR Output:');
  console.log(JSON.stringify(ocrWords, null, 2));

  // Determine if it found our targets
  const foundText = ocrWords.map(w => w.text).join(' ');
  console.log('--- OCR Sanity Check ---');
  console.log('Includes alice@example.com:', foundText.includes('alice'));
  console.log('Includes SuperSecret123:', foundText.includes('SuperSecret123'));
  console.log('Includes BUY NOW:', foundText.includes('BUY'));

  await browserContext.close();
})();
