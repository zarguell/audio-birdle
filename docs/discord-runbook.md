# Discord integration runbook

Operational steps for the staging and production Discord app. Security
invariants live in `docs/security-architecture.md`; data handling lives in
`docs/privacy.md`. This file is the "how", not the "why".

## Identifiers

| Thing | Value |
|---|---|
| Discord app (development) | Application ID `1575529908820516916` |
| Staging Worker | `audio-birdle-discord` |
| Staging URL | `https://audio-birdle-discord.useast01.workers.dev` |
| D1 database | `audio-birdle` · `eecd53d4-8f92-47c9-ba60-eea5e963c7a3` |
| Interactions endpoint | `<staging>/api/interactions` |
| Activity URL mapping | `<staging>/` |

Production uses the production Worker `audio-birdle` and its own Discord app;
create that app only at release.

## Secrets

Runtime secrets only, never in the repo or build output:

```bash
npx wrangler secret put DISCORD_PUBLIC_KEY   --name audio-birdle-discord
npx wrangler secret put DISCORD_CLIENT_ID    --name audio-birdle-discord
npx wrangler secret put DISCORD_CLIENT_SECRET --name audio-birdle-discord
npx wrangler secret put DISCORD_BOT_TOKEN    --name audio-birdle-discord
```

`DISCORD_CLIENT_ID` is also read at **build** time so the Activity can find its
app id in `<meta name="discord-client-id">`.

Local development uses `.dev.vars` (gitignored); `.dev.vars.example` lists the
keys.

## Deploy staging

```bash
cd /Users/zach/orca/workspaces/audio-birdle/discord
npm ci
DISCORD_CLIENT_ID=1575529908820516916 npm run build
npx wrangler deploy --name audio-birdle-discord
```

**Never run bare `wrangler deploy` from this worktree.** `wrangler.jsonc` names
the production Worker `audio-birdle`; without `--name audio-birdle-discord` the
deploy would land on production.

## D1

```bash
npx wrangler d1 migrations apply audio-birdle --remote -y
npx wrangler d1 execute audio-birdle --remote --command "SELECT COUNT(*) AS n FROM boards;"
```

Local: `npx wrangler d1 migrations apply audio-birdle --local`.

## Hardening controls

Ships with `worker/migrations/0003_hardening.sql` and `worker/index.js`:

- **Launch binding** — a board needs a `/audiobirdle` launch interaction from the
  same user, guild, and channel within 15 minutes; `/api/session` also checks
  guild membership with the bot token.
- **Rate limits** — 30 requests/minute per user on `/api/session` and
  `/api/result`; 20/minute per IP on `/api/token`.
- **Kill switch** — set `ACTIVITY_DISABLED=1` on the Worker to return 503 from
  `/api/token`, `/api/session`, and `/api/result`. PING and static pages keep
  working; remove it to re-enable.
- **Retention** — the 05:10 UTC cron deletes results older than 90 days, boards
  older than 30 days, launches older than 1 hour, rate-limit windows older than
  1 day, and analytics rows older than 2 days.
- **Boards are per mode** — normal and hard get separate messages.
- **User tokens** use `Authorization: Bearer`; `/oauth2/@me` must report this
  app's id.
- All API responses are `Cache-Control: no-store`; bodies are capped at 8 KiB
  (32 KiB for interactions).

Apply every migration (`0002`, `0003`) before deploying the Worker that needs
them.

## Command registration

Discord does not show `/audiobirdle` until it is registered via the API. Re-run
after any command or subcommand change; `PUT` replaces the global command set.

```bash
DISCORD_CLIENT_ID=1575529908820516916 DISCORD_BOT_TOKEN=<token> \
  node scripts/register-discord-command.mjs
```

Global commands can take a few minutes to appear.

## Portal settings

1. **General Information → Interactions Endpoint URL**: `<staging>/api/interactions`.
   Discord PINGs it on save; success proves `DISCORD_PUBLIC_KEY` and Ed25519.
2. **Activities → URL mapping**: `<staging>/`. Without it, the type 12 launch has
   nowhere to go.
3. **Installation**: scopes `bot` + `applications.commands`; permissions Send
   Messages, Embed Links, Attach Files. No Administrator, no Manage Messages, no
   privileged intents.
4. **Privacy URL**: `<staging>/privacy/`.

## Verification

```bash
U=https://audio-birdle-discord.useast01.workers.dev
curl -sS "$U/api/health"                                   # {"ok":true}
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$U/api/interactions" -d '{}'   # 401
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$U/api/session" -d '{}'        # 401
curl -sS -o /dev/null -w '%{http_code}\n' "$U/privacy/"                            # 200
npx wrangler tail audio-birdle-discord --format pretty
```

A successful first launch produces, in `wrangler tail`:

1. `POST /api/interactions` → 200 (PING) or the `/audiobirdle` command.
2. Activity loads, `POST /api/token` → 200.
3. `POST /api/session` → 200, then a public "`<name>` is playing" message.
4. On completion, `POST /api/result` → 200 and the board message is edited.

D1 check: `players` and `boards` gain one row per player/day.

## Rollback

```bash
npx wrangler delete --name audio-birdle-discord     # remove staging Worker
npx wrangler d1 delete audio-birdle                 # only if discarding data
```

Removing the per-user data instead: `/audiobirdle forget` in the guild.

## Release

1. Finish staging verification in the test guild.
2. Create the production Discord app; set its four secrets on the production
   Worker `audio-birdle` (Workers Builds manages its deploy).
3. Set the production interactions endpoint and Activity URL mapping to
   `https://audio-birdle.sechostlab.com/...` with the production app id baked
   into the build (`DISCORD_CLIENT_ID` in the Workers Builds environment).
4. Merge `discord` into `main`; Workers Builds deploys. Re-register the command
   for the production app id.
5. Update #697 with the release evidence and close it.
