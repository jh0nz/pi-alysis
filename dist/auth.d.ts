/**
 * Authentication logic for Alysis Code Pro using RFC 8628 Device Authorization Flow.
 */
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
/**
 * Executes RFC 8628 device code authentication against Alysis Supabase Edge Functions.
 */
export declare function loginAlysis(callbacks: OAuthLoginCallbacks, signal?: AbortSignal): Promise<OAuthCredentials>;
/**
 * Revokes the session gateway key server-side.
 */
export declare function logoutAlysis(accessKey: string, signal?: AbortSignal): Promise<boolean>;
