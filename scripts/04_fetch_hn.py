#!/usr/bin/env python3
"""Fetch HackerNews stories about Claude Code via Algolia API, time-windowed."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
DATA.mkdir(exist_ok=True)

QUERIES = ["claude code", "claude-code"]


def fetch_window(client: httpx.Client, query: str, start: datetime, end: datetime) -> list[dict]:
    params = {
        "query": query,
        "tags": "story",
        "numericFilters": f"points>20,created_at_i>{int(start.timestamp())},created_at_i<{int(end.timestamp())}",
        "hitsPerPage": 100,
    }
    resp = client.get("https://hn.algolia.com/api/v1/search_by_date", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("hits", [])


def fetch_hn():
    start_dt = datetime(2025, 2, 1, tzinfo=timezone.utc)
    end_dt = datetime.now(tz=timezone.utc)

    all_hits: dict[str, dict] = {}
    with httpx.Client() as client:
        for query in QUERIES:
            print(f"  Query: '{query}'")
            current = start_dt
            while current < end_dt:
                next_dt = min(current + timedelta(days=90), end_dt)
                hits = fetch_window(client, query, current, next_dt)
                new_count = 0
                for hit in hits:
                    oid = hit["objectID"]
                    if oid not in all_hits:
                        all_hits[oid] = {
                            "title": hit.get("title", ""),
                            "url": hit.get("url") or f"https://news.ycombinator.com/item?id={oid}",
                            "hn_url": f"https://news.ycombinator.com/item?id={oid}",
                            "points": hit.get("points", 0),
                            "num_comments": hit.get("num_comments", 0),
                            "created_at": hit.get("created_at", ""),
                            "objectID": oid,
                        }
                        new_count += 1
                print(f"    {current.date()} ~ {next_dt.date()}: {len(hits)} hits ({new_count} new)")
                current = next_dt

    result = list(all_hits.values())
    result.sort(key=lambda x: x["points"], reverse=True)

    out_path = DATA / "hn_signals.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Total unique HN stories: {len(result)} → {out_path}")
    if result:
        print(f"  Top story: {result[0]['points']}pts — {result[0]['title'][:60]}")


if __name__ == "__main__":
    fetch_hn()
