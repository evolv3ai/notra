# Sites E2E GitHub App manifest helper

Requires Node 20+ or Bun. No dependencies, GitHub CLI login, or existing env files are needed. Nothing creates an app until a person clicks **Continue to GitHub** and confirms on GitHub.

Run from the repository root, substituting the **discovered public E2E dashboard** host; the placeholders below are not production URLs:

```sh
node scripts/testing/github-app/server.mjs \
  --webhook-url "$E2E_DASHBOARD_URL/api/webhooks/github/app" \
  --callback-url "$E2E_DASHBOARD_URL/api/integrations/github/callback" \
  --setup-url "$E2E_DASHBOARD_URL/api/integrations/github/callback" \
  --output "$HOME/.capy/work/notra-sites-e2e/github-app.env"
```

For Bun, replace `node` with `bun --no-env-file`. Optional `--organization OWNER` registers under that organization instead of your personal account; optional `--port 8789` changes the local port. The generated name is `notra-sites-e2e-<random suffix>`, with `public: false`. A private app can only be installed on its owner account, so register it under the account that owns the disposable test repository.

Open the private launch link printed in the terminal in your **local browser on the same device**, not a preview or tunnel. The helper binds only to `127.0.0.1` and accepts only its exact Host. The fragment is a one-use bootstrap capability; the UI removes it from browser history. Do not share this link. The bootstrap requires a same-origin POST and launch token. GitHub's callback requires the random state and that browser's HttpOnly, SameSite=Lax session cookie; state is consumed before conversion and expires after one hour. A failed conversion cannot be retried with the same state. Restart the helper instead; inspect and delete any incomplete app GitHub already created before retrying.

The callback POSTs to GitHub's `/app-manifests/{code}/conversions` server-side, then strips the code/state from the local URL using a redirect. It never prints or renders the temporary code, PEM, webhook secret, or client secret. Only these consumed values are saved:

```text
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_WEBHOOK_SECRET
```

No GitHub App client credentials are consumed by the existing app authentication path, so they are not saved. The output must be a **new, untracked, dedicated file**; existing files, symlinks, tracked paths (even deleted tracked files), and files named `.env` are refused. The default is `$HOME/.capy/work/notra-sites-e2e/github-app.env`, outside the worktree. The file is created exclusively with mode `0600`; the PEM uses dotenv-compatible quoted `\n` escapes. Load this file with a dotenv reader; do not shell-source it or copy it to the main environment. Treat it as a secret and do not commit it.

## Dashboard settings and user approval

The manifest configures webhook delivery at `/api/webhooks/github/app` with the generated secret, active hooks, and `push`, `pull_request`, `check_run` subscriptions. It grants only repository `contents: write`, `pull_requests: write`, `checks: write`, `metadata: read`; there are no organization permissions or `issues` permission. Sites requests `pull_requests: write` for PR preview comments, and GitHub accepts that permission for issue-comment endpoints on PRs.

Both dashboard callback and setup URL must be `/api/integrations/github/callback`. The local manifest redirect is separate: `http://127.0.0.1:<port>/callback`. `request_oauth_on_install` is false, and `setup_on_update` is true. No dashboard URL is invented by the helper.

After credentials are saved, the operator must load the four env values into the isolated E2E dashboard server and restart it. `APP_URL` (and the existing public dashboard URL envs) must match the discovered E2E host. **Connect/install through the dashboard's normal GitHub/Sites UI**, not an uncorrelated direct installation link: `/api/integrations/github/callback` requires a dashboard-generated Redis install state and the matching signed-in user. That flow requires configured Redis, a signed-in authorized workspace user, and their connected GitHub account (the existing WorkOS/GitHub account connection, not the manifest's unused client secret).

On GitHub, the person must select **Only select repositories**, then select **only the disposable Sites E2E repository**, and approve installation themselves. The helper cannot enforce GitHub's repository picker or automate approval. Returning from a direct install without dashboard state will fail the dashboard callback; reconnect via its normal flow. Stop the local helper after creation; remove the test app, installation and secret file when done.

## Verification

```sh
node --test scripts/testing/github-app/server.test.mjs
bun --no-env-file test scripts/testing/github-app/server.test.mjs
```

The suite uses fake conversion responses and an ephemeral localhost server, never creates an app, and cleans its scratch directories under `$HOME/.capy/work/notra-sites-e2e`. It covers cross-site bootstrap protection, Host/Origin restrictions, missing/mismatched/expired/replayed state, session binding, API/JSON errors, no secret rendering, exclusive persistence and `0600` permissions.

Official documentation checked for this implementation:

- https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
- https://docs.github.com/en/rest/apps/apps#create-a-github-app-from-a-manifest
