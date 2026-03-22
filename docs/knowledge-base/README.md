# Claude Code History - Knowledge Base

Narrative + data-explorer site telling the complete evolution of Claude Code.

## Navigation

| Section | Description |
|---------|-------------|
| [01-tech-stack](01-tech-stack/README.md) | Languages, frameworks, key dependencies |
| [02-api](02-api/README.md) | Data schemas and internal APIs |
| [03-database](03-database/README.md) | Data pipeline and JSON data stores |
| [04-deployment](04-deployment/README.md) | Static build and hosting |
| [05-dev-standards](05-dev-standards/README.md) | Code conventions and bilingual i18n |
| [06-business-logic](06-business-logic/README.md) | Data pipeline stages and site narrative logic |
| [07-testing](07-testing/README.md) | Testing setup |
| [08-configuration](08-configuration/README.md) | Environment variables and config files |
| [09-faq](09-faq/README.md) | Common issues and solutions |
| [10-changelog](10-changelog/README.md) | Change log |

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| `bun run dev` fails with missing `web/data.json` | Run the Python pipeline first: `cd scripts && uv run 08_build_story_data.py` to produce `web/data.json` |
| Editing `data/*.json` directly | These are intermediate pipeline outputs; edit the Python scripts or `data/editorial/` seeds instead |
| Adding a new epoch | Must update `EPOCH_VALUES` in `site/src/lib/data/schema.ts`, `data/epochs_seed.json`, and pipeline scripts |
| i18n content not toggling | Wrap Chinese text in `.i18n-cn` and English in `.i18n-en`; the `[data-lang]` attribute on `<html>` controls visibility |
| Generated JSON out of date | `prepare-data.ts` runs automatically via `predev`/`prebuild` hooks; if stale, run `bun run prepare:data` manually |

---

*Created: 2026-03-21 | Last updated: 2026-03-21 | Based on project-knowledge-base skill template*
