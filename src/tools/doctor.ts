import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { run } from "../exec.js";
import { configArg, ctx, text } from "./common.js";

export function registerDoctor(server: McpServer): void {
  server.tool(
    "doctor",
    "Valida el entorno de release en el host (local o remoto por SSH): flutter, shorebird, fastlane, CocoaPods, locale UTF-8 y presencia de credenciales (App Store Connect .p8, Google Play service account JSON). Usalo primero para diagnosticar.",
    configArg,
    async (args: { config?: string }) => {
      const { cfg, host } = ctx(args);
      const checks: string[] = [];

      const probe = async (label: string, cmd: string) => {
        const r = await run(cmd, host, { timeoutMs: 60000 });
        const ok = r.code === 0;
        const out = (r.stdout || r.stderr).trim().split("\n")[0] ?? "";
        checks.push(`${ok ? "✅" : "❌"} ${label}${ok && out ? ": " + out : ok ? "" : ": no disponible"}`);
      };

      await probe("host", host.ssh ? "echo $(hostname)" : "echo $(hostname)");
      await probe("flutter", "flutter --version 2>/dev/null | head -1");
      await probe("shorebird", "shorebird --version 2>/dev/null | head -1");
      await probe("fastlane", "fastlane --version 2>/dev/null | tail -1");
      await probe("cocoapods", "pod --version 2>/dev/null");
      await probe("xcode (xcrun)", "xcrun --version 2>/dev/null | head -1");
      await probe("locale", "echo \"${LC_ALL:-$LANG}\"");

      if (cfg.ios?.appStoreConnect?.keyPath) {
        await probe("ASC API key (.p8)", `test -f ${cfg.ios.appStoreConnect.keyPath} && echo presente`);
      }
      if (cfg.android?.playServiceAccountJson) {
        await probe("Play service account", `test -f ${cfg.android.playServiceAccountJson} && echo presente`);
      }

      const where = host.ssh ? `ssh:${host.ssh}` : "local";
      return text(
        `mobile-release-mcp · doctor (${where}, dir=${cfg.projectDir})\n\n` + checks.join("\n")
      );
    }
  );
}
