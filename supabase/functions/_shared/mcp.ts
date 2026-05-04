// Minimal MCP (Model Context Protocol) Streamable HTTP client.
// Spec requires Accept: application/json, text/event-stream on POST.

export type McpServerCfg = {
  id?: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
};

export type McpTool = {
  name: string;          // namespaced: "<server>__<tool>"
  rawName: string;       // original tool name
  server: McpServerCfg;
  description?: string;
  inputSchema?: any;
};

let idCounter = 1;

async function rpc(server: McpServerCfg, method: string, params?: any): Promise<any> {
  const body = { jsonrpc: "2.0", id: idCounter++, method, params: params ?? {} };
  const r = await fetch(server.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(server.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`MCP ${server.name} ${method} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    // Parse SSE: pick the first data: line that contains "result" or "error"
    const text = await r.text();
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const json = t.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        if (parsed.result !== undefined || parsed.error) return parsed.result ?? Promise.reject(parsed.error);
      } catch { /* ignore */ }
    }
    throw new Error(`MCP ${server.name} ${method}: empty SSE`);
  }
  const j = await r.json();
  if (j.error) throw new Error(`MCP ${server.name} ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function initialize(server: McpServerCfg): Promise<void> {
  await rpc(server, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "lovable-agent", version: "1.0" },
  }).catch((e) => console.warn(`MCP init ${server.name} skipped:`, e?.message));
}

export async function listMcpTools(servers: McpServerCfg[]): Promise<McpTool[]> {
  const all: McpTool[] = [];
  for (const s of servers) {
    try {
      await initialize(s);
      const res = await rpc(s, "tools/list");
      const tools = res?.tools ?? [];
      for (const t of tools) {
        all.push({
          name: `${slug(s.name)}__${t.name}`,
          rawName: t.name,
          server: s,
          description: t.description,
          inputSchema: t.inputSchema ?? { type: "object", properties: {} },
        });
      }
    } catch (e) {
      console.error(`MCP ${s.name} list failed:`, e);
    }
  }
  return all;
}

export async function callMcpTool(tool: McpTool, args: any): Promise<any> {
  await initialize(tool.server);
  const res = await rpc(tool.server, "tools/call", { name: tool.rawName, arguments: args ?? {} });
  // res.content is an array of {type:"text", text:"..."} blocks usually
  const blocks = res?.content ?? [];
  const textOut = blocks
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  return textOut || JSON.stringify(res);
}

export function toOpenAITools(mcpTools: McpTool[]): any[] {
  return mcpTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description ?? `MCP tool from ${t.server.name}`,
      parameters: t.inputSchema ?? { type: "object", properties: {} },
    },
  }));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "mcp";
}
