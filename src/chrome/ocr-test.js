window.runOCR = async (dataUrl) => {
  console.log('runOCR called! typeof Tesseract:', typeof Tesseract);
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      workerPath: chrome.runtime.getURL('vendor/tesseract/worker.min.js'),
      corePath: chrome.runtime.getURL('vendor/tesseract/tesseract-core-simd.js'),
      langPath: chrome.runtime.getURL('vendor/tesseract'),
      workerBlobURL: false,
      logger: m => console.log('Tesseract log:', m)
    });
    
    console.log('Worker created');
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);
    
    console.log('Image loaded');
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    console.log('Recognizing...');
    const { data } = await worker.recognize(canvas);
    console.log('Recognized!', data.text);
    await worker.terminate();
    
    return data.words.map(w => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox
    }));
  } catch (err) {
    console.error('OCR CAUGHT ERROR:', err);
    return { error: String(err), message: err.message };
  }
};
