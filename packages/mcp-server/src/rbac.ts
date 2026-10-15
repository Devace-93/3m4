/**
 * Tool-level authorization.
 *
 * Every tool declares the one scope it needs. The server consults this table
 * twice (defense in depth):
 *
 *   1. at registration — tools the key cannot use are never listed, so the
 *      model is not tempted to call them;
 *   2. at call time — a tool that is somehow invoked without its scope is
 *      refused and the refusal is audited.
 *
 * The REST API enforces the same scopes independently (layer 3), so a bug in
 * this file can never *grant* access, only hide it.
 */
import type { Scope } from "./types.js";

export const TOOL_SCOPES = {
  list_links: "links:read",
  get_link: "links:read",
  create_link: "links:write",
  update_link: "links:write",
  delete_link: "links:delete",
  get_link_analytics: "analytics:read",
  get_account_overview: "analytics:read",
  get_usage: "usage:read",
  get_audit_log: "audit:read",
} as const satisfies Record<string, Scope>;

export type ToolName = keyof typeof TOOL_SCOPES;

export const ALL_TOOLS = Object.keys(TOOL_SCOPES) as ToolName[];

export function hasScope(scopes: Iterable<Scope>, scope: Scope): boolean {
  for (const s of scopes) if (s === scope) return true;
  return false;
}

export function allowedTools(scopes: Iterable<Scope>): ToolName[] {
  const set = new Set(scopes);
  return ALL_TOOLS.filter((tool) => set.has(TOOL_SCOPES[tool]));
}
