// src/server.ts
import express, { Request, Response } from "express";
import { z } from "zod";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env that ships alongside the source file
dotenv.config({ path: path.join(__dirname, ".env") });

const server = new McpServer(
  { name: "hello-mcp-node", version: "1.0.0" },
  { capabilities: { logging: {} } }
);

const ensureEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// Register a simple greeting tool that accepts an optional name
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

const apiBase = ensureEnv("API_BASE");
const apiCode = ensureEnv("API_CODE");

// Tool to fetch fixture data from the external API defined in .env
server.registerTool(
  "fetch_external_data",
  {
    title: "Fetch External Data",
    description: "Retrieve fixture data from the upstream API",
    inputSchema: {},
  },
  async () => {
    const url = new URL(apiBase);
    url.searchParams.set("code", apiCode);

    let response;
    try {
      response = await fetch(url.href);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to reach external API: ${message}`,
          },
        ],
        isError: true,
      };
    }

    if (!response.ok) {
      return {
        content: [
          {
            type: "text",
            text: `External API returned ${response.status} ${response.statusText}`,
          },
        ],
        isError: true,
      };
    }

    const rawBody = await response.text();
    try {
      const payload = JSON.parse(rawBody);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to parse JSON response (${message}). Raw body: ${rawBody}`,
          },
        ],
        isError: true,
      };
    }
  }
);

const app = express();
app.use(express.json());

// Stateless transport: sessionIdGenerator stays undefined per SDK guidance
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});

// Connect transport once at startup
await server.connect(transport);

// POST handles JSON-RPC requests
app.post("/mcp", async (req: Request, res: Response) => {
  await transport.handleRequest(req, res, req.body);
});

// In stateless mode, reject unsupported HTTP verbs with 405
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