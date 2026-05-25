<p align="center"><b>mobile-release-mcp</b></p>

<p align="center">
  <a href="https://github.com/silviosotelo/mobile-release-mcp/actions/workflows/ci.yml"><img src="https://github.com/silviosotelo/mobile-release-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mobile-release-mcp"><img src="https://img.shields.io/npm/v/mobile-release-mcp.svg" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT"></a>
  <img src="https://img.shields.io/badge/platform-macOS-blue.svg" alt="macOS">
  <img src="https://img.shields.io/badge/MCP-server-purple.svg" alt="MCP">
</p>

An **MCP server** that lets an AI agent (Claude Code, Cursor, …) build, test and **ship mobile apps** in plain language — for **Flutter, React Native, Expo, native iOS/Swift and native Android**.

It wraps the tools you already use — `flutter`, `gradle`, `xcodebuild`, `fastlane`, `shorebird`, `eas`, `adb`, App Store Connect & Google Play APIs — into **59 MCP tools**, and bakes in the production gotchas (keychain unlock for SSH codesign, CocoaPods `PATH`, Shorebird icon tree-shaking, App Store version rules, …). For any fastlane action without a dedicated tool, use the generic `fastlane_run`.

> **You don't call the tools by hand.** You tell your agent *"build the Android release and upload it to the Play internal track"* and it picks the right tool with the right arguments, reading everything else from your config file.

---

## Table of contents

1. [How it works](#how-it-works)
2. [Requirements](#requirements)
3. [Quick start](#quick-start) (install → configure → register)
4. [The config file](#the-config-file) ← **start here if you're confused**
5. [Getting credentials](#getting-credentials) (App Store Connect, Google Play, keychain, match)
6. [Per-framework examples](#per-framework-examples)
7. [Register in your MCP client](#register-in-your-mcp-client)
8. [Usage examples](#usage-examples)
9. [Tool reference](#tool-reference)
10. [Troubleshooting](#troubleshooting)

---

## How it works

```
┌────────────────┐   MCP (stdio)   ┌──────────────────┐   shell (local or ssh)   ┌──────────────────┐
│  Your AI agent │ ───────────────▶│ mobile-release-  │ ────────────────────────▶│  Build host (mac) │
│ (Claude Code…) │                 │  mcp (this repo) │                          │ flutter/fastlane… │
└────────────────┘                 └──────────────────┘                          └──────────────────┘
```

- The server is **Node/TypeScript**, talks MCP over **stdio**.
- Every tool reads a small **per-project config file** (`mobile-release.config.json`) — nothing is hardcoded.
- Commands run **locally** on the build machine, **or on a remote macOS host over SSH** (set `remote.ssh`). The SSH mode is what lets you drive a Mac build host from a Windows/Linux editor or from CI.

---

## Requirements

**On the build host** (where the apps actually compile — must be **macOS for any iOS work**):

| For… | You need |
|------|----------|
| Everything | the relevant SDK on `PATH` |
| Flutter | `flutter` (e.g. via [Shorebird](https://shorebird.dev) or fvm) |
| React Native / Expo | Node, `npm`/`yarn`, `npx`, `eas-cli` (Expo) |
| iOS / Swift | Xcode + command-line tools, **CocoaPods** (`pod`) |
| Android | JDK + Android SDK, `adb`, Gradle wrapper |
| Releasing | [`fastlane`](https://fastlane.tools) and/or [`shorebird`](https://shorebird.dev) |
| Play uploads | Python 3 + `pip install google-api-python-client google-auth` |

**On the machine running the MCP server**: Node ≥ 18. (Can be the same Mac, or a different machine that SSHes to the Mac.)

---

## Quick start

```bash
# 1) Install & build
git clone https://github.com/silviosotelo/mobile-release-mcp
cd mobile-release-mcp
npm install
npm run build

# 2) Create a config for your app (copy an example and edit it)
cp examples/flutter.config.json /path/to/your-app/mobile-release.config.json
#   …edit projectDir, bundle id, package name, key paths…

# 3) Sanity check (replace the path with your config)
node scripts/call.mjs doctor '{"config":"/path/to/your-app/mobile-release.config.json"}'
```

If `doctor` shows ✅ for the tools you need, you're ready. Then [register it in your MCP client](#register-in-your-mcp-client).

---

## The config file

Each project gets one `mobile-release.config.json`. Every tool accepts an optional `config` argument with its path (default: `./mobile-release.config.json`). **Credentials are referenced by path — never copied into the file**, and the file with real paths is git-ignored.

### Full reference (all fields optional except `projectDir`)

```jsonc
{
  // REQUIRED — absolute path to the project root ON THE BUILD HOST
  "projectDir": "/Users/you/apps/my-app",

  // OPTIONAL — run all commands on a remote macOS host over SSH.
  // The value is an SSH host alias from your ~/.ssh/config (e.g. "mac").
  // Omit this whole block to run locally.
  "remote": { "ssh": "mac" },

  // OPTIONAL — build-host environment quirks
  "env": {
    // dirs prepended to PATH so the host finds pod/gems/flutter/shorebird
    "pathPrepend": ["/usr/local/bin", "/Users/you/.shorebird/bin"],
    // fastlane & CocoaPods require a UTF-8 locale
    "lang": "en_US.UTF-8"
  },

  // OPTIONAL — iOS / App Store
  "ios": {
    "bundleId": "com.example.app",
    "appStoreConnect": {                       // App Store Connect API key
      "keyId": "XXXXXXXXXX",                   // the 10-char key id
      "issuerId": "00000000-0000-0000-...",    // the issuer UUID
      "keyPath": "~/keys/AuthKey_XXXXXXXXXX.p8" // the .p8 file (outside the repo)
    },
    "appStoreCountry": "us",                   // iTunes lookup country for check_store_version
    "keychain": {                              // only needed for codesign over SSH
      "path": "~/Library/Keychains/login.keychain-db",
      "password": "<your-mac-login-password>"
    },
    "scheme": "Runner",                        // defaults for ios_build_app (gym)
    "workspace": "ios/Runner.xcworkspace"      // or "xcodeProject": "ios/Runner.xcodeproj"
  },

  // OPTIONAL — Android / Google Play
  "android": {
    "packageName": "com.example.app",
    "playServiceAccountJson": "~/keys/play-service-account.json"
  },

  // OPTIONAL — Shorebird OTA
  "shorebird": {
    "enabled": true,
    "noTreeShakeIcons": true   // keep full icon font so OTA patches don't break
  },

  // OPTIONAL — fastlane match (team code signing)
  "match": {
    "gitUrl": "git@github.com:you/certificates.git",
    "type": "appstore"
  }
}
```

### What each block is for

- **`projectDir`** — where your app lives on the build host. With `remote.ssh`, this is a path on the *remote* Mac.
- **`remote.ssh`** — set it to an SSH alias (so `ssh mac "..."` works without a password — use SSH keys). Leave it out to build locally.
- **`env.pathPrepend`** — the #1 cause of "command not found" / "CocoaPods not installed". Add the dirs where `pod`, your gems, `flutter` and `shorebird` live. Find them on the host with `which pod flutter shorebird`.
- **`ios.appStoreConnect`** — needed for `store_status`, `beta_ios`, `release_ios`, `check_store_version`. See [Getting credentials](#getting-credentials).
- **`ios.keychain`** — only if you build/sign iOS over SSH (the login keychain is locked in non-interactive sessions). Holds your macOS login password so `codesign` can use the signing key.
- **`ios.scheme` / `ios.workspace` / `ios.xcodeProject`** — defaults for `ios_build_app` (fastlane gym). Any of them can be overridden per call.
- **`android.playServiceAccountJson`** — needed for `store_status`, `release_android`, `beta_android`.
- **`shorebird`** — for `shorebird_release` / `shorebird_patch`.
- **`match`** — for the `match` tool.

---

## Getting credentials

### App Store Connect API key (`ios.appStoreConnect`)

1. App Store Connect → **Users and Access → Integrations → App Store Connect API**.
2. **Generate API Key** (role *App Manager* or higher to submit). Download the **`.p8`** file (you can only download it once).
3. From that screen take the **Key ID** (10 chars) and the **Issuer ID** (UUID at the top).
4. Put the `.p8` outside your repo (e.g. `~/keys/`) and fill `keyId`, `issuerId`, `keyPath`.

### Google Play service account (`android.playServiceAccountJson`)

1. Google Play Console → **Users and permissions** (or *Setup → API access*) → create/link a **service account** in Google Cloud.
2. In Google Cloud Console → that service account → **Keys → Add key → JSON** → download.
3. Back in Play Console, **grant the service account release permissions** on your app (invite its `…@….iam.gserviceaccount.com` email under *Users and permissions*). Without this you get `403 The caller does not have permission`.
4. Point `playServiceAccountJson` at the downloaded JSON (outside the repo).

### Keychain password (`ios.keychain`, SSH builds only)

Only needed when the MCP runs over SSH and must **codesign** iOS. It's your **macOS login password**; the tool runs `security unlock-keychain` + `set-key-partition-list` so `codesign` works non-interactively. If you build locally in a normal desktop session, omit this.

### match (`match.gitUrl`)

A **private git repo** that stores your encrypted certificates/profiles. Run `fastlane match init` once to create it; set `match.gitUrl` and export `MATCH_PASSWORD` on the host.

---

## Per-framework examples

Minimal configs live in [`examples/`](examples/):

- [`flutter.config.json`](examples/flutter.config.json)
- [`react-native.config.json`](examples/react-native.config.json)
- [`expo.config.json`](examples/expo.config.json)

A Flutter project that only wants Android Play uploads needs just `projectDir`, `env`, and `android`. An Expo project that uses EAS for everything may need almost nothing in this file (EAS reads its own `eas.json`).

---

## Register in your MCP client

After `npm run build`, point your client at `dist/index.js`.

**Claude Code** (`~/.claude.json` or a project `.mcp.json`):

```json
{
  "mcpServers": {
    "mobile-release": {
      "command": "node",
      "args": ["/absolute/path/to/mobile-release-mcp/dist/index.js"]
    }
  }
}
```

**Cursor / other MCP clients**: same idea — `command: "node"`, `args: ["…/dist/index.js"]`, stdio transport.

Tip: keep one `mobile-release.config.json` per project and tell the agent which one to use, or pass `config` explicitly in your prompt.

---

## Usage examples

Talk to your agent naturally; it maps to tools:

| You say… | Tool(s) used |
|----------|--------------|
| "Run flutter analyze and the tests" | `flutter_analyze`, `flutter_test` |
| "Build the Android app bundle in release" | `flutter_build` (or `android_build`) |
| "Cut a Shorebird release for iOS" | `shorebird_release` |
| "Ship this Dart fix over the air to 1.4.0+30" | `shorebird_patch` |
| "Build & export a signed IPA" | `ios_build_app` (fastlane gym) |
| "Upload the IPA to TestFlight" | `beta_ios` (fastlane pilot) |
| "Run a fastlane action I don't have a tool for" | `fastlane_run` |
| "Submit version 1.4.0 build 30 to the App Store" | `release_ios` |
| "Push the AAB to the Play internal track" | `beta_android` |
| "Is my new version approved yet?" | `store_status` |
| "Take App Store screenshots" | `snapshot` |
| "Bump the version to 1.4.0 build 30" | `version_set` |

---

## Tool reference

**Diagnostics & setup** — `doctor`, `setup_fastlane`
**Flutter** — `flutter_build`, `flutter_test`, `flutter_analyze`, `flutter_pub`, `flutter_clean`, `flutter_format`, `flutter_gen_l10n`, `flutter_doctor`, `flutter_build_runner`, `flutter_gen_icons`, `flutter_gen_splash`
**React Native** — `rn_pod_install`, `rn_build_android`, `rn_build_ios`, `rn_bundle`, `rn_test`, `rn_doctor`, `rn_clean`
**Expo** — `expo_eas_build`, `expo_eas_submit`, `expo_eas_update`, `expo_prebuild`, `expo_install`, `expo_doctor`
**Native iOS / Swift** — `ios_xcodebuild`, `ios_export_ipa`, `ios_build_app` (fastlane gym), `ios_pod_install`, `swift_build`, `swift_test`
**Native Android** — `android_gradle`, `android_build`, `android_test`, `android_lint`, `android_adb`
**Devices** — `devices_list`, `ios_simulator`
**Shorebird (OTA)** — `shorebird_release`, `shorebird_patch`
**Stores** — `store_status`, `check_store_version`, `beta_ios`, `release_ios`, `beta_android`, `release_android`
**Signing & assets** — `match`, `dsym_upload_crashlytics`, `snapshot`, `frameit`, `screengrab`
**Versioning & extras** — `version_set`, `git_tag`, `js_lint`, `js_format`, `codepush_release`, `android_keystore_create`, `fastlane_run` (any fastlane action)

Every tool takes an optional `config` argument. Run `doctor` first to verify the host.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `CocoaPods not installed` / `command not found` | `pod`/`flutter`/`shorebird` not on `PATH`. Add their dirs to `env.pathPrepend` (find with `which pod flutter`). |
| iOS build fails at **codesign** over SSH | Login keychain locked. Set `ios.keychain.password` (your macOS login password). |
| `shorebird patch` → **UnpatchableChangeException** (asset changes) | A new icon changed the tree-shaken `MaterialIcons.otf`. Build releases with `shorebird.noTreeShakeIcons: true` (the default here). |
| App Store rejects the build version ("train closed") | The version string must be **higher** than the last approved one. Bump it (`version_set`). |
| Google Play `403 caller does not have permission` | The service account isn't granted release access in Play Console → Users and permissions. |
| Google Play rejects the upload (versionCode) | `versionCode` must be **greater** than what's live. Bump `build`. |
| fastlane / CocoaPods warns about locale | Set `env.lang: "en_US.UTF-8"`. |

---

## License

MIT © Silvio Sotelo
