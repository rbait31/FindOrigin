import type { TelegramUpdate } from "@/types/telegram";
import { getInputText } from "@/lib/getInputText";
import { extractEntities } from "@/lib/entities";
import { searchSources } from "@/lib/search";
import { rankSourcesWithAI } from "@/lib/ai-rank";
import { sendMessage } from "@/lib/telegram";

/** Таймаут для Vercel: до 60 с (Pro). На Hobby ограничение 10 с. */
export const maxDuration = 60;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";
const SERPSTACK_ACCESS_KEY = process.env.SERPSTACK_ACCESS_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const MAX_MESSAGE_LENGTH = 4000;

/**
 * Асинхронная обработка: получение текста, извлечение сущностей, ответ пользователю.
 * Вызывается после отправки 200 OK.
 */
async function processUpdate(chatId: number, update: TelegramUpdate): Promise<void> {
  const message = update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;
  if (!message) return;

  const { text: inputText, isOnlyTelegramLink } = getInputText(message);

  if (isOnlyTelegramLink) {
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "По ссылке на пост контент получить нельзя. Скопируйте и пришлите текст поста сюда."
    );
    return;
  }

  if (!inputText) {
    await sendMessage(BOT_TOKEN, chatId, "Пришлите текст или ссылку для поиска источников.");
    return;
  }

  // Сразу отправляем ответ, чтобы пользователь видел, что бот получил сообщение
  const sent = await sendMessage(BOT_TOKEN, chatId, "Обрабатываю…");
  if (!sent) {
    console.error("[webhook] Не удалось отправить «Обрабатываю…», проверьте BOT_TOKEN");
    return;
  }

  const entities = extractEntities(inputText);
  let candidates: Awaited<ReturnType<typeof searchSources>>;
  try {
    candidates = await searchSources(entities, SERPSTACK_ACCESS_KEY);
  } catch (err) {
    if (err instanceof Error && err.message === "SERPSTACK_RATE_LIMIT") {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "Превышен лимит запросов к поиску (serpstack). Попробуйте позже или обновите тариф на https://serpstack.com"
      );
      return;
    }
    throw err;
  }

  const confidenceLabels: Record<string, string> = {
    high: "высокая",
    medium: "средняя",
    low: "низкая",
  };

  let lines: string[] = [];
  if (candidates.length === 0) {
    lines = ["Найденные кандидаты источников:"];
    if (!SERPSTACK_ACCESS_KEY) {
      lines.push("Добавьте SERPSTACK_ACCESS_KEY в .env для поиска (https://serpstack.com).");
    } else {
      lines.push("По запросу ничего не найдено.");
    }
  } else {
    let ranking: Awaited<ReturnType<typeof rankSourcesWithAI>> = null;
    let openaiQuotaExceeded = false;
    try {
      ranking = await rankSourcesWithAI(inputText, candidates, OPENAI_API_KEY);
    } catch (err) {
      if (err instanceof Error && err.message === "OPENAI_QUOTA") openaiQuotaExceeded = true;
      else throw err;
    }
    if (ranking && ranking.sources.length > 0) {
      if (ranking.summary) {
        lines = ["📋 Резюме:", ranking.summary, "", "Возможные источники (по смыслу):"];
      } else {
        lines = ["Возможные источники (по смыслу):"];
      }
      ranking.sources.forEach((s, i) => {
        lines.push(`\n${i + 1}. ${s.title}`);
        lines.push(`   ${s.url}`);
        lines.push(`   Уверенность: ${confidenceLabels[s.confidence] ?? s.confidence}`);
      });
    } else {
      const fallbackTitle = openaiQuotaExceeded
        ? "Квота OpenAI исчерпана. Показаны все найденные кандидаты:"
        : "Найденные кандидаты источников (AI не использован — добавьте OPENAI_API_KEY для выбора лучших):";
      lines = [fallbackTitle];
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
      Array.from(byCategory.entries()).forEach(([label, items]) => {
        lines.push(`\n${label}:`);
        items.forEach(({ url, title }) => {
          lines.push(`• ${title}`);
          lines.push(`  ${url}`);
        });
      });
    }
  }

  let reply = lines.join("\n");
  if (reply.length > MAX_MESSAGE_LENGTH) {
    reply = reply.slice(0, MAX_MESSAGE_LENGTH - 20) + "\n\n… (обрезано)";
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
}

/** GET: проверка доступности webhook через туннель (для отладки). */
export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, message: "FindOrigin webhook доступен. POST сюда шлёт Telegram." }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const message = update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;
  const chatId = message?.chat.id;
  const text = message?.text ?? message?.caption;

  if (chatId == null) {
    return new Response("OK", { status: 200 });
  }

  console.log("[webhook] Получено сообщение, chatId:", chatId, "text:", (text ?? "").slice(0, 80));

  // На Vercel при возврате 200 без await выполнение может завершиться до отправки «Обрабатываю…».
  // Ждём завершения обработки, затем возвращаем 200 (Telegram допускает ответ до 60 с).
  try {
    await processUpdate(chatId, update);
  } catch (err) {
    console.error("[webhook] processUpdate error:", err);
  }

  return new Response("OK", { status: 200 });
}
