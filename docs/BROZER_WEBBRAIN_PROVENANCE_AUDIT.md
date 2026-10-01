# BROZER-v2 Exhaustive Codebase Audit & WebBrain Provenance Assessment Report

> **Date:** October 1, 2026  
> **Repository:** `padmanabhansb08/BROZER-v2`  
> **Branch:** `main`  
> **Package Version:** `36.5.0`  
> **License:** GPL-3.0-or-later  
> **Post-Remediation Status:** 0 unexpected active references found by the repository-wide rule-based scan  

---

## Executive Summary

An exhaustive repository-wide audit was conducted across all trees in `BROZER-v2` to evaluate branding, documentation, architecture, internal identifiers, vendor metadata, build artifacts, and code provenance relative to the upstream `webbrain-one/webbrain` lineage.

The audit initially confirmed evidence of WebBrain project lineage, residual branding, embedded documentation, and unrenamed internal code identifiers. Following a multi-phase structural remediation, the parallel `.bz-panel/` tree was removed, persistent state migration was implemented, default export filenames were updated, and provider regression unit tests were established.

A rule-based repository-wide scan confirmed **0 unexpected active references found by the repository-wide rule-based scan**. Remaining WebBrain strings are strictly classified as approved legacy state compatibility identifiers, external protocol API contracts, or third-party vendor provenance.

---

## Comprehensive Post-Remediation Status Matrix

| Audit Target | Architectural Classification | Post-Remediation Status | Remediation & Implementation Evidence |
| :--- | :--- | :--- | :--- |
| **`.bz-panel/` Tree** | Parallel Source / Legacy Copy | **REMOVED (Clean)** | Deleted 522 tracked legacy files in commit `b862f9ab`. `.claude/launch.json` updated to `src/chrome/`. |
| **Active Provider State** | Active BROZER Architecture | **MIGRATED to `brozer_cloud`** | Primary provider key updated to `brozer_cloud`. Auto-migration reads legacy `webbrain_cloud` stored settings, preserves API credentials, updates label to `BROZER NAVIGATOR`, and purges `webbrain_cloud` from active map ([`manager.js:1099`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/providers/manager.js#L1099)). |
| **Opt-In Preference State** | Active BROZER Preference | **MIGRATED to `helpImproveBrozer`** | Primary key updated to `helpImproveBrozer`. Storage reader checks `helpImproveBrozer ?? helpImproveWebBrain`. Writes populate both keys for non-destructive backwards compatibility ([`background.js:3931`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/background.js#L3931), [`settings.js:792`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/settings.js#L792)). |
| **Export Download Filenames** | Active BROZER UX | **MIGRATED to `brozer-*`** | Updated default filenames to `brozer-user-memory-*.json`, `brozer-run-*.png`, `brozer-recording`, `.brozer-workflow.json`, `brozer-config-*.json`, `brozer-traces-*.md`, `brozer-chat-*.md`, `brozer-screenshot.png`, `brozer-session-*.json`, `brozer-trace-*.json`. File picker accepts `.brozer-workflow.json` with `.webbrain-workflow.json` import fallback ([`sidepanel.js:4398`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/ui/sidepanel.js#L4398)). |
| **Migration Constants** | Legacy Compatibility Layer | **APPROVED (Preserved)** | `LEGACY_WEBBRAIN_CLOUD_PROVIDER_ID`, `LEGACY_WEBBRAIN_DEVICE_GUID_KEY`, `LEGACY_HELP_IMPROVE_WEBBRAIN_KEY` retained in [`manager.js`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/providers/manager.js) to guarantee zero config loss on upgrade. |
| **External API Contracts** | External Protocol Boundary | **APPROVED (Preserved)** | `X-WebBrain-Sync-Verifier` header ([`profile-sync.js:229`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/src/profile-sync.js#L229)), `https://api.webbrain.one/v1` endpoint, `webbrain-config/1` schema ID, and `webbrain-chat-workflow/1` schema ID preserved until backend API migration. |
| **Vendor Metadata & SBOMs** | Third-Party Provenance | **APPROVED (Preserved)** | `README.webbrain.md` files in [`src/chrome/vendor/bitgpu/`](file:///c:/Users/aml/Desktop/BROZER-v2/src/chrome/vendor/bitgpu/), `fflate`, `libzim`, `sqlite`; `webbrain-emscripten-libzim:3.1.41` in `libzim/sbom.json`; `webbrain-one/webbrain-compass-tiny-v2.1` in `transformers/README.md`. |
| **Migration Unit Test Suite** | Automated Regression Test | **PASSED (38 Unit Tests)** | Created [`test/provider-migration-regression.mjs`](file:///c:/Users/aml/Desktop/BROZER-v2/test/provider-migration-regression.mjs) asserting credential preservation, active-provider migration, and preference fallback. |

---

## Architectural Classification Model

```
BROZER-v2 Codebase Classification
├── ACTIVE BROZER CODE & UX
│   ├── Active Provider ID: 'brozer_cloud'
│   ├── Active Preference Key: 'helpImproveBrozer'
│   ├── User Export Filenames: 'brozer-*'
│   └── User Interface Display: BROZER / BROZER NAVIGATOR
│
├── LEGACY COMPATIBILITY LAYER
│   ├── Provider Migration Constant: LEGACY_WEBBRAIN_CLOUD_PROVIDER_ID ('webbrain_cloud')
│   ├── Device GUID Migration Key: LEGACY_WEBBRAIN_DEVICE_GUID_KEY ('webbrainDeviceGuid')
│   ├── Preference Migration Key: LEGACY_HELP_IMPROVE_WEBBRAIN_KEY ('helpImproveWebBrain')
│   └── Import Schema Fallback: '.webbrain-workflow.json'
│
├── EXTERNAL CONTRACT BOUNDARY
│   ├── Protocol Header: 'X-WebBrain-Sync-Verifier'
│   ├── Server Base URL: 'https://api.webbrain.one/v1'
│   └── Portable Schema Identifiers: 'webbrain-config/1', 'webbrain-chat-workflow/1'
│
└── THIRD-PARTY PROVENANCE & LICENSES
    ├── Vendor Submodule Integrations: src/chrome/vendor/*/README.webbrain.md
    ├── Build SBOM Identifiers: 'webbrain-emscripten-libzim:3.1.41'
    └── Upstream Project Lineage & GPL-3.0 License Attribution
```

---

## Conclusion & Verification Audit Finding

**Final Finding:** 0 unexpected active references found by the repository-wide rule-based scan.

All active user-facing UI labels, default export filenames, and primary state keys operate strictly under BROZER-v2 identity. All remaining WebBrain strings serve explicit, approved roles in backward-compatible state migration, external server protocol contracts, or third-party vendor compliance.
