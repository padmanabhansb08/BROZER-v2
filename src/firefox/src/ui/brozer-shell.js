/**
 * BROZER side panel shell.
 *
 * Builds the panel's primary surface out of the six motion components. The
 * old presentation (header toolbar, provider navigator dropdown, chat canvas,
 * execution card, bottom mode row, composer, error card) has been deleted
 * from sidepanel.html; this module constructs what replaces it.
 *
 * Composition:
 *
 *        BROZER                 wordmark
 *     ASK  ACT  DEV             MotionSlidingTabs      (p16)
 *     ANALYZING PAGE            MotionThinkingStates   (p28 + p15)
 *     ✓ Reading page structure  MotionReasoningStream  (p29)
 *     response prose            MotionStreamingText    (p30)
 *   ( ＋ Ask anything      ✕ )  MotionInputDissolve    (p13)
 *
 * The primary element IDs the existing panel logic binds to (#user-input,
 * #messages, #btn-mode-ask …) are assigned to these new elements, so that
 * logic drives the NEW presentation rather than a retained copy of the old
 * one. This module runs before sidepanel.js's body executes — it is imported
 * first, and ES module imports evaluate before the importing module — so
 * every getElementById in that file resolves against this shell.
 *
 * Presentation only. No provider, secret, trace or tool data is read here.
 */

import {
  MotionInputDissolve,
  MotionSlidingTabs,
  MotionThinkingStates,
  MotionReasoningStream,
  MotionStreamingText,
  prefersReducedMotion,
} from './brozer-components.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function icon(paths, size = 15) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

/** A quiet icon button in the shell's language. */
function iconButton(id, label, paths) {
  const btn = el('button', 'bz-iconbtn');
  btn.type = 'button';
  if (id) btn.id = id;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.appendChild(icon(paths));
  return btn;
}

export function buildShell(root) {
  const app = root || document.getElementById('app');
  if (!app) return null;

  const shell = el('div', 'bz-shell');

  /* ── Masthead: wordmark + mode tabs ─────────────────────── */
  const head = el('header', 'bz-head');

  const brandRow = el('div', 'bz-head__row');
  const brand = el('span', 'bz-brand', 'BROZER');
  const headActions = el('div', 'bz-head__actions');

  const btnHistory = iconButton('btn-history', 'History',
    ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2']);
  const btnNew = iconButton('btn-clear', 'New conversation', ['M5 12h14', 'M12 5v14']);
  const btnSettings = iconButton('btn-settings', 'Settings',
    ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
     'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z']);
  const btnExpand = iconButton('btn-expand', 'Open in window',
    ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6']);

  headActions.append(btnHistory, btnNew, btnSettings, btnExpand);
  brandRow.append(brand, headActions);

  // ASK / ACT / DEV — the sliding-tabs recreation is the mode selector.
  const tabs = MotionSlidingTabs({
    label: 'Agent mode',
    tabs: [
      { label: 'ASK', value: 'ask', title: 'Ask about the page' },
      { label: 'ACT', value: 'act', title: 'Let BROZER act on the page' },
      { label: 'DEV', value: 'dev', title: 'Developer diagnostics' },
    ],
    onSelect: (mode) => shellApi.onModeRequest?.(mode),
  });
  tabs.root.id = 'mode-toggle';
  const tabButtons = tabs.root.querySelectorAll('.bz-tabs__tab');
  // The panel logic still addresses the mode controls by id; those ids now
  // belong to the new tabs, so it drives this presentation directly.
  tabButtons[0].id = 'btn-mode-ask';
  tabButtons[1].id = 'btn-mode-act';
  tabButtons[2].id = 'btn-mode-dev';

  const tabRow = el('div', 'bz-head__tabs');
  tabRow.appendChild(tabs.root);
  head.append(brandRow, tabRow);

  /* ── Execution band: state + sanitized activity ─────────── */
  const band = el('section', 'bz-band');
  band.id = 'agent-activity';
  band.classList.add('is-idle');

  const stateRow = el('div', 'bz-band__state');
  const state = MotionThinkingStates();
  // The existing activity toggle keeps its id and its job.
  const stateToggle = el('button', 'bz-band__toggle');
  stateToggle.type = 'button';
  stateToggle.id = 'activity-progress-toggle';
  stateToggle.setAttribute('aria-controls', 'messages');
  stateToggle.setAttribute('aria-expanded', 'true');
  stateToggle.setAttribute('aria-label', 'Toggle activity history');
  stateToggle.appendChild(state.root);

  const btnStop = el('button', 'bz-stop');
  btnStop.type = 'button';
  btnStop.id = 'btn-stop';
  btnStop.title = 'Stop';
  btnStop.append(icon(['M6 6h12v12H6z'], 13), el('span', null, 'Stop'));

  stateRow.append(stateToggle, btnStop);

  // The panel writes its status string into #activity-text; that element is
  // the integration point, and it feeds the visible swap above.
  const legacyState = el('span', 'bz-sr', '');
  legacyState.id = 'activity-text';
  legacyState.setAttribute('aria-hidden', 'true');

  const legacyLive = el('span', 'bz-sr', '');
  legacyLive.id = 'activity-live-status';

  const stream = MotionReasoningStream({ lines: 3, rowHeight: 24 });
  stream.root.id = 'bz-stream';

  band.append(stateRow, stream.root, legacyState, legacyLive);

  /* ── Response column ────────────────────────────────────── */
  const main = el('main', 'bz-main');
  main.id = 'chat-container';

  const messages = el('div', 'bz-messages');
  messages.id = 'messages';
  main.appendChild(messages);

  /* ── Composer ───────────────────────────────────────────── */
  const composer = el('footer', 'bz-composer');
  composer.id = 'input-area';

  const field = MotionInputDissolve({
    placeholder: 'Ask anything',
    // sidepanel.js owns submission: it captures the command, validates it,
    // starts the run and then calls back for the dissolve. The component must
    // not also handle Enter, or it would clear the value before the real
    // sender reads it.
    submitOnEnter: false,
    // The panel rotates the textarea's own placeholder with contextual hints,
    // so that is the one that must show.
    paintPlaceholder: false,
  });
  field.input.id = 'user-input';

  // Controls the existing logic expects to find, re-presented in the new
  // language rather than carried over from the old composer.
  const rail = el('div', 'bz-composer__rail');
  const btnAttach = iconButton('btn-attach', 'Attach',
    ['m16 6-8.4 8.6a2 2 0 0 0 2.8 2.8l8.4-8.6a4 4 0 0 0-5.6-5.6l-8.4 8.6a6 6 0 0 0 8.5 8.5l8.4-8.6']);
  const btnMic = iconButton('btn-mic', 'Voice',
    ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3']);
  const btnSend = iconButton('btn-send', 'Send', ['M5 12h14', 'm12 5 7 7-7 7']);
  btnSend.classList.add('bz-iconbtn--send');
  rail.append(btnAttach, btnMic, btnSend);

  // Retained hidden inputs/regions the panel logic addresses by id.
  const hiddenClear = el('button', 'bz-sr');
  hiddenClear.type = 'button';
  hiddenClear.id = 'btn-clear-input';
  const highlight = el('div', 'bz-sr');
  highlight.id = 'input-highlight';
  highlight.setAttribute('aria-hidden', 'true');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'file-attach-input';
  fileInput.accept = 'image/*,application/pdf,application/json,text/plain,text/csv,.json,.txt,.csv';
  fileInput.multiple = true;
  fileInput.hidden = true;

  const queued = el('div', 'bz-queued');
  queued.id = 'queued-messages';
  queued.setAttribute('role', 'list');
  queued.setAttribute('aria-live', 'polite');
  queued.classList.add('hidden');

  const slash = el('div', 'bz-slash hidden');
  slash.id = 'slash-command-menu';
  slash.setAttribute('role', 'listbox');

  const attachments = el('div', 'bz-attachments hidden');
  attachments.id = 'attachment-preview-list';

  const fieldRow = el('div', 'bz-composer__row');
  fieldRow.append(field.root, rail);

  composer.append(queued, slash, attachments, fieldRow,
    hiddenClear, highlight, fileInput);

  shell.append(head, band, main, composer);
  app.prepend(shell);

  // The pill is positioned from the active tab's measured box, so it can only
  // be placed once the shell has been laid out. The panel sets the real mode
  // during its own start-up — which may happen before that first layout — so
  // seed ASK immediately and re-snap after layout; whatever mode the panel
  // adopts overwrites this without animating.
  tabs.setActive('ask', { animate: false });
  requestAnimationFrame(() => tabs.refresh());

  /* ── Error state, in the shell's own language ───────────── */
  function renderError(message, { onRetry } = {}) {
    clearError();
    const box = el('div', 'bz-error');
    box.setAttribute('role', 'alert');
    box.appendChild(el('div', 'bz-error__title', 'ERROR'));
    // The message is whatever the panel already formats for display; it is
    // inserted as text, never parsed as markup.
    box.appendChild(el('div', 'bz-error__body', String(message || 'Request failed')));
    if (onRetry) {
      const retry = el('button', 'bz-error__retry', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => onRetry());
      box.appendChild(retry);
    }
    band.appendChild(box);
    return box;
  }

  function clearError() {
    for (const node of band.querySelectorAll('.bz-error')) node.remove();
  }

  const shellApi = {
    app, shell, head, band, main, messages, composer,
    tabs, state, stream, field,
    buttons: { btnStop, btnSend, btnAttach, btnMic, btnSettings, btnExpand, btnHistory, btnNew },
    renderError,
    clearError,
    onModeRequest: null,
    onSubmit: null,
    get reducedMotion() { return prefersReducedMotion(); },
  };

  return shellApi;
}

/* The shell must exist before sidepanel.js queries for its elements. This
   module is imported first by that file, and imports evaluate before the
   importing module's body, so building here is what makes those lookups
   resolve against the new presentation. */
const shellApi = typeof document !== 'undefined' && document.getElementById('app')
  ? buildShell()
  : null;

export default shellApi;
export { shellApi };
