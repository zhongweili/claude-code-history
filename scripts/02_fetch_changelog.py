#!/usr/bin/env python3
"""Download CHANGELOG.md and parse into structured version blocks."""
import json
import re
from pathlib import Path

import httpx

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
DATA.mkdir(exist_ok=True)

SECTION_ALIASES = {
    "new features": "feat",
    "features": "feat",
    "feature": "feat",
    "bug fixes": "fix",
    "bug fix": "fix",
    "fixes": "fix",
    "fix": "fix",
    "improvements": "improvement",
    "improvement": "improvement",
    "performance": "perf",
    "security": "security",
    "breaking changes": "breaking",
    "breaking": "breaking",
}


def normalize_section(name: str) -> str:
    lower = name.lower().strip()
    return SECTION_ALIASES.get(lower, lower)


def parse_changelog(content: str) -> list[dict]:
    # Matches both "## v2.1.71" and "## 2.1.71" formats
    version_re = re.compile(r"^## v?(\d+\.\d+\.\d+[^\s]*)", re.MULTILINE)
    matches = list(version_re.finditer(content))

    versions = []
    for i, match in enumerate(matches):
        version = "v" + match.group(1)
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        block = content[start:end]

        # Extract date — may be in parens like "(2025-02-24)" or absent
        date_match = re.search(r"\((\d{4}-\d{2}-\d{2})\)", block)
        if not date_match:
            date_match = re.search(r"(\d{4}-\d{2}-\d{2})", block)
        date = date_match.group(1) if date_match else None

        # Parse sections and bullets
        # The modern CHANGELOG has no ### headers — just flat bullet lists
        changes = []
        current_section = "general"
        for line in block.split("\n"):
            section_match = re.match(r"^###\s+(.+)", line)
            if section_match:
                current_section = normalize_section(section_match.group(1))
                continue
            # Match top-level bullets (- or *), not indented sub-bullets
            bullet_match = re.match(r"^[-*]\s+(.+)", line)
            if bullet_match:
                changes.append({"section": current_section, "raw": bullet_match.group(1).strip()})

        versions.append({"version": version, "date": date, "changes": changes})

    return versions


def fetch_changelog():
    url = "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md"
    print(f"  Downloading {url}...")
    resp = httpx.get(url, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    content = resp.text
    print(f"  Downloaded {len(content):,} bytes")

    versions = parse_changelog(content)

    out_path = DATA / "changelog_parsed.json"
    out_path.write_text(json.dumps(versions, indent=2, ensure_ascii=False))
    print(f"Parsed {len(versions)} versions → {out_path}")
    if versions:
        dates = [v["date"] for v in versions if v["date"]]
        if dates:
            print(f"  Date range: {min(dates)} ~ {max(dates)}")


if __name__ == "__main__":
    fetch_changelog()
