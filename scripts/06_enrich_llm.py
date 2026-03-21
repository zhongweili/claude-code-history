#!/usr/bin/env python3
"""
LLM enrichment: classify categories and score importance for each change item.
Uses claude-haiku-4-5 for cost efficiency. Batches 10 items per request.
"""
import json
import re
import sys
from pathlib import Path

import anthropic
from anthropic import AnthropicBedrock

BASE = Path(__file__).parent.parent
DATA = BASE / "data"

BEDROCK_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
AWS_PROFILE = "tubi-core-dev-bedrock-user"  # fallback; override via AWS_PROFILE env

CATEGORY_KEYWORDS = {
    "fix": ["fix", "bug", "patch", "resolve", "correct", "repair", "revert", "workaround"],
    "feat": ["add", "new", "introduce", "implement", "support", "enable", "allow", "create"],
    "perf": ["perf", "optim", "fast", "speed", "latency", "memory", "efficient", "reduc"],
    "security": ["security", "vuln", "cve", "auth", "permission", "sandbox", "safe"],
    "breaking": ["breaking", "break", "remov", "deprecat", "drop support", "rename"],
    "improvement": ["improve", "enhanc", "updat", "refactor", "better", "clean", "simplif"],
}

BATCH_SYSTEM = """\
You are a technical analyst for developer tooling. Given a list of changelog items for Claude Code (an AI coding assistant CLI), classify each item.

Respond with a JSON array of objects, one per input item, in the same order.
Each object must have:
- "importance": integer 1-5 (1=minor, 5=critical user impact)
- "summary": string, max 40 chars, Chinese, describing user value (e.g. "修复长会话stdin冻结")
- "why_matters": string, 1-2 sentences in Chinese, explaining why this matters to users

Only output the JSON array, no other text.
"""


def rule_based_category(text: str) -> str:
    lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return category
    return "other"


def load_releases() -> list[dict]:
    """Merge changelog_parsed.json and releases_raw.json, deduplicate by version."""
    releases: dict[str, dict] = {}

    changelog_path = DATA / "changelog_parsed.json"
    if changelog_path.exists():
        for entry in json.loads(changelog_path.read_text()):
            version = entry["version"].lstrip("v")
            releases[version] = {
                "version": version,
                "date": entry.get("date"),
                "changes": entry.get("changes", []),
                "source": "changelog",
            }

    raw_path = DATA / "releases_raw.json"
    if raw_path.exists():
        for entry in json.loads(raw_path.read_text()):
            version = entry["version"].lstrip("v")
            if version not in releases:
                # Parse body as flat change list
                changes = []
                current_section = "general"
                for line in (entry.get("body") or "").split("\n"):
                    section_match = re.match(r"^###\s+(.+)", line)
                    if section_match:
                        current_section = section_match.group(1).lower()
                        continue
                    bullet_match = re.match(r"^[-*]\s+(.+)", line)
                    if bullet_match:
                        changes.append({"section": current_section, "raw": bullet_match.group(1).strip()})
                releases[version] = {
                    "version": version,
                    "date": entry.get("published_at", "")[:10] or None,
                    "changes": changes,
                    "source": "github",
                }

    return sorted(releases.values(), key=lambda x: x.get("date") or "")


def enrich_batch(client: AnthropicBedrock, items: list[str]) -> list[dict]:
    numbered = "\n".join(f"{i+1}. {text}" for i, text in enumerate(items))
    prompt = f"Changelog items to analyze:\n{numbered}"

    try:
        resp = client.messages.create(
            model=BEDROCK_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
            system=BATCH_SYSTEM,
        )
        raw = resp.content[0].text.strip()
        # Extract JSON array even if wrapped in markdown
        json_match = re.search(r"\[.+\]", raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(raw)
    except Exception as e:
        print(f"  LLM batch failed: {e}", file=sys.stderr)
        return [{"importance": 2, "summary": items[i][:40], "why_matters": ""} for i in range(len(items))]


def enrich_releases():
    import os
    aws_profile = os.environ.get("AWS_PROFILE", AWS_PROFILE)
    client = AnthropicBedrock(aws_profile=aws_profile)
    print(f"Using Bedrock model: {BEDROCK_MODEL} (profile: {aws_profile})")

    releases = load_releases()
    if not releases:
        print("No releases found. Run scripts 01 and/or 02 first.", file=sys.stderr)
        sys.exit(1)

    total_changes = sum(len(r["changes"]) for r in releases)
    print(f"Processing {len(releases)} releases, {total_changes} change items...")

    enriched_releases = []
    batch_size = 10
    processed = 0

    for release in releases:
        changes = release["changes"]
        enriched_changes = []

        # Process in batches
        for i in range(0, len(changes), batch_size):
            batch = changes[i : i + batch_size]
            texts = [c["raw"] for c in batch]
            results = enrich_batch(client, texts)

            for j, (change, result) in enumerate(zip(batch, results)):
                enriched_changes.append(
                    {
                        "section": change.get("section", "general"),
                        "raw": change["raw"],
                        "category": rule_based_category(change["raw"]),
                        "importance": result.get("importance", 2),
                        "summary": result.get("summary", change["raw"][:40]),
                        "why_matters": result.get("why_matters", ""),
                        "enriched": True,
                    }
                )
            processed += len(batch)
            if total_changes > 0:
                pct = processed / total_changes * 100
                print(f"  Progress: {processed}/{total_changes} ({pct:.0f}%) — v{release['version']}")

        enriched_releases.append(
            {
                "version": release["version"],
                "date": release.get("date"),
                "source": release.get("source"),
                "changes": enriched_changes,
            }
        )

    out_path = DATA / "enriched.json"
    out_path.write_text(json.dumps(enriched_releases, indent=2, ensure_ascii=False))
    print(f"Enrichment complete → {out_path}")


if __name__ == "__main__":
    enrich_releases()
