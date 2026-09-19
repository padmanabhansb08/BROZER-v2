# BROZER Side Panel — UI/UX Rebuild

Frontend-only rebuild. No backend, agent, privacy, security, provider,
persistence or test code was modified, and no test suite was run or changed.

This document supersedes an earlier attempt that restyled the existing markup
and added animation around it. That approach was rejected and has been
removed; what follows is a reference-first rebuild.

---

## 1. Existing side-panel frontend identified

Traced from the extension entry points rather than assumed:

| Evidence | Path |
| --- | --- |
| Chrome opens the panel here | `src/chrome/src/background.js:2293` → `src/ui/sidepanel.html` |
| Firefox `sidebar_action.default_panel` | `src/firefox/manifest.json:30` |
| Markup | `src/chrome/src/ui/sidepanel.html` |
| Logic | `src/chrome/src/ui/sidepanel.js` (14,535 lines) |
| Styles | `src/chrome/styles/sidepanel.css` (4,997 lines) |

The tree is duplicated under `src/firefox/`. **Every change was applied to
both, and the four new files are byte-identical across them.**

---

## 2. Old UI removed

Four regions were **deleted outright** from `sidepanel.html` — not hidden, not
renamed, not wrapped:

| Deleted block | What it contained |
| --- | --- |
| `.header-shell` | top utility toolbar, provider "navigator" dropdown, language picker, UI-scale menu, status dot |
| `#chat-shell` | old conversation canvas, empty-state hero, message composition |
| `#agent-activity` | old execution card and spinner |
| `#input-area` | old bottom mode row and composer |

Each is replaced in the file by a comment recording the removal. Verified in
the running panel: `.header-shell` and `#chat-shell` no longer exist in the
DOM.

Also removed: the `brozer-theme.css` link (the earlier recolour attempt) and
the first attempt's `brozer-motion.*` / `brozer-panel.*` files.

### What is retained, and why

`sidepanel.js` is not a presentation layer — it is the hub for ~25 subsystems
(i18n across 20 locales, permission gates, markdown + KaTeX, recommended
actions, watch commands, offline-RAG readiness, run capture, persistence). It
binds **92 element ids**.

The rebuild therefore separates logic from presentation as instructed:

- **The new components own the primary ids.** `#user-input` is the dissolve
  field's textarea, `#mode-toggle` / `#btn-mode-ask|act|dev` *are* the sliding
  tabs, `#messages`, `#agent-activity`, `#btn-stop` and the composer rail all
  belong to the new shell. The existing logic therefore drives the **new**
  presentation directly — it is not talking to a retained copy of the old UI.
- **Eight secondary controls** (provider picker, language picker, UI scale,
  status dot, WebGPU toggle, chat navigation, recommended actions,
  store-review prompt) are kept in a clearly marked compatibility mount
  (`#bz-legacy`) so their subsystems do not crash. Their old toolbar
  presentation is gone from the layout. This is a known limitation — see §11.

---

## 3. Reference-first implementation

Each demo was recreated **in isolation first** and verified against the
reference before being adapted.

The six demos share one page on transitions.dev under token prefixes, which
were read out of the live CSSOM rather than eyeballed:

| Demo | Prefix | Key reference values |
| --- | --- | --- |
| input-clear-with-dissolve | `p13` | clear 1000ms, text-out 400ms, fly 12px, blur 2px, glow delay 50ms / peak 0.15 |
| tabs-sliding | `p16` | 250ms, `cubic-bezier(0.22,1,0.36,1)`, pill transform+width written inline |
| shimmer-text | `p15` | 2000ms linear infinite, band 400%, `background-clip:text` |
| thinking-states | `p28` | swap 150ms, gap 50ms, distance 8px, blur 2px, shimmer 2000ms |
| reasoning-stream | `p29` | step 500ms, mask fade 28px, content translateY |
| streaming-text | `p30` | word 350ms, gap 60ms, blur 1px |

An isolated gallery rendered all six side by side. **Structural metrics
matched the reference exactly**: the dissolve field at 256×36 with 48px
radius and identical `0 40px 0 32px` padding on input and mirror; the tab bar
at 3px padding / 48px radius with 30px tabs; the 400% shimmer band; the
28px stream mask.

**Full-motion computed values, measured in-browser:**

| Component | Measured | Reference |
| --- | --- | --- |
| dissolve words | 0.4s, delays 0 / 26 / 52ms, `cubic-bezier(0.22,1,0.36,1)`, transform+filter+opacity | 400ms ✓ |
| tabs pill | 0.25s, transform + width, same curve | 250ms ✓ |
| shimmer | `bz-shimmer 2s linear infinite`, band `400% 100%` | 2000ms linear ✓ |
| state swap | 0.15s, transform/filter/opacity, `ease-in-out` + 2s shimmer | 150ms ✓ |
| stream | 0.5s, `cubic-bezier(0.22,1,0.36,1)` | 500ms ✓ |
| streamed words | 0.35s, opacity + filter, same curve | 350ms ✓ |

No animation library was added.

---

## 4. New architecture

```
src/{chrome,firefox}/styles/brozer-components.css   tokens + 6 demo recreations
src/{chrome,firefox}/styles/brozer-shell.css        panel visual language
src/{chrome,firefox}/src/ui/brozer-components.js    6 components
src/{chrome,firefox}/src/ui/brozer-shell.js         builds the panel
```

Each component is a factory that **builds its own DOM**. None decorates
existing markup:

```
MotionInputDissolve    → command composer
MotionSlidingTabs      → ASK / ACT / DEV
MotionShimmerText      → active state label
MotionThinkingStates   → execution-state transitions
MotionReasoningStream  → sanitized live activity
MotionStreamingText    → real model response
```

Animation logic is not duplicated: shared helpers (`onNextPaint`,
`wordSpans`, `readDurationMs`) live once at module top, and every timing sits
in CSS tokens so JS and CSS cannot drift.

`brozer-shell.js` composes them and is imported **first** by `sidepanel.js`.
ES module imports evaluate before the importing module's body, so the shell
exists before any `getElementById` in that file runs.

### Composition

```
BROZER                          wordmark + 4 quiet actions
ASK   ACT   DEV                 MotionSlidingTabs
ANALYZING PAGE          [Stop]  MotionThinkingStates + shimmer
✓ Reading page structure        MotionReasoningStream
✓ Found relevant content
→ Preparing browser action
Summarize this page             prose turns, hairline separators
This page is the …              MotionStreamingText
( ＋  Ask anything    ⧉ ⌥ → )   MotionInputDissolve
```

No dashboard, statistics, graphs, hero, cards, neon or gradients.

---

## 5. Frontend state / event mapping

Existing interfaces are consumed; none were changed to suit the UI.

| Existing frontend source | Presentation |
| --- | --- |
| `agentMode` + `setMode()` | sliding tabs |
| `setActivityText()` | state swap + shimmer |
| `showActivity()` | activity stream row |
| `hideActivity()` | settle stream, stop shimmer, idle the band |
| `text_delta` | word-wise reveal |
| main send path | command dissolve |

```
agent event (thinking / tool_call / tool_progress / text_delta / run_complete)
  → handleAgentUpdateMessage()      [existing, untouched]
    → showActivity() / setActivityText() / renderAssistantTextUpdate()
      → shellApi.*                  [new, presentation only]
```

**Mode.** A tab click only *requests* a mode via `onModeRequest` → `setMode()`,
which commits `agentMode` and then tells the tabs what was adopted. The pill
can never show an unadopted mode.

**Submission.** `sidepanel.js` owns it. The command is captured into `text`
and handed to the run, then the field is emptied, then the dissolve plays
over a snapshot. The promise is deliberately never awaited. The component's
own Enter handler is disabled in the panel (`submitOnEnter: false`) so two
handlers cannot race on one keypress.

---

## 6. Security boundary

- Components receive **only strings the panel already prepared for display**.
  No provider payloads, secrets, traces or tool arguments are read.
- No access to SecretStore, the privacy engine, the visual detector, the image
  redactor, the action validator or trace privacy.
- Every value is rendered with `textContent`. **No `innerHTML` appears in any
  new module.**
- The activity stream shows sanitized user-facing labels only — the same
  strings the panel already displays. It is not chain-of-thought, and no
  internal model reasoning is rendered.
- No secret, token, key or header reaches the DOM, CSS variables or animation
  state.

Protected files confirmed untouched: `privacy-engine.js`, `visual-detector.js`,
`image-redactor.js`, `secret-store.js`, `action-validator.js`,
`trace/privacy.js`. (`action-validator.js` shows as modified in git, but that
predates this work — it is in the session's opening snapshot.)

The 302-test security suite and 21-test production validation suite were
**not run and not modified**, per scope.

---

## 7. Performance

Per-word cost is flat: words are appended once and never re-created.
Measured in-browser, **1,000 words → exactly 1,000 spans in 14ms**; a headless
harness confirmed 1,000 appends with no DOM re-creation.

Other controls:

- One `rAF` per committed batch, not per token.
- The activity stream translates the whole list once per step rather than
  animating each row; backlog capped at 40 rows.
- `offsetLeft` / `offsetWidth` read only on a real mode change or resize.
- Only `transform`, `opacity` and `filter` animate. The tabs pill's `width` is
  the sole exception and must be measured, matching the reference.
- No animation loops, no polling `requestAnimationFrame`, no repeated
  `getBoundingClientRect`.

### Streaming re-render (carried over from the first attempt)

`renderStreamedAssistantMarkdownNow` reassigned `innerHTML` with the entire
response every animation frame — O(n) per frame, O(n²) across a long answer.
Markdown is block-structured and must be re-parsed rather than appended to, so
re-parsing is now spaced by length (every frame under 2,000 chars; 100 / 250 /
500ms as it grows). The terminal render always runs, so **final output is
byte-identical**.

---

## 8. Accessibility

- `prefers-reduced-motion: reduce` — all six keep working with movement
  removed: the dissolve collapses to a 150ms fade (the composer is still
  observably cleared), the pill snaps, the shimmer is replaced by a solid
  highlight colour so the active state still reads, labels cross-fade, rows
  fade, words render at full opacity.
- Tabs: `role="tablist"` / `role="tab"` / `aria-selected`, roving `tabindex`,
  Arrow / Home / End / Enter / Space.
- Execution state announced via a polite `role="status"` region; the visible
  label is `aria-hidden` so it is never announced twice.
- Visible focus rings on tabs, icon buttons, the state toggle and Retry.
- Integration-point elements (`#activity-text`, `#input-highlight`,
  `#btn-clear-input`) are screen-reader-only and never paint.

---

## 9. Responsive behaviour

Measured with real viewport resizing:

| Width | overflow-x | tabs fit | DEV visible | composer | state |
| --- | --- | --- | --- | --- | --- |
| 260px | none | yes (52→208) | yes | 138px | yes |
| 300px | none | yes | yes | 178px | yes |
| 360px | none | yes | yes | 238px | yes |
| 420px | none | yes | yes | 298px | yes |
| 560px | none | yes | yes | 438px | yes |

Below 330px paddings tighten; below 290px `btn-expand` drops so the mode
selector and composer stay whole (verified hidden at 260px). Above 560px the
measure is capped at 580px.

---

## 10. Manual UI test results

Run against the **real built extension** (`build/chrome`) served over HTTP with
a minimal `chrome.*` stub so the actual `sidepanel.html` and `sidepanel.js`
boot.

| # | Test | Result |
| --- | --- | --- |
| 1 | Submit a command | **Pass** — command captured intact, input empty *during* the dissolve, words mirrored and staggered 0/26/52ms, mirror torn down |
| 2 | ASK → ACT → DEV → ASK | **Pass** — 3 distinct pill positions, width adapts, returns exactly to start, aria + roving tabindex correct |
| 3 | Execution states | **Pass** — swap bounded at 2 nodes, settles to 1 |
| 4 | Active state shimmers | **Pass** — exactly one shimmering label at all times; stops on completion |
| 5 | Activity stream | **Pass** — one active row (`→`), rest settled (`✓`), backlog capped |
| 6 | Streamed response | **Pass** — mid-word deltas reassemble exactly; 1,000 words in 14ms |
| 7 | Reduced motion | **Pass** — the test browser reported `prefers-reduced-motion: reduce`, so 1–6 ran under it and all functioned; full-motion values verified separately via computed style (§3) |
| 8 | Error state | **Pass** — `FAILED` state with shimmer off, `ERROR / Provider request failed (400). / [Retry]` in the new language, panel intact |

### Old structures confirmed gone in the running panel

`.header-shell` absent · `#chat-shell` absent · `#user-input` is inside
`.bz-search` · `#btn-mode-*` are the tab buttons · `#bz-legacy` off-screen ·
band hidden while idle.

### Bugs found and fixed during testing

1. **Mirror ran words together** — the mirror is a flex row, which drops
   whitespace-only text nodes between spans. Words now live in one inline
   wrapper.
2. **Reveals could stall** — a hidden document never fires `rAF`, and neither
   does a *visible but occluded* one. Reproduced: 0 of 6 words revealed.
   `onNextPaint` now races a frame against a 32ms timer; re-verified 6 of 6.
3. **Shimmer leak** — a swap landing mid-swap cancelled the previous cleanup,
   orphaning that label; five states stacked, all shimmering. Stale labels are
   purged and an exiting label surrenders the shimmer.
4. **Old stylesheet reasserted itself** — `sidepanel.css` styles the primary
   elements by id, which outranks class selectors, so the old chrome bled
   through (the execution band would not hide). Shell intent is now
   re-declared at `.bz-shell #id` specificity.
5. **Two placeholders overlapped** — the component paints its own; the panel
   rotates the native one. The painted layer is now opt-out.
6. **Pill unpositioned on first paint** — it is placed from a measured box, so
   it is seeded and re-snapped after layout.
7. **User turns right-aligned** — old bubble CSS; the new column is prose,
   every turn at the same left edge.

---

## 11. Known frontend limitations

1. **Provider and language selection are only reachable through Settings.**
   Their dropdowns were part of the deleted toolbar and now sit in the
   compatibility mount. They work, but have no presentation in the new panel.
   Re-presenting provider choice in the new language is the most valuable
   follow-up.
2. **`#bz-legacy` exists at all.** Eight secondary controls are retained
   off-screen purely so their subsystems do not crash. This is a compatibility
   shim, not a design element.
3. **`sidepanel.css` is still linked** for subsystems outside this rebuild
   (settings, history, onboarding, PDF, permission prompts). It is overridden
   on every primary surface. Fully removing it means restyling those
   subsystems.
4. **Element ids are the integration contract.** The new components own them,
   but renaming them to match the new naming is a separate refactor.
5. **Not exercised against a live agent run.** Testing used the real built
   extension and the real event vocabulary, but a full run needs a configured
   provider. The seams are in place; end-to-end behaviour with a live provider
   is unverified.
6. **`test/run.js` was not run** (out of scope). Several assertions read the
   panel files and compare the Chrome and Firefox copies. Both received
   identical changes, but those assertions will need updating for the new
   markup before shipping.
7. **Onboarding, settings, history and PDF views** keep their existing
   appearance; they were out of scope.
