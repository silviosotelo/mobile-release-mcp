import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

export function registerExtras(server: McpServer): void {
  server.tool(
    "flutter_build_runner",
    "Corre code generation de Dart (build_runner): build / watch / clean.",
    { ...configArg, action: z.enum(["build", "watch", "clean"]).optional() },
    async (a: { config?: string; action?: string }) => {
      const act = a.action ?? "build";
      const extra = act === "build" ? " --delete-conflicting-outputs" : "";
      return runText("build_runner", `dart run build_runner ${act}${extra}`, ctx(a).host);
    }
  );

  server.tool(
    "flutter_gen_icons",
    "Genera los íconos de la app (flutter_launcher_icons).",
    { ...configArg },
    async (a: { config?: string }) =>
      runText("flutter_launcher_icons", "dart run flutter_launcher_icons", ctx(a).host)
  );

  server.tool(
    "flutter_gen_splash",
    "Genera el splash nativo (flutter_native_splash).",
    { ...configArg },
    async (a: { config?: string }) =>
      runText("flutter_native_splash", "dart run flutter_native_splash:create", ctx(a).host)
  );

  server.tool(
    "js_lint",
    "Corre ESLint en un proyecto JS/TS (React Native, Expo).",
    { ...configArg, fix: z.boolean().optional() },
    async (a: { config?: string; fix?: boolean }) =>
      runText("eslint", `npx --yes eslint .${a.fix ? " --fix" : ""}`, ctx(a).host)
  );

  server.tool(
    "js_format",
    "Formatea con Prettier un proyecto JS/TS.",
    { ...configArg, check: z.boolean().optional().describe("Solo chequear, no escribir") },
    async (a: { config?: string; check?: boolean }) =>
      runText("prettier", `npx --yes prettier ${a.check ? "--check" : "--write"} .`, ctx(a).host)
  );

  server.tool(
    "codepush_release",
    "Publica una actualización OTA de React Native vía AppCenter CodePush (appcenter codepush release-react).",
    {
      ...configArg,
      app: z.string().describe("owner/app de AppCenter"),
      deployment: z.string().optional().describe("Deployment (default Staging)"),
      platform: z.enum(["ios", "android"]),
    },
    async (a: { config?: string; app: string; deployment?: string; platform: string }) =>
      runText(
        "codepush release-react",
        `appcenter codepush release-react -a ${a.app} -d ${a.deployment ?? "Staging"} --platform ${a.platform}`,
        ctx(a).host,
        15 * 60 * 1000
      )
  );

  server.tool(
    "android_keystore_create",
    "Genera un upload keystore Android (keytool genkeypair). Útil para configurar la firma de releases por primera vez.",
    {
      ...configArg,
      keystorePath: z.string().describe("Ruta de salida del .jks"),
      alias: z.string().describe("Alias de la clave"),
      storepass: z.string().describe("Password del keystore"),
      dname: z.string().optional().describe("Distinguished name (default CN=Unknown)"),
    },
    async (a: any) => {
      const dn = a.dname ?? "CN=Unknown, OU=Unknown, O=Unknown, L=Unknown, S=Unknown, C=US";
      const cmd = `keytool -genkeypair -v -keystore ${a.keystorePath} -alias ${a.alias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${a.storepass} -keypass ${a.storepass} -dname ${JSON.stringify(dn)}`;
      return runText("keytool genkeypair", cmd, ctx(a).host, 60000);
    }
  );
}
