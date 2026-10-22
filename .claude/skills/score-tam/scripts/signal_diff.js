#!/usr/bin/env node
// Compares each signal in config/scoring-weights.json between closed-won and
// closed-lost accounts, and proposes new weights for signals that actually
// differentiate the two groups. Signals with insufficient data (missing
// fields on both groups) are left at their current weight.
//
// Usage:
//   node scripts/signal_diff.js --deals enriched_deals.json [--write]
//
// `enriched_deals.json` is an array shaped like deals_adapter.js's
// getClosedDeals() output, optionally with extra enrichment fields merged in
// (job_openings_growth, company_maturity_years, revenue). Run without
// --write to preview the proposed weights; pass --write to update
// config/scoring-weights.json in place (bumps version, sets last_refined and
// refined_from_deal_count).
//
// NOTE: with only a handful of closed deals, treat this as a mechanism check,
// not a real model -- see the repo README's "Swapping in a real CRM" section.

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

const ICP_PATH = path.join(__dirname, "..", "..", "..", "..", "config", "icp.json");
const WEIGHTS_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "config",
  "scoring-weights.json"
);

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Each extractor returns a number in [0, 1], or null if the deal lacks the
// data needed to compute it.
function buildExtractors(icp, allDeals) {
  const wonTechCounts = new Map();
  for (const d of allDeals) {
    if (d.outcome !== "closed_won") continue;
    for (const t of d.tech_stack || []) {
      wonTechCounts.set(t, (wonTechCounts.get(t) || 0) + 1);
    }
  }

  return {
    employee_count_band_match(deal) {
      if (deal.employee_count === null || deal.employee_count === undefined)
        return null;
      const band = icp.employee_count || {};
      const n = Number(deal.employee_count);
      if (Number.isNaN(n)) return null;
      const inBand =
        (band.min === undefined || n >= band.min) &&
        (band.max === undefined || n <= band.max);
      return inBand ? 1 : 0;
    },
    tech_stack_overlap(deal) {
      if (!deal.tech_stack || deal.tech_stack.length === 0) return null;
      if (wonTechCounts.size === 0) return null;
      const overlapping = deal.tech_stack.filter((t) => wonTechCounts.has(t));
      return overlapping.length / deal.tech_stack.length;
    },
    job_openings_growth(deal) {
      if (deal.job_openings_growth === undefined || deal.job_openings_growth === null)
        return null;
      return clamp((Number(deal.job_openings_growth) + 1) / 2, 0, 1);
    },
    company_maturity_years(deal) {
      if (deal.company_maturity_years === undefined || deal.company_maturity_years === null)
        return null;
      return clamp(Number(deal.company_maturity_years) / 30, 0, 1);
    },
    revenue_band_match(deal) {
      if (deal.revenue === undefined || deal.revenue === null) return null;
      const band = icp.revenue_band;
      if (!band) return null;
      const n = Number(deal.revenue);
      if (Number.isNaN(n)) return null;
      const inBand =
        (band.min === undefined || n >= band.min) &&
        (band.max === undefined || n <= band.max);
      return inBand ? 1 : 0;
    },
    industry_subvertical_match(deal) {
      if (!deal.industry) return null;
      const keywords = icp.industry_keywords || [];
      const haystack = String(deal.industry).toLowerCase();
      const match = keywords.some((kw) => haystack.includes(String(kw).toLowerCase()));
      return match ? 1 : 0;
    },
  };
}

function diffSignals(deals, icp, currentWeights) {
  const extractors = buildExtractors(icp, deals);
  const won = deals.filter((d) => d.outcome === "closed_won");
  const lost = deals.filter((d) => d.outcome === "closed_lost");

  const proposed = {};
  const notes = [];

  for (const signal of Object.keys(currentWeights)) {
    const extractor = extractors[signal];
    if (!extractor) {
      proposed[signal] = currentWeights[signal];
      notes.push(`${signal}: no extractor defined, weight unchanged`);
      continue;
    }

    const wonValues = won.map(extractor).filter((v) => v !== null);
    const lostValues = lost.map(extractor).filter((v) => v !== null);

    if (wonValues.length === 0 || lostValues.length === 0) {
      proposed[signal] = currentWeights[signal];
      notes.push(
        `${signal}: insufficient data (won=${wonValues.length}, lost=${lostValues.length}), weight unchanged`
      );
      continue;
    }

    const diff = mean(wonValues) - mean(lostValues);
    const newWeight = clamp(Number((1 + diff * 2).toFixed(2)), 0.1, 3.0);
    proposed[signal] = newWeight;
    notes.push(
      `${signal}: won_mean=${mean(wonValues).toFixed(2)} lost_mean=${mean(lostValues).toFixed(2)} -> weight ${currentWeights[signal]} => ${newWeight}`
    );
  }

  return { proposed, notes, wonCount: won.length, lostCount: lost.length };
}

function main() {
  const { values } = parseArgs({
    options: {
      deals: { type: "string", short: "d" },
      write: { type: "boolean", default: false },
      icp: { type: "string" },
      weights: { type: "string" },
    },
  });

  if (!values.deals) {
    console.error("Usage: node signal_diff.js --deals enriched_deals.json [--write]");
    process.exit(2);
  }

  const icp = JSON.parse(fs.readFileSync(values.icp || ICP_PATH, "utf8"));
  const weightsPath = values.weights || WEIGHTS_PATH;
  const weightsConfig = JSON.parse(fs.readFileSync(weightsPath, "utf8"));
  const deals = JSON.parse(fs.readFileSync(values.deals, "utf8"));

  const { proposed, notes, wonCount, lostCount } = diffSignals(
    deals,
    icp,
    weightsConfig.signals
  );

  console.log(notes.join("\n"));
  console.log("\nProposed weights:");
  console.log(JSON.stringify(proposed, null, 2));

  if (values.write) {
    const updated = {
      ...weightsConfig,
      version: (weightsConfig.version || 0) + 1,
      last_refined: new Date().toISOString().slice(0, 10),
      refined_from_deal_count: wonCount + lostCount,
      signals: proposed,
    };
    fs.writeFileSync(weightsPath, JSON.stringify(updated, null, 2) + "\n");
    console.log(`\nWrote updated weights to ${weightsPath}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { diffSignals, buildExtractors };
