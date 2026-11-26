import dotenv from "dotenv";
dotenv.config();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import connectDB from "../config/db.js";
import { createAutobazaarMcpServer } from "./autobazaarMcpServer.js";

async function main() {
  // Redirect console.log during startup so stdout stays strictly reserved for JSON-RPC MCP traffic
  const originalLog = console.log;
  console.log = (...args) => console.error(...args);

  await connectDB();
  const server = createAutobazaarMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("🚗 AutoBazaar MCP Server connected over stdio");
}

main().catch((err) => {
  console.error("❌ Failed to start AutoBazaar MCP stdio server:", err);
  process.exit(1);
});

