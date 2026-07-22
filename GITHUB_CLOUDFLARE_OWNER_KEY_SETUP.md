# GitHub and Cloudflare owner-key setup

1. Upload this source package to a GitHub repository. Keep GitHub Pages disabled until the license Worker URL is configured.
2. Create or sign in to a Cloudflare account.
3. In Workers & Pages, import the GitHub repository as a Worker.
4. Set the Worker root directory to `license-worker` and keep the Worker name `moniezi-license` so it matches `wrangler.jsonc`.
5. Replace `ALLOWED_ORIGIN` with the exact app origin. For a GitHub Pages project site this is normally `https://YOUR-USERNAME.github.io` without the repository path.
6. Create and bind the `LICENSE_BINDINGS` KV namespace, replacing the placeholder namespace ID in `wrangler.jsonc`.
7. Deploy the Worker.
8. In the Worker settings, add a secret named `OWNER_KEY`. Never add this value to GitHub.
9. Copy the deployed Worker URL ending in `.workers.dev`.
10. In GitHub repository settings, add `VITE_LICENSE_API_BASE` as a repository variable with the Worker URL.
11. Add the remaining public build variables from `.env.example`.
12. Enable GitHub Pages with GitHub Actions and run the deployment workflow.
13. Open the deployed app and test activation with the owner key.
14. Create the Gumroad product and replace `GUMROAD_PRODUCT_ID` before testing or selling customer licenses.

Important: the owner key is a master key. Generate a long random value, keep it private, and rotate it immediately if exposed.
