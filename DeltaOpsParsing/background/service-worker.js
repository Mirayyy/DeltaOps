import { writeDocument, updateFields, readDocument, deleteDocument } from "../lib/firestore-client.js";

const SCHEDULE_URL = "https://tsgames.ru/missions/list/schedule";
const MISSION_GAMES_URL = "https://tsgames.ru/games?mission=";

// =============================================================
// Tab lifecycle — create, use, close
// =============================================================

/** Создаёт фоновый таб, выполняет работу, закрывает таб */
async function withTab(fn) {
  const tab = await chrome.tabs.create({ url: "about:blank", active: false });
  try {
    return await fn(tab.id);
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch {}
  }
}

/** Выполняет content script в табе и возвращает результат */
async function runScript(tabId, scriptFile) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: [scriptFile]
  });
  return results[0]?.result;
}

/** Навигирует таб на URL и ждёт полной загрузки */
function navigateAndWait(tabId, url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Таймаут загрузки: ${url}`));
    }, 30000);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.update(tabId, { url });
  });
}

// =============================================================
// Date validation
// =============================================================

function isDateCurrentWeek(dateStr) {
  if (!dateStr) return { valid: false, reason: "Дата не найдена в расписании" };

  const [day, month, year] = dateStr.split(".").map(Number);
  const scheduleDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayDay = today.getDay();
  let refDate = new Date(today);
  if (todayDay === 0) refDate.setDate(refDate.getDate() + 1);

  const daysToFriday = 5 - refDate.getDay();
  const friday = new Date(refDate);
  friday.setDate(friday.getDate() + daysToFriday);
  const saturday = new Date(friday);
  saturday.setDate(saturday.getDate() + 1);

  const sd = scheduleDate.toDateString();
  if (sd === friday.toDateString() || sd === saturday.toDateString()) {
    return { valid: true };
  }

  const fmt = (d) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  return {
    valid: false,
    reason: `Расписание на ${dateStr} — не текущая неделя (ожидается ${fmt(friday)} или ${fmt(saturday)})`
  };
}

// =============================================================
// Helpers
// =============================================================

/** Проверяет версию и переходит на новую если есть (до 2 уровней) */
async function followNewerVersion(tabId) {
  const v1 = await runScript(tabId, "content/version-checker.js");
  if (v1?.hasNewerVersion && v1.newerUrl) {
    await navigateAndWait(tabId, v1.newerUrl);
    const v2 = await runScript(tabId, "content/version-checker.js");
    if (v2?.hasNewerVersion && v2.newerUrl) {
      await navigateAndWait(tabId, v2.newerUrl);
    }
    return true;
  }
  return false;
}

function getMissionSlug(sourceUrl) {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const parts = pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

function buildMissionSlugCandidates(sourceUrl) {
  const slug = getMissionSlug(sourceUrl);
  if (!slug) return [];

  const result = new Set([slug]);
  if (slug.endsWith("_L")) {
    result.add(slug.slice(0, -2));
  } else {
    result.add(`${slug}_L`);
  }

  return [...result];
}

function buildWinStats(games, sourceMissionSlug, aliases) {
  const sideWinsMap = new Map();
  let knownGames = 0;
  let unknownWins = 0;

  for (const game of games) {
    const winner = game.winner || { sideKey: "unknown", sideName: "Неизвестно" };
    if (!winner.sideKey || winner.sideKey === "unknown") {
      unknownWins++;
      continue;
    }

    knownGames++;
    if (!sideWinsMap.has(winner.sideKey)) {
      sideWinsMap.set(winner.sideKey, {
        sideKey: winner.sideKey,
        sideName: winner.sideName || winner.sideKey,
        wins: 0,
        rate: 0,
      });
    }

    const stat = sideWinsMap.get(winner.sideKey);
    stat.wins += 1;
    if ((!stat.sideName || stat.sideName === stat.sideKey) && winner.sideName) {
      stat.sideName = winner.sideName;
    }
  }

  const sideWins = [...sideWinsMap.values()].map((stat) => ({
    ...stat,
    rate: knownGames > 0 ? stat.wins / knownGames : 0,
  }));

  return {
    totalGames: games.length,
    knownGames,
    unknownWins,
    sideWins,
    sourceMissionSlug,
    aliases,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchMissionWinStats(sourceUrl) {
  const candidates = buildMissionSlugCandidates(sourceUrl);
  if (!candidates.length) {
    return { winStats: null, warnings: ["Не удалось определить slug миссии для статистики"] };
  }

  return withTab(async (tabId) => {
    const seenGames = new Set();
    const allGames = [];
    const aliases = [];
    const warnings = [];

    for (const slug of candidates) {
      try {
        await navigateAndWait(tabId, `${MISSION_GAMES_URL}${encodeURIComponent(slug)}`);
        const result = await runScript(tabId, "content/games-parser.js");
        if (!result || result.error) {
          warnings.push(`Статистика не распознана для ${slug}`);
          continue;
        }

        aliases.push(slug);

        for (const game of result.games || []) {
          const uniqueKey = game.replayUrl || `${game.startedAt}::${game.server}::${game.version}`;
          if (seenGames.has(uniqueKey)) continue;
          seenGames.add(uniqueKey);
          allGames.push(game);
        }
      } catch (error) {
        warnings.push(`Не удалось загрузить статистику для ${slug}`);
      }
    }

    return {
      winStats: buildWinStats(allGames, candidates[0], aliases),
      warnings,
    };
  });
}

function structuresMatch(currentMission, parsedMission) {
  const currentSides = currentMission?.sides || [];
  const parsedSides = parsedMission?.sides || [];

  if (currentSides.length !== parsedSides.length) return false;

  for (let sideIndex = 0; sideIndex < currentSides.length; sideIndex++) {
    const currentSide = currentSides[sideIndex];
    const parsedSide = parsedSides[sideIndex];

    if (!parsedSide) return false;
    if (currentSide?.name !== parsedSide?.name) return false;
    if (currentSide?.color !== parsedSide?.color) return false;

    const currentSquads = currentSide?.squads || [];
    const parsedSquads = parsedSide?.squads || [];
    if (currentSquads.length !== parsedSquads.length) return false;

    for (let squadIndex = 0; squadIndex < currentSquads.length; squadIndex++) {
      const currentSquad = currentSquads[squadIndex];
      const parsedSquad = parsedSquads[squadIndex];

      if (!parsedSquad) return false;
      if (currentSquad?.name !== parsedSquad?.name) return false;

      const currentSlots = currentSquad?.slots || [];
      const parsedSlots = parsedSquad?.slots || [];
      if (currentSlots.length !== parsedSlots.length) return false;
    }
  }

  return true;
}

function buildInfoOnlyMission(currentMission, parsedMission, winStats) {
  if (!currentMission?.sides?.length) {
    return {
      ...parsedMission,
      rotationSides: currentMission?.rotationSides || parsedMission.rotationSides || [],
      ...(winStats ? { winStats } : {}),
    };
  }

  const sides = currentMission.sides.map((currentSide, sideIndex) => {
    const parsedSide = parsedMission.sides?.[sideIndex] || {};
    return {
      ...currentSide,
      role: parsedSide.role ?? currentSide.role,
      players: parsedSide.players ?? currentSide.players,
      vehicles: parsedSide.vehicles ?? currentSide.vehicles,
      gallery: Array.isArray(parsedSide.gallery) ? parsedSide.gallery : currentSide.gallery,
    };
  });

  return {
    ...currentMission,
    ...parsedMission,
    sides,
    rotationSides: currentMission.rotationSides || parsedMission.rotationSides || [],
    ...(winStats ? { winStats } : {}),
  };
}

async function parseMission(tabId) {
  const followed = await followNewerVersion(tabId);

  const parseResult = await runScript(tabId, "content/content-script.js");
  if (!parseResult || parseResult.error) {
    throw new Error(parseResult?.error || "Не удалось спарсить миссию");
  }

  return {
    followedNewerVersion: followed,
    mission: parseResult.data,
  };
}

function getMissionSidesForPicker(mission) {
  return (mission?.sides || []).map((side) => ({
    color: side.color,
    name: side.name,
    players: side.players,
  }));
}

async function replaceMissionDocument(slot, mission, { deleteFirst = false } = {}) {
  if (deleteFirst) {
    await deleteDocument(`missions/${slot}`).catch(() => false);
  }

  await writeDocument(mission, `missions/${slot}`);
}

async function replaceMissionAndSave(tabId, slot) {
  const { followedNewerVersion, mission } = await parseMission(tabId);
  const { winStats, warnings } = await fetchMissionWinStats(mission.sourceUrl);

  const nextMission = {
    ...mission,
    ...(winStats ? { winStats } : {}),
  };

  await replaceMissionDocument(slot, nextMission, { deleteFirst: true });

  return {
    success: true,
    slot,
    missionTitle: mission.title,
    followedNewerVersion,
    sides: getMissionSidesForPicker(mission),
    requiresSidePicker: true,
    warnings,
  };
}

async function updateMissionInfoAndSave(tabId, slot) {
  const currentMission = await readDocument(`missions/${slot}`);
  const { followedNewerVersion, mission } = await parseMission(tabId);

  if (currentMission && !structuresMatch(currentMission, mission)) {
    throw new Error("Структура миссии изменилась. Используйте «Обновить миссию»");
  }

  const { winStats, warnings } = await fetchMissionWinStats(mission.sourceUrl);
  const nextMission = buildInfoOnlyMission(currentMission, mission, winStats);

  await replaceMissionDocument(slot, nextMission, { deleteFirst: false });

  return {
    success: true,
    slot,
    missionTitle: mission.title,
    followedNewerVersion,
    requiresSidePicker: false,
    warnings,
  };
}

// =============================================================
// Message Handlers
// =============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    replaceMission: () => parseCurrentTab(message.slot, "replace"),
    updateMissionInfo: () => parseCurrentTab(message.slot, "info"),
    autoParseAll: () => autoParseAll(),
    readSquadSide: () => readSquadSide(),
    saveRotationSides: () => saveRotationSides(message.slot, message.rotationSides),
  };

  const handler = handlers[message.action];
  if (!handler) return;

  handler()
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true;
});

// =============================================================
// Parse Current Tab (single slot — user is on mission page)
// =============================================================

async function parseCurrentTab(slot, mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("Нет активной вкладки");

  const url = tab.url || "";
  if (!url.includes("tsgames.ru/missions/")) {
    throw new Error("Откройте страницу миссии на tsgames.ru");
  }

  if (mode === "info") {
    return updateMissionInfoAndSave(tab.id, slot);
  }

  return replaceMissionAndSave(tab.id, slot);
}

// =============================================================
// Auto-Parse All (full automatic — schedule → validate → parse)
// =============================================================

async function autoParseAll() {
  const ALL_SLOTS = ["friday_1", "friday_2", "saturday_1", "saturday_2"];
  const results = [];
  const errors = [];

  await withTab(async (tabId) => {
    // 1. Расписание
    await navigateAndWait(tabId, SCHEDULE_URL);
    const scheduleResult = await runScript(tabId, "content/schedule-parser.js");
    if (!scheduleResult || scheduleResult.error) {
      throw new Error(scheduleResult?.error || "Не удалось спарсить расписание");
    }

    // 2. Обход каждого слота
    for (const slot of ALL_SLOTS) {
      try {
        const slotInfo = scheduleResult.slots[slot];
        if (!slotInfo || !slotInfo.url) {
          errors.push({ slot, error: `Миссия для "${slot}" не найдена` });
          continue;
        }

        const dateCheck = isDateCurrentWeek(slotInfo.dateStr);
        if (!dateCheck.valid) {
          errors.push({ slot, error: dateCheck.reason });
          continue;
        }

        await navigateAndWait(tabId, slotInfo.url);
        const result = await replaceMissionAndSave(tabId, slot);

        // Merge rotation→game side mapping from schedule page
        if (slotInfo.rotationSides && slotInfo.rotationSides.length) {
          await updateFields({ rotationSides: slotInfo.rotationSides }, `missions/${slot}`);
        }
        results.push({ slot, title: result.missionTitle, warnings: result.warnings || [] });
      } catch (err) {
        errors.push({ slot, error: err.message });
      }
    }
  });

  return { success: true, results, errors };
}

// =============================================================
// Read squad side (rotation color) from config/squad
// =============================================================

async function readSquadSide() {
  const doc = await readDocument("config/squad");
  return { success: true, side: doc?.side || null };
}

// =============================================================
// Save rotationSides for a mission slot
// =============================================================

async function saveRotationSides(slot, rotationSides) {
  if (!slot || !rotationSides) throw new Error("Не указан слот или стороны");
  await updateFields({ rotationSides }, `missions/${slot}`);
  return { success: true };
}
