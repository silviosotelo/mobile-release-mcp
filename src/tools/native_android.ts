import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

export function registerNativeAndroid(server: McpServer): void {
  server.tool(
    "android_gradle",
    "Corre una tarea Gradle arbitraria (./gradlew <task>) en el módulo Android.",
    { ...configArg, task: z.string().describe("ej. assembleRelease, bundleRelease, test, lint, clean"), dir: z.string().optional().describe("Dir del proyecto gradle (default android)"), extraArgs: z.string().optional() },
    async (a: { config?: string; task: string; dir?: string; extraArgs?: string }) =>
      runText(`gradle ${a.task}`, `cd ${a.dir ?? "android"} && ./gradlew ${a.task} ${a.extraArgs ?? ""}`.trim(), ctx(a).host)
  );

  server.tool(
    "android_build",
    "Compila la app Android: APK (assemble) o AAB (bundle) para un variant.",
    { ...configArg, artifact: z.enum(["apk", "aab"]), variant: z.string().optional().describe("Default Release"), dir: z.string().optional() },
    async (a: { config?: string; artifact: "apk" | "aab"; variant?: string; dir?: string }) => {
      const v = a.variant ?? "Release";
      const task = a.artifact === "aab" ? `bundle${v}` : `assemble${v}`;
      return runText(`android build ${a.artifact}`, `cd ${a.dir ?? "android"} && ./gradlew ${task}`, ctx(a).host);
    }
  );

  server.tool(
    "android_test",
    "Corre tests Android: unit (testDebugUnitTest) o instrumented (connectedAndroidTest).",
    { ...configArg, kind: z.enum(["unit", "instrumented"]).optional(), dir: z.string().optional() },
    async (a: { config?: string; kind?: string; dir?: string }) => {
      const task = a.kind === "instrumented" ? "connectedAndroidTest" : "testDebugUnitTest";
      return runText(`android test (${a.kind ?? "unit"})`, `cd ${a.dir ?? "android"} && ./gradlew ${task}`, ctx(a).host);
    }
  );

  server.tool(
    "android_lint",
    "Corre Android Lint (./gradlew lint).",
    { ...configArg, dir: z.string().optional() },
    async (a: { config?: string; dir?: string }) => runText("android lint", `cd ${a.dir ?? "android"} && ./gradlew lint`, ctx(a).host)
  );

  server.tool(
    "android_adb",
    "Ejecuta un comando adb. Acciones comunes: devices, install (apkPath), uninstall (package), logcat (filtro), shell (cmd).",
    {
      ...configArg,
      action: z.enum(["devices", "install", "uninstall", "logcat", "shell"]),
      arg: z.string().optional().describe("apkPath / package / filtro / comando según la acción"),
      serial: z.string().optional().describe("Serial del device (-s)"),
    },
    async (a: { config?: string; action: string; arg?: string; serial?: string }) => {
      const s = a.serial ? `-s ${a.serial} ` : "";
      let cmd: string;
      switch (a.action) {
        case "devices": cmd = "adb devices -l"; break;
        case "install": cmd = `adb ${s}install -r ${a.arg}`; break;
        case "uninstall": cmd = `adb ${s}uninstall ${a.arg}`; break;
        case "logcat": cmd = `adb ${s}logcat -d ${a.arg ?? ""} | tail -200`; break;
        case "shell": cmd = `adb ${s}shell ${a.arg ?? ""}`; break;
        default: cmd = "adb devices";
      }
      return runText(`adb ${a.action}`, cmd, ctx(a).host, 120000);
    }
  );
}
