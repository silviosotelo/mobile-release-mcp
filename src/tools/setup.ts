import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runScript } from "../exec.js";
import { configArg, ctx, errText, resultText } from "./common.js";

function appfile(cfg: any): string {
  const lines: string[] = [];
  if (cfg.ios?.bundleId) lines.push(`for_platform :ios do\n  app_identifier "${cfg.ios.bundleId}"\nend`);
  if (cfg.android?.packageName) lines.push(`for_platform :android do\n  package_name "${cfg.android.packageName}"\nend`);
  return lines.join("\n\n") + "\n";
}

function fastfile(cfg: any): string {
  const asc = cfg.ios?.appStoreConnect;
  const ascBlock = asc
    ? `def asc_key\n  app_store_connect_api_key(key_id: "${asc.keyId}", issuer_id: "${asc.issuerId}", key_filepath: File.expand_path("${asc.keyPath}"))\nend\n`
    : "";
  const iosLanes = asc
    ? `\nplatform :ios do\n  desc "Sube a TestFlight"\n  lane :beta do\n    upload_to_testflight(api_key: asc_key, ipa: ENV["IPA"]) \n  end\n  desc "Envia a revision de App Store"\n  lane :release do |o|\n    deliver(api_key: asc_key, app_identifier: "${cfg.ios?.bundleId ?? ""}", app_version: o[:version], build_number: o[:build], submit_for_review: true, automatic_release: true, force: true, skip_screenshots: true, skip_metadata: true, skip_binary_upload: true, run_precheck_before_submit: false)\n  end\nend\n`
    : "";
  const playJson = cfg.android?.playServiceAccountJson;
  const androidLanes = playJson
    ? `\nplatform :android do\n  desc "Sube AAB a internal"\n  lane :beta do\n    upload_to_play_store(package_name: "${cfg.android?.packageName ?? ""}", json_key: File.expand_path("${playJson}"), aab: ENV["AAB"], track: "internal", release_status: "completed")\n  end\n  desc "Sube AAB a produccion"\n  lane :release do\n    upload_to_play_store(package_name: "${cfg.android?.packageName ?? ""}", json_key: File.expand_path("${playJson}"), aab: ENV["AAB"], track: "production", release_status: "completed")\n  end\nend\n`
    : "";
  return `${ascBlock}${iosLanes}${androidLanes}`;
}

export function registerSetup(server: McpServer): void {
  server.tool(
    "setup_fastlane",
    "Genera fastlane/Appfile y fastlane/Fastfile en el proyecto a partir del config (lanes ios beta/release y android beta/release). No sobrescribe credenciales (las referencia desde sus rutas).",
    { ...configArg, force: z.boolean().optional().describe("Sobrescribir si ya existen") },
    async (a: { config?: string; force?: boolean }) => {
      const { cfg, host } = ctx(a);
      if (!cfg.ios && !cfg.android) return errText("Config sin ios ni android: nada que scaffoldear.");
      const guard = a.force ? "" : 'if [ -f fastlane/Fastfile ]; then echo "Ya existe fastlane/Fastfile (usa force:true para sobrescribir)"; exit 0; fi\n';
      const script =
        `${guard}mkdir -p fastlane\n` +
        `cat > fastlane/Appfile <<'MR_APPFILE'\n${appfile(cfg)}MR_APPFILE\n` +
        `cat > fastlane/Fastfile <<'MR_FASTFILE'\n${fastfile(cfg)}MR_FASTFILE\n` +
        `echo "Generados: fastlane/Appfile, fastlane/Fastfile"\n`;
      const r = await runScript("bash", script, host, { timeoutMs: 60000 });
      return resultText("setup_fastlane", r);
    }
  );
}
