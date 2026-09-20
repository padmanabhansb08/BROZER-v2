"""Shared types and SMD injection helpers."""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from playwright.sync_api import Page


@dataclass
class TestResult:
    site: str
    url: str
    passed: bool
    needs_login: bool = False
    profile_detected: Optional[str] = None
    url_count: int = 0
    sample_urls: list = field(default_factory=list)
    assertions: list = field(default_factory=list)
    failures: list = field(default_factory=list)
    notes: str = ""
    error: Optional[str] = None
    screenshot_path: Optional[str] = None

    def status(self) -> str:
        if self.error:        return "ERROR"
        if self.needs_login:  return "AUTH NEEDED"
        return "PASS" if self.passed else "FAIL"


def inject_smd(page: Page, js_path: Path) -> None:
    """Inject SMD into the page. We use page.evaluate() rather than
    page.add_script_tag(), because the latter creates a real <script>
    element in the page DOM — and Facebook, Instagram, X, LinkedIn all
    have strict Content Security Policies that forbid inline scripts
    (nonce-required script-src). page.evaluate goes through CDP's
    Runtime.evaluate, which executes in the page's main world but is
    NOT subject to page-level CSP."""
    js_content = js_path.read_text(encoding="utf-8")
    # Wrap in an arrow function so Playwright treats it as a function
    # body (handles multi-statement code cleanly across versions).
    page.evaluate("() => { " + js_content + " }")


def collect_smd(page: Page, mode: str = "auto") -> dict:
    return page.evaluate(
        """(mode) => {
            try {
                const r = SocialMediaDownloader._collect(mode);
                return {
                    urls: r.urls,
                    profile: r.profile.name,
                    mode: r.mode,
                    dashGroupCount: r.dashGroups ? r.dashGroups.size : 0
                };
            } catch (e) {
                return { error: String(e), stack: e.stack || null };
            }
        }""",
        mode,
    )
