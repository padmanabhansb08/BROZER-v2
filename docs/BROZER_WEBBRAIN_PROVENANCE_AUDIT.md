# BROZER-v2 Exhaustive Codebase Audit & WebBrain Provenance Assessment Report

> **Date:** October 1, 2026  
> **Repository:** `padmanabhansb08/BROZER-v2`  
> **Branch:** `main`  
> **Package Version:** `36.5.0`  
> **License:** GPL-3.0-or-later  

---

## Executive Summary

An exhaustive repository-wide audit was conducted across all trees in `BROZER-v2` to evaluate branding, documentation, architecture, internal identifiers, vendor metadata, build artifacts, and code provenance relative to the upstream `webbrain-one/webbrain` lineage.

The audit confirms **incontrovertible evidence of WebBrain project lineage, residual branding, embedded documentation, and unrenamed internal code identifiers**. A shallow display-text rebrand (`rebrand-comprehensive.cjs`) previously preserved internal JavaScript identifiers (e.g. `webbrain_cloud`, `helpImproveWebBrain`) and left `.bz-panel/`, root documentation, vendor metadata, and static web pages untouched.

---

## Comprehensive Audit Findings Matrix

| Audit Target | Category | Current Status | Primary Locations / Evidence |
| :--- | :--- | :--- | :--- |
| **`.bz-panel/` Tree** | Parallel Source / Legacy Copy | **Confirmed Unmodified WebBrain** | [`.bz-panel/README.md`](file:///c:/Users/aml/Desktop/BROZER-v2/.bz-panel/README.md), [`.bz-panel/ARCHITECTURE.md`](file:///c:/Users/aml/Desktop/BROZER-v2/.bz-panel/ARCHITECTURE.md) explicitly state WebBrain v36.5.0 and direct users to `github.com/webbrain-one/webbrain`. Tracked in git despite `.gitignore`. |
| **Internal JS Storage Keys** | Storage & State Schema | **Unmodified WebBrain Keys** | `helpImproveWebBrain` used in [`settings.js:800`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/settings.js#L800) and [`sidepanel.js:248`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/sidepanel.js#L248). |
| **Provider Identifiers** | Core Architecture ID | **Unmodified WebBrain IDs** | `webbrain_cloud` provider ID used in [`manager.js`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/providers/manager.js), [`settings.js:2991`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/settings.js#L2991), `provider-icons.js`. |
| **Internal UI Helper Functions** | Function Names | **Unmodified WebBrain Prefix** | `createWebbrainPromotionIcon()`, `animateWebbrainPromotionOnce()`, `isWebBrainCloudProviderSelected()`, `webbrainSubscribeUrl()`, `webbrainAccountUrl()`. |
| **Export Filename Defaults** | UI & Persistence Export | **Unmodified WebBrain Filenames** | Default downloads: `webbrain-user-memory-*.json`, `webbrain-run-*.png`, `webbrain-recording`, `.webbrain-workflow.json`, `webbrain-config-*.json`, `webbrain-traces-*.md`, `webbrain-chat-*.md`. |
| **External URLs & Issue Trackers** | Links & Metadata | **Points Upstream** | Store URLs, feedback issue links (`github.com/webbrain-one/webbrain/issues/new`), privacy links (`webbrain.one/privacy`). |
| **Vendor Submodule Metadata** | Vendor Docs & SBOMs | **Unmodified WebBrain Docs** | `README.webbrain.md` files in [`src/chrome/vendor/bitgpu/`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/vendor/bitgpu/), `fflate`, `libzim`, `sqlite`; `sbom.json` referencing `webbrain-emscripten-libzim:3.1.41`. |
| **Root Release History & Changelogs** | Documentation | **Transplanted Lineage** | [README.md](file:///c:/Users/aml/Desktop/BROZER-v2/README.md) and [CHANGELOG.md](file:///c:/Users/aml/Desktop/BROZER-v2/CHANGELOG.md) contain release history starting from v1.1.0 to v36.5.0 matching upstream WebBrain. |
| **Static Web Landing Pages** | `web/` Tree Docs | **WebBrain Branded Pages** | `web/zh/index.html`, `web/de/index.html`, `web/docs/`, `web/blog/` contain titles, open-graph tags, and URLs for `webbrain.one`. |
| **Package Version & Metadata** | `package.json` | **Matching Version 36.5.0** | `"version": "36.5.0"`, `"repository": "https://github.com/padmanabhansb08/brozer.git"`. |
| **On-Device Vision Grounding** | Vision Engine (`webgpu.js`) | **NEW BROZER Feature** | OWL-ViT zero-shot bounding box detector via Transformers.js WebGPU pipeline (`Xenova/owlvit-base-patch32`). |

---

## 14-Point Exhaustive Audit Breakdown

### 1. Repository Files Scan
- **Total Tracked Files:** 450+ files in active repo.
- **Tree Distribution:**
  - `src/chrome/`: Main Manifest V3 extension codebase (active BROZER development target).
  - `.bz-panel/`: Parallel checked-in legacy extension tree (336 files).
  - `web/`: Web landing page, blog, and documentation generator tree.
  - `docs/`: Technical reports and test scenarios.
  - `test/`: E2E, Playwright, and unit test suites.
  - `scripts/`: Unpacked build & release scripts.

### 2. Filenames with Legacy Identifiers
- `.bz-panel/vendor/bitgpu/README.webbrain.md`
- `.bz-panel/vendor/fflate/README.webbrain.md`
- `.bz-panel/vendor/libzim/README.webbrain.md`
- `.bz-panel/vendor/sqlite/README.webbrain.md`
- `src/chrome/vendor/bitgpu/README.webbrain.md`
- `src/chrome/vendor/fflate/README.webbrain.md`
- `src/chrome/vendor/libzim/README.webbrain.md`
- `src/chrome/vendor/sqlite/README.webbrain.md`
- `web/blog/posts/webbrain-31-offline-webgpu-vision.md`
- `web/blog/posts/webbrain-cloud-local-model-benchmarks.md`
- `web/blog/posts/webbrain-compass-tiny-v1.md`
- `web/blog/posts/webbrain-compass-v2.md`
- `web/blog/posts/why-webbrain-33-is-gpl.md`

### 3. Function / Class / Export Names
- `createWebbrainPromotionIcon` ([`sidepanel.js:5420`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/sidepanel.js#L5420))
- `animateWebbrainPromotionOnce` ([`sidepanel.js:5435`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/sidepanel.js#L5435))
- `isWebBrainCloudProviderSelected` ([`sidepanel.js:7448`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/sidepanel.js#L7448))
- `webbrainSubscribeUrl` ([`settings.js:3525`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/settings.js#L3525))
- `webbrainAccountUrl` ([`settings.js:3526`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/settings.js#L3526))

### 4. Storage & Provider Constants
- `helpImproveWebBrain` (Storage key)
- `webbrain_cloud` (Provider ID)
- `WEBBRAIN_CLOUD_PROVIDER_ID`

### 5. Package Dependencies
- `package.json` defines devDependencies (`playwright`, `tldts`).
- No external WebBrain npm package exists, but version is locked to `36.5.0`.

### 6. External URLs & Attribution
- Upstream GitHub: `https://github.com/webbrain-one/webbrain`
- Issue reporting: `https://github.com/webbrain-one/webbrain/issues/new`
- Web domain: `https://webbrain.one`
- Chrome Web Store ID: `ljhijonmfahplgbbacgcfnaihbjljhhb`

### 7. Copyright & License Attribution
- Root [`LICENSE`](file:///c:/Users/aml/Desktop/BROZER-v2/LICENSE) is GPL-3.0-or-later.
- `.bz-panel/LICENSE` specifies WebBrain upstream copyright.

### 8. README & Documentation References
- `.bz-panel/README.md` and `.bz-panel/ARCHITECTURE.md` are 100% WebBrain documents.
- Root `README.md` contains historical WebBrain version entries.

### 9. Build & Generated Copies
- `build/` directory generated during `npm run build:chrome` or `npm run build:all`.
- `.bz-panel/` acts as an unbuilt/parallel source copy that diverged from `src/chrome/`.

### 10. File Categorization Summary

| Classification | Description & Examples |
| :--- | :--- |
| **NEW BROZER Code** | On-device visual grounding (`run_owlvit_eval.cjs`, `webgpu.js` OWL-ViT integration), Privacy Engine OCR sanitization (`privacy-engine.js`), E2E test suites (`test/visual-grounding-e2e.mjs`). |
| **MODIFIED WebBrain Code** | `src/chrome/src/ui/sidepanel.js`, `src/chrome/src/ui/settings.js`, `src/chrome/src/background.js`, `src/chrome/src/agent/agent.js` (UI labels changed to BROZER, internal logic intact). |
| **UNMODIFIED WebBrain Code** | Entire `.bz-panel/` subtree, `.bz-panel/ARCHITECTURE.md`, `.bz-panel/README.md`. |
| **GENERATED / DEAD Copies** | Duplicate vendor files, `rebrand-comprehensive.cjs` script. |

---

## Action Plan & Remediation Strategy

1. **Remove / Deprecate `.bz-panel/` Tree:** Untrack and delete `.bz-panel/` from git to eliminate dual-copy divergence and obsolete documentation.
2. **Exhaustive Variable & Identifier Refactoring:** Rename `webbrain_cloud` -> `brozer_cloud`, `helpImproveWebBrain` -> `helpImproveBrozer`, download filename prefixes (`webbrain-` -> `brozer-`), and internal helper function names.
3. **URL & Issue Link Sanitization:** Update store links, issue tracker URLs, and privacy links to point to `padmanabhansb08/BROZER-v2`.
4. **Documentation Alignment:** Clean root `README.md`, `ARCHITECTURE.md`, and vendor `README.webbrain.md` files to clearly state BROZER-v2 branding and original project lineage.
