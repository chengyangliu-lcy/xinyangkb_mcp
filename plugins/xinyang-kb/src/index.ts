import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface RuntimeConfig {
  searchApiUrl?: string;
  apiServerBaseUrl?: string;
}

function loadRuntimeConfig(): RuntimeConfig {
  const configPath =
    process.env.XINYANG_KB_CONFIG ??
    path.join(os.homedir(), ".config", "xinyang-kb", "config.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    throw new Error(
      `Unable to read Xinyang KB config at ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const runtimeConfig = loadRuntimeConfig();
const configuredSearchApiUrl =
  process.env.SEARCH_API_URL ?? runtimeConfig.searchApiUrl;
const configuredApiServerBaseUrl =
  process.env.API_SERVER_BASE_URL ?? runtimeConfig.apiServerBaseUrl;

if (!configuredSearchApiUrl || !configuredApiServerBaseUrl) {
  console.error(
    "Fatal: configure SEARCH_API_URL and API_SERVER_BASE_URL via environment variables " +
      "or ~/.config/xinyang-kb/config.json"
  );
  process.exit(1);
}

const SEARCH_API_URL: string = configuredSearchApiUrl;
const API_SERVER_BASE_URL: string = configuredApiServerBaseUrl;

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
  version: "1.1.0",
}, {
  instructions:
    "Use knowledge_base_search for questions about Xinyang internal products, technical plans, " +
    "company policies, processes, projects, or internal documents. Do not call the backend API directly. " +
    "Base answers on retrieved results, distinguish internal from public sources, and cite document URLs.",
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
