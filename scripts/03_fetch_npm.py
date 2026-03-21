#!/usr/bin/env python3
"""Fetch all version timestamps from npm registry for @anthropic-ai/claude-code."""
import json
from pathlib import Path

import httpx

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
DATA.mkdir(exist_ok=True)


def fetch_npm():
    url = "https://registry.npmjs.org/@anthropic-ai/claude-code"
    print(f"  Fetching {url}...")
    resp = httpx.get(url, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    time_data = data.get("time", {})
    # Filter out metadata fields
    versions = {k: v for k, v in time_data.items() if k not in ("created", "modified")}

    out_path = DATA / "npm_versions.json"
    out_path.write_text(json.dumps(versions, indent=2, ensure_ascii=False))
    print(f"Fetched {len(versions)} npm versions → {out_path}")

    # Show earliest and latest
    if versions:
        sorted_versions = sorted(versions.items(), key=lambda x: x[1])
        print(f"  Earliest: {sorted_versions[0]}")
        print(f"  Latest:   {sorted_versions[-1]}")


if __name__ == "__main__":
    fetch_npm()
