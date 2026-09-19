const fs = require('fs');

function replaceFileContent(filePath, replacer) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = replacer(content);
    fs.writeFileSync(filePath, content);
}

// 1. Update manifest.json
replaceFileContent('src/chrome/manifest.json', content => {
    const manifest = JSON.parse(content);
    manifest.name = "BROZER";
    manifest.short_name = "BROZER";
    return JSON.stringify(manifest, null, 2);
});

// 2. Update English translations
replaceFileContent('src/chrome/src/ui/locales/en.js', content => {
    return content
        .replace(/WebBrain/g, 'BROZER')
        .replace(/webbrain/g, 'brozer')
        .replace(/Compass/g, 'NAVIGATOR')
        .replace(/compass/g, 'navigator');
});

// 3. Rewrite sidepanel.html
replaceFileContent('src/chrome/src/ui/sidepanel.html', content => {
    let newContent = content;
    
    // Inject custom CSS link
    newContent = newContent.replace('</head>', '  <link rel="stylesheet" href="../../styles/brozer-theme.css">\n</head>');

    // We will wrap the inside of #app in a new structure, while keeping all functional IDs intact.
    // The existing structure inside #app:
    // <div id="app" class="app">
    //   <header class="header">...</header>
    //   <div class="main-content">
    //     <div id="messages-wrapper" ...>
    //        <div id="messages"...>
    
    // Actually, it's safer to just inject CSS that drastically styles the existing structure,
    // and just replace the header with BROZER logo.
    
    // Let's replace the WebBrain SVG and "WebBrain Compass" text in the header.
    // The original header has:
    // <div class="brand">
    //   <svg class="brand-logo" ...>...</svg>
    //   <span class="brand-name">WebBrain Compass</span>
    // </div>
    const brandRegex = /<div class="brand">[\s\S]*?<\/div>/;
    const newBrand = `
        <div class="brand brozer-brand">
          <div class="brozer-logo">
             <span class="brozer-b">B</span>ROZER
          </div>
          <span class="brand-name" style="display:none;">NAVIGATOR</span>
        </div>
    `;
    newContent = newContent.replace(brandRegex, newBrand);
    
    return newContent;
});

// 4. Create brozer-theme.css
const brozerCss = `
/* BROZER Premium Redesign */
:root {
  --app-bg: #0d0d0f !important;
  --panel-bg: #131417 !important;
  --surface: #1c1d22 !important;
  --primary: #00ff66 !important;
  --primary-hover: #00e55b !important;
  --primary-transparent: rgba(0, 255, 102, 0.15) !important;
  --text: #ffffff !important;
  --text-muted: #8e939d !important;
  --border: #2a2b32 !important;
  
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  --shadow-glow: 0 0 15px var(--primary-transparent) !important;
}

body {
  background-color: var(--app-bg) !important;
  color: var(--text) !important;
  font-family: var(--font-body) !important;
}

#app, .main-content {
  background-color: var(--app-bg) !important;
}

/* Header Redesign */
.header {
  background-color: var(--panel-bg) !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 12px 16px !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
}

.brozer-brand {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.brozer-logo {
  font-family: 'Outfit', 'Inter', sans-serif !important;
  font-weight: 800 !important;
  font-size: 18px !important;
  letter-spacing: 2px !important;
  color: var(--text) !important;
}

.brozer-logo .brozer-b {
  color: var(--primary) !important;
}

/* Nav Tabs */
.nav-tabs {
  background-color: var(--panel-bg) !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 0 16px !important;
}

.nav-tab {
  color: var(--text-muted) !important;
  font-weight: 500 !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  font-size: 11px !important;
  padding: 12px 0 !important;
  border-bottom: 2px solid transparent !important;
}

.nav-tab.active {
  color: var(--primary) !important;
  border-bottom-color: var(--primary) !important;
  text-shadow: 0 0 10px var(--primary-transparent) !important;
}

/* Composer / Input Wrapper */
#input-wrapper {
  background-color: var(--surface) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  padding: 8px 12px !important;
  margin: 16px !important;
  transition: all 0.2s ease !important;
}

#input-wrapper:focus-within {
  border-color: var(--primary) !important;
  box-shadow: var(--shadow-glow) !important;
}

#user-input {
  color: var(--text) !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
}

#user-input::placeholder {
  color: var(--text-muted) !important;
}

#btn-send {
  background-color: var(--primary) !important;
  color: #000 !important;
  border-radius: 8px !important;
  width: 32px !important;
  height: 32px !important;
  transition: all 0.2s ease !important;
}

#btn-send:not(:disabled):hover {
  background-color: var(--primary-hover) !important;
  transform: scale(1.05) !important;
}

#btn-send:disabled {
  background-color: var(--surface) !important;
  color: var(--text-muted) !important;
  border: 1px solid var(--border) !important;
}

/* Chat Messages */
.message {
  margin: 12px 16px !important;
  padding: 12px 16px !important;
  border-radius: 12px !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
}

.message.user {
  background-color: var(--surface) !important;
  border: 1px solid var(--border) !important;
  margin-left: 32px !important;
  border-bottom-right-radius: 4px !important;
}

.message.assistant {
  background-color: transparent !important;
  border-left: 3px solid var(--primary) !important;
  padding-left: 16px !important;
  margin-right: 32px !important;
  border-radius: 0 !important;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px !important;
}
::-webkit-scrollbar-track {
  background: var(--app-bg) !important;
}
::-webkit-scrollbar-thumb {
  background: var(--border) !important;
  border-radius: 3px !important;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted) !important;
}
`;
fs.writeFileSync('src/chrome/styles/brozer-theme.css', brozerCss);

console.log('Rebrand script complete.');
