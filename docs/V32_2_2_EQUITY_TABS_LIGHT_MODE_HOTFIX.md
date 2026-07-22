# MONIEZI v32.2.2 — Equity Tabs Light-Mode Hotfix

This hotfix corrects the Equity module segmented tab selector in light mode.

## Fixed

- Selected Equity primary tabs now force high-contrast text using dedicated CSS classes.
- Light mode selected tabs use white text on the dark navy selected pill.
- Light mode inactive tabs use dark text on the light background.
- Dark mode selected tabs retain dark text on the light selected pill.
- The fix avoids relying only on Tailwind text utilities, because global light-mode button rules can override inherited button text.

## Files changed

- `src/features/equity/CompanyEquityModule.tsx`
- `src/index.css`
- `package.json`
- `package-lock.json`
- `App.tsx`
