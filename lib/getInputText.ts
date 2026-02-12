/**
 * Получение и нормализация текста из ввода пользователя:
 * - текст сообщения как есть;
 * - при ссылке на Telegram-пост (t.me/…) — извлечение по возможности.
 */

import type { TelegramMessage, TelegramMessageEntity } from "@/types/telegram";

const T_ME_LINK_REGEX = /^https?:\/\/(www\.)?t\.me\/\S+/i;

/**
 * Проверяет, является ли строка ссылкой на пост/канал Telegram.
 */
export function isTelegramLink(text: string): boolean {
  return T_ME_LINK_REGEX.test(text.trim());
}

/**
 * Извлекает URL из entities сообщения (url, text_link).
 */
function getUrlsFromEntities(
  messageText: string,
  entities: TelegramMessageEntity[] | undefined
): string[] {
  if (!entities || !messageText) return [];
  const urls: string[] = [];
  for (const e of entities) {
    if (e.type === "url") {
      urls.push(messageText.slice(e.offset, e.offset + e.length));
    } else if (e.type === "text_link" && e.url) {
      urls.push(e.url);
    }
  }
  return Array.from(new Set(urls));
}

/**
 * Нормализация текста: обрезка пробелов, слияние переносов.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Возвращает текст для анализа из сообщения.
 * - Если есть обычный текст — нормализованный текст.
 * - Если сообщение содержит только ссылку t.me — контент поста через Bot API
 *   получить нельзя (нужен Telegram Client API/TDLib), возвращаем null и вызывающий
 *   код может попросить пользователя вставить текст.
 */
export function getInputText(message: TelegramMessage): {
  text: string | null;
  isOnlyTelegramLink: boolean;
} {
  const rawText = message.text ?? message.caption ?? "";
  const trimmed = rawText.trim();
  const entities = message.entities;

  if (!trimmed) {
    return { text: null, isOnlyTelegramLink: false };
  }

  const urls = getUrlsFromEntities(trimmed, entities);
  const hasTmeLink = urls.some((u) => isTelegramLink(u));
  // Сообщение считается "только ссылкой", если это один URL на t.me без другого текста
  const onlyTmeUrl =
    /^\s*https?:\/\/(www\.)?t\.me\/[^\s]+\s*$/i.test(trimmed) ||
    (hasTmeLink && urls.length === 1 && trimmed.length < 80 && trimmed.replace(urls[0], "").trim().length === 0);

  if (onlyTmeUrl) {
    return { text: null, isOnlyTelegramLink: true };
  }

  return {
    text: normalizeText(trimmed),
    isOnlyTelegramLink: false,
  };
}
