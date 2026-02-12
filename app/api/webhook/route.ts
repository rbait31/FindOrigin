import type { TelegramUpdate } from "@/types/telegram";
import { getInputText } from "@/lib/getInputText";
import { extractEntities } from "@/lib/entities";
import { sendMessage } from "@/lib/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";

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

  const entities = extractEntities(inputText);
  const summary = [
    `Утверждений: ${entities.claims.length}`,
    `Дат: ${entities.dates.length}`,
    `Чисел: ${entities.numbers.length}`,
    `Имён: ${entities.names.length}`,
    `Ссылок: ${entities.links.length}`,
  ].join(", ");

  await sendMessage(
    BOT_TOKEN,
    chatId,
    `Обработано.\n${summary}\n\nПоиск источников и сравнение с AI будут на следующих этапах.`
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

  // Сразу возвращаем 200 OK, обработку выполняем "в фоне"
  processUpdate(chatId, update).catch((err) => {
    console.error("[webhook] processUpdate error:", err);
  });

  return new Response("OK", { status: 200 });
}
