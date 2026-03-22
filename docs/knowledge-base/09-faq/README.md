# FAQ

## Q: How do I run the site locally?

```bash
# 1. Ensure web/data.json exists (run Python pipeline if needed)
cd site
bun install
bun run dev
```

## Q: How do I regenerate the data?

```bash
# Full pipeline (requires API credentials)
cd scripts
uv run 01_fetch_releases.py
uv run 02_fetch_changelog.py
# ... through 08
uv run 08_build_story_data.py

# Then refresh site data
cd ../site
bun run prepare:data
```

## Q: How do I add a new capability?

1. Add the capability definition to `data/capabilities_seed.json` with keywords
2. Re-run `08_build_story_data.py` to rebuild `web/data.json`
3. The site will auto-pick it up via `prepare:data`

## Q: How do I add a new epoch?

1. Add to `data/epochs_seed.json`
2. Add the new epoch ID to `EPOCH_VALUES` in `site/src/lib/data/schema.ts`
3. Add epoch accent color in `global.css` (`@theme` block + `.epoch-*` class)
4. Re-run the full pipeline

## Q: Why is `explore-data.json` so large (~1.7 MB)?

It contains all releases with full change details and search text for client-side filtering. The Explore page is a React island that does all filtering in the browser.

## Q: How does the language toggle work?

The `data-lang` attribute on `<html>` controls visibility of `.i18n-cn` / `.i18n-en` elements via CSS. Preference is saved to `localStorage`. The toggle logic lives in `BaseLayout.astro`.
