// src/auth.ts
import { setTimeout as delay } from "node:timers/promises";

// src/constants.ts
var DEFAULT_SUPABASE_URL = "https://vzigujbcjjmpntxhmyvr.supabase.co";
var DEFAULT_SITE_URL = "https://alysiscode.com";
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aWd1amJjamptcG50eGhteXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Mzc0NTIsImV4cCI6MjA5NjUxMzQ1Mn0." + "vLH9q-BNO8IWIZrVlvCw8pZWXdLgmKG4Tl9toTTD3pg";
var PROVIDER_ID = "alysis";
var PROVIDER_LABEL = "Alysis Code Pro";
function getSupabaseUrl() {
  const envUrl = process.env.ALYSIS_SUPABASE_URL;
  return (envUrl ? envUrl.trim() : DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
}
function getSiteUrl() {
  const envUrl = process.env.ALYSIS_SITE_URL;
  return (envUrl ? envUrl.trim() : DEFAULT_SITE_URL).replace(/\/+$/, "");
}
function getGatewayBaseUrl() {
  const envUrl = process.env.ALYSIS_GATEWAY_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return `${getSupabaseUrl()}/functions/v1/llm/v1`;
}
function getDeviceCodeUrl() {
  return `${getSupabaseUrl()}/functions/v1/device-code`;
}
function getDeviceTokenUrl() {
  return `${getSupabaseUrl()}/functions/v1/device-token`;
}
function getModelsUrl() {
  return `${getGatewayBaseUrl()}/models`;
}
function getAccountUrl() {
  return `${getSiteUrl()}/account`;
}
function getActivateUrl(code) {
  const base = `${getSiteUrl()}/activate`;
  return code ? `${base}?code=${encodeURIComponent(code)}` : base;
}

// src/auth.ts
var DEFAULT_POLL_INTERVAL_S = 5;
var DEFAULT_TIMEOUT_S = 900;
function getFunctionHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`
  };
}
async function requestDeviceGrant(signal) {
  const codeResponse = await fetch(getDeviceCodeUrl(), {
    method: "POST",
    headers: getFunctionHeaders(),
    body: JSON.stringify({
      client_name: `pi-agent @ ${process.env.HOSTNAME || "localhost"}`
    }),
    signal
  });
  if (!codeResponse.ok) {
    let errorText = "";
    try {
      errorText = await codeResponse.text();
    } catch {}
    throw new Error(`Failed to start authentication flow (${codeResponse.status}): ${errorText || codeResponse.statusText}`);
  }
  const grant = await codeResponse.json();
  const userCode = grant.user_code?.trim();
  const deviceCode = grant.device_code?.trim();
  if (!userCode || !deviceCode) {
    throw new Error("Alysis login service did not return a valid device code.");
  }
  return {
    userCode,
    deviceCode,
    intervalSeconds: Math.max(grant.interval ?? DEFAULT_POLL_INTERVAL_S, 1),
    expiresInSeconds: Math.max(grant.expires_in ?? DEFAULT_TIMEOUT_S, 10),
    activateUrl: getActivateUrl(userCode)
  };
}
async function sleep(ms, signal) {
  try {
    await delay(ms, undefined, { signal });
  } catch (err) {
    if (signal?.aborted || err instanceof Error && err.name === "AbortError") {
      throw new Error("Login cancelled.");
    }
    throw err;
  }
}
async function pollDeviceToken(grant, callbacks, signal) {
  const deadline = Date.now() + grant.expiresInSeconds * 1000;
  while (Date.now() < deadline) {
    await sleep(grant.intervalSeconds * 1000, signal);
    try {
      const tokenResponse = await fetch(getDeviceTokenUrl(), {
        method: "POST",
        headers: getFunctionHeaders(),
        body: JSON.stringify({ device_code: grant.deviceCode }),
        signal
      });
      if (!tokenResponse.ok) {
        continue;
      }
      const body = await tokenResponse.json();
      const status = (body.status || "").toLowerCase().trim();
      if (status === "approved") {
        const key = body.key?.trim();
        if (!key) {
          throw new Error("Alysis login service indicated approval but returned no gateway key.");
        }
        return key;
      }
      if (status === "denied") {
        throw new Error("Login was rejected on the Alysis website.");
      }
      if (status === "expired" || status === "not_found" || status === "already_claimed") {
        throw new Error("Login code expired or already claimed. Run /login alysis again.");
      }
      const remainingSeconds = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      callbacks.onProgress?.(`Waiting for approval in browser (${remainingSeconds}s remaining)...`);
    } catch (err) {
      if (signal?.aborted || err instanceof Error && err.name === "AbortError") {
        throw new Error("Login cancelled.");
      }
    }
  }
  throw new Error(`Timed out after ${grant.expiresInSeconds}s waiting for approval at ${getAccountUrl()}. Run /login alysis again.`);
}
async function loginAlysis(callbacks, signal) {
  const grant = await requestDeviceGrant(signal);
  callbacks.onDeviceCode({
    userCode: grant.userCode,
    verificationUri: getActivateUrl(),
    intervalSeconds: grant.intervalSeconds,
    expiresInSeconds: grant.expiresInSeconds
  });
  callbacks.onAuth({ url: grant.activateUrl });
  callbacks.onProgress?.("Waiting for approval in browser...");
  const accessKey = await pollDeviceToken(grant, callbacks, signal);
  return {
    access: accessKey,
    refresh: "",
    expires: Date.now() + 365 * 24 * 3600 * 1000
  };
}

// src/models.ts
var DEFAULT_CONTEXT_WINDOW = 1e6;
var DEFAULT_MAX_TOKENS = 16384;
var KNOWN_MODEL_METADATA = {
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash (Alysis)",
    description: "Default - fast high-volume coding (1M context, free daily allowance)",
    vision: true
  },
  "deepseek-v4-pro": {
    name: "DeepSeek V4 Pro (Alysis Flagship)",
    description: "Flagship - deeper reasoning (1M context, requires Alysis Code Pro)",
    vision: true
  },
  "deepseek-v4-flash-vision-exp": {
    name: "DeepSeek V4 Flash Vision Exp (Alysis)",
    description: "Vision preview - image understanding at v4-flash rate",
    vision: true
  },
  "deepseek-v4.1-flash-expires-on-0910": {
    name: "DeepSeek V4.1 Flash Beta (Alysis)",
    description: "V4.1 Flash beta - new architecture, native multimodal",
    vision: true
  }
};
var STATIC_MODELS = Object.entries(KNOWN_MODEL_METADATA).map(([id, meta]) => ({
  id,
  name: meta.name,
  reasoning: true,
  input: meta.vision ? ["text", "image"] : ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: DEFAULT_CONTEXT_WINDOW,
  maxTokens: DEFAULT_MAX_TOKENS,
  compat: {
    thinkingFormat: "deepseek",
    supportsReasoningEffort: true
  }
}));
function formatModelDisplayName(modelId) {
  const known = KNOWN_MODEL_METADATA[modelId];
  if (known) {
    return known.name;
  }
  const formatted = modelId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return `${formatted} (Alysis)`;
}
function toProviderModelConfig(item) {
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
      thinkingFormat: "deepseek",
      supportsReasoningEffort: true
    }
  };
}
async function fetchDynamicModels(accessKey, signal) {
  const headers = {
    apikey: ANON_KEY
  };
  if (accessKey) {
    headers.Authorization = `Bearer ${accessKey}`;
  }
  const timeoutSignal = AbortSignal.timeout(6000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  try {
    const response = await fetch(getModelsUrl(), {
      method: "GET",
      headers,
      signal: combinedSignal
    });
    if (!response.ok) {
      return STATIC_MODELS;
    }
    const payload = await response.json();
    const items = payload?.data;
    if (!Array.isArray(items) || items.length === 0) {
      return STATIC_MODELS;
    }
    const seen = new Set;
    const models = [];
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

// src/usage.ts
function formatTokens(count) {
  if (count >= 1e6) {
    return `${(count / 1e6).toFixed(2)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toLocaleString();
}

class AlysisUsageTracker {
  totalPromptTokens = 0;
  totalCompletionTokens = 0;
  totalCacheReadTokens = 0;
  totalCacheWriteTokens = 0;
  totalTurns = 0;
  lastTurnTokens = 0;
  byModel = new Map;
  recordTurn(modelId, usage) {
    if (!usage) {
      return;
    }
    const prompt = usage.promptTokens ?? usage.input ?? 0;
    const completion = usage.completionTokens ?? usage.output ?? 0;
    const cacheRead = usage.cacheReadTokens ?? usage.cacheRead ?? 0;
    const cacheWrite = usage.cacheWriteTokens ?? usage.cacheWrite ?? 0;
    const turnTotal = usage.totalTokens ?? prompt + completion + cacheWrite;
    this.totalPromptTokens += prompt;
    this.totalCompletionTokens += completion;
    this.totalCacheReadTokens += cacheRead;
    this.totalCacheWriteTokens += cacheWrite;
    this.totalTurns += 1;
    this.lastTurnTokens = turnTotal;
    const currentModelStats = this.byModel.get(modelId) ?? {
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      turns: 0
    };
    currentModelStats.promptTokens += prompt;
    currentModelStats.completionTokens += completion;
    currentModelStats.cacheReadTokens += cacheRead;
    currentModelStats.cacheWriteTokens += cacheWrite;
    currentModelStats.totalTokens += turnTotal;
    currentModelStats.turns += 1;
    this.byModel.set(modelId, currentModelStats);
  }
  getTotalTokens() {
    return this.totalPromptTokens + this.totalCompletionTokens + this.totalCacheWriteTokens;
  }
  getTurnCount() {
    return this.totalTurns;
  }
  getLastTurnTokens() {
    return this.lastTurnTokens;
  }
  formatFooterStatus() {
    const total = this.getTotalTokens();
    if (total === 0) {
      return "Alysis: ready";
    }
    const comp = this.totalCompletionTokens;
    return `Alysis: ${formatTokens(total)} tok (${formatTokens(comp)} out)`;
  }
  formatDetailedMarkdown() {
    const total = this.getTotalTokens();
    const lines = [
      "Alysis Usage:",
      `Total Tokens: ${total.toLocaleString()}`,
      `Input Tokens: ${this.totalPromptTokens.toLocaleString()}`,
      `Output Tokens: ${this.totalCompletionTokens.toLocaleString()}`
    ];
    if (this.totalCacheReadTokens > 0 || this.totalCacheWriteTokens > 0) {
      lines.push(`Cache Read: ${this.totalCacheReadTokens.toLocaleString()}`, `Cache Write: ${this.totalCacheWriteTokens.toLocaleString()}`);
    }
    lines.push(`Turns: ${this.totalTurns}`);
    if (this.byModel.size > 0) {
      lines.push("", "By Model:");
      for (const [model, stats] of this.byModel.entries()) {
        lines.push(`• ${model}: ${stats.totalTokens.toLocaleString()} tokens across ${stats.turns} turn(s) (${stats.promptTokens.toLocaleString()} in, ${stats.completionTokens.toLocaleString()} out)`);
      }
    }
    return lines.join(`
`);
  }
  reset() {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCacheReadTokens = 0;
    this.totalCacheWriteTokens = 0;
    this.totalTurns = 0;
    this.lastTurnTokens = 0;
    this.byModel.clear();
  }
}

// src/index.ts
function registerEventListeners(pi, tracker) {
  pi.on("after_provider_response", (event, ctx) => {
    const isAlysisModel = ctx.model?.provider === PROVIDER_ID;
    const isAlysisGateway = Boolean(event.headers?.["x-alysis-gateway-version"] || event.headers?.["x-alysis-router-version"]);
    if (!isAlysisModel && !isAlysisGateway) {
      return;
    }
    if (event.status === 402) {
      ctx.ui.notify(`Alysis credits exhausted. Add credits at ${getAccountUrl()}`, "error");
    } else if (event.status === 429) {
      ctx.ui.notify(`Alysis rate limit or quota exceeded. Check your account at ${getAccountUrl()}`, "warning");
    }
  });
  pi.on("turn_end", (event, ctx) => {
    if (ctx.model?.provider !== PROVIDER_ID) {
      return;
    }
    const assistantMsg = event.message?.role === "assistant" ? event.message : null;
    const usage = assistantMsg && "usage" in assistantMsg ? assistantMsg.usage : null;
    tracker.recordTurn(ctx.model.id, usage);
    ctx.ui.setStatus(PROVIDER_ID, tracker.formatFooterStatus());
  });
  pi.on("model_select", (event, ctx) => {
    if (event.model.provider === PROVIDER_ID) {
      ctx.ui.setStatus(PROVIDER_ID, tracker.formatFooterStatus());
    } else {
      ctx.ui.setStatus(PROVIDER_ID, undefined);
    }
  });
  pi.on("session_start", (_event, ctx) => {
    tracker.reset();
    if (ctx.model?.provider === PROVIDER_ID) {
      ctx.ui.setStatus(PROVIDER_ID, tracker.formatFooterStatus());
    }
  });
}
function registerCommands(pi, tracker) {
  pi.registerCommand("alysis", {
    description: "Display Alysis Code Pro status, model, and account links",
    handler: async (_args, ctx) => {
      const activeModel = ctx.model?.provider === PROVIDER_ID ? ctx.model.id : "None (inactive)";
      const isConnected = ctx.model?.provider === PROVIDER_ID;
      const totalTokens = tracker.getTotalTokens();
      const turns = tracker.getTurnCount();
      const summary = [
        PROVIDER_LABEL,
        `• Status: ${isConnected ? "Connected" : "Available (use /login alysis or /model alysis/...)"}`,
        `• Model: ${activeModel}`,
        `• Session usage: ${totalTokens.toLocaleString()} tokens (${turns} turns)`,
        `• Account & credits: ${getAccountUrl()}`,
        `• Activate device: ${getActivateUrl()}`
      ].join(`
`);
      ctx.ui.notify(summary, "info");
    }
  });
  pi.registerCommand("alysis-usage", {
    description: "Display token usage for the current session",
    handler: async (_args, ctx) => {
      const text = tracker.formatDetailedMarkdown();
      ctx.ui.notify(text, "info");
    }
  });
  pi.registerCommand("alysis-models", {
    description: "Fetch and sync models from the Alysis gateway",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Fetching models from Alysis gateway...", "info");
      try {
        const models = await fetchDynamicModels();
        pi.registerProvider(PROVIDER_ID, {
          name: PROVIDER_LABEL,
          baseUrl: getGatewayBaseUrl(),
          apiKey: "$ALYSIS_API_KEY",
          api: "openai-completions",
          authHeader: true,
          models,
          refreshModels() {
            return fetchDynamicModels();
          }
        });
        const list = models.map((m) => `• ${m.id}: ${m.name}`).join(`
`);
        ctx.ui.notify(`Synced models (${models.length}):
${list}`, "info");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Failed to fetch models: ${message}`, "error");
      }
    }
  });
  pi.registerCommand("alysis-logout", {
    description: "Instructions to logout or revoke active session",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`To log out locally, run \`/logout ${PROVIDER_ID}\` in Pi. You can also revoke keys at ${getAccountUrl()}`, "info");
    }
  });
}
async function alysisExtension(pi) {
  const usageTracker = new AlysisUsageTracker;
  const initialModels = await fetchDynamicModels();
  pi.registerProvider(PROVIDER_ID, {
    name: PROVIDER_LABEL,
    baseUrl: getGatewayBaseUrl(),
    apiKey: "$ALYSIS_API_KEY",
    api: "openai-completions",
    authHeader: true,
    models: initialModels,
    refreshModels() {
      return fetchDynamicModels();
    },
    oauth: {
      name: PROVIDER_LABEL,
      isSubscription: true,
      login: (callbacks) => loginAlysis(callbacks),
      refreshToken: async (credentials) => credentials,
      getApiKey: (credentials) => credentials.access
    }
  });
  registerEventListeners(pi, usageTracker);
  registerCommands(pi, usageTracker);
}
export {
  alysisExtension as default
};
