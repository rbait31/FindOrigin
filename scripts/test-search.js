/**
 * Консольная проверка поиска serpstack.
 * Запуск: node scripts/test-search.js
 * (из корня проекта; .env или .env.local должны содержать SERPSTACK_ACCESS_KEY)
 */

const fs = require("fs");
const readline = require("readline");
const path = require("path");

function loadEnv(filePath) {
  try {
    const content = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          process.env[key] = value;
        }
      }
    }
  } catch (_) {}
}

loadEnv(".env");
loadEnv(".env.local");

const SERPSTACK_ACCESS_KEY = (process.env.SERPSTACK_ACCESS_KEY || "").trim();

async function search(query) {
  if (!SERPSTACK_ACCESS_KEY) {
    return { error: "SERPSTACK_ACCESS_KEY не задан в .env или .env.local" };
  }
  const url = `https://api.serpstack.com/search?access_key=${encodeURIComponent(SERPSTACK_ACCESS_KEY)}&query=${encodeURIComponent(query)}&num=10`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    return { error: `API: ${data.error.code} ${data.error.type} — ${data.error.info}` };
  }
  return { results: data.organic_results || [] };
}

function printResults(data) {
  if (data.error) {
    console.log("\nОшибка:", data.error);
    return;
  }
  const results = data.results;
  if (!results.length) {
    console.log("\nРезультатов не найдено.");
    return;
  }
  console.log("\n--- Результаты поиска ---\n");
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title || "(без заголовка)"}`);
    console.log(`   ${r.url || ""}`);
    if (r.snippet) console.log(`   ${r.snippet}`);
    console.log("");
  });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Введи текст для поиска: ", (query) => {
  const q = query.trim();
  if (!q) {
    console.log("Текст не введён.");
    rl.close();
    return;
  }
  console.log("Ищу…");
  search(q).then(printResults).finally(() => rl.close());
});
