# DeltaOps Extension — Контракт записи данных

Инструкция для Claude Code: что расширение пишет, куда, и чего делать НЕЛЬЗЯ.

---

## Золотые правила

1. **Extension НЕ создаёт документов.** Только обновляет существующие.
2. **Extension НЕ удаляет документов.** Никогда, ни при каких условиях.
3. **Extension НЕ трогает чужие поля.** Используй `updateFields()` с updateMask для документов где есть App-поля.
4. **Игрок не найден в nicknameIndex → пропустить.** Не создавать, не логировать ошибку.
5. **Миссии — единственное исключение:** перезаписываются целиком через `writeDocument()`.

---

## Что пишет Extension

### 1. `config/squad` — данные отряда с TSG

**Метод:** `updateFields()` (с updateMask!)
**Почему НЕ writeDocument:** App хранит здесь же поля `name`, `logo`, `siteUrl`, `siteName`. Перезапись затрёт их.

**Extension пишет:**

| Поле | Тип | Откуда |
|---|---|---|
| `name` | `string` | Название отряда с TSG |
| `tag` | `string` | Отрядный тег |
| `logo` | `string` | URL лого отряда с TSG |
| `status` | `string` | Статус отряда |
| `server` | `string` | Сервер (T2/T3) |
| `side` | `string` | Сторона (red/blue) |
| `guaranteedSlots` | `number` | Гарантированные слоты |
| `recruitment` | `string` | Набор (open/closed) |
| `scrapedAt` | `string` | `new Date().toISOString()` |

**Extension НЕ трогает:** `siteUrl`, `siteName` (только App)

### 2. `missions/{gameId}` — миссии

**Метод:** `writeDocument()` (перезапись целиком — ОК)
**Document IDs:** `friday_1`, `friday_2`, `saturday_1`, `saturday_2`

Миссии полностью принадлежат Extension. App только читает.

**Дополнительно:** после записи миссии, Extension дописывает поле `rotationSides` через `updateFields()` — маппинг ротационных сторон → игровых сторон из страницы расписания.

### 3. `players/{stableId}` — аватары и должности

**Метод:** `updateFields()` (с updateMask!)
**Алгоритм:**

```
for каждого игрока из парсинга TSG:
  1. GET nicknameIndex/{nickname}
  2. if (документ существует && playerId есть):
       updateFields({ avatar, position }, `players/${playerId}`)
  3. else:
       skip — НЕ создавать, НЕ логировать ошибку
```

**Extension пишет ТОЛЬКО:**

| Поле | Описание |
|---|---|
| `avatar` | URL аватара с tsgames.ru |
| `position` | Должность из TSG |

**Extension НЕ трогает:** `nickname`, `email`, `status`, `skills`, `wishes`, `telegramUsername`, и все остальные поля.

### 4. `nicknameIndex/{nickname}` — индекс ников

**Метод:** `readDocument()` — ТОЛЬКО ЧТЕНИЕ
**Extension НИКОГДА не пишет в nicknameIndex.**

---

## Чеклист перед коммитом (верификация)

### Проверка writeDocument vs updateFields

- [ ] `config/squad` → используется `updateFields()`, НЕ `writeDocument()`
- [ ] `players/{id}` → используется `updateFields()`, НЕ `writeDocument()`
- [ ] `missions/{gameId}` → используется `writeDocument()` — это ОК
- [ ] `nicknameIndex` → ТОЛЬКО `readDocument()`, никаких write/update

### Проверка полей

- [ ] Extension НЕ пишет поле `siteUrl` в `config/squad` (только App)
- [ ] Extension НЕ пишет поле `siteName` в `config/squad` (только App)
- [ ] Extension НЕ пишет поле `status` в `players`
- [ ] Extension НЕ пишет поле `email` в `players`
- [ ] Extension НЕ пишет поле `nickname` в `players`
- [ ] Extension НЕ пишет поле `skills` в `players`

### Проверка создания/удаления

- [ ] Нет вызовов `deleteDocument()` или DELETE запросов
- [ ] Нет создания новых документов в `players` (только update существующих)
- [ ] Нет создания новых документов в `nicknameIndex`
- [ ] Нет создания новых документов в `config` (только update существующего `config/squad`)
- [ ] `missions/{gameId}` — допустимо создание (PATCH создаёт если не существует)

### Проверка дубликатов

- [ ] Миссии пишутся по фиксированным ID (`friday_1`, `friday_2`, `saturday_1`, `saturday_2`) — дубликаты невозможны
- [ ] `config/squad` — один документ, перезапись — дубликаты невозможны
- [ ] Игроки обновляются по `playerId` из `nicknameIndex` — один ник → один ID → дубликаты невозможны

---

## Опасные паттерны (НЕ ДЕЛАТЬ)

```js
// ❌ ОПАСНО — затирает App-only поля (siteUrl, siteName) в config/squad
await writeDocument(squad, "config/squad");

// ✅ ПРАВИЛЬНО — обновляет только переданные поля, не трогает остальные
await updateFields(squad, "config/squad");
```

```js
// ❌ ОПАСНО — затирает все поля игрока
await writeDocument({ avatar: url }, `players/${id}`);

// ✅ ПРАВИЛЬНО — обновляет только avatar
await updateFields({ avatar: url }, `players/${id}`);
```

```js
// ❌ ОПАСНО — создаёт игрока которого нет в системе
if (!indexDoc) {
  await writeDocument({ nickname, avatar }, `players/new-${nickname}`);
}

// ✅ ПРАВИЛЬНО — пропускает неизвестного
if (!indexDoc?.playerId) {
  skipped++;
  continue;
}
```

---

## Файлы расширения (D:\git\DeltaOpsParsing)

| Файл | Роль |
|---|---|
| `lib/firestore-client.js` | `readDocument`, `writeDocument`, `updateFields` |
| `background/service-worker.js` | Логика парсинга и записи в Firestore |
| `content/content-script.js` | Парсинг страницы миссии |
| `content/squad-parser.js` | Парсинг страницы отряда |
| `content/schedule-parser.js` | Парсинг расписания |
| `config.js` | Firebase credentials |

---

## Связь двух репозиториев

| Репо | Что делает | Пишет в |
|---|---|---|
| `DeltaOps` (сайт) | UI, управление, архивация | users, players, games, attendance, archive, rotations, config/squad (App-поля), webContent |
| `DeltaOpsParsing` (extension) | Парсинг TSG | config/squad (Extension-поля), missions, players (avatar+position) |

**При изменении структуры данных — обновить ОБА репозитория и этот документ.**
