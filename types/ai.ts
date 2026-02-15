/**
 * Результат сравнения источников с помощью AI (этап 6).
 */

export interface RankedSource {
  url: string;
  title: string;
  confidence: "high" | "medium" | "low";
}

export interface AIRankingResult {
  sources: RankedSource[];
}
