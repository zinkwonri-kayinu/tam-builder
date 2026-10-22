// Fallback Clay workbook client — NOT WIRED UP YET.
//
// Prefer the installed Clay plugin's Tables skill/CLI (from
// clay-run/agent-plugins) for reading and writing workbook rows. That
// plugin's own SKILL.md files, once installed, document the real supported
// surface for table CRUD.
//
// This module exists only as a fallback in case the plugin's Tables
// primitive turns out not to cover programmatic reads/writes, or for
// scripting contexts outside a Claude Code skill invocation. It deliberately
// throws until someone fills in a confirmed request shape — guessing at an
// endpoint here would silently produce wrong behavior instead of a clear
// error.
//
// Reads CLAY_API_KEY from the environment (never hardcode it here).

function requireApiKey() {
  const key = process.env.CLAY_API_KEY;
  if (!key) {
    throw new Error(
      "CLAY_API_KEY is not set. Copy .env.example to .env and fill it in, " +
        "or set the env var directly."
    );
  }
  return key;
}

async function listWorkbookRows(_workbookName) {
  requireApiKey();
  throw new Error(
    "listWorkbookRows() is a stub. Confirm the Clay plugin's Tables " +
      "skill/CLI can do this first — only implement a raw REST call here " +
      "if it can't."
  );
}

async function writeWorkbookRows(_workbookName, _rows) {
  requireApiKey();
  throw new Error(
    "writeWorkbookRows() is a stub. Confirm the Clay plugin's Tables " +
      "skill/CLI can do this first — only implement a raw REST call here " +
      "if it can't."
  );
}

module.exports = { listWorkbookRows, writeWorkbookRows };
