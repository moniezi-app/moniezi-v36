# MONIEZI v35.0.3 — Paid Release Candidate

## Included corrections

- Signed Packages now totals only packages explicitly marked `signed`.
- Private Raise Tracker section scrolling waits for React to render the selected section using animation frames instead of an arbitrary 80 ms timer.
- Customer-facing app name is now stable: `MONIEZI Pro Finance` / `MONIEZI`.
- The existing manifest ID is retained so current v35 test installations on the same deployment origin can update rather than create a second Android app.
- Service-worker cache version updated for this release.
- Licensing no longer accepts any locally well-formatted key. A production validation endpoint is required.
- The activation screen supports a configured purchase URL.
- GitHub Pages builds accept `VITE_LICENSE_API_BASE` and `VITE_PURCHASE_URL` repository variables.
- Source-only packaging excludes dependencies and generated build output.

## Required production variables

Create these GitHub repository **Variables** before deployment:

- `VITE_LICENSE_API_BASE` — public URL of the MONIEZI license validation Worker, without a trailing `/validate`.
- `VITE_PURCHASE_URL` — direct checkout URL for MONIEZI Pro Finance.
- `VITE_TERMS_URL` — published Terms URL.
- `VITE_PRIVACY_URL` — published Privacy Policy URL.
- `VITE_SUPPORT_EMAIL` — customer support email shown in the app.

Sensitive Gumroad or Cloudflare credentials must remain in Worker secrets and must never be prefixed with `VITE_` or committed to this repository.

## Release gates

1. Deploy and test the license Worker.
2. Configure the two repository variables.
3. Run `npm ci`, `npm run check`, and `npm run build`.
4. Test fresh install and upgrade on Android.
5. Test iPhone Add to Home Screen and airplane-mode launch.
6. Test activation, offline grace, invalid/revoked key, backup export, restore, PDF reports, invoices, receipts, mileage, and Private Raise Tracker.
7. Publish customer policies and support contact before enabling checkout.
