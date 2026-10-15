/**
 * End-to-end tests over a real MCP client/server pair (in-memory transport)
 * against a fake 3m4 API. No network, no database.
 */
import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MemoryAuditSink } from "../src/audit.js";
import { M4Client } from "../src/client.js";
import { createM4Server } from "../src/server.js";
import type { KeyInfo, Link, Role, Scope } from "../src/types.js";

const ROLE_SCOPES: Record<Role, Scope[]> = {
  viewer: ["links:read", "analytics:read", "usage:read"],
  editor: ["links:read", "links:write", "analytics:read", "usage:read"],
  admin: ["links:read", "links:write", "links:delete", "analytics:read", "usage:read", "audit:read"],
};

const keyInfo = (role: Role): KeyInfo => ({
  account: { id: "acc-1", name: "Test", plan: "pro", created_at: "2026-01-01T00:00:00Z" },
  key: { id: "key-1", prefix: "m4_live_test", role },
  scopes: ROLE_SCOPES[role],
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Just enough of the 3m4 REST API to exercise every tool, with scope checks. */
class FakeApi {
  links = new Map<string, Link>();
  limitReached = false;
  calls: string[] = [];
  private n = 0;

  constructor(public role: Role) {}

  private need(scope: Scope): Response | null {
    return ROLE_SCOPES[this.role].includes(scope)
      ? null
      : json(403, { error: { code: "insufficient_scope", message: `lacks ${scope}`, required_scope: scope } });
  }

  fetch = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api/, "");
    this.calls.push(`${method} ${path}`);
    const headers = init?.headers as Record<string, string>;
    if (headers["X-API-Key"] !== "m4_live_test") return json(401, { error: { code: "unauthorized", message: "bad key" } });
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (path === "/apikeys/me") return json(200, keyInfo(this.role));
    if (path === "/links" && method === "GET") {
      return this.need("links:read") ?? json(200, { items: [...this.links.values()], page: 1, per_page: 20, total: this.links.size });
    }
    if (path === "/links" && method === "POST") {
      const denied = this.need("links:write");
      if (denied) return denied;
      if (this.limitReached) return json(402, { error: { code: "limit_reached", message: "Monthly link limit reached.", which: "links" } });
      this.n += 1;
      const link: Link = {
        id: crypto.randomUUID(),
        short_code: `c${this.n}`,
        short_url: `https://3m4.test/c${this.n}`,
        destination_url: body.destination_url,
        redirect_type: body.redirect_type ?? 302,
        title: body.title ?? null,
        active: true,
        expires_at: body.expires_at ?? null,
        created_at: "2026-10-14T00:00:00Z",
        click_count: 0,
      };
      this.links.set(link.id, link);
      return json(201, link);
    }
    const m = path.match(/^\/links\/([^/]+)(\/analytics)?$/);
    if (m) {
      const link = this.links.get(m[1]!);
      if (!link) return json(404, { error: { code: "not_found", message: "Link not found." } });
      if (m[2]) {
        return this.need("analytics:read") ?? json(200, {
          summary: { clicks: 3, uniques: null },
          series: [{ date: "2026-10-14", count: 3 }],
          by_country: [{ key: "MX", count: 3 }],
          by_device: [{ key: "mobile", count: 3 }],
          by_referrer: [],
        });
      }
      if (method === "GET") return this.need("links:read") ?? json(200, link);
      if (method === "PATCH") {
        const denied = this.need("links:write");
        if (denied) return denied;
        Object.assign(link, body);
        return json(200, link);
      }
      if (method === "DELETE") {
        const denied = this.need("links:delete");
        if (denied) return denied;
        this.links.delete(link.id);
        return new Response(null, { status: 204 });
      }
    }
    if (path === "/account/usage") {
      return this.need("usage:read") ?? json(200, {
        period_start: "2026-10-01", period_end: "2026-11-01", links_created: this.n, tracked_clicks: 0,
        limits: { links_per_month: 50, tracked_clicks_per_month: 1000 },
      });
    }
    if (path === "/analytics/overview") {
      return this.need("analytics:read") ?? json(200, { range_days: 7, summary: { clicks: 3, links: this.links.size }, series: [], top_links: [] });
    }
    if (path === "/account/audit") {
      // Mirror the real serializer exactly: clients validate structuredContent
      // against the output schema with additionalProperties=false.
      return this.need("audit:read") ?? json(200, {
        items: [{
          id: "ev-1", ts: "2026-10-14T00:00:00Z", actor_type: "api_key", actor_id: "key-1", actor_label: "m4_live_test",
          action: "link.create", target_type: "link", target_id: "l-1", outcome: "ok", meta: { short_code: "c1" },
        }],
      });
    }
    return json(404, { error: { code: "not_found", message: `no route ${method} ${path}` } });
  };
}

type Elicit = (message: string) => Promise<{ action: "accept" | "decline" | "cancel"; content?: Record<string, unknown> }>;

async function connect(role: Role, opts: { elicit?: Elicit; apiRole?: Role } = {}) {
  const api = new FakeApi(opts.apiRole ?? role);
  const client = new M4Client({ baseUrl: "http://fake/api", apiKey: "m4_live_test", fetch: api.fetch as typeof fetch });
  const audit = new MemoryAuditSink();
  const server = createM4Server({ client, keyInfo: keyInfo(role), audit, transport: "test" });

  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: opts.elicit ? { elicitation: { form: {} } } : {} });
  if (opts.elicit) mcp.setRequestHandler(ElicitRequestSchema, async (req) => opts.elicit!(req.params.message));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);

  const call = (name: string, args: Record<string, unknown> = {}) =>
    mcp.callTool({ name, arguments: args }) as Promise<CallToolResult>;
  const toolNames = async () => (await mcp.listTools()).tools.map((t) => t.name).sort();
  const textOf = (r: CallToolResult) => r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { api, mcp, audit, server, call, toolNames, textOf };
}

describe("RBAC: tool visibility follows the key's role", () => {
  test("viewer sees read-only tools", async () => {
    const { toolNames } = await connect("viewer");
    expect(await toolNames()).toEqual(["get_account_overview", "get_link", "get_link_analytics", "get_usage", "list_links"]);
  });

  test("editor adds create/update but not delete", async () => {
    const { toolNames } = await connect("editor");
    const names = await toolNames();
    expect(names).toContain("create_link");
    expect(names).toContain("update_link");
    expect(names).not.toContain("delete_link");
    expect(names).not.toContain("get_audit_log");
  });

  test("admin sees everything", async () => {
    const { toolNames } = await connect("admin");
    expect(await toolNames()).toHaveLength(9);
  });

  test("a hidden tool cannot be called", async () => {
    const { call, textOf, api } = await connect("viewer");
    const r = await call("create_link", { destination_url: "https://example.com" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/not found/i);
    expect(api.calls.filter((c) => c.startsWith("POST /links"))).toHaveLength(0);
  });

  test("the API's own scope check is surfaced as a denied result, not a crash", async () => {
    // Server believes it is admin, API says viewer (e.g. key downgraded after start).
    const { call, textOf, audit } = await connect("admin", { apiRole: "viewer" });
    const r = await call("create_link", { destination_url: "https://example.com" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("insufficient_scope");
    expect(audit.entries.at(-1)?.outcome).toBe("denied");
  });
});

describe("tools", () => {
  test("create_link returns structured content and audits the call", async () => {
    const { call, audit, api } = await connect("editor");
    const r = await call("create_link", { destination_url: "https://example.com/page", title: "Example" });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as Link;
    expect(sc.short_code).toBe("c1");
    expect(sc.destination_url).toBe("https://example.com/page");
    expect(api.links.size).toBe(1);
    const entry = audit.entries.find((e) => e.tool === "create_link");
    expect(entry?.outcome).toBe("ok");
    expect(entry?.actor.role).toBe("editor");
    expect(entry?.args?.destination_url).toBe("https://example.com/page");
  });

  test("invalid input is rejected before reaching the API", async () => {
    const { call, api } = await connect("editor");
    const r = await call("create_link", { destination_url: "not a url" });
    expect(r.isError).toBe(true);
    expect(api.calls.filter((c) => c.startsWith("POST /links"))).toHaveLength(0);
  });

  test("API errors become isError results with the stable code", async () => {
    const { call, textOf, api, audit } = await connect("editor");
    api.limitReached = true;
    const r = await call("create_link", { destination_url: "https://example.com" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("limit_reached");
    expect(textOf(r)).toContain('"which":"links"');
    expect(audit.entries.at(-1)?.error?.code).toBe("limit_reached");
  });

  test("list, update and analytics round-trip", async () => {
    const { call } = await connect("editor");
    const created = (await call("create_link", { destination_url: "https://example.com" })).structuredContent as Link;
    const updated = (await call("update_link", { id: created.id, title: "Renamed", active: false })).structuredContent as Link;
    expect(updated.title).toBe("Renamed");
    expect(updated.active).toBe(false);
    const list = (await call("list_links")).structuredContent as { total: number };
    expect(list.total).toBe(1);
    const a = (await call("get_link_analytics", { id: created.id, range: "30d" })).structuredContent as { summary: { clicks: number } };
    expect(a.summary.clicks).toBe(3);
  });

  test("get_audit_log returns schema-valid structured content", async () => {
    const { call, textOf } = await connect("admin");
    const r = await call("get_audit_log", { limit: 5 });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { items: unknown[] }).items).toHaveLength(1);
    expect(textOf(r)).toContain("link.create");
  });

  test("get_usage works for a viewer", async () => {
    const { call, textOf } = await connect("viewer");
    const r = await call("get_usage");
    expect(r.isError).toBeFalsy();
    expect(textOf(r)).toContain("/50 links");
  });
});

describe("delete_link requires human approval", () => {
  const seed = async (c: Awaited<ReturnType<typeof connect>>) =>
    (await c.call("create_link", { destination_url: "https://example.com/gone" })).structuredContent as Link;

  test("without elicitation support it refuses until confirm=true", async () => {
    const c = await connect("admin");
    const link = await seed(c);

    const refused = await c.call("delete_link", { id: link.id });
    expect(refused.isError).toBe(true);
    expect(c.textOf(refused)).toContain("confirmation_required");
    expect(c.api.links.has(link.id)).toBe(true);
    expect(c.audit.entries.at(-1)?.outcome).toBe("pending");

    const done = await c.call("delete_link", { id: link.id, confirm: true });
    expect(done.isError).toBeFalsy();
    expect((done.structuredContent as { deleted: boolean }).deleted).toBe(true);
    expect(c.api.links.has(link.id)).toBe(false);
    expect(c.audit.entries.at(-1)?.outcome).toBe("ok");
  });

  test("with elicitation, the user is asked and can accept", async () => {
    const asked: string[] = [];
    const c = await connect("admin", {
      elicit: async (message) => {
        asked.push(message);
        return { action: "accept", content: { confirm: true } };
      },
    });
    const link = await seed(c);
    const done = await c.call("delete_link", { id: link.id });
    expect(done.isError).toBeFalsy();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain(link.short_url);
    expect(c.api.links.has(link.id)).toBe(false);
  });

  test("with elicitation, declining cancels and nothing is deleted", async () => {
    const c = await connect("admin", { elicit: async () => ({ action: "decline" }) });
    const link = await seed(c);
    const r = await c.call("delete_link", { id: link.id });
    expect(c.textOf(r)).toContain("cancelled");
    expect(r.isError).toBeFalsy();
    expect(c.api.links.has(link.id)).toBe(true);
    expect(c.audit.entries.at(-1)?.outcome).toBe("cancelled");
    expect(c.api.calls.filter((x) => x.startsWith("DELETE"))).toHaveLength(0);
  });
});

describe("resources and prompts", () => {
  test("usage resource and link template are exposed for a viewer", async () => {
    const { mcp } = await connect("viewer");
    const res = await mcp.listResources();
    expect(res.resources.map((r) => r.uri)).toContain("m4://usage");
    const tpl = await mcp.listResourceTemplates();
    expect(tpl.resourceTemplates.map((t) => t.uriTemplate)).toContain("m4://links/{id}");
    const read = await mcp.readResource({ uri: "m4://usage" });
    expect(JSON.parse((read.contents[0] as { text: string }).text).links_created).toBe(0);
  });

  test("link_report prompt is available when analytics:read is granted", async () => {
    const { mcp } = await connect("viewer");
    const prompts = await mcp.listPrompts();
    expect(prompts.prompts.map((p) => p.name)).toContain("link_report");
    const got = await mcp.getPrompt({ name: "link_report", arguments: { range: "30d" } });
    expect((got.messages[0]!.content as { text: string }).text).toContain('range="30d"');
  });
});
