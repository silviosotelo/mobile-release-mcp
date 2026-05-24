import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { configArg, ctx, runText } from "./common.js";

function pm(a: { packageManager?: string }): string {
  return a.packageManager ?? "npm";
}

export function registerReactNative(server: McpServer): void {
  server.tool(
    "rn_pod_install",
    "Instala los CocoaPods de un proyecto React Native (cd ios && pod install). Requiere CocoaPods en PATH.",
    { ...configArg, repoUpdate: z.boolean().optional().describe("pod install --repo-update") },
    async (a: { config?: string; repoUpdate?: boolean }) =>
      runText("pod install", `cd ios && pod install${a.repoUpdate ? " --repo-update" : ""}`, ctx(a).host)
  );

  server.tool(
    "rn_build_android",
    "Compila la app Android de un proyecto React Native vía Gradle (assembleRelease / bundleRelease para APK / AAB).",
    { ...configArg, artifact: z.enum(["apk", "aab"]).describe("apk=assembleRelease, aab=bundleRelease"), variant: z.string().optional().describe("Variant (default Release)") },
    async (a: { config?: string; artifact: "apk" | "aab"; variant?: string }) => {
      const v = a.variant ?? "Release";
      const task = a.artifact === "aab" ? `bundle${v}` : `assemble${v}`;
      return runText(`gradle ${task}`, `cd android && ./gradlew ${task}`, ctx(a).host);
    }
  );

  server.tool(
    "rn_build_ios",
    "Compila/archiva la app iOS de un proyecto React Native vía xcodebuild (archive).",
    {
      ...configArg,
      workspace: z.string().describe("Ruta al .xcworkspace (ej. ios/MyApp.xcworkspace)"),
      scheme: z.string().describe("Scheme de Xcode"),
      configuration: z.string().optional().describe("Configuration (default Release)"),
    },
    async (a: { config?: string; workspace: string; scheme: string; configuration?: string }) => {
      const cmd = `xcodebuild -workspace ${a.workspace} -scheme ${a.scheme} -configuration ${a.configuration ?? "Release"} -archivePath build/${a.scheme}.xcarchive archive`;
      return runText("xcodebuild archive (RN)", cmd, ctx(a).host);
    }
  );

  server.tool(
    "rn_bundle",
    "Genera el bundle JS de React Native (react-native bundle) para una plataforma.",
    { ...configArg, platform: z.enum(["ios", "android"]), dev: z.boolean().optional() },
    async (a: { config?: string; platform: string; dev?: boolean }) => {
      const out = a.platform === "ios" ? "ios/main.jsbundle" : "android/app/src/main/assets/index.android.bundle";
      const cmd = `npx react-native bundle --platform ${a.platform} --dev ${a.dev ? "true" : "false"} --entry-file index.js --bundle-output ${out}`;
      return runText(`rn bundle ${a.platform}`, cmd, ctx(a).host);
    }
  );

  server.tool(
    "rn_test",
    "Corre los tests JS (jest) vía el package manager del proyecto.",
    { ...configArg, packageManager: z.enum(["npm", "yarn", "pnpm"]).optional() },
    async (a: { config?: string; packageManager?: string }) => {
      const p = pm(a);
      const cmd = p === "npm" ? "npm test --silent" : `${p} test`;
      return runText("rn test (jest)", cmd, ctx(a).host);
    }
  );

  server.tool(
    "rn_doctor",
    "Diagnóstico del entorno React Native (npx react-native doctor).",
    { ...configArg },
    async (a: { config?: string }) => runText("rn doctor", "npx --yes react-native doctor", ctx(a).host)
  );

  server.tool(
    "rn_clean",
    "Limpia caches de React Native (watchman, metro, gradle, pods).",
    { ...configArg },
    async (a: { config?: string }) =>
      runText(
        "rn clean",
        "watchman watch-del-all 2>/dev/null; rm -rf $TMPDIR/metro-* 2>/dev/null; (cd android && ./gradlew clean) 2>/dev/null; rm -rf ios/Pods ios/build 2>/dev/null; echo clean done",
        ctx(a).host
      )
  );
}
