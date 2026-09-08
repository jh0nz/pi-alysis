/**
 * Constants and environment configuration for the Alysis Code Pro integration in Pi.
 */
export declare const DEFAULT_SUPABASE_URL = "https://vzigujbcjjmpntxhmyvr.supabase.co";
export declare const DEFAULT_SITE_URL = "https://alysiscode.com";
export declare const ANON_KEY: string;
export declare const PROVIDER_ID = "alysis";
export declare const PROVIDER_LABEL = "Alysis Code Pro";
export declare function getSupabaseUrl(): string;
export declare function getSiteUrl(): string;
export declare function getGatewayBaseUrl(): string;
export declare function getDeviceCodeUrl(): string;
export declare function getDeviceTokenUrl(): string;
export declare function getModelsUrl(): string;
export declare function getAccountUrl(): string;
export declare function getActivateUrl(code?: string): string;
export declare function getLogoutUrl(): string;
