/**
 * Session usage tracking and statistics for Alysis models.
 */
export interface ModelUsageStats {
    promptTokens: number;
    completionTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
    turns: number;
}
export interface RawUsageInput {
    promptTokens?: number;
    completionTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
}
export declare class AlysisUsageTracker {
    private totalPromptTokens;
    private totalCompletionTokens;
    private totalCacheReadTokens;
    private totalCacheWriteTokens;
    private totalTurns;
    private lastTurnTokens;
    private byModel;
    recordTurn(modelId: string, usage?: RawUsageInput | null): void;
    getTotalTokens(): number;
    getTurnCount(): number;
    getLastTurnTokens(): number;
    formatFooterStatus(): string;
    formatDetailedMarkdown(): string;
    reset(): void;
}
