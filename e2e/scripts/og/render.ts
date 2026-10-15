/** Render og-image.html to apps/web/public/og-image.png (1200×630). */
import { chromium } from "playwright";
import { join } from "node:path";
const dir = import.meta.dir;
const out = process.argv[2] ?? join(dir, "..", "..", "..", "apps", "web", "public", "og-image.png");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file://" + join(dir, "og-image.html"));
await page.waitForTimeout(300);
await page.screenshot({ path: out, type: "png" });
await browser.close();
console.log("wrote", out);
