/*
 * SMD loader for Firefox (MV2).
 *
 * Firefox MV2 content_scripts always run in an isolated world — there's
 * no `world: "MAIN"` knob in the manifest. Patching the PAGE's
 * `SourceBuffer.prototype.appendBuffer` from the isolated world doesn't
 * work because the page's MediaSource closes over its own prototype
 * lookups, not ours.
 *
 * Workaround: from the isolated world, append a `<script src="...">`
 * element pointing at the SMD file (served via the moz-extension://
 * scheme). The browser fetches and executes it in the page's main
 * world, BEFORE the page's player initializes, because we run at
 * document_start. The script tag is removed once loaded — its side
 * effects (window.SocialMediaDownloader, MSE prototype patches) stick.
 *
 * Requires the SMD file to be listed in `web_accessible_resources` so
 * the page-context fetch is allowed.
 */
(() => {
  try {
    const src = browser.runtime.getURL('src/agent/social-media-downloader.js');
    const s = document.createElement('script');
    s.src = src;
    // Synchronous tag — the parser pauses until the script loads, so the
    // MSE patches are in place before any subsequent <script> on the page
    // (including the player bootstrap) runs.
    s.async = false;
    s.onload = () => { try { s.remove(); } catch (_) {} };
    s.onerror = (e) => { console.warn('[SMD] page-world inject failed:', e); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[SMD] loader threw:', e);
  }
})();
