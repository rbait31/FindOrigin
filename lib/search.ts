/**
 * Поиск возможных источников по категориям (официальные, новости, блоги, исследования).
 * Используется serpstack.com — Google Search API (https://serpstack.com/documentation).
 */

import type { ExtractedEntities } from "@/lib/entities";
import type { CandidateSource, SearchCategory } from "@/types/search";

const SERPSTACK_API_URL = "https://api.serpstack.com/search";
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

/** Ответ serpstack: organic_results */
interface SerpstackOrganicResult {
  title?: string;
  url?: string;
  snippet?: string;
}

interface SerpstackResponse {
  error?: { code: number; type: string; info: string };
  organic_results?: SerpstackOrganicResult[];
}

/**
 * Один запрос к serpstack API (GET).
 * Документация: https://serpstack.com/documentation
 */
async function serpstackSearch(
  accessKey: string,
  query: string,
  count: number,
  type: "web" | "news" = "web"
): Promise<{ title: string; url: string; description: string }[]> {
  const url = new URL(SERPSTACK_API_URL);
  url.searchParams.set("access_key", accessKey);
  url.searchParams.set("query", query);
  url.searchParams.set("num", String(count));
  if (type === "news") {
    url.searchParams.set("type", "news");
  }

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });

  if (!res.ok) {
    console.error("[search] serpstack HTTP error:", res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as SerpstackResponse;
  if (data.error) {
    console.error("[search] serpstack API error:", data.error.code, data.error.info);
    return [];
  }

  const results = data.organic_results ?? [];
  return results
    .filter((r) => r.url && r.title)
    .slice(0, count)
    .map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: r.snippet ?? "",
    }));
}

/**
 * Ищет возможные источники по категориям.
 * Возвращает до TOP_N_PER_CATEGORY кандидатов на каждую категорию.
 */
export async function searchSources(
  entities: ExtractedEntities,
  accessKey: string | undefined
): Promise<CandidateSource[]> {
  if (!accessKey || !accessKey.trim()) {
    console.warn("[search] SERPSTACK_ACCESS_KEY не задан, поиск пропущен");
    return [];
  }

  const baseQuery = buildSearchQuery(entities);
  const categories: SearchCategory[] = ["official", "news", "blog", "research"];
  const all: CandidateSource[] = [];

  for (const category of categories) {
    const suffix = CATEGORY_QUERY_SUFFIX[category];
    const query = `${baseQuery} ${suffix}`.trim();
    const isNews = category === "news";
    const raw = await serpstackSearch(
      accessKey,
      query,
      TOP_N_PER_CATEGORY,
      isNews ? "news" : "web"
    );
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
