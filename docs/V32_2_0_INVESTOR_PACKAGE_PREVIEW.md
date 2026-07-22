# MONIEZI v32.2.0 — Investor Link Drafting + Signing Package Preview

This version adds an owner-side workflow inside the Equity module for drafting a DocuSign-style private investor reservation package.

## Added

- New Equity tab: **Investor Packages**.
- Draft investor package records for family/friends/private contacts.
- Package fields include investor name, email, phone, entity name, desired amount, instrument type, minimum investment, indicative price per share, expiration date, private message, offering summary, major terms, risk/acknowledgment language, and typed-signature preview.
- Owner-side preview of the investor-facing signing page.
- Placeholder private link generation for a future Cloudflare investor portal.
- Copyable invitation text for email/text message.
- Downloadable standalone HTML preview of the investor-facing page.
- Package status workflow: draft, ready to send, sent, opened, signed, expired, voided.
- Saved packages are also stored as Investment Reservation records.
- Reservation CSV export now includes package status, placeholder link, expiration date, and estimated shares.
- Demo data now includes draft, sent, and signed investor package examples.

## Scope note

v32.2.0 does not create a live public investor portal and does not process payments, legally issue shares, or replace securities-law review. The generated link is a placeholder until a Cloudflare Pages/Workers backend is added in a later version.
