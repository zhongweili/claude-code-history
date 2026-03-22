# Development Standards

## Language & Conventions

- **TypeScript**: strict mode (extends `astro/tsconfigs/strict`), path alias `@/*` for `src/*`
- **Python**: >= 3.11, managed with uv
- **CSS**: Tailwind CSS 4 utility classes; custom design tokens in `global.css` `@theme` block

## Bilingual i18n Pattern

Chinese is the default language. English is toggled via `data-lang="en"` attribute on `<html>`.

```html
<span class="i18n-cn">Chinese text</span>
<span class="i18n-en">English text</span>
```

CSS rules in `global.css` handle visibility:
- `html[data-lang="en"] .i18n-cn { display: none }`
- `html:not([data-lang="en"]) .i18n-en { display: none }`

Language preference persisted in `localStorage("lang")`.

## Component Architecture

- **Astro components** (`.astro`): Server-rendered, used for homepage sections (HeroSection, MilestoneChapters, CapabilityAtlas, SocialProof, ExploreCta)
- **React islands** (`.tsx`): Client-side interactive components, hydrated with `client:only="react"` (ExploreApp, EpochRail)
- **Layout**: Single `BaseLayout.astro` with nav, main slot, footer, scroll-reveal observer, and language toggle logic

## Design System

- Typography classes: `.kicker`, `.display-lg`, `.headline-md`, `.title-lg`, `.body-lg`, `.label-md`
- Epoch accent classes: `.epoch-genesis`, `.epoch-toolification`, `.epoch-ecosystem`, `.epoch-platformization`, `.epoch-autonomization`
- Glass nav: `.glass-nav`
- Scroll reveal: `.reveal` class + IntersectionObserver in BaseLayout
- Reduced motion: fully respected via `@media (prefers-reduced-motion: reduce)`

## File Organization

```
site/src/
  components/
    home/        # Astro components for narrative homepage
    explore/     # React components for release explorer
    data/        # [待确认: data components if any]
  generated/     # Auto-generated JSON (do not edit)
  layouts/       # BaseLayout.astro
  lib/
    data/        # schema.ts (Zod schemas + utility functions)
    query-state.ts  # URL query state management
    utils.ts     # General utilities
  pages/         # index.astro, explore.astro
  styles/        # global.css
```
