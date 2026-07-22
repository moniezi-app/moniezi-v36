# MONIEZI v30 stabilization plan

This is the first architecture-stabilization pass, not a full rewrite.

## Phase 1: reduce App.tsx risk surface
- move hash routing helpers into `src/navigation/hashRouting.ts`
- move mileage draft defaults and normalization into `src/features/mileage/draft.ts`
- keep behavior unchanged while shrinking the single-file blast radius

## Phase 2: shared mobile form shell
- extract iPhone keyboard-editing state into a reusable hook
- separate page-shell UI from active editing UI
- reuse one keyboard-safe form container for mileage and transaction entry

## Phase 3: safer static analysis
- add `typecheck` as a first-class script
- tighten low-risk TypeScript rules first
- move toward a stricter follow-up config once the monolith is split further

## Phase 4: regression protection
- codify critical manual test paths
- add automated coverage after feature boundaries are extracted

## First critical regression targets
- Add Income amount field on iPhone
- Add Expense amount field on iPhone
- Estimate and Invoice amount entry on iPhone
- Mileage entry with and without demo data
- Overview plus-flow opening a fresh mileage draft
