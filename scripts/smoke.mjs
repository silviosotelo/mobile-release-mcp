// Smoke test: arranca el server por stdio, lista tools y cierra.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log("TOOLS:", tools.map((t) => t.name).join(", "));
for (const t of tools) {
  console.log(`  - ${t.name}: ${t.description.slice(0, 70)}...`);
}
await client.close();
console.log("SMOKE_OK");
