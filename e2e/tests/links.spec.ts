import { test, expect, type Page } from "@playwright/test";
import {
  API_URL,
  BASE_URL_SHORT,
  jwtHeaders,
  pollUntil,
  registerAccount,
  seedSession,
  uniqueUrl,
  type Account,
} from "../helpers";

/**
 * Create a link in the dashboard, follow the short URL (302), then see the
 * click reflected (QR, click_count, analytics summary). One account per file.
 */
test.describe("links", () => {
  let account: Account;

  test.beforeAll(async ({ request }) => {
    account = await registerAccount(request);
  });

  test.beforeEach(async ({ page }) => {
    await seedSession(page, account);
  });

  async function createLinkViaDashboard(page: Page, destination: string) {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your links" })).toBeVisible();
    await page.getByLabel("Destination URL").fill(destination);
    await page.getByRole("button", { name: "Create link" }).click();
    const row = page.getByRole("row").filter({ hasText: destination });
    await expect(row).toBeVisible();
    const shortLink = row.getByRole("link").first();
    const detailHref = await shortLink.getAttribute("href");
    const id = detailHref!.split("/").pop()!;
    const shortText = (await shortLink.textContent())!.trim();
    const code = shortText.split("/").pop()!;
    return { id, code, row };
  }

  test("@critical create a link, redirect, QR and click analytics", async ({ page, request }) => {
    const destination = uniqueUrl();
    const { id, code } = await createLinkViaDashboard(page, destination);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);

    // API view of the link agrees with the UI.
    const linkRes = await request.get(`${API_URL}/links/${id}`, { headers: jwtHeaders(account) });
    expect(linkRes.status()).toBe(200);
    const link = await linkRes.json();
    expect(link.short_code).toBe(code);
    expect(link.destination_url).toBe(destination);
    expect(link.short_url).toBe(`${BASE_URL_SHORT}/${code}`);

    // Short URL → 302 to destination.
    const redirect = await request.get(link.short_url, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers()["location"]).toBe(destination);

    // Detail page: QR image is loaded from the public QR route.
    await page.goto(`/dashboard/links/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();
    const qr = page.getByRole("img", { name: /QR code for/ });
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute("src", new RegExp(`/api/qr/${code}\\.png`));
    await expect
      .poll(() => qr.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Clicks are processed asynchronously by the worker: poll the API.
    const counted = await pollUntil(
      async () => (await request.get(`${API_URL}/links/${id}`, { headers: jwtHeaders(account) })).json(),
      (l) => l.click_count >= 1,
      { timeoutMs: 15_000 },
    );
    expect(counted.click_count).toBeGreaterThanOrEqual(1);

    const analytics = await (
      await request.get(`${API_URL}/links/${id}/analytics?range=7d`, { headers: jwtHeaders(account) })
    ).json();
    expect(analytics.summary.clicks).toBeGreaterThanOrEqual(1);

    // And the UI summary shows it after a reload.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();
    const clicksTile = page
      .getByText("Clicks", { exact: true })
      .locator("..")
      .locator("div")
      .first();
    await expect(clicksTile).toBeVisible();
    await expect(clicksTile).toHaveText(/^[1-9]\d*$/);
  });

  test("unknown short code is a 404, not a redirect", async ({ request }) => {
    const res = await request.get(`${BASE_URL_SHORT}/zz-no-such-code-${Date.now()}`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });
});
