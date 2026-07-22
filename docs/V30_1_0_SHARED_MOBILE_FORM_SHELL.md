# MONIEZI v30.1.0 shared mobile form shell

This stabilization pass extracts shared mobile keyboard-handling primitives from `App.tsx` and begins reusing them in the UI shell.

## Included changes

- Added `src/hooks/useKeyboardEditingState.ts` for app-level keyboard editing detection.
- Added `src/hooks/useKeyboardSafeScroll.ts` for shared focus/viewport scroll correction.
- Added `src/mobile/inputDetection.ts` for Apple-mobile and text-input detection.
- Added `src/components/mobile/MobileFormShell.tsx` as a reusable editing container.
- Updated `Drawer` to use the shared keyboard-safe scroll hook.
- Updated the main page scroll container to use the shared keyboard-safe scroll hook.
- Updated the Mileage page to render through `MobileFormShell`.

## Why this matters

These changes remove duplicate keyboard logic from multiple places in `App.tsx` and establish a shared pattern for future transaction-entry refactors.
