// src/server.ts
import express, { Request, Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer(
  { name: "hello-mcp-node", version: "1.0.0" },
  { capabilities: { logging: {} } }
);

// simple tool
server.registerTool(
  "greet",
  {
    title: "Greet",
    description: "Return a friendly greeting",
    inputSchema: { name: z.string().optional() },
  },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name || "World"}!` }],
  })
);

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ✅ Stateless transport: pass sessionIdGenerator: undefined (required by types)
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,   // <- key line
  enableJsonResponse: true,        // POST replies as JSON
});

// Connect once at startup
await server.connect(transport);

// POST handles JSON-RPC requests
app.post("/mcp", async (req: Request, res: Response) => {
  await transport.handleRequest(req, res, req.body);
});

// In stateless mode, GET/DELETE aren’t used — return 405
app.get("/mcp", (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  })
);
app.delete("/mcp", (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  })
);

const port = Number(process.env.PORT || 8000);
app.listen(port, () =>
  console.log(`MCP server on http://localhost:${port}/mcp`)
);
