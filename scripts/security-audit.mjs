/**
 * Static security audit.
 *
 *   npm run audit:security
 *
 * Checks the invariants the build spec calls non-negotiable, by reading the
 * source rather than trusting that they are still true. Run it before every
 * deploy — most of these are things that stay correct until someone adds a
 * file in a hurry.
 *
 * It cannot prove the system is secure. It can prove that the specific ways
 * this system was designed not to fail are still in place.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", ".mail", ".test-build", "reference"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const allFiles = walk(ROOT);
const sourceFiles = allFiles.filter((f) => [".ts", ".tsx", ".mjs", ".js"].includes(extname(f)));
const read = (f) => readFileSync(f, "utf8");
const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");

let pass = 0;
let fail = 0;
const failures = [];

function check(ok, label, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n=== 1. Secrets never reach the browser ===");

// Anything importing the service-role client, or reading the key, must be
// server-only — otherwise the key ends up in a JavaScript bundle.
const clientFiles = sourceFiles.filter((f) => read(f).startsWith('"use client"'));
const clientLeaks = clientFiles.filter((f) => {
  const src = read(f);
  return (
    src.includes("supabase/admin") ||
    src.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    src.includes("PAYMENT_CONFIRM_SECRET") ||
    src.includes("RESEND_API_KEY") ||
    /from "@\/lib\/env"/.test(src)
  );
});
check(clientLeaks.length === 0, "No client component touches a server secret", clientLeaks.map(rel).join(", "));

const guardedModules = [
  "lib/supabase/admin.ts",
  "lib/supabase/server.ts",
  "lib/env.ts",
  "lib/rateLimit.ts",
  "lib/turnstile.ts",
];
const unguarded = guardedModules.filter((m) => !read(join(ROOT, m)).includes('import "server-only"'));
check(unguarded.length === 0, "Secret-bearing modules import server-only", unguarded.join(", "));

console.log("\n=== 2. Admin access is checked on the server, everywhere ===");

// Every page and action under app/admin must call requireAdmin itself.
// Relying on a layout is the classic hole: a layout does not run for a
// server action, so the action is reachable without ever passing a guard.
const adminFiles = sourceFiles.filter(
  (f) => rel(f).startsWith("app/admin/") && /\/(page|actions)\.tsx?$/.test(rel(f)),
);
const missingGuard = adminFiles.filter((f) => {
  const src = read(f);
  if (rel(f).includes("/login/")) return false; // the login page must be reachable
  return !src.includes("requireAdmin");
});
check(missingGuard.length === 0, "Every admin page and action calls requireAdmin", missingGuard.map(rel).join(", "));

const adminApi = sourceFiles.filter((f) => rel(f).startsWith("app/api/admin/"));
const missingApiGuard = adminApi.filter((f) => !read(f).includes("requireAdmin"));
check(missingApiGuard.length === 0, "Every admin API route calls requireAdmin", missingApiGuard.map(rel).join(", "));

console.log("\n=== 3. Only one thing can mark an order paid ===");

// Looks for an actual WRITE, not a mention. Sample data and status labels
// legitimately contain the word; what must not exist is application code
// putting PAID into the database, because only confirm_order_payment may.
const paidWriters = sourceFiles.filter((f) => {
  const src = read(f);
  return /\.(update|insert|upsert)\(\s*\{[^}]*status:\s*["']PAID["']/s.test(src);
});
check(
  paidWriters.length === 0,
  "No TypeScript writes an order status of PAID",
  paidWriters.map(rel).join(", "),
);

const sqlFiles = allFiles.filter((f) => extname(f) === ".sql");
const paidSql = sqlFiles.filter((f) => /set[\s\S]{0,80}status\s*=\s*'PAID'/i.test(read(f)));
check(
  paidSql.every((f) => rel(f).includes("confirm_payment") || rel(f).includes("refund_flag")),
  "Only the payment-confirmation migrations write PAID",
  paidSql.map(rel).join(", "),
);

console.log("\n=== 4. Every public write validates its input ===");

const publicActions = sourceFiles.filter((f) => {
  const r = rel(f);
  return (
    read(f).startsWith('"use server"') &&
    !r.startsWith("app/admin/") &&
    !r.startsWith("app/dev/")
  );
});
const unvalidated = publicActions.filter((f) => {
  const src = read(f);
  return !(src.includes("safeParse") || src.includes(".parse("));
});
check(unvalidated.length === 0, "Public server actions parse their input with Zod", unvalidated.map(rel).join(", "));

console.log("\n=== 5. Rate limiting where the spec requires it ===");

for (const [label, file] of [
  ["order creation", "app/checkout/actions.ts"],
  ["find-tickets", "app/find-tickets/actions.ts"],
  ["payment confirm", "app/api/payments/confirm/route.ts"],
  ["admin login", "app/admin/login/actions.ts"],
]) {
  check(read(join(ROOT, file)).includes("checkRateLimit"), `Rate limited: ${label}`);
}

console.log("\n=== 6. Pages that must not be indexed ===");

for (const [label, file] of [
  ["buyer tickets", "app/tickets/[accessToken]/page.tsx"],
  ["payment return", "app/payment/return/page.tsx"],
  ["admin overview", "app/admin/page.tsx"],
  ["admin login", "app/admin/login/page.tsx"],
]) {
  const src = read(join(ROOT, file));
  check(src.includes("noindexMetadata") || src.includes("robots"), `noindex: ${label}`);
}

console.log("\n=== 7. Security headers ===");

const config = read(join(ROOT, "next.config.ts"));
for (const header of [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
]) {
  check(config.includes(header), `Header configured: ${header}`);
}
// The header is conditional now: 'self' in development so the responsive
// harness can frame our own pages, 'none' in production. What matters is
// that PRODUCTION is 'none' — verify the non-dev branch specifically.
const framing = config.split("\n").find((line) => line.includes("frame-ancestors")) ?? "";
check(
  framing.includes("frame-ancestors 'none'") || framing.includes(`: "'none'"`),
  "CSP forbids framing in production",
  framing.trim(),
);
check(
  /X-Frame-Options", value: (isDev \? "SAMEORIGIN" : )?"DENY"/.test(config),
  "X-Frame-Options is DENY in production",
);
check(!/script-src[^;]*'unsafe-eval'(?![^;]*isDev)/.test(config.replace(/\n/g, " ")),
  "unsafe-eval is development only");

console.log("\n=== 8. Nothing sensitive is committed ===");

/**
 * What git actually has committed.
 *
 * Previously this guessed, by excluding any path starting with a dot —
 * which silently excluded .github/ entirely, so a key pasted into a CI
 * workflow would not have been noticed. It also had the opposite problem:
 * it could have scanned .env.local, which holds real keys and is correctly
 * never committed, and reported a leak that was not one.
 *
 * Asking git removes both mistakes: the question is "what would a stranger
 * see in this repository?", and only git knows the answer.
 */
const tracked = (() => {
  try {
    return execFileSync("git", ["ls-files"], { encoding: "utf8", cwd: ROOT })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => join(ROOT, line));
  } catch {
    console.log("  NOTE  not a git repository — falling back to scanning every file");
    return allFiles;
  }
})();
const envFiles = allFiles.filter((f) => /(^|\/)\.env($|\.)/.test(rel(f)));
const gitignore = readFileSync(join(ROOT, ".gitignore"), "utf8");

/** True when .gitignore has a rule that would cover this path. */
function gitignoreCovers(path) {
  const name = path.split("/").pop() ?? path;
  return gitignore.split("\n").some((line) => {
    const rule = line.trim();
    if (!rule || rule.startsWith("#") || rule.startsWith("!")) return false;
    if (rule.endsWith("*")) return name.startsWith(rule.slice(0, -1));
    return name === rule || path === rule;
  });
}

// .env.example is meant to be committed; anything else holds real values.
const secretEnv = envFiles.filter((f) => !rel(f).endsWith(".env.example"));
check(
  secretEnv.every((f) => gitignoreCovers(rel(f))),
  "Every env file holding values is gitignored",
  secretEnv.map(rel).join(", ") || "none present",
);

check(gitignore.includes(".env*"), ".gitignore excludes .env files");
check(gitignore.includes(".mail"), ".gitignore excludes the local mail outbox");

// Includes .yml and .yaml: a CI workflow is one of the likelier places
// for someone to paste a key, and leaving it unscanned was a blind spot.
const SCANNED = [".ts", ".tsx", ".md", ".json", ".sql", ".mjs", ".yml", ".yaml"];

/**
 * A real secret, not a stand-in.
 *
 * Placeholders are everywhere in documentation and CI, and an audit that
 * flags them every run is an audit people learn to ignore. Real keys are
 * long and random; "sb_secret_ci_placeholder" is neither.
 */
function looksLikeRealSecret(value) {
  if (/placeholder|example|your[-_]?key|xxx|\.\.\./i.test(value)) return false;
  const body = value.replace(/^(sb_secret_|ghp_|github_pat_|re_)/, "");
  if (body.length < 16) return false;
  // Random strings mix cases and digits; a hand-written stand-in rarely does.
  return /[A-Z]/.test(body) && /[a-z]/.test(body) && /[0-9]/.test(body);
}

const secretPattern = /(sb_secret_|ghp_|github_pat_|re_)[A-Za-z0-9_-]{8,}/g;
const leaky = tracked
  .filter((f) => SCANNED.includes(extname(f)))
  // This file necessarily contains the patterns it searches for.
  .filter((f) => rel(f) !== "scripts/security-audit.mjs")
  .filter((f) => (read(f).match(secretPattern) ?? []).some(looksLikeRealSecret));
check(leaky.length === 0, "No live-looking secret in any source file", leaky.map(rel).join(", "));

console.log("\n=== 9. Raw errors are not shown to users ===");

// A caught database error printed straight to the page leaks table names
// and query shapes. Every service logs the detail and returns a sentence.
const publicPages = sourceFiles.filter((f) => {
  const r = rel(f);
  return r.startsWith("app/") && !r.startsWith("app/admin/") && r.endsWith("page.tsx");
});
const leakyPages = publicPages.filter((f) => /\{\s*\w*[eE]rror\.message\s*\}/.test(read(f)));
check(leakyPages.length === 0, "No public page renders a raw error message", leakyPages.map(rel).join(", "));

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(fail ? 1 : 0);
