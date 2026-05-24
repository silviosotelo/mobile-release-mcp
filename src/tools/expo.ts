import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

const EAS_TIMEOUT = 40 * 60 * 1000;

export function registerExpo(server: McpServer): void {
  server.tool(
    "expo_eas_build",
    "Compila una app Expo con EAS Build (eas build). Soporta plataforma, profile (eas.json) y build local.",
    {
      ...configArg,
      platform: z.enum(["ios", "android", "all"]).describe("Plataforma"),
      profile: z.string().optional().describe("Profile de eas.json (default production)"),
      local: z.boolean().optional().describe("Build local (--local) en vez de la nube EAS"),
    },
    async (a: { config?: string; platform: string; profile?: string; local?: boolean }) => {
      const cmd = `eas build --platform ${a.platform} --profile ${a.profile ?? "production"} --non-interactive${a.local ? " --local" : ""}`;
      return runText(`eas build ${a.platform}`, cmd, ctx(a).host, EAS_TIMEOUT);
    }
  );

  server.tool(
    "expo_eas_submit",
    "Envía un build a las tiendas con EAS Submit (eas submit).",
    {
      ...configArg,
      platform: z.enum(["ios", "android"]).describe("Plataforma"),
      profile: z.string().optional(),
      latest: z.boolean().optional().describe("Usar el último build (--latest)"),
    },
    async (a: { config?: string; platform: string; profile?: string; latest?: boolean }) => {
      const cmd = `eas submit --platform ${a.platform} --profile ${a.profile ?? "production"} --non-interactive${a.latest ? " --latest" : ""}`;
      return runText(`eas submit ${a.platform}`, cmd, ctx(a).host, EAS_TIMEOUT);
    }
  );

  server.tool(
    "expo_eas_update",
    "Publica una actualización OTA con EAS Update (eas update) a un branch.",
    { ...configArg, branch: z.string().describe("Branch de EAS Update"), message: z.string().describe("Mensaje del update") },
    async (a: { config?: string; branch: string; message: string }) =>
      runText("eas update", `eas update --branch ${a.branch} --message ${JSON.stringify(a.message)} --non-interactive`, ctx(a).host)
  );

  server.tool(
    "expo_prebuild",
    "Genera los proyectos nativos ios/android (npx expo prebuild).",
    { ...configArg, platform: z.enum(["ios", "android", "all"]).optional(), clean: z.boolean().optional() },
    async (a: { config?: string; platform?: string; clean?: boolean }) => {
      const cmd = `npx expo prebuild${a.platform && a.platform !== "all" ? ` --platform ${a.platform}` : ""}${a.clean ? " --clean" : ""}`;
      return runText("expo prebuild", cmd, ctx(a).host);
    }
  );

  server.tool(
    "expo_install",
    "Instala paquetes con versiones compatibles con el SDK de Expo (npx expo install).",
    { ...configArg, packages: z.string().describe("Paquetes a instalar") },
    async (a: { config?: string; packages: string }) => runText("expo install", `npx expo install ${a.packages}`, ctx(a).host)
  );

  server.tool(
    "expo_doctor",
    "Chequea problemas de dependencias/config en un proyecto Expo (npx expo-doctor).",
    { ...configArg },
    async (a: { config?: string }) => runText("expo doctor", "npx --yes expo-doctor", ctx(a).host)
  );
}
