# DeltaOps — Структуры данных Firestore

Единственный источник истины о структурах данных.

```
Project ID:  <your-firebase-project-id>
Firestore:   https://firestore.googleapis.com/v1/projects/<your-project-id>/databases/(default)/documents
```

---

## Принципы

1. **Админ — единственный источник игроков.** Extension не создаёт новых, только обновляет существующих.
2. **ID игрока — везде.** В данных хранится только `playerId`. Ник отображается только в UI через `resolveNickname(id)`.
3. **Смена ника — одно поле.** Меняем `nickname` в `players/{id}`, и всё. Никаких каскадных обновлений.
4. **Перезаписываемые данные** (squad, missions, games, attendance, stats) — актуальны только на текущую неделю, каждую неделю перезаписываются. История — в архиве.
5. **Постоянные данные** (players, users, rotations, archive) — создаются как новые документы, живут вечно.

---

## Обзор коллекций

| Коллекция | Doc ID | Тип данных | Пишет |
|---|---|---|---|
| `config/squad` | — | Перезаписывается | Extension |
| `config/app` | — | Перезаписывается | App |
| `users` | `{firebaseUid}` | Постоянный | App |
| `players` | `{stableId}` | Постоянный | App (создание) + Extension (обновление) |
| `nicknameIndex` | `{nickname}` | Постоянный | App |
| `missions` | `{gameId}` | Перезаписывается | Extension |
| `games` | `{gameId}` | Перезаписывается | App |
| `attendance` | `{gameId}` | Перезаписывается | App |
| `rotations` | `{rotationId}` | Постоянный | App |
| `archive` | `{date}-{gameId}` | Постоянный (иммутабельно) | App |
| `stats` | `{stableId}` | Перезаписывается | App (через API) |
| `structures` | `{structId}` | Постоянный | App |
| `webContent` | `{pageId}` | Постоянный | App |

---

## 1. config/squad — Данные отряда

**Путь:** `config/squad` (один документ)
**Пишут:** App (Settings → Отряд) и Extension (парсинг страницы отряда). Оба делают PATCH — merge, не затирают поля друг друга.

**Extension-поля** (парсинг страницы отряда на TSG):

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | Название отряда |
| `tag` | `string` | `"[DELTA]"` |
| `logo` | `string` | URL логотипа с TSG |
| `status` | `string` | Статус отряда |
| `server` | `'T2'\|'T3'` | Сервер |
| `side` | `'red'\|'blue'` | Сторона |
| `guaranteedSlots` | `number` | Гарантированных слотов |
| `recruitment` | `'open'\|'closed'` | Статус набора |
| `scrapedAt` | `string` | ISO 8601 |

**App-only поля** (редактируются в Settings, Extension НЕ трогает):

| Поле | Тип | Описание |
|---|---|---|
| `siteUrl` | `string` | URL сайта (используется в Telegram-сообщениях) |
| `siteName` | `string` | Название сайта (заголовки Telegram, footer) |

**ВАЖНО:** Extension использует `updateFields()` с updateMask, НЕ `writeDocument()`. Это сохраняет App-only поля (siteUrl, siteName).

---

## 2. players/{stableId} — Игрок

**Document ID:** `p-{timestamp}` — стабильный, никогда не меняется.

**Создание:** Только админ.
**Обновление Extension-полей:** Extension ищет по нику в `nicknameIndex`, если нашёл — обновляет. Если не нашёл — ничего не делает.
**Обновление App-полей:** Админ через PlayerEditor.

| Поле | Тип | Источник | Описание |
|---|---|---|---|
| `nickname` | `string` | App / Extension | Текущий игровой ник |
| `email` | `string` | App | Email для связки с user |
| `position` | `string` | App | См. SQUAD_ROLES |
| `status` | `string` | App | `'active'\|'reserve'\|'banned'\|'left'` |
| `avatar` | `string` | Extension | URL аватара с tsgames.ru |
| `steamUrl` | `string` | App | Ссылка на Steam |
| `telegramUsername` | `string` | App | `@username` |
| `telegramId` | `number\|null` | App | Telegram user ID (для бота) |
| `discordId` | `string` | App | Discord ID |
| `discordUsername` | `string` | App | Discord username |
| `skills` | `array` | App | `[{ skillName, level }]` — level: `'beginner'\|'intermediate'\|'experienced'` |
| `wishes` | `string` | App | Пожелания игрока |
| `nicknameHistory` | `string[]` | App | Прошлые ники |
| `createdAt` | `Timestamp` | App | Дата создания |
| `updatedAt` | `Timestamp` | App | Последнее обновление |

### Extension — какие поля пишет

| Поле | Описание |
|---|---|
| `avatar` | URL аватара |
| `position` | Должность из TSG (Командир, Боец и т.д.) |

**Два поля. Всё остальное Extension НЕ трогает.** Используется `updateFields()` с updateMask.

### TSG URL (вычисляемый)

Не хранится. Строится в UI:
```js
function getTsgUrl(nickname) {
  return `https://tsgames.ru/user/profile/${nickname}`
}
```

### Жизненный цикл игрока

1. **Админ создаёт игрока** → `status: 'active'`
2. **Игрок уходит из отряда** → админ нажимает кнопку → `status: 'left'`, роль пользователя → `guest`
3. **Игрок сменил ник** → админ обновляет `nickname`, старый ник уходит в `nicknameHistory[]`, `nicknameIndex` обновляется автоматически

### Resolve ника

Везде в данных хранится `playerId`. Чтобы показать ник в UI:
```js
function resolveNickname(playerId) {
  return players[playerId]?.nickname ?? playerId
}
```

---

## 2a. nicknameIndex/{nickname} — Индекс ников

**Document ID:** текущий nickname
**Пишет:** App (при создании/обновлении/удалении игрока)
**Читает:** Extension (для поиска игрока по нику)

| Поле | Тип | Описание |
|---|---|---|
| `playerId` | `string` | `p-{timestamp}` |

При смене ника: старый документ удаляется, создаётся новый.

---

## 3. missions/{gameId} — Миссия

**Document ID:** `friday_1` | `friday_2` | `saturday_1` | `saturday_2`
**Пишет:** Extension (перезаписывает целиком)
**Читает:** App

| Поле | Тип | Описание |
|---|---|---|
| `title` | `string` | Название миссии |
| `sourceUrl` | `string` | URL на tsgames.ru |
| `downloadLink` | `string` | Ссылка на .pbo |
| `description` | `string` | Описание |
| `additionalConditions` | `string` | Доп. условия |
| `sidesRaw` | `string` | Сырой текст сторон |
| `sides` | `array` | Структурированные стороны (см. ниже) |
| `version` | `string` | Версия миссии |
| `authors` | `string[]` | Авторы |
| `map` | `string` | Карта |
| `scrapedAt` | `string` | ISO 8601 |
| `rotationSides` | `array` | Маппинг ротация→игровые стороны (из расписания, см. ниже) |

**rotationSides[]** (добавляется Extension из страницы расписания):

| Поле | Тип | Описание |
|---|---|---|
| `color` | `'red'\|'blue'` | Цвет ротационной стороны |
| `role` | `string` | "Атака", "Оборона" |
| `gameSides` | `array` | Игровые стороны в этой ротации |

**rotationSides[].gameSides[]:**

| Поле | Тип | Описание |
|---|---|---|
| `color` | `'blue'\|'red'\|'green'` | Цвет игровой стороны |
| `name` | `string` | Название фракции (напр. "ЧСО", "ВС РФ") |
| `players` | `number` | Кол-во игроков |

**sides[]:**

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | "Синие", "Красные", "Зелёные" |
| `color` | `'blue'\|'red'\|'green'` | Цвет стороны |
| `role` | `string` | "Атака", "Оборона" |
| `players` | `number` | Кол-во игроков |
| `vehicles` | `string` | Техника |
| `squads` | `array` | Отряды стороны (см. ниже) |
| `gallery` | `string[]` | URL скриншотов |

**sides[].squads[]:**

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | Название отряда/группы |
| `size` | `number` | Размер |
| `slots` | `string[]` | Список ролей |

---

## 4. users/{firebaseUid} — Пользователь сайта

**Document ID:** Firebase Auth UID
**Пишет:** App (при логине + админ)

| Поле | Тип | Описание |
|---|---|---|
| `email` | `string` | Google email |
| `name` | `string` | Имя из Google |
| `avatar` | `string` | Аватар из Google |
| `role` | `'guest'\|'member'\|'admin'` | Роль на сайте |
| `createdAt` | `Timestamp` | Первый логин |
| `lastLoginAt` | `Timestamp` | Последний логин |

### Связь User ↔ Player

Через совпадение `user.email === player.email`.

| Способ | Когда |
|---|---|
| **Автолинковка** | При логине: ищем `players` где `email === user.email`, если найден и role=guest → role=member |
| **Ручная привязка** | Админ записывает email в player |
| **Отвязка** | Админ очищает email в player |

### Жизненный цикл пользователя

1. Создал аккаунт (Google логин) → `role: 'guest'`
2. Админ привязал к профилю игрока → `role: 'member'`
3. Игрок ушёл → `role: 'guest'`

---

## 5. games/{gameId} — Расстановка на игру

**Document ID:** `friday_1` | `friday_2` | `saturday_1` | `saturday_2`
**Пишет:** App (админ)
**Перезаписывается** каждую неделю.

| Поле | Тип | Описание |
|---|---|---|
| `schedule` | `string` | `'friday_1'\|'friday_2'\|'saturday_1'\|'saturday_2'` |
| `date` | `string` | ISO дата игры `YYYY-MM-DD` |
| `sourceUrl` | `string` | URL миссии на tsgames.ru |
| `version` | `string` | Версия миссии |
| `slots` | `array` | Массив слотов (см. ниже) |
| `task` | `string` | Задача от админа |
| `updatedAt` | `Timestamp` | Последнее обновление |
| `updatedBy` | `string` | UID админа |

**slots[]:**

| Поле | Тип | Описание |
|---|---|---|
| `side` | `string` | Сторона |
| `squad` | `string` | Название отряда/группы |
| `number` | `number` | Номер слота |
| `name` | `string` | Название роли |
| `playerId` | `string\|null` | ID игрока (из `players`) |
| `equipment` | `string[]` | Снаряжение |
| `optics` | `boolean` | Есть ли оптика |
| `notes` | `string` | Заметки |
| `fireteam` | `string` | Файртима |
| `type` | `'vehicle'\|'reserve'\|'squadCommander'\|'sideCommander'\|null` | Тип слота |

### Настройка слотов (workflow)

1. Админ загружает миссию через Extension
2. На сайте: вкладка "Расстановка" → "Настроить слоты"
3. Открывается окно со сторонами (вкладки)
4. Кликаешь на слот → добавлен. Кликаешь ещё раз → убран.
5. Если убрал и вернул — данные слота сохраняются (память)
6. Настроенные слоты появляются на странице расстановки
7. Админ назначает игрока, экипировку, параметры
8. КО (squadCommander/sideCommander) может редактировать расстановку для своей игры

---

## 6. attendance/{gameId} — Посещаемость на игру

**Document ID:** `friday_1` | `friday_2` | `saturday_1` | `saturday_2`
**Пишет:** App
**Перезаписывается** каждую неделю.

| Поле | Тип | Описание |
|---|---|---|
| `schedule` | `string` | `'friday_1'\|...\|'saturday_2'` |
| `date` | `string` | ISO дата `YYYY-MM-DD` |
| `records` | `array` | Записи посещаемости |

**records[]:**

| Поле | Тип | Описание |
|---|---|---|
| `playerId` | `string` | ID игрока |
| `attendance` | `'confirmed'\|'tentative'\|'absent'\|'no_response'` | Статус |

---

## 7. rotations — Ротации

**Document ID:** `rotation-{id}`
**Пишет:** App (CRUD)

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | "Весна 2026" |
| `startDate` | `string` | ISO дата начала `YYYY-MM-DD` |
| `endDate` | `string\|null` | ISO дата конца `YYYY-MM-DD` |

### Вычисляемый статус

| Статус | Условие |
|---|---|
| `upcoming` | `today < startDate` |
| `active` | `startDate <= today` и (`endDate` нет или `today <= endDate`) |
| `past` | `today > endDate` |

---

## 8. archive/{date}-{gameId} — Архив игр

**Document ID:** `{YYYY-MM-DD}-{gameId}` (например `2026-03-27-friday_1`)
**Пишет:** App (при архивации в воскресенье). **Иммутабельно.**

Каждая запись — одна конкретная игра, не неделя.

| Поле | Тип | Описание |
|---|---|---|
| `rotation` | `string` | ID ротации |
| `server` | `string` | Сервер |
| `side` | `string` | Сторона |
| `date` | `string` | ISO дата игры |
| `schedule` | `string` | `'friday_1'\|...\|'saturday_2'` |
| `sourceUrl` | `string` | URL миссии |
| `version` | `string` | Версия |
| `slots` | `array` | Копия из `games/{gameId}.slots` |
| `task` | `string` | Задача |
| `records` | `array` | Копия из `attendance/{gameId}.records` |
| `archivedAt` | `Timestamp` | Дата архивации |
| `archivedBy` | `string` | UID админа |

---

## 9. stats/{stableId} — Статистика КПД

**Document ID:** `{stableId}` (например `p-1748350001234`)
**Пишет:** App (GET запрос к API, поиск по нику/тегу, сохранение JSON)
**Перезаписывается.**

| Поле | Тип | Описание |
|---|---|---|
| `jsonResponse` | `object` | Сырой ответ API |
| `fetchedAt` | `Timestamp` | Когда обновлено |

---

## 10. webContent/{pageId} — Данные для сайта

**Document ID:** произвольный (`landing`, `about`, ...)
**Пишет:** App (админ)

| Поле | Тип | Описание |
|---|---|---|
| `description` | `string` | Описание |
| `text` | `string` | Текст |
| `...` | `any` | Другие поля по необходимости |

---

## 11. structures/{structId} — Шаблоны расстановок

**Document ID:** `struct-{name}` или произвольный
**Пишет:** App (админ)

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | Название шаблона |
| `slots` | `array` | Массив слотов шаблона |

**slots[]:**

| Поле | Тип | Описание |
|---|---|---|
| `slotNumber` | `number` | Номер слота |
| `section` | `string` | Секция (отделение) |
| `slotId` | `string` | Вычисляемый ID слота |
| `roleName` | `string` | Название роли |
| `type` | `string` | Тип (`'КО'` или пусто) |
| `equipment` | `string[]` | Снаряжение по умолчанию |

---

## Вычисляемая статистика

### Посещаемость

Считается из `archive` по `playerId`:

| Метрика | Формула |
|---|---|
| **За всё время** | Кол-во записей в archive где `records[].playerId === id` и `attendance === 'confirmed'` / общее кол-во записей |
| **За ротацию** | То же самое, но фильтр по `rotation === currentRotationId` |

### Оптика

Считается из `archive` по `playerId`:

| Метрика | Формула |
|---|---|
| **За всё время** | Кол-во игр с оптикой / кол-во сыгранных игр |
| **За ротацию** | Кол-во игр с оптикой за ротацию / кол-во сыгранных игр за ротацию |

---

## Недельный цикл

| День | Действие |
|---|---|
| **Вс** | Архивация: данные из `games` + `attendance` → `archive`. Очистка текущих данных |
| **Пн–Чт** | Админы загружают миссии (Extension). Игроки отмечаются. Админы делают расстановку |
| **Пт–Сб** | Отыгрыш. Перед играми админ обновляет посещаемость |
| **Вс** | Архивация |

---

## Extension — алгоритм работы

Extension делает 3 вещи:

### 1. Данные отряда
```
PATCH config/squad — перезапись целиком (name, tag, server, side, guaranteedSlots, recruitment)
```

### 2. Миссии
```
PATCH missions/{gameId} — перезапись целиком
```

### 3. Аватары и должности игроков
```
Для каждого игрока из списка TSG:
  1. GET nicknameIndex/{nickname}
  2. Если найден → PATCH players/{playerId} (только avatar, position) через updateFields
  3. Если НЕ найден → пропустить (НЕ создавать!)
```

**Extension НЕ создаёт игроков. НЕ меняет status. НЕ удаляет записи.**

Смена ника:
1. Extension не находит новый ник → пропускает
2. Админ меняет ник в профиле игрока → `nicknameIndex` обновляется
3. При следующем парсинге Extension найдёт новый ник и обновит аватар

---

## Extension API

| Коллекция | Метод | updateMask | Поведение |
|---|---|---|---|
| `config/squad` | PATCH | **да** | Extension-поля (name, tag, logo, status, server, side, guaranteedSlots, recruitment, scrapedAt). НЕ трогает App-only (siteUrl, siteName) |
| `nicknameIndex/{nickname}` | GET | — | Только чтение |
| `players/{stableId}` | PATCH | **да** | Только `avatar`, `position` |
| `missions/{gameId}` | PATCH | нет | Перезаписывает целиком |

---

## Профиль игрока — история слотов

На странице профиля игрока показываем историю его слотов.
Берём из `archive` все записи где в `slots[]` есть `playerId === id`.
Отображаем слот в том же стиле что и на странице расстановки.

---

## Game IDs

| ID | Лейбл |
|---|---|
| `friday_1` | Пятница #1 |
| `friday_2` | Пятница #2 |
| `saturday_1` | Суббота #1 |
| `saturday_2` | Суббота #2 |

---

## Константы (src/utils/constants.js)

**Player Statuses:** `active`, `reserve`, `banned`, `left`

**Site Roles:** `admin`, `member`, `guest`

**Squad Positions:** Командир отряда, Заместитель Командира отряда, Штабист, Боец отряда, Курсант отряда, Боец запаса

**Skills:** ПТРК, ПЗРК, СПГ/АГС/МК, ЗУ, ДШК/М2/КОРД, Артиллерист, Снайпер, Сапер, БПЛА, Медик, БМП, Танк, ПВО, Вертолёт [Т], Вертолёт [Б], Самолет

**Skill Levels:** `beginner` (Новичок), `intermediate` (Средний), `experienced` (Опытный)

**Attendance:** `confirmed`, `tentative`, `absent`, `no_response`

**Slot Types:** `vehicle`, `reserve`, `squadCommander`, `sideCommander`

---

## Схема коллекций (дерево)

```
firestore/
├── config/
│   ├── app                          ← currentRotationId
│   └── squad                        ← Extension: name, tag, server, side, slots, recruitment
├── users/
│   └── {firebaseUid}                ← email, name, avatar, role
├── players/
│   └── p-{timestamp}                ← nickname, email, position, status, skills, ...
├── nicknameIndex/
│   └── {nickname}                   ← { playerId }
├── missions/
│   ├── friday_1                     ← Extension: перезапись целиком
│   ├── friday_2
│   ├── saturday_1
│   └── saturday_2
├── games/
│   ├── friday_1                     ← App: расстановка (slots, task)
│   ├── friday_2
│   ├── saturday_1
│   └── saturday_2
├── attendance/
│   ├── friday_1                     ← App: посещаемость (records)
│   ├── friday_2
│   ├── saturday_1
│   └── saturday_2
├── rotations/
│   └── rotation-{id}                ← name, startDate, endDate
├── archive/
│   └── {date}-{gameId}              ← Иммутабельный снимок: slots + records
├── stats/
│   └── p-{timestamp}                ← jsonResponse от API
└── webContent/
    └── {pageId}                     ← Контент для сайта
```
