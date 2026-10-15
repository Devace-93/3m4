/**
 * Demo for the footer / theme / language PR: captioned frames + webm.
 *   cd e2e && bun run scripts/record-i18n-demo.ts [outDir]
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const OUT = process.argv[2] ?? join(import.meta.dir, "..", "demo-frames-i18n");
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
        position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "99999", padding: "14px 24px",
        background: "rgba(15,23,42,.92)", color: "#fff", font: "600 20px/1.3 system-ui, sans-serif",
        textAlign: "center", direction: "ltr",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}
async function shot(page: Page, text: string, hold = 1600) {
  await caption(page, text);
  await page.waitForTimeout(250);
  const file = join(OUT, `frame-${String(n++).padStart(3, "0")}.png`);
  await page.screenshot({ path: file });
  frames.push({ file, hold });
  await page.waitForTimeout(hold);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const toggle = () => page.locator("header button[data-theme-toggle]").first();
const picker = () => page.locator("header [data-lang-picker]").first();

await page.goto(`${BASE}/`);
await page.waitForSelector("h1");
await shot(page, "Same footer as the other 3m4 apps: author · source · info.3m4.net", 1200);
await page.locator("footer").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot(page, "Same footer as the other 3m4 apps: author · source · info.3m4.net", 2200);
await page.evaluate(() => window.scrollTo(0, 0));

await shot(page, "Theme picker: follows the system until you choose…", 1400);
await toggle().click();
await page.waitForTimeout(300);
await shot(page, "…one click for dark mode, remembered across 3m4 apps (localStorage 3m4.theme)", 2400);
await page.locator("#mcp").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot(page, "Every page gets the dark palette: cards, code panels, forms, charts", 2200);
await page.evaluate(() => window.scrollTo(0, 0));

await picker().getByRole("button").first().click();
await page.waitForTimeout(300);
await shot(page, "Language picker: the same 34 locales as kinegram, bubbles and info.3m4.net", 2200);
await picker().getByRole("searchbox").pressSequentially("esp", { delay: 60 });
await page.waitForTimeout(300);
await shot(page, "Search by name, code or country", 1400);
await picker().getByRole("option").filter({ hasText: "Español (México)" }).click();
await page.waitForSelector("text=Enlaces cortos");
await shot(page, "Español (México): the whole UI switches instantly", 2400);

for (const [code, label, hint] of [
  ["ja-JP", "日本語", "Japanese"],
  ["ar-SA", "العربية", "Arabic flips the layout to right-to-left"],
]) {
  await picker().getByRole("button").first().click();
  await picker().getByRole("searchbox").pressSequentially(code.slice(0, 2), { delay: 60 });
  await picker().getByRole("option").filter({ hasText: label }).first().click();
  await page.waitForTimeout(600);
  await shot(page, `${hint}: 287 strings × 22 languages, checked by \`bun run check:i18n\``, 2400);
}

await page.goto(`${BASE}/login`);
await page.waitForSelector("form");
await shot(page, "Auth and dashboard pages are translated too (preference persists on reload)", 2400);

await toggle().click();
await page.waitForTimeout(300);
await picker().getByRole("button").first().click();
await picker().getByRole("searchbox").pressSequentially("en-US", { delay: 60 });
await picker().getByRole("option").first().click();
await page.waitForTimeout(500);
await shot(page, "Back to light + English. Open for review.", 2000);

const video = page.video();
await ctx.close();
await browser.close();
if (video) renameSync(await video.path(), join(OUT, "demo.webm"));
writeFileSync(join(OUT, "frames.json"), JSON.stringify(frames, null, 2));
console.log(`captured ${frames.length} frames + demo.webm in ${OUT}`);
