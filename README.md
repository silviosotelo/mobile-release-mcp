# mobile-release-mcp

An **MCP server** that automates mobile app releases — **fastlane** (match, snapshot, beta, release), **Shorebird** OTA, **App Store Connect** and **Google Play** — for Flutter / iOS / Android projects.

Built so an AI agent (Claude Code, etc.) can drive your whole release flow in natural language, with the real-world gotchas already solved. **Config-driven and project-agnostic** — nothing is hardcoded; point it at any project via a small config file.

> Status: early. Core (`doctor`, `shorebird_release`, `shorebird_patch`) implemented and working. `store_status`, `release_*`, `beta_*`, `match`, `snapshot`, `setup` on the roadmap below.

## Why

Tools like fastlane and Shorebird are powerful but full of sharp edges that only bite in production:

- iOS **codesign fails over SSH** unless the login keychain is unlocked + key-partition-list set.
- **CocoaPods** silently skips a new native plugin if `pod` isn't on `PATH`.
- Shorebird `shorebird patch` throws **`UnpatchableChangeException`** when a new icon changes the tree-shaken `MaterialIcons.otf` — fixed by building releases with `--no-tree-shake-icons`.
- App Store rejects re-using an **approved version string** ("train closed"); Google Play needs a **higher `versionCode`**.
- `fastlane deliver` doesn't reliably set **`whatsNew`** — set it via spaceship, then submit with `skip_metadata`.
- Replacing an **in-review** iOS build means cancel review → rename the editable version → re-attach.

`mobile-release-mcp` encodes these so you don't relearn them at 2am.

## Architecture

- **TypeScript / Node**, MCP over stdio (`@modelcontextprotocol/sdk`).
- Thin orchestration layer: it shells out to `flutter`, `shorebird`, `fastlane`, `xcrun`, `gradle`.
- **Local or remote execution**: run on the macOS build host, or set `remote.ssh` to drive a remote Mac over SSH (great when your editor is on another machine or for CI).
- **Per-project config** (`mobile-release.config.json`) — see `examples/`.

## Install

```bash
npm install
npm run build
```

Register it in your MCP client (e.g. Claude Code `~/.claude.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "mobile-release": {
      "command": "node",
      "args": ["/abs/path/to/mobile-release-mcp/dist/index.js"]
    }
  }
}
```

Then put a `mobile-release.config.json` in your project (copy `examples/mobile-release.config.example.json`). Credentials (`.p8`, Play JSON, keystore) live **outside** the repo.

## Tools

| Tool | Status | What it does |
|------|--------|--------------|
| `doctor` | ✅ | Validates the build host: flutter, shorebird, fastlane, CocoaPods, locale, credentials. Local or over SSH. |
| `shorebird_release` | ✅ | New Shorebird release (binary). Builds with `--no-tree-shake-icons`; unlocks keychain for iOS codesign. |
| `shorebird_patch` | ✅ | OTA patch (Dart-only) over a release. Detects & explains `UnpatchableChangeException`. |
| `store_status` | 🔜 | App Store review state + Google Play track state. |
| `check_store_version` | 🔜 | Latest store version vs installed (store-update detection). |
| `release_ios` | 🔜 | Create version, set release notes, attach build, submit (handles train-closed, in-review replacement, export compliance). |
| `release_android` | 🔜 | Upload AAB to a Play track (versionCode checks). |
| `beta_ios` / `beta_android` | 🔜 | TestFlight / Play internal testing. |
| `match` | 🔜 | Team code signing via fastlane match. |
| `snapshot` | 🔜 | Automated screenshots via fastlane snapshot. |
| `setup` | 🔜 | Scaffold Appfile/Fastfile from your Xcode/Gradle project. |

## Config reference

See `examples/mobile-release.config.example.json`. Key fields: `projectDir`, optional `remote.ssh`, `env` (PATH prepends + UTF-8 `lang`), `ios` (bundleId, App Store Connect API key, optional keychain), `android` (packageName, Play service account), `shorebird`, `match`.

## License

MIT © Silvio Sotelo
