import { pipeline, env } from './src/chrome/vendor/transformers/transformers.web.js';
import path from 'path';

(async () => {
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.cacheDir = path.join(process.cwd(), 'src', 'chrome', 'vendor', 'models');
    
    console.log('Downloading model via transformers.js...');
    try {
        const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
        console.log('Successfully downloaded to:', env.cacheDir);
    } catch (e) {
        console.error(e);
    }
})();
