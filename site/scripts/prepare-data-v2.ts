/**
 * Convert auto_bundle.json → story-home.json + explore-data.json
 * Replaces the old prepare-data.ts for the V2 auto pipeline.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(SITE_ROOT, "..");
const INPUT = resolve(REPO_ROOT, "data", "auto_bundle.json");
const OUTPUT_DIR = resolve(SITE_ROOT, "src", "generated");

const CATEGORY_VALUES = ["feat", "fix", "perf", "security", "breaking", "improvement", "other"] as const;
const HOT_SIGNAL_THRESHOLD = 500;

function loadBundle() {
  return JSON.parse(readFileSync(INPUT, "utf8"));
}

function formatDate(date: string, inferred = false) {
  try {
    const d = new Date(`${date}T00:00:00Z`);
    const f = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" });
    const v = f.format(d);
    return inferred ? `${v} · 推断` : v;
  } catch {
    return date;
  }
}

function formatDateEn(date: string, inferred = false) {
  try {
    const d = new Date(`${date}T00:00:00Z`);
    const f = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
    const v = f.format(d);
    return inferred ? `${v} (est.)` : v;
  } catch {
    return date;
  }
}

function compareVersionsDesc(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  }
  return 0;
}

function buildStoryHome(bundle: any) {
  const epochs = bundle.epochs.map((ep: any) => ({
    ...ep,
    key_events: [],
    releases: bundle.releases.filter((r: any) => r.epoch_id === ep.id).map((r: any) => r.version),
    blog_posts: bundle.social_proof.blog_posts
      .filter((b: any) => b.date >= ep.period_start && b.date <= ep.period_end)
      .map((b: any) => ({ title: b.title, date: b.date, summary: "", slug: b.slug })),
    milestone_count: bundle.highlights.filter((h: any) => h.epoch_id === ep.id).length,
    capability_count: new Set(
      bundle.capabilities.flatMap((c: any) =>
        c.epochs.filter((e: any) => e.epoch_id === ep.id).length > 0 ? [c.id] : []
      )
    ).size,
  }));

  // Deduplicate evidence: each HN/blog URL should appear in at most one milestone
  const usedEvidenceUrls = new Set<string>();

  // Map highlights → milestone-like objects for MilestoneChapters
  const milestones = bundle.highlights.map((h: any) => {
    // Build deduplicated evidence
    const evidence: any[] = [];
    for (const s of h.evidence.hn_signals) {
      if (!usedEvidenceUrls.has(s.url)) {
        usedEvidenceUrls.add(s.url);
        evidence.push({ type: "community", title: s.title, url: s.url, points: s.points, comments: 0 });
      }
    }
    if (h.evidence.blog_post && !usedEvidenceUrls.has(h.evidence.blog_post.url)) {
      usedEvidenceUrls.add(h.evidence.blog_post.url);
      evidence.push({ type: "blog", title: h.evidence.blog_post.title, url: h.evidence.blog_post.url });
    }
    // Link to CHANGELOG anchor (release tags before v2.1.0 are 404 on GitHub)
    const changelogAnchor = h.version.replace(/\./g, "");
    const releaseUrl = `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#${changelogAnchor}`;
    if (!usedEvidenceUrls.has(releaseUrl)) {
      usedEvidenceUrls.add(releaseUrl);
      const topChange = h.evidence.top_changes[0];
      if (topChange) {
        evidence.push({
          type: "release",
          title: topChange.summary || topChange.raw,
          title_en: topChange.summary_en || topChange.raw,
          url: releaseUrl,
        });
      }
    }

    return {
      id: `highlight_${h.version.replace(/\./g, "_")}`,
      date: h.date,
      title: h.highlight_title,
      title_en: h.highlight_title_en || `v${h.version}`,
      summary: h.highlight_summary,
      summary_en: h.highlight_summary_en || "",
      why_it_matters: h.highlight_why,
      why_it_matters_en: h.highlight_why_en || "",
      phase: "",
      audiences: [],
      related_versions: [h.version],
      blog_slugs: h.evidence.blog_post ? [h.evidence.blog_post.url.split("/").pop()] : [],
      hn_object_ids: [],
      capability_ids: h.capability_ids,
      persona_ids: [],
      asset_ids: [],
      epoch_id: h.epoch_id,
      epoch_name: bundle.epochs.find((e: any) => e.id === h.epoch_id)?.name ?? h.epoch_id,
      capabilities: h.capability_ids.map((cid: string) => {
        const cap = bundle.capabilities.find((c: any) => c.id === cid);
        return cap ? { id: cap.id, name: cap.name, name_en: cap.name_en || cap.name } : { id: cid, name: cid, name_en: cid };
      }),
      personas: [],
      evidence,
      evidence_summary: {
        official_sources: evidence.filter((e: any) => e.type === "blog").length,
        community_sources: evidence.filter((e: any) => e.type === "community").length,
        release_sources: evidence.filter((e: any) => e.type === "release").length,
      },
    };
  });

  const hero = {
    headline: "Claude Code 如何从命令行助手，长成知识工作的代理平台",
    subheadline: "这不是一串版本号，而是一条从研究预览、平台化到无人值守协作的能力演进线。",
    highlights: [
      { label: "HIGHLIGHTS", value: bundle.highlights.length },
      { label: "CAPABILITIES", value: bundle.capabilities.length },
      { label: "RELEASES", value: bundle.meta.total_versions },
      { label: "HN SIGNALS", value: bundle.social_proof.hn_top.length },
    ],
  };

  // Social proof
  const socialProof = {
    official_posts: bundle.social_proof.blog_posts.map((p: any) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      summary: "",
      url: p.url,
      related_milestone_ids: [],
    })),
    featured_hn: bundle.social_proof.hn_top.slice(0, 18).map((s: any) => ({
      objectID: "",
      title: s.title,
      date: s.date,
      url: s.url,
      external_url: s.url,
      points: s.points,
      comments: 0,
      domain: (() => { try { return new URL(s.url).hostname.replace("www.", ""); } catch { return ""; } })(),
      theme: "general",
      tone: "community",
      related_capability_ids: [],
      related_milestone_ids: [],
    })),
    themes: [],
    tones: [],
  };

  return {
    meta: {
      generated_at: bundle.meta.generated_at,
      total_versions: bundle.meta.total_versions,
      date_range: bundle.meta.date_range,
      hn_signals_count: bundle.social_proof.hn_top.length,
      blog_posts_count: bundle.social_proof.blog_posts.length,
      story: {
        milestone_count: milestones.length,
        capability_count: bundle.capabilities.length,
        persona_count: 0,
        asset_missing_count: 0,
      },
    },
    epochs,
    hero,
    milestones,
    capabilities: bundle.capabilities,
    personas: [],
    ecosystem: { tracks: [] },
    social_proof: socialProof,
    assets: { coverage: { missing_count: 0, total_count: 0 }, items: [] },
  };
}

function buildExploreData(bundle: any) {
  const epochLookup = new Map(bundle.epochs.map((e: any) => [e.id, e]));
  const capLookup = new Map(
    bundle.capabilities.map((c: any) => [c.id, { id: c.id, name: c.name, name_en: c.name_en || c.name }])
  );

  const releases = bundle.releases
    .map((rel: any) => {
      const epoch = epochLookup.get(rel.epoch_id);
      const sortDate = rel.date ?? epoch?.period_start ?? bundle.meta.date_range.start;
      const dateInferred = rel.date == null;
      const changes = (rel.changes ?? []).map((c: any) => ({
        ...c,
        section: c.section ?? "general",
        summary: c.summary ?? "",
        summary_en: c.summary_en ?? "",
        why_matters: c.why_matters ?? "",
        why_matters_en: c.why_matters_en ?? "",
        enriched: true,
      }));
      const capIds = [...new Set(changes.flatMap((c: any) => c.capability_ids ?? []))] as string[];
      const categories = [...new Set(changes.map((c: any) => c.category))] as string[];
      const maxImp = Math.max(...changes.map((c: any) => c.importance ?? 1), 1);
      const signalMaxPts = Math.max(...(rel.signals ?? []).map((s: any) => s.points ?? 0), 0);
      const lead = [...changes].sort((a: any, b: any) => (b.importance ?? 1) - (a.importance ?? 1))[0];
      const highlights = changes
        .slice().sort((a: any, b: any) => (b.importance ?? 1) - (a.importance ?? 1))
        .map((c: any) => c.summary || c.raw).filter(Boolean).slice(0, 3);
      const searchText = [
        rel.version,
        ...changes.flatMap((c: any) => [c.raw, c.summary, c.summary_en, c.why_matters, c.why_matters_en]),
        ...(rel.signals ?? []).map((s: any) => s.title),
      ].join(" ").toLowerCase();

      return {
        version: rel.version,
        date: rel.date,
        display_date: formatDate(sortDate, dateInferred),
        display_date_en: formatDateEn(sortDate, dateInferred),
        sort_date: sortDate,
        date_inferred: dateInferred,
        source: rel.source ?? "changelog",
        epoch_id: rel.epoch_id,
        epoch_name: epoch?.name ?? rel.epoch_id,
        epoch_name_en: epoch?.name_en ?? epoch?.name ?? rel.epoch_id,
        milestone_score: rel.highlight_score ?? 0,
        capability_ids: capIds,
        capabilities: capIds.map((id: string) => capLookup.get(id)).filter(Boolean),
        categories,
        max_importance: maxImp,
        change_count: changes.length,
        signal_count: (rel.signals ?? []).length,
        signal_max_points: signalMaxPts,
        hot_signal: signalMaxPts >= HOT_SIGNAL_THRESHOLD,
        headline: lead?.summary || lead?.raw || `v${rel.version}`,
        headline_en: lead?.summary_en || lead?.raw || `v${rel.version}`,
        highlights,
        search_text: searchText,
        changes,
        signals: (rel.signals ?? []).map((s: any) => ({
          title: s.title,
          points: s.points ?? 0,
          url: s.url ?? "",
          objectID: "",
        })),
      };
    })
    .sort((a: any, b: any) => {
      if (a.sort_date !== b.sort_date) return b.sort_date.localeCompare(a.sort_date);
      return compareVersionsDesc(a.version, b.version);
    });

  return {
    meta: {
      generated_at: bundle.meta.generated_at,
      total_versions: bundle.meta.total_versions,
      date_range: bundle.meta.date_range,
      page_size: 24,
      hot_signal_threshold: HOT_SIGNAL_THRESHOLD,
    },
    filters: {
      epochs: bundle.epochs.map((e: any) => ({ id: e.id, name: e.name, name_en: e.name_en || e.name })),
      capabilities: bundle.capabilities.map((c: any) => ({ id: c.id, name: c.name, name_en: c.name_en || c.name })),
      categories: [...CATEGORY_VALUES],
      sources: ["changelog", "github", "npm"],
      importance_values: ["1", "2", "3", "4", "5"],
      signal_modes: ["all", "with-signal", "hot-only"],
    },
    releases,
  };
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const bundle = loadBundle();
  const storyHome = buildStoryHome(bundle);
  const exploreData = buildExploreData(bundle);

  writeFileSync(resolve(OUTPUT_DIR, "story-home.json"), JSON.stringify(storyHome, null, 2) + "\n", "utf8");
  writeFileSync(resolve(OUTPUT_DIR, "explore-data.json"), JSON.stringify(exploreData, null, 2) + "\n", "utf8");

  console.log(
    `V2 prepared: ${storyHome.milestones.length} highlights, ${exploreData.releases.length} releases, ${storyHome.capabilities.length} capabilities`
  );
}

main();
