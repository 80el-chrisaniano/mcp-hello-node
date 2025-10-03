import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

// health endpoint (Render will like this)
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Build MCP server
const server = new McpServer(
  { name: "hello-mcp-node", version: "1.0.0" },
  { capabilities: { logging: {} } }
);

// Example tool
server.registerTool(
  "greet",
  {
    title: "Greet",
    description: "Return a friendly greeting",
    inputSchema: { name: z.string().optional() }
  },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name || "World"}!` }]
  })
);

// STATeless transport: no SSE or sessions needed
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});

// Connect once before serving requests
await server.connect(transport);

// Only POST /mcp is meaningful in stateless mode
app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

// Explicit 405s for GET/DELETE so it’s clear we’re stateless
app.get("/mcp", (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null
  })
);
app.delete("/mcp", (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null
  })
);

const port = Number(process.env.PORT || 8000);
app.set("trust proxy", 1);
app.listen(port, () => {
  console.log(`MCP server listening on http://localhost:${port}/mcp`);
});
