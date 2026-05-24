import { z } from "zod";
import { loadConfig, hostFromConfig, type MrConfig } from "../config.js";
import { run, tail, type ExecHost } from "../exec.js";

const DEFAULT_TIMEOUT = 20 * 60 * 1000;

/** Run a command on the host and return a formatted MCP text result. */
export async function runText(
  label: string,
  command: string,
  host: ExecHost,
  timeoutMs: number = DEFAULT_TIMEOUT
) {
  const r = await run(command, host, { timeoutMs });
  const status = r.code === 0 ? "✅ ok" : `❌ exit=${r.code}`;
  return text(`${label} — ${status}\n$ ${command}\n\n${tail(r.stdout + r.stderr)}`);
}

/** Common `config` argument shared by every tool. */
export const configArg = {
  config: z
    .string()
    .optional()
    .describe("Ruta al mobile-release.config.json (default: ./mobile-release.config.json)"),
};

export interface ToolCtx {
  cfg: MrConfig;
  host: ExecHost;
}

export function ctx(args: { config?: string }): ToolCtx {
  const cfg = loadConfig(args.config ?? "mobile-release.config.json");
  return { cfg, host: hostFromConfig(cfg) };
}

export function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

/** Merge extra env vars into a host (used to pass params to host scripts). */
export function withVars(host: ExecHost, vars: Record<string, string>): ExecHost {
  return { ...host, env: { ...host.env, vars: { ...host.env?.vars, ...vars } } };
}

/** Format an already-run ExecResult into an MCP text result. */
export function resultText(label: string, r: { code: number; stdout: string; stderr: string }) {
  const status = r.code === 0 ? "✅ ok" : `❌ exit=${r.code}`;
  return text(`${label} — ${status}\n\n${tail(r.stdout + r.stderr)}`);
}

export function errText(s: string) {
  return { content: [{ type: "text" as const, text: s }], isError: true };
}

/**
 * Prefix that unlocks the login keychain so `codesign` can use the signing
 * identity in a non-interactive (SSH) session. No-op if no password configured.
 * Returns a string ending in ` && ` ready to prepend to an iOS build command.
 */
export function keychainPrefix(cfg: MrConfig): string {
  const k = cfg.ios?.keychain;
  if (!k?.password) return "";
  const path = k.path ?? "~/Library/Keychains/login.keychain-db";
  const p = k.password;
  return (
    `security unlock-keychain -p ${p} ${path} && ` +
    `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k ${p} ${path} >/dev/null 2>&1 && `
  );
}
