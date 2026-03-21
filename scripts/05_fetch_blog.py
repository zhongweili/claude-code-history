#!/usr/bin/env python3
"""Fetch Anthropic blog posts related to Claude Code."""
import json
import re
from pathlib import Path

import httpx

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
DATA.mkdir(exist_ok=True)

# Known Claude Code related posts from analysis, used as fallback / supplement
KNOWN_POSTS = [
    {
        "slug": "claude-3-7-sonnet",
        "title": "Introducing Claude 3.7 Sonnet and Claude Code",
        "date": "2025-02-24",
        "summary": "Anthropic launches Claude Code research preview alongside Claude 3.7 Sonnet. Claude Code is an agentic coding tool that can autonomously handle complex coding tasks.",
    },
    {
        "slug": "best-practices-agentic-claude-code",
        "title": "Best Practices for Agentic and Claude Code",
        "date": "2025-04-19",
        "summary": "Anthropic publishes official best practices guide for using Claude Code effectively in agentic workflows.",
    },
    {
        "slug": "claude-code-sdk",
        "title": "Introducing the Claude Code SDK",
        "date": "2025-05-19",
        "summary": "Developers can now build custom agent workflows on top of Claude Code with the new SDK.",
    },
    {
        "slug": "claude-code-2-0",
        "title": "Claude Code 2.0",
        "date": "2025-09-29",
        "summary": "Major version upgrade powered by Claude Opus 4.5. Introduces subagents for parallel development, higher-level code understanding.",
    },
    {
        "slug": "cowork",
        "title": "Introducing Cowork",
        "date": "2026-01-12",
        "summary": "Cowork extends Claude Code's agent capabilities to non-developers. Supports file system access, multi-step tasks, connector integrations, and browser access.",
    },
    {
        "slug": "claude-sonnet-4-6",
        "title": "Claude Sonnet 4.6",
        "date": "2026-02-17",
        "summary": "Claude Sonnet 4.6 with 1M token context window (beta). Claude Code users prefer it 70% over Sonnet 4.5. Becomes default model for Free/Pro plans.",
    },
    {
        "slug": "claude-code-security",
        "title": "Introducing Claude Code Security",
        "date": "2026-02-20",
        "summary": "Claude Code Security understands component interactions like a human security researcher. Tracks data flow, detects complex vulnerabilities, multi-stage validation filters false positives.",
    },
]


def try_fetch_post_meta(client: httpx.Client, url: str) -> dict | None:
    try:
        resp = client.get(url, timeout=15, follow_redirects=True)
        if resp.status_code != 200:
            return None
        html = resp.text
        title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
        desc_match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        if not desc_match:
            desc_match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']', html, re.IGNORECASE)
        date_match = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', html)
        if not date_match:
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', url)
        return {
            "title": title_match.group(1).strip() if title_match else None,
            "summary": desc_match.group(1).strip() if desc_match else None,
            "date": date_match.group(1) if date_match else None,
        }
    except Exception:
        return None


def scrape_news_page(client: httpx.Client) -> list[str]:
    """Try to scrape links from Anthropic news page."""
    try:
        resp = client.get("https://www.anthropic.com/news", timeout=20, follow_redirects=True)
        if resp.status_code != 200:
            return []
        html = resp.text
        # Find hrefs containing claude-code or claude code related slugs
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', html)
        related = []
        for href in hrefs:
            lower = href.lower()
            if any(kw in lower for kw in ["claude-code", "claude-3-7", "claude-sonnet-4-6", "cowork", "bun"]):
                if href.startswith("/news/") or href.startswith("https://www.anthropic.com/news/"):
                    slug = href.split("/news/")[-1].rstrip("/")
                    if slug:
                        related.append(slug)
        return list(dict.fromkeys(related))  # deduplicate preserving order
    except Exception:
        return []


def fetch_blog():
    posts = {p["slug"]: p for p in KNOWN_POSTS}

    with httpx.Client(headers={"User-Agent": "Mozilla/5.0 (research bot)"}) as client:
        # Try to discover more posts from the news page
        print("  Scraping Anthropic news page...")
        scraped_slugs = scrape_news_page(client)
        print(f"  Found {len(scraped_slugs)} potentially relevant slugs")

        for slug in scraped_slugs:
            if slug not in posts:
                url = f"https://www.anthropic.com/news/{slug}"
                meta = try_fetch_post_meta(client, url)
                if meta and meta.get("title"):
                    posts[slug] = {
                        "slug": slug,
                        "title": meta["title"],
                        "date": meta.get("date"),
                        "summary": meta.get("summary", ""),
                    }
                    print(f"    + {slug}: {meta['title'][:50]}")

        # Enrich known posts with live metadata where possible
        for slug, post in posts.items():
            if not post.get("summary") or len(post.get("summary", "")) < 20:
                url = f"https://www.anthropic.com/news/{slug}"
                meta = try_fetch_post_meta(client, url)
                if meta:
                    if meta.get("summary"):
                        post["summary"] = meta["summary"]
                    if meta.get("date") and not post.get("date"):
                        post["date"] = meta["date"]

    result = sorted(posts.values(), key=lambda x: x.get("date") or "")
    out_path = DATA / "blog_posts.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved {len(result)} blog posts → {out_path}")


if __name__ == "__main__":
    fetch_blog()
