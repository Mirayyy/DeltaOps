# DeltaOps

Панель управления для игрового отряда [DELTA] (ArmA 3 / TSG). Управление составом, расстановками, посещаемостью, статистикой и архивом.

## Стек

- **Frontend:** Vue 3 + Vite + Tailwind CSS 4
- **State:** Pinia
- **Backend:** Firebase (Auth + Firestore)
- **Деплой:** GitHub Pages (CI/CD через GitHub Actions)
- **Роутинг:** Vue Router с Hash History (совместимость с GitHub Pages)

## Структура проекта

```
src/
├── assets/styles/     # Tailwind + глобальные стили
├── components/
│   ├── admin/         # WeekFinalizer, SlotConfigurator
│   ├── common/        # BaseSelect, BaseCheckbox, BaseModal, StatusBadge, SkillBadge...
│   ├── layout/        # AppHeader, AppSidebar, MobileNav
│   ├── missions/      # MissionCard, MissionDetail
│   ├── profile/       # ReadinessSelector
│   └── roster/        # PlayerEditor
├── composables/       # useGameWeek, useToast, useTelegram
├── firebase/          # config.js, auth.js, firestore.js
├── pages/             # 11 страниц (Landing, Login, Profile, Dashboard, Lineup, Roster...)
├── router/            # Vue Router config
├── stores/            # Pinia stores (auth, roster, games, attendance, archive, stats...)
└── utils/             # constants.js, permissions.js
```

## Архитектура

### Роли доступа

| Роль | Доступ |
|------|--------|
| **Гость** | Только лендинг |
| **Участник** | Профиль, дашборд, расстановка, статистика |
| **Админ** | Всё + состав, пользователи, архив, настройки |

### Коллекции Firestore

| Коллекция | Описание |
|-----------|----------|
| `users` | Аккаунты сайта (Firebase Auth UID) |
| `players` | Игроки отряда (stable ID: `p-{timestamp}`) |
| `games` | Расстановки текущей недели |
| `attendance` | Посещаемость текущей недели |
| `missions` | Данные миссий (4 слота: friday_1/2, saturday_1/2) |
| `rotations` | Ротации (сезоны) |
| `archive` | Архив завершённых игр |
| `stats` | Статистика игроков (KPD) |
| `webContent` | Контент лендинга, награды |
| `structures` | Шаблоны расстановок |
| `config` | Конфигурация приложения |

Подробное описание всех структур: [`docs/DATA_STRUCTURES.md`](docs/DATA_STRUCTURES.md)

### Недельный цикл

| День | Действие |
|------|----------|
| Пн-Чт | Админ загружает миссии, игроки отмечают посещаемость, админ настраивает слоты |
| Пт-Сб | Игры. Админ обновляет данные |
| Вс | Завершение недели → архивация → очистка текущих данных |

### Связь User ↔ Player

- `users/{firebaseUid}` — аккаунт сайта (Google Auth)
- `players/{stableId}` — игрок отряда
- Связь через поле `email` в обоих документах
- При первом логине — автоматическая привязка по email

---

## Запуск локально

### 1. Клонирование

```bash
git clone https://github.com/<your-username>/DeltaOps.git
cd DeltaOps
npm install
```

### 2. Firebase — создание проекта

1. Перейди на [Firebase Console](https://console.firebase.google.com/)
2. Создай новый проект (например `deltaops`)
3. Включи **Authentication** → метод **Google**
4. Создай **Firestore Database** → выбери регион (europe-west)
5. Начни с **test mode** (потом обновишь правила)

### 3. Firebase — получение конфига

1. В Firebase Console → Project Settings → General
2. В секции "Your apps" нажми **Add app** → Web
3. Скопируй конфиг

### 4. Настройка переменных

Создай `.env.local` в корне проекта:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 5. Firestore Rules

Загрузи правила безопасности в Firebase Console → Firestore → Rules:

Скопируй содержимое файла `firestore.rules` и опубликуй.

### 6. Seed данных (опционально)

```bash
node scripts/seed.mjs
```

Создаёт начальные документы: игрок, пользователь, ротацию, конфиг.

### 7. Запуск

```bash
npm run dev
```

Открой `http://localhost:5173/DeltaOps/`

### 8. Первый вход

1. Зайди через Google
2. Система создаст `users/{uid}` автоматически (роль: guest)
3. Чтобы стать админом:
   - Открой Firebase Console → Firestore → `users` → твой документ
   - Измени поле `role` на `admin`
4. Привяжи игрока к аккаунту через страницу «Пользователи»

---

## Деплой на GitHub Pages

### Автоматический (CI/CD)

Проект уже настроен — при пуше в `main` GitHub Actions автоматически билдит и деплоит.

#### Настройка:

1. **GitHub → Settings → Pages:**
   - Source: **GitHub Actions**

2. **GitHub → Settings → Secrets and variables → Actions:**

   Добавь **Repository secrets:**

   | Secret | Значение |
   |--------|----------|
   | `VITE_FIREBASE_API_KEY` | Твой API ключ |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `project.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | ID проекта |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `project.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
   | `VITE_FIREBASE_APP_ID` | App ID |

3. **Firebase → Authentication → Settings → Authorized domains:**

   Добавь домен: `<your-username>.github.io`

4. Пуш в main → автодеплой

Сайт будет доступен: `https://<your-username>.github.io/DeltaOps/`

### Ручной деплой

```bash
npm run build
# Загрузи папку dist/ вручную или через gh-pages
```

---

## Firebase — настройка безопасности

### Authentication

- Метод: **Google Sign-In**
- Authorized domains: `localhost`, `<your-username>.github.io`

### Firestore Rules

Файл `firestore.rules` содержит правила:
- Чтение — только авторизованные пользователи
- Запись — только админы
- Исключения: посещаемость (свои записи), webContent (публичный лендинг)

**Загрузка правил:**
1. Firebase Console → Firestore → Rules
2. Скопируй содержимое `firestore.rules`
3. Publish

### Firestore Indexes

Проект может потребовать составные индексы. Firebase покажет ссылку для создания в консоли браузера при первой ошибке.

---

## Скрипты

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Превью сборки |
| `node scripts/seed.mjs` | Начальные данные |
| `node scripts/seed-missions.mjs` | Тестовые миссии |
| `node scripts/read-player.mjs [nick]` | Чтение игрока из Firestore |
| `node scripts/cleanup-players.mjs` | Очистка лишних полей |
| `node scripts/migrate-player-ids.mjs` | Миграция на stable ID |

Все скрипты читают конфиг из `.env.local`.

---

## Переменные окружения

| Переменная | Обязательная | Описание |
|------------|:---:|----------|
| `VITE_FIREBASE_API_KEY` | Да | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Да | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Да | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Да | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Да | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Да | Firebase App ID |
| `VITE_TELEGRAM_BOT_TOKEN` | Нет | Telegram бот (уведомления) |
| `VITE_TELEGRAM_CHAT_ID` | Нет | Telegram чат ID |
