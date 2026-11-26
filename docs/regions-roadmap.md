# Region roadmap

Audio-Birdle is expanding one country at a time. The goal is **12–15
well-covered regions**, not global completeness. Each region must be playable
with its own daily challenge, audio, and regular-species filter.

Tracking issue: [#676](https://github.com/zarguell/audio-birdle/issues/676).

## Status

### Live

| Region | Playable species | Notes |
|---|---:|---|
| United States | 704 | Includes the `us-lower48` virtual region |
| United Kingdom | 235 | England, Northern Ireland, Scotland, Wales |
| Ireland | 139 | Country-level pool; 106 in the current daily filter |
| South Africa | 489 | Country-level pool; 478 in the current daily filter |
| Costa Rica | 528 | Country-level pool; 507 in the current daily filter |
| France | 268 | Country-level pool; 179 in the current daily filter |
| Japan | 166 | Country-level pool; 116 in the current daily filter |
| New Zealand | 123 | Country-level pool; 118 in the current daily filter |
| Germany | 207 | Country-level pool; 155 in the current daily filter |
| Canada | 344 | Country-level pool |
| Australia | 525 | Country-level pool |

### Phase 0 — sharding (complete)

Bird data is sharded per region under `public/data/birds/`. The client loads
only the selected region's shard; the manifest includes every shard. This keeps
the game payload roughly constant as the region count grows.

## Candidate data

These are preliminary eBird country lists and Xeno-canto species with at least
one recording. **XC species is not playable species**: the audit still filters
regularity, quality, length, and licensing.

| Country | eBird species | XC species | XC/eBird | Status |
|---|---:|---:|---:|---|
| Ireland | 505 | 264 | 52% | **Live** — 139 playable |
| South Africa | 903 | 619 | 69% | **Live** — 489 playable |
| Costa Rica | 973 | 657 | 68% | **Live** — 528 playable |
| France | 722 | 631 | 87% | **Live** — 268 playable |
| Japan | 693 | 254 | 37% | **Live** — 166 playable |
| New Zealand | 410 | 173 | 42% | **Live** — 123 playable |
| Germany | 669 | 342 | 51% | **Live** — 207 playable |
| Spain | 876 | 392 | 45% | Backlog |
| Italy | 607 | 358 | 59% | Backlog |
| Netherlands | 637 | 384 | 60% | Backlog |
| Portugal | 709 | 330 | 47% | Backlog |
| Mexico | 1,240 | 853 | 69% | Backlog |
| Argentina | 1,104 | 888 | 80% | Backlog |
| Thailand | 1,161 | 736 | 63% | Backlog |
| Malaysia | 885 | 598 | 68% | Backlog |
| Kenya | 1,150 | 736 | 64% | Backlog |
| Taiwan | 778 | 359 | 46% | Backlog |
| Singapore | 618 | 255 | 41% | Backlog |
| South Korea | 556 | 144 | 26% | Deferred |
| Morocco | 510 | 194 | 38% | Deferred |
| Israel | 596 | 165 | 28% | Deferred |

Deferred means the recording coverage is too thin relative to the eBird list;
revisit if Xeno-canto coverage improves.

## Waves

One country is onboarded at a time, even when a wave lists several.

### Wave 1 — high-confidence, low-risk
1. **Ireland** — complete.
2. **South Africa** — complete.

### Wave 2 — flagship coverage
3. **Costa Rica** — complete.
4. **France** — complete.

### Wave 3 — unique/large
5. **Japan** — complete.
6. **New Zealand** — complete.

### Backlog wave
7. **Germany** — complete.
8. **Spain** — next.

### Backlog
Germany, Spain, Italy, Netherlands, Portugal, Mexico, Argentina, Thailand,
Malaysia, Kenya, Taiwan, Singapore.

### Deferred
South Korea, Morocco, Israel.

## Onboarding gate

A region is ready when the full audit reports:

- country-level play, no subregions required
- at least **100 playable species** (150 preferred for larger countries)
- at least **50% audio coverage** of the regular pool
- no unresolved taxonomy gaps
- no Xeno-canto errors
- a reasonable per-region data size after sharding

The regional taxonomy must be built from a current eBird snapshot; do not
refresh the global taxonomy just to add a country. Existing region IDs stay
pinned.

## Definition of done

Each country issue has the same checklist:

- [ ] eBird/XC audit
- [ ] region taxonomy snapshot
- [ ] annual regular pool and current seasonal filter
- [ ] XC audio with attribution
- [ ] country-level birds and daily pool
- [ ] region metadata and manifest
- [ ] data invariants and browser coverage
- [ ] deployed and verified

## Burn-down

GitHub issues with the `region` and `region:*` labels are the source of truth.
Move an issue between `region:next`, `region:audit`, and `region:live` as it
progresses. The umbrella issue links the current wave.

A GitHub Project can mirror these issues when the token has project scope; the
issue labels are sufficient for the roadmap today.
