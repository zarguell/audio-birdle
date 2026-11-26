# Privacy and analytics

Status: draft, 2026-11-26. Describes what the site collects today, what the
Discord integration and Cloudflare Web Analytics will add, and the retention
and deletion rules that ship with them. Not legal advice; review before public
launch.

Related: `SECURITY.md`, `docs/security-architecture.md`, #688 (D8, D9), #697
(Discord epic).

## Principles

1. **Opt-in, default off.** No analytics request happens until the player turns
   it on in Settings. There is no pre-ticked box and no nag modal.
2. **No identifiers in analytics.** No cookies, no `localStorage` IDs, no
   fingerprints, no cross-site tracking.
3. **Aggregate over individual.** Prefer counters to per-user rows; where DAU
   needs uniqueness, use a daily-rotating hash and delete it within 48 h.
4. **Collect only what the game needs.** No message content, no email, no IP
   logs, no free text.
5. **Deletable.** A documented path exists for everything stored per user.

## Web analytics (Cloudflare Web Analytics)

Enabled only after the Settings toggle. `core/analytics.js` injects the beacon
script at that moment; the HTML never contains it, so a declined or
never-asked visitor makes zero analytics requests.

| Data | Detail |
|---|---|
| Page path | Which pages are used |
| Referrer | Traffic source, when the browser sends one |
| Country | Cloudflare edge geolocation |
| Browser / OS / device class | Coarse, from the user agent |
| Core Web Vitals | Page performance |

- No cookies, no `localStorage`, no fingerprinting (per Cloudflare's product
  description).
- Aggregate only; there is no per-visitor view and no cross-site history.
- Retention follows Cloudflare's policy for Web Analytics (verify current
  terms before launch).
- Withdrawal from Settings stops future beacon requests. Data already
  aggregated cannot be deleted per person; the `/privacy` page says this
  explicitly.

Consent record: `audio-birdle-analytics-consent` =
`{ granted: boolean, policyVersion: string, at: ISO-8601 }`, kept in
`localStorage`, separate from the `audio-birdle-game` envelope. A material
policy change bumps `policyVersion` and requires a new choice. Do Not Track and
Global Privacy Control force the toggle off and suppress prompting.

## Discord Activity

Playing through the bot requires Discord identity, so it is **not anonymous** —
say so plainly.

| Data | Where | Purpose | Retention |
|---|---|---|---|
| Discord id, username, avatar | D1 | Identify the player, render boards | While the app is installed |
| Daily results (grid, mode, region, score) | D1 | Public board, streaks, `/audiobirdle stats` | ≤90 days |
| Guild/channel id + board message id | D1 | Keep edits scoped to the right message | ≤30 days |
| Analytics counters (launch, completion, mode, region) | D1 | Aggregate usage | ≤90 days |
| DAU hash `hmac(discord_id, daily_salt)` | D1 | Unique daily players | ≤48 h; salt deleted daily |

- No message content is read or stored. The bot needs no privileged intents and
  no `MESSAGE_CONTENT`.
- `/audiobirdle forget` deletes the identity row and every per-user row.
- Analytics writes are gated by the same consent flag; declining means no
  counters row for that session. Aggregate counters are still anonymous.
- The Activity does not load the Web Analytics beacon: the iframe is served
  through Discord's proxy, which distorts referrer, geography, and path.

## Existing behaviour worth naming

- **Audio is hotlinked.** Browsers fetch recordings directly from Cornell's
  Macaulay CDN or xeno-canto, which discloses the player's IP and user agent to
  those services. This predates any change here. The `/audio/*` proxy in #688 D9
  would route those requests through Cloudflare and remove the direct
  disclosure.
- **Game state is local.** `audio-birdle-game` (v2) and region/mode keys live in
  `localStorage`; clearing site data erases them.
- **No server-side accounts on the web.** There is nothing to delete on a server
  because nothing is sent.

## Deletion and controls

| Control | Effect |
|---|---|
| Settings → Anonymous usage analytics | Starts/stops the beacon; removes the consent record |
| Clear site data | Erases local game state, region, and consent |
| `/audiobirdle forget` | Deletes Discord identity and all per-user rows |
| Privacy contact | Documented on `/privacy`; handled per `SECURITY.md` for sensitive reports |

## Third parties

| Party | Role | Data seen |
|---|---|---|
| Cloudflare | Hosting, Web Analytics | Requests to the origin; aggregate analytics |
| Discord | Activity host, bot platform | Interaction payloads, channel messages |
| Macaulay Library / Cornell | Audio CDN | IP, user agent (until #688 D9 ships) |
| xeno-canto | Audio CDN | IP, user agent (until #688 D9 ships) |

No advertising, no data sale, no third-party analytics beyond Cloudflare.

## Before launch

- [ ] Publish `/privacy` with this inventory and a policy version
- [ ] Discord app settings privacy URL points at `/privacy`
- [ ] Verify zero analytics requests before opt-in, including DNT/GPC paths
- [ ] Confirm CWA retention and that beacon mode works with Workers static assets
- [ ] Retention jobs: 48 h DAU hashes; 30/90-day rows
- [ ] Legal review of the consent copy and the pseudonymous DAU hash
