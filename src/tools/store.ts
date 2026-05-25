import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { run, runScript, shSingleQuote } from "../exec.js";
import { ASC_RUBY, PLAY_PY } from "../host_scripts.js";
import { configArg, ctx, errText, resultText, runText, withVars } from "./common.js";

function ascVars(cfg: any): Record<string, string> | null {
  const a = cfg.ios?.appStoreConnect;
  if (!a || !cfg.ios?.bundleId) return null;
  return { ASC_KEY_ID: a.keyId, ASC_ISSUER: a.issuerId, ASC_KEY_PATH: a.keyPath, ASC_BUNDLE: cfg.ios.bundleId };
}
function playVars(cfg: any): Record<string, string> | null {
  if (!cfg.android?.playServiceAccountJson || !cfg.android?.packageName) return null;
  return { PLAY_JSON: cfg.android.playServiceAccountJson, PLAY_PKG: cfg.android.packageName };
}

export function registerStore(server: McpServer): void {
  server.tool(
    "store_status",
    "Estado en la tienda: iOS (App Store Connect: versión live/editable, review submission, builds) o Android (Google Play: releases por track).",
    { ...configArg, platform: z.enum(["ios", "android"]) },
    async (a: { config?: string; platform: "ios" | "android" }) => {
      const { cfg, host } = ctx(a);
      if (a.platform === "ios") {
        const v = ascVars(cfg);
        if (!v) return errText("Falta ios.appStoreConnect + ios.bundleId en el config.");
        const r = await runScript("ruby", ASC_RUBY, withVars(host, v), { args: "status", timeoutMs: 120000 });
        return resultText("App Store Connect status", r);
      } else {
        const v = playVars(cfg);
        if (!v) return errText("Falta android.playServiceAccountJson + android.packageName en el config.");
        const r = await runScript("python3", PLAY_PY, withVars(host, v), { args: "status", timeoutMs: 120000 });
        return resultText("Google Play status", r);
      }
    }
  );

  server.tool(
    "check_store_version",
    "Última versión publicada en la tienda. iOS: consulta el iTunes lookup API por bundleId. Android: versionCode/Name del track production.",
    { ...configArg, platform: z.enum(["ios", "android"]) },
    async (a: { config?: string; platform: "ios" | "android" }) => {
      const { cfg, host } = ctx(a);
      if (a.platform === "ios") {
        if (!cfg.ios?.bundleId) return errText("Falta ios.bundleId.");
        const country = cfg.ios.appStoreCountry ?? "us";
        const cmd = `curl -s "https://itunes.apple.com/lookup?bundleId=${cfg.ios.bundleId}&country=${country}" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['results'][0] if d['resultCount'] else None; print('version:', r['version'], '| build:', r.get('bundleVersion','?')) if r else print('no encontrado en la tienda (country=${country})')"`;
        return runText("iTunes lookup", cmd, host, 60000);
      } else {
        const v = playVars(cfg);
        if (!v) return errText("Falta android.playServiceAccountJson + android.packageName.");
        const r = await runScript("python3", PLAY_PY, withVars(host, v), { args: "status", timeoutMs: 120000 });
        return resultText("Google Play (tracks/versionCodes)", r);
      }
    }
  );

  server.tool(
    "release_android",
    "Sube un AAB a Google Play en un track (production por defecto) con rollout completo. Pasa releaseNotes si se indican.",
    {
      ...configArg,
      aabPath: z.string().describe("Ruta absoluta al .aab (en el build host)"),
      track: z.enum(["production", "beta", "alpha", "internal"]).optional(),
      releaseNotes: z.string().optional(),
      releaseNotesLang: z.string().optional().describe("default es-419"),
    },
    async (a: any) => {
      const { cfg, host } = ctx(a);
      const v = playVars(cfg);
      if (!v) return errText("Falta android.playServiceAccountJson + android.packageName.");
      const vars: Record<string, string> = { ...v, PLAY_AAB: a.aabPath, PLAY_TRACK: a.track ?? "production", PLAY_STATUS: "completed" };
      if (a.releaseNotes) { vars.PLAY_NOTES = a.releaseNotes; vars.PLAY_LANG = a.releaseNotesLang ?? "es-419"; }
      const r = await runScript("python3", PLAY_PY, withVars(host, vars), { args: "upload", timeoutMs: 10 * 60 * 1000 });
      return resultText(`Google Play upload (${a.track ?? "production"})`, r);
    }
  );

  server.tool(
    "beta_android",
    "Sube un AAB al track internal de Google Play (testers internos).",
    { ...configArg, aabPath: z.string() },
    async (a: { config?: string; aabPath: string }) => {
      const { cfg, host } = ctx(a);
      const v = playVars(cfg);
      if (!v) return errText("Falta android.playServiceAccountJson + android.packageName.");
      const r = await runScript("python3", PLAY_PY, withVars(host, { ...v, PLAY_AAB: a.aabPath, PLAY_TRACK: "internal", PLAY_STATUS: "completed" }), { args: "upload", timeoutMs: 10 * 60 * 1000 });
      return resultText("Google Play upload (internal)", r);
    }
  );

  server.tool(
    "beta_ios",
    "Sube un IPA a TestFlight con fastlane pilot (upload_to_testflight). A diferencia de altool, espera el procesado del build y lo deja listo para testers. Auth con la API key de ios.appStoreConnect.",
    {
      ...configArg,
      ipaPath: z.string().describe("Ruta al .ipa en el build host"),
      skipWaitingForProcessing: z.boolean().optional().describe("No esperar el procesado del build (default false)"),
    },
    async (a: { config?: string; ipaPath: string; skipWaitingForProcessing?: boolean }) => {
      const { cfg, host } = ctx(a);
      const asc = cfg.ios?.appStoreConnect;
      if (!asc) return errText("Falta ios.appStoreConnect (keyId/issuerId/keyPath).");
      if (!cfg.ios?.bundleId) return errText("Falta ios.bundleId.");
      const kj = `/tmp/mr_asc_${Date.now()}_${Math.floor(Math.random() * 1e6)}.json`;
      const skipWait = a.skipWaitingForProcessing ? "true" : "false";
      const cmd =
        `jq -n --arg k ${shSingleQuote(asc.keyId)} --arg i ${shSingleQuote(asc.issuerId)} --arg f ${shSingleQuote(asc.keyPath)} ` +
        `'{key_id:$k,issuer_id:$i,key_filepath:$f,in_house:false}' > ${kj} && ` +
        `fastlane run upload_to_testflight api_key_path:${kj} ipa:${shSingleQuote(a.ipaPath)} ` +
        `app_identifier:${shSingleQuote(cfg.ios.bundleId)} skip_waiting_for_build_processing:${skipWait}; ` +
        `rc=$?; rm -f ${kj}; exit $rc`;
      return runText("pilot upload (TestFlight)", cmd, host, 20 * 60 * 1000);
    }
  );

  server.tool(
    "release_ios",
    "Crea/actualiza la versión en App Store Connect, adjunta el build, setea 'What's New' y la envía a revisión. Maneja el reemplazo de una versión en revisión (cancelReview) y el renombre de versión. Requiere el build ya subido y procesado (beta_ios). Nota: el binario debe tener ITSAppUsesNonExemptEncryption resuelto.",
    {
      ...configArg,
      version: z.string().describe("Versión de marketing, ej. 2026.05.24"),
      build: z.string().optional().describe("Número de build a adjuntar (CFBundleVersion)"),
      notes: z.string().optional().describe("What's New"),
      locale: z.string().optional().describe("Locale de las notas (default en-US o el primero)"),
      cancelReview: z.boolean().optional().describe("Cancelar una revisión en curso para reemplazarla"),
    },
    async (a: any) => {
      const { cfg, host } = ctx(a);
      const v = ascVars(cfg);
      if (!v) return errText("Falta ios.appStoreConnect + ios.bundleId.");
      const vars: Record<string, string> = { ...v, ASC_VERSION: a.version };
      if (a.build) vars.ASC_BUILD = a.build;
      if (a.notes) vars.ASC_NOTES = a.notes;
      if (a.locale) vars.ASC_LOCALE = a.locale;
      if (a.cancelReview) vars.ASC_CANCEL_REVIEW = "1";
      const r = await runScript("ruby", ASC_RUBY, withVars(host, vars), { args: "submit", timeoutMs: 5 * 60 * 1000 });
      return resultText(`App Store submit ${a.version}`, r);
    }
  );
}
