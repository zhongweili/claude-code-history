# Tech Stack

## Overview

A two-layer architecture: a **Python data pipeline** that fetches, enriches, and assembles release data, and an **Astro static site** that renders it as a narrative homepage + interactive explorer.

## Frontend (site/)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Astro | 5.0.9 | Static site generator, `.astro` pages/layouts |
| React | 19.2.4 | Interactive islands (Explore page) via `@astrojs/react` |
| Tailwind CSS | 4.2.1 | Utility-first styling via `@tailwindcss/vite` plugin |
| Zod | 4.3.6 | Runtime schema validation for data pipeline output |
| TypeScript | 5.9.3 | Type safety across all TS/TSX files |
| clsx + tailwind-merge | 2.1.1 / 3.5.0 | Conditional className composition |

**Package manager**: bun 1.3.5 (lockfile: `bun.lock`)
**Build output**: Static HTML (`output: "static"` in `astro.config.mjs`)

### Key Astro Config

- React integration enabled
- Tailwind CSS integrated via Vite plugin (not PostCSS)
- Path alias `@/*` maps to `src/*`

## Backend / Data Pipeline (scripts/)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | >= 3.11 | Data fetching and LLM enrichment scripts |
| uv | (latest) | Python package manager and runner |
| httpx | latest | HTTP client for API calls |
| anthropic[bedrock] | latest | LLM enrichment via Claude on Bedrock |
| mistune | latest | Markdown parsing |

### Pipeline Scripts (sequential)

1. `01_fetch_releases.py` - Fetch raw release data
2. `02_fetch_changelog.py` - Parse changelogs
3. `03_fetch_npm.py` - Fetch npm version history
4. `04_fetch_hn.py` - Fetch Hacker News signals
5. `05_fetch_blog.py` - Fetch Anthropic blog posts
6. `06_enrich_llm.py` - LLM-powered enrichment (importance scoring, summaries)
7. `07_build_output.py` - Assemble intermediate data
8. `08_build_story_data.py` - Build final `web/data.json` + `web/data.js`

## Fonts

- **Headline/Label**: Inter (Google Fonts)
- **Body**: Newsreader (Google Fonts)
- **Icons**: Material Symbols Outlined (Google Fonts)
- **Mono**: SF Mono fallback chain

## Design Tokens (global.css)

- Surface palette: warm parchment (`#fdf9f3` base)
- Epoch accent colors: genesis (purple), toolification (cyan), ecosystem (green), platformization (amber), autonomization (red)
- Glass morphism nav: `rgba(253,249,243,0.7)` + `backdrop-filter: blur(20px)`
- Typography utility classes: `.kicker`, `.display-lg`, `.headline-md`, `.title-lg`, `.body-lg`, `.label-md`
