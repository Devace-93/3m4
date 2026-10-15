# 3m4-mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for the
[3m4](https://3m4.net) URL shortener. Lets an AI agent (Claude Code, Claude
Desktop, Cursor, the MCP Inspector, your own app) create and manage short
links and read click analytics — with **role-based tool access**, a **human
approval step** for destructive actions, and an **audit trail**.

```
npx 3m4-mcp        # stdio (local hosts)
https://3m4.net/mcp  # Streamable HTTP (remote hosts)
```

## Quick start

1. Create an API key in the dashboard (`/dashboard/settings`) and pick a role.
2. Register the server with your host.

**Claude Code**

```bash
claude mcp add 3m4 --scope user \
  --env M4_API_KEY=m4_live_… \
  -- npx -y 3m4-mcp
```

**Cursor / Claude Desktop / any JSON config**

```json
{
  "mcpServers": {
    "3m4": {
      "command": "npx",
      "args": ["-y", "3m4-mcp"],
      "env": { "M4_API_KEY": "m4_live_…" }
    }
  }
}
```

**Remote (Streamable HTTP)** — no install, the key travels as a Bearer token:

```bash
claude mcp add --transport http 3m4 https://3m4.net/mcp \
  --header "Authorization: Bearer m4_live_…"
```

Then ask: *"shorten https://example.com/some/long/url and give me the QR"*,
*"which of my links got the most clicks this month?"*, *"pause the link c7Xk2"*.

## Configuration

| Variable        | Default               | Meaning |
|-----------------|-----------------------|---------|
| `M4_API_KEY`    | —                     | Required for stdio. The 3m4 API key (`m4_live_…`). |
| `M4_API_URL`    | `https://3m4.net/api` | API base URL. Self-hosters point this at their instance. |
| `M4_AUDIT_LOG`  | `stderr`              | `stderr`, `none`, or a file path (JSON lines). |
| `M4_MCP_PORT`   | `3333`                | HTTP entrypoint only. |

## Roles and tools (RBAC)

Each API key has a role. The server asks the API for the key's scopes once
(`GET /apikeys/me`) and **only registers the tools those scopes allow**, so a
read-only key never even lists `delete_link`. Every call is re-checked at
call time, and the API enforces the same scopes independently — three layers,
and a bug in the server can hide access but never grant it.

| Tool                   | Scope            | viewer | editor | admin |
|------------------------|------------------|:------:|:------:|:-----:|
| `list_links`           | `links:read`     | ✓ | ✓ | ✓ |
| `get_link`             | `links:read`     | ✓ | ✓ | ✓ |
| `get_link_analytics`   | `analytics:read` | ✓ | ✓ | ✓ |
| `get_account_overview` | `analytics:read` | ✓ | ✓ | ✓ |
| `get_usage`            | `usage:read`     | ✓ | ✓ | ✓ |
| `create_link`          | `links:write`    |   | ✓ | ✓ |
| `update_link`          | `links:write`    |   | ✓ | ✓ |
| `delete_link`          | `links:delete`   |   |   | ✓ |
| `get_audit_log`        | `audit:read`     |   |   | ✓ |

Roles are defined once in
[`packages/shared/api_key_roles.json`](../shared/api_key_roles.json) and
shared by the API, the dashboard and this server.

Also exposed: resources `m4://usage` and `m4://links/{id}`, and the
`link_report` prompt.

## Human approval for destructive actions

`delete_link` is irreversible, so it never runs on the model's say-so alone:

- On hosts that support MCP **elicitation** (Claude Code, Inspector) the user
  gets a native confirmation dialog showing exactly which link will be deleted.
- On hosts that don't (and always over HTTP, which is stateless), the tool
  refuses with `confirmation_required` until the model calls it again with
  `confirm: true` — which it can only honestly do after asking the user.

## Audit trail

Two complementary logs:

- **Server-side** (`audit_events` table, `GET /account/audit`, tool
  `get_audit_log`): every mutation and every authorization denial, written in
  the same transaction as the change.
- **Agent-side** (`M4_AUDIT_LOG`, JSON lines): every tool call the agent
  attempted, including ones refused locally that never reached the API, with
  duration, outcome (`ok|denied|error|cancelled|pending`) and compacted args.

## Design notes

- **Structured outputs.** Every tool declares an `outputSchema` and returns
  `structuredContent`; hosts can validate and chain results without parsing prose.
- **Errors are results.** API errors come back as `isError` with the stable
  code (`limit_reached`, `insufficient_scope`, `not_found`…) so the model can
  recover instead of crashing.
- **stdio hygiene.** stdout is the protocol channel; all logging goes to stderr.
- **Stateless HTTP.** Each request builds a server bound to the caller's key;
  tenants can never share state. The `/apikeys/me` lookup is cached 60 s per key.

## Development

```bash
bun install
bun test            # in-memory MCP client ↔ server against a fake API
bun run build
M4_API_KEY=… M4_API_URL=http://localhost:8080/api bun run inspect   # MCP Inspector
M4_API_KEY=… M4_API_URL=http://localhost:8080/api bun run dev:http  # http://localhost:3333/mcp
```

The Docker image (`packages/mcp-server/Dockerfile`) runs the HTTP flavour and
is wired into `deploy/docker-compose.yml` as the `mcp` service, exposed by
Caddy at `/mcp`.

## License

MIT © Enrique Magallon Alvarez
