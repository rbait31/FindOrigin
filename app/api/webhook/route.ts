import type { TelegramUpdate } from "@/types/telegram";
import { getInputText } from "@/lib/getInputText";
import { extractEntities } from "@/lib/entities";
import { searchSources } from "@/lib/search";
import { sendMessage } from "@/lib/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";
const SERPSTACK_ACCESS_KEY = process.env.SERPSTACK_ACCESS_KEY ?? "";

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
  const candidates = await searchSources(entities, SERPSTACK_ACCESS_KEY);

  const categoryLabels: Record<string, string> = {
    official: "Официальные",
    news: "Новости",
    blog: "Блоги",
    research: "Исследования",
  };
  const lines: string[] = ["Найденные кандидаты источников:"];
  if (candidates.length === 0) {
    if (!SERPSTACK_ACCESS_KEY) {
      lines.push("Добавьте SERPSTACK_ACCESS_KEY в .env для поиска (https://serpstack.com).");
    } else {
      lines.push("По запросу ничего не найдено.");
    }
  } else {
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
    lines.push("\nСравнение с AI и выбор 1–3 лучших — на этапе 6.");
  }

  let reply = lines.join("\n");
  if (reply.length > MAX_MESSAGE_LENGTH) {
    reply = reply.slice(0, MAX_MESSAGE_LENGTH - 20) + "\n\n… (обрезано)";
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
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

  // Сразу возвращаем 200 OK, обработку выполняем "в фоне"
  processUpdate(chatId, update).catch((err) => {
    console.error("[webhook] processUpdate error:", err);
  });

  return new Response("OK", { status: 200 });
}
