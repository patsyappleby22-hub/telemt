# Деплой на Northflank через GitHub

## Обзор архитектуры

```
GitHub → Northflank
├── panel   (Express + React, порт 3000)
├── bot     (Telegram Bot Node.js)
└── db      (PostgreSQL addon в Northflank)
```

## Шаги деплоя

### 1. Подключите репозиторий GitHub к Northflank

1. Войдите в [Northflank](https://northflank.com)
2. **Create Project** → назовите `telemt`
3. **Integrations** → подключите GitHub аккаунт / организацию

### 2. Создайте PostgreSQL addon

1. В проекте → **Add Addon** → выберите **PostgreSQL**
2. Plan: `nf-compute-10` (достаточно для старта)
3. Запомните переменную окружения, которую Northflank предоставит:  
   `POSTGRESQL_CONNECTION_STRING` (копируется в env сервисов автоматически)

### 3. Создайте сервис Panel

1. **Add Service** → **Combined** (build + run)
2. Source: ваш GitHub репо, ветка `main`
3. Dockerfile path: `panel/Dockerfile`
4. Build context: `panel/`
5. Port: **3000** (HTTP, публичный)
6. Переменные окружения:
   ```
   DATABASE_URL      = <скопируйте из PostgreSQL addon>
   DATABASE_SSL      = true
   PORT              = 3000
   NODE_ENV          = production
   ```

### 4. Создайте сервис Bot

1. **Add Service** → **Combined**
2. Source: тот же репо, ветка `main`
3. Dockerfile path: `bot/Dockerfile`
4. Build context: `bot/`
5. Порт не нужен (бот не принимает входящие)
6. Переменные окружения:
   ```
   PANEL_API = http://<internal-host-panel>:<port>
   NODE_ENV  = production
   ```
   > `PANEL_API` — внутренний адрес сервиса panel внутри Northflank проекта.  
   > Скопируйте из **Internal Networking** сервиса panel (вид: `http://panel.telemt.internal:3000`)

### 5. Токен Telegram бота

После деплоя:
1. Откройте URL панели (из Northflank → panel → Domains)
2. Перейдите в **Настройки → Бот**
3. Вставьте токен бота от [@BotFather](https://t.me/BotFather)
4. Бот перезагрузится автоматически через ~30 сек

### 6. Локальный запуск (docker-compose)

```bash
cp .env.example .env      # задайте POSTGRES_PASSWORD
docker compose up --build
```

Панель будет доступна на http://localhost:3000

---

## Переменные окружения

| Переменная | Где | Описание |
|------------|-----|----------|
| `DATABASE_URL` | panel | PostgreSQL connection string |
| `DATABASE_SSL` | panel | `true` в Northflank, `false` локально |
| `PORT` | panel | HTTP порт (default: 3000) |
| `PANEL_API` | bot | URL панели (internal в Northflank) |

## База данных

Схема применяется автоматически при старте сервиса panel (`initDb()`).  
SQL-схема находится в `panel/server/db.js`.

Данные хранятся в PostgreSQL:
- `nodes` — прокси-ноды
- `proxy_users` — пользователи прокси (username + secret)
- `bot_users` — пользователи Telegram бота
- `bot_plans` — тарифы
- `bot_settings` — настройки бота (токен, тексты)
- `payments` — история платежей
