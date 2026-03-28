# Extension: Работа с данными

## Принцип

Extension **только обновляет** существующие данные. Не создаёт игроков, не меняет статусы.

## Что делает Extension (3 вещи)

### 1. Данные отряда
```
PATCH config/squad — перезапись целиком
Поля: name, tag, server, side, guaranteedSlots, recruitment
```

### 2. Миссии
```
PATCH missions/{gameId} — перезапись целиком
Поля: title, sourceUrl, downloadLink, description, additionalConditions, sidesRaw, sides (включая squads внутри каждой стороны), version, authors, map
```

### 3. Аватары игроков
```
Для каждого игрока из списка TSG:
  1. GET nicknameIndex/{nickname}
  2. Если найден → PATCH players/{playerId} (только avatar)
  3. Если НЕ найден → пропустить
```

## Что Extension НЕ делает

- Не создаёт игроков
- Не меняет status
- Не пишет tsgUrl (строится в UI: `https://tsgames.ru/user/profile/${nickname}`)
- Не удаляет записи

## Сценарий: игрок сменил ник

1. Extension не находит новый ник в `nicknameIndex` → пропускает
2. Админ меняет ник в профиле → `nicknameIndex` обновляется автоматически
3. Следующий парсинг → Extension находит ник → обновляет аватар
