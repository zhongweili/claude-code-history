# Claude Code History

Narrative + data-explorer site telling the complete evolution of Claude Code.

- **Stack**: Astro 5 (static) · React 19 · Tailwind CSS 4 · bun · pnpm
- **Data pipeline**: Python/uv scripts → LLM enrichment → `data/story_data.json` → `site/src/generated/`
- **Pages**: Narrative homepage (Apple keynote style) + Explore page (filterable release browser)
- **Language**: Bilingual — Chinese body copy, English labels/kickers

## Design Context

### Users
A broad AI-curious audience — developers, product people, and tech enthusiasts who want to understand how Claude Code evolved. They arrive curious, scroll quickly, and judge credibility by visual quality. They are not necessarily Claude Code power users; the site must make a complex release history feel approachable and impressive at a glance.

### Brand Personality
Authoritative, refined, forward-looking.

The site should feel like an Apple keynote recap — confident editorial storytelling backed by real data, delivered through a warm, premium visual language. The pace of Claude Code's evolution is the hero; the design should amplify that sense of momentum.

### Emotional Goal
"Impressed by the pace of evolution." Visitors should leave feeling that Claude Code has moved remarkably fast and matured significantly — the design must reinforce ambition and craft at every layer.

### Aesthetic Direction
- **North star**: Apple keynote / apple.com product pages — large type, generous whitespace, editorial rhythm, glass surfaces, subtle depth
- **Theme**: Light only. Warm parchment background (`#f5f1eb`), not cold white
- **Palette**: Muted, sophisticated tones — keep the current set as-is:
  - `--tone-blue: #86a7c5` · `--tone-steel: #92a1af` · `--tone-sage: #8ea793`
  - `--tone-champagne: #cbb28c` · `--tone-coral: #d5927a`
  - Ink `#1f262e`, muted `#68717d`, soft whites with transparency
- **Typography**: SF Pro Display / PingFang SC. Tight letter-spacing on headings (`-0.03em` to `-0.06em`), wide uppercase tracking on kickers (`0.18em`–`0.3em`)
- **Surfaces**: Glass morphism — semi-transparent white gradients, backdrop-blur, hairline borders, layered depth via box-shadow
- **Shapes**: Large radii (2rem panels, 1.5rem cards, full-round pills for tags/buttons)
- **Motion**: Subtle floating orbs with drift animation; `prefers-reduced-motion` already respected
- **Anti-references**: Generic dashboards, dense data tables, dark hacker aesthetics, overly playful/cartoon UI

### Design Principles

1. **Editorial over encyclopedic** — Present data as narrative, not spreadsheet. Every section should read like a story chapter, not a feature list.
2. **Quiet confidence** — Let whitespace, type hierarchy, and surface quality do the talking. No loud gradients, no saturated accents, no decorative noise.
3. **Warm precision** — The parchment palette and rounded glass surfaces should feel human and approachable, but every alignment, spacing, and proportion must be razor-sharp.
4. **Progressive disclosure** — Lead with the headline insight, let the user drill into detail. The homepage narrates; the Explore page proves.
5. **Bilingual harmony** — Chinese prose and English labels must coexist naturally. Sizing, spacing, and line-height should work for both scripts without compromise.
