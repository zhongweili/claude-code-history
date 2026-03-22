# Deployment

## Build

```bash
cd site
bun run build    # runs prepare:data automatically via prebuild hook, then astro build
```

Output: `site/dist/` (static HTML/CSS/JS)

## Hosting

Static hosting (Vercel/Netlify or similar). The Astro config uses `output: "static"` - no server-side rendering.

## Prerequisites for Build

1. `web/data.json` must exist (produced by the Python pipeline)
2. Node dependencies installed: `cd site && bun install`
3. Python dependencies (for pipeline only): `uv sync`

## Build Pipeline Order

```
1. Run Python pipeline (scripts/01-08) --> produces web/data.json
2. bun run build
   2a. prebuild hook: bun run prepare:data (validates web/data.json, writes site/src/generated/*.json)
   2b. astro build (compiles to site/dist/)
3. Deploy site/dist/ to static host
```

## Environment Variables

- LLM enrichment (`06_enrich_llm.py`) requires AWS Bedrock credentials for `anthropic[bedrock]`
- No env vars needed for the site build itself
