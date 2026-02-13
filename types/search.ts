/**
 * Результаты поиска источников для этапов 5–6.
 */

export type SearchCategory =
  | "official"
  | "news"
  | "blog"
  | "research";

export interface CandidateSource {
  url: string;
  title: string;
  snippet: string;
  category: SearchCategory;
}
