# BROZER POST-RELEASE CODE AUDIT

## 1. Executive Summary
A comprehensive post-release code audit of the BROZER-v2 visual agent architecture has revealed severe integration and security flaws that were missed during synthetic Phase 4 testing. While the isolated WebGPU and Grounding logic function correctly in tests, the production integration inside `agent.js` was disconnected, and the `PrivacyEngine` boundary had a severe blind spot. Both local issues were addressed and hardened.

## 2. Files Inspected
- `src/chrome/src/agent/agent.js`
- `src/chrome/src/agent/action-validator.js`
- `src/chrome/src/agent/secret-store.js`
- `src/chrome/src/agent/tools.js`
- `src/chrome/src/providers/webgpu.js`
- `src/chrome/src/providers/privacy-engine.js`
- `src/chrome/src/offscreen/inference-worker.js`
- `src/chrome/src/offscreen/vision-inference-host.js`

## 3. Critical Findings
- **Missing Grounding Integration:** `WebGPUVisionProvider.ground()` is completely unreferenced in the production `agent.js`. The VLM `click` tool only accepts x/y or a CSS selector; it has no semantic target parameter to trigger OWL-ViT. OWL-ViT is essentially dead code in production.
  - **Reproduction:** "Click the Buy Now button" forces the VLM to guess a selector or index because there's no coordinate lookup pipeline for semantic names in `_prepareClickCoordinates`.
  - **Severity:** CRITICAL
- **SecretStore Injection Bypassed:** `args = SecretStore.resolvePlaceholders(...)` was commented out at `agent.js:32616`.
  - **Reproduction:** Triggering a `set_field` tool for a password field injects the literal string `<PASSWORD_1>` instead of resolving it to the secure credential.
  - **Severity:** CRITICAL

## 4. High Findings
- **PrivacyEngine Grounding Bypass:** `decorateProviderWithPrivacyEngine` in `privacy-engine.js` did not wrap the `ground()` method. If `ground()` were invoked, it would send raw unredacted screenshots to the Vision model.
  - **Severity:** HIGH (Privacy)

## 5. Medium Findings
- **Vision Worker Serialization Blocking:** `vision-inference-host.js` handles requests with `exclusive: true`. If a WebGPU model hangs or a large download stalls, all concurrent agent visual interactions are blocked rather than queuing efficiently or gracefully timing out per-tab.
  - **Severity:** MEDIUM (Reliability)

## 6. Low Findings
- **Hardcoded Model Revision Confidence:** While 4G pinned the local model, the UI fallback behavior relies strictly on `Transformers.js` correctly routing `env.localModelPath`. The directory is fragile to missing files (like `vocab.txt` missing from the repo natively).
  - **Severity:** LOW (UX)

## 7. Security Findings
- **Secret Placeholders:** (Addressed in Critical Findings). The `ActionValidator` was operating on unresolved placeholders which were then dispatched directly to CDP without resolution.

## 8. Privacy Findings
- **Raw PII Leakage via ground():** (Addressed in High Findings). The `ground` method bypassed the PII redaction wrapper.

## 9. OWL-ViT / Grounding Findings
- **Ambiguous Targets:** Without VLM hinting, duplicate buttons (e.g. two "Buy Now" elements) return multiple detections from OWL-ViT. The system has no logic in `webgpu.js` to disambiguate identical targets.

## 10. WebGPU / Worker Findings
- **Worker Leaks:** A hanging WebGPU inference will trigger a `CANCELLATION_GRACE_PERIOD_MS` worker termination, but `pendingVisionRequests` might leave dangling promises in the host if not properly cleaned up after `resetVisionWorker`.

## 11. Performance Findings
- **Screenshot Base64 Copies:** Image buffers are converted to base64 strings multiple times (inside `PrivacyEngine`, then inside the `ground` network transport, then back into a blob for `Transformers.js`). This creates immense memory pressure for large 4K screenshots.

## 12. Concurrency Findings
- **Cross-Tab Resource Contention:** Multiple tabs invoking `chat` simultaneously will lock the `vision-inference-host`, starving background observers or concurrent visual operations.

## 13. Failure-Recovery Findings
- **Failed OCR Fallback:** If OCR fails, the system fails closed gracefully, but the visual grounding pipeline (if it were integrated) lacks a coordinated fallback to DOM element locations.

## 14. Test-Quality Findings
- **Mocked E2E Tests:** `run_grounding_click.cjs` bypassed `agent.js` entirely, directly calling `webgpu.js`. It proved the model worked in isolation but falsely reported E2E integration success.
- **Security Parity:** The `npm run test:security` suite strictly covers DOM payload evasion and ARIA spoofing (60/60). It lacks assertions for `SecretStore` resolution, missing the commented-out code.

## 15. Practical User Scenarios
- **Multiple "Buy Now" Buttons:** Fails. (Missing disambiguation).
- **Extension Restart during Inference:** Will strand the CDP action state.
- **Login Pages:** Fails currently due to the literal `<PASSWORD_1>` placeholder injection.

## 16. Recommended Fixes
- Uncomment `SecretStore.resolvePlaceholders` (Implemented).
- Add `ground()` wrapper to `PrivacyEngine` (Implemented).

## 17. Findings That Require Architecture Changes
- Integrating `WebGPUVisionProvider.ground()` into `agent.js`. The `click` tool schema must be updated to accept a `target_description` parameter. `_prepareClickCoordinates` must be refactored to asynchronously query the VisionProvider.

## 18. Findings That Can Be Fixed Locally
- `agent.js` SecretStore bug. (Fixed)
- `privacy-engine.js` ground bypass. (Fixed)

## 19. Remaining Known Limitations
- Firefox visual grounding unsupported.
- Vision Worker serialization limits concurrency to 1 active inference.

## 20. Final Engineering Assessment
- Privacy Boundary (Pre-Fix): SECURITY ISSUE
- Privacy Boundary (Post-Fix): PASS
- E2E Visual Integration: BUG
- Secret Handling (Pre-Fix): BUG
- Secret Handling (Post-Fix): PASS
- Security Payload Tests: PASS
- Firefox Native Messaging: KNOWN LIMITATION
