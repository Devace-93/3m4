/**
 * The 3m4 MCP server: tools, resources and prompts over the 3m4 REST API.
 *
 * Design notes (the parts worth reading before changing anything):
 *
 * - **RBAC, three layers.** The key's scopes (from `GET /apikeys/me`) decide
 *   which tools are *registered* (hidden tools are never listed), each handler
 *   re-checks its scope at call time, and the REST API enforces the same
 *   scopes independently. See `rbac.ts`.
 * - **Human approval for destructive actions.** `delete_link` asks the user
 *   through MCP *elicitation* when the client supports it (Claude Code, the
 *   Inspector). Otherwise it refuses until the model passes `confirm: true`,
 *   which forces the model to ask the user first.
 * - **Structured outputs.** Every tool declares an `outputSchema` and returns
 *   `structuredContent`, so hosts can validate and chain results without
 *   parsing prose.
 * - **Errors are results, not exceptions.** API errors come back as
 *   `isError: true` with the stable error code, so the model can recover
 *   (e.g. `limit_reached` → tell the user to upgrade) instead of crashing.
 * - **Everything is audited**, locally (`audit.ts`) and server-side.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { compactArgs, type AuditOutcome, type AuditSink } from "./audit.js";
import { M4ApiError, type M4Client } from "./client.js";
import { TOOL_SCOPES, hasScope, type ToolName } from "./rbac.js";
import type { KeyInfo, Scope } from "./types.js";
import { VERSION } from "./version.js";

export interface M4ServerOptions {
  client: M4Client;
  keyInfo: KeyInfo;
  audit: AuditSink;
  /** Label written to the audit log: "stdio" | "http". */
  transport?: string;
  /**
   * Whether `delete_link` may ask the user via elicitation. Only safe on a
   * transport with a persistent back-channel (stdio). Default: true.
   */
  allowElicitation?: boolean;
}

// --------------------------------------------------------------------------- //
// Output schemas (raw Zod shapes; the SDK wraps them in z.object)
// --------------------------------------------------------------------------- //
const linkShape = {
  id: z.string(),
  short_code: z.string(),
  short_url: z.string(),
  destination_url: z.string(),
  redirect_type: z.number(),
  title: z.string().nullable(),
  active: z.boolean(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  click_count: z.number(),
};
const linkObject = z.object(linkShape);
const bucket = z.object({ key: z.string(), count: z.number() });
const point = z.object({ date: z.string(), count: z.number() });
const rangeEnum = z
  .enum(["7d", "30d", "1y"])
  .describe("Time window: last 7 days, 30 days or 1 year.");
const linkId = z.uuid().describe("The link's id (UUID), as returned by list_links or create_link.");

/** A handler may return a plain result, or wrap it to record a non-"ok" audit outcome. */
type Wrapped = { result: CallToolResult; outcome: AuditOutcome };
type Handled = CallToolResult | Wrapped;

function isWrapped(out: Handled): out is Wrapped {
  return (
    typeof (out as Wrapped).outcome === "string" &&
    typeof (out as Wrapped).result === "object" &&
    !("content" in out)
  );
}

function text(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

function structured(value: Record<string, unknown>, summary?: string): CallToolResult {
  return {
    content: [{ type: "text", text: summary ?? JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(code: string, message: string, extra: Record<string, unknown> = {}): CallToolResult {
  const detail = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  return {
    content: [{ type: "text", text: `Error (${code}): ${message}${detail}` }],
    isError: true,
  };
}

export function buildInstructions(info: KeyInfo): string {
  return [
    `3m4 is a URL shortener with click analytics. You are acting for account "${info.account.name}" (plan: ${info.account.plan}).`,
    `This API key has role "${info.key.role}" with scopes: ${info.scopes.join(", ")}. Only tools allowed by those scopes are listed; if a user asks for something outside them, say the key lacks that permission instead of guessing.`,
    "Short links are served at the short_url returned by the tools. Links default to 302 redirects (every click tracked); use 301 only when the user explicitly wants a permanent/cached redirect.",
    "Deleting a link is irreversible: delete_link requires explicit user confirmation.",
  ].join("\n");
}

export function createM4Server(opts: M4ServerOptions): McpServer {
  const { client, keyInfo, audit } = opts;
  const transport = opts.transport ?? "unknown";
  const allowElicitation = opts.allowElicitation ?? true;
  const scopes = new Set<Scope>(keyInfo.scopes);
  const actor = { account: keyInfo.account.id, prefix: keyInfo.key.prefix, role: keyInfo.key.role };

  const server = new McpServer(
    { name: "3m4", version: VERSION },
    { instructions: buildInstructions(keyInfo) },
  );

  const log = (
    tool: ToolName,
    outcome: AuditOutcome,
    started: number,
    args?: unknown,
    extra: Partial<Pick<import("./audit.js").AuditEntry, "error" | "meta">> = {},
  ) =>
    audit.write({
      ts: new Date().toISOString(),
      event: "tool.call",
      transport,
      actor,
      tool,
      outcome,
      duration_ms: Date.now() - started,
      args: compactArgs(args),
      ...extra,
    });

  /**
   * Register a tool only if the key's scopes allow it, wrapping the handler
   * with the call-time scope re-check, error mapping and audit logging.
   */
  function tool<In extends z.ZodRawShape, Out extends z.ZodRawShape>(
    name: ToolName,
    config: {
      title: string;
      description: string;
      inputSchema: In;
      outputSchema?: Out;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
    },
    handler: (
      args: z.infer<z.ZodObject<In>>,
      extra: Parameters<Parameters<McpServer["registerTool"]>[2]>[1],
    ) => Promise<Handled>,
  ): void {
    const required = TOOL_SCOPES[name];
    if (!scopes.has(required)) return; // layer 1: never listed

    server.registerTool(
      name,
      {
        title: config.title,
        description: `${config.description} (requires scope ${required})`,
        inputSchema: config.inputSchema,
        outputSchema: config.outputSchema,
        annotations: { title: config.title, ...config.annotations },
      },
      (async (args: z.infer<z.ZodObject<In>>, extra: Parameters<typeof handler>[1]) => {
        const started = Date.now();
        if (!hasScope(scopes, required)) {
          // layer 2: refused even if somehow invoked
          log(name, "denied", started, args, { error: { code: "insufficient_scope", message: required } });
          return failure("insufficient_scope", `This key (role ${keyInfo.key.role}) lacks ${required}.`, {
            required_scope: required,
          });
        }
        try {
          const out = await handler(args, extra);
          if (isWrapped(out)) {
            log(name, out.outcome, started, args);
            return out.result;
          }
          log(name, "ok", started, args);
          return out;
        } catch (err) {
          if (err instanceof M4ApiError) {
            // layer 3 (the API said no) or any other API-level failure
            log(name, err.code === "insufficient_scope" ? "denied" : "error", started, args, {
              error: { code: err.code, message: err.message },
            });
            return failure(err.code, err.message, { status: err.status, ...err.extra });
          }
          const message = err instanceof Error ? err.message : String(err);
          log(name, "error", started, args, { error: { code: "internal_error", message } });
          return failure("internal_error", message);
        }
      }) as never,
    );
  }

  // ------------------------------------------------------------------------- //
  // Read tools
  // ------------------------------------------------------------------------- //
  tool(
    "list_links",
    {
      title: "List links",
      description:
        "List the account's short links, newest first. Use q to search by destination URL, title or short code. Returns a page of links plus the total count.",
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("1-based page number."),
        per_page: z.number().int().min(1).max(100).default(20).describe("Links per page (max 100)."),
        q: z.string().optional().describe("Case-insensitive search in destination URL, title and short code."),
      },
      outputSchema: {
        items: z.array(linkObject),
        page: z.number(),
        per_page: z.number(),
        total: z.number(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const page = await client.listLinks(args);
      const lines = page.items.map(
        (l) => `${l.short_url} → ${l.destination_url} (${l.click_count} clicks${l.active ? "" : ", inactive"}) id=${l.id}`,
      );
      return structured(
        { ...page },
        `${page.total} link(s) total; showing page ${page.page} (${page.items.length}).\n${lines.join("\n")}`,
      );
    },
  );

  tool(
    "get_link",
    {
      title: "Get link",
      description: "Fetch one short link by id, including its lifetime click count.",
      inputSchema: { id: linkId },
      outputSchema: linkShape,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id }) => structured({ ...(await client.getLink(id)) }),
  );

  tool(
    "get_link_analytics",
    {
      title: "Link analytics",
      description:
        "Click analytics for one link over a time window: total clicks, a daily series, and breakdowns by country, device and referrer. Unique visitors are not tracked (privacy: 3m4 never stores raw IPs).",
      inputSchema: { id: linkId, range: rangeEnum.default("7d") },
      outputSchema: {
        summary: z.object({ clicks: z.number(), uniques: z.number().nullable() }),
        series: z.array(point),
        by_country: z.array(bucket),
        by_device: z.array(bucket),
        by_referrer: z.array(bucket),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id, range }) => {
      const a = await client.linkAnalytics(id, range);
      const top = (b: { key: string; count: number }[]) =>
        b.slice(0, 3).map((x) => `${x.key} (${x.count})`).join(", ") || "none";
      return structured(
        { ...a },
        `${a.summary.clicks} clicks in the last ${range}. Top countries: ${top(a.by_country)}. Devices: ${top(a.by_device)}. Referrers: ${top(a.by_referrer)}.`,
      );
    },
  );

  tool(
    "get_account_overview",
    {
      title: "Account overview",
      description:
        "Account-wide analytics for a time window: total clicks, number of links, a daily click series and the top 10 links by clicks.",
      inputSchema: { range: rangeEnum.default("7d") },
      outputSchema: {
        range_days: z.number(),
        summary: z.object({ clicks: z.number(), links: z.number() }),
        series: z.array(point),
        top_links: z.array(
          z.object({
            id: z.string(),
            short_code: z.string(),
            short_url: z.string(),
            title: z.string().nullable(),
            clicks: z.number(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ range }) => {
      const o = await client.overview(range);
      const top = o.top_links.map((l) => `${l.short_url} (${l.clicks})`).join(", ") || "none";
      return structured(
        { ...o },
        `${o.summary.clicks} clicks across ${o.summary.links} links in the last ${o.range_days} days. Top: ${top}.`,
      );
    },
  );

  tool(
    "get_usage",
    {
      title: "Usage and limits",
      description:
        "This month's metered usage (links created, tracked clicks) against the plan's limits. Call this before bulk link creation or when a tool returns limit_reached.",
      inputSchema: {},
      outputSchema: {
        period_start: z.string(),
        period_end: z.string(),
        links_created: z.number(),
        tracked_clicks: z.number(),
        limits: z.record(z.string(), z.unknown()),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const u = await client.usage();
      const lim = u.limits as Record<string, unknown>;
      const fmt = (n: unknown) => (n === -1 ? "unlimited" : String(n));
      return structured(
        { ...u },
        `Period ${u.period_start} → ${u.period_end}: ${u.links_created}/${fmt(lim.links_per_month)} links, ${u.tracked_clicks}/${fmt(lim.tracked_clicks_per_month)} tracked clicks.`,
      );
    },
  );

  tool(
    "get_audit_log",
    {
      title: "Audit log",
      description:
        "Most recent audit events for the account (who did what, when, and whether it was allowed). Useful to answer 'what changed?' or to review agent activity.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).default(50),
        action: z.string().optional().describe("Filter by action, e.g. link.create, link.delete, auth.denied."),
      },
      outputSchema: {
        items: z.array(
          z.object({
            id: z.string(),
            ts: z.string(),
            actor_type: z.string(),
            actor_id: z.string().nullable(),
            actor_label: z.string().nullable(),
            action: z.string(),
            target_type: z.string().nullable(),
            target_id: z.string().nullable(),
            outcome: z.string(),
            meta: z.record(z.string(), z.unknown()),
          }),
        ),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const { items } = await client.auditLog(args);
      const lines = items.map(
        (e) => `${e.ts} ${e.outcome.padEnd(6)} ${e.action} by ${e.actor_type}${e.actor_label ? `:${e.actor_label}` : ""}${e.target_id ? ` → ${e.target_type}:${e.target_id}` : ""}`,
      );
      return structured({ items }, lines.join("\n") || "No audit events.");
    },
  );

  // ------------------------------------------------------------------------- //
  // Write tools
  // ------------------------------------------------------------------------- //
  tool(
    "create_link",
    {
      title: "Create short link",
      description:
        "Create a new short link for a destination URL. Optionally choose a custom slug (paid plans), a title, a 301/302 redirect type and an expiry. Fails with limit_reached when the monthly link quota is used up.",
      inputSchema: {
        destination_url: z.url().describe("Absolute URL to redirect to (http/https)."),
        custom_slug: z
          .string()
          .min(1)
          .max(32)
          .regex(/^[A-Za-z0-9_-]+$/)
          .optional()
          .describe("Vanity slug for the short URL. Paid plans only; leave unset for a random code."),
        redirect_type: z
          .union([z.literal(301), z.literal(302)])
          .default(302)
          .describe("302 (default, every click tracked) or 301 (permanent, browsers may cache)."),
        title: z.string().max(255).optional().describe("Human-friendly label shown in the dashboard."),
        expires_at: z.iso.datetime({ offset: true }).optional().describe("ISO-8601 expiry; the link stops redirecting after this."),
      },
      outputSchema: linkShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const link = await client.createLink(args);
      return structured({ ...link }, `Created ${link.short_url} → ${link.destination_url} (id=${link.id}).`);
    },
  );

  tool(
    "update_link",
    {
      title: "Update link",
      description:
        "Change a link's destination, title, active flag, redirect type or expiry. Only the fields you pass are changed. Set active=false to pause a link without deleting it.",
      inputSchema: {
        id: linkId,
        destination_url: z.url().optional(),
        title: z.string().max(255).optional(),
        active: z.boolean().optional().describe("false pauses the link (redirects stop), true resumes it."),
        redirect_type: z.union([z.literal(301), z.literal(302)]).optional(),
        expires_at: z.iso.datetime({ offset: true }).nullable().optional().describe("ISO-8601, or null to remove the expiry."),
      },
      outputSchema: linkShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, ...patch }) => {
      const link = await client.updateLink(id, patch);
      return structured({ ...link }, `Updated ${link.short_url} (id=${link.id}).`);
    },
  );

  tool(
    "delete_link",
    {
      title: "Delete link",
      description:
        "Permanently delete a short link and its analytics. IRREVERSIBLE. The user must confirm: when the client supports it you will be prompted; otherwise ask the user explicitly and call again with confirm=true.",
      inputSchema: {
        id: linkId,
        confirm: z
          .boolean()
          .default(false)
          .describe("Set to true only after the user explicitly confirmed deletion of this specific link."),
      },
      outputSchema: { deleted: z.boolean(), id: z.string(), short_url: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id, confirm }) => {
      // Show the user *what* they are deleting (needs links:read, which every
      // role that can delete also has).
      const link = await client.getLink(id);
      let approved = confirm;

      const canAsk = allowElicitation && Boolean(server.server.getClientCapabilities()?.elicitation);
      if (!approved && canAsk) {
        const answer = await server.server.elicitInput({
          mode: "form",
          message: `Delete ${link.short_url} → ${link.destination_url}? It has ${link.click_count} recorded clicks. This cannot be undone.`,
          requestedSchema: {
            type: "object",
            properties: {
              confirm: { type: "boolean", title: "Yes, delete this link", default: false },
            },
            required: ["confirm"],
          },
        });
        approved = answer.action === "accept" && answer.content?.confirm === true;
        if (!approved) {
          return {
            outcome: "cancelled",
            result: structured(
              { deleted: false, id, short_url: link.short_url },
              `Deletion of ${link.short_url} was cancelled by the user. Nothing was changed.`,
            ),
          };
        }
      }

      if (!approved) {
        return {
          outcome: "pending",
          result: {
            ...failure(
              "confirmation_required",
              `Deleting ${link.short_url} → ${link.destination_url} is irreversible. Ask the user to confirm, then call delete_link again with confirm=true.`,
            ),
          },
        };
      }

      await client.deleteLink(id);
      return structured(
        { deleted: true, id, short_url: link.short_url },
        `Deleted ${link.short_url} (id=${id}).`,
      );
    },
  );

  // ------------------------------------------------------------------------- //
  // Resources (read-only context the host can attach without a tool call)
  // ------------------------------------------------------------------------- //
  if (scopes.has("usage:read")) {
    server.registerResource(
      "usage",
      "m4://usage",
      {
        title: "Current usage",
        description: "This month's links created and tracked clicks vs. plan limits.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await client.usage(), null, 2) }],
      }),
    );
  }

  if (scopes.has("links:read")) {
    server.registerResource(
      "link",
      new ResourceTemplate("m4://links/{id}", { list: undefined }),
      {
        title: "Short link",
        description: "A single short link by id.",
        mimeType: "application/json",
      },
      async (uri, { id }) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await client.getLink(String(id)), null, 2),
          },
        ],
      }),
    );
  }

  // ------------------------------------------------------------------------- //
  // Prompts (reusable workflows the user can pick from the host UI)
  // ------------------------------------------------------------------------- //
  if (scopes.has("analytics:read")) {
    server.registerPrompt(
      "link_report",
      {
        title: "Link performance report",
        description: "Summarise how the account's links performed over a time window.",
        argsSchema: { range: z.enum(["7d", "30d", "1y"]).optional() },
      },
      ({ range }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Call get_account_overview with range="${range ?? "7d"}", then for the top 3 links call get_link_analytics. Write a short report: total clicks and trend, the best and worst performing links, where traffic comes from (countries, devices, referrers), and one concrete recommendation. Use plain language and a small table.`,
            },
          },
        ],
      }),
    );
  }

  return server;
}
