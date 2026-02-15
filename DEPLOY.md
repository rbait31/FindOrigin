# Деплой FindOrigin на Vercel

Пошаговая инструкция по выкладке бота на Vercel и настройке webhook Telegram.

---

## 1. Репозиторий на GitHub

Если проект ещё не в GitHub:

```powershell
cd C:\Work\FindOrigin
git init
git add .
git commit -m "Подготовка к деплою на Vercel"
```

Создайте репозиторий на https://github.com/new и выполните:

```powershell
git remote add origin https://github.com/ВАШ_ЛОГИН/FindOrigin.git
git branch -M main
git push -u origin main
```

(Замените `ВАШ_ЛОГИН/FindOrigin` на свой репозиторий.)

---

## 2. Импорт проекта в Vercel

1. Откройте https://vercel.com и войдите (через GitHub).
2. Нажмите **Add New…** → **Project**.
3. Импортируйте репозиторий **FindOrigin** (Import).
4. **Framework Preset** оставьте **Next.js**, **Root Directory** — по умолчанию.
5. Не нажимайте Deploy — сначала добавьте переменные окружения (п. 3).

---

## 3. Переменные окружения в Vercel

В настройках проекта перед деплоем (или после: **Settings** → **Environment Variables**) добавьте:

| Имя | Значение | Примечание |
|-----|----------|------------|
| `BOT_TOKEN` или `TELEGRAM_BOT_TOKEN` | Токен бота от @BotFather | Обязательно |
| `SERPSTACK_ACCESS_KEY` | Ключ с https://serpstack.com | Для поиска |
| `OPENAI_API_KEY` | Ключ с https://platform.openai.com/api-keys | Для выбора лучших источников |

Для каждой переменной выберите окружения: **Production**, при необходимости **Preview**.

---

## 4. Деплой

Нажмите **Deploy**. Дождитесь окончания сборки. В панели проекта появится URL вида:

**`https://findorigin-xxxx.vercel.app`**

(или ваш кастомный домен, если настроен.)

---

## 5. Установка webhook Telegram

После успешного деплоя укажите Telegram, куда слать обновления (подставьте свой URL из Vercel):

```powershell
$url = "https://findorigin-xxxx.vercel.app/api/webhook"
Invoke-RestMethod -Uri "https://api.telegram.org/botВАШ_ТОКЕН_БОТА/setWebhook?url=$url"
```

Проверка текущего webhook:

```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/botВАШ_ТОКЕН_БОТА/getWebhookInfo"
```

В ответе в `url` должен быть ваш Vercel-адрес с путём `/api/webhook`.

---

## 6. Проверка

Напишите боту в Telegram. Ответ должен прийти с серверов Vercel (туннель ngrok/localtunnel больше не нужен).

---

## Ограничения Vercel

- **Таймаут:** на бесплатном плане (Hobby) функция выполняется не более **10 секунд**. Поиск + AI могут занимать дольше; при таймауте ответ пользователю может не уйти. На плане Pro можно увеличить до 60 с (в коде уже задано `maxDuration = 60`).
- **Лимиты запросов:** зависят от вашего плана Vercel.

При необходимости обновите переменные в **Settings** → **Environment Variables** и сделайте **Redeploy**.

---

## Если Vercel не отвечает

### 1. Проверить, что деплой успешен

- В панели Vercel откройте проект → **Deployments**. Последний деплой должен быть в статусе **Ready** (зелёная галочка). Если **Error** или **Building** завис — смотрите **Build Logs** и исправьте ошибку сборки.

### 2. Проверить доступность по URL

Подставьте свой домен Vercel и выполните в PowerShell:

```powershell
# Главная страница
Invoke-RestMethod -Uri "https://ВАШ-ПРОЕКТ.vercel.app" -Method Get

# Webhook (должен вернуть JSON с ok: true)
Invoke-RestMethod -Uri "https://ВАШ-ПРОЕКТ.vercel.app/api/webhook" -Method Get
```

Если здесь таймаут или 502/503 — проблема на стороне Vercel или сети. Если ответ пришёл — сервер жив, можно смотреть пункты 3–4.

### 3. Переменные окружения

- **Settings** → **Environment Variables**: для **Production** должны быть заданы минимум `BOT_TOKEN` (или `TELEGRAM_BOT_TOKEN`). Без токена бот не сможет отправить ответ.
- После изменения переменных обязательно сделайте **Redeploy** (Deployments → три точки у последнего деплоя → **Redeploy**).

### 4. Логи функции

- В Vercel: **Deployments** → откройте последний деплой → вкладка **Functions** (или **Logs**). Отправьте боту сообщение и посмотрите, появляются ли запросы к `/api/webhook` и нет ли ошибок (красные строки). По ним можно понять, падает ли обработка (поиск, OpenAI, отправка в Telegram).

### 5. Webhook указан на правильный URL

Убедитесь, что в Telegram прописан именно ваш Vercel-URL с **https** и путём **/api/webhook**:

```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"
```

В `result.url` должно быть что-то вроде `https://ваш-проект.vercel.app/api/webhook`. Если там старый адрес (ngrok, localtunnel) — вызовите снова **setWebhook** с Vercel-URL (см. раздел 5 выше).

### 6. Таймаут на бесплатном плане

На плане Hobby функция не может работать дольше **10 секунд**. Если поиск + AI занимают больше, Vercel обрежет выполнение и ответ пользователю может не уйти. В логах может быть **Function execution timeout**. Варианты: упростить запросы или перейти на план Pro (там можно до 60 с).
