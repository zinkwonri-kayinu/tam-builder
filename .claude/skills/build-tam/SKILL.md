---
name: build-tam
description: Source, ICP-filter, dedup, and enrich the industrial TAM into the "Industrial TAM" Clay workbook. Use when the user wants to (re)build the TAM, pull new leads into Clay, or refresh the industrial company list.
---

# build-tam

Sources the industrial-vertical TAM into the Clay "Industrial TAM" workbook,
applying the ICP filter and dedup rules in `../../config/icp.json`, then
enriching qualifying rows before writing them back with `qualified: true`.

## Prerequisites

- Clay plugin installed and authenticated (`clay:setup` has been run).
- The "Industrial TAM" workbook exists in Clay, with a Search/Tables source
  already pulling raw industrial companies into it (see the repo README for
  the one-time Clay UI/CLI setup — this skill does not originate the bulk
  Apollo/Crustdata/PDL pull itself, it filters and enriches what's already
  landed in the workbook).

## Steps

1. **Read raw rows** from the "Industrial TAM" workbook. Prefer the installed
   Clay plugin's Tables skill/CLI for this. Only fall back to
   `scripts/clay_client.js` if the plugin's Tables primitive doesn't expose a
   programmatic read — that file is a stub pending confirmation of Clay's REST
   surface, not a working client yet.
2. **Filter + dedup**: pipe the raw rows through `scripts/dedup_filter.js`
   against `../../config/icp.json`. This drops anything outside the employee
   count band, without a matching industry keyword, or matching an exclude
   keyword, and dedups by normalized domain.
   ```
   node scripts/dedup_filter.js --input raw.json --output filtered.json
   ```
3. **Enrich** each surviving row using the Clay MCP subroutines (not the
   plugin) — these are already connected in this session:
   - `Company Industry` — confirm/refine the industry classification
   - `Company Employee Count` — confirm headcount (raw source data can be stale)
   - `Website Technology Stack` — for later use by `score-tam`
   - `Company Revenue (Exact)` — for tiering
   Run these via `run_subroutine` against the filtered set, or
   `find-and-enrich-company` per domain if no existing task/entityIds apply.
4. **Write back** the enriched, qualified rows to the workbook with a
   `qualified: true` field (and the enrichment values as new columns), again
   preferring the plugin's Tables primitive over `clay_client.js`.
5. Report the count of qualified leads written, and flag any rows that failed
   enrichment rather than silently dropping them.

## Config

- `../../config/icp.json` — employee count band, industry keywords, exclude
  keywords, geography (currently unset).

## Notes

- This skill does not talk to a CRM — TAM building and CRM-based scoring are
  deliberately separate (see `score-tam`).
- Keep `dedup_filter.js` dry-runnable against a fixture file without hitting
  Clay at all — useful for checking filter logic changes before spending
  enrichment credits.
