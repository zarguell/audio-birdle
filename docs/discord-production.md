# Production Discord app — step-by-step

Checklist for taking the `discord` branch live at
`https://audio-birdle.sechostlab.com`. Operational reference:
`docs/discord-runbook.md`. Threat model: `docs/security-architecture.md`.

## 0. Prerequisites

- [ ] `discord` branch merged or ready to merge; local gates green.
- [ ] `wrangler` authenticated as the Cloudflare account that owns the site.
- [ ] The production Worker is `audio-birdle` (see `wrangler.jsonc`).
- [ ] You can manage the target Discord server.

## 1. Create the production app

- [ ] https://discord.com/developers/applications → **New Application** → `Audio-Birdle`.
- [ ] **General Information**: copy **Application ID** and **Public Key**.
- [ ] **OAuth2**: copy the **Client Secret**; under **Redirects** add
      `https://127.0.0.1` and save. The Embedded App SDK's `authorize` flow
      fails without a configured redirect.
- [ ] **Installation**: enable both **Guild Install** and **User Install**.
- [ ] Guild install scopes: `bot` + `applications.commands`.
- [ ] Permissions: **View Channel, Send Messages, Embed Links, Attach Files**
      (`54272`). View Channel is required even for `GET /channels/{id}`; a
      private channel also needs a per-channel overwrite for the bot.
- [ ] Install the app into the production server.

## 2. Enable Activities

- [ ] **Activities → Settings → Enable Activities** (the checkbox). Without it
      the entry point/Launch button does not appear.
- [ ] **Activities → URL Mappings**:

| Prefix | Target |
|---|---|
| `/` | `https://audio-birdle.sechostlab.com/` |
| `/xc` | `xeno-canto.org` |
| `/cornell` | `cdn.download.ams.birds.cornell.edu` |

- [ ] Do **not** create a normal chat command named `audiobirdle`. The launch
      command must be `PRIMARY_ENTRY_POINT` with `handler: 1`; a chat command
      answering with type 12 is rejected as "This interaction failed".
- [ ] Do not add subcommands to `/audiobirdle`; once a command has subcommands
      Discord requires choosing one and the bare launch is unreachable.

## 3. Worker secrets (production `audio-birdle`)

Set these **before** saving the interactions endpoint; Discord PINGs it
immediately.

- [ ] `DISCORD_PUBLIC_KEY`
- [ ] `DISCORD_CLIENT_ID` — required at **runtime** by `/api/token` as well as
      at build time. Without it the token exchange returns 501.
- [ ] `DISCORD_CLIENT_SECRET`
- [ ] `DISCORD_BOT_TOKEN`

```bash
npx wrangler secret put DISCORD_PUBLIC_KEY  --name audio-birdle
npx wrangler secret put DISCORD_CLIENT_ID   --name audio-birdle
npx wrangler secret put DISCORD_CLIENT_SECRET --name audio-birdle
npx wrangler secret put DISCORD_BOT_TOKEN   --name audio-birdle
```

## 4. Workers Builds

- [ ] Build command: `bash scripts/build-site.sh`; output directory `dist`.
- [ ] Environment variable `DISCORD_CLIENT_ID=<app id>` so the rendered HTML
      carries `<meta name="discord-client-id">`. The web UI does not need it;
      the Activity does.
- [ ] Confirm the project deploys the Worker (`main` in `wrangler.jsonc`), not
      only static assets.
- [ ] Apply D1 migrations before the Worker that needs them:
      `npx wrangler d1 migrations apply audio-birdle --remote -y`.

## 5. Interactions endpoint

- [ ] **General Information → Interactions Endpoint URL**:
      `https://audio-birdle.sechostlab.com/api/interactions`.
- [ ] Saving must succeed. Discord sends a signed PING; a failure here means the
      public key, endpoint, or Worker route is wrong. Do not continue until it
      saves.

## 6. Register commands

- [ ] Run the registration script against the production app id:

```bash
DISCORD_CLIENT_ID=<prod app id> DISCORD_BOT_TOKEN=<bot token> \
  node scripts/register-discord-command.mjs
```

- [ ] It registers `/audiobirdle` as the entry point (`handler: 1`) and the
      admin commands `/audiobirdle-setup`, `/audiobirdle-stats`,
      `/audiobirdle-forget`.
- [ ] If it cannot create the entry point (the default "Launch" command was
      deleted by an earlier bulk `PUT`), toggle **Enable Activities** off/on to
      let Discord recreate it, then re-run.
- [ ] Global commands can take minutes to propagate; refresh the client.

## 7. Deploy the site

- [ ] Merge `discord` into `main`; Workers Builds deploys.
- [ ] Confirm the build used `DISCORD_CLIENT_ID` (view source: the meta tag is
      present).
- [ ] Verify: `/api/health` 200, `/api/session` 401, `/api/interactions` 401
      unsigned, `/privacy/` 200.

## 8. In Discord

- [ ] `/audiobirdle-setup` **in each channel** that should get summaries (no
      argument; Manage Server required). Summaries are per channel.
- [ ] Launch `/audiobirdle` from the App Launcher (entry points are not in the
      `/` autocomplete).
- [ ] Play a daily round; expect the board message, "Play now!" button, and
      score edit.
- [ ] Click **Play now!** from a second account; it launches the Activity and
      records that player's launch.
- [ ] The summary posts at 05:10 UTC (00:10 ET) for channels with results the
      previous day, sectioned by region and mode.

## 9. Quirks that cost time (read before debugging)

- `wrangler tail` prints `Ok` for completed requests, **not** HTTP 2xx. Confirm
  statuses with `curl` or logs.
- Type 12 (`LAUNCH_ACTIVITY`) is only legal from the entry point or a message
  component; a chat command cannot use it.
- The Activity iframe URL carries `frame_id`, `guild_id`, `channel_id`. Those are
  lost on internal navigation; the client caches the authenticated context in
  `sessionStorage` so game pages do not re-handshake. Without the cache the game
  page has no guild/channel and no board is posted.
- `authorize` needs `guilds` as well as `identify`; `identify` alone fails
  `authenticate`.
- External audio is blocked by the proxy; the client rewrites it to `/xc` and
  `/cornell`, which must exist as URL mappings.
- Admin commands must acknowledge within 3 seconds; they defer and finish via
  the interaction webhook.
- Never run bare `wrangler deploy` from the `discord` worktree — it targets the
  production Worker `audio-birdle`. Use `--name audio-birdle-discord` for
  staging.
- A private channel needs View Channel for the bot; the install permission
  alone may not cover an existing private channel.
- Entry points are visible in the **App Launcher**, not `/` autocomplete.

## 10. Rollback

```bash
npx wrangler delete --name audio-birdle-discord   # staging only
```

Production rollback is a Workers Builds rollback to the previous deployment.
User data: `/audiobirdle-forget` per player; the D1 database can be deleted only
if discarding all results.
