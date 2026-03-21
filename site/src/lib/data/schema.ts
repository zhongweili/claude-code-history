import { z } from "zod";

export const CATEGORY_VALUES = [
  "feat",
  "fix",
  "perf",
  "security",
  "breaking",
  "improvement",
  "other",
] as const;

export const SOURCE_VALUES = ["changelog", "github", "npm"] as const;
export const SIGNAL_VALUES = ["all", "with-signal", "hot-only"] as const;
export const EPOCH_VALUES = [
  "epoch1",
  "epoch2",
  "epoch3",
  "epoch4",
  "epoch5",
] as const;
export const IMPORTANCE_VALUES = ["1", "2", "3", "4", "5"] as const;
export const HOT_SIGNAL_THRESHOLD = 500;

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ReleaseChangeSchema = z
  .object({
    section: z.string().optional().default("general"),
    raw: z.string(),
    category: z.enum(CATEGORY_VALUES),
    importance: z.number().int().min(1).max(5),
    summary: z.string().optional().default(""),
    why_matters: z.string().optional().default(""),
    enriched: z.boolean().optional().default(false),
  })
  .passthrough();

export const ReleaseSignalSchema = z
  .object({
    title: z.string(),
    points: z.number().int().nonnegative().optional().default(0),
    url: z.string().url().optional().default(""),
    objectID: z.string().optional().default(""),
  })
  .passthrough();

export const EpochSchema = z
  .object({
    id: z.enum(EPOCH_VALUES),
    name: z.string(),
    name_en: z.string(),
    period_start: DateStringSchema,
    period_end: DateStringSchema,
    score: z.number().int(),
    color: z.string(),
    summary: z.string(),
    summary_en: z.string().optional().default(""),
    key_events: z.array(z.string()).default([]),
    releases: z.array(z.string()).default([]),
    blog_posts: z
      .array(
        z.object({
          title: z.string(),
          date: DateStringSchema,
          summary: z.string().default(""),
          slug: z.string(),
        })
      )
      .default([]),
  })
  .passthrough();

export const StoryCapabilitySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    name_en: z.string().optional().default(""),
    summary: z.string(),
    description: z.string().optional().default(""),
    keywords: z.array(z.string()).default([]),
    audiences: z.array(z.string()).default([]),
    milestone_ids: z.array(z.string()).default([]),
    persona_ids: z.array(z.string()).default([]),
    change_count: z.number().int().nonnegative().default(0),
    release_count: z.number().int().nonnegative().default(0),
    avg_importance: z.number().default(0),
    maturity: z.object({
      score: z.number().int().min(0).max(100),
      level: z.string(),
    }),
    first_seen: z
      .object({
        date: DateStringSchema.nullable(),
        version: z.string().nullable(),
      })
      .optional(),
    latest_seen: z
      .object({
        date: DateStringSchema.nullable(),
        version: z.string().nullable(),
      })
      .optional(),
    epochs: z
      .array(
        z.object({
          epoch_id: z.enum(EPOCH_VALUES),
          name: z.string(),
          change_count: z.number().int().nonnegative(),
          release_count: z.number().int().nonnegative(),
          avg_importance: z.number(),
        })
      )
      .default([]),
    samples: z
      .array(
        z.object({
          date: DateStringSchema,
          version: z.string(),
          raw: z.string(),
          summary: z.string(),
          importance: z.number().int().min(1).max(5),
          category: z.enum(CATEGORY_VALUES),
        })
      )
      .default([]),
    coverage: z
      .object({
        earliest_epoch: z.string().default(""),
        latest_epoch: z.string().default(""),
        epoch_count: z.number().int().nonnegative().default(0),
      })
      .default({
        earliest_epoch: "",
        latest_epoch: "",
        epoch_count: 0,
      }),
  })
  .passthrough();

export const StoryMilestoneSchema = z
  .object({
    id: z.string(),
    date: DateStringSchema,
    title: z.string(),
    title_en: z.string().optional().default(""),
    summary: z.string(),
    why_it_matters: z.string(),
    phase: z.string().optional().default(""),
    audiences: z.array(z.string()).default([]),
    related_versions: z.array(z.string()).default([]),
    blog_slugs: z.array(z.string()).default([]),
    hn_object_ids: z.array(z.string()).default([]),
    capability_ids: z.array(z.string()).default([]),
    persona_ids: z.array(z.string()).default([]),
    asset_ids: z.array(z.string()).default([]),
    epoch_id: z.enum(EPOCH_VALUES),
    epoch_name: z.string(),
    capabilities: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      )
      .default([]),
    personas: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      )
      .default([]),
    evidence: z
      .array(
        z
          .object({
            type: z.string(),
            title: z.string(),
            date: DateStringSchema.optional(),
            url: z.string().url().optional(),
            summary: z.string().optional(),
            points: z.number().int().optional(),
            comments: z.number().int().optional(),
            domain: z.string().optional(),
            source: z.string().optional(),
            highlights: z.array(z.any()).optional(),
          })
          .passthrough()
      )
      .default([]),
    evidence_summary: z
      .object({
        official_sources: z.number().int().nonnegative().default(0),
        community_sources: z.number().int().nonnegative().default(0),
        release_sources: z.number().int().nonnegative().default(0),
      })
      .default({
        official_sources: 0,
        community_sources: 0,
        release_sources: 0,
      }),
  })
  .passthrough();

export const StoryPersonaSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    name_en: z.string().optional().default(""),
    summary: z.string(),
    jobs_to_be_done: z.array(z.string()).default([]),
    capability_ids: z.array(z.string()).default([]),
    milestone_ids: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    first_supported: z
      .object({
        date: DateStringSchema,
        version: z.string(),
      })
      .optional(),
    maturity: z.object({
      score: z.number().int().min(0).max(100),
      level: z.string(),
    }),
    capabilities: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          maturity: z.object({
            score: z.number().int(),
            level: z.string(),
          }),
        })
      )
      .default([]),
    milestones: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          date: DateStringSchema,
        })
      )
      .default([]),
    sample_changes: z
      .array(
        z.object({
          date: DateStringSchema,
          version: z.string(),
          raw: z.string(),
          summary: z.string(),
          importance: z.number().int().min(1).max(5),
          category: z.enum(CATEGORY_VALUES),
          capability_id: z.string(),
          score: z.number().int(),
        })
      )
      .default([]),
  })
  .passthrough();

export const StoryTrackSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    name_en: z.string().optional().default(""),
    summary: z.string(),
    capability_ids: z.array(z.string()).default([]),
    milestone_ids: z.array(z.string()).default([]),
    capabilities: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          maturity: z.object({
            score: z.number().int(),
            level: z.string(),
          }),
        })
      )
      .default([]),
    milestones: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          date: DateStringSchema,
        })
      )
      .default([]),
    surface_area: z.object({
      capability_count: z.number().int().nonnegative(),
      milestone_count: z.number().int().nonnegative(),
      total_changes: z.number().int().nonnegative(),
    }),
  })
  .passthrough();

export const AssetSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    kind: z.string(),
    target_sections: z.array(z.string()).default([]),
    brief: z.string(),
    source_priority: z.array(z.string()).default([]),
  })
  .passthrough();

export const StoryHomeDataSchema = z.object({
  meta: z.object({
    generated_at: z.string(),
    total_versions: z.number().int().nonnegative(),
    date_range: z.object({
      start: DateStringSchema,
      end: DateStringSchema,
    }),
    hn_signals_count: z.number().int().nonnegative(),
    blog_posts_count: z.number().int().nonnegative(),
    story: z.object({
      milestone_count: z.number().int().nonnegative(),
      capability_count: z.number().int().nonnegative(),
      persona_count: z.number().int().nonnegative(),
      asset_missing_count: z.number().int().nonnegative(),
    }),
  }),
  epochs: z.array(
    EpochSchema.extend({
      milestone_count: z.number().int().nonnegative(),
      capability_count: z.number().int().nonnegative(),
    })
  ),
  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    highlights: z.array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
      })
    ),
  }),
  milestones: z.array(StoryMilestoneSchema),
  capabilities: z.array(StoryCapabilitySchema),
  personas: z.array(StoryPersonaSchema),
  ecosystem: z.object({
    tracks: z.array(StoryTrackSchema),
  }),
  social_proof: z.object({
    official_posts: z
      .array(
        z.object({
          slug: z.string(),
          title: z.string(),
          date: DateStringSchema,
          summary: z.string(),
          url: z.string().url(),
          related_milestone_ids: z.array(z.string()).default([]),
        })
      )
      .default([]),
    featured_hn: z
      .array(
        z.object({
          objectID: z.string(),
          title: z.string(),
          date: DateStringSchema,
          url: z.string().url(),
          external_url: z.string().url().optional(),
          points: z.number().int().nonnegative(),
          comments: z.number().int().nonnegative(),
          domain: z.string(),
          theme: z.string(),
          tone: z.string(),
          related_capability_ids: z.array(z.string()).default([]),
          related_milestone_ids: z.array(z.string()).default([]),
        })
      )
      .default([]),
    themes: z
      .array(
        z.object({
          id: z.string(),
          count: z.number().int().nonnegative(),
          share: z.number(),
        })
      )
      .default([]),
    tones: z
      .array(
        z.object({
          id: z.string(),
          count: z.number().int().nonnegative(),
          share: z.number(),
        })
      )
      .default([]),
  }),
  assets: z.object({
    coverage: z.object({
      missing_count: z.number().int().nonnegative(),
      total_count: z.number().int().nonnegative(),
    }),
    items: z.array(AssetSchema),
  }),
});

export const ExploreReleaseSchema = z.object({
  version: z.string(),
  date: DateStringSchema.nullable(),
  display_date: z.string(),
  sort_date: DateStringSchema,
  date_inferred: z.boolean(),
  source: z.enum(SOURCE_VALUES),
  epoch_id: z.enum(EPOCH_VALUES),
  epoch_name: z.string(),
  milestone_score: z.number().int(),
  capability_ids: z.array(z.string()),
  capabilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
  categories: z.array(z.enum(CATEGORY_VALUES)),
  max_importance: z.number().int().min(1).max(5),
  change_count: z.number().int().nonnegative(),
  signal_count: z.number().int().nonnegative(),
  signal_max_points: z.number().int().nonnegative(),
  hot_signal: z.boolean(),
  headline: z.string(),
  highlights: z.array(z.string()),
  search_text: z.string(),
  changes: z.array(ReleaseChangeSchema),
  signals: z.array(ReleaseSignalSchema),
});

export const ExploreDataSchema = z.object({
  meta: z.object({
    generated_at: z.string(),
    total_versions: z.number().int().nonnegative(),
    date_range: z.object({
      start: DateStringSchema,
      end: DateStringSchema,
    }),
    page_size: z.number().int().positive(),
    hot_signal_threshold: z.number().int().positive(),
  }),
  filters: z.object({
    epochs: z.array(
      z.object({
        id: z.enum(EPOCH_VALUES),
        name: z.string(),
      })
    ),
    capabilities: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    ),
    categories: z.array(z.enum(CATEGORY_VALUES)),
    sources: z.array(z.enum(SOURCE_VALUES)),
    importance_values: z.array(z.enum(IMPORTANCE_VALUES)),
    signal_modes: z.array(z.enum(SIGNAL_VALUES)),
  }),
  releases: z.array(ExploreReleaseSchema),
});

export const SourceBundleSchema = z.object({
  meta: z.object({
    generated_at: z.string(),
    total_versions: z.number().int().nonnegative(),
    date_range: z.object({
      start: DateStringSchema,
      end: DateStringSchema,
    }),
    hn_signals_count: z.number().int().nonnegative(),
    blog_posts_count: z.number().int().nonnegative(),
    story: z.object({
      milestone_count: z.number().int().nonnegative(),
      capability_count: z.number().int().nonnegative(),
      persona_count: z.number().int().nonnegative(),
      asset_missing_count: z.number().int().nonnegative(),
    }),
  }),
  epochs: z.array(EpochSchema),
  releases: z.array(
    z.object({
      version: z.string(),
      date: DateStringSchema.nullable(),
      epoch_id: z.enum(EPOCH_VALUES),
      milestone_score: z.number().int(),
      source: z.enum(SOURCE_VALUES),
      changes: z.array(ReleaseChangeSchema),
      signals: z.array(ReleaseSignalSchema),
    })
  ),
  story: z.object({
    meta: z
      .object({
        generated_at: z.string(),
        milestone_count: z.number().int().nonnegative(),
        capability_count: z.number().int().nonnegative(),
        persona_count: z.number().int().nonnegative(),
        featured_hn_count: z.number().int().nonnegative(),
        official_post_count: z.number().int().nonnegative(),
      })
      .passthrough(),
    hero: z.object({
      headline: z.string(),
      subheadline: z.string(),
      highlights: z.array(
        z.object({
          label: z.string(),
          value: z.union([z.string(), z.number()]),
        })
      ),
    }),
    milestones: z.array(StoryMilestoneSchema),
    capabilities: z.array(StoryCapabilitySchema),
    personas: z.array(StoryPersonaSchema),
    ecosystem: z.object({
      tracks: z.array(StoryTrackSchema),
    }),
    social_proof: z.object({
      official_posts: z.array(z.any()),
      featured_hn: z.array(z.any()),
      themes: z
        .array(
          z.object({
            id: z.string(),
            count: z.number().int().nonnegative(),
            share: z.number(),
          })
        )
        .default([]),
      tones: z
        .array(
          z.object({
            id: z.string(),
            count: z.number().int().nonnegative(),
            share: z.number(),
          })
        )
        .default([]),
    }),
    assets: z.object({
      coverage: z.object({
        total: z.number().int().nonnegative(),
        ready: z.number().int().nonnegative(),
        missing: z.number().int().nonnegative(),
      }),
      items: z.array(AssetSchema),
    }),
    provenance: z
      .object({
        coverage: z.any().optional(),
        notes: z.array(z.string()).default([]),
        source_counts: z.record(z.string(), z.number()).default({}),
      })
      .passthrough(),
  }),
  hn_top: z.array(z.any()).optional(),
})
  .passthrough();

export type StoryHomeData = z.infer<typeof StoryHomeDataSchema>;
export type ExploreData = z.infer<typeof ExploreDataSchema>;
export type SourceBundle = z.infer<typeof SourceBundleSchema>;
export type StoryCapability = z.infer<typeof StoryCapabilitySchema>;
export type ExploreRelease = z.infer<typeof ExploreReleaseSchema>;

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/[`"'.,:;(){}\[\]/\\!?+-]+/g, " ");
}

export function keywordHit(text: string, keyword: string) {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword).trim();

  if (!normalizedKeyword) {
    return false;
  }

  return normalizedText.includes(normalizedKeyword);
}

export function deriveCapabilityIds(
  texts: string[],
  capabilities: Pick<StoryCapability, "id" | "keywords">[]
) {
  const haystack = texts.map(normalizeText).join(" ");
  const matches = new Set<string>();

  for (const capability of capabilities) {
    if (capability.keywords.some((keyword) => keywordHit(haystack, keyword))) {
      matches.add(capability.id);
    }
  }

  return [...matches];
}

export function parseVersionParts(version: string) {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersionsDesc(a: string, b: string) {
  const [aMajor, aMinor, aPatch] = parseVersionParts(a);
  const [bMajor, bMinor, bPatch] = parseVersionParts(b);

  if (aMajor !== bMajor) {
    return bMajor - aMajor;
  }
  if (aMinor !== bMinor) {
    return bMinor - aMinor;
  }
  return bPatch - aPatch;
}

export function formatDisplayDate(date: string, inferred = false) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const value = formatter.format(new Date(`${date}T00:00:00Z`));
  return inferred ? `${value} · 推断` : value;
}
