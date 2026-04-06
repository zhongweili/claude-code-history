# Claude Code History

A narrative data-visualization site that chronicles the complete evolution of [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — from its research preview in February 2025 to today.

**Live site → [cc.waymay.us](https://cc.waymay.us)**

<!-- TODO: replace with actual screenshot -->
<!-- ![Homepage screenshot](docs/screenshot-home.png) -->

## What is this?

Claude Code ships fast — 60+ releases in just over a year. This project turns that raw changelog into an editorial narrative, organized into five historical epochs and eight capability tracks, rendered in an Apple-keynote-inspired design.

**Two views:**

- **Home** — Scroll through milestone chapters, a capability atlas, and social proof (Hacker News discussions, Anthropic blog posts)
- **Explore** — Filter every release by epoch, capability, category, importance, and community signals

**Bilingual:** Full Chinese and English support. The site auto-detects your browser locale and lets you switch manually.

## Architecture

```
anthropics/claude-code CHANGELOG.md
        │
        ▼
  ┌─────────────┐     LLM enrichment      ┌──────────────────┐
  │ agent/       │ ──── (classify,  ──────▶│ data/             │
  │ update.ts    │      score, narrate)    │ auto_bundle.json  │
  └─────────────┘                          └────────┬─────────┘
                                                    │
                                           prepare-data-v2.ts
                                                    │
                                   ┌────────────────┴───────────────┐
                                   ▼                                ▼
                          story-home.json                  explore-data.json
                                   │                                │
                                   └──────────┬─────────────────────┘
                                              ▼
                                     Astro 5 + React 19
                                     (static site → CDN)
```

**Data pipeline** (`agent/update.ts`):

1. Fetch — Pull changelog from GitHub, timestamps from npm, signals from Hacker News
2. Parse — Extract versions, dates, and change items
3. Enrich — LLM classifies each item (category, importance 1–5, bilingual summary, capability mapping)
4. Score — Assign epochs, match HN/blog signals, compute highlight scores
5. Narrate — LLM generates keynote-style titles and summaries for key releases
6. Stats — Aggregate capability maturity scores

**Frontend** (`site/`): Astro 5 (static SSG), React 19 islands, Tailwind CSS 4, Zod schema validation.

## Five Epochs

| Epoch | Period | Theme |
|-------|--------|-------|
| Genesis | 2025-02 → 2025-05 | Research preview, new paradigm |
| Toolification | 2025-05 → 2025-08 | Production-ready, methodology foundations |
| Ecosystem Expansion | 2025-08 → 2025-11 | Multi-IDE, 2.0 rewrite |
| Platformization | 2025-12 → 2026-02 | $1B ARR, plugins, Bun acquisition |
| Autonomization | 2026-02 → present | 1M context, unattended operation |

## Getting Started

### Prerequisites

- [bun](https://bun.sh/) ≥ 1.3

### Local development

```bash
git clone https://github.com/zhongweili/claude-code-history.git
cd claude-code-history/site
bun install
bun run dev          # starts dev server at localhost:4321
```

The site builds from cached data in `data/auto_bundle.json` — **no API key needed** to run locally.

### Updating data (optional)

To re-run the LLM enrichment pipeline:

```bash
# Using OpenRouter (recommended):
OPENROUTER_API_KEY=your-key bun agent/update.ts

# Incremental (only new versions):
OPENROUTER_API_KEY=your-key bun agent/update.ts --incremental

# Or using OpenAI directly:
OPENAI_API_KEY=your-key bun agent/update.ts
```

### Build & preview

```bash
cd site
bun run build        # outputs to site/dist/
bun run preview      # preview the production build
```

### Type checking

```bash
cd site
bun run check
```

## Deployment

The site is deployed to Cloudflare Workers as static assets and updates daily via GitHub Actions.

## Contributing

Contributions are welcome! Here are some ways to help:

- **Data quality** — Spot an incorrect classification or missing signal? Open an issue
- **Design** — Improve the narrative experience or add visualizations
- **i18n** — Improve translations in either language
- **New features** — Ideas for new views or analyses

Please open an issue first for larger changes so we can discuss the approach.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5 (static SSG) |
| UI | React 19, Tailwind CSS 4 |
| Data pipeline | TypeScript (bun) |
| LLM enrichment | OpenAI / OpenRouter API |
| Schema validation | Zod |
| Hosting | Cloudflare Workers |
| CI/CD | GitHub Actions (daily) |

## License

[MIT](LICENSE)

