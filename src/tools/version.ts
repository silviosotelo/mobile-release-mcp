import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runScript } from "../exec.js";
import { configArg, ctx, resultText, runText, withVars } from "./common.js";

const VERSION_PY = String.raw`
import os, re, json, sys
fw = os.environ['FW']; ver = os.environ['VER']; build = os.environ.get('BUILD', '')
changed = []
if fw == 'flutter':
    p = 'pubspec.yaml'; s = open(p, encoding='utf-8').read()
    newline = f"version: {ver}" + (f"+{build}" if build else "")
    s2 = re.sub(r'(?m)^version:.*$', newline, s, count=1)
    open(p, 'w', encoding='utf-8').write(s2); changed.append(f"{p} -> {newline}")
elif fw in ('node', 'expo'):
    p = 'package.json'; d = json.load(open(p, encoding='utf-8')); d['version'] = ver
    json.dump(d, open(p, 'w', encoding='utf-8'), indent=2); changed.append(f"{p} version={ver}")
    if fw == 'expo' and os.path.exists('app.json'):
        aj = json.load(open('app.json', encoding='utf-8')); e = aj.setdefault('expo', {}); e['version'] = ver
        if build:
            e.setdefault('ios', {})['buildNumber'] = build
            try: e.setdefault('android', {})['versionCode'] = int(build)
            except ValueError: pass
        json.dump(aj, open('app.json', 'w', encoding='utf-8'), indent=2); changed.append(f"app.json expo.version={ver}")
elif fw == 'android':
    import glob
    cands = glob.glob('android/app/build.gradle') + glob.glob('app/build.gradle') + glob.glob('build.gradle')
    p = cands[0]; s = open(p, encoding='utf-8').read()
    s = re.sub(r'versionName\s+"[^"]*"', f'versionName "{ver}"', s, count=1)
    if build: s = re.sub(r'versionCode\s+\d+', f'versionCode {build}', s, count=1)
    open(p, 'w', encoding='utf-8').write(s); changed.append(f"{p} versionName={ver} versionCode={build or '(sin cambio)'}")
else:
    print('framework no soportado por version_set python:', fw); sys.exit(1)
print('OK:', '; '.join(changed))
`;

export function registerVersion(server: McpServer): void {
  server.tool(
    "version_set",
    "Setea la versión del proyecto según el framework: flutter (pubspec.yaml), node/expo (package.json + app.json), android (build.gradle), ios (agvtool). build es opcional (versionCode/CFBundleVersion).",
    {
      ...configArg,
      framework: z.enum(["flutter", "node", "expo", "android", "ios"]),
      version: z.string().describe("Versión de marketing, ej. 2026.05.24 o 1.4.0"),
      build: z.string().optional().describe("Build number / versionCode"),
    },
    async (a: { config?: string; framework: string; version: string; build?: string }) => {
      const { host } = ctx(a);
      if (a.framework === "ios") {
        const parts = [`agvtool new-marketing-version ${a.version}`];
        if (a.build) parts.push(`agvtool new-version -all ${a.build}`);
        return runText("version_set ios (agvtool)", parts.join(" && "), host, 60000);
      }
      const vars: Record<string, string> = { FW: a.framework, VER: a.version };
      if (a.build) vars.BUILD = a.build;
      const r = await runScript("python3", VERSION_PY, withVars(host, vars), { timeoutMs: 60000 });
      return resultText(`version_set ${a.framework}`, r);
    }
  );

  server.tool(
    "git_tag",
    "Crea un tag git (anotado) en el proyecto y opcionalmente lo pushea.",
    { ...configArg, tag: z.string().describe("ej. v2026.05.24+1222"), message: z.string().optional(), push: z.boolean().optional() },
    async (a: { config?: string; tag: string; message?: string; push?: boolean }) => {
      const { host } = ctx(a);
      const msg = a.message ?? a.tag;
      let cmd = `git tag -a ${JSON.stringify(a.tag)} -m ${JSON.stringify(msg)}`;
      if (a.push) cmd += ` && git push origin ${JSON.stringify(a.tag)}`;
      return runText("git_tag", cmd, host, 120000);
    }
  );
}
