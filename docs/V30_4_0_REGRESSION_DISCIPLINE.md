# MONIEZI v30.4.1 Regression Discipline

This milestone adds lightweight automated regression coverage around the extracted stabilization logic without introducing a heavy browser test stack yet.

## What was added

- `npm run test:regression`
- `tsconfig.regression.json`
- automated regression checks for:
  - mileage new-draft defaults
  - mileage miles normalization
  - mileage payload serialization
  - hash routing normalization and URL building
- GitHub Actions quality gate before Pages build/deploy

## Why this matters

The app has already lost a large amount of time to regressions in create-vs-edit state, keyboard-sensitive flows, and navigation state. The extracted helper modules are now protected by repeatable checks so future refactors are less likely to reintroduce stale-draft or route-shape bugs.

## Scope limits

This is intentionally a small first harness.

It does **not** yet cover:
- interactive browser-level iPhone keyboard behavior
- visual layout regressions
- end-to-end transaction drawer interaction

Those are candidates for a later Playwright-style pass once more UI logic has been extracted from `App.tsx`.
