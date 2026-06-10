import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function envRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Fatal: ${name} environment variable is not set`);
    process.exit(1);
  }
  return value;
}

const SEARCH_API_URL = envRequired("SEARCH_API_URL");
const API_SERVER_BASE_URL = envRequired("API_SERVER_BASE_URL");

function convertPdfPathToUrl(docAddress: string): string {
  if (!docAddress) return docAddress;
  if (docAddress.startsWith("http://") || docAddress.startsWith("https://"))
    return docAddress;
  if (docAddress.startsWith("/pdf/"))
    return `${API_SERVER_BASE_URL}${docAddress}`;
  if (docAddress.startsWith("/data/")) return docAddress;
  return docAddress;
}

interface SearchHit {
  doc_address?: string;
  source_file?: unknown;
  [key: string]: unknown;
}

async function searchKnowledgeBase(
  query: string,
  category: string | null = null,
  topK: number = 10,
  parent: boolean = true
): Promise<string> {
  const payload = {
    mode: "text",
    content: query,
    top_k: topK,
    category,
    parent,
  };

  const response = await fetch(SEARCH_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `HTTP error from search service: ${response.status} - ${text}`
    );
  }

  const data: { results?: SearchHit[] } = await response.json();

  const transformed = (data.results ?? []).map((item) => {
    const { source_file, ...rest } = item;
    return {
      ...rest,
      url: convertPdfPathToUrl(item.doc_address ?? ""),
    };
  });

  return JSON.stringify(transformed, null, 2);
}

const server = new McpServer({
  name: "xinyang-kb",
  version: "1.0.0",
});

server.tool(
  "knowledge_base_search",
  "搜索芯阳公司内部知识库。当用户询问芯阳内部产品参数、技术方案、公司制度、流程、项目信息时，必须使用此工具。禁止直接 curl 或 fetch 调用后端 API，必须通过本工具查询。",
  {
    query: z
      .string()
      .min(1)
      .describe("The search query to look up in the knowledge base"),
  },
  async ({ query }) => {
    try {
      const result = await searchKnowledgeBase(query);
      return {
        content: [{ type: "text" as const, text: result }],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
