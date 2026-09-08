/**
 * Alysis Code Pro Extension for Pi Coding Agent.
 *
 * Provides:
 * - RFC 8628 Device Authorization Flow login (/login alysis)
 * - Dynamic /models discovery and synchronization
 * - Live token usage tracking and status bar display
 * - Quota/Credit alert notifications on HTTP 402/429
 * - Utility slash commands: /alysis, /alysis-usage, /alysis-models, /alysis-logout
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { loginAlysis } from "./auth.js";
import {
  getAccountUrl,
  getActivateUrl,
  getGatewayBaseUrl,
  PROVIDER_ID,
  PROVIDER_LABEL,
} from "./constants.js";
import { fetchDynamicModels } from "./models.js";
import { AlysisUsageTracker } from "./usage.js";

function registerEventListeners(
  pi: ExtensionAPI,
  tracker: AlysisUsageTracker,
): void {
  // Monitor credit/quota exhaustion errors
  pi.on("after_provider_response", (event, ctx: ExtensionContext) => {
    const isAlysisModel = ctx.model?.provider === PROVIDER_ID;
    const isAlysisGateway = Boolean(
      event.headers?.["x-alysis-gateway-version"] ||
        event.headers?.["x-alysis-router-version"],
    );

    if (!isAlysisModel && !isAlysisGateway) {
      return;
    }

    if (event.status === 402) {
      ctx.ui.notify(
        `Alysis credits exhausted. Add credits at ${getAccountUrl()}`,
        "error",
      );
    } else if (event.status === 429) {
      ctx.ui.notify(
        `Alysis rate limit or quota exceeded. Check your account at ${getAccountUrl()}`,
        "warning",
      );
    }
  });

  // Track token usage on turn completion
  pi.on("turn_end", (event, ctx: ExtensionContext) => {
    if (ctx.model?.provider !== PROVIDER_ID) {
      return;
    }

    const assistantMsg =
      event.message?.role === "assistant" ? event.message : null;
    const usage =
      assistantMsg && "usage" in assistantMsg ? assistantMsg.usage : null;

    tracker.recordTurn(ctx.model.id, usage);
    ctx.ui.setStatus(PROVIDER_ID, tracker.formatFooterStatus());
  });

  // Update footer status on model selection
  pi.on("model_select", (event, ctx: ExtensionContext) => {
    if (event.model.provider === PROVIDER_ID) {
      ctx.ui.setStatus(PROVIDER_ID, tracker.formatFooterStatus());
    } else {
      ctx.ui.setStatus(PROVIDER_ID, undefined);
    }
  });

  // Reset usage tracking on new session start
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    tracker.reset();
    if (ctx.model?.provider === PROVIDER_ID) {
      ctx.ui.setStatus(PROVIDER_ID, tracker.formatFooterStatus());
    }
  });
}

function registerCommands(pi: ExtensionAPI, tracker: AlysisUsageTracker): void {
  // /alysis
  pi.registerCommand("alysis", {
    description: "Display Alysis Code Pro status, model, and account links",
    handler: async (
      _args: string,
      ctx: ExtensionCommandContext,
    ): Promise<void> => {
      const activeModel =
        ctx.model?.provider === PROVIDER_ID ? ctx.model.id : "None (inactive)";
      const isConnected = ctx.model?.provider === PROVIDER_ID;
      const totalTokens = tracker.getTotalTokens();
      const turns = tracker.getTurnCount();

      const summary = [
        PROVIDER_LABEL,
        `• Status: ${isConnected ? "Connected" : "Available (use /login alysis or /model alysis/...)"}`,
        `• Model: ${activeModel}`,
        `• Session usage: ${totalTokens.toLocaleString()} tokens (${turns} turns)`,
        `• Account & credits: ${getAccountUrl()}`,
        `• Activate device: ${getActivateUrl()}`,
      ].join("\n");

      ctx.ui.notify(summary, "info");
    },
  });

  // /alysis-usage
  pi.registerCommand("alysis-usage", {
    description: "Display token usage for the current session",
    handler: async (
      _args: string,
      ctx: ExtensionCommandContext,
    ): Promise<void> => {
      const text = tracker.formatDetailedMarkdown();
      ctx.ui.notify(text, "info");
    },
  });

  // /alysis-models
  pi.registerCommand("alysis-models", {
    description: "Fetch and sync models from the Alysis gateway",
    handler: async (
      _args: string,
      ctx: ExtensionCommandContext,
    ): Promise<void> => {
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
          },
        });

        const list = models.map((m) => `• ${m.id}: ${m.name}`).join("\n");
        ctx.ui.notify(`Synced models (${models.length}):\n${list}`, "info");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Failed to fetch models: ${message}`, "error");
      }
    },
  });

  // /alysis-logout
  pi.registerCommand("alysis-logout", {
    description: "Instructions to logout or revoke active session",
    handler: async (
      _args: string,
      ctx: ExtensionCommandContext,
    ): Promise<void> => {
      ctx.ui.notify(
        `To log out locally, run \`/logout ${PROVIDER_ID}\` in Pi. You can also revoke keys at ${getAccountUrl()}`,
        "info",
      );
    },
  });
}

export default async function alysisExtension(pi: ExtensionAPI): Promise<void> {
  const usageTracker = new AlysisUsageTracker();

  // 1. Initial dynamic model discovery at startup
  const initialModels = await fetchDynamicModels();

  // 2. Register the Alysis Code Pro provider
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
      getApiKey: (credentials) => credentials.access,
    },
  });

  // 3. Register listeners and slash commands
  registerEventListeners(pi, usageTracker);
  registerCommands(pi, usageTracker);
}
