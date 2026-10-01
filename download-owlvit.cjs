const fs = require('fs');
const path = require('path');
const https = require('https');

const modelId = 'Xenova/owlvit-base-patch32';
const baseUrl = `https://huggingface.co/${modelId}/resolve/main/`;
const outputDir = path.join(__dirname, 'src', 'chrome', 'vendor', 'models', 'Xenova', 'owlvit-base-patch32');

const filesToDownload = [
    'config.json',
    'preprocessor_config.json',
    'tokenizer_config.json',
    'tokenizer.json',
    'vocab.txt',
    'onnx/model_quantized.onnx'
];

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

(async () => {
    console.log(`Downloading ${modelId} locally...`);
    for (const file of filesToDownload) {
        const url = baseUrl + file;
        const dest = path.join(outputDir, file);
        console.log(`Downloading ${file}...`);
        try {
            await downloadFile(url, dest);
            console.log(`Successfully downloaded ${file}`);
        } catch (e) {
            console.error(e);
        }
    }
    console.log('Download complete.');
})();
