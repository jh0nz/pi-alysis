/**
 * Model definitions and dynamic discovery for Alysis Code Pro via /models endpoint.
 */
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
export declare const STATIC_MODELS: ProviderModelConfig[];
interface GatewayModelItem {
    id: string;
    object?: string;
    owned_by?: string;
}
export declare function formatModelDisplayName(modelId: string): string;
export declare function toProviderModelConfig(item: GatewayModelItem): ProviderModelConfig;
/**
 * Fetches dynamic models served by the Alysis gateway /models endpoint.
 * Falls back gracefully to STATIC_MODELS on offline or network failure.
 */
export declare function fetchDynamicModels(accessKey?: string, signal?: AbortSignal): Promise<ProviderModelConfig[]>;
export {};
