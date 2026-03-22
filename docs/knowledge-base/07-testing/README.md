# Testing

## Setup

- Test runner: `bun test` (configured in `package.json`)
- Test directory: `site/tests/`
- Type checking: `bun run check` (runs `astro check` with data preparation)

## Current State

[待确认: Test coverage and specific test files. The `site/tests/` directory exists but specific test content was not inspected.]

## Running Tests

```bash
cd site
bun test        # Run all tests
bun run check   # Type check (includes prepare:data)
```
