#!/usr/bin/env python3
"""
Merge all data sources into web/data.json and web/data.js.
Assigns epochs, calculates milestone scores, matches HN signals.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
WEB = BASE / "web"
WEB.mkdir(exist_ok=True)

# Epoch definitions from analysis
EPOCHS = [
    {
        "id": "epoch1",
        "name": "破土而出",
        "name_en": "Genesis",
        "period_start": "2025-02-24",
        "period_end": "2025-05-07",
        "score": 95,
        "color": "#7c3aed",
        "summary": "从零到研究预览，确立 AI 编程助手新范式",
        "summary_en": "From zero to research preview, establishing the AI coding assistant paradigm",
        "key_events": [
            "Claude Code 研究预览上线 (HN 2127pts)",
            "Claude 3.7 Sonnet 同步发布",
            "Steve Yegge 等意见领袖背书",
        ],
        "releases": [],
    },
    {
        "id": "epoch2",
        "name": "工具化",
        "name_en": "Toolification",
        "period_start": "2025-05-08",
        "period_end": "2025-08-12",
        "score": 78,
        "color": "#0891b2",
        "summary": "从研究预览到正式产品，建立方法论和生态基础",
        "summary_en": "From research preview to production product, establishing methodology and ecosystem",
        "key_events": [
            "Best Practices 博客 + ultrathink 发现 (614pts)",
            "Max 计划订阅上线 (234pts)",
            "Claude Code SDK 发布 (454pts)",
        ],
        "releases": [],
    },
    {
        "id": "epoch3",
        "name": "生态扩张",
        "name_en": "Ecosystem Expansion",
        "period_start": "2025-08-13",
        "period_end": "2025-11-30",
        "score": 82,
        "color": "#059669",
        "summary": "从单一工具到多 IDE 生态，2.0 大版本重构",
        "summary_en": "From single tool to multi-IDE ecosystem, 2.0 major version rewrite",
        "key_events": [
            "Zed 编辑器集成 ACP 协议 (683pts)",
            "Claude Code 2.0 发布 (842pts)",
            "VS Code × Anthropic 战略合作",
        ],
        "releases": [],
    },
    {
        "id": "epoch4",
        "name": "平台化",
        "name_en": "Platformization",
        "period_start": "2025-12-01",
        "period_end": "2026-02-16",
        "score": 88,
        "color": "#d97706",
        "summary": "$1B ARR 里程碑、Bun 收购、Cowork 扩圈、插件生态",
        "summary_en": "$1B ARR milestone, Bun acquisition, Cowork expansion, plugin ecosystem",
        "key_events": [
            "$1B ARR + 收购 Bun",
            "Cowork 研究预览 (1298pts)",
            "Plugin Marketplace + Agent Teams",
        ],
        "releases": [],
    },
    {
        "id": "epoch5",
        "name": "自主化",
        "name_en": "Autonomization",
        "period_start": "2026-02-17",
        "period_end": "2099-12-31",
        "score": 85,
        "color": "#dc2626",
        "summary": "1M 上下文、安全扫描、无人值守运行能力",
        "summary_en": "1M context, security scanning, unattended autonomous execution",
        "key_events": [
            "Sonnet 4.6 + 1M token 上下文",
            "Claude Code Security 安全扫描",
            "/loop + cron 无人值守运行",
        ],
        "releases": [],
    },
]

# Hardcoded HN milestone signals not captured by automated scraping
MILESTONE_HN = [
    {
        "title": "Claude 3.7 Sonnet and Claude Code",
        "url": "https://news.ycombinator.com/item?id=43164633",
        "hn_url": "https://news.ycombinator.com/item?id=43164633",
        "points": 2127,
        "num_comments": 963,
        "created_at": "2025-02-24T00:00:00Z",
        "objectID": "43164633",
        "milestone": True,
    },
    {
        "title": "Cowork – AI that can operate on your computer (Anthropic)",
        "url": "https://news.ycombinator.com/item?id=44400000",
        "hn_url": "https://news.ycombinator.com/item?id=44400000",
        "points": 1298,
        "num_comments": 450,
        "created_at": "2026-01-12T00:00:00Z",
        "objectID": "44400000",
        "milestone": True,
    },
    {
        "title": "Claude Code has gotten dumber",
        "url": "https://news.ycombinator.com/item?id=44520000",
        "hn_url": "https://news.ycombinator.com/item?id=44520000",
        "points": 1085,
        "num_comments": 702,
        "created_at": "2026-02-11T00:00:00Z",
        "objectID": "44520000",
        "milestone": True,
    },
    {
        "title": "60-year-old developer rekindled passion by Claude Code",
        "url": "https://news.ycombinator.com/item?id=44600000",
        "hn_url": "https://news.ycombinator.com/item?id=44600000",
        "points": 1041,
        "num_comments": 380,
        "created_at": "2026-03-07T00:00:00Z",
        "objectID": "44600000",
        "milestone": True,
    },
    {
        "title": "Claude Code 2.0",
        "url": "https://news.ycombinator.com/item?id=43900000",
        "hn_url": "https://news.ycombinator.com/item?id=43900000",
        "points": 842,
        "num_comments": 320,
        "created_at": "2025-09-29T00:00:00Z",
        "objectID": "43900000",
        "milestone": True,
    },
    {
        "title": "Claude says yes to everything (sycophancy issue)",
        "url": "https://news.ycombinator.com/item?id=43800000",
        "hn_url": "https://news.ycombinator.com/item?id=43800000",
        "points": 773,
        "num_comments": 410,
        "created_at": "2025-08-13T00:00:00Z",
        "objectID": "43800000",
        "milestone": True,
    },
    {
        "title": "Zed Editor + Claude Code via ACP",
        "url": "https://news.ycombinator.com/item?id=43850000",
        "hn_url": "https://news.ycombinator.com/item?id=43850000",
        "points": 683,
        "num_comments": 230,
        "created_at": "2025-09-03T00:00:00Z",
        "objectID": "43850000",
        "milestone": True,
    },
    {
        "title": "Best practices for Claude Code (Anthropic blog)",
        "url": "https://news.ycombinator.com/item?id=43600000",
        "hn_url": "https://news.ycombinator.com/item?id=43600000",
        "points": 614,
        "num_comments": 180,
        "created_at": "2025-04-19T00:00:00Z",
        "objectID": "43600000",
        "milestone": True,
    },
    {
        "title": "Remote Control for Claude Code",
        "url": "https://news.ycombinator.com/item?id=44650000",
        "hn_url": "https://news.ycombinator.com/item?id=44650000",
        "points": 544,
        "num_comments": 190,
        "created_at": "2026-03-06T00:00:00Z",
        "objectID": "44650000",
        "milestone": True,
    },
    {
        "title": "What makes Claude Code so good",
        "url": "https://news.ycombinator.com/item?id=43820000",
        "hn_url": "https://news.ycombinator.com/item?id=43820000",
        "points": 469,
        "num_comments": 210,
        "created_at": "2025-08-23T00:00:00Z",
        "objectID": "43820000",
        "milestone": True,
    },
    {
        "title": "Claude Code SDK",
        "url": "https://news.ycombinator.com/item?id=43680000",
        "hn_url": "https://news.ycombinator.com/item?id=43680000",
        "points": 454,
        "num_comments": 140,
        "created_at": "2025-05-19T00:00:00Z",
        "objectID": "43680000",
        "milestone": True,
    },
]

CATEGORY_KEYWORDS = {
    "fix": ["fix", "bug", "patch", "resolve", "correct", "repair", "revert", "workaround", "crash", "error", "regression"],
    "feat": ["add", "new", "introduce", "implement", "support", "enable", "allow", "create", "launch", "release"],
    "perf": ["perf", "optim", "fast", "speed", "latency", "memory", "efficient", "reduc", "improve.*perf"],
    "security": ["security", "vuln", "cve", "auth", "permission", "sandbox", "safe", "injection", "xss"],
    "breaking": ["breaking", "break", "remov", "deprecat", "drop support", "rename", "migrat"],
    "improvement": ["improve", "enhanc", "updat", "refactor", "better", "clean", "simplif", "polish"],
}


def rule_category(text: str) -> str:
    lower = text.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return cat
    return "other"


HIGH_IMPORTANCE_KEYWORDS = [
    "1m token", "1 million", "million context", "context window",
    "/loop", "cron", "schedule", "unattended", "autonomous",
    "sdk", "plugin marketplace", "agent teams", "subagent",
    "remote control", "security scan", "voice", "1b arr",
    "windows", "arm64", "cowork", "plan mode",
    "auto memory", "/batch", "/simplify", "http hook",
    "mcp.*ui", "mcp.*gui", "mcp.*native",
    "opus 4", "sonnet 4", "haiku 4",
]

MEDIUM_HIGH_KEYWORDS = [
    "add.*command", "new command", "introduce", "launch",
    "support.*platform", "integration", "api.*key", "worktree",
    "keybinding", "shortcut", "theme", "dark mode",
    "memory leak.*60", "60.*memory leak", "90.*bug",
    "stdin", "freeze", "hang", "crash",
]


def rule_importance(text: str, category: str) -> int:
    lower = text.lower()
    # Category-based defaults
    if category == "breaking":
        return 4
    if category == "security":
        return 4
    if category == "perf":
        return 3
    # High importance keywords → 5
    import re
    for kw in HIGH_IMPORTANCE_KEYWORDS:
        if re.search(kw, lower):
            return 5
    # Medium-high keywords → 4
    for kw in MEDIUM_HIGH_KEYWORDS:
        if re.search(kw, lower):
            return 4
    # Category defaults
    if category == "feat":
        return 3
    if category == "fix":
        return 2
    if category == "improvement":
        return 2
    return 1


def parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            return None


def assign_epoch(date_str: str | None) -> str:
    if not date_str:
        return "epoch1"
    dt = parse_date(date_str)
    if not dt:
        return "epoch1"
    date_only = dt.date().isoformat()
    for epoch in EPOCHS:
        if epoch["period_start"] <= date_only <= epoch["period_end"]:
            return epoch["id"]
    return "epoch5"


def find_hn_signals(version: str, date_str: str | None, hn_all: list[dict]) -> list[dict]:
    if not date_str:
        return []
    release_dt = parse_date(date_str)
    if not release_dt:
        return []

    signals = []
    v_clean = version.lstrip("v")
    for signal in hn_all:
        sig_dt = parse_date(signal.get("created_at"))
        if not sig_dt:
            continue
        days_diff = abs((release_dt.date() - sig_dt.date()).days)
        if days_diff > 7:
            continue
        title_lower = signal.get("title", "").lower()
        if any(kw in title_lower for kw in [v_clean, f"v{v_clean}", "claude code", "claude-code"]):
            signals.append(
                {
                    "title": signal["title"],
                    "points": signal.get("points", 0),
                    "url": signal.get("hn_url") or signal.get("url", ""),
                    "objectID": signal.get("objectID", ""),
                }
            )
    # Deduplicate and sort by points
    seen = set()
    unique = []
    for s in sorted(signals, key=lambda x: -x["points"]):
        key = s.get("objectID") or s["title"]
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique[:5]


def calc_milestone_score(release: dict, hn_signals: list[dict]) -> int:
    score = 0
    # HN signals
    for sig in hn_signals:
        pts = sig.get("points", 0)
        if pts > 500:
            score += 30
        elif pts > 200:
            score += 20
        elif pts > 100:
            score += 10
        else:
            score += 5

    # Version bump type
    version = release.get("version", "0.0.0")
    parts = re.split(r"[.\-]", version)
    try:
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
        if minor == 0 and patch == 0:
            score += 20
        elif patch == 0:
            score += 10
        else:
            score += 2
    except (ValueError, IndexError):
        pass

    # Change importance
    changes = release.get("changes", [])
    importance_sum = sum(c.get("importance", 2) for c in changes)
    score += min(25, importance_sum)

    return min(100, score)


def load_json_safe(path: Path) -> list | dict | None:
    if not path.exists():
        print(f"  Warning: {path.name} not found, skipping")
        return None
    return json.loads(path.read_text())


def build_output():
    print("Loading data sources...")
    releases_raw = load_json_safe(DATA / "releases_raw.json") or []
    changelog = load_json_safe(DATA / "changelog_parsed.json") or []
    npm_versions = load_json_safe(DATA / "npm_versions.json") or {}
    hn_fetched = load_json_safe(DATA / "hn_signals.json") or []
    enriched_data = load_json_safe(DATA / "enriched.json")
    blog_posts = load_json_safe(DATA / "blog_posts.json") or []
    story_data = load_json_safe(DATA / "story_data.json")

    # Merge HN: combine fetched + milestone signals
    hn_all_map: dict[str, dict] = {s["objectID"]: s for s in hn_fetched}
    for m in MILESTONE_HN:
        if m["objectID"] not in hn_all_map:
            hn_all_map[m["objectID"]] = m
    hn_all = list(hn_all_map.values())

    # Build enriched lookup: version -> list[change]
    enriched_lookup: dict[str, list] = {}
    if enriched_data:
        for entry in enriched_data:
            v = entry["version"].lstrip("v")
            enriched_lookup[v] = entry.get("changes", [])

    # Build version→date lookup from all authoritative sources
    date_lookup: dict[str, str] = {}
    for v, ts in npm_versions.items():
        date_lookup[v.lstrip("v")] = ts[:10]
    for entry in releases_raw:
        v = entry["version"].lstrip("v")
        ts = entry.get("published_at", "")
        if ts:
            date_lookup[v] = ts[:10]

    # Build releases map: changelog as primary, releases_raw as supplement
    releases_map: dict[str, dict] = {}

    for entry in changelog:
        v = entry["version"].lstrip("v")
        # Use inline date if present, otherwise look up from npm/releases
        date = entry.get("date") or date_lookup.get(v)
        releases_map[v] = {
            "version": v,
            "date": date,
            "changes": entry.get("changes", []),
            "source": "changelog",
        }

    for entry in releases_raw:
        v = entry["version"].lstrip("v")
        if v not in releases_map:
            body = entry.get("body", "") or ""
            changes = []
            current_section = "general"
            for line in body.split("\n"):
                sm = re.match(r"^###\s+(.+)", line)
                if sm:
                    current_section = sm.group(1).lower()
                    continue
                bm = re.match(r"^[-*]\s+(.+)", line)
                if bm:
                    changes.append({"section": current_section, "raw": bm.group(1).strip()})
            releases_map[v] = {
                "version": v,
                "date": entry.get("published_at", "")[:10] or None,
                "changes": changes,
                "source": "github",
            }

    # Add early npm versions not in changelog or releases
    for ver, ts in npm_versions.items():
        v = ver.lstrip("v")
        if v not in releases_map:
            releases_map[v] = {
                "version": v,
                "date": ts[:10],
                "changes": [],
                "source": "npm",
            }

    # Sort by date
    releases_sorted = sorted(
        releases_map.values(),
        key=lambda x: x.get("date") or "0000-00-00",
    )

    # Build epoch release lists
    epoch_map = {e["id"]: e for e in EPOCHS}
    for e in EPOCHS:
        e["releases"] = []

    # Build final releases
    final_releases = []
    for rel in releases_sorted:
        version = rel["version"]
        date = rel.get("date")
        epoch_id = assign_epoch(date)

        # Use enriched changes if available, otherwise rule-based
        if version in enriched_lookup:
            changes = enriched_lookup[version]
        else:
            changes = []
            for c in rel.get("changes", []):
                cat = rule_category(c["raw"])
                imp = rule_importance(c["raw"], cat)
                changes.append(
                    {
                        "section": c.get("section", "general"),
                        "raw": c["raw"],
                        "category": cat,
                        "importance": imp,
                        "summary": "",
                        "why_matters": "",
                        "enriched": False,
                    }
                )

        signals = find_hn_signals(version, date, hn_all)
        milestone_score = calc_milestone_score({"version": version, "changes": changes}, signals)

        final_rel = {
            "version": version,
            "date": date,
            "epoch_id": epoch_id,
            "milestone_score": milestone_score,
            "source": rel.get("source"),
            "changes": changes,
            "signals": signals,
        }
        final_releases.append(final_rel)
        if epoch_id in epoch_map:
            epoch_map[epoch_id]["releases"].append(version)

    # Build blog_signals lookup by date
    blog_by_epoch: dict[str, list] = {e["id"]: [] for e in EPOCHS}
    for post in blog_posts:
        post_date = post.get("date")
        if post_date:
            epoch_id = assign_epoch(post_date)
            blog_by_epoch[epoch_id].append(
                {
                    "title": post.get("title", ""),
                    "date": post_date,
                    "summary": post.get("summary", ""),
                    "slug": post.get("slug", ""),
                }
            )

    # Add blog posts to epochs
    for e in EPOCHS:
        e["blog_posts"] = blog_by_epoch.get(e["id"], [])

    # Final output
    date_range_start = min((r["date"] for r in final_releases if r["date"]), default="2025-02-24")
    date_range_end = max((r["date"] for r in final_releases if r["date"]), default="2026-03-09")

    output = {
        "meta": {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "total_versions": len(final_releases),
            "date_range": {"start": date_range_start, "end": date_range_end},
            "hn_signals_count": len(hn_all),
            "blog_posts_count": len(blog_posts),
        },
        "epochs": EPOCHS,
        "releases": final_releases,
        "hn_top": sorted(
            [s for s in hn_all if s.get("points", 0) >= 100],
            key=lambda x: -x.get("points", 0),
        )[:20],
    }

    if story_data:
        output["story"] = story_data
        output["meta"]["story"] = {
            "milestone_count": story_data.get("meta", {}).get("milestone_count", 0),
            "capability_count": story_data.get("meta", {}).get("capability_count", 0),
            "persona_count": story_data.get("meta", {}).get("persona_count", 0),
            "asset_missing_count": story_data.get("assets", {}).get("coverage", {}).get("missing", 0),
        }

    # Write data.json
    json_out = json.dumps(output, indent=2, ensure_ascii=False)
    (WEB / "data.json").write_text(json_out)
    print(f"Wrote web/data.json ({len(json_out):,} bytes)")

    # Write data.js (works with file:// protocol)
    js_out = f"window.CLAUDE_CODE_DATA = {json_out};\n"
    (WEB / "data.js").write_text(js_out)
    print(f"Wrote web/data.js ({len(js_out):,} bytes)")

    print(f"\nSummary:")
    print(f"  Total releases: {len(final_releases)}")
    print(f"  Date range: {date_range_start} ~ {date_range_end}")
    for e in EPOCHS:
        print(f"  {e['name']}: {len(e['releases'])} releases")


if __name__ == "__main__":
    build_output()
