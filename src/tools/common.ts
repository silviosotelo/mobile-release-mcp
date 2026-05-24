import { z } from "zod";
import { loadConfig, hostFromConfig, type MrConfig } from "../config.js";
import type { ExecHost } from "../exec.js";

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
