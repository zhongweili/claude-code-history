#!/usr/bin/env bun
/**
 * Fully automated Claude Code History pipeline.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun agent/update.ts                # full run
 *   OPENAI_API_KEY=sk-... bun agent/update.ts --incremental  # only enrich new versions
 *   OPENAI_API_KEY=sk-... bun agent/update.ts --sample 10    # test with 10 latest versions
 *
 * Requires: bun, OPENAI_API_KEY env var
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── paths ──────────────────────────────────────────────────────────────────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");
const CAPS_SEED = resolve(DATA, "capabilities_seed.json");
const EPOCHS_SEED = resolve(DATA, "epochs_seed.json");
const OUTPUT = resolve(DATA, "auto_bundle.json");

// ── config ─────────────────────────────────────────────────────────────────
const LLM_MODEL = process.env.OPENROUTER_API_KEY
  ? "openai/gpt-5.4-mini"
  : "gpt-5.4-mini";
const LLM_API = process.env.OPENROUTER_API_KEY
  ? "https://openrouter.ai/api/v1/chat/completions"
  : "https://api.openai.com/v1/chat/completions";
const SAMPLE = (() => {
  const idx = process.argv.indexOf("--sample");
  return idx !== -1 ? Number(process.argv[idx + 1]) : 0;
})();
const INCREMENTAL = process.argv.includes("--incremental");

// ── types ──────────────────────────────────────────────────────────────────
interface CapSeed {
  id: string;
  name: string;
  name_en: string;
  summary: string;
  summary_en: string;
  keywords: string[];
}
interface EpochSeed {
  id: string;
  name: string;
  name_en: string;
  period_start: string;
  period_end: string;
  color: string;
  summary: string;
  summary_en: string;
}
interface ParsedVersion {
  version: string;
  date: string | null;
  changes: { section: string; raw: string }[];
}
interface EnrichedChange {
  raw: string;
  category: string;
  importance: number;
  summary: string;
  summary_en: string;
  why_matters: string;
  why_matters_en: string;
  capability_ids: string[];
}
interface Release {
  version: string;
  date: string | null;
  epoch_id: string;
  source: string;
  changes: EnrichedChange[];
  signals: { title: string; points: number; url: string }[];
  highlight_score: number;
}
interface Highlight {
  version: string;
  date: string;
  epoch_id: string;
  highlight_score: number;
  highlight_title: string;
  highlight_title_en: string;
  highlight_summary: string;
  highlight_summary_en: string;
  highlight_why: string;
  highlight_why_en: string;
  capability_ids: string[];
  evidence: {
    hn_signals: { title: string; points: number; url: string }[];
    blog_post?: { title: string; url: string };
    top_changes: { raw: string; summary: string; importance: number }[];
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────
function log(phase: string, msg: string) {
  console.log(`[${phase}] ${msg}`);
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`Fetch ${url}: ${resp.status}`);
  return resp.text();
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`Fetch ${url}: ${resp.status}`);
  return resp.json() as Promise<T>;
}

// ── OpenAI call with retry ─────────────────────────────────────────────────
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function llm(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY must be set");

  const body = {
    model: LLM_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(LLM_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 429 || resp.status >= 500) {
        const wait = (attempt + 1) * 5000;
        log("llm", `${resp.status}, retrying in ${wait / 1000}s ...`);
        await sleep(wait);
        continue;
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenAI API ${resp.status}: ${text.slice(0, 300)}`);
      }

      const data = (await resp.json()) as any;
      return data.choices[0].message.content ?? "";
    } catch (e: any) {
      if (attempt < 2 && (e.code === "ECONNRESET" || e.message?.includes("socket"))) {
        const wait = (attempt + 1) * 3000;
        log("llm", `Connection error, retrying in ${wait / 1000}s ...`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw new Error("LLM call failed after 3 attempts");
}

function extractJson<T>(text: string): T {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array found in LLM response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// ── Phase 1: Fetch ─────────────────────────────────────────────────────────
async function fetchChangelog(): Promise<string> {
  log("fetch", "Downloading CHANGELOG.md ...");
  return fetchText(
    "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md"
  );
}

async function fetchNpmTimes(): Promise<Record<string, string>> {
  log("fetch", "Fetching npm registry ...");
  const data = await fetchJson<any>("https://registry.npmjs.org/@anthropic-ai/claude-code");
  const times: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.time ?? {})) {
    if (k !== "created" && k !== "modified") times[k] = (v as string).slice(0, 10);
  }
  return times;
}

async function fetchHnSignals(): Promise<{ title: string; points: number; url: string; created_at: string }[]> {
  log("fetch", "Fetching HN signals ...");
  const now = Math.floor(Date.now() / 1000);
  const startTs = Math.floor(new Date("2025-02-01").getTime() / 1000);
  const queries = ["claude code", "claude-code"];
  const seen = new Map<string, any>();
  const WINDOW = 90 * 86400;

  for (const q of queries) {
    let cursor = startTs;
    while (cursor < now) {
      const windowEnd = Math.min(cursor + WINDOW, now);
      const params = new URLSearchParams({
        query: q,
        tags: "story",
        numericFilters: `points>50,created_at_i>${cursor},created_at_i<${windowEnd}`,
        hitsPerPage: "100",
      });
      try {
        const data = await fetchJson<any>(
          `https://hn.algolia.com/api/v1/search_by_date?${params}`
        );
        for (const hit of data.hits ?? []) {
          if (!seen.has(hit.objectID)) {
            seen.set(hit.objectID, {
              title: hit.title ?? "",
              points: hit.points ?? 0,
              url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
              created_at: hit.created_at ?? "",
            });
          }
        }
      } catch (e) {
        log("fetch", `HN query "${q}" window failed: ${e}`);
      }
      cursor = windowEnd;
    }
  }

  return [...seen.values()].sort((a, b) => b.points - a.points);
}

async function fetchBlogPosts(): Promise<{ title: string; slug: string; date: string; url: string }[]> {
  // Use known posts — scraping anthropic.com is flaky
  return [
    { slug: "claude-3-7-sonnet", title: "Introducing Claude 3.7 Sonnet and Claude Code", date: "2025-02-24", url: "https://www.anthropic.com/news/claude-3-7-sonnet" },
    { slug: "best-practices-agentic-claude-code", title: "Best Practices for Agentic and Claude Code", date: "2025-04-19", url: "https://www.anthropic.com/news/best-practices-agentic-claude-code" },
    { slug: "claude-code-sdk", title: "Introducing the Claude Code SDK", date: "2025-05-19", url: "https://www.anthropic.com/news/claude-code-sdk" },
    { slug: "claude-code-2-0", title: "Claude Code 2.0", date: "2025-09-29", url: "https://www.anthropic.com/news/claude-code-2-0" },
    { slug: "cowork", title: "Introducing Cowork", date: "2026-01-12", url: "https://www.anthropic.com/news/cowork" },
    { slug: "claude-sonnet-4-6", title: "Claude Sonnet 4.6", date: "2026-02-17", url: "https://www.anthropic.com/news/claude-sonnet-4-6" },
    { slug: "claude-code-security", title: "Introducing Claude Code Security", date: "2026-02-20", url: "https://www.anthropic.com/news/claude-code-security" },
  ];
}

// ── Phase 2: Parse ─────────────────────────────────────────────────────────
function parseChangelog(content: string): ParsedVersion[] {
  const versionRe = /^## v?(\d+\.\d+\.\d+[^\s]*)/gm;
  const matches = [...content.matchAll(versionRe)];
  const versions: ParsedVersion[] = [];

  for (let i = 0; i < matches.length; i++) {
    const ver = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const block = content.slice(start, end);

    const dateMatch = block.match(/\((\d{4}-\d{2}-\d{2})\)/) || block.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch?.[1] ?? null;

    const changes: { section: string; raw: string }[] = [];
    let section = "general";
    for (const line of block.split("\n")) {
      const sm = line.match(/^###\s+(.+)/);
      if (sm) { section = sm[1].toLowerCase(); continue; }
      const bm = line.match(/^[-*]\s+(.+)/);
      if (bm) changes.push({ section, raw: bm[1].trim() });
    }

    versions.push({ version: ver, date, changes });
  }

  return versions.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

// ── Phase 3: LLM Enrich ───────────────────────────────────────────────────
const ENRICH_SYSTEM = `You are a technical analyst. Given changelog items for Claude Code (an AI coding CLI tool), classify each item.

Available capability_ids: reasoning_workflows, execution_workspace, memory_context, automation_autonomy, delegation_collaboration, integrations_ecosystem, multimodal_interfaces, governance_security

Respond with a JSON array (same order as input). Each object:
- "category": one of feat|fix|perf|security|breaking|improvement|other
- "importance": integer 1-5 (1=trivial, 5=critical user impact)
- "summary": max 40 chars Chinese, describe user value
- "summary_en": max 60 chars English, describe user value
- "why_matters": 1 sentence Chinese, why this matters
- "why_matters_en": 1 sentence English, why this matters
- "capability_ids": string array from the list above (can be empty)

ONLY output the JSON array.`;

async function enrichBatch(
  items: { raw: string }[],
): Promise<Omit<EnrichedChange, "raw">[]> {
  const numbered = items.map((c, i) => `${i + 1}. ${c.raw}`).join("\n");
  const resp = await llm(ENRICH_SYSTEM, numbered);
  try {
    return extractJson(resp);
  } catch {
    log("enrich", `LLM parse failed, using fallback for ${items.length} items`);
    return items.map((c) => ({
      category: "other",
      importance: 2,
      summary: c.raw.slice(0, 40),
      summary_en: c.raw.slice(0, 60),
      why_matters: "",
      why_matters_en: "",
      capability_ids: [],
    }));
  }
}

async function enrichAllVersions(
  versions: ParsedVersion[],
): Promise<Map<string, EnrichedChange[]>> {
  const result = new Map<string, EnrichedChange[]>();
  const batchSize = 15;
  let processed = 0;
  const total = versions.reduce((s, v) => s + v.changes.length, 0);

  for (const ver of versions) {
    const enriched: EnrichedChange[] = [];
    for (let i = 0; i < ver.changes.length; i += batchSize) {
      const batch = ver.changes.slice(i, i + batchSize);
      const results = await enrichBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        enriched.push({
          raw: batch[j].raw,
          ...(results[j] ?? {
            category: "other",
            importance: 2,
            summary: batch[j].raw.slice(0, 40),
            summary_en: batch[j].raw.slice(0, 60),
            why_matters: "",
            why_matters_en: "",
            capability_ids: [],
          }),
        });
      }
      processed += batch.length;
      log("enrich", `${processed}/${total} (v${ver.version})`);
    }
    result.set(ver.version, enriched);
  }
  return result;
}

// ── Phase 4: Score & Assemble ──────────────────────────────────────────────
function assignEpoch(date: string | null, epochs: EpochSeed[]): string {
  if (!date) return epochs[0].id;
  for (const ep of epochs) {
    if (date >= ep.period_start && date <= ep.period_end) return ep.id;
  }
  return epochs[epochs.length - 1].id;
}

function matchCapabilities(text: string, caps: CapSeed[]): string[] {
  const lower = text.toLowerCase();
  return caps.filter((c) => c.keywords.some((kw) => lower.includes(kw.toLowerCase()))).map((c) => c.id);
}

function matchHnSignals(
  date: string | null,
  allSignals: { title: string; points: number; url: string; created_at: string }[],
): { title: string; points: number; url: string }[] {
  if (!date) return [];
  return allSignals
    .filter((s) => {
      const sDate = s.created_at.slice(0, 10);
      const diff = Math.abs(
        (new Date(date).getTime() - new Date(sDate).getTime()) / 86400000,
      );
      return diff <= 7;
    })
    .map((s) => ({ title: s.title, points: s.points, url: s.url }))
    .slice(0, 5);
}

function matchBlogPost(
  date: string | null,
  blogs: { title: string; slug: string; date: string; url: string }[],
): { title: string; url: string } | undefined {
  if (!date) return undefined;
  const post = blogs.find((b) => {
    const diff = Math.abs(
      (new Date(date).getTime() - new Date(b.date).getTime()) / 86400000,
    );
    return diff <= 3;
  });
  return post ? { title: post.title, url: post.url } : undefined;
}

function calcHighlightScore(
  release: Release,
  blog?: { title: string; url: string },
): number {
  let score = 0;
  const maxImp = Math.max(...release.changes.map((c) => c.importance), 0);
  if (maxImp >= 4) score += 20;

  const maxPts = Math.max(...release.signals.map((s) => s.points), 0);
  if (maxPts >= 500) score += 30;
  else if (maxPts >= 200) score += 15;
  else if (maxPts >= 100) score += 8;

  const parts = release.version.split(".").map(Number);
  if (parts[1] === 0 && parts[2] === 0) score += 25;
  else if (parts[2] === 0) score += 10;

  if (blog) score += 20;

  const breakingCount = release.changes.filter((c) => c.category === "breaking").length;
  score += breakingCount * 5;

  return Math.min(100, score);
}

// ── Phase 5: Highlight Narratives (LLM) ───────────────────────────────────
const HIGHLIGHT_SYSTEM = `You write concise, editorial-quality bilingual text for a Claude Code product history site.
The tone is like an Apple keynote recap — confident, forward-looking, third-person (never "我们" / never "we").

Given a release version, date, and its top changes, write 6 fields:
- "highlight_title": max 20 chars Chinese, narrative title that conveys product significance (NOT technical details like "ARN格式变更". Good: "从助手到执行者", "编程代理的平台化起点". Bad: "v1.0.0 发布", "JSON输出革命", "XX新纪元" — avoid cliché patterns, each title must be unique and specific)
- "highlight_title_en": max 40 chars English, same meaning as highlight_title (Good: "From Assistant to Executor", "The Platform Pivot". Bad: "v1.0.0 Release", generic phrases)
- "highlight_summary": 2-3 sentences Chinese. Focus on what this means for users/the product direction, not implementation details. Keynote rhythm — short punchy sentences, building momentum.
- "highlight_summary_en": 2-3 sentences English, same meaning as highlight_summary.
- "highlight_why": 1 sentence Chinese, the core insight (why this release is a turning point, not what it changed)
- "highlight_why_en": 1 sentence English, same meaning as highlight_why.

Respond with a JSON object with these 6 fields. ONLY output JSON.`;

async function writeHighlightNarrative(
  version: string,
  date: string,
  topChanges: EnrichedChange[],
  signals: { title: string; points: number }[],
): Promise<{ highlight_title: string; highlight_title_en: string; highlight_summary: string; highlight_summary_en: string; highlight_why: string; highlight_why_en: string }> {
  const changesText = topChanges
    .map((c) => `- [${c.category}, importance ${c.importance}] ${c.raw}`)
    .join("\n");
  const signalText = signals.length
    ? `\nHN signals: ${signals.map((s) => `${s.title} (${s.points}pts)`).join(", ")}`
    : "";

  const prompt = `Version: v${version}\nDate: ${date}\n\nTop changes:\n${changesText}${signalText}`;

  const resp = await llm(HIGHLIGHT_SYSTEM, prompt);
  try {
    const match = resp.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON object");
    return JSON.parse(match[0]);
  } catch {
    return {
      highlight_title: `v${version} 重要更新`,
      highlight_title_en: `v${version} Major Update`,
      highlight_summary: topChanges[0]?.summary ?? "",
      highlight_summary_en: topChanges[0]?.summary_en ?? "",
      highlight_why: topChanges[0]?.why_matters ?? "",
      highlight_why_en: topChanges[0]?.why_matters_en ?? "",
    };
  }
}

// ── Phase 6: Capability Stats ──────────────────────────────────────────────
interface CapabilityStats {
  id: string;
  name: string;
  name_en: string;
  summary: string;
  summary_en: string;
  keywords: string[];
  change_count: number;
  release_count: number;
  avg_importance: number;
  maturity: { score: number; level: string };
  first_seen: { date: string; version: string } | null;
  latest_seen: { date: string; version: string } | null;
  epochs: { epoch_id: string; name: string; change_count: number }[];
  samples: { date: string; version: string; raw: string; summary: string; importance: number; category: string }[];
}

function buildCapabilityStats(
  caps: CapSeed[],
  releases: Release[],
  epochs: EpochSeed[],
): CapabilityStats[] {
  const epochMap = new Map(epochs.map((e) => [e.id, e]));

  return caps.map((cap) => {
    const matches: { release: Release; change: EnrichedChange }[] = [];
    for (const rel of releases) {
      for (const ch of rel.changes) {
        if (ch.capability_ids.includes(cap.id)) {
          matches.push({ release: rel, change: ch });
        }
      }
    }

    const uniqueVersions = new Set(matches.map((m) => m.release.version));
    const uniqueEpochs = new Map<string, number>();
    for (const m of matches) {
      uniqueEpochs.set(m.release.epoch_id, (uniqueEpochs.get(m.release.epoch_id) ?? 0) + 1);
    }

    const avgImp = matches.length
      ? matches.reduce((s, m) => s + m.change.importance, 0) / matches.length
      : 0;

    const maturityScore = Math.min(
      100,
      Math.round(
        Math.min(30, matches.length * 0.7) +
        Math.min(28, uniqueVersions.size * 1.8) +
        Math.min(22, uniqueEpochs.size * 5) +
        Math.min(20, avgImp * 4),
      ),
    );
    const level = maturityScore >= 80 ? "成熟" : maturityScore >= 60 ? "成型" : maturityScore >= 40 ? "增长中" : "早期";

    const dated = matches.filter((m) => m.release.date).sort((a, b) => a.release.date!.localeCompare(b.release.date!));
    const first = dated[0];
    const latest = dated[dated.length - 1];

    const samples = [...matches]
      .sort((a, b) => b.change.importance - a.change.importance)
      .slice(0, 4)
      .map((m) => ({
        date: m.release.date ?? "",
        version: m.release.version,
        raw: m.change.raw,
        summary: m.change.summary,
        importance: m.change.importance,
        category: m.change.category,
      }));

    return {
      id: cap.id,
      name: cap.name,
      name_en: cap.name_en,
      summary: cap.summary,
      summary_en: cap.summary_en ?? "",
      keywords: cap.keywords,
      change_count: matches.length,
      release_count: uniqueVersions.size,
      avg_importance: Math.round(avgImp * 100) / 100,
      maturity: { score: maturityScore, level },
      first_seen: first ? { date: first.release.date!, version: first.release.version } : null,
      latest_seen: latest ? { date: latest.release.date!, version: latest.release.version } : null,
      epochs: [...uniqueEpochs.entries()].map(([eid, count]) => ({
        epoch_id: eid,
        name: epochMap.get(eid)?.name ?? eid,
        change_count: count,
      })),
      samples,
    };
  });
}

// ── Incremental helpers ─────────────────────────────────────────────────────
function tryLoadExistingBundle(): any | null {
  try {
    return JSON.parse(readFileSync(OUTPUT, "utf8"));
  } catch {
    return null;
  }
}

function assembleRelease(
  ver: ParsedVersion,
  changes: EnrichedChange[],
  caps: CapSeed[],
  epochs: EpochSeed[],
  hnSignals: { title: string; points: number; url: string; created_at: string }[],
  blogPosts: { title: string; slug: string; date: string; url: string }[],
): Release {
  for (const ch of changes) {
    if (!Array.isArray(ch.capability_ids)) ch.capability_ids = [];
    if (!ch.summary_en) ch.summary_en = ch.raw.slice(0, 60);
    if (!ch.why_matters_en) ch.why_matters_en = "";
    const kwMatches = matchCapabilities(ch.raw, caps);
    for (const id of kwMatches) {
      if (!ch.capability_ids.includes(id)) ch.capability_ids.push(id);
    }
  }
  const epochId = assignEpoch(ver.date, epochs);
  const signals = matchHnSignals(ver.date, hnSignals);
  const blog = matchBlogPost(ver.date, blogPosts);
  const rel: Release = {
    version: ver.version,
    date: ver.date,
    epoch_id: epochId,
    source: "changelog",
    changes,
    signals,
    highlight_score: 0,
  };
  rel.highlight_score = calcHighlightScore(rel, blog);
  return rel;
}

function assembleBundle(
  releases: Release[],
  highlights: Highlight[],
  caps: CapSeed[],
  epochs: EpochSeed[],
  hnSignals: { title: string; points: number; url: string; created_at: string }[],
  blogPosts: { title: string; slug: string; date: string; url: string }[],
) {
  const capStats = buildCapabilityStats(caps, releases, epochs);
  const hnTop = hnSignals.filter((s) => s.points >= 100).slice(0, 18).map((s) => ({
    title: s.title,
    points: s.points,
    url: s.url,
    date: s.created_at.slice(0, 10),
  }));
  const epochStats = epochs.map((ep) => {
    const epReleases = releases.filter((r) => r.epoch_id === ep.id);
    return {
      ...ep,
      release_count: epReleases.length,
      highlight_count: highlights.filter((h) => h.epoch_id === ep.id).length,
    };
  });
  const latestDate = releases.filter((r) => r.date).map((r) => r.date!).sort().pop();
  if (latestDate) {
    const lastEpoch = epochStats[epochStats.length - 1];
    if (latestDate > lastEpoch.period_end && lastEpoch.period_end !== "2099-12-31") {
      lastEpoch.period_end = "2099-12-31";
    }
  }
  const releaseDates = releases.filter((r) => r.date).map((r) => r.date!).sort();
  return {
    meta: {
      generated_at: new Date().toISOString(),
      agent_model: LLM_MODEL,
      total_versions: releases.length,
      date_range: {
        start: releaseDates[0] ?? "2025-02-24",
        end: releaseDates[releaseDates.length - 1] ?? "2026-03-22",
      },
      highlight_count: highlights.length,
      capability_count: capStats.length,
      hn_signal_count: hnTop.length,
      blog_post_count: blogPosts.length,
    },
    epochs: epochStats,
    releases,
    highlights,
    capabilities: capStats,
    social_proof: { hn_top: hnTop, blog_posts: blogPosts },
  };
}

const HIGHLIGHT_THRESHOLD = 55;

async function generateHighlights(
  releases: Release[],
  existingHighlights: Highlight[],
  blogPosts: { title: string; slug: string; date: string; url: string }[],
  onlyNewVersions?: Set<string>,
): Promise<Highlight[]> {
  const existingVersions = new Set(existingHighlights.map((h) => h.version));
  const candidates = releases.filter((r) => r.highlight_score >= HIGHLIGHT_THRESHOLD && r.date);
  const highlights: Highlight[] = [];

  for (const rel of candidates) {
    // Reuse existing highlight if not a new version
    if (existingVersions.has(rel.version) && (!onlyNewVersions || !onlyNewVersions.has(rel.version))) {
      const existing = existingHighlights.find((h) => h.version === rel.version)!;
      highlights.push(existing);
      continue;
    }

    const topChanges = [...rel.changes].sort((a, b) => b.importance - a.importance).slice(0, 5);
    const blog = matchBlogPost(rel.date, blogPosts);
    const narrative = await writeHighlightNarrative(rel.version, rel.date!, topChanges, rel.signals);
    log("highlight", `v${rel.version} (score=${rel.highlight_score}): ${narrative.highlight_title}`);

    highlights.push({
      version: rel.version,
      date: rel.date!,
      epoch_id: rel.epoch_id,
      highlight_score: rel.highlight_score,
      ...narrative,
      capability_ids: [...new Set(rel.changes.flatMap((c) => c.capability_ids))],
      evidence: {
        hn_signals: rel.signals,
        blog_post: blog,
        top_changes: topChanges.slice(0, 3).map((c) => ({
          raw: c.raw,
          summary: c.summary,
          importance: c.importance,
        })),
      },
    });
  }

  highlights.sort((a, b) => a.date.localeCompare(b.date));
  return highlights;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  const caps = loadJson<CapSeed[]>(CAPS_SEED);
  const epochs = loadJson<EpochSeed[]>(EPOCHS_SEED);

  // Phase 1: Fetch
  const [changelogRaw, npmTimes, hnSignals, blogPosts] = await Promise.all([
    fetchChangelog(),
    fetchNpmTimes(),
    fetchHnSignals(),
    fetchBlogPosts(),
  ]);

  // Phase 2: Parse
  let versions = parseChangelog(changelogRaw);
  log("parse", `Parsed ${versions.length} versions from CHANGELOG`);

  for (const ver of versions) {
    if (!ver.date && npmTimes[ver.version]) {
      ver.date = npmTimes[ver.version];
    }
  }

  if (SAMPLE > 0) {
    versions = versions.slice(-SAMPLE);
    log("sample", `Using last ${versions.length} versions only`);
  }

  // ── Incremental mode ──────────────────────────────────────────────────
  if (INCREMENTAL) {
    const existing = tryLoadExistingBundle();
    if (!existing) {
      log("incremental", "No existing bundle found, falling back to full run");
    } else {
      const existingVersions = new Set<string>(existing.releases.map((r: any) => r.version));
      const newVersions = versions.filter((v) => !existingVersions.has(v.version));

      if (newVersions.length === 0) {
        log("incremental", "No new versions found. Updating HN signals and social proof only.");
        // Still refresh HN signals + social proof (free API), then rewrite bundle
        const releases: Release[] = existing.releases.map((rel: any) => {
          const signals = matchHnSignals(rel.date, hnSignals);
          const blog = matchBlogPost(rel.date, blogPosts);
          return { ...rel, signals, highlight_score: calcHighlightScore({ ...rel, signals }, blog) };
        });
        const highlights = await generateHighlights(releases, existing.highlights, blogPosts);
        const bundle = assembleBundle(releases, highlights, caps, epochs, hnSignals, blogPosts);
        mkdirSync(DATA, { recursive: true });
        writeFileSync(OUTPUT, JSON.stringify(bundle, null, 2), "utf8");
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log("done", `No new versions. Refreshed signals. ${elapsed}s`);
        return;
      }

      log("incremental", `Found ${newVersions.length} new version(s): ${newVersions.map((v) => v.version).join(", ")}`);

      // Only enrich new versions via LLM
      const newEnriched = await enrichAllVersions(newVersions);
      const newVersionSet = new Set(newVersions.map((v) => v.version));

      // Build releases: reuse existing enriched changes, add new ones
      const existingReleaseMap = new Map<string, any>(existing.releases.map((r: any) => [r.version, r]));
      const releases: Release[] = versions.map((ver) => {
        if (existingReleaseMap.has(ver.version) && !newVersionSet.has(ver.version)) {
          // Reuse existing release, but refresh signals
          const rel = existingReleaseMap.get(ver.version)!;
          const signals = matchHnSignals(ver.date, hnSignals);
          const blog = matchBlogPost(ver.date, blogPosts);
          return { ...rel, signals, highlight_score: calcHighlightScore({ ...rel, signals }, blog) };
        }
        const changes = newEnriched.get(ver.version) ?? [];
        return assembleRelease(ver, changes, caps, epochs, hnSignals, blogPosts);
      });

      const highlights = await generateHighlights(releases, existing.highlights, blogPosts, newVersionSet);
      const bundle = assembleBundle(releases, highlights, caps, epochs, hnSignals, blogPosts);
      mkdirSync(DATA, { recursive: true });
      writeFileSync(OUTPUT, JSON.stringify(bundle, null, 2), "utf8");

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log("done", `Incremental: ${newVersions.length} new, ${releases.length} total, ${highlights.length} highlights. ${elapsed}s`);
      return;
    }
  }

  // ── Full mode ─────────────────────────────────────────────────────────
  const enriched = await enrichAllVersions(versions);

  const releases: Release[] = versions.map((ver) => {
    const changes = enriched.get(ver.version) ?? [];
    return assembleRelease(ver, changes, caps, epochs, hnSignals, blogPosts);
  });

  log("assemble", `${releases.length} releases, ${releases.filter((r) => r.highlight_score >= 40).length} highlight candidates`);

  const highlights = await generateHighlights(releases, [], blogPosts);

  const bundle = assembleBundle(releases, highlights, caps, epochs, hnSignals, blogPosts);

  mkdirSync(DATA, { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(bundle, null, 2), "utf8");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log("done", `Wrote ${OUTPUT}`);
  log("done", `${releases.length} releases, ${highlights.length} highlights, ${bundle.capabilities.length} capabilities`);
  log("done", `Elapsed: ${elapsed}s`);

  console.log("\n── Highlight Releases ──");
  for (const h of highlights) {
    console.log(`  ${h.date} v${h.version} (score=${h.highlight_score})`);
    console.log(`    ${h.highlight_title}`);
    console.log(`    ${h.highlight_summary}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
