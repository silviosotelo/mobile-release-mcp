import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { run, tail } from "../exec.js";
import { configArg, ctx, text, errText, keychainPrefix } from "./common.js";

const BUILD_TIMEOUT = 25 * 60 * 1000;

export function registerShorebird(server: McpServer): void {
  server.tool(
    "shorebird_release",
    "Crea un release de Shorebird (build nuevo del binario, sube artefactos al backend de Shorebird). Compila con --no-tree-shake-icons por defecto para que los patches OTA futuros no se rompan por iconos nuevos. En iOS desbloquea el llavero para el codesign si está configurado.",
    {
      ...configArg,
      platform: z.enum(["ios", "android"]).describe("Plataforma a releasear"),
    },
    async (args: { config?: string; platform: "ios" | "android" }) => {
      const { cfg, host } = ctx(args);
      if (!cfg.shorebird?.enabled) {
        return errText("Shorebird no está habilitado en el config (shorebird.enabled = true).");
      }
      const noTreeShake = cfg.shorebird?.noTreeShakeIcons === false ? "" : " -- --no-tree-shake-icons";
      const prefix = args.platform === "ios" ? keychainPrefix(cfg) : "";
      const cmd = `${prefix}shorebird release ${args.platform} --no-confirm${noTreeShake}`;
      const r = await run(cmd, host, { timeoutMs: BUILD_TIMEOUT });
      const published = (r.stdout.match(/Published Release.*/m) || [])[0];
      const status = r.code === 0 && published ? `✅ ${published}` : `❌ exit=${r.code}`;
      return text(`shorebird release ${args.platform}\n${status}\n\n${tail(r.stdout + r.stderr)}`);
    }
  );

  server.tool(
    "shorebird_patch",
    "Publica un patch OTA de Shorebird (solo cambios Dart) sobre un release existente, sin pasar por revisión de tienda. Detecta y explica UnpatchableChangeException (cambios de asset/iconos no patcheables).",
    {
      ...configArg,
      platform: z.enum(["ios", "android"]).describe("Plataforma del patch"),
      releaseVersion: z.string().describe("Versión del release base, ej. 2026.05.24+1222"),
    },
    async (args: { config?: string; platform: "ios" | "android"; releaseVersion: string }) => {
      const { cfg, host } = ctx(args);
      const prefix = args.platform === "ios" ? keychainPrefix(cfg) : "";
      const cmd = `${prefix}shorebird patch --platforms=${args.platform} --release-version=${args.releaseVersion} --no-confirm`;
      const r = await run(cmd, host, { timeoutMs: BUILD_TIMEOUT });
      const out = r.stdout + r.stderr;
      const published = (r.stdout.match(/Published Patch.*/m) || [])[0];
      const unpatchable = /UnpatchableChangeException|asset changes/.test(out);
      let status: string;
      if (r.code === 0 && published) status = `✅ ${published}`;
      else if (unpatchable)
        status =
          "❌ Cambio NO patcheable (asset/iconos). El release base debe compilarse con --no-tree-shake-icons; si no, agregar iconos nuevos cambia MaterialIcons.otf y Shorebird rechaza el patch. Solución: hacer un release nuevo.";
      else status = `❌ exit=${r.code}`;
      return text(`shorebird patch ${args.platform} @ ${args.releaseVersion}\n${status}\n\n${tail(out)}`);
    }
  );
}
