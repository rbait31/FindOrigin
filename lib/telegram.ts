/**
 * Отправка сообщений в Telegram через Bot API.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<boolean> {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[telegram] sendMessage error:", res.status, err);
    return false;
  }
  return true;
}
