import { test, expect } from "@playwright/test";
import { ACCESS_KEY, PASSWORD, registerAccount, uniqueEmail } from "../helpers";

/**
 * Sign-up → dashboard → marketing nav reflects the session across pages →
 * log out from the marketing nav → log in again. One account per run.
 */
test.describe("auth + session", () => {
  test("@critical sign up, keep the session across marketing pages, log out, log in", async ({ page }) => {
    const email = uniqueEmail();

    // Sign up through the UI.
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.getByRole("heading", { name: "Your links" })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), ACCESS_KEY)).toBeTruthy();

    // Marketing nav resolves the session client-side on every page.
    const authBox = page.getByRole("banner").locator("[data-auth-state]");
    for (const path of ["/", "/blog", "/"]) {
      await page.goto(path);
      await expect(authBox).toHaveAttribute("data-auth-state", "true");
      await expect(authBox.getByRole("link", { name: "Dashboard" })).toBeVisible();
      await expect(authBox.getByRole("button", { name: "Log out" })).toBeVisible();
      await expect(authBox.getByRole("link", { name: "Log in" })).toHaveCount(0);
    }

    // Log out from the marketing nav.
    await authBox.getByRole("button", { name: "Log out" }).click();
    await expect(authBox).toHaveAttribute("data-auth-state", "false");
    await expect(authBox.getByRole("link", { name: "Log in" })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), ACCESS_KEY)).toBeNull();

    // Dashboard is now guarded.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\/?$/);

    // Log in again.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.getByRole("heading", { name: "Your links" })).toBeVisible();
  });

  test("login rejects a wrong password", async ({ page, request }) => {
    const account = await registerAccount(request);
    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.locator("form").getByText(/invalid|incorrect|wrong|failed/i)).toBeVisible();
  });
});
