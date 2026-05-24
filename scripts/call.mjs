// Llama a un tool del server. Uso: node scripts/call.mjs <tool> '<json-args>'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tool = process.argv[2];
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"] });
const client = new Client({ name: "call", version: "0.0.0" });
await client.connect(transport);
const res = await client.callTool({ name: tool, arguments: args });
for (const c of res.content) if (c.type === "text") console.log(c.text);
await client.close();
