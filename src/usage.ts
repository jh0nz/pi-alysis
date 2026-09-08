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

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toLocaleString();
}

export class AlysisUsageTracker {
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;
  private totalCacheReadTokens = 0;
  private totalCacheWriteTokens = 0;
  private totalTurns = 0;
  private lastTurnTokens = 0;
  private byModel: Map<string, ModelUsageStats> = new Map();

  public recordTurn(modelId: string, usage?: RawUsageInput | null): void {
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
      turns: 0,
    };

    currentModelStats.promptTokens += prompt;
    currentModelStats.completionTokens += completion;
    currentModelStats.cacheReadTokens += cacheRead;
    currentModelStats.cacheWriteTokens += cacheWrite;
    currentModelStats.totalTokens += turnTotal;
    currentModelStats.turns += 1;

    this.byModel.set(modelId, currentModelStats);
  }

  public getTotalTokens(): number {
    return (
      this.totalPromptTokens +
      this.totalCompletionTokens +
      this.totalCacheWriteTokens
    );
  }

  public getTurnCount(): number {
    return this.totalTurns;
  }

  public getLastTurnTokens(): number {
    return this.lastTurnTokens;
  }

  public formatFooterStatus(): string {
    const total = this.getTotalTokens();
    if (total === 0) {
      return "Alysis: ready";
    }
    const comp = this.totalCompletionTokens;
    return `Alysis: ${formatTokens(total)} tok (${formatTokens(comp)} out)`;
  }

  public formatDetailedMarkdown(): string {
    const total = this.getTotalTokens();
    const lines: string[] = [
      "Alysis Usage:",
      `Total Tokens: ${total.toLocaleString()}`,
      `Input Tokens: ${this.totalPromptTokens.toLocaleString()}`,
      `Output Tokens: ${this.totalCompletionTokens.toLocaleString()}`,
    ];

    if (this.totalCacheReadTokens > 0 || this.totalCacheWriteTokens > 0) {
      lines.push(
        `Cache Read: ${this.totalCacheReadTokens.toLocaleString()}`,
        `Cache Write: ${this.totalCacheWriteTokens.toLocaleString()}`,
      );
    }

    lines.push(`Turns: ${this.totalTurns}`);

    if (this.byModel.size > 0) {
      lines.push("", "By Model:");
      for (const [model, stats] of this.byModel.entries()) {
        lines.push(
          `• ${model}: ${stats.totalTokens.toLocaleString()} tokens across ${stats.turns} turn(s) (${stats.promptTokens.toLocaleString()} in, ${stats.completionTokens.toLocaleString()} out)`,
        );
      }
    }

    return lines.join("\n");
  }

  public reset(): void {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCacheReadTokens = 0;
    this.totalCacheWriteTokens = 0;
    this.totalTurns = 0;
    this.lastTurnTokens = 0;
    this.byModel.clear();
  }
}
