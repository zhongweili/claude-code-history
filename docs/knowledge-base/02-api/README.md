# API / Data Schemas

This project has no REST API. Data flows through JSON files validated by Zod schemas.

## Core Schemas (site/src/lib/data/schema.ts)

### Source Bundle (`SourceBundleSchema`)

The master input schema. Read from `web/data.json` by `prepare-data.ts`.

```
SourceBundle
  meta: { generated_at, total_versions, date_range, hn_signals_count, blog_posts_count, story.* }
  epochs: Epoch[]
  releases: { version, date, epoch_id, milestone_score, source, changes[], signals[] }[]
  story: { hero, milestones[], capabilities[], personas[], ecosystem, social_proof, assets, provenance }
```

### Story Home Data (`StoryHomeDataSchema`)

Output for the narrative homepage (`site/src/generated/story-home.json`).

Key entities:
- **Epochs** (5 total): id, name, period, color, summary, key_events
- **Milestones**: id, date, title, summary, why_it_matters, evidence[], capabilities[], personas[]
- **Capabilities**: id, name, summary, maturity score, keywords, epochs breakdown
- **Personas**: id, name, jobs_to_be_done, capability_ids, maturity
- **Social Proof**: official_posts, featured_hn, themes, tones

### Explore Data (`ExploreDataSchema`)

Output for the filterable release browser (`site/src/generated/explore-data.json`).

Key entities:
- **Releases**: version, date, epoch, categories, importance, headline, highlights, changes[], signals[]
- **Filters**: epochs, capabilities, categories, sources, importance_values, signal_modes

### Shared Enums

| Enum | Values |
|------|--------|
| `CATEGORY_VALUES` | feat, fix, perf, security, breaking, improvement, other |
| `SOURCE_VALUES` | changelog, github, npm |
| `EPOCH_VALUES` | epoch1, epoch2, epoch3, epoch4, epoch5 |
| `IMPORTANCE_VALUES` | 1, 2, 3, 4, 5 |
| `SIGNAL_VALUES` | all, with-signal, hot-only |
| `HOT_SIGNAL_THRESHOLD` | 500 (HN points) |

## Data Transform Pipeline (site/scripts/prepare-data.ts)

```
web/data.json (SourceBundle)
  --> buildStoryHome() --> site/src/generated/story-home.json
  --> buildExploreData() --> site/src/generated/explore-data.json
```

Runs automatically via `predev` and `prebuild` npm hooks.

## Utility Functions

- `deriveCapabilityIds(texts, capabilities)` - keyword matching to tag releases with capability IDs
- `compareVersionsDesc(a, b)` - semantic version comparison (descending)
- `formatDisplayDate(date, inferred)` - Chinese locale date formatting with "推断" suffix
- `normalizeText(value)` / `keywordHit(text, keyword)` - text normalization for search
