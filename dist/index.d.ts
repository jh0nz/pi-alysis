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
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function alysisExtension(pi: ExtensionAPI): Promise<void>;
