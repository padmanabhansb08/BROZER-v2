#!/usr/bin/env python3
"""Regression suite for social-media-downloader.js

Attach order (auto-selected, best first):
  1. CDP on port 9222 — run start-chrome-debug.bat (.sh) to launch a
     SECOND Chrome with its own profile. Main Chrome stays untouched.
  2. browser_cookie3 from default Chrome profile (Chrome 127+'s
     App-Bound Encryption usually blocks this; falls through).
  3. Dedicated test profile at ~/smd-test-profile (--setup once).

Usage:
  python test_smd.py                    # all sites
  python test_smd.py --site reddit      # one site
  python test_smd.py --headless         # hide bundled browser (modes 2/3)
  python test_smd.py --update-baseline  # save current counts as baseline
  python test_smd.py --js PATH          # explicit SMD script
  python test_smd.py --setup            # fallback profile login
"""
from __future__ import annotations
import argparse, json, sys, time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

from common import TestResult
from sites import TESTS as _FEED_TESTS
from sites_video import TESTS as _VIDEO_TESTS
from sites_advanced import TESTS as _ADVANCED_TESTS
TESTS = _FEED_TESTS + _VIDEO_TESTS + _ADVANCED_TESTS

SCRIPT_DIR = Path(__file__).resolve().parent
PROFILE_DIR = Path.home() / "smd-test-profile"
REPORT_DIR = Path.home() / "smd-test-reports"
BASELINE_PATH = SCRIPT_DIR / "baseline.json"
CDP_PORT = 9222

COOKIE_DOMAINS = [
    "facebook.com", "instagram.com", "x.com", "twitter.com",
    "linkedin.com", "reddit.com", "pinterest.com",
]


def find_smd_js() -> Path:
    for c in [SCRIPT_DIR / "social-media-downloader.js",
              SCRIPT_DIR.parent / "social-media-downloader.js"]:
        if c.exists():
            return c
    return SCRIPT_DIR / "social-media-downloader.js"

DEFAULT_JS = find_smd_js()


def _extract_chrome_cookies():
    """Try to read cookies from default Chrome profile. Returns None on failure."""
    try:
        import browser_cookie3  # type: ignore
    except ImportError:
        print("[!] browser_cookie3 not installed; skipping cookie-attach path.")
        return None
    all_cookies, abe_blocked = [], False
    for d in COOKIE_DOMAINS:
        try:
            cj = browser_cookie3.chrome(domain_name=d)
            for c in cj:
                expires = float(c.expires) if c.expires else -1.0
                rest = getattr(c, "_rest", {}) or {}
                http_only = any(k.lower() == "httponly" for k in rest)
                same_site = "Lax"
                for k, v in rest.items():
                    if k.lower() == "samesite" and isinstance(v, str):
                        v2 = v.capitalize()
                        if v2 in ("Strict", "Lax", "None"):
                            same_site = v2
                all_cookies.append({
                    "name": c.name, "value": c.value,
                    "domain": c.domain, "path": c.path or "/",
                    "expires": expires, "httpOnly": http_only,
                    "secure": bool(c.secure), "sameSite": same_site,
                })
        except Exception as e:
            msg = str(e)
            if "Unable to get key" in msg or "decryption" in msg.lower():
                abe_blocked = True
                break
            print(f"[!] cookie extract for {d}: {e}")
    if abe_blocked:
        print("[!] Chrome 127+ App-Bound Encryption blocks external cookie")
        print("[!] reading. Use the CDP path instead - it does NOT require")
        print("[!] you to close your main Chrome:")
        print("[!]   start-chrome-debug.bat    (Windows)")
        print("[!]   ./start-chrome-debug.sh   (macOS / Linux)")
        print("[!] That opens a SECOND Chrome with its own profile. Log into")
        print("[!] the test sites in it once; every later run reuses them.")
        return None
    return all_cookies or None


def _trigger_download(page, site_name: str):
    """After a test passes, trigger SocialMediaDownloader.run({limit:1}) and
    capture the resulting file via Playwright's download event. Returns the
    saved file path or an error string."""
    target_dir = REPORT_DIR / "downloads"
    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        with page.expect_download(timeout=20000) as dl_info:
            page.evaluate(
                "(prefix) => { SocialMediaDownloader.run({ limit: 1, prefix }); }",
                site_name,
            )
        download = dl_info.value
        suggested = download.suggested_filename or f"{site_name}.bin"
        target = target_dir / f"{site_name}__{suggested}"
        download.save_as(str(target))
        return str(target)
    except Exception as e:
        return f"download failed: {e}"


def run_all(js_path, headless=False, site_filter=None, download=False):
    REPORT_DIR.mkdir(exist_ok=True)
    sdir = REPORT_DIR / "screenshots"
    results = []
    p = sync_playwright().start()
    browser = None; ctx = None
    attached_cdp = False; used_browser_close = False
    test_page = None
    try:
        try:
            browser = p.chromium.connect_over_cdp(
                f"http://localhost:{CDP_PORT}", timeout=3000)
            ctx = browser.contexts[0] if browser.contexts else browser.new_context()
            attached_cdp = True
            print(f"[+] Attached to Chrome via CDP on port {CDP_PORT}.")
        except Exception:
            pass

        if ctx is None:
            cookies = _extract_chrome_cookies()
            if cookies:
                print(f"[+] Extracted {len(cookies)} cookies from Chrome profile.")
                browser = p.chromium.launch(
                    headless=headless,
                    args=["--disable-blink-features=AutomationControlled"])
                ctx = browser.new_context(
                    viewport={"width": 1400, "height": 900},
                    bypass_csp=True)
                try: ctx.add_cookies(cookies)
                except Exception as e: print(f"[!] Some cookies rejected: {e}")
                used_browser_close = True

        if ctx is None:
            print(f"[!] Falling back to dedicated test profile at {PROFILE_DIR}.")
            print(f"[!] Run start-chrome-debug.bat for CDP, or --setup for this profile.")
            PROFILE_DIR.mkdir(exist_ok=True)
            ctx = p.chromium.launch_persistent_context(
                user_data_dir=str(PROFILE_DIR), headless=headless,
                viewport={"width": 1400, "height": 900},
                bypass_csp=True,
                args=["--disable-blink-features=AutomationControlled"])

        test_page = ctx.new_page()

        for fn in TESTS:
            name = fn.__name__.replace("test_", "")
            if site_filter and name != site_filter:
                continue
            print(f"[+] testing {name} ...", flush=True)
            try:
                res = fn(test_page, js_path, sdir)
            except Exception as e:
                res = TestResult(site=name, url=test_page.url, passed=False, error=str(e))
            # Optional: trigger a real download to verify end-to-end.
            if download and res.passed and res.url_count > 0:
                dl_result = _trigger_download(test_page, name)
                # Record into the test result so the report shows it.
                if dl_result.startswith("download failed"):
                    res.notes = (res.notes + " | " if res.notes else "") + dl_result
                else:
                    res.notes = (res.notes + " | " if res.notes else "") + f"downloaded: {dl_result}"
            print(f"    {res.status():12s}  url_count={res.url_count}  profile={res.profile_detected}")
            results.append(res)
    finally:
        try:
            if test_page is not None: test_page.close()
        except Exception: pass
        if attached_cdp:
            try:
                if browser is not None: browser.close()
            except Exception: pass
        elif used_browser_close:
            try:
                if ctx is not None: ctx.close()
            except Exception: pass
            try:
                if browser is not None: browser.close()
            except Exception: pass
        else:
            try:
                if ctx is not None: ctx.close()
            except Exception: pass
        p.stop()
    return results


def load_baseline():
    return json.loads(BASELINE_PATH.read_text()) if BASELINE_PATH.exists() else {}

def update_baseline(results):
    base = {r.site: {"url_count": r.url_count, "profile": r.profile_detected}
            for r in results if r.passed}
    BASELINE_PATH.write_text(json.dumps(base, indent=2))
    print(f"[+] baseline updated -> {BASELINE_PATH}")


def write_report(results):
    REPORT_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    path = REPORT_DIR / f"smd_report_{ts}.md"
    baseline = load_baseline()
    n_pass = sum(1 for r in results if r.passed)
    n_auth = sum(1 for r in results if r.needs_login)
    n_fail = len(results) - n_pass - n_auth
    tags = {"PASS": "[OK]", "FAIL": "[FAIL]", "AUTH NEEDED": "[AUTH]", "ERROR": "[ERR]"}

    out = [
        f"# SocialMediaDownloader regression report\n",
        f"Run: **{ts}**\n",
        f"Summary: **{n_pass} pass / {n_fail} fail / {n_auth} auth-needed** "
        f"(total: {len(results)})\n",
    ]
    for r in results:
        status = r.status()
        out.append(f"\n## {tags[status]} {r.site} - {status}\n")
        out.append(f"- URL: `{r.url}`")
        out.append(f"- Profile detected: `{r.profile_detected}`")
        out.append(f"- URLs found: **{r.url_count}**")
        prev = baseline.get(r.site)
        if prev and prev.get("url_count"):
            prev_n = prev["url_count"]; delta = r.url_count - prev_n
            pct = (delta / prev_n * 100) if prev_n else 0
            warn = " WARNING" if abs(pct) > 50 else ""
            out.append(f"- Baseline: {prev_n} -> {r.url_count} ({pct:+.0f}%){warn}")
        if r.assertions:
            out.append("- Assertions:")
            for a in r.assertions: out.append(f"  - {a}")
        if r.failures:
            out.append("- **Failures:**")
            for f in r.failures: out.append(f"  - {f}")
        if r.error: out.append(f"- **Error:** `{r.error}`")
        if r.sample_urls:
            out.append("- Sample URLs found:")
            for u in r.sample_urls: out.append(f"  - `{u}`")
        if r.screenshot_path: out.append(f"- Screenshot: `{r.screenshot_path}`")
        if r.notes: out.append(f"- Note: _{r.notes}_")

    out.append("\n---\n## When a site fails\n")
    out.append("1. `python test_smd.py --site <name>` to watch the run")
    out.append("2. Open DevTools to see what changed in the DOM")
    out.append("3. Update the matching profile in `social-media-downloader.js`")
    out.append("4. Re-run; if counts shifted permanently: `--update-baseline`")

    path.write_text("\n".join(out), encoding="utf-8")
    (REPORT_DIR / "latest.md").write_text("\n".join(out), encoding="utf-8")
    return path


def setup_login():
    PROFILE_DIR.mkdir(exist_ok=True)
    print(f"Profile dir: {PROFILE_DIR}")
    print("Log into the sites you want covered, then close the window.")
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR), headless=False,
            viewport={"width": 1400, "height": 900})
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://www.facebook.com")
        try:
            while ctx.pages: time.sleep(1)
        except KeyboardInterrupt: pass
        finally: ctx.close()
    print("Login profile saved.")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--setup", action="store_true",
                    help="(fallback) log into sites in dedicated profile")
    ap.add_argument("--headless", action="store_true",
                    help="(modes 2/3) hide bundled browser")
    ap.add_argument("--site",
                    help="one site (pinterest reddit instagram twitter facebook linkedin)")
    ap.add_argument("--update-baseline", action="store_true",
                    help="save current counts as baseline")
    ap.add_argument("--download", action="store_true",
                    help="after each passing test, download the top media item "
                         "to ~/smd-test-reports/downloads/ (off by default)")
    ap.add_argument("--js", default=str(DEFAULT_JS),
                    help=f"path to social-media-downloader.js (default: {DEFAULT_JS.name})")
    args = ap.parse_args()

    if args.setup:
        setup_login(); return

    js_path = Path(args.js).resolve()
    if not js_path.exists():
        print(f"ERROR: SMD script not found at {js_path}", file=sys.stderr)
        sys.exit(2)

    results = run_all(js_path, headless=args.headless, site_filter=args.site,
                       download=args.download)
    if args.update_baseline:
        update_baseline(results); return

    report = write_report(results)
    print(f"\nReport: {report}")
    print(f"Latest: {REPORT_DIR / 'latest.md'}")
    failed = [r for r in results if not r.passed and not r.needs_login]
    if failed:
        print(f"\n{len(failed)} test(s) failed - see the report.")
        sys.exit(1)


if __name__ == "__main__":
    main()
