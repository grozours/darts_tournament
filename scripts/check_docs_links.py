#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"

if not DOCS_DIR.exists():
    print(f"[docs-link-check] Missing docs directory: {DOCS_DIR}", file=sys.stderr)
    sys.exit(1)

MARKDOWN_FILES = list(DOCS_DIR.glob("*.md"))
EXTRA_FILES = [ROOT / "README.md", ROOT / "README.fr.md"]

link_re = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
heading_re = re.compile(r"^(#{1,6})\s+(.*)$")
html_id_re = re.compile(r"<a\s+id=\"([^\"]+)\"\s*></a>", re.IGNORECASE)


def slugify_heading(text: str) -> str:
    text = text.strip().lower()
    text = text.replace("’", "").replace("'", "").replace("`", "")
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[^\w\-\sÀ-ÖØ-öø-ÿ]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def collect_anchors(file_path: Path) -> set[str]:
    anchors: set[str] = set()
    for line in file_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        heading_match = heading_re.match(line)
        if heading_match:
            anchors.add(slugify_heading(heading_match.group(2)))
        for html_id in html_id_re.findall(line):
            anchors.add(html_id.strip().lower())
    return anchors


anchor_index: dict[Path, set[str]] = {}
for markdown_file in MARKDOWN_FILES + [file for file in EXTRA_FILES if file.exists()]:
    anchor_index[markdown_file.resolve()] = collect_anchors(markdown_file)

errors: list[tuple[str, int, str, str]] = []
for markdown_file in MARKDOWN_FILES:
    lines = markdown_file.read_text(encoding="utf-8", errors="ignore").splitlines()
    for line_number, line in enumerate(lines, 1):
        for raw_link in link_re.findall(line):
            link = raw_link.strip()

            if link.startswith(("http://", "https://", "mailto:")):
                continue

            path_part, fragment = (link.split("#", 1) + [""])[:2] if "#" in link else (link, "")
            path_part = unquote(path_part)

            if path_part == "":
                target_file = markdown_file.resolve()
            else:
                target_file = (markdown_file.parent / path_part).resolve()

            if not target_file.exists():
                errors.append((markdown_file.name, line_number, raw_link, "missing target file"))
                continue

            if fragment and target_file.suffix.lower() == ".md":
                anchors = anchor_index.get(target_file, set())
                if fragment.lower() not in anchors:
                    errors.append((markdown_file.name, line_number, raw_link, "missing anchor"))

if errors:
    print(f"[docs-link-check] Found {len(errors)} broken markdown link(s):", file=sys.stderr)
    for filename, line_number, link, reason in errors:
        print(f"  - {filename}:{line_number} -> {link} [{reason}]", file=sys.stderr)
    sys.exit(1)

print(f"[docs-link-check] OK: checked {len(MARKDOWN_FILES)} markdown files in docs/.")
