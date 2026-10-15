import { test, expect } from "@playwright/test";
import { API_URL, jwtHeaders, registerAccount, seedSession, type Account } from "../helpers";

/** early-access flag ON: unlimited limits and no plan/billing surfaces. */
test.describe("early access", () => {
  let account: Account;

  test.beforeAll(async ({ request }) => {
    account = await registerAccount(request);
  });

  test("flags endpoint reports early-access on", async ({ request }) => {
    const res = await request.get(`${API_URL}/flags`);
    expect(res.status()).toBe(200);
    expect((await res.json()).flags["early-access"]).toBe(true);
  });

  test("/auth/me grants unlimited links and clicks", async ({ request }) => {
    const res = await request.get(`${API_URL}/auth/me`, { headers: jwtHeaders(account) });
    expect(res.status()).toBe(200);
    const me = await res.json();
    expect(me.limits.links_per_month).toBe(-1);
    expect(me.limits.tracked_clicks_per_month).toBe(-1);
    expect(me.limits.custom_slugs).toBe(true);
    expect(me.flags["early-access"]).toBe(true);
  });

  test("dashboard shows the early-access banner and no upgrade button", async ({ page }) => {
    await seedSession(page, account);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your links" })).toBeVisible();
    const banner = page.getByRole("status").filter({ hasText: "Early access." });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "What paid plans will include" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Upgrade plan" })).toHaveCount(0);
    // Billing entry is hidden from the dashboard nav too.
    await expect(page.getByRole("banner").getByRole("link", { name: "Billing" })).toHaveCount(0);
  });
});
