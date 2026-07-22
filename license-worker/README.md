# MONIEZI License Worker

This Worker is the production validation endpoint expected by MONIEZI Pro Finance v36.0.0.

## Setup

1. In Gumroad, create the MONIEZI Pro Finance product and enable license keys.
2. Copy the Gumroad product ID into `GUMROAD_PRODUCT_ID` in `wrangler.jsonc`.
3. Create a Workers KV namespace and replace `REPLACE_WITH_KV_NAMESPACE_ID`.
4. Replace `ALLOWED_ORIGIN` with the exact deployed MONIEZI app origin, such as `https://app.moniezi.com`.
5. Deploy the Worker with `npm install` and `npm run deploy`.
6. Add the owner key as a Cloudflare Worker secret using the dashboard or `npx wrangler secret put OWNER_KEY`.
7. Set the app repository variable `VITE_LICENSE_API_BASE` to the deployed Worker URL.
8. Set `VITE_PURCHASE_URL` to the Gumroad checkout URL.

The Worker verifies the key with Gumroad and permits up to three bound devices by default. It stores a one-way hash of the license key, not the raw key.

Before public launch, enable Cloudflare rate limiting for `POST /validate` and test valid, invalid, refunded/revoked, offline, reinstall, and device-limit behavior.

## Owner key

The owner key is an optional private master key for the product owner. It bypasses Gumroad validation and does not consume a customer device slot.

- Generate a unique random key of at least 32 characters using letters, numbers, and hyphens.
- Store it only as the Cloudflare Worker secret named `OWNER_KEY`.
- Never put it in `wrangler.jsonc`, `.env`, `.env.example`, GitHub repository variables, GitHub Actions logs, or application source.
- Use it only on devices you control. Anyone who obtains it can activate the app.
- Rotate the Cloudflare secret immediately if the key is exposed.

The owner path works before a Gumroad product is configured. Customer keys remain disabled until `GUMROAD_PRODUCT_ID` is replaced with the real Gumroad product ID.
