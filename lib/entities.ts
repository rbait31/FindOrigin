/**
 * Выделение из текста сущностей для этапа поиска источников:
 * ключевые утверждения, даты, числа, имена, ссылки.
 */

export interface ExtractedEntities {
  /** Ключевые утверждения (факты, тезисы) — предложения или короткие фразы */
  claims: string[];
  /** Найденные даты в тексте */
  dates: string[];
  /** Числа (в т.ч. с единицами измерения) */
  numbers: string[];
  /** Подозрительные на имена слова (Title Case, возможные имена) */
  names: string[];
  /** URL-ссылки */
  links: string[];
}

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/** Форматы дат: DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD, "15 января 2024", "15 янв 2024" */
const DATE_PATTERNS = [
  /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{2,4}\b/gi,
  /\b\d{1,2}\s+(?:янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)\.?\s+\d{2,4}\b/gi,
];

/** Числа: целые, с запятой/точкой, с %, руб., млн и т.д. */
const NUMBER_PATTERNS = [
  /\b\d{1,3}(?:\s?\d{3})*(?:[.,]\d+)?\s*(?:%|руб\.?|млн|млрд|тыс\.?|USD|EUR)?\b/gi,
  /\b\d+(?:[.,]\d+)?\b/g,
];

/**
 * Разбиение на предложения (простая эвристика по . ! ? и переносам).
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

/**
 * Слова в Title Case (каждое с большой буквы) — возможные имена/названия.
 * Исключаем короткие и общеупотребительные.
 */
const SKIP_TITLE_CASE = new Set([
  "и", "в", "на", "с", "по", "для", "из", "к", "о", "от", "до", "не", "но",
  "как", "что", "это", "все", "его", "её", "их", "при", "без", "за", "под",
  "или", "так", "уже", "еще", "только", "тоже", "можно", "нужно", "есть",
]);

function extractPossibleNames(text: string): string[] {
  const words = text.split(/\s+/);
  const names: string[] = [];
  for (const w of words) {
    const clean = w.replace(/^[^a-zA-Zа-яА-ЯёЁ]+|[^a-zA-Zа-яА-ЯёЁ]+$/g, "");
    if (
      clean.length >= 2 &&
      clean[0] === clean[0].toUpperCase() &&
      clean.slice(1) === clean.slice(1).toLowerCase() &&
      !SKIP_TITLE_CASE.has(clean.toLowerCase())
    ) {
      names.push(clean);
    }
  }
  return Array.from(new Set(names));
}

/**
 * Извлекает из текста сущности для последующего поиска источников.
 */
export function extractEntities(text: string): ExtractedEntities {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  const urlRe = new RegExp(URL_REGEX.source, "gi");
  while ((m = urlRe.exec(text)) !== null) {
    links.push(m[0]);
  }

  const dates: string[] = [];
  for (const re of DATE_PATTERNS) {
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      dates.push(m[0]);
    }
  }

  const numbers: string[] = [];
  for (const re of NUMBER_PATTERNS) {
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      numbers.push(m[0]);
    }
  }

  const claims = splitSentences(text).filter(
    (s) => s.length <= 500 && !/^https?:\/\//i.test(s)
  );
  const names = extractPossibleNames(text);

  return {
    claims: Array.from(new Set(claims)),
    dates: Array.from(new Set(dates)),
    numbers: Array.from(new Set(numbers)),
    names: Array.from(new Set(names)),
    links: Array.from(new Set(links)),
  };
}
