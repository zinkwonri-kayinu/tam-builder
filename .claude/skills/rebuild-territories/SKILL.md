---
name: rebuild-territories
description: Rebalance rep territories across the re-tiered TAM by ICP tier and capacity, and push owner assignments back to the Clay workbook. Use when the user wants to rebuild/rebalance territories or reassign accounts after re-tiering.
---

# rebuild-territories

Takes the tiered TAM (written by `score-tam`) and assigns each account to a
rep, balanced by tier and capacity, then writes the assignment back.

**Current status: not activated.** `config/territories.json` has a 3-rep
placeholder roster with equal capacity — swap in real reps/capacity before
trusting the output for actual rep assignment.

## Steps

1. **Read the tiered TAM** from the "Industrial TAM" workbook (each row needs
   `tier` from `score-tam`, or this skill has nothing to balance against).
2. **Balance**: run `scripts/balance.js` with the tiered rows and
   `../../config/territories.json`. It walks tiers in `tier_priority` order
   and round-robins accounts within each tier across reps with remaining
   capacity, so no rep gets skewed toward only top-tier or only bottom-tier
   accounts.
3. **Write back**: push the resulting `owner` field per account to the
   workbook (prefer the Clay plugin's Tables primitive; see `build-tam`'s
   SKILL.md for the caveat about `clay_client.js`), and/or push into a CRM or
   sequencer once one is connected — that's a second, separate write path, not
   built yet.
4. Report a per-rep summary: account count and tier breakdown, so it's obvious
   at a glance whether the balance is actually even.

## Config

- `../../config/territories.json` — rep roster, capacity, tier priority order,
  and balance strategy.

## Swapping in real reps

Edit `../../config/territories.json`'s `reps` array — `name` and `capacity`
per rep. No script changes needed.
