// Isolates all CRM access behind getClosedDeals(). Currently reads
// data/deals-stub.csv. To swap in a real CRM (Salesforce via the Clay MCP
// connection's query-objects tool is the natural fit), replace the body of
// getClosedDeals() with a call mapped to the same return shape -- nothing
// else in score-tam needs to change.

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_STUB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "data",
  "deals-stub.csv"
);

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((key, i) => {
      row[key] = cells[i] !== undefined ? cells[i] : "";
    });
    return row;
  });
}

function coerceRow(row) {
  return {
    domain: row.domain,
    company_name: row.company_name,
    outcome: row.outcome,
    close_date: row.close_date,
    employee_count: row.employee_count === "" ? null : Number(row.employee_count),
    industry: row.industry || null,
    tech_stack: row.tech_stack
      ? row.tech_stack.split(";").map((s) => s.trim()).filter(Boolean)
      : [],
    deal_size: row.deal_size === "" ? null : Number(row.deal_size),
  };
}

/**
 * Returns all closed deals (won + lost) as
 * { domain, outcome, close_date, employee_count, industry, tech_stack, deal_size }[]
 * where outcome is "closed_won" or "closed_lost".
 */
function getClosedDeals(csvPath = DEFAULT_STUB_PATH) {
  const text = fs.readFileSync(csvPath, "utf8");
  return parseCsv(text).map(coerceRow);
}

if (require.main === module) {
  console.log(JSON.stringify(getClosedDeals(), null, 2));
}

module.exports = { getClosedDeals, parseCsv, coerceRow };
