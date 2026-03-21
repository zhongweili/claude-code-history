import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import {
  CATEGORY_VALUES,
  ExploreDataSchema,
  HOT_SIGNAL_THRESHOLD,
  SOURCE_VALUES,
  SourceBundleSchema,
  StoryHomeDataSchema,
  compareVersionsDesc,
  deriveCapabilityIds,
  formatDisplayDate,
  type ExploreData,
  type SourceBundle,
} from "../src/lib/data/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(SITE_ROOT, "..");
const INPUT_PATH = resolve(REPO_ROOT, "web", "data.json");
const OUTPUT_DIR = resolve(SITE_ROOT, "src", "generated");
const STORY_OUTPUT_PATH = resolve(OUTPUT_DIR, "story-home.json");
const EXPLORE_OUTPUT_PATH = resolve(OUTPUT_DIR, "explore-data.json");
const PAGE_SIZE = 24;

function loadBundle() {
  let raw: string;

  try {
    raw = readFileSync(INPUT_PATH, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Missing ${INPUT_PATH}. Run the existing Python data pipeline first so web/data.json exists. ${message}`
    );
  }

  try {
    return SourceBundleSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      throw new Error(
        `Invalid web/data.json shape at ${issue.path.join(".") || "root"}: ${issue.message}. Rebuild the upstream Python data bundle before running prepare:data.`
      );
    }
    throw error;
  }
}

function pickLeadChange(
  changes: SourceBundle["releases"][number]["changes"]
) {
  return [...changes].sort((left, right) => {
    if (left.importance !== right.importance) {
      return right.importance - left.importance;
    }
    const categoryRank = CATEGORY_VALUES.indexOf(left.category) - CATEGORY_VALUES.indexOf(right.category);
    return categoryRank;
  })[0];
}

function buildStoryHome(bundle: SourceBundle) {
  const milestonesByEpoch = new Map<string, number>();
  const capabilitiesByEpoch = new Map<string, Set<string>>();

  for (const milestone of bundle.story.milestones) {
    milestonesByEpoch.set(
      milestone.epoch_id,
      (milestonesByEpoch.get(milestone.epoch_id) ?? 0) + 1
    );
  }

  for (const capability of bundle.story.capabilities) {
    for (const epoch of capability.epochs) {
      if (!capabilitiesByEpoch.has(epoch.epoch_id)) {
        capabilitiesByEpoch.set(epoch.epoch_id, new Set());
      }
      capabilitiesByEpoch.get(epoch.epoch_id)?.add(capability.id);
    }
  }

  return StoryHomeDataSchema.parse({
    meta: bundle.meta,
    epochs: bundle.epochs.map((epoch) => ({
      ...epoch,
      milestone_count: milestonesByEpoch.get(epoch.id) ?? 0,
      capability_count: capabilitiesByEpoch.get(epoch.id)?.size ?? 0,
    })),
    hero: bundle.story.hero,
    milestones: bundle.story.milestones,
    capabilities: bundle.story.capabilities,
    personas: bundle.story.personas,
    ecosystem: bundle.story.ecosystem,
    social_proof: bundle.story.social_proof,
    assets: {
      coverage: {
        missing_count: bundle.story.assets.coverage.missing,
        total_count: bundle.story.assets.coverage.total,
      },
      items: bundle.story.assets.items,
    },
  });
}

function buildExploreData(bundle: SourceBundle) {
  const epochLookup = new Map(bundle.epochs.map((epoch) => [epoch.id, epoch]));
  const capabilityLookup = new Map(
    bundle.story.capabilities.map((capability) => [
      capability.id,
      { id: capability.id, name: capability.name },
    ])
  );

  const releases = bundle.releases
    .map((release) => {
      const epoch = epochLookup.get(release.epoch_id);
      const sortDate = release.date ?? epoch?.period_start ?? bundle.meta.date_range.start;
      const dateInferred = release.date == null;
      const lead = pickLeadChange(release.changes);
      const texts = [
        release.version,
        ...release.changes.flatMap((change) => [
          change.raw,
          change.summary,
          change.why_matters,
        ]),
        ...release.signals.map((signal) => signal.title),
      ];
      const capabilityIds = deriveCapabilityIds(texts, bundle.story.capabilities);
      const signalMaxPoints = release.signals.reduce(
        (current, signal) => Math.max(current, signal.points ?? 0),
        0
      );
      const categories = [...new Set(release.changes.map((change) => change.category))];
      const highlights = release.changes
        .slice()
        .sort((left, right) => right.importance - left.importance)
        .map((change) => change.summary || change.raw)
        .filter(Boolean)
        .slice(0, 3);

      return {
        version: release.version,
        date: release.date,
        display_date: formatDisplayDate(sortDate, dateInferred),
        sort_date: sortDate,
        date_inferred: dateInferred,
        source: release.source,
        epoch_id: release.epoch_id,
        epoch_name: epoch?.name ?? release.epoch_id,
        milestone_score: release.milestone_score,
        capability_ids: capabilityIds,
        capabilities: capabilityIds
          .map((id) => capabilityLookup.get(id))
          .filter((value): value is { id: string; name: string } => Boolean(value)),
        categories,
        max_importance: Math.max(
          ...release.changes.map((change) => change.importance),
          1
        ),
        change_count: release.changes.length,
        signal_count: release.signals.length,
        signal_max_points: signalMaxPoints,
        hot_signal: signalMaxPoints >= HOT_SIGNAL_THRESHOLD,
        headline: lead?.summary || lead?.raw || `v${release.version}`,
        highlights,
        search_text: texts.join(" ").toLowerCase(),
        changes: release.changes,
        signals: release.signals,
      };
    })
    .sort((left, right) => {
      if (left.sort_date !== right.sort_date) {
        return right.sort_date.localeCompare(left.sort_date);
      }
      return compareVersionsDesc(left.version, right.version);
    });

  return ExploreDataSchema.parse({
    meta: {
      generated_at: bundle.meta.generated_at,
      total_versions: bundle.meta.total_versions,
      date_range: bundle.meta.date_range,
      page_size: PAGE_SIZE,
      hot_signal_threshold: HOT_SIGNAL_THRESHOLD,
    },
    filters: {
      epochs: bundle.epochs.map((epoch) => ({
        id: epoch.id,
        name: epoch.name,
      })),
      capabilities: bundle.story.capabilities.map((capability) => ({
        id: capability.id,
        name: capability.name,
      })),
      categories: [...CATEGORY_VALUES],
      sources: [...SOURCE_VALUES],
      importance_values: ["1", "2", "3", "4", "5"],
      signal_modes: ["all", "with-signal", "hot-only"],
    },
    releases,
  }) satisfies ExploreData;
}

function writeJson(outputPath: string, payload: unknown) {
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const bundle = loadBundle();
  const storyHome = buildStoryHome(bundle);
  const exploreData = buildExploreData(bundle);

  writeJson(STORY_OUTPUT_PATH, storyHome);
  writeJson(EXPLORE_OUTPUT_PATH, exploreData);

  console.log(
    `Prepared story + explore data from web/data.json (${storyHome.milestones.length} milestones, ${exploreData.releases.length} releases).`
  );
}

main();
