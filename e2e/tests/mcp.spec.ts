import { test, expect } from "@playwright/test";
import {
  ALL_MCP_TOOLS,
  createApiKey,
  mcpCall,
  mcpRpc,
  MCP_INIT_PARAMS,
  registerAccount,
  uniqueUrl,
  type Account,
} from "../helpers";

/**
 * Remote MCP endpoint (Streamable HTTP at POST /mcp): auth, role-filtered tool
 * list, and a tools/call round trip with structuredContent.
 */
test.describe("MCP over HTTP", () => {
  let account: Account;
  let viewerKey: string;
  let adminKey: string;

  test.beforeAll(async ({ request }) => {
    account = await registerAccount(request);
    viewerKey = (await createApiKey(request, account, "mcp viewer", "viewer")).key;
    adminKey = (await createApiKey(request, account, "mcp admin", "admin")).key;
  });

  test("@critical rejects requests without a key", async ({ request }) => {
    const res = await mcpRpc(request, "initialize", MCP_INIT_PARAMS);
    expect(res.status).toBe(401);
    expect(res.messages[0]?.error?.message ?? res.raw).toMatch(/api key/i);
  });

  test("@critical rejects a bogus key", async ({ request }) => {
    const res = await mcpRpc(request, "initialize", MCP_INIT_PARAMS, { apiKey: "m4_live_not_a_real_key" });
    expect(res.status).toBe(401);
  });

  test("@critical viewer key: tool list excludes create_link and delete_link", async ({ request }) => {
    const msg = await mcpCall(request, viewerKey, "tools/list");
    const names = (msg.result.tools as Array<{ name: string }>).map((t) => t.name).sort();
    expect(names).toEqual(
      ["list_links", "get_link", "get_link_analytics", "get_account_overview", "get_usage"].sort(),
    );
    expect(names).not.toContain("create_link");
    expect(names).not.toContain("delete_link");
  });

  test("@critical admin key: tool list includes all 9 tools", async ({ request }) => {
    const msg = await mcpCall(request, adminKey, "tools/list");
    const names = (msg.result.tools as Array<{ name: string }>).map((t) => t.name).sort();
    expect(names).toEqual([...ALL_MCP_TOOLS].sort());
  });

  test("initialize instructions mention the key's role", async ({ request }) => {
    const init = await mcpRpc(request, "initialize", MCP_INIT_PARAMS, { apiKey: viewerKey });
    expect(init.status).toBe(200);
    expect(init.messages[0].result.instructions).toContain('role "viewer"');
  });

  test("@critical tools/call create_link returns structuredContent with short_code", async ({ request }) => {
    const destination = uniqueUrl();
    const msg = await mcpCall(request, adminKey, "tools/call", {
      name: "create_link",
      arguments: { destination_url: destination },
    });
    expect(msg.error, JSON.stringify(msg)).toBeUndefined();
    expect(msg.result.isError, JSON.stringify(msg.result)).toBeFalsy();
    const sc = msg.result.structuredContent;
    expect(sc.short_code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sc.destination_url).toBe(destination);
    expect(sc.short_url).toContain(`/${sc.short_code}`);

    // The link is visible through list_links too.
    const list = await mcpCall(request, adminKey, "tools/call", {
      name: "list_links",
      arguments: { q: sc.short_code },
    });
    const items = list.result.structuredContent.items as Array<{ short_code: string }>;
    expect(items.map((i) => i.short_code)).toContain(sc.short_code);
  });

  test("viewer key: calling create_link is refused", async ({ request }) => {
    const msg = await mcpCall(request, viewerKey, "tools/call", {
      name: "create_link",
      arguments: { destination_url: uniqueUrl() },
    });
    // Either a JSON-RPC error (unknown tool) or an isError result — never a created link.
    const text = JSON.stringify(msg);
    expect(msg.result?.structuredContent?.short_code).toBeUndefined();
    expect(msg.error || msg.result?.isError, text).toBeTruthy();
  });
});
