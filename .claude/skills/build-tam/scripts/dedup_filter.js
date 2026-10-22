#!/usr/bin/env node
// Filters raw TAM rows against config/icp.json and dedups by normalized domain.
// Dry-runnable against any fixture file -- never touches Clay.
//
// Usage:
//   node scripts/dedup_filter.js --input raw.json --output filtered.json
//
// Input:  JSON array of raw rows. Each row is expected to carry at least
//         `domain`, and ideally `employee_count` and `industry` (free text).
//         Missing fields are treated as non-matching, not as errors.
// Output: JSON array of surviving rows (deduped, in first-seen order).

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

function normalizeDomain(raw) {
  if (!raw) return null;
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function matchesAnyKeyword(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;
  const haystack = String(text).toLowerCase();
  return keywords.some((kw) => haystack.includes(String(kw).toLowerCase()));
}

function inEmployeeBand(employeeCount, band) {
  if (employeeCount === undefined || employeeCount === null) return false;
  if (!band) return true;
  const n = Number(employeeCount);
  if (Number.isNaN(n)) return false;
  if (band.min !== undefined && n < band.min) return false;
  if (band.max !== undefined && n > band.max) return false;
  return true;
}

function passesIcp(row, icp) {
  if (!inEmployeeBand(row.employee_count, icp.employee_count)) return false;
  if (!matchesAnyKeyword(row.industry, icp.industry_keywords)) return false;
  if (matchesAnyKeyword(row.industry, icp.exclude_keywords)) return false;
  return true;
}

function dedupByDomain(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const domain = normalizeDomain(row.domain);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push({ ...row, domain });
  }
  return out;
}

function filterRows(rawRows, icp) {
  const deduped = dedupByDomain(rawRows);
  const passed = [];
  const dropped = [];
  for (const row of deduped) {
    if (passesIcp(row, icp)) passed.push(row);
    else dropped.push(row);
  }
  return { passed, dropped, dedupedCount: deduped.length };
}

function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      icp: { type: "string" },
    },
  });

  if (!values.input || !values.output) {
    console.error(
      "Usage: node dedup_filter.js --input raw.json --output filtered.json [--icp path/to/icp.json]"
    );
    process.exit(2);
  }

  const icpPath =
    values.icp || path.join(__dirname, "..", "..", "..", "..", "config", "icp.json");
  const icp = JSON.parse(fs.readFileSync(icpPath, "utf8"));
  const rawRows = JSON.parse(fs.readFileSync(values.input, "utf8"));

  if (!Array.isArray(rawRows)) {
    console.error("Input must be a JSON array of rows.");
    process.exit(2);
  }

  const { passed, dropped, dedupedCount } = filterRows(rawRows, icp);

  fs.writeFileSync(values.output, JSON.stringify(passed, null, 2));

  console.log(
    JSON.stringify(
      {
        input_count: rawRows.length,
        deduped_count: dedupedCount,
        qualified_count: passed.length,
        dropped_count: dropped.length,
        output: values.output,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = { normalizeDomain, matchesAnyKeyword, inEmployeeBand, passesIcp, dedupByDomain, filterRows };
