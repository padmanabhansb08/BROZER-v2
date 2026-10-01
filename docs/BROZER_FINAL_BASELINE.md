# BROZER-v2 Baseline Assessment Document

## System & Commit Metadata
- **Repository**: https://github.com/padmanabhansb08/BROZER-v2
- **Branch**: `main`
- **Commit**: `754cb8d418328370b5fbf4c05574fc2b7b653ee1`
- **Author**: padmanabhansb08 <padmanabhansb08@gmail.com>
- **Commit Message**: "add everything ignoring gitignore"
- **Timestamp**: 2026-09-28T08:35:00Z

## Execution Environment
- **Operating System**: Windows_NT 10.0.26200 (x64)
- **CPU Architecture**: 13th Gen Intel(R) Core(TM) i7-13620H (16 logical cores)
- **Memory**: 15.62 GB RAM
- **Runtime**: Node.js v24.12.0 / npm v11.6.4
- **Target Browser Extensions**: Chrome Manifest V3 (`src/chrome`), Firefox Manifest V3 (`src/firefox`)

## Test Suite Execution Results (Pre-Fix Baseline)

| Test Suite File | Status | Passed / Total | Key Findings & Observations |
|---|---|---|---|
| `test/privacy-engine.mjs` | ✖ FAIL | 0 / 1 | Fails on "PrivacyEngine - Original message object immutability" (`TypeError: Cannot read properties of undefined (reading 'content')`). |
| `test/visual-privacy-engine.mjs` | ⚠ MOCKED | 21 / 21 | Uses `LocalGlyphOCR` with hardcoded string returns ("alice@example.com"). |
| `test/secret-store-action-validator.mjs` | ⚠ PARTIAL | 33 / 33 | Unit tests pass, but typed opaque reference objects `{ type: "secret_ref", ... }` are missing at runtime. |
| `test/production-validation-suite.mjs` | ⚠ MOCKED | 21 / 21 | Benchmark Gate 6C-02 claims 0.01ms visual OCR due to hardcoded fake OCR. |
| `test/pdf-selection.mjs` | ✖ FAIL | 10 / 12 | 2 Playwright E2E tests fail due to missing Chromium binary in environment. |
| `test/provider-model-limits.mjs` | ✔ PASS | 1 / 1 | Provider limit validation succeeds. |
| `test/security/injection-corpus.mjs` | ✔ PASS | 60 / 60 | Prompt injection boundary checks hold against 27 payloads. |
| `test/rich-text-toolbar-guard.mjs` | ✔ PASS | 33 / 33 | Rich text toolbar guard suite passes. |
| `test/selection-scope-restoration.mjs` | ✔ PASS | 1 / 1 | Selection scope restoration test passes. |

## Known Baseline Failures & Defects

### 1. `webbrain_cloud` Upstream Runtime Error (Phase 1 Target)
- **Symptom**: Task 1 ("open apple care") succeeds on fresh startup. Task 2 ("open youtube and switch my google account") fails with `webbrain-cloud error 400`, `WebBrain Compass request failed`, `webbrain_cloud_upstream_error`.
- **Root Cause Area**: Stale provider state, session context accumulation, or fallback routing to unconfigured `webbrain_cloud` endpoint.

### 2. Hardcoded / Fake Local OCR (Phase 2 Target)
- **Symptom**: `LocalGlyphOCR` returns hardcoded email (`alice@example.com`) and API key (`sk-proj-1234...`) rather than real local visual OCR detection.
- **Impact**: Violates Rule Zero ("NO FAKE SUCCESS"). Real sensitive text (passwords, cards, emails, tokens) is not detected dynamically from arbitrary page screenshots.

### 3. WebGPU / ONNX Vision Model Live Pipeline (Phase 3 & 4 Target)
- **Symptom**: Local WebGPU vision fallback is present in code but not fully integrated or validated with real local WASM/ONNX OCR + real visual grounding on local pages.
- **Impact**: Visual privacy pipeline relies on synthetic probe results instead of actual local model visual understanding.

### 4. Secret Resolution Invariant & Typed Internal Representation (Phase 5 Target)
- **Symptom**: SecretStore handles placeholder strings `<EMAIL_1>`, but lacks a strict typed internal representation `{ type: "secret_ref", id: "EMAIL_1", category: "EMAIL" }` preventing spoofing of literal string placeholders as secret references.

### 5. False Benchmark & Performance Claims (Phase 7 Target)
- **Symptom**: Benchmark Gate 6C-02 reports `0.010 ms` for visual OCR and redaction because OCR output was hardcoded.

### 6. Legacy Branding & Leakage (Phase 10 & 11 Target)
- **Symptom**: UI and provider configs contain legacy strings ("WebBrain", "WebBrain Compass", "webbrain_cloud", "webbrain.one").

## Provider & Browser State
- **Active Provider**: Defaults to `webbrain_cloud` (labeled "BROZER NAVIGATOR").
- **WebGPU Availability**: WebGPU / Transformers WASM engine present in codebase (`build/chrome/vendor/transformers/transformers.web.js`), requires verification with real sanitized images.
- **UI State**: Basic sidepanel shell with legacy WebBrain branding and technical dumps.
- **Agent State**: Uses agent lifecycle loops in background service worker (`src/chrome/src/agent/agent.js`).
