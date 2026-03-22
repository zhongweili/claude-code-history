# Configuration

## Config Files

| File | Purpose |
|------|---------|
| `site/astro.config.mjs` | Astro: React integration, static output, Tailwind via Vite plugin |
| `site/tsconfig.json` | TypeScript: strict mode, `@/*` path alias, JSON module resolution |
| `site/package.json` | Dependencies, scripts (dev/build/check/test), bun as package manager |
| `pyproject.toml` | Python project: name, version, Python >= 3.11, dependencies |
| `.gitignore` | Ignores `.venv/`, `__pycache__/`, `node_modules/`, `.astro/`, `dist/`, `.env*` |
| `CLAUDE.md` | AI assistant instructions (design brief, conventions, brand personality) |

## Environment Variables

| Variable | Required | Used By | Purpose |
|----------|----------|---------|---------|
| AWS Bedrock credentials | For pipeline only | `06_enrich_llm.py` | LLM enrichment via `anthropic[bedrock]` |

No `.env.example` file exists. The site build itself requires no environment variables.

## Key Constants (in code)

| Constant | Location | Value |
|----------|----------|-------|
| `HOT_SIGNAL_THRESHOLD` | `schema.ts` | 500 |
| `PAGE_SIZE` | `prepare-data.ts` | 24 |
| `EPOCH_VALUES` | `schema.ts` | epoch1-epoch5 |
| `CATEGORY_VALUES` | `schema.ts` | 7 categories |
| `SOURCE_VALUES` | `schema.ts` | changelog, github, npm |

## npm Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Astro dev server (auto-runs `prepare:data`) |
| `build` | Production build (auto-runs `prepare:data`) |
| `prepare:data` | Transform `web/data.json` into site-ready JSON |
| `check` | TypeScript type checking |
| `preview` | Preview production build locally |
| `test` | Run bun tests |
