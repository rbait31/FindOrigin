/**
 * Сравнение кандидатов-источников с исходным текстом по смыслу через OpenAI.
 * Возвращает 1–3 лучших источника с оценкой уверенности.
 */

import type { CandidateSource } from "@/types/search";
import type { AIRankingResult, RankedSource } from "@/types/ai";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_SOURCES = 3;

function buildCandidatesText(candidates: CandidateSource[]): string {
  return candidates
    .slice(0, 15)
    .map((c, i) => `${i + 1}. ${c.title}\n   URL: ${c.url}\n   Сниппет: ${c.snippet || "—"}`)
    .join("\n\n");
}

function buildPrompt(userText: string, candidatesText: string): string {
  return `Ты помогаешь найти источники информации. Пользователь прислал текст/утверждение. Ниже список кандидатов-источников (ссылки с заголовками и сниппетами).

Твоя задача: выбрать от 1 до 3 источников, которые лучше всего соответствуют тексту пользователя ПО СМЫСЛУ (не обязательно буквальное совпадение). Это могут быть первоисточник, подтверждение факта или релевантная статья.

Исходный текст пользователя:
---
${userText.slice(0, 1500)}
---

Кандидаты-источники:
---
${candidatesText}
---

Ответь ТОЛЬКО валидным JSON без markdown и комментариев, в формате:
{"sources":[{"url":"...","title":"...","confidence":"high"|"medium"|"low"}, ...]}

Поле confidence: high — источник явно по теме и надёжен, medium — релевантен, low — слабая связь. Выбери не более 3 источников.`;
}

/**
 * Парсит ответ модели в AIRankingResult. Возвращает null при ошибке парсинга.
 */
function parseAIResponse(content: string): AIRankingResult | null {
  const trimmed = content.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(trimmed) as { sources?: unknown[] };
    if (!Array.isArray(parsed.sources)) return null;
    const sources: RankedSource[] = [];
    for (const s of parsed.sources.slice(0, MAX_SOURCES)) {
      if (s && typeof s === "object" && typeof (s as RankedSource).url === "string" && typeof (s as RankedSource).title === "string") {
        const conf = (s as RankedSource).confidence;
        sources.push({
          url: (s as RankedSource).url,
          title: (s as RankedSource).title,
          confidence: conf === "high" || conf === "medium" || conf === "low" ? conf : "medium",
        });
      }
    }
    return sources.length > 0 ? { sources } : null;
  } catch {
    return null;
  }
}

/**
 * Вызывает OpenAI, сравнивает по смыслу и возвращает 1–3 лучших источника с уверенностью.
 */
export async function rankSourcesWithAI(
  userText: string,
  candidates: CandidateSource[],
  apiKey: string | undefined
): Promise<AIRankingResult | null> {
  if (!apiKey || !apiKey.trim()) {
    console.warn("[ai-rank] OPENAI_API_KEY не задан");
    return null;
  }
  if (candidates.length === 0) return null;

  const candidatesText = buildCandidatesText(candidates);
  const prompt = buildPrompt(userText, candidatesText);

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[ai-rank] OpenAI API error:", res.status, errText);
    if (res.status === 429) {
      try {
        const errJson = JSON.parse(errText) as { error?: { code?: string } };
        if (errJson.error?.code === "insufficient_quota") throw new Error("OPENAI_QUOTA");
      } catch (e) {
        if (e instanceof Error && e.message === "OPENAI_QUOTA") throw e;
      }
    }
    return null;
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  return parseAIResponse(content);
}
