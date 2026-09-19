const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const pathToExtension = path.join(__dirname, 'build', 'chrome');
  console.log('Loading extension from:', pathToExtension);
  const userDataDir = path.join(__dirname, 'test-profile');
  
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  let serviceWorker = browserContext.serviceWorkers()[0];
  if (!serviceWorker) serviceWorker = await browserContext.waitForEvent('serviceworker').catch(() => null);
  if (serviceWorker) {
    serviceWorker.on('console', msg => console.log('[SW]', msg.type(), msg.text()));
    serviceWorker.on('pageerror', err => console.log('[SW ERROR]', err.message));
  }

  const page = await browserContext.newPage();
  await page.goto('https://example.com');
  await new Promise(r => setTimeout(r, 2000));
  
  let extId;
  const sw = browserContext.serviceWorkers()[0];
  if (sw) extId = new URL(sw.url()).hostname;
  
  if (extId) {
    console.log('Extension ID:', extId);
    const sp = await browserContext.newPage();
    sp.on('console', msg => console.log('[SP]', msg.type(), msg.text()));
    sp.on('pageerror', err => console.log('[SP ERROR]', err.message));
    
    await sp.goto(`chrome-extension://${extId}/src/ui/sidepanel.html`).catch(e => console.log(e.message));
    await new Promise(r => setTimeout(r, 2000));
    
    // Skip onboarding
    await sp.evaluate(() => new Promise(resolve => chrome.storage.local.set({ onboardingComplete: true }, resolve)));
    await sp.reload();
    await new Promise(r => setTimeout(r, 2000));
    
    // Check UI elements
    const uiCheck = await sp.evaluate(() => {
      const title = document.title;
      const brandName = document.querySelector('.brand-name')?.textContent || '';
      const providerSelect = document.querySelector('.provider-select, select');
      const firstOption = providerSelect?.options?.[0]?.text || '';
      const btnSend = !!document.getElementById('btn-send');
      const input = !!document.getElementById('user-input');
      // Check for any remaining "WebBrain" text in visible DOM
      const bodyText = document.body.innerText;
      const webbrainFound = bodyText.includes('WebBrain');
      return { title, brandName, firstOption, btnSend, input, webbrainFound };
    });
    console.log('UI Check:', JSON.stringify(uiCheck, null, 2));
    
    // Try sending a message
    await sp.evaluate(() => { document.getElementById('user-input').value = 'Hello test'; });
    await sp.click('#btn-send', { force: true });
    
    await new Promise(r => setTimeout(r, 5000));
    
    // Check for errors
    console.log('=== Test complete ===');
  }
  
  await browserContext.close();
})();
