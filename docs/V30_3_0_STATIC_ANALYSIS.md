# v30.3.0 Static-analysis groundwork

This milestone adds the first repeatable static-analysis layer without forcing a risky strict-TypeScript flip across the whole codebase.

## What was added

- `eslint.config.js` using the flat ESLint config format
- `npm run lint`
- `npm run lint:fix`
- `npm run check` to combine typecheck + lint
- package metadata updates for the new milestone

## Why this is staged

The current MONIEZI codebase is still mid-refactor and has a large legacy surface area. Enabling aggressive lint or strict TypeScript rules all at once would create a large noisy backlog and slow down stabilization.

This milestone intentionally favors:

- repeatability
- low-risk warnings over immediate hard failures
- visibility into regressions
- a path toward tighter rules in later v30 milestones

## Recommended next tightening steps

1. Run `npm run lint` locally and collect the highest-signal warnings.
2. Convert warning-heavy hotspots into extracted modules before tightening rules.
3. Turn selected warnings into errors only after the extracted transaction and mileage flows are stable.
4. Consider enabling stricter TypeScript options incrementally after `App.tsx` is reduced further.
