import { test, expect } from "@playwright/test";

/**
 * Public marketing site with the current flag set:
 *   early-access=ON  → hero note + no "Pricing" nav link, /info/pricing notice
 *   projects=OFF     → no "Projects" nav link, /projects coming-soon state
 */
test.describe("marketing site", () => {
  test("home renders hero, MCP section and early-access note", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /short links with/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started free" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Let your AI agent manage links" }),
    ).toBeVisible();
    await expect(page.getByTestId("hero-plan-note")).toContainText("Early access");
  });

  test("nav hides Pricing (early-access on) and Projects (projects off)", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("banner").getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Blog" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sponsors" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pricing" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Projects" })).toHaveCount(0);
  });

  test("blog lists the early-access post and renders it", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
    const post = page.getByRole("link", { name: /what paid plans will include/i });
    await expect(post).toBeVisible();
    await post.click();
    await expect(page).toHaveURL(/\/blog\/what-paid-plans-will-include/);
    await expect(
      page.getByRole("heading", { name: "What will move under paid plans" }),
    ).toBeVisible();
  });

  test("blog post route renders directly", async ({ page }) => {
    await page.goto("/blog/what-paid-plans-will-include");
    await expect(
      page.getByRole("heading", { name: "What will move under paid plans" }),
    ).toBeVisible();
  });

  test("/projects shows the coming-soon state while the flag is off", async ({ page }) => {
    await page.goto("/projects");
    const hidden = page.getByTestId("projects-hidden");
    await expect(hidden).toBeVisible();
    await expect(hidden.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("/info/pricing shows the early-access pricing notice", async ({ page }) => {
    await page.goto("/info/pricing");
    await expect(page.getByTestId("early-access-pricing")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Planned pricing" })).toBeVisible();
  });
});
