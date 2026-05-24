import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ExecHost } from "./exec.js";

export interface MrConfig {
  /** Project root (Flutter/iOS/Android) on the build host. */
  projectDir: string;
  /** Optional: run all commands on a remote macOS host over SSH. */
  remote?: { ssh: string };
  /** Build-host env quirks (PATH for CocoaPods/gems, UTF-8 locale, etc.). */
  env?: { pathPrepend?: string[]; lang?: string; vars?: Record<string, string> };

  ios?: {
    bundleId: string;
    /** App Store Connect API key (for upload/submit without the keychain). */
    appStoreConnect?: { keyId: string; issuerId: string; keyPath: string };
    /** iTunes lookup country for store-version checks (default: us). */
    appStoreCountry?: string;
    /** Login keychain unlock for codesign over SSH (optional, sensitive). */
    keychain?: { path?: string; password?: string };
  };

  android?: {
    packageName: string;
    /** Google Play service account JSON path (for supply / status). */
    playServiceAccountJson?: string;
  };

  shorebird?: {
    enabled?: boolean;
    /** Build releases with --no-tree-shake-icons so OTA patches don't break. */
    noTreeShakeIcons?: boolean;
    flutterVersion?: string;
  };

  /** fastlane match (team code signing via git/storage). */
  match?: { gitUrl?: string; type?: "appstore" | "adhoc" | "development" | "enterprise"; storageMode?: string };
}

/** Expand a leading ~ to the LOCAL home (only meaningful for local hosts). */
export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return p.replace(/^~/, homedir());
  return p;
}

export function loadConfig(path: string): MrConfig {
  const abs = resolve(expandHome(path));
  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch {
    throw new Error(`No pude leer el config en ${abs}. Pasá 'config' con la ruta a tu mobile-release.config.json.`);
  }
  let cfg: MrConfig;
  try {
    cfg = JSON.parse(raw) as MrConfig;
  } catch (e) {
    throw new Error(`Config inválido (${abs}): ${String(e)}`);
  }
  if (!cfg.projectDir) throw new Error("Config: falta 'projectDir'.");
  return cfg;
}

/** Build the ExecHost (local or ssh) from a config. */
export function hostFromConfig(cfg: MrConfig): ExecHost {
  return {
    ssh: cfg.remote?.ssh,
    cwd: cfg.projectDir,
    env: cfg.env,
  };
}
