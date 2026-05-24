import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, errText, runText } from "./common.js";

export function registerSigning(server: McpServer): void {
  server.tool(
    "match",
    "fastlane match: gestiona certificados/perfiles de firma iOS compartidos vía un repo git. Sincroniza (readonly por defecto) o regenera. Requiere match.gitUrl en el config (y MATCH_PASSWORD en el entorno del host).",
    {
      ...configArg,
      type: z.enum(["appstore", "adhoc", "development", "enterprise"]).optional().describe("Default appstore o match.type del config"),
      readonly: z.boolean().optional().describe("Solo descargar (default true). false regenera/sube."),
    },
    async (a: { config?: string; type?: string; readonly?: boolean }) => {
      const { cfg, host } = ctx(a);
      const gitUrl = cfg.match?.gitUrl;
      if (!gitUrl) return errText("Falta match.gitUrl en el config.");
      const type = a.type ?? cfg.match?.type ?? "appstore";
      const ro = a.readonly === false ? "false" : "true";
      const appId = cfg.ios?.bundleId ? `--app_identifier ${cfg.ios.bundleId}` : "";
      const cmd = `fastlane match ${type} --git_url ${gitUrl} ${appId} --readonly ${ro}`;
      return runText(`match ${type}`, cmd, host, 8 * 60 * 1000);
    }
  );

  server.tool(
    "dsym_upload_crashlytics",
    "Sube símbolos dSYM a Firebase Crashlytics (fastlane upload_symbols_to_crashlytics) para simbolicar crashes.",
    {
      ...configArg,
      dsymPath: z.string().describe("Ruta a los dSYM (.dSYM o carpeta/zip)"),
      gspPath: z.string().optional().describe("Ruta a GoogleService-Info.plist"),
    },
    async (a: { config?: string; dsymPath: string; gspPath?: string }) => {
      const { host } = ctx(a);
      const gsp = a.gspPath ? `gsp_path:${a.gspPath}` : "";
      return runText("upload_symbols_to_crashlytics", `fastlane run upload_symbols_to_crashlytics dsym_path:${a.dsymPath} ${gsp}`.trim(), host, 8 * 60 * 1000);
    }
  );
}
