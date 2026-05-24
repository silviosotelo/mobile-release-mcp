import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText, keychainPrefix } from "./common.js";

export function registerNativeIos(server: McpServer): void {
  server.tool(
    "ios_xcodebuild",
    "Corre xcodebuild para un proyecto iOS/macOS nativo (Swift/ObjC): build, test, archive o clean. Soporta workspace o project, scheme, configuration y destination.",
    {
      ...configArg,
      action: z.enum(["build", "test", "archive", "clean"]).describe("Acción de xcodebuild"),
      workspace: z.string().optional().describe(".xcworkspace (usar esto o project)"),
      project: z.string().optional().describe(".xcodeproj"),
      scheme: z.string().describe("Scheme"),
      configuration: z.string().optional().describe("Default Release"),
      destination: z.string().optional().describe("ej. 'generic/platform=iOS' o 'platform=iOS Simulator,name=iPhone 16'"),
      extraArgs: z.string().optional(),
    },
    async (a: any) => {
      const { cfg, host } = ctx(a);
      const container = a.workspace ? `-workspace ${a.workspace}` : a.project ? `-project ${a.project}` : "";
      const parts = ["xcodebuild", a.action, container, `-scheme ${a.scheme}`, `-configuration ${a.configuration ?? "Release"}`];
      if (a.destination) parts.push(`-destination ${JSON.stringify(a.destination)}`);
      if (a.action === "archive") parts.push(`-archivePath build/${a.scheme}.xcarchive`);
      if (a.extraArgs) parts.push(a.extraArgs);
      const prefix = a.action === "archive" || a.action === "build" ? keychainPrefix(cfg) : "";
      return runText(`xcodebuild ${a.action}`, prefix + parts.join(" "), host);
    }
  );

  server.tool(
    "ios_export_ipa",
    "Exporta un IPA desde un .xcarchive (xcodebuild -exportArchive) usando un exportOptions.plist.",
    {
      ...configArg,
      archivePath: z.string().describe("Ruta al .xcarchive"),
      exportOptionsPlist: z.string().describe("Ruta al exportOptions.plist"),
      exportDir: z.string().optional().describe("Directorio de salida (default build/ipa)"),
    },
    async (a: { config?: string; archivePath: string; exportOptionsPlist: string; exportDir?: string }) => {
      const { cfg, host } = ctx(a);
      const cmd = `${keychainPrefix(cfg)}xcodebuild -exportArchive -archivePath ${a.archivePath} -exportOptionsPlist ${a.exportOptionsPlist} -exportPath ${a.exportDir ?? "build/ipa"}`;
      return runText("xcodebuild -exportArchive", cmd, host);
    }
  );

  server.tool(
    "ios_pod_install",
    "Ejecuta pod install (CocoaPods) en un directorio iOS.",
    { ...configArg, dir: z.string().optional().describe("Directorio (default ios). Usar '.' para proyectos nativos."), repoUpdate: z.boolean().optional() },
    async (a: { config?: string; dir?: string; repoUpdate?: boolean }) =>
      runText("pod install", `cd ${a.dir ?? "ios"} && pod install${a.repoUpdate ? " --repo-update" : ""}`, ctx(a).host)
  );

  server.tool(
    "swift_build",
    "Compila un paquete Swift (swift build) — Swift Package Manager.",
    { ...configArg, configuration: z.enum(["debug", "release"]).optional() },
    async (a: { config?: string; configuration?: string }) =>
      runText("swift build", `swift build -c ${a.configuration ?? "debug"}`, ctx(a).host)
  );

  server.tool(
    "swift_test",
    "Corre los tests de un paquete Swift (swift test).",
    { ...configArg, filter: z.string().optional() },
    async (a: { config?: string; filter?: string }) =>
      runText("swift test", `swift test${a.filter ? ` --filter ${a.filter}` : ""}`, ctx(a).host)
  );
}
