import { test, expect, type Page } from "@playwright/test";
import {
  API_URL,
  keyHeaders,
  registerAccount,
  seedSession,
  uniqueUrl,
  type Account,
  type Role,
} from "../helpers";

/**
 * Create role-scoped keys in /dashboard/settings and verify the API enforces
 * the scopes (403 insufficient_scope vs 201), audits denials and mutations,
 * and reports the key's role/scopes on /apikeys/me.
 */
test.describe("API keys + RBAC", () => {
  let account: Account;
  const secrets: Partial<Record<Role, string>> = {};

  test.beforeAll(async ({ request }) => {
    account = await registerAccount(request);
  });

  async function createKeyViaUi(page: Page, name: string, role: Role): Promise<string> {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: "API keys" })).toBeVisible();
    await page.getByLabel("New key name").fill(name);
    await page.locator("#keyrole").selectOption(role);
    await page.getByRole("button", { name: "Create key" }).click();
    await expect(page.getByText("Copy your new key now")).toBeVisible();
    const secret = (await page.locator("code", { hasText: /^m4_live_/ }).first().textContent())!.trim();
    expect(secret).toMatch(/^m4_live_[A-Za-z0-9_-]+$/);
    // Key appears in the list with the right role.
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row).toContainText(role === "viewer" ? "Viewer" : role === "admin" ? "Admin" : "Editor");
    return secret;
  }

  test("@critical create viewer and admin keys in settings; scopes enforced by the API", async ({ page, request }) => {
    await seedSession(page, account);
    secrets.viewer = await createKeyViaUi(page, "e2e viewer", "viewer");
    secrets.admin = await createKeyViaUi(page, "e2e admin", "admin");
    expect(secrets.viewer).not.toBe(secrets.admin);

    // viewer: cannot create links.
    const denied = await request.post(`${API_URL}/links`, {
      headers: keyHeaders(secrets.viewer),
      data: { destination_url: uniqueUrl() },
    });
    expect(denied.status()).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody.error.code).toBe("insufficient_scope");
    expect(deniedBody.error.required_scope).toBe("links:write");
    expect(deniedBody.error.role).toBe("viewer");

    // viewer: can read.
    const list = await request.get(`${API_URL}/links`, { headers: keyHeaders(secrets.viewer) });
    expect(list.status()).toBe(200);

    // admin: can create.
    const destination = uniqueUrl();
    const created = await request.post(`${API_URL}/links`, {
      headers: keyHeaders(secrets.admin),
      data: { destination_url: destination },
    });
    expect(created.status(), await created.text()).toBe(201);
    const link = await created.json();
    expect(link.destination_url).toBe(destination);

    // Audit log (admin scope audit:read) contains the denial and the mutation.
    const audit = await request.get(`${API_URL}/account/audit?limit=50`, {
      headers: keyHeaders(secrets.admin),
    });
    expect(audit.status()).toBe(200);
    const events: Array<{ action: string; outcome: string; target_id?: string; meta?: any }> = (
      await audit.json()
    ).items;
    const deniedEvent = events.find((e) => e.action === "auth.denied");
    expect(deniedEvent, JSON.stringify(events)).toBeTruthy();
    expect(deniedEvent!.outcome).toBe("denied");
    const createEvent = events.find((e) => e.action === "link.create" && e.target_id === link.id);
    expect(createEvent, JSON.stringify(events)).toBeTruthy();
    expect(createEvent!.outcome).toBe("ok");

    // viewer cannot read the audit log.
    const auditDenied = await request.get(`${API_URL}/account/audit`, {
      headers: keyHeaders(secrets.viewer),
    });
    expect(auditDenied.status()).toBe(403);

    // /apikeys/me reports role + scopes for each key.
    const viewerMe = await (
      await request.get(`${API_URL}/apikeys/me`, { headers: keyHeaders(secrets.viewer) })
    ).json();
    expect(viewerMe.key.role).toBe("viewer");
    expect(viewerMe.scopes.sort()).toEqual(["analytics:read", "links:read", "usage:read"]);
    expect(viewerMe.account.id).toBe(account.accountId);

    const adminMe = await (
      await request.get(`${API_URL}/apikeys/me`, { headers: keyHeaders(secrets.admin) })
    ).json();
    expect(adminMe.key.role).toBe("admin");
    expect(adminMe.scopes.sort()).toEqual([
      "analytics:read",
      "audit:read",
      "links:delete",
      "links:read",
      "links:write",
      "usage:read",
    ]);
  });

  test("revoked key stops working", async ({ page, request }) => {
    await seedSession(page, account);
    const secret = await createKeyViaUi(page, "e2e revoke-me", "viewer");
    expect((await request.get(`${API_URL}/apikeys/me`, { headers: keyHeaders(secret) })).status()).toBe(200);
    const row = page.getByRole("row").filter({ hasText: "e2e revoke-me" });
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row).toHaveCount(0);
    expect((await request.get(`${API_URL}/apikeys/me`, { headers: keyHeaders(secret) })).status()).toBe(401);
  });
});
