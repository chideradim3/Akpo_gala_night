/**
 * Responsive audit.
 *
 *   npm run audit:responsive
 *
 * Loads every public route at every width the spec names (§12) and
 * measures the real layout, rather than judging a screenshot. Reports any
 * page whose content is wider than its viewport, and names the element
 * responsible so the fix is obvious.
 *
 * Needs `npm run dev` running. Admin routes are skipped: they are behind
 * two-factor authentication and cannot be framed without a session.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error("\nNo Chrome or Edge found. Install one, or set the path in this script.\n");
  process.exit(1);
}

/** Public routes. `--path` overrides, e.g. for a ticket page with a token. */
const ROUTES = process.argv.includes("--path")
  ? [process.argv[process.argv.indexOf("--path") + 1]]
  : ["/", "/checkout", "/find-tickets", "/admin/login", "/design"];

const tmp = mkdtempSync(join(tmpdir(), "resp-"));

function harness(path) {
  const url = `${BASE}/dev/responsive?path=${encodeURIComponent(path)}`;
  const out = execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1600,1000",
      "--virtual-time-budget=25000",
      `--user-data-dir=${tmp}`,
      "--dump-dom",
      url,
    ],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120000,
      // Chrome writes unrelated USB and updater warnings to stderr on
      // Windows; they drown the actual results.
      stdio: ["ignore", "pipe", "ignore"],
    },
  );

  const match = /data-results="([^"]*)"/.exec(out);
  if (!match) return null;

  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

let problems = 0;
let checked = 0;

console.log(`\nMeasuring against ${BASE}\n`);

for (const route of ROUTES) {
  console.log(`── ${route} ──`);
  const results = harness(route);

  if (!results) {
    console.log("  could not measure (is the dev server running?)");
    problems += 1;
    continue;
  }

  for (const r of results) {
    checked += 1;
    if (r.error) {
      console.log(`  ${String(r.width).padStart(4)}px  error: ${r.error}`);
      problems += 1;
      continue;
    }

    // 1px of slack: sub-pixel rounding on a scaled layout is not a bug.
    const bad = r.overflow > 1;
    if (bad) problems += 1;

    console.log(
      `  ${String(r.width).padStart(4)}px  viewport ${String(r.clientWidth).padStart(4)}  content ${String(r.scrollWidth).padStart(4)}  ${bad ? `OVERFLOW by ${r.overflow}px` : "ok"}`,
    );
    if (bad) {
      for (const o of r.offenders ?? []) {
        console.log(
          `          <${o.tag}> w=${o.w} right=${o.right}  ${o.cls}` +
            (o.text ? `  "${o.text}"` : ""),
        );
      }
    }
  }
  console.log("");
}

writeFileSync(join(tmp, "done"), "");

console.log("─".repeat(60));
console.log(
  problems === 0
    ? `No horizontal overflow at any width. ${checked} measurements.`
    : `${problems} problem(s) across ${checked} measurements.`,
);
process.exit(problems ? 1 : 0);
