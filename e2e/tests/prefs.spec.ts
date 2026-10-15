import { test, expect } from "@playwright/test";

/**
 * Footer, theme toggle and language picker: the same controls and options as
 * the other 3m4 apps (info.3m4.net, kinegram, bubbles). Preferences persist in
 * localStorage under the shared keys `3m4.theme` / `3m4.lang`.
 */
test.describe("shared chrome: footer, theme, language", () => {
  test("footer credits the author and links source + apps index", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Made by Enrique Magallón" })).toHaveAttribute(
      "href",
      /linkedin\.com\/in\/enrique-magallon/,
    );
    await expect(footer.getByRole("link", { name: "Source" })).toHaveAttribute(
      "href",
      "https://github.com/Devace-93/3m4",
    );
    await expect(footer.getByRole("link", { name: "info.3m4.net" })).toHaveAttribute(
      "href",
      /info\.3m4\.net/,
    );
  });

  test("@critical theme toggle switches to dark and persists", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("header nav button[data-theme-toggle]").first();
    await expect(toggle).toHaveText("🌙"); // light by default in the test browser
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveText("☀️");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(11, 18, 32)");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => localStorage.getItem("3m4.theme"))).toBe("dark");

    await page.locator("header nav button[data-theme-toggle]").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("@critical language picker lists the shared locales, searches and persists", async ({ page }) => {
    await page.goto("/");
    const picker = page.locator("header nav [data-lang-picker]").first();
    await expect(picker.getByRole("button", { name: "Language" })).toContainText("English (US)");
    await picker.getByRole("button", { name: "Language" }).click();
    const options = picker.getByRole("option");
    await expect(options).toHaveCount(34); // same list as info.3m4.net / kinegram / bubbles
    await picker.getByRole("searchbox").fill("mex");
    await expect(options).toHaveCount(1);
    await options.first().click();

    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
    await expect(picker.getByRole("button", { name: /idioma|language/i })).toContainText("Español (México)");
    expect(await page.evaluate(() => localStorage.getItem("3m4.lang"))).toBe("es-MX");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");

    // Arabic flips the document direction.
    await page.evaluate(() => localStorage.setItem("3m4.lang", "ar-SA"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});
