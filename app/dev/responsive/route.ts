import { notFound } from "next/navigation";

import { devRoutesEnabled } from "@/lib/utils";

/**
 * DEVELOPMENT ONLY — a responsive test harness. 404s in production.
 *
 * WHY THIS EXISTS
 *
 * Headless Chrome on Windows will not give you a viewport narrower than
 * 512px: ask for 375 and you get 512, so a screenshot looks cropped and a
 * measurement is simply wrong. Device emulation in devtools is manual, and
 * `--window-size` is the only knob a script has.
 *
 * An iframe has no such limit. This page loads the target route in iframes
 * of exactly the widths the spec names (§12), and because the harness is
 * served from the same origin it can reach into each one and measure the
 * real layout.
 *
 * It reports two things per width:
 *   scrollWidth vs clientWidth — anything wider than the viewport
 *   the widest element         — so a failure names the culprit
 *
 *   GET /dev/responsive?path=/checkout
 */

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!devRoutesEnabled()) notFound();

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "/";

  // Only same-origin paths. Without this the harness would happily frame
  // any site and measure it, which is not its job.
  if (!path.startsWith("/") || path.startsWith("//")) {
    return new Response("path must be a same-origin path beginning with /", { status: 400 });
  }

  const html = `<!doctype html>
<html lang="en" data-status="loading">
<head><meta charset="utf-8"><title>Responsive harness</title>
<style>
  body { margin: 0; font: 13px system-ui; background: #111; color: #eee; }
  .row { display: flex; gap: 8px; align-items: flex-start; padding: 8px; }
  iframe { border: 1px solid #444; height: 900px; background: #000; }
  .label { position: sticky; top: 0; }
</style>
</head>
<body>
<div class="row">
${WIDTHS.map(
  (w) => `  <div><div class="label">${w}px</div>
    <iframe data-width="${w}" width="${w}" src="${path}" loading="eager"></iframe></div>`,
).join("\n")}
</div>
<script>
(function () {
  var frames = Array.prototype.slice.call(document.querySelectorAll("iframe"));
  var pending = frames.length;

  function measure(frame) {
    var width = Number(frame.getAttribute("data-width"));
    try {
      var doc = frame.contentDocument;
      var el = doc.documentElement;
      var offenders = [];
      Array.prototype.forEach.call(doc.querySelectorAll("body *"), function (node) {
        var r = node.getBoundingClientRect();
        var internal = node.scrollWidth > node.clientWidth + 1;
        if (r.width > 0 && (Math.round(r.right) > width + 1 || internal)) {
          offenders.push({
            tag: node.tagName,
            cls: String(node.className || "").slice(0, 70),
            right: Math.round(r.right),
            w: Math.round(r.width),
            text: (node.textContent || "").trim().slice(0, 40),
            depth: (function () { var d = 0, n = node; while ((n = n.parentElement)) d++; return d; })(),
            internal: internal ? node.scrollWidth + ">" + node.clientWidth : "",
          });
        }
      });
      // Deepest first: the innermost element that sticks out is the one
      // actually doing it; its ancestors are just being dragged along.
      offenders.sort(function (a, b) { return b.depth - a.depth; });
      var worst = offenders[0] || { tag: "", cls: "", right: 0 };

      return {
        width: width,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        overflow: Math.max(0, el.scrollWidth - el.clientWidth),
        worst: worst,
        offenders: offenders.slice(0, 6),
        bodyScroll: doc.body.scrollWidth,
      };
    } catch (error) {
      return { width: width, error: String(error) };
    }
  }

  function done() {
    var results = frames.map(measure);
    document.documentElement.setAttribute("data-results", JSON.stringify(results));
    document.documentElement.setAttribute("data-status", "ready");
  }

  frames.forEach(function (frame) {
    frame.addEventListener("load", function () {
      pending -= 1;
      // A little slack after load so fonts and any client rendering settle
      // before anything is measured.
      if (pending === 0) setTimeout(done, 1200);
    });
  });

  // Never hang: report whatever is there rather than sitting at "loading".
  setTimeout(done, 15000);
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
