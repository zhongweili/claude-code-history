#!/usr/bin/env python3
"""Fetch all GitHub releases for anthropics/claude-code."""
import json
import os
import sys
from pathlib import Path

import httpx

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
DATA.mkdir(exist_ok=True)


def fetch_releases():
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    releases = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/anthropics/claude-code/releases?per_page=100&page={page}"
        print(f"  Fetching page {page}...")
        resp = httpx.get(url, headers=headers, timeout=30)
        if resp.status_code == 403:
            print(f"Rate limited! Set GITHUB_TOKEN env var to increase limit.", file=sys.stderr)
            resp.raise_for_status()
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        releases.extend(data)
        page += 1

    output = [
        {
            "version": r["tag_name"].lstrip("v"),
            "published_at": r["published_at"],
            "body": r.get("body", "") or "",
        }
        for r in releases
    ]
    output.sort(key=lambda x: x["published_at"])

    out_path = DATA / "releases_raw.json"
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"Fetched {len(output)} releases → {out_path}")


if __name__ == "__main__":
    fetch_releases()
