# FindOrigin

Telegram-бот для поиска источников информации: пользователь присылает текст или ссылку, бот находит кандидатов (официальные сайты, новости, блоги, исследования) и с помощью AI выбирает 1–3 лучших по смыслу с оценкой уверенности.

## Стек

- Next.js (App Router), TypeScript
- Поиск: serpstack.com
- AI: OpenAI (gpt-4o-mini)

## Локальный запуск

```powershell
npm install
npm run dev
```

Переменные окружения: см. `.env.example`. Нужны `BOT_TOKEN`, `SERPSTACK_ACCESS_KEY`, при необходимости `OPENAI_API_KEY`.

Для приёма сообщений из Telegram настройте webhook на публичный URL (например через ngrok или localtunnel), см. PLAN.md и обсуждение в проекте.

## Деплой на Vercel

Пошаговая инструкция: **[DEPLOY.md](DEPLOY.md)**.
