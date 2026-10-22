#!/usr/bin/env node
// Assigns tiered TAM rows to reps, round-robin within each tier (in
// tier_priority order), respecting each rep's remaining capacity. Rows left
// over once every rep is at capacity get owner: null and are reported as
// unassigned rather than silently dropped.
//
// Usage:
//   node scripts/balance.js --input tiered.json --output assignments.json

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

const TERRITORIES_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "config",
  "territories.json"
);

function balance(tieredRows, territories) {
  const { reps, tier_priority: tierPriority } = territories;
  const remaining = new Map(reps.map((r) => [r.name, r.capacity]));
  const repOrder = reps.map((r) => r.name);

  const byTier = new Map();
  for (const row of tieredRows) {
    if (!byTier.has(row.tier)) byTier.set(row.tier, []);
    byTier.get(row.tier).push(row);
  }

  const assignments = [];
  const unassigned = [];
  let cursor = 0;

  const orderedTiers = [
    ...tierPriority.filter((t) => byTier.has(t)),
    ...[...byTier.keys()].filter((t) => !tierPriority.includes(t)),
  ];

  for (const tier of orderedTiers) {
    for (const row of byTier.get(tier)) {
      let assignedRep = null;
      for (let attempt = 0; attempt < repOrder.length; attempt++) {
        const candidate = repOrder[cursor % repOrder.length];
        cursor++;
        if ((remaining.get(candidate) || 0) > 0) {
          assignedRep = candidate;
          remaining.set(candidate, remaining.get(candidate) - 1);
          break;
        }
      }
      if (assignedRep) {
        assignments.push({ ...row, owner: assignedRep });
      } else {
        unassigned.push({ ...row, owner: null });
      }
    }
  }

  const summary = {};
  for (const rep of reps) {
    summary[rep.name] = { total: 0, byTier: {} };
  }
  for (const a of assignments) {
    summary[a.owner].total++;
    summary[a.owner].byTier[a.tier] = (summary[a.owner].byTier[a.tier] || 0) + 1;
  }

  return { assignments: [...assignments, ...unassigned], summary, unassignedCount: unassigned.length };
}

function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      territories: { type: "string" },
    },
  });

  if (!values.input || !values.output) {
    console.error("Usage: node balance.js --input tiered.json --output assignments.json");
    process.exit(2);
  }

  const territories = JSON.parse(
    fs.readFileSync(values.territories || TERRITORIES_PATH, "utf8")
  );
  const tieredRows = JSON.parse(fs.readFileSync(values.input, "utf8"));

  if (!Array.isArray(tieredRows)) {
    console.error("Input must be a JSON array of tiered rows.");
    process.exit(2);
  }

  const { assignments, summary, unassignedCount } = balance(tieredRows, territories);

  fs.writeFileSync(values.output, JSON.stringify(assignments, null, 2));

  console.log("Per-rep summary:");
  console.log(JSON.stringify(summary, null, 2));
  if (unassignedCount > 0) {
    console.log(`\n${unassignedCount} row(s) unassigned -- all reps at capacity.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { balance };
