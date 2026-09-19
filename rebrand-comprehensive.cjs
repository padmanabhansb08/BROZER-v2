const fs = require('fs');
const path = require('path');

/**
 * BROZER Comprehensive Rebrand Script
 * 
 * RULES:
 * 1. Internal JS identifiers (variable names, function names, storage keys, provider IDs) are NEVER renamed
 *    Examples preserved: webbrain_cloud, helpImproveWebBrain, isWebBrainCloudProvider, WEBBRAIN_CLOUD_PROVIDER_ID
 * 2. User-facing display text (labels, error messages, console logs, comments, titles) ARE renamed
 * 3. "WebBrain Compass" -> "BROZER NAVIGATOR" in display text
 * 4. "WebBrain" -> "BROZER" in display text
 * 5. "Compass" -> "NAVIGATOR" only when it refers to the product feature, not generic English
 */

function safeReplaceDisplayText(content, filename) {
    let result = content;
    
    // ===== PROVIDER LABEL (the key visible item in screenshots) =====
    // Replace the display label 'WebBrain Compass' used in provider-icons.js and manager.js
    result = result.replace(/('|")WebBrain Compass('|")/g, (match, q1, q2) => `${q1}BROZER NAVIGATOR${q2}`);
    
    // ===== CONSOLE LOGS =====
    // Replace [WebBrain] log prefixes with [BROZER]
    result = result.replace(/\[WebBrain\]/g, '[BROZER]');
    result = result.replace(/\[WebBrain Deep Verbose\]/g, '[BROZER Deep Verbose]');
    
    // ===== USER-FACING ERROR MESSAGES (string literals) =====
    // "WebBrain's sidebar and background are out of sync..."
    result = result.replace(/WebBrain's sidebar/g, "BROZER's sidebar");
    result = result.replace(/WebBrain extension connection/g, "BROZER extension connection");
    result = result.replace(/No response from WebBrain background/g, "No response from BROZER background");
    result = result.replace(/WebBrain reloaded or the background worker stopped/g, "BROZER reloaded or the background worker stopped");
    result = result.replace(/Reload WebBrain from your browser/g, "Reload BROZER from your browser");
    result = result.replace(/Reload the sidebar\/extension/g, "Reload the sidebar/extension");
    
    // ===== SYSTEM PROMPTS =====
    result = result.replace(/You are WebBrain's standalone chat assistant/g, "You are BROZER's standalone chat assistant");
    result = result.replace(/You are WebBrain's private on-device chat assistant/g, "You are BROZER's private on-device chat assistant");
    
    // ===== AGENT DISPLAY TEXT =====
    result = result.replace(/WebBrain wants to submit this form/g, "BROZER wants to submit this form");
    result = result.replace(/WebBrain could not safely finish/g, "BROZER could not safely finish");
    result = result.replace(/WebBrain could not s/g, "BROZER could not s"); // captcha solve messages
    result = result.replace(/WebBrain cannot contin/g, "BROZER cannot contin");
    result = result.replace(/WebBrain did not capture/g, "BROZER did not capture");
    result = result.replace(/WebBrain captured replay/g, "BROZER captured replay");
    
    // ===== TAB GROUP TITLE =====
    result = result.replace(/title: 'WebBrain'/g, "title: 'BROZER'");
    
    // ===== CONTEXT MENU =====
    result = result.replace(/Open PDF with WebBrain/g, "Open PDF with BROZER");
    
    // ===== EXPORT MARKDOWN =====
    result = result.replace(/# WebBrain Conversation/g, "# BROZER Conversation");
    result = result.replace(/Exported with WebBrain v/g, "Exported with BROZER v");
    result = result.replace(/\*\*WebBrain:\*\*/g, "**BROZER:**");
    
    // ===== "Stop WebBrain" BUTTON =====
    result = result.replace(/Stop WebBrain/g, "Stop BROZER");
    
    // ===== UPGRADE / SUBSCRIBE MESSAGES =====
    result = result.replace(/Upgrade to WebBrain Plus/g, "Upgrade to BROZER Plus");
    
    // ===== JS COMMENTS (not functional but clean up branding) =====
    result = result.replace(/\/\/ WebBrain Compass/g, "// BROZER NAVIGATOR");
    result = result.replace(/\/\/ WebBrain/g, "// BROZER");
    result = result.replace(/\/\*\* WebBrain/g, "/** BROZER");
    result = result.replace(/\* WebBrain Side Panel/g, "* BROZER Side Panel");
    result = result.replace(/\* WebBrain Settings Page/g, "* BROZER Settings Page");
    result = result.replace(/\* WebBrain Service Worker/g, "* BROZER Service Worker");
    result = result.replace(/\* The WebBrain Agent/g, "* The BROZER Agent");
    result = result.replace(/ActionValidator module for WebBrain/g, "ActionValidator module for BROZER");
    
    // ===== COMMENT REFERENCES TO "Compass" FEATURE =====
    // Only replace "Compass" in comments where it clearly means the product feature
    result = result.replace(/Compass Tiny/g, "NAVIGATOR Tiny");
    result = result.replace(/Compass terminal outcome/g, "NAVIGATOR terminal outcome");
    result = result.replace(/Compass delivery/g, "NAVIGATOR delivery");
    result = result.replace(/Compass run/g, "NAVIGATOR run");
    result = result.replace(/Compass runtime outbox/g, "NAVIGATOR runtime outbox");
    result = result.replace(/Compass itself/g, "NAVIGATOR itself");
    result = result.replace(/Compass stays advisory/g, "NAVIGATOR stays advisory");
    
    // ===== HTML TITLE =====
    result = result.replace(/<title>WebBrain<\/title>/g, "<title>BROZER</title>");
    
    // ===== TRUSTED RUNTIME NOTE =====
    result = result.replace(/TRUSTED WebBrain runtime/g, "TRUSTED BROZER runtime");
    result = result.replace(/trusted WebBrain/g, "trusted BROZER");
    
    // ===== PIN COACHMARK ONBOARDING =====
    result = result.replace(/Pin WebBrain to your toolbar/g, "Pin BROZER to your toolbar");
    result = result.replace(/adds WebBrain to your browser/g, "adds BROZER to your browser");
    result = result.replace(/Help Improve WebBrain/g, "Help Improve BROZER");
    
    // ===== "webbrain-cloud" model string =====
    result = result.replace(/model: 'webbrain-cloud 1\.0'/g, "model: 'brozer-navigator 1.0'");
    
    return result;
}

// Files to process
const filesToProcess = [
    'src/chrome/src/ui/sidepanel.js',
    'src/chrome/src/ui/sidepanel.html',
    'src/chrome/src/ui/settings.js',
    'src/chrome/src/ui/provider-icons.js',
    'src/chrome/src/ui/install.html',
    'src/chrome/src/ui/install.css',
    'src/chrome/src/background.js',
    'src/chrome/src/agent/agent.js',
    'src/chrome/src/agent/action-validator.js',
    'src/chrome/src/providers/manager.js',
    'src/chrome/src/cloud-runs.js',
    'src/chrome/src/config-transfer.js',
    'src/chrome/src/run-reconnect.js',
    'src/chrome/src/selection-shortcut-i18n.js',
    'src/chrome/src/profile-sync.js',
    'src/chrome/src/download-directory.js',
    'src/chrome/src/download-result.js',
    'src/chrome/styles/sidepanel.css',
];

// Also process all locale files
const localeDir = 'src/chrome/src/ui/locales';
if (fs.existsSync(localeDir)) {
    const localeFiles = fs.readdirSync(localeDir).filter(f => f.endsWith('.js'));
    localeFiles.forEach(f => filesToProcess.push(path.join(localeDir, f)));
}

let totalChanges = 0;

filesToProcess.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${filePath}`);
        return;
    }
    const original = fs.readFileSync(filePath, 'utf8');
    const updated = safeReplaceDisplayText(original, filePath);
    if (original !== updated) {
        fs.writeFileSync(filePath, updated);
        const changes = original.split('WebBrain').length - updated.split('WebBrain').length;
        console.log(`UPDATED: ${filePath} (${changes} WebBrain refs removed)`);
        totalChanges++;
    } else {
        console.log(`NO CHANGE: ${filePath}`);
    }
});

// ===== PROVIDER ICONS DISPLAY LABEL =====
// The provider-icons.js has `webbrain_cloud: 'WebBrain Compass'` which was already handled above
// but also needs the icon file reference preserved

// ===== MANIFEST =====
const manifestPath = 'src/chrome/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.name = "BROZER";
manifest.short_name = "BROZER";
if (manifest.description) {
    manifest.description = manifest.description.replace(/WebBrain/g, 'BROZER');
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`UPDATED: ${manifestPath}`);
totalChanges++;

// ===== SIDEPANEL.HTML =====
// Inject our CSS link if not already present
let spHtml = fs.readFileSync('src/chrome/src/ui/sidepanel.html', 'utf8');
if (!spHtml.includes('brozer-theme.css')) {
    spHtml = spHtml.replace('</head>', '  <link rel="stylesheet" href="../../styles/brozer-theme.css">\n</head>');
    fs.writeFileSync('src/chrome/src/ui/sidepanel.html', spHtml);
    console.log('INJECTED: brozer-theme.css link into sidepanel.html');
}

// ===== CONTENT SCRIPTS =====
// Check content scripts for "Stop WebBrain" overlay
const contentDir = 'src/chrome/src/content';
if (fs.existsSync(contentDir)) {
    const contentFiles = fs.readdirSync(contentDir).filter(f => f.endsWith('.js'));
    contentFiles.forEach(f => {
        const fp = path.join(contentDir, f);
        const orig = fs.readFileSync(fp, 'utf8');
        const upd = safeReplaceDisplayText(orig, fp);
        if (orig !== upd) {
            fs.writeFileSync(fp, upd);
            console.log(`UPDATED: ${fp}`);
            totalChanges++;
        }
    });
}

// ===== AGENT SUB-MODULES =====
const agentDir = 'src/chrome/src/agent';
if (fs.existsSync(agentDir)) {
    const agentFiles = fs.readdirSync(agentDir).filter(f => f.endsWith('.js'));
    agentFiles.forEach(f => {
        const fp = path.join(agentDir, f);
        if (filesToProcess.includes(fp)) return; // already processed
        const orig = fs.readFileSync(fp, 'utf8');
        const upd = safeReplaceDisplayText(orig, fp);
        if (orig !== upd) {
            fs.writeFileSync(fp, upd);
            console.log(`UPDATED: ${fp}`);
            totalChanges++;
        }
    });
}

console.log(`\nDone. ${totalChanges} files updated.`);
console.log('Internal identifiers (webbrain_cloud, helpImproveWebBrain, etc.) were PRESERVED.');
