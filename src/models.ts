/**
 * Model definitions and dynamic discovery for Alysis Code Pro via /models endpoint.
 */

import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { ANON_KEY, getModelsUrl } from "./constants.js";

const DEFAULT_CONTEXT_WINDOW = 1_000_000;
const DEFAULT_MAX_TOKENS = 8_192;

const KNOWN_MODEL_METADATA: Record<
  string,
  { name: string; description?: string; vision?: boolean }
> = {
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash (Alysis)",
    description:
      "Default - fast high-volume coding (1M context, free daily allowance)",
    vision: true,
  },
  "deepseek-v4-pro": {
    name: "DeepSeek V4 Pro (Alysis Flagship)",
    description:
      "Flagship - deeper reasoning (1M context, requires Alysis Code Pro)",
    vision: true,
  },
  "deepseek-v4-flash-vision-exp": {
    name: "DeepSeek V4 Flash Vision Exp (Alysis)",
    description: "Vision preview - image understanding at v4-flash rate",
    vision: true,
  },
  "deepseek-v4.1-flash-expires-on-0910": {
    name: "DeepSeek V4.1 Flash Beta (Alysis)",
    description: "V4.1 Flash beta - new architecture, native multimodal",
    vision: true,
  },
};

export const STATIC_MODELS: ProviderModelConfig[] = Object.entries(
  KNOWN_MODEL_METADATA,
).map(([id, meta]) => ({
  id,
  name: meta.name,
  reasoning: true,
  input: meta.vision ? ["text", "image"] : ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: DEFAULT_CONTEXT_WINDOW,
  maxTokens: DEFAULT_MAX_TOKENS,
  compat: {
    supportsDeveloperRole: false,
    supportsStore: false,
    supportsReasoningEffort: false,
    maxTokensField: "max_tokens",
    thinkingFormat: "deepseek",
  },
}));

interface GatewayModelItem {
  id: string;
  object?: string;
  owned_by?: string;
}

interface GatewayModelsResponse {
  object?: string;
  data?: GatewayModelItem[];
}

export function formatModelDisplayName(modelId: string): string {
  const known = KNOWN_MODEL_METADATA[modelId];
  if (known) {
    return known.name;
  }
  const formatted = modelId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${formatted} (Alysis)`;
}

export function toProviderModelConfig(
  item: GatewayModelItem,
): ProviderModelConfig {
  const modelId = item.id.trim();
  const known = KNOWN_MODEL_METADATA[modelId];

  return {
    id: modelId,
    name: formatModelDisplayName(modelId),
    reasoning: true,
    input: known?.vision === false ? ["text"] : ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    compat: {
      supportsDeveloperRole: false,
      supportsStore: false,
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
      thinkingFormat: "deepseek",
    },
  };
}

/**
 * Fetches dynamic models served by the Alysis gateway /models endpoint.
 * Falls back gracefully to STATIC_MODELS on offline or network failure.
 */
export async function fetchDynamicModels(
  accessKey?: string,
  signal?: AbortSignal,
): Promise<ProviderModelConfig[]> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
  };
  if (accessKey) {
    headers.Authorization = `Bearer ${accessKey}`;
  }

  const timeoutSignal = AbortSignal.timeout(6000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(getModelsUrl(), {
      method: "GET",
      headers,
      signal: combinedSignal,
    });

    if (!response.ok) {
      return STATIC_MODELS;
    }

    const payload = (await response.json()) as GatewayModelsResponse;
    const items = payload?.data;

    if (!Array.isArray(items) || items.length === 0) {
      return STATIC_MODELS;
    }

    const seen = new Set<string>();
    const models: ProviderModelConfig[] = [];

    for (const item of items) {
      if (!item || typeof item.id !== "string") {
        continue;
      }
      const trimmed = item.id.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      models.push(toProviderModelConfig(item));
    }

    return models.length > 0 ? models : STATIC_MODELS;
  } catch {
    return STATIC_MODELS;
  }
}
