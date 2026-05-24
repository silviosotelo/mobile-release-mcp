#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDoctor } from "./tools/doctor.js";
import { registerShorebird } from "./tools/shorebird.js";
import { registerFlutter } from "./tools/flutter.js";
import { registerReactNative } from "./tools/reactnative.js";
import { registerExpo } from "./tools/expo.js";
import { registerNativeIos } from "./tools/native_ios.js";
import { registerNativeAndroid } from "./tools/native_android.js";
import { registerDevices } from "./tools/devices.js";
import { registerStore } from "./tools/store.js";
import { registerSigning } from "./tools/signing.js";
import { registerScreenshots } from "./tools/screenshots.js";
import { registerSetup } from "./tools/setup.js";
import { registerVersion } from "./tools/version.js";

const server = new McpServer({
  name: "mobile-release-mcp",
  version: "0.1.0",
});

registerDoctor(server);
registerShorebird(server);
registerFlutter(server);
registerReactNative(server);
registerExpo(server);
registerNativeIos(server);
registerNativeAndroid(server);
registerDevices(server);
registerStore(server);
registerSigning(server);
registerScreenshots(server);
registerSetup(server);
registerVersion(server);

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is reserved for the MCP protocol; logs go to stderr.
console.error("mobile-release-mcp listo (stdio).");
