/** Environment-driven configuration shared by the stdio and HTTP entrypoints. */

export interface Config {
  apiUrl: string;
  apiKey: string | undefined;
  auditLog: string | undefined;
  port: number;
}

export const DEFAULT_API_URL = "https://3m4.net/api";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    apiUrl: (env.M4_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    apiKey: env.M4_API_KEY?.trim() || undefined,
    auditLog: env.M4_AUDIT_LOG,
    port: Number(env.M4_MCP_PORT || 3333),
  };
}
