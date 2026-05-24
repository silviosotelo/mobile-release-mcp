import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

export function registerDevices(server: McpServer): void {
  server.tool(
    "devices_list",
    "Lista dispositivos disponibles: simuladores iOS (simctl), AVDs y devices Android (adb / emulator).",
    { ...configArg },
    async (a: { config?: string }) => {
      const cmd =
        "echo '=== iOS simulators ==='; xcrun simctl list devices available 2>/dev/null | grep -E 'iPhone|iPad' | head -30; " +
        "echo; echo '=== Android devices ==='; adb devices -l 2>/dev/null; " +
        "echo; echo '=== Android AVDs ==='; emulator -list-avds 2>/dev/null || echo '(emulator no en PATH)'";
      return runText("devices", cmd, ctx(a).host, 120000);
    }
  );

  server.tool(
    "ios_simulator",
    "Controla el simulador iOS vía simctl: boot, shutdown, install (appPath), launch (bundleId), terminate (bundleId), screenshot (outPath). 'udid' default = booted.",
    {
      ...configArg,
      action: z.enum(["boot", "shutdown", "install", "launch", "terminate", "screenshot"]),
      udid: z.string().optional().describe("UDID del simulador (default: booted)"),
      appPath: z.string().optional().describe("Ruta al .app (para install)"),
      bundleId: z.string().optional().describe("Bundle id (para launch/terminate)"),
      outPath: z.string().optional().describe("Ruta de salida del screenshot"),
    },
    async (a: any) => {
      const { cfg, host } = ctx(a);
      const target = a.udid ?? "booted";
      let cmd: string;
      switch (a.action) {
        case "boot": cmd = `xcrun simctl boot ${target} 2>/dev/null; open -a Simulator; echo booted ${target}`; break;
        case "shutdown": cmd = `xcrun simctl shutdown ${target}`; break;
        case "install": cmd = `xcrun simctl install ${target} ${a.appPath}`; break;
        case "launch": cmd = `xcrun simctl launch ${target} ${a.bundleId ?? cfg.ios?.bundleId ?? ""}`; break;
        case "terminate": cmd = `xcrun simctl terminate ${target} ${a.bundleId ?? cfg.ios?.bundleId ?? ""}`; break;
        case "screenshot": cmd = `xcrun simctl io ${target} screenshot ${a.outPath ?? "/tmp/mr_sim_shot.png"} && echo guardado en ${a.outPath ?? "/tmp/mr_sim_shot.png"}`; break;
        default: cmd = "echo accion desconocida";
      }
      return runText(`ios simulator ${a.action}`, cmd, host, 120000);
    }
  );
}
