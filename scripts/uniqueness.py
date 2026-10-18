"""Flag indexable pages that are near-copies of another indexable page.

Each page's visible text (nav, footer, scripts and styles left out) becomes a set of 5-word
shingles, numbers normalized so "61 mods" and "68 mods" count as the same words. A page fails
when more than LIMIT of its shingles also appear on one other indexable page (containment).
Pages with <meta name="robots" content="noindex..."> are skipped: search engines do not index
them, so they cannot compete.

    python scripts/uniqueness.py [site root] [--limit 0.70] [--top 5]
"""
from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

LIMIT = 0.70
K = 5
SKIP_TAGS = {"nav", "footer", "script", "style", "head", "svg", "noscript"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source",
        "track", "wbr"}


class Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.stack: list[str] = []
        self.parts: list[str] = []
        self.noindex = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        a = dict(attrs)
        if tag == "meta" and (a.get("name") or "").lower() == "robots":
            self.noindex = "noindex" in (a.get("content") or "").lower()
        if tag in VOID:
            return
        self.stack.append(tag)
        if tag in SKIP_TAGS:
            self.skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID or tag not in self.stack:
            return
        while self.stack:
            t = self.stack.pop()
            if t in SKIP_TAGS:
                self.skip -= 1
            if t == tag:
                break

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


def url_of(root: Path, f: Path) -> str:
    rel = f.relative_to(root).as_posix()
    if rel.endswith("index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel[: -len(".html")]


def shingles(text: str) -> set[tuple[str, ...]]:
    text = re.sub(r"\d[\d.,%+a-z-]*", "#", text.lower())
    w = re.findall(r"[a-z0-9#][a-z0-9.#'+-]*", text)
    return {tuple(w[i:i + K]) for i in range(len(w) - K + 1)}


def pages(root: Path) -> dict[str, tuple[bool, set]]:
    out = {}
    for f in sorted(root.rglob("*.html")):
        if any(p.startswith(".") or p in ("node_modules", "scripts") for p in f.relative_to(root).parts):
            continue
        t = Text()
        t.feed(f.read_text(encoding="utf-8"))
        out[url_of(root, f)] = (t.noindex, shingles(" ".join(t.parts)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("root", nargs="?", default=Path(__file__).resolve().parent.parent, type=Path)
    ap.add_argument("--limit", type=float, default=LIMIT)
    ap.add_argument("--top", type=int, default=0, help="also print the N closest pairs")
    args = ap.parse_args()
    all_pages = pages(args.root)
    live = {u: s for u, (noindex, s) in all_pages.items() if not noindex and s}
    rows = []
    for a, sa in live.items():
        best = max(((len(sa & sb) / len(sa), b) for b, sb in live.items() if b != a),
                   default=(0.0, ""))
        rows.append((best[0], a, best[1]))
    rows.sort(reverse=True)
    skipped = sorted(u for u, (noindex, _) in all_pages.items() if noindex)
    print(f"{len(live)} indexable pages checked, {len(skipped)} noindex skipped; "
          f"limit {args.limit:.0%} containment of {K}-word shingles")
    for c, a, b in rows[: args.top]:
        print(f"  {c:5.0%}  {a}  in  {b}")
    bad = [r for r in rows if r[0] > args.limit]
    for c, a, b in bad:
        print(f"FAIL {c:.0%} of {a} is also on {b}")
    if bad:
        print(f"{len(bad)} page(s) over the limit: give each its own content, or mark it "
              '<meta name="robots" content="noindex, follow"> and drop it from sitemap.xml')
        return 1
    print("ok: every indexable page is its own")
    return 0


if __name__ == "__main__":
    sys.exit(main())
