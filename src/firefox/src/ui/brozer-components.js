/**
 * BROZER motion components.
 *
 * Six recreations of transitions.dev demos. Each factory builds its own DOM
 * from the demo's composition — none of them decorates pre-existing markup.
 * Pairs with styles/brozer-components.css, which holds every timing, easing
 * and metric so the two cannot drift.
 *
 *   MotionInputDissolve   <- p13   -> BROZER command composer
 *   MotionSlidingTabs     <- p16   -> ASK / ACT / DEV
 *   MotionShimmerText     <- p15   -> active execution state
 *   MotionThinkingStates  <- p28   -> execution-state transitions
 *   MotionReasoningStream <- p29   -> sanitized live activity
 *   MotionStreamingText   <- p30   -> real model response
 *
 * Shared rules:
 *  - Presentation only. A component is told what happened; it never decides
 *    whether something happens, and never gates a run.
 *  - Every string is written with textContent. No component builds markup
 *    from a value it was handed.
 */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion() {
  try {
    return window.matchMedia(REDUCED_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Run `fn` on the next paint.
 *
 * A hidden document never fires requestAnimationFrame, and the side panel is
 * hidden often (tab switch, collapsed panel). A reveal that waits for a frame
 * would be stuck at opacity 0 until the panel returned. Nothing needs
 * animating while hidden, so the work runs immediately instead.
 */
function onNextPaint(fn) {
  // A hidden document never fires rAF — but neither does a *visible* one
  // whose window is occluded or whose compositor is stalled, so checking
  // document.hidden alone is not enough. Race the frame against a short
  // timer and take whichever arrives first: with painting the frame wins and
  // the transition starts from a committed value; without it the timer wins
  // and the element lands in its final state instead of stalling at
  // opacity 0.
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    fn();
  };
  const raf = requestAnimationFrame(run);
  const timer = setTimeout(run, 32);
  return () => {
    done = true;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
  };
}

function readDurationMs(el, name, fallback) {
  try {
    const raw = getComputedStyle(el || document.documentElement)
      .getPropertyValue(name).trim();
    if (!raw) return fallback;
    if (raw.endsWith('ms')) return parseFloat(raw) || fallback;
    if (raw.endsWith('s')) return (parseFloat(raw) || 0) * 1000 || fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Split text into word spans, preserving whitespace as plain text nodes. */
function wordSpans(text, className, onSpan) {
  const frag = document.createDocumentFragment();
  let i = 0;
  for (const part of String(text).split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      frag.appendChild(document.createTextNode(part));
      continue;
    }
    const span = el('span', className, part);
    onSpan?.(span, i);
    i += 1;
    frag.appendChild(span);
  }
  return { frag, count: i };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(paths, { size = 14, fill = 'none', stroke = 'currentColor', width = 2 } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', fill);
  svg.setAttribute('stroke', stroke);
  svg.setAttribute('stroke-width', String(width));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/* ═══════════════════════════════════════════════════════════
   1. MotionInputDissolve   (p13)
   BROZER: the command composer.
   ═══════════════════════════════════════════════════════════ */

/**
 * Recreates the demo's search field: rounded pill, leading icon, a text
 * mirror that carries the visible glyphs, a fake placeholder, a clear button
 * and the sweeping clear-glow.
 *
 * The mirror is what makes the dissolve possible without touching the value:
 * the real input's glyphs are hidden, the mirror holds per-word spans, and
 * only the mirror animates.
 *
 * @param {object} opts
 * @param {string} opts.placeholder
 * @param {(value:string)=>void} opts.onSubmit called with the captured
 *        command BEFORE any animation runs.
 */
export function MotionInputDissolve({
  placeholder = 'Ask anything',
  onSubmit,
  multiline = true,
  // When the host already owns submission (as the side panel does), it must
  // stay the only path that reads and clears the value — two handlers racing
  // on one Enter would clear the field before the real sender read it.
  submitOnEnter = true,
  // The demo paints its own placeholder so it can cross-fade with the mirror.
  // A host that rotates the native placeholder (as the side panel does) must
  // turn this off, or both layers render on top of each other.
  paintPlaceholder = true,
} = {}) {
  const root = el('div', 'bz-search');

  const icon = el('span', 'bz-search__icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.appendChild(svgIcon(['M4 12h16', 'M12 4v16'], { size: 14 }));

  const fake = el('div', 'bz-search__placeholder', paintPlaceholder ? placeholder : '');
  fake.setAttribute('aria-hidden', 'true');
  if (!paintPlaceholder) fake.style.display = 'none';

  const mirror = el('div', 'bz-search__mirror');
  mirror.setAttribute('aria-hidden', 'true');
  // The mirror is a flex row so its content centres vertically, exactly as
  // the reference field does. Flex containers drop whitespace-only text
  // nodes between inline children, which would run the words together, so
  // the spans live inside a single inline wrapper instead.
  const mirrorInner = el('span', 'bz-search__mirror-inner');
  mirror.appendChild(mirrorInner);

  const glow = el('span', 'bz-search__glow');
  glow.setAttribute('aria-hidden', 'true');

  const input = document.createElement(multiline ? 'textarea' : 'input');
  input.className = 'bz-search__input';
  if (multiline) input.rows = 1;
  else input.type = 'text';
  input.setAttribute('placeholder', placeholder);
  input.setAttribute('aria-label', placeholder);

  const clear = el('button', 'bz-search__clear');
  clear.type = 'button';
  clear.setAttribute('aria-label', 'Clear');
  clear.appendChild(svgIcon(['M18 6 6 18', 'M6 6l12 12'], { size: 14 }));

  root.append(icon, fake, input, mirror, glow, clear);

  let clearTimer = null;
  let glowTimer = null;
  let token = 0;

  /* The mirror must sit glyph-for-glyph over the input, so it copies the
     metrics that decide glyph positions. Read once per render, never in a
     loop. */
  function syncMirror() {
    const value = input.value;
    root.classList.toggle('has-value', value.length > 0);
    mirrorInner.textContent = '';
    if (!value) return;
    const { frag } = wordSpans(value, 'bz-search__word');
    mirrorInner.appendChild(frag);
  }

  function setValue(next) {
    input.value = String(next ?? '');
    syncMirror();
  }

  input.addEventListener('input', syncMirror);

  if (submitOnEnter) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
  }

  clear.addEventListener('click', () => {
    const value = input.value;
    input.value = '';
    dissolve(value);
    input.focus();
  });

  /**
   * Capture first, then animate. The command is read and handed to the
   * caller before a single class is toggled, so the animation can never
   * decide whether the command is sent.
   */
  function submit() {
    const command = input.value.trim();
    if (!command) return;
    const visible = input.value;
    input.value = '';        // the field is empty immediately
    onSubmit?.(command);     // the command is already on its way
    dissolve(visible);       // purely a visual echo
  }

  /** Play the dissolve over `text` while the field is already empty. */
  function dissolve(text) {
    const source = String(text ?? '');
    cancel();
    if (!source.trim()) { syncMirror(); return Promise.resolve(); }

    const mine = ++token;
    mirrorInner.textContent = '';
    const { frag, count } = wordSpans(source, 'bz-search__word', (span, i) => {
      // Staggering reads as the sentence coming apart left to right.
      span.style.setProperty('--bz-word-delay', `${i * 26}ms`);
    });
    mirrorInner.appendChild(frag);
    root.classList.remove('has-value');

    const reduced = prefersReducedMotion();
    const outDur = reduced
      ? readDurationMs(root, '--bz-dur-quick', 150)
      : readDurationMs(root, '--bz-p13-text-out-dur', 400);
    const total = reduced ? outDur : outDur + count * 26;

    return new Promise((resolve) => {
      onNextPaint(() => {
        if (mine !== token) return resolve();
        root.classList.add('is-clearing');
        if (!reduced) playGlow(total);
        clearTimer = setTimeout(() => {
          if (mine !== token) return resolve();
          root.classList.remove('is-clearing');
          mirrorInner.textContent = '';
          syncMirror();
          resolve();
        }, total + 40);
      });
    });
  }

  /* The glow rises to a peak early in the clear then falls away, sweeping
     left to right behind the departing words. */
  function playGlow(total) {
    const peakAt = 0.15;
    const peak = readDurationMs(root, '--bz-p13-glow-opacity', 0.42);
    const opacity = peak > 1 ? 0.42 : peak;
    const delay = readDurationMs(root, '--bz-p13-glow-delay', 50);
    glow.style.transition = 'none';
    glow.style.opacity = '0';
    glow.style.setProperty('--bz-glow-x', '20%');
    if (glowTimer) clearTimeout(glowTimer);
    glowTimer = setTimeout(() => {
      const rise = Math.max(80, total * peakAt);
      glow.style.transition = `opacity ${rise}ms var(--bz-ease-smooth-out), --bz-glow-x ${total}ms linear`;
      glow.style.opacity = String(opacity);
      glow.style.setProperty('--bz-glow-x', '80%');
      glowTimer = setTimeout(() => {
        glow.style.transition = `opacity ${total - rise}ms var(--bz-ease-smooth-out)`;
        glow.style.opacity = '0';
      }, rise);
    }, delay);
  }

  function cancel() {
    token += 1;
    if (clearTimer) clearTimeout(clearTimer);
    if (glowTimer) clearTimeout(glowTimer);
    clearTimer = glowTimer = null;
    root.classList.remove('is-clearing');
    glow.style.opacity = '0';
  }

  function setPlaceholder(text) {
    fake.textContent = text;
    input.setAttribute('placeholder', text);
    input.setAttribute('aria-label', text);
  }

  return {
    root,
    input,
    submit,
    dissolve,
    cancel,
    setValue,
    setPlaceholder,
    get value() { return input.value; },
    focus: () => input.focus(),
  };
}

/* ═══════════════════════════════════════════════════════════
   2. MotionSlidingTabs   (p16)
   BROZER: ASK / ACT / DEV.
   ═══════════════════════════════════════════════════════════ */

/**
 * Recreates the demo's tab bar: a padded track with a pill whose transform
 * and width are written inline so CSS tweens between measured positions.
 *
 * `onSelect` only *requests* a mode. The caller decides and calls back with
 * `setActive`, so the pill can never show a state the app did not adopt.
 */
export function MotionSlidingTabs({ tabs = [], onSelect, label = 'Mode' } = {}) {
  const root = el('div', 'bz-tabs');
  root.setAttribute('role', 'tablist');
  root.setAttribute('aria-label', label);

  const pill = el('span', 'bz-tabs__pill');
  pill.setAttribute('aria-hidden', 'true');
  root.appendChild(pill);

  const buttons = tabs.map((tab) => {
    const btn = el('button', 'bz-tabs__tab', tab.label);
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.value = tab.value;
    btn.setAttribute('aria-selected', 'false');
    btn.tabIndex = -1;
    if (tab.title) btn.title = tab.title;
    btn.addEventListener('click', () => onSelect?.(tab.value));
    btn.addEventListener('keydown', onKeyDown);
    root.appendChild(btn);
    return btn;
  });

  let active = null;
  let frame = null;

  function move(value, animate) {
    const btn = buttons.find((b) => b.dataset.value === value);
    if (!btn) return;
    // Two layout reads on one element, only on a real change or a resize.
    const left = btn.offsetLeft;
    const width = btn.offsetWidth;
    if (!animate) {
      pill.classList.add('is-snapping');
      pill.style.transform = `translateX(${left}px)`;
      pill.style.width = `${width}px`;
      void pill.offsetWidth;
      pill.classList.remove('is-snapping');
    } else {
      pill.style.transform = `translateX(${left}px)`;
      pill.style.width = `${width}px`;
    }
  }

  function setActive(value, { animate = true } = {}) {
    if (!buttons.some((b) => b.dataset.value === value)) return;
    const changed = active !== value;
    active = value;
    for (const btn of buttons) {
      const selected = btn.dataset.value === value;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1; // roving tabindex
    }
    move(value, animate && changed);
  }

  function focusAt(i) {
    buttons[(i + buttons.length) % buttons.length]?.focus();
  }

  function onKeyDown(e) {
    const i = buttons.indexOf(e.currentTarget);
    if (i < 0) return;
    const keys = {
      ArrowRight: () => focusAt(i + 1),
      ArrowDown: () => focusAt(i + 1),
      ArrowLeft: () => focusAt(i - 1),
      ArrowUp: () => focusAt(i - 1),
      Home: () => focusAt(0),
      End: () => focusAt(buttons.length - 1),
      Enter: () => onSelect?.(e.currentTarget.dataset.value),
      ' ': () => onSelect?.(e.currentTarget.dataset.value),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  }

  function refresh() { if (active) move(active, false); }

  const onResize = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { frame = null; refresh(); });
  };
  window.addEventListener('resize', onResize);

  return {
    root,
    setActive,
    refresh,
    get value() { return active; },
    destroy() {
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   3. MotionShimmerText   (p15)
   ═══════════════════════════════════════════════════════════ */

/**
 * Recreates the demo's shimmer: a masked ::before layer duplicating the
 * string via data-text, swept by a 400%-wide gradient band.
 */
export function MotionShimmerText({ text = '', shimmering = true } = {}) {
  const root = el('span', 'bz-shimmer');

  function setText(next) {
    const value = String(next ?? '');
    root.textContent = value;
    root.dataset.text = value; // ::before duplicates the visible string
  }

  function setShimmering(on) {
    root.classList.toggle('is-shimmering', !!on);
  }

  setText(text);
  setShimmering(shimmering);

  return { root, setText, setShimmering };
}

/* ═══════════════════════════════════════════════════════════
   4. MotionThinkingStates   (p28)
   ═══════════════════════════════════════════════════════════ */

/**
 * Recreates the demo's state swap: a hidden sizer reserves the label's box
 * so nothing reflows, and the label itself exits upward (blur + fade) while
 * the next one enters from below after a short gap. The label carries the
 * shimmer, as in the demo.
 *
 * Nothing here advances on its own. `set()` is called from real events.
 */
export function MotionThinkingStates({ text = '' } = {}) {
  const root = el('span', 'bz-swap');
  const sizer = el('span', 'bz-swap__sizer');
  sizer.setAttribute('aria-hidden', 'true');
  root.appendChild(sizer);

  const live = el('span', 'bz-swap__live');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  // Screen-reader only; the visible label is aria-hidden so the state is
  // never announced twice.
  Object.assign(live.style, {
    position: 'absolute', width: '1px', height: '1px', overflow: 'hidden',
    clipPath: 'inset(50%)', whiteSpace: 'nowrap',
  });
  root.appendChild(live);

  let current = null;
  let label = '';
  let swapTimer = null;

  function makeText(value) {
    const node = el('span', 'bz-swap__text', value);
    node.dataset.text = value;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function set(next, { announce = true } = {}) {
    const value = String(next ?? '');
    if (!value || value === label) return;
    label = value;
    sizer.textContent = value;
    if (announce) live.textContent = value;

    const incoming = makeText(value);
    const outgoing = current;

    if (!outgoing) {
      root.appendChild(incoming);
      current = incoming;
      return;
    }

    // A swap landing mid-swap would otherwise have its cleanup cancelled
    // below, orphaning that label — it would keep shimmering forever and
    // stack with every later state.
    if (swapTimer) clearTimeout(swapTimer);
    for (const stale of root.querySelectorAll('.bz-swap__text')) {
      if (stale !== outgoing) stale.remove();
    }

    incoming.classList.add('is-enter-start');
    root.appendChild(incoming);
    current = incoming;

    const dur = readDurationMs(root, '--bz-p28-swap-dur', 150);
    const gap = readDurationMs(root, '--bz-p28-swap-gap', 50);

    outgoing.classList.add('is-exit');

    // Exit leads, entrance follows by one gap, so the two never cross at
    // full opacity — that is what keeps the swap legible at this size.
    onNextPaint(() => {
      setTimeout(() => incoming.classList.remove('is-enter-start'),
        prefersReducedMotion() ? 0 : gap);
    });

    swapTimer = setTimeout(() => {
      outgoing.remove();
      swapTimer = null;
    }, dur + gap + 60);
  }

  /** 'running' sweeps, 'paused' holds, 'idle' drops the highlight layer. */
  function setActivity(mode) {
    root.classList.toggle('is-paused', mode === 'paused');
    root.classList.toggle('is-idle', mode === 'idle');
  }

  function clear() {
    if (swapTimer) clearTimeout(swapTimer);
    swapTimer = null;
    label = '';
    sizer.textContent = '';
    live.textContent = '';
    for (const node of root.querySelectorAll('.bz-swap__text')) node.remove();
    current = null;
  }

  if (text) set(text);

  return { root, set, setActivity, clear, get text() { return label; } };
}

/* ═══════════════════════════════════════════════════════════
   5. MotionReasoningStream   (p29)
   ═══════════════════════════════════════════════════════════ */

/**
 * Recreates the demo's stream: a masked viewport whose content translates
 * upward as new lines arrive, so rows rise past a soft top edge instead of
 * being clipped.
 *
 * Renders only strings the caller has already made safe to display. It does
 * no formatting that could reconstruct internal reasoning and writes every
 * value with textContent. Callers that cannot sanitize an event must not
 * call `push`.
 *
 * @param {number} lines how many rows are visible at once
 */
export function MotionReasoningStream({ lines = 3, rowHeight = 24, max = 40 } = {}) {
  const root = el('div', 'bz-stream');
  root.style.height = `${lines * rowHeight}px`;

  const viewport = el('div', 'bz-stream__viewport');
  const scroll = el('div', 'bz-stream__scroll');
  viewport.appendChild(scroll);
  root.appendChild(viewport);

  let activeRow = null;

  function markDone(row) {
    if (!row) return;
    row.classList.add('is-done');
    const mark = row.querySelector('.bz-stream__mark');
    if (mark) mark.textContent = '✓';
  }

  /** @param {string} label already-sanitized, user-facing activity text */
  function push(label) {
    const text = String(label ?? '').trim();
    if (!text) return;

    markDone(activeRow); // the previous row settles the moment a newer lands

    const row = el('div', 'bz-stream__row');
    row.style.height = `${rowHeight}px`;
    const mark = el('span', 'bz-stream__mark', '→');
    mark.setAttribute('aria-hidden', 'true');
    row.append(mark, el('span', 'bz-stream__label', text));
    scroll.appendChild(row);
    activeRow = row;

    // Translate the whole list rather than animating each row's position:
    // one transform per step regardless of how many rows exist.
    const overflow = Math.max(0, scroll.children.length - lines);
    scroll.style.transform = `translateY(${-overflow * rowHeight}px)`;

    onNextPaint(() => row.classList.add('is-in'));

    while (scroll.children.length > max) scroll.removeChild(scroll.firstChild);
  }

  function resolveActive() {
    markDone(activeRow);
    activeRow = null;
  }

  function clear() {
    scroll.textContent = '';
    scroll.style.transform = 'translateY(0)';
    activeRow = null;
  }

  return { root, push, resolveActive, clear, get size() { return scroll.children.length; } };
}

/* ═══════════════════════════════════════════════════════════
   6. MotionStreamingText   (p30)
   ═══════════════════════════════════════════════════════════ */

/**
 * Recreates the demo's word-wise reveal: each word is one span that fades in
 * from a 1px blur, staggered.
 *
 * Provider deltas break at arbitrary points, so text is buffered and only
 * complete words are committed — the trailing partial word waits for the next
 * delta, otherwise "Sum" and "marize" would animate as two fragments.
 *
 * Words are appended and never re-created, so cost stays flat: the DOM grows
 * by one span per word instead of being rebuilt per token.
 */
export function MotionStreamingText() {
  const root = el('div', 'bz-block');
  let pending = '';
  let full = '';
  let frame = null;
  let index = 0;

  function commit(chunk) {
    if (!chunk) return;
    const { frag } = wordSpans(chunk, 'bz-block__w', (span, i) => {
      // Cap the stagger so a burst of 200 words cannot schedule a long tail.
      span.style.transitionDelay = `${Math.min(index + i, 6) * 60}ms`;
    });
    root.appendChild(frag);

    // One frame flips the whole batch in, rather than one request per token.
    if (frame) frame();
    frame = onNextPaint(() => {
      frame = null;
      index = 0;
      for (const node of root.querySelectorAll('.bz-block__w:not(.is-in)')) {
        node.classList.add('is-in');
      }
    });
  }

  function push(delta) {
    const chunk = String(delta ?? '');
    if (!chunk) return;
    full += chunk;
    pending += chunk;
    const match = /\s(?![\s\S]*\s)/.exec(pending);
    if (!match) return;
    const cut = match.index + match[0].length;
    commit(pending.slice(0, cut));
    pending = pending.slice(cut);
  }

  /** Flush the trailing partial word when the stream ends. */
  function finish() {
    if (!pending) return;
    commit(pending);
    pending = '';
  }

  function reset() {
    if (frame) frame();
    frame = null;
    pending = '';
    full = '';
    index = 0;
    root.textContent = '';
  }

  return { root, push, finish, reset, text: () => full };
}

/* ═══════════════════════════════════════════════════════════
   7. MotionExpandableTrace   (beautifului.dev style)
   Expandable thinking trace component: steps, reasoning, search, coding.
   ═══════════════════════════════════════════════════════════ */
export function MotionExpandableTrace({
  doneLabel = 'Thought for 4 seconds',
  variant = 'Steps',
  rows = [
    { primary: 'Reading page structure' },
    { primary: 'Scanning page links', secondary: 'DOM' },
    { primary: 'Processing response' }
  ],
  expanded = false
} = {}) {
  const root = el('div', 'bz-thinking-trace');

  const headerBtn = el('button', 'bz-thinking-trace__header');
  headerBtn.type = 'button';
  headerBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

  const iconSpan = el('span', 'bz-thinking-trace__icon');
  iconSpan.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>';

  const labelSpan = el('span', 'bz-thinking-trace__label', doneLabel);

  const chevron = el('span', 'bz-thinking-trace__chevron');
  chevron.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  headerBtn.append(iconSpan, labelSpan, chevron);

  const drawer = el('div', `bz-thinking-trace__drawer ${expanded ? 'is-expanded' : ''}`);
  const inner = el('div', 'bz-thinking-trace__inner');
  const line = el('span', 'bz-thinking-trace__line');
  line.setAttribute('aria-hidden', 'true');
  const list = el('div', 'bz-thinking-trace__list');

  rows.forEach((row) => {
    const rowEl = el('div', 'bz-thinking-trace__row');
    
    const check = el('span', 'bz-thinking-trace__check');
    check.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

    const primary = el('span', `bz-thinking-trace__primary ${variant === 'Reasoning' ? 'is-reasoning' : ''}`, row.primary);

    rowEl.append(check, primary);

    if (row.secondary) {
      const sec = el('span', `bz-thinking-trace__secondary ${row.mono ? 'is-mono' : ''}`, row.secondary);
      rowEl.appendChild(sec);
    }

    if (row.add !== undefined && row.del !== undefined) {
      const diff = el('span', 'bz-thinking-trace__diff', `+${row.add} -${row.del}`);
      rowEl.appendChild(diff);
    }

    list.appendChild(rowEl);
  });

  inner.append(line, list);
  drawer.appendChild(inner);

  let isExpanded = expanded;
  headerBtn.addEventListener('click', () => {
    isExpanded = !isExpanded;
    headerBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    drawer.classList.toggle('is-expanded', isExpanded);
  });

  root.append(headerBtn, drawer);
  return { root, headerBtn, drawer, setLabel: (text) => { labelSpan.textContent = text; } };
}

