import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

export function registerScreenshots(server: McpServer): void {
  server.tool(
    "snapshot",
    "fastlane snapshot: genera screenshots automáticos de la app iOS en varios dispositivos/idiomas (lee el Snapfile del proyecto).",
    { ...configArg, extraArgs: z.string().optional() },
    async (a: { config?: string; extraArgs?: string }) =>
      runText("fastlane snapshot", `fastlane snapshot ${a.extraArgs ?? ""}`.trim(), ctx(a).host, 60 * 60 * 1000)
  );

  server.tool(
    "frameit",
    "fastlane frameit: enmarca los screenshots en mockups de dispositivo.",
    { ...configArg },
    async (a: { config?: string }) => runText("fastlane frameit", "fastlane frameit", ctx(a).host, 20 * 60 * 1000)
  );

  server.tool(
    "screengrab",
    "fastlane screengrab: screenshots automáticos de la app Android (lee el Screengrabfile).",
    { ...configArg, extraArgs: z.string().optional() },
    async (a: { config?: string; extraArgs?: string }) =>
      runText("fastlane screengrab", `fastlane screengrab ${a.extraArgs ?? ""}`.trim(), ctx(a).host, 60 * 60 * 1000)
  );
}
