/**
 * Scripted product demo: drives the running local stack with Playwright,
 * records a video (Playwright's built-in recorder, webm) and captures
 * captioned still frames. `make-gif.py` turns the frames into docs/demo.gif;
 * the webm is written next to them as demo.webm (convert with ffmpeg if you
 * need mp4).
 *
 *   cd e2e && bun run scripts/record-demo.ts [outDir]
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const OUT = process.argv[2] ?? join(import.meta.dir, "..", "demo-frames");
mkdirSync(OUT, { recursive: true });

const frames: { file: string; hold: number }[] = [];
let n = 0;

async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      Object.assign(el.style, {
        position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "99999",
        padding: "14px 24px", background: "rgba(15,23,42,.92)", color: "#fff",
        font: "600 20px/1.3 system-ui, sans-serif", textAlign: "center",
        letterSpacing: ".01em",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

/**
 * Capture one frame; `hold` is how long the GIF shows it (ms). The video
 * keeps rolling, so we also pause for `hold` to give viewers time to read.
 */
async function shot(page: Page, text: string, hold = 1600) {
  await caption(page, text);
  await page.waitForTimeout(250);
  const file = join(OUT, `frame-${String(n++).padStart(3, "0")}.png`);
  await page.screenshot({ path: file });
  frames.push({ file, hold });
  await page.waitForTimeout(hold);
}

async function typeInto(page: Page, selector: string, value: string, text: string) {
  await page.fill(selector, "");
  await page.locator(selector).pressSequentially(value, { delay: 35 });
  await shot(page, text, 900);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
const ts = Date.now().toString(36);
const email = `demo+${ts}@example.com`;
const password = "Demo-Passw0rd!";

// 1. Landing
await page.goto(`${BASE}/`);
await page.waitForSelector("text=Short links with");
await shot(page, "3m4: open-source URL shortener with real click analytics", 2200);
await page.locator("#mcp").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot(page, "New: an MCP server so Claude Code, Cursor or any agent can manage your links", 2600);

// 2. Sign up
await page.goto(`${BASE}/signup`);
await page.waitForSelector("input[type=email]");
await shot(page, "Sign up. Early access: every account gets full access, free", 1500);
await typeInto(page, "input[type=email]", email, "Sign up. Early access: every account gets full access, free");
await page.fill("input[type=password]", password);
await page.locator("button[type=submit]").click();
await page.waitForURL(/\/dashboard/);
await page.waitForSelector("text=Create link");
await shot(page, "The dashboard. Early-access banner, no plans to pick", 2000);

// 3. Create a link
await typeInto(page, "#dest", "https://modelcontextprotocol.io/specification/latest", "Paste a long URL…");
await page.fill("#slug", `launch-${ts.slice(-4)}`);
await page.fill("#title", "MCP spec");
await shot(page, "…add a custom slug and a title", 1300);
await page.locator("button[type=submit]:has-text('Create link')").click();
await page.waitForSelector(`text=launch-${ts.slice(-4)}`);
await shot(page, "Short link created", 1800);

// 4. Link detail: QR + clicks
const row = page.locator("tbody tr").first();
const href = await row.locator("a[href^='/dashboard/links/']").first().getAttribute("href");
const shortUrl = await row.locator("a[href^='/dashboard/links/']").first().innerText();
const linkId = href!.split("/").pop()!;
// Generate a few clicks through the real redirect service.
const api = await browser.newContext();
for (let i = 0; i < 3; i++) {
  await api.request.get(`http://${shortUrl.trim()}`, { maxRedirects: 0, headers: { "User-Agent": i ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" : "Mozilla/5.0 (Windows NT 10.0)" } });
}
await api.close();
await page.goto(`${BASE}${href}`);
await page.waitForSelector("img[alt^='QR code']");
await shot(page, "Every link ships with a QR code", 1800);
// Wait for the async worker to count the clicks.
const token = await page.evaluate(() => localStorage.getItem("3m4_access_token"));
for (let i = 0; i < 30; i++) {
  const r = await page.request.get(`${BASE}/api/links/${linkId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (((await r.json()).click_count ?? 0) >= 3) break;
  await page.waitForTimeout(500);
}
await page.reload();
await page.waitForSelector("img[alt^='QR code']");
await page.waitForTimeout(600);
await shot(page, "Clicks are tracked: daily series, countries, devices, referrers (no raw IPs stored)", 2600);

// 5. API keys with roles
await page.goto(`${BASE}/dashboard/settings`);
await page.waitForSelector("#keyname");
await typeInto(page, "#keyname", "claude-code", "API keys carry a role: viewer, editor or admin");
await page.selectOption("#keyrole", "viewer");
await page.waitForTimeout(200);
await shot(page, "A viewer key can read links and analytics, nothing else", 1600);
await page.locator("button[type=submit]:has-text('Create key')").click();
await page.waitForSelector("text=Copy your new key now");
await shot(page, "The secret is shown once. Roles are enforced by the API and mirrored by the MCP server", 2600);

// 6. Back to the MCP pitch
await page.goto(`${BASE}/#mcp`);
await page.locator("#mcp").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot(page, "claude mcp add 3m4 … then: “shorten this URL and give me the QR”", 3000);

const video = page.video();
await ctx.close();
await browser.close();
if (video) {
  const recorded = await video.path();
  renameSync(recorded, join(OUT, "demo.webm"));
}
writeFileSync(join(OUT, "frames.json"), JSON.stringify(frames, null, 2));
console.log(`captured ${frames.length} frames${video ? " + demo.webm" : ""} in ${OUT}`);
