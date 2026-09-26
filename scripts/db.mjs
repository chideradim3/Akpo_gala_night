/**
 * Thin wrapper around the Supabase CLI for database commands.
 *
 *   node scripts/db.mjs push     apply every pending migration
 *   node scripts/db.mjs seed     apply migrations + the sample data
 *   node scripts/db.mjs types    regenerate types/database.ts from the live schema
 *   node scripts/db.mjs status   list which migrations have been applied
 *
 * Usually run through npm: `npm run db:push`, `npm run db:seed`, etc.
 *
 * WHY THIS EXISTS
 *
 * The CLI needs the database connection string. Reading it from .env.local
 * here means:
 *   - the same command works in PowerShell and in bash (no `$VAR` syntax
 *     differences, no `export`)
 *   - the password never appears in a terminal, a shell history file, or a
 *     package.json script
 *
 * SUPABASE_DB_URL is a local tool credential. The application never reads it,
 * and it does NOT belong in Vercel.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env.local");

function loadEnvLocal() {
  if (!existsSync(ENV_FILE)) {
    fatal(
      ".env.local not found.\n" +
        "  Copy .env.example to .env.local and fill it in — see SUPABASE_SETUP.md.",
    );
  }

  const values = {};
  for (const rawLine of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    // Strip one layer of surrounding quotes, if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function fatal(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** Never print the password, even in an error. */
function redact(url) {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:********@");
}

function checkDbUrl(url) {
  if (!url) {
    fatal(
      "SUPABASE_DB_URL is not set in .env.local.\n\n" +
        "  Supabase dashboard -> Connect -> Connection string -> Session pooler\n" +
        "  Replace [YOUR-PASSWORD] with your database password.\n\n" +
        "  Full instructions: SUPABASE_SETUP.md, section 6.",
    );
  }
  if (url.includes("[YOUR-PASSWORD]")) {
    fatal(
      "SUPABASE_DB_URL still contains the [YOUR-PASSWORD] placeholder.\n" +
        "  Replace it (square brackets included) with your actual database password.",
    );
  }
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    fatal(`SUPABASE_DB_URL does not look like a connection string: ${redact(url)}`);
  }
  // The direct-connection host is IPv6-only on new projects and simply hangs
  // on most IPv4 networks. Warn rather than block — some networks are fine.
  if (/@db\.[a-z0-9]+\.supabase\.co/.test(url)) {
    console.warn(
      "\n  Note: this is the 'Direct connection' string, which is IPv6-only on\n" +
        "  new projects. If it times out, switch to the Session pooler string.\n",
    );
  }
}

const COMMANDS = {
  push: (url) => ["db", "push", "--db-url", url],
  seed: (url) => ["db", "push", "--include-seed", "--db-url", url],
  status: (url) => ["migration", "list", "--db-url", url],
  types: (url) => ["gen", "types", "typescript", "--db-url", url],
};

const command = process.argv[2];

if (!command || !(command in COMMANDS)) {
  fatal(`Usage: node scripts/db.mjs <${Object.keys(COMMANDS).join("|")}>`);
}

const env = loadEnvLocal();
const dbUrl = env.SUPABASE_DB_URL;
checkDbUrl(dbUrl);

const args = COMMANDS[command](dbUrl);

console.log(`\nsupabase ${args.map((a) => (a === dbUrl ? redact(a) : a)).join(" ")}\n`);

// `types` writes the schema to stdout, so it must be captured, not inherited.
const capture = command === "types";

const result = spawnSync("npx", ["--yes", "supabase", ...args], {
  stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
  shell: process.platform === "win32",
  encoding: "utf8",
});

if (result.error) {
  fatal(`Could not run the Supabase CLI: ${result.error.message}`);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (capture && result.stdout) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync("types/database.ts", result.stdout);
  console.log("Wrote types/database.ts");
}
