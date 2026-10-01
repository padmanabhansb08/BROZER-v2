import { VisualDetector } from './src/providers/visual-detector.js';
import { PrivacyEngine } from './src/providers/privacy-engine.js';
import { ImageRedactor } from './src/providers/image-redactor.js';

window.VisualDetector = VisualDetector;
window.PrivacyEngine = PrivacyEngine;
window.ImageRedactor = ImageRedactor;

window.runVP = async (dataUrl) => {
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pixelData = ctx.getImageData(0, 0, img.width, img.height).data;
    
    console.log('Running VisualDetector...');
    const scanResult = await VisualDetector.detect({ pixelData, width: img.width, height: img.height });
    const regions = scanResult.regions;
    console.log('Regions:', regions);
    const redactList = [];
    const sensitive = ['alice@example.com', 'SuperSecret123', '4111', '111', '1111'];
    for (let i=0; i<regions.length; i++) {
      const sanitized = PrivacyEngine.sanitizeText(regions[i].text);
      if (sensitive.includes(regions[i].text) || (regions[i].text !== sanitized && sanitized.includes('<'))) {
         redactList.push(regions[i]);
      }
    }
    
    // Draw black boxes on original image canvas
    for (const region of redactList) {
       const box = region.box;
       ctx.fillStyle = '#000000';
       ctx.fillRect(Math.max(0, box.x - 5), Math.max(0, box.y - 5), box.width + 10, box.height + 10);
    }
    const outDataUrl = canvas.toDataURL();
    
    return { regions, redactList, redactedCount: redactList.length, success: true, outDataUrl };
  } catch (e) {
    return { error: e.message, stack: e.stack };
  }
};

window.vpReady = true;
