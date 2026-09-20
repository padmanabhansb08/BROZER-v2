/**
 * Pure-TS HTML → readable text. Ported from
 * src/chrome/src/network/network-tools.js, no DOM / DOMParser
 * dependency so it runs in any Node context (LM Studio's plugin host
 * is Node, not a browser).
 *
 * The conversion is regex-based and deliberately conservative:
 *   - drops <script>, <style>, <noscript>, <svg>, comments outright
 *   - inserts \n at the close of common block elements so paragraphs
 *     don't merge into a single line
 *   - decodes the most common named entities + numeric escapes
 *   - collapses runs of whitespace, preserves paragraph breaks
 *
 * Good enough for feeding an LLM the readable content of a page.
 * Won't cope with JS-rendered SPAs (the page's HTML doesn't contain
 * the rendered text) — that's a documented limitation of this tool.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&#160;": " ",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&laquo;": "«",
  "&raquo;": "»",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n ?? "0", 10)));
}

export interface HtmlToTextResult {
  /** Document title (from <title>), or empty string if none. */
  title: string;
  /** Cleaned, whitespace-collapsed body text. */
  text: string;
}

/**
 * Convert an HTML string to a `{title, text}` object. The output is
 * intended for human/LLM consumption, NOT for round-tripping back to
 * HTML — semantic markup (lists, headings) gets flattened to plain
 * paragraphs separated by blank lines.
 */
export function htmlToText(html: string): HtmlToTextResult {
  if (!html) return { title: "", text: "" };

  let s = html;

  // Title — pluck before stripping tags.
  const titleMatch = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? decodeEntities(titleMatch[1]).trim() : "";

  // Drop noise: scripts, styles, SVG (decorative), comments.
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");
  s = s.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // Block-element close → newline so paragraphs don't run together.
  s = s.replace(
    /<\/(p|div|h[1-6]|li|tr|br|article|section|header|footer)[^>]*>/gi,
    "\n",
  );
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Remove every other tag entirely.
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);

  // Collapse runs of whitespace; keep paragraph breaks (≤2 newlines).
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text: s };
}
