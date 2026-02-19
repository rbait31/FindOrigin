/**
 * API для Telegram Mini App: анализ текста, поиск источников, AI-резюме.
 * POST /api/analyze { "text": "..." }
 */

import { normalizeText } from "@/lib/getInputText";

export const maxDuration = 60;
import { extractEntities } from "@/lib/entities";
import { searchSources } from "@/lib/search";
import { rankSourcesWithAI } from "@/lib/ai-rank";

const SERPSTACK_ACCESS_KEY = process.env.SERPSTACK_ACCESS_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const confidenceLabels: Record<string, string> = {
  high: "высокая",
  medium: "средняя",
  low: "низкая",
};

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Неверный JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rawText = typeof body.text === "string" ? body.text : "";
  const text = normalizeText(rawText);

  if (!text || text.length < 10) {
    return new Response(
      JSON.stringify({ error: "Введите текст не менее 10 символов" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (text.length > 5000) {
    return new Response(
      JSON.stringify({ error: "Текст не должен превышать 5000 символов" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const entities = extractEntities(text);
  let candidates: Awaited<ReturnType<typeof searchSources>>;
  try {
    candidates = await searchSources(entities, SERPSTACK_ACCESS_KEY);
  } catch (err) {
    if (err instanceof Error && err.message === "SERPSTACK_RATE_LIMIT") {
      return new Response(
        JSON.stringify({ error: "Превышен лимит запросов к поиску. Попробуйте позже." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    throw err;
  }

  if (candidates.length === 0) {
    return new Response(
      JSON.stringify({
        summary: null,
        sources: [],
        message: !SERPSTACK_ACCESS_KEY
          ? "Поиск не настроен."
          : "По запросу ничего не найдено.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let ranking: Awaited<ReturnType<typeof rankSourcesWithAI>> | null = null;
  try {
    ranking = await rankSourcesWithAI(text, candidates, OPENAI_API_KEY);
  } catch (err) {
    if (err instanceof Error && err.message === "OPENAI_QUOTA") {
      ranking = null;
    } else {
      throw err;
    }
  }

  if (ranking && ranking.sources.length > 0) {
    return new Response(
      JSON.stringify({
        summary: ranking.summary ?? null,
        sources: ranking.sources.map((s) => ({
          url: s.url,
          title: s.title,
          confidence: confidenceLabels[s.confidence] ?? s.confidence,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const categoryLabels: Record<string, string> = {
    official: "Официальные",
    news: "Новости",
    blog: "Блоги",
    research: "Исследования",
  };
  const byCategory = new Map<string, { url: string; title: string }[]>();
  for (const c of candidates) {
    const label = categoryLabels[c.category] ?? c.category;
    if (!byCategory.has(label)) byCategory.set(label, []);
    byCategory.get(label)!.push({ url: c.url, title: c.title });
  }
  const sources: { url: string; title: string; confidence: string }[] = [];
  Array.from(byCategory.entries()).forEach(([label, items]) => {
    items.forEach(({ url, title }) => {
      sources.push({ url, title, confidence: label });
    });
  });

  return new Response(
    JSON.stringify({
      summary: null,
      sources,
      message: "AI не использован. Показаны все найденные кандидаты.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
