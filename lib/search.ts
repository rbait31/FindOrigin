/**
 * Поиск возможных источников по категориям (официальные, новости, блоги, исследования).
 * Используется Brave Search API (api.search.brave.com).
 */

import type { ExtractedEntities } from "@/lib/entities";
import type { CandidateSource, SearchCategory } from "@/types/search";

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";
const TOP_N_PER_CATEGORY = 3;

const CATEGORY_QUERY_SUFFIX: Record<SearchCategory, string> = {
  official: "официальный сайт официальный источник",
  news: "новости",
  blog: "блог статья",
  research: "исследование научная статья исследование",
};

/**
 * Формирует поисковый запрос из сущностей (утверждения + ключевые слова).
 */
function buildSearchQuery(entities: ExtractedEntities): string {
  const parts: string[] = [];
  if (entities.claims.length > 0) {
    const firstClaim = entities.claims[0].slice(0, 100).trim();
    if (firstClaim) parts.push(firstClaim);
  }
  if (entities.names.length > 0) {
    parts.push(entities.names.slice(0, 2).join(" "));
  }
  if (entities.dates.length > 0) {
    parts.push(entities.dates[0]);
  }
  const query = parts.join(" ").trim() || "источник";
  return query.slice(0, 200);
}

/**
 * Один запрос к Brave Search API.
 */
async function braveSearch(
  apiKey: string,
  query: string,
  count: number
): Promise<{ title: string; url: string; description: string }[]> {
  const url = new URL(BRAVE_API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));

  const res = await fetch(url.toString(), {
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[search] Brave API error:", res.status, err);
    return [];
  }

  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  const results = data.web?.results ?? [];
  return results
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: r.description ?? "",
    }));
}

/**
 * Ищет возможные источники по категориям.
 * Возвращает до TOP_N_PER_CATEGORY кандидатов на каждую категорию.
 */
export async function searchSources(
  entities: ExtractedEntities,
  apiKey: string | undefined
): Promise<CandidateSource[]> {
  if (!apiKey || !apiKey.trim()) {
    console.warn("[search] BRAVE_API_KEY не задан, поиск пропущен");
    return [];
  }

  const baseQuery = buildSearchQuery(entities);
  const categories: SearchCategory[] = ["official", "news", "blog", "research"];
  const all: CandidateSource[] = [];

  for (const category of categories) {
    const suffix = CATEGORY_QUERY_SUFFIX[category];
    const query = `${baseQuery} ${suffix}`.trim();
    const raw = await braveSearch(apiKey, query, TOP_N_PER_CATEGORY);
    for (const r of raw) {
      all.push({
        url: r.url,
        title: r.title,
        snippet: r.description,
        category,
      });
    }
  }

  return all;
}
