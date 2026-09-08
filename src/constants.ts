/**
 * Constants and environment configuration for the Alysis Code Pro integration in Pi.
 */

// Supabase project hosting device login edge functions and LLM gateway.
export const DEFAULT_SUPABASE_URL = "https://vzigujbcjjmpntxhmyvr.supabase.co";

// Public product site for device approval and account/credit management.
export const DEFAULT_SITE_URL = "https://alysiscode.com";

// Supabase public anon key for edge functions authentication.
export const ANON_KEY =
 "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
 "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aWd1amJjamptcG50eGhteXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Mzc0NTIsImV4cCI6MjA5NjUxMzQ1Mn0." +
 "vLH9q-BNO8IWIZrVlvCw8pZWXdLgmKG4Tl9toTTD3pg";

export const PROVIDER_ID = "alysis";
export const PROVIDER_LABEL = "Alysis Code Pro";

export function getSupabaseUrl(): string {
 const envUrl = process.env.ALYSIS_SUPABASE_URL;
 return (envUrl ? envUrl.trim() : DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
}

export function getSiteUrl(): string {
 const envUrl = process.env.ALYSIS_SITE_URL;
 return (envUrl ? envUrl.trim() : DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function getGatewayBaseUrl(): string {
 const envUrl = process.env.ALYSIS_GATEWAY_URL;
 if (envUrl) {
  return envUrl.trim().replace(/\/+$/, "");
 }
 return `${getSupabaseUrl()}/functions/v1/llm/v1`;
}

export function getDeviceCodeUrl(): string {
 return `${getSupabaseUrl()}/functions/v1/device-code`;
}

export function getDeviceTokenUrl(): string {
 return `${getSupabaseUrl()}/functions/v1/device-token`;
}

export function getModelsUrl(): string {
 return `${getGatewayBaseUrl()}/models`;
}

export function getAccountUrl(): string {
 return `${getSiteUrl()}/account`;
}

export function getActivateUrl(code?: string): string {
 const base = `${getSiteUrl()}/activate`;
 return code ? `${base}?code=${encodeURIComponent(code)}` : base;
}

export function getLogoutUrl(): string {
 return `${getGatewayBaseUrl()}/logout`;
}
