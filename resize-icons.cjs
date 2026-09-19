const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const srcImage = "C:\\\\Users\\\\Acer\\\\.gemini\\\\antigravity-ide\\\\brain\\\\155a0444-155e-4e02-b9c1-413284facd50\\\\.user_uploaded\\\\media_1789625929727.jpg";
const iconsDir = path.join(__dirname, 'src', 'chrome', 'icons');

const sizes = [16, 48, 128];

// Use sharp-cli to resize
sizes.forEach(size => {
    const outFile = path.join(iconsDir, `icon${size}.png`);
    try {
        execSync(`npx -y sharp-cli resize ${size} ${size} --fit cover --input "${srcImage}" --output "${outFile}"`, {
            stdio: 'pipe',
            timeout: 30000
        });
        console.log(`Created: icon${size}.png`);
    } catch (e) {
        console.error(`Failed icon${size}:`, e.message);
    }
});

console.log('Done.');
