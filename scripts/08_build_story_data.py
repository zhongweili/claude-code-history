#!/usr/bin/env python3
"""Build storytelling-oriented data for the public-facing Claude Code history site."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

BASE = Path(__file__).parent.parent
DATA = BASE / "data"
EDITORIAL = DATA / "editorial"
WEB = BASE / "web"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def days_between(a: str | None, b: str | None) -> int | None:
    a_dt = parse_date(a)
    b_dt = parse_date(b)
    if not a_dt or not b_dt:
        return None
    return abs((a_dt.date() - b_dt.date()).days)


def normalize_title(text: str) -> str:
    lowered = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", text.lower())
    return re.sub(r"\s+", " ", lowered).strip()


def esc_domain(url: str) -> str:
    try:
        domain = urlparse(url).netloc.lower()
        return domain.removeprefix("www.")
    except Exception:
        return ""


def match_keywords(text: str, keywords: list[str]) -> list[str]:
    lower = text.lower()
    hits: list[str] = []
    for keyword in keywords:
        kw = keyword.lower()
        if kw and kw in lower:
            hits.append(keyword)
    return hits


def to_release_url(version: str) -> str:
    return f"https://github.com/anthropics/claude-code/releases/tag/v{version}"


def build_lookups(bundle: dict[str, Any], blog_posts: list[dict[str, Any]], hn_items: list[dict[str, Any]]) -> dict[str, Any]:
    releases = bundle["releases"]
    epochs = bundle["epochs"]

    epoch_lookup = {epoch["id"]: epoch for epoch in epochs}
    release_lookup = {release["version"]: release for release in releases}
    blog_lookup = {post["slug"]: post for post in blog_posts}

    hn_lookup: dict[str, dict[str, Any]] = {}
    for item in hn_items + bundle.get("hn_top", []):
        object_id = str(item.get("objectID", "")).strip()
        if not object_id:
            continue
        existing = hn_lookup.get(object_id)
        if not existing or item.get("points", 0) > existing.get("points", 0):
            hn_lookup[object_id] = item

    release_dates = [release["date"] for release in releases if release.get("date")]
    return {
        "epochs": epochs,
        "epoch_lookup": epoch_lookup,
        "release_lookup": release_lookup,
        "blog_lookup": blog_lookup,
        "hn_lookup": hn_lookup,
        "release_dates": release_dates,
    }


def find_epoch_id(date_value: str | None, epochs: list[dict[str, Any]]) -> str | None:
    if not date_value:
        return None
    for epoch in epochs:
        if epoch["period_start"] <= date_value <= epoch["period_end"]:
            return epoch["id"]
    return None


def collect_related_changes(
    releases: list[dict[str, Any]],
    keywords: list[str],
) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    for release in releases:
        for change in release.get("changes", []):
            haystack = " ".join(
                [
                    change.get("raw", ""),
                    change.get("summary", ""),
                    change.get("why_matters", ""),
                ]
            )
            keyword_hits = match_keywords(haystack, keywords)
            if not keyword_hits:
                continue
            matches.append(
                {
                    "version": release["version"],
                    "date": release.get("date"),
                    "epoch_id": release.get("epoch_id"),
                    "source": release.get("source"),
                    "raw": change.get("raw", ""),
                    "summary": change.get("summary", ""),
                    "why_matters": change.get("why_matters", ""),
                    "importance": change.get("importance", 1),
                    "category": change.get("category", "other"),
                    "keyword_hits": keyword_hits,
                }
            )
    matches.sort(
        key=lambda item: (
            item.get("date") or "9999-12-31",
            item.get("importance", 1),
            item.get("version", ""),
        )
    )
    return matches


def dated_bounds(items: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    dated = [item for item in items if item.get("date")]
    if dated:
        return dated[0], dated[-1]
    if items:
        return items[0], items[-1]
    return None, None


def maturity_score(change_count: int, release_count: int, epoch_count: int, avg_importance: float) -> tuple[int, str]:
    score = min(
        100,
        round(
            min(30, change_count * 0.7)
            + min(28, release_count * 1.8)
            + min(22, epoch_count * 5)
            + min(20, avg_importance * 4)
        ),
    )
    if score >= 80:
        return score, "成熟"
    if score >= 60:
        return score, "成型"
    if score >= 40:
        return score, "增长中"
    return score, "早期"


def build_capabilities(
    capability_defs: list[dict[str, Any]],
    bundle: dict[str, Any],
) -> list[dict[str, Any]]:
    releases = bundle["releases"]
    epoch_lookup = {epoch["id"]: epoch for epoch in bundle["epochs"]}
    capabilities: list[dict[str, Any]] = []

    for definition in capability_defs:
        matches = collect_related_changes(releases, definition["keywords"])
        unique_versions = sorted({item["version"] for item in matches})
        epoch_counts: dict[str, dict[str, Any]] = {}
        for epoch in bundle["epochs"]:
            epoch_items = [item for item in matches if item.get("epoch_id") == epoch["id"]]
            if not epoch_items:
                continue
            epoch_counts[epoch["id"]] = {
                "epoch_id": epoch["id"],
                "name": epoch["name"],
                "change_count": len(epoch_items),
                "release_count": len({item["version"] for item in epoch_items}),
                "avg_importance": round(
                    sum(item.get("importance", 1) for item in epoch_items) / len(epoch_items), 2
                ),
            }

        samples = sorted(
            matches,
            key=lambda item: (
                item.get("importance", 1),
                item.get("date") or "0000-00-00",
            ),
            reverse=True,
        )[:4]

        first_seen, latest_seen = dated_bounds(matches)
        avg_importance = (
            sum(item.get("importance", 1) for item in matches) / len(matches) if matches else 0.0
        )
        score, level = maturity_score(
            change_count=len(matches),
            release_count=len(unique_versions),
            epoch_count=len(epoch_counts),
            avg_importance=avg_importance,
        )

        capabilities.append(
            {
                **definition,
                "change_count": len(matches),
                "release_count": len(unique_versions),
                "avg_importance": round(avg_importance, 2) if matches else 0,
                "maturity": {"score": score, "level": level},
                "first_seen": {
                    "date": first_seen.get("date"),
                    "version": first_seen.get("version"),
                }
                if first_seen
                else None,
                "latest_seen": {
                    "date": latest_seen.get("date"),
                    "version": latest_seen.get("version"),
                }
                if latest_seen
                else None,
                "epochs": [epoch_counts[epoch["id"]] for epoch in bundle["epochs"] if epoch["id"] in epoch_counts],
                "samples": [
                    {
                        "date": item.get("date"),
                        "version": item.get("version"),
                        "raw": item.get("raw"),
                        "summary": item.get("summary"),
                        "importance": item.get("importance"),
                        "category": item.get("category"),
                    }
                    for item in samples
                ],
                "coverage": {
                    "earliest_epoch": epoch_lookup[first_seen["epoch_id"]]["name"] if first_seen else None,
                    "latest_epoch": epoch_lookup[latest_seen["epoch_id"]]["name"] if latest_seen else None,
                    "epoch_count": len(epoch_counts),
                },
            }
        )

    return capabilities


def build_assets(asset_defs: list[dict[str, Any]]) -> dict[str, Any]:
    assets = []
    missing = 0
    for asset in asset_defs:
        if asset.get("status") != "ready":
            missing += 1
        assets.append(asset)
    return {
        "items": assets,
        "coverage": {
            "total": len(assets),
            "ready": len(assets) - missing,
            "missing": missing,
        },
    }


def build_milestones(
    milestone_defs: list[dict[str, Any]],
    capability_lookup: dict[str, dict[str, Any]],
    persona_lookup: dict[str, dict[str, Any]],
    inputs: dict[str, Any],
) -> list[dict[str, Any]]:
    release_lookup = inputs["release_lookup"]
    blog_lookup = inputs["blog_lookup"]
    hn_lookup = inputs["hn_lookup"]
    epochs = inputs["epochs"]

    milestones = []
    for definition in sorted(milestone_defs, key=lambda item: item["date"]):
        evidence: list[dict[str, Any]] = []

        for slug in definition.get("blog_slugs", []):
            post = blog_lookup.get(slug)
            if not post:
                continue
            evidence.append(
                {
                    "type": "blog",
                    "title": post.get("title"),
                    "date": post.get("date"),
                    "url": f"https://www.anthropic.com/news/{slug}",
                    "summary": post.get("summary"),
                }
            )

        for object_id in definition.get("hn_object_ids", []):
            signal = hn_lookup.get(str(object_id))
            if not signal:
                continue
            evidence.append(
                {
                    "type": "community",
                    "title": signal.get("title"),
                    "date": (signal.get("created_at") or "")[:10] or None,
                    "url": signal.get("hn_url") or signal.get("url"),
                    "points": signal.get("points", 0),
                    "comments": signal.get("num_comments", 0),
                    "domain": esc_domain(signal.get("url", "")),
                }
            )

        for version in definition.get("related_versions", []):
            release = release_lookup.get(version)
            if not release:
                continue
            highlight_pool = release.get("changes", [])
            if definition.get("capability_ids"):
                capability_keywords = [
                    keyword
                    for capability_id in definition["capability_ids"]
                    for keyword in capability_lookup.get(capability_id, {}).get("keywords", [])
                ]
                filtered = [
                    change
                    for change in highlight_pool
                    if match_keywords(
                        " ".join(
                            [change.get("raw", ""), change.get("summary", ""), change.get("why_matters", "")]
                        ),
                        capability_keywords,
                    )
                ]
                if filtered:
                    highlight_pool = filtered
            highlights = sorted(
                highlight_pool,
                key=lambda item: item.get("importance", 1),
                reverse=True,
            )[:3]
            evidence.append(
                {
                    "type": "release",
                    "title": f"v{version}",
                    "date": release.get("date"),
                    "url": to_release_url(version),
                    "source": release.get("source"),
                    "highlights": [
                        {
                            "raw": item.get("raw"),
                            "summary": item.get("summary"),
                            "importance": item.get("importance", 1),
                        }
                        for item in highlights
                    ],
                }
            )

        epoch_id = find_epoch_id(definition.get("date"), epochs)
        milestones.append(
            {
                **definition,
                "epoch_id": epoch_id,
                "epoch_name": inputs["epoch_lookup"][epoch_id]["name"] if epoch_id else None,
                "capabilities": [
                    {
                        "id": capability_id,
                        "name": capability_lookup[capability_id]["name"],
                    }
                    for capability_id in definition.get("capability_ids", [])
                    if capability_id in capability_lookup
                ],
                "personas": [
                    {
                        "id": persona_id,
                        "name": persona_lookup[persona_id]["name"],
                    }
                    for persona_id in definition.get("persona_ids", [])
                    if persona_id in persona_lookup
                ],
                "evidence": sorted(evidence, key=lambda item: item.get("date") or "0000-00-00"),
                "evidence_summary": {
                    "official_sources": len([item for item in evidence if item["type"] == "blog"]),
                    "community_sources": len([item for item in evidence if item["type"] == "community"]),
                    "release_sources": len([item for item in evidence if item["type"] == "release"]),
                },
            }
        )

    return milestones


def select_persona_samples(
    capability_lookup: dict[str, dict[str, Any]],
    capability_ids: list[str],
    persona_keywords: list[str],
) -> list[dict[str, Any]]:
    pool: list[dict[str, Any]] = []
    for capability_id in capability_ids:
        capability = capability_lookup.get(capability_id)
        if not capability:
            continue
        for sample in capability.get("samples", []):
            score = sample.get("importance", 1)
            if persona_keywords and match_keywords(
                " ".join([sample.get("raw", ""), sample.get("summary", "")]),
                persona_keywords,
            ):
                score += 2
            pool.append({**sample, "capability_id": capability_id, "score": score})

    deduped: dict[tuple[str | None, str], dict[str, Any]] = {}
    for item in pool:
        key = (item.get("version"), item.get("raw", ""))
        existing = deduped.get(key)
        if not existing or item["score"] > existing["score"]:
            deduped[key] = item

    return sorted(
        deduped.values(),
        key=lambda item: (item["score"], item.get("date") or "0000-00-00"),
        reverse=True,
    )[:4]


def build_personas(
    persona_defs: list[dict[str, Any]],
    capability_lookup: dict[str, dict[str, Any]],
    milestone_lookup: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    personas = []
    for definition in persona_defs:
        related_capabilities = [
            capability_lookup[capability_id]
            for capability_id in definition.get("capability_ids", [])
            if capability_id in capability_lookup
        ]
        related_milestones = [
            milestone_lookup[milestone_id]
            for milestone_id in definition.get("milestone_ids", [])
            if milestone_id in milestone_lookup
        ]

        first_seen_candidates = [
            capability.get("first_seen")
            for capability in related_capabilities
            if capability.get("first_seen")
        ]
        first_seen_candidates.sort(key=lambda item: item.get("date") or "9999-12-31")
        first_supported = first_seen_candidates[0] if first_seen_candidates else None

        maturity_values = [capability["maturity"]["score"] for capability in related_capabilities]
        maturity_score_value = round(sum(maturity_values) / len(maturity_values)) if maturity_values else 0
        if maturity_score_value >= 80:
            maturity_label = "成熟"
        elif maturity_score_value >= 60:
            maturity_label = "成型"
        elif maturity_score_value >= 40:
            maturity_label = "增长中"
        else:
            maturity_label = "探索中"

        samples = select_persona_samples(
            capability_lookup,
            definition.get("capability_ids", []),
            definition.get("keywords", []),
        )

        personas.append(
            {
                **definition,
                "first_supported": first_supported,
                "maturity": {"score": maturity_score_value, "level": maturity_label},
                "capabilities": [
                    {
                        "id": capability["id"],
                        "name": capability["name"],
                        "maturity": capability["maturity"],
                    }
                    for capability in related_capabilities
                ],
                "milestones": [
                    {
                        "id": milestone["id"],
                        "title": milestone["title"],
                        "date": milestone["date"],
                    }
                    for milestone in related_milestones
                ],
                "sample_changes": samples,
            }
        )
    return personas


def build_ecosystem(
    track_defs: list[dict[str, Any]],
    capability_lookup: dict[str, dict[str, Any]],
    milestone_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    tracks = []
    for definition in track_defs:
        track_capabilities = [
            capability_lookup[capability_id]
            for capability_id in definition.get("capability_ids", [])
            if capability_id in capability_lookup
        ]
        track_milestones = [
            milestone_lookup[milestone_id]
            for milestone_id in definition.get("milestone_ids", [])
            if milestone_id in milestone_lookup
        ]

        tracks.append(
            {
                **definition,
                "capabilities": [
                    {
                        "id": capability["id"],
                        "name": capability["name"],
                        "maturity": capability["maturity"],
                    }
                    for capability in track_capabilities
                ],
                "milestones": [
                    {
                        "id": milestone["id"],
                        "title": milestone["title"],
                        "date": milestone["date"],
                    }
                    for milestone in track_milestones
                ],
                "surface_area": {
                    "capability_count": len(track_capabilities),
                    "milestone_count": len(track_milestones),
                    "total_changes": sum(capability.get("change_count", 0) for capability in track_capabilities),
                },
            }
        )

    return {"tracks": tracks}


THEME_RULES = [
    ("launch", ["claude 3.7", "2.0", "cowork", "introducing", "launch"]),
    ("workflow", ["how i use", "planning", "execution", "best practices", "all you need"]),
    ("ecosystem", ["zed", "emacs", "sdk", "desktop", "voice", "remote control", "plugin"]),
    ("critique", ["dumber", "dumbed down", "yes to everything", "degradation", "issue"]),
    ("use_case", ["kernel driver", "60 years old", "factorio", "peon"]),
]

TONE_RULES = {
    "critical": ["dumber", "dumbed down", "yes to everything", "issue", "degradation"],
    "use_case": ["how i use", "tell hn", "using", "what makes", "all you need", "passion"],
    "official": ["anthropic", "introducing", "claude 3.7", "cowork"],
}


def classify_theme(title: str) -> str:
    normalized = normalize_title(title)
    for theme, keywords in THEME_RULES:
        if any(keyword in normalized for keyword in keywords):
            return theme
    return "general"


def classify_tone(title: str, url: str) -> str:
    normalized = normalize_title(title)
    domain = esc_domain(url)
    if domain.endswith("anthropic.com"):
        return "official"
    for tone, keywords in TONE_RULES.items():
        if any(keyword in normalized for keyword in keywords):
            return tone
    return "community"


def related_capabilities_for_text(
    text: str,
    capability_defs: list[dict[str, Any]],
) -> list[str]:
    matches = []
    for capability in capability_defs:
        if match_keywords(text, capability.get("keywords", [])):
            matches.append(capability["id"])
    return matches


def dedupe_hn_items(hn_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for item in hn_items:
        title = item.get("title", "")
        if not title:
            continue
        key = normalize_title(title)
        existing = deduped.get(key)
        if not existing or item.get("points", 0) > existing.get("points", 0):
            deduped[key] = item
    return sorted(deduped.values(), key=lambda item: item.get("points", 0), reverse=True)


def build_social_proof(
    bundle: dict[str, Any],
    blog_posts: list[dict[str, Any]],
    hn_items: list[dict[str, Any]],
    capability_defs: list[dict[str, Any]],
    milestone_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    deduped_hn = dedupe_hn_items(hn_items + bundle.get("hn_top", []))
    featured = []
    theme_counter: Counter[str] = Counter()
    tone_counter: Counter[str] = Counter()

    milestone_by_hn: dict[str, list[str]] = defaultdict(list)
    for milestone in milestone_lookup.values():
        for object_id in milestone.get("hn_object_ids", []):
            if milestone["id"] not in milestone_by_hn[str(object_id)]:
                milestone_by_hn[str(object_id)].append(milestone["id"])

    for item in deduped_hn[:18]:
        title = item.get("title", "")
        url = item.get("url") or item.get("hn_url", "")
        theme = classify_theme(title)
        tone = classify_tone(title, url)
        related_capabilities = related_capabilities_for_text(
            " ".join([title, url]),
            capability_defs,
        )
        featured.append(
            {
                "objectID": str(item.get("objectID", "")),
                "title": title,
                "date": (item.get("created_at") or "")[:10] or None,
                "url": item.get("hn_url") or url,
                "external_url": url,
                "points": item.get("points", 0),
                "comments": item.get("num_comments", 0),
                "domain": esc_domain(url),
                "theme": theme,
                "tone": tone,
                "related_capability_ids": related_capabilities,
                "related_milestone_ids": milestone_by_hn.get(str(item.get("objectID", "")), []),
            }
        )
        theme_counter[theme] += 1
        tone_counter[tone] += 1

    official_posts = []
    for post in sorted(blog_posts, key=lambda item: item.get("date") or ""):
        related_milestones = [
            milestone["id"]
            for milestone in milestone_lookup.values()
            if post.get("slug") in milestone.get("blog_slugs", [])
        ]
        official_posts.append(
            {
                "slug": post.get("slug"),
                "title": post.get("title"),
                "date": post.get("date"),
                "summary": post.get("summary"),
                "url": f"https://www.anthropic.com/news/{post.get('slug')}",
                "related_milestone_ids": related_milestones,
            }
        )

    themes = [
        {
            "id": theme,
            "count": count,
            "share": round(count / len(featured), 3) if featured else 0,
        }
        for theme, count in theme_counter.most_common()
    ]
    tones = [
        {
            "id": tone,
            "count": count,
            "share": round(count / len(featured), 3) if featured else 0,
        }
        for tone, count in tone_counter.most_common()
    ]

    return {
        "featured_hn": featured,
        "official_posts": official_posts,
        "themes": themes,
        "tones": tones,
    }


def build_provenance(
    milestones: list[dict[str, Any]],
    assets: dict[str, Any],
    capabilities: list[dict[str, Any]],
) -> dict[str, Any]:
    official = 0
    community = 0
    release = 0
    for milestone in milestones:
        for evidence in milestone.get("evidence", []):
            if evidence["type"] == "blog":
                official += 1
            elif evidence["type"] == "community":
                community += 1
            elif evidence["type"] == "release":
                release += 1

    capability_with_samples = len([capability for capability in capabilities if capability.get("samples")])
    return {
        "source_counts": {
            "official": official,
            "community": community,
            "release": release,
        },
        "coverage": {
            "assets_missing": assets["coverage"]["missing"],
            "assets_ready": assets["coverage"]["ready"],
            "capabilities_with_samples": capability_with_samples,
            "capability_count": len(capabilities),
        },
        "notes": [
            "里程碑、角色和视觉资产为 editorial 配置。",
            "能力、角色样本和社交信号由规则从 release/blog/HN 数据自动派生。",
            "社交信号以 HN 标题和热度为主，尚未引入评论内容级分析。",
        ],
    }


def build_story_data() -> dict[str, Any]:
    bundle = load_json(WEB / "data.json")
    blog_posts = load_json(DATA / "blog_posts.json")
    hn_items = load_json(DATA / "hn_signals.json")
    capability_defs = load_json(EDITORIAL / "capabilities.json")
    persona_defs = load_json(EDITORIAL / "personas.json")
    milestone_defs = load_json(EDITORIAL / "milestones.json")
    track_defs = load_json(EDITORIAL / "ecosystem_tracks.json")
    asset_defs = load_json(EDITORIAL / "visual_assets.json")

    inputs = build_lookups(bundle, blog_posts, hn_items)
    capabilities = build_capabilities(capability_defs, bundle)
    capability_lookup = {capability["id"]: capability for capability in capabilities}
    persona_lookup_base = {persona["id"]: persona for persona in persona_defs}

    milestones = build_milestones(
        milestone_defs,
        capability_lookup=capability_lookup,
        persona_lookup=persona_lookup_base,
        inputs=inputs,
    )
    milestone_lookup = {milestone["id"]: milestone for milestone in milestones}
    personas = build_personas(persona_defs, capability_lookup, milestone_lookup)
    assets = build_assets(asset_defs)
    ecosystem = build_ecosystem(track_defs, capability_lookup, milestone_lookup)
    social_proof = build_social_proof(
        bundle=bundle,
        blog_posts=blog_posts,
        hn_items=hn_items,
        capability_defs=capability_defs,
        milestone_lookup=milestone_lookup,
    )
    provenance = build_provenance(milestones, assets, capabilities)

    hero = {
        "headline": "Claude Code 如何从命令行助手，长成知识工作的代理平台",
        "subheadline": "这不是一串版本号，而是一条从研究预览、平台化到无人值守协作的能力演进线。",
        "highlights": [
            {"label": "关键时刻", "value": len(milestones)},
            {"label": "能力主线", "value": len(capabilities)},
            {"label": "角色画像", "value": len(personas)},
            {"label": "待补视觉", "value": assets["coverage"]["missing"]},
        ],
    }

    return {
        "meta": {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "milestone_count": len(milestones),
            "capability_count": len(capabilities),
            "persona_count": len(personas),
            "featured_hn_count": len(social_proof["featured_hn"]),
            "official_post_count": len(social_proof["official_posts"]),
        },
        "hero": hero,
        "milestones": milestones,
        "capabilities": capabilities,
        "personas": personas,
        "ecosystem": ecosystem,
        "social_proof": social_proof,
        "assets": assets,
        "provenance": provenance,
    }


def write_outputs(story: dict[str, Any]) -> None:
    story_json = json.dumps(story, indent=2, ensure_ascii=False)
    (DATA / "story_data.json").write_text(story_json)

    bundle = load_json(WEB / "data.json")
    bundle["story"] = story
    bundle.setdefault("meta", {})
    bundle["meta"]["story"] = {
        "milestone_count": story["meta"]["milestone_count"],
        "capability_count": story["meta"]["capability_count"],
        "persona_count": story["meta"]["persona_count"],
        "asset_missing_count": story["assets"]["coverage"]["missing"],
    }

    web_json = json.dumps(bundle, indent=2, ensure_ascii=False)
    (WEB / "data.json").write_text(web_json)
    (WEB / "data.js").write_text(f"window.CLAUDE_CODE_DATA = {web_json};\n")


def main() -> None:
    story = build_story_data()
    write_outputs(story)
    print(f"Wrote {DATA / 'story_data.json'}")
    print(
        "Story summary:",
        f"{story['meta']['milestone_count']} milestones,",
        f"{story['meta']['capability_count']} capabilities,",
        f"{story['meta']['persona_count']} personas,",
        f"{story['assets']['coverage']['missing']} missing visual assets",
    )


if __name__ == "__main__":
    main()
