/**
 * Отправка сообщений в Telegram через Bot API.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  options?: { parse_mode?: "HTML" }
): Promise<boolean> {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  const body: { chat_id: number; text: string; parse_mode?: string } = {
    chat_id: chatId,
    text,
  };
  if (options?.parse_mode) body.parse_mode = options.parse_mode;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[telegram] sendMessage error:", res.status, err);
    return false;
  }
  return true;
}
