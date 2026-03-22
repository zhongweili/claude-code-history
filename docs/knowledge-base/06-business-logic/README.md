# Business Logic

## Core Concept

The site tells the story of Claude Code's evolution through 5 **epochs**, organized around **milestones**, **capabilities**, and **personas**.

## Epochs (5 phases of evolution)

| ID | Name | Color |
|----|------|-------|
| epoch1 | Genesis | Purple (#7c3aed) |
| epoch2 | Toolification | Cyan (#0891b2) |
| epoch3 | Ecosystem | Green (#059669) |
| epoch4 | Platformization | Amber (#d97706) |
| epoch5 | Autonomization | Red (#dc2626) |

Each epoch has a time period, summary (Chinese + English), key events, and associated releases.

## Data Pipeline Logic

### LLM Enrichment (06_enrich_llm.py)

- Each changelog entry is scored for **importance** (1-5) and categorized (feat/fix/perf/security/breaking/improvement/other)
- LLM generates **summary** and **why_matters** fields
- Uses Claude on AWS Bedrock

### Story Assembly (08_build_story_data.py)

- Matches releases to epochs by date ranges
- Computes **milestone scores** for releases
- Derives **capability IDs** from keyword matching against release text
- Builds **persona** profiles with maturity scores
- Aggregates **social proof** (HN discussions, blog posts) with theme/tone analysis
- Produces evidence chains linking milestones to blog posts, HN threads, and releases

### Site Data Transform (prepare-data.ts)

- **Story Home**: Aggregates milestone/capability counts per epoch, passes through hero, milestones, capabilities, personas, social_proof, assets
- **Explore Data**: Enriches each release with display_date, epoch_name, capability_ids, headline, highlights, search_text; sorts by date then version descending

## Key Business Rules

- **Hot signal**: A release is "hot" if any associated HN signal has >= 500 points
- **Importance**: 1 (trivial) to 5 (critical/breaking), used for sorting and display prominence
- **Capability matching**: Keyword-based; each capability defines keywords that are matched against release text via `deriveCapabilityIds()`
- **Date inference**: If a release lacks an explicit date, the epoch's `period_start` is used, and "推断" (inferred) is shown in the UI
- **Page size**: Explore page loads 24 releases per page

## Two Pages

1. **Homepage** (`/`): Apple-keynote-style narrative with Hero > Milestones > Capability Atlas > Social Proof > CTA
2. **Explore** (`/explore`): Filterable, searchable release browser (React island) with epoch, capability, category, source, importance, and signal filters
