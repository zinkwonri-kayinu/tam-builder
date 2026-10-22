const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.join(__dirname, "..");
const skills = path.join(root, ".claude", "skills");
const { filterRows, normalizeDomain } = require(path.join(skills, "build-tam/scripts/dedup_filter.js"));
const { diffSignals } = require(path.join(skills, "score-tam/scripts/signal_diff.js"));
const { balance } = require(path.join(skills, "rebuild-territories/scripts/balance.js"));

const icp = require(path.join(root, "config/icp.json"));
const weights = require(path.join(root, "config/scoring-weights.json"));
const territories = require(path.join(root, "config/territories.json"));
const raw = require(path.join(root, "examples/raw-companies.json"));
const deals = require(path.join(root, "examples/closed-deals.json"));
const tiered = require(path.join(root, "examples/tiered-accounts.json"));

test("normalizeDomain strips protocol, www and path", () => {
  assert.equal(normalizeDomain("https://www.Acme.com/about"), "acme.com");
  assert.equal(normalizeDomain(""), null);
});

test("build-tam: dedups by domain and applies the ICP filter", () => {
  const { passed, dedupedCount } = filterRows(raw, icp);
  assert.equal(dedupedCount, 7); // duplicate + empty domain removed
  assert.deepEqual(
    passed.map((r) => r.domain),
    ["northgate-machining.com", "harborline-logistics.com", "coldchain-co.com"]
  );
});

test("score-tam: signals that separate won from lost get heavier weights", () => {
  const { proposed } = diffSignals(deals, icp, weights.signals);
  assert.ok(proposed.employee_count_band_match > 1);
  assert.ok(proposed.job_openings_growth > 1);
  assert.equal(proposed.revenue_band_match, weights.signals.revenue_band_match); // no data -> unchanged
});

test("rebuild-territories: every rep gets a mix of tiers within capacity", () => {
  const { summary, unassignedCount } = balance(tiered, territories);
  assert.equal(unassignedCount, 0);
  for (const rep of Object.values(summary)) {
    assert.equal(rep.total, 3);
    assert.equal(rep.byTier.A, 1);
  }
});

test("rebuild-territories: overflow is reported, not dropped", () => {
  const tight = { ...territories, reps: [{ name: "Solo", capacity: 2 }] };
  const { assignments, unassignedCount } = balance(tiered, tight);
  assert.equal(assignments.length, tiered.length);
  assert.equal(unassignedCount, tiered.length - 2);
});
