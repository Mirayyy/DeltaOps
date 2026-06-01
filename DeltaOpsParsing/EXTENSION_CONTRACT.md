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

### 1. `missions/{gameId}` — миссии

**Метод:** `writeDocument()` (перезапись целиком — ОК)
**Document IDs:** `friday_1`, `friday_2`, `saturday_1`, `saturday_2`

Миссии полностью принадлежат Extension. App только читает.

### 2. `config/squad` — чтение стороны ротации

**Метод:** `readDocument()` — только чтение.

Extension использует `config/squad.side`, чтобы после парсинга миссии сохранить `rotationSides`.

### 3. `nicknameIndex/{nickname}` — индекс ников

**Метод:** `readDocument()` — ТОЛЬКО ЧТЕНИЕ
**Сейчас не используется для записи игроков и НЕ изменяется.**

---

## Структура БД (два конфиг-документа)

| Документ | Ownership | Поля |
|---|---|---|
| `config/squad` | App only for data, Extension only reads `side` | name, tag, logo, status, guaranteedSlots, recruitment, createdAt, server, side, contacts, awards, aboutMarkdown, skillNames |
| `config/app` | App only | siteName, siteUrl, githubUrl, firestoreUrl |

---

## Чеклист перед коммитом (верификация)

### Проверка writeDocument vs updateFields

- [ ] `missions/{gameId}` → используется `writeDocument()` — это ОК
- [ ] `missions/{gameId}.rotationSides` → используется `updateFields()`
- [ ] `config/squad` → ТОЛЬКО `readDocument()` для чтения `side`
- [ ] `nicknameIndex` → ТОЛЬКО `readDocument()`, никаких write/update

### Проверка полей

- [ ] Extension НЕ пишет в `config/app` (только App)
- [ ] Extension НЕ пишет в `config/squad`
- [ ] Extension НЕ пишет в `players`

### Проверка создания/удаления

- [ ] Нет вызовов `deleteDocument()` или DELETE запросов
- [ ] Нет создания новых документов в `players`
- [ ] Нет создания новых документов в `nicknameIndex`
- [ ] Нет создания новых документов в `config`
- [ ] `missions/{gameId}` — допустимо создание (PATCH создаёт если не существует)

---

## Опасные паттерны (НЕ ДЕЛАТЬ)

```js
// ❌ ОПАСНО — писать что-либо в config/squad из extension
await updateFields({ tag: "DELTA" }, "config/squad");

// ✅ ПРАВИЛЬНО — только читать сторону ротации
const squad = await readDocument("config/squad");
const side = squad?.side;
```

---

## Файлы расширения (D:\git\DeltaOpsParsing)

| Файл | Роль |
|---|---|
| `lib/firestore-client.js` | `readDocument`, `writeDocument`, `updateFields` |
| `background/service-worker.js` | Логика парсинга и записи в Firestore |
| `content/content-script.js` | Парсинг страницы миссии |
| `content/squad-parser.js` | Legacy parser страницы отряда, сейчас не используется |
| `content/schedule-parser.js` | Парсинг расписания |
| `config.js` | Firebase credentials |

---

## Связь двух репозиториев

| Репо | Что делает | Пишет в |
|---|---|---|
| `DeltaOps` (сайт) | UI, управление, архивация | users, players, rotations, config/squad, config/app |
| `DeltaOpsParsing` (extension) | Парсинг TSG | missions, missions.rotationSides |

**При изменении структуры данных — обновить ОБА репозитория и этот документ.**
