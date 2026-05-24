import { spawn } from "node:child_process";

/**
 * Describes WHERE and HOW shell commands run. The same project can build
 * locally (on a macOS host) or on a remote macOS host over SSH (handy when
 * driving the tool from a non-mac machine or CI).
 */
export interface ExecHost {
  /** If set, commands run via `ssh <ssh> "<cmd>"`. Omit to run locally. */
  ssh?: string;
  /** Working directory on the (local or remote) host. */
  cwd?: string;
  /** Env tweaks applied before the command (build-host quirks). */
  env?: {
    /** Dirs prepended to PATH (e.g. CocoaPods at /usr/local/bin, gem bins). */
    pathPrepend?: string[];
    /** Locale (fastlane/CocoaPods want UTF-8). */
    lang?: string;
    /** Extra KEY=VALUE exports. */
    vars?: Record<string, string>;
  };
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The fully composed command (for logging/debugging). */
  command: string;
}

function shSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Compose the inner shell script (cd + env exports + command). */
export function composeScript(command: string, host: ExecHost): string {
  const parts: string[] = [];
  if (host.cwd) parts.push(`cd ${shSingleQuote(host.cwd)}`);
  if (host.env?.lang) parts.push(`export LANG=${host.env.lang} LC_ALL=${host.env.lang}`);
  if (host.env?.pathPrepend?.length) {
    parts.push(`export PATH=${host.env.pathPrepend.join(":")}:$PATH`);
  }
  for (const [k, v] of Object.entries(host.env?.vars ?? {})) {
    parts.push(`export ${k}=${shSingleQuote(v)}`);
  }
  parts.push(command);
  return parts.join(" && ");
}

/**
 * Run a shell command on the configured host. Captures stdout/stderr and the
 * exit code (never throws on a non-zero exit — callers decide what to do).
 */
export function run(
  command: string,
  host: ExecHost = {},
  opts: { timeoutMs?: number; stdin?: string } = {}
): Promise<ExecResult> {
  const inner = composeScript(command, host);
  const file = host.ssh ? "ssh" : "bash";
  const args = host.ssh ? [host.ssh, inner] : ["-lc", inner];
  const display = host.ssh ? `ssh ${host.ssh} ${shSingleQuote(inner)}` : inner;

  return new Promise<ExecResult>((resolve) => {
    const child = spawn(file, args, { windowsHide: true });
    if (opts.stdin !== undefined) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;
    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        stderr += `\n[mobile-release-mcp] timeout after ${opts.timeoutMs}ms`;
      }, opts.timeoutMs);
    }
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: stderr + String(err), command: display });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr, command: display });
    });
  });
}

/** Truncate long output for MCP text responses. */
export function tail(s: string, max = 4000): string {
  if (s.length <= max) return s;
  return "…(truncado)\n" + s.slice(s.length - max);
}

/**
 * Write a helper script (ruby/python/bash) to the host's /tmp via stdin and
 * run it. Works for both local and SSH hosts (the script never touches the
 * controlling machine's filesystem). `args` is appended raw to the interpreter
 * invocation, so quote values that need it.
 */
export function runScript(
  interpreter: "ruby" | "python3" | "bash",
  scriptContent: string,
  host: ExecHost = {},
  opts: { args?: string; timeoutMs?: number } = {}
): Promise<ExecResult> {
  const ext = interpreter === "ruby" ? "rb" : interpreter === "python3" ? "py" : "sh";
  const tmp = `/tmp/mr_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
  const cmd = `cat > ${tmp} && ${interpreter} ${tmp} ${opts.args ?? ""}; rc=$?; rm -f ${tmp}; exit $rc`;
  return run(cmd, host, { stdin: scriptContent, timeoutMs: opts.timeoutMs });
}
