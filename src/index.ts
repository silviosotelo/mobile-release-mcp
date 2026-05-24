#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDoctor } from "./tools/doctor.js";
import { registerShorebird } from "./tools/shorebird.js";

const server = new McpServer({
  name: "mobile-release-mcp",
  version: "0.1.0",
});

registerDoctor(server);
registerShorebird(server);

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is reserved for the MCP protocol; logs go to stderr.
console.error("mobile-release-mcp listo (stdio).");
