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

## Tools (57)

**Diagnostics & setup**
- `doctor` — validate the host (flutter, shorebird, fastlane, CocoaPods, xcrun, locale, credentials), local or over SSH.
- `setup_fastlane` — scaffold `fastlane/Appfile` + `Fastfile` (ios/android beta+release lanes) from your config.

**Flutter** — `flutter_build` (apk/aab/ios/ipa/web/macos), `flutter_test`, `flutter_analyze`, `flutter_pub`, `flutter_clean`, `flutter_format`, `flutter_gen_l10n`, `flutter_doctor`.

**React Native** — `rn_pod_install`, `rn_build_android`, `rn_build_ios`, `rn_bundle`, `rn_test`, `rn_doctor`, `rn_clean`.

**Expo** — `expo_eas_build`, `expo_eas_submit`, `expo_eas_update` (OTA), `expo_prebuild`, `expo_install`, `expo_doctor`.

**Native iOS / Swift** — `ios_xcodebuild` (build/test/archive/clean), `ios_export_ipa`, `ios_pod_install`, `swift_build`, `swift_test`.

**Native Android** — `android_gradle`, `android_build` (apk/aab), `android_test`, `android_lint`, `android_adb`.

**Devices / simulators** — `devices_list`, `ios_simulator` (boot/install/launch/terminate/screenshot).

**Shorebird (OTA)** — `shorebird_release` (with `--no-tree-shake-icons`), `shorebird_patch` (detects `UnpatchableChangeException`).

**Stores** — `store_status`, `check_store_version`, `beta_ios` (TestFlight), `release_ios` (create version + notes + attach build + submit; handles in-review replacement / rename), `beta_android` (Play internal), `release_android` (Play track).

**Signing & assets** — `match` (team code signing), `dsym_upload_crashlytics`, `snapshot`, `frameit`, `screengrab`.

**Versioning** — `version_set` (flutter/node/expo/android/ios), `git_tag`.

**Codegen / assets / extras** — `flutter_build_runner`, `flutter_gen_icons`, `flutter_gen_splash`, `js_lint` (ESLint), `js_format` (Prettier), `codepush_release` (RN OTA via AppCenter), `android_keystore_create`.

> Validated end-to-end against a real macOS host over SSH: `doctor`, `store_status` (App Store Connect + Google Play). The rest follow the same execution model.

## Config reference

See `examples/mobile-release.config.example.json`. Key fields: `projectDir`, optional `remote.ssh`, `env` (PATH prepends + UTF-8 `lang`), `ios` (bundleId, App Store Connect API key, optional keychain), `android` (packageName, Play service account), `shorebird`, `match`.

## License

MIT © Silvio Sotelo
