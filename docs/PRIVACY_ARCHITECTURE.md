# WebBrain / Brozer Privacy Architecture Specification & Residual Risk Matrix

## Executive Summary

WebBrain (Brozer) implements an end-to-end local privacy engineering pipeline that prevents raw text PII, unredacted screenshot pixels, or resolved secrets from crossing outbound external LLM provider APIs or being committed to local storage disk surfaces.

---

## 1. System Architecture Sitemap & Dataflow Map

```
                     RAW BROWSER OBSERVATION / HOSTILE DOM
                                       │
                                       ▼
                         [ PHASE 1 & 2 PRIVACY GATE ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     Phase 1 Text Privacy                           Phase 2 Visual Privacy
    - Regex PII Classifiers                        - Local OCR & Text BBoxes
    - Unique Placeholders                          - +5px BBox Expansion
      (<EMAIL_1>, <PASSWORD_1>)                    - Opaque Blackout (#000000)
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                           OUTBOUND PROVIDER BOUNDARY
                      (Decorated Provider Entry Point)
                                       │
                                       ▼
                              EXTERNAL LLM API
                        (Receives Placeholders Only)
                                       │
                                       ▼
                             LLM COMPLETION TOOL CALL
                                       │
                                       ▼
                       [ PHASE 3 ACTION RESOLUTION GATE ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     1. ActionValidator.validate()                2. SecretStore.resolve()
    - Validates target field & origin             - RAM-Only Vault Resolution
    - Checks category restriction                 - Single-Use Credential Burn
    - Prohibits URLs/navigate/scripts                          │
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                          LOCAL BROWSER / CDP EXECUTION
                                       │
                                       ▼
                          RETURN-CHANNEL SANITIZATION
                         (Strips reflected raw secrets)
                                       │
                                       ▼
                      [ PHASE 4 LOCAL PERSISTENCE GATE ]
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  IndexedDB Traces           Conversation History                User Memory
(chrome.storage.session)    (chrome.storage.session)        (chrome.storage.local)
- Placeholders only         - Placeholders only             - Credentials excluded
- Lossless sanitized        - Legacy read sanitization      - Contact info stripped
```

---

## 2. Core Security Invariants

1. **Outbound Invariant**: External LLM providers receive placeholdered text and blackout-redacted PNG images only. Raw PII or secrets NEVER cross the provider boundary.
2. **Action Invariant**: Placeholders are authorized by `ActionValidator` BEFORE resolution. Secret placeholders are strictly prohibited in navigation targets, URLs, query parameters, headers, or arbitrary scripts.
3. **Vault Invariant**: `SecretStore` is 100% memory-only (RAM-only). Vault mappings are never serialized to disk, storage APIs, or log strings.
4. **Persistence Invariant**: Every persistence surface independently runs `PrivacyEngine.sanitizeSync()` at the exact write boundary before committing data.
5. **Fail-Closed Invariant**: Any sanitization failure, low-confidence OCR scan (< 0.60), or malformed payload fails closed to an opaque blackout or a sanitized text fallback block without exposing raw data.

---

## 3. Transparent Residual Risk Matrix & Limitation Disclosure

| Residual Risk ID | System Limitation / Scope Boundary | Mitigating Control & Design Guarantee |
| :--- | :--- | :--- |
| **Risk 01: Low-Contrast / Stylized Text in Images** | OCR engines may miss low-contrast, highly stylized, or obscured text in screenshots. | **Fail-Closed OCR Policy**: If OCR scan confidence is low (< 0.60) or scan is unverified, the image is dropped and replaced with a non-sensitive text block (`[REDACTED: Visual privacy inspection failed]`). Raw images are never sent. |
| **Risk 02: Proprietary Binary File Attachments** | Non-standard binary file formats (e.g., legacy proprietary formats) cannot be natively parsed into text blocks. | **Binary File Omitting**: Binary attachments are converted to durable reference handles or sanitized text placeholders (`[Document bytes omitted from session recovery]`). Raw binary bytes are never stored in session snapshots. |
| **Risk 03: OS-Level Root Compromise** | Extension local storage APIs (`chrome.storage.local`) reside on local user disk. An OS-level malware with root access could read extension disk files. | **Memory Vault & Write Boundary**: `SecretStore` raw secrets exist only in RAM during active execution and are never written to extension storage. Phase 4 ensures local storage files contain sanitized placeholdered data only. |
| **Risk 04: Third-Party Provider Behavior** | External LLM API providers receive placeholdered data. If a user explicitly types a secret that bypasses regex patterns (e.g. non-standard secret structure), it might reach the provider. | **Extensible Regex & Red-Team Audit**: Pattern classifiers cover emails, phones, credit cards, passwords, API keys, and custom canary formats. Phase 5 red-team suite verifies zero canary leakage across 25 attack vectors. |
