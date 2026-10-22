---
name: score-tam
description: Diff closed-won vs closed-lost accounts to find which firmographic/technographic signals predict a win, update the scoring model, and re-tier the TAM. Use when the user wants to re-score the TAM, find what's driving wins, or refresh account tiers after new deals close.
---

# score-tam

Finds what actually differentiates closed-won from closed-lost accounts, and
uses that to re-score and re-tier every account currently in the "Industrial
TAM" Clay workbook.

**Current status: not activated.** There's no live CRM connection yet, so this
runs against `../../data/deals-stub.csv` (2 example rows) via
`scripts/deals_adapter.js`. Don't trust its output as a real scoring model
until a real deals source with meaningful volume is wired in — see "Swapping in
a real CRM" below.

## Steps

1. **Pull closed deals**: call `scripts/deals_adapter.js`'s `getClosedDeals()`.
   Returns an array of `{ domain, outcome, close_date, employee_count,
   industry, tech_stack, deal_size }` where `outcome` is `closed_won` or
   `closed_lost`.
2. **Enrich as needed**: for signals not already on the deal record (e.g. tech
   stack, job openings growth), enrich via the Clay MCP subroutines
   (`Website Technology Stack`, `Company Job Openings`, `Company Latest
   Funding`) keyed by domain.
3. **Diff won vs lost**: run `scripts/signal_diff.js` over the enriched
   closed-won and closed-lost sets. It compares each signal in
   `../../config/scoring-weights.json` between the two groups and proposes new
   weights (signals that differ more between won/lost get weighted higher).
4. **Update the scoring model**: write the proposed weights back to
   `../../config/scoring-weights.json`, bumping `version` and setting
   `last_refined` to the current date and `refined_from_deal_count` to the
   number of closed deals used.
5. **Re-score and re-tier the TAM**: for every row in the "Industrial TAM"
   workbook, compute a weighted score against the updated weights and assign a
   tier per `scoring-weights.json`'s `tiers` cutoffs. Write `score` and `tier`
   back to each row (prefer the Clay plugin's Tables primitive; see
   `build-tam`'s SKILL.md for the same caveat about `clay_client.js`).

## Swapping in a real CRM

All CRM access is isolated to `scripts/deals_adapter.js`'s `getClosedDeals()`
function. To wire in Salesforce (the natural fit — the Clay MCP connection's
`query-objects` tool is already scoped to it): replace that function's body
with a `query-objects` call filtered to closed-won/closed-lost, mapped to the
same return shape. Nothing else in this skill needs to change.

## Config

- `../../config/scoring-weights.json` — current signal weights and tier
  cutoffs. This file is meant to be rewritten by this skill, not hand-tuned,
  once real deal volume exists.
