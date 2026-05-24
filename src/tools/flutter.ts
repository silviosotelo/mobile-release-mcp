import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

export function registerFlutter(server: McpServer): void {
  server.tool(
    "flutter_build",
    "Compila una app Flutter: apk, appbundle (aab), ipa, ios, web o macos. Soporta flavor, modo (debug/profile/release) y flags extra.",
    {
      ...configArg,
      target: z.enum(["apk", "appbundle", "ios", "ipa", "web", "macos"]).describe("Artefacto a compilar"),
      mode: z.enum(["debug", "profile", "release"]).optional().describe("Modo (default release)"),
      flavor: z.string().optional().describe("Product flavor"),
      simulator: z.boolean().optional().describe("Para ios: build para simulador"),
      extraArgs: z.string().optional().describe("Flags extra para flutter build"),
    },
    async (a: { config?: string; target: string; mode?: string; flavor?: string; simulator?: boolean; extraArgs?: string }) => {
      const { host } = ctx(a);
      const parts = [`flutter build ${a.target}`, `--${a.mode ?? "release"}`];
      if (a.flavor) parts.push(`--flavor ${a.flavor}`);
      if (a.simulator && (a.target === "ios" || a.target === "ipa")) parts.push("--simulator");
      if (a.extraArgs) parts.push(a.extraArgs);
      return runText(`flutter build ${a.target}`, parts.join(" "), host);
    }
  );

  server.tool(
    "flutter_test",
    "Corre los tests de un proyecto Flutter (flutter test). Soporta path/filtro y coverage.",
    { ...configArg, path: z.string().optional(), coverage: z.boolean().optional(), extraArgs: z.string().optional() },
    async (a: { config?: string; path?: string; coverage?: boolean; extraArgs?: string }) => {
      const { host } = ctx(a);
      const parts = ["flutter test"];
      if (a.coverage) parts.push("--coverage");
      if (a.extraArgs) parts.push(a.extraArgs);
      if (a.path) parts.push(a.path);
      return runText("flutter test", parts.join(" "), host);
    }
  );

  server.tool(
    "flutter_analyze",
    "Análisis estático (flutter analyze). Devuelve issues; útil antes de buildear.",
    { ...configArg, path: z.string().optional() },
    async (a: { config?: string; path?: string }) => {
      const { host } = ctx(a);
      return runText("flutter analyze", `flutter analyze ${a.path ?? ""}`.trim(), host);
    }
  );

  server.tool(
    "flutter_pub",
    "Gestión de dependencias Dart/Flutter: get, upgrade, add, remove, outdated.",
    {
      ...configArg,
      action: z.enum(["get", "upgrade", "outdated", "add", "remove"]).describe("Acción de pub"),
      packages: z.string().optional().describe("Paquetes para add/remove"),
    },
    async (a: { config?: string; action: string; packages?: string }) => {
      const { host } = ctx(a);
      const cmd = `flutter pub ${a.action} ${a.packages ?? ""}`.trim();
      return runText(`flutter pub ${a.action}`, cmd, host);
    }
  );

  server.tool(
    "flutter_clean",
    "Limpia artefactos de build (flutter clean).",
    { ...configArg },
    async (a: { config?: string }) => runText("flutter clean", "flutter clean", ctx(a).host)
  );

  server.tool(
    "flutter_format",
    "Formatea código Dart (dart format).",
    { ...configArg, path: z.string().optional() },
    async (a: { config?: string; path?: string }) => runText("dart format", `dart format ${a.path ?? "."}`, ctx(a).host)
  );

  server.tool(
    "flutter_gen_l10n",
    "Genera localizaciones (flutter gen-l10n).",
    { ...configArg },
    async (a: { config?: string }) => runText("flutter gen-l10n", "flutter gen-l10n", ctx(a).host)
  );

  server.tool(
    "flutter_doctor",
    "Diagnóstico del entorno Flutter (flutter doctor -v).",
    { ...configArg },
    async (a: { config?: string }) => runText("flutter doctor", "flutter doctor -v", ctx(a).host)
  );
}
