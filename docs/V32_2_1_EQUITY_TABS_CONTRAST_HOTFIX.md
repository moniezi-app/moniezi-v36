# MONIEZI v32.2.1 — Equity Tabs Contrast Hotfix

This hotfix corrects the Equity module segmented tab navigation shown under the internal recordkeeping warning card.

## Fixed

- Replaced the wide horizontal-scrolling Equity section selector with a mobile-safe primary segmented control.
- Primary tabs now remain visible and readable on mobile:
  - Guide
  - Issue Shares
  - Investor Packages
- Added a wrapped secondary chip row for the remaining Equity sections:
  - Reservations
  - Stakeholders
  - Cap Table
  - SAFEs
  - Equity Settings
- Added important text-color utilities to prevent MONIEZI's global light-mode button rule from overriding selected tab/button contrast.
- Improved selected-tab contrast in both light and dark modes.

## Scope

No data model, persistence, export, backup/restore, or investor-package logic was changed.
