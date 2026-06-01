// =============================================================
// DeltaOps Parsing — Mission Games Parser
// =============================================================
// Парсит страницу tsgames.ru/games?mission=...
// Возвращает список отыгрышей миссии и победившую сторону
// =============================================================

(() => {
  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function getRowValue(container, label) {
    const rows = container.querySelectorAll(".game-item-information .row");
    for (const row of rows) {
      const title = normalizeText(row.querySelector(".col-lg-2")?.textContent || "");
      if (title.includes(label)) {
        return row.querySelector(".col-lg-10");
      }
    }
    return null;
  }

  function parseWinner(container) {
    const winnerCell = getRowValue(container, "Победившая сторона");
    const colorEl = winnerCell?.querySelector(".blue, .red, .green");
    const fallbackHeader = container.querySelector(".game-item-header-right abbr");

    const text = normalizeText(colorEl?.textContent || winnerCell?.textContent || fallbackHeader?.textContent || "");

    if (!text || /неизвест/i.test(text)) {
      return { sideKey: "unknown", sideName: text || "Неизвестно" };
    }

    if (colorEl?.classList.contains("blue")) {
      return { sideKey: "blue", sideName: text };
    }
    if (colorEl?.classList.contains("red")) {
      return { sideKey: "red", sideName: text };
    }
    if (colorEl?.classList.contains("green")) {
      return { sideKey: "green", sideName: text };
    }

    return { sideKey: text.toLowerCase(), sideName: text };
  }

  function parseGame(container) {
    const headerText = normalizeText(container.querySelector(".game-item-header-left")?.textContent || "");
    const serverMatch = headerText.match(/№\s*(\d+)/);

    return {
      replayUrl: container.querySelector("a[href*='replay.tsgames.ru']")?.href || "",
      startedAt: normalizeText(container.querySelector("time")?.textContent || ""),
      server: serverMatch ? `T${serverMatch[1]}` : "",
      version: normalizeText(getRowValue(container, "Версия")?.textContent || ""),
      winner: parseWinner(container),
    };
  }

  const items = Array.from(document.querySelectorAll(".list-group-item[data-game-element-id]"));

  return {
    missionSlug: new URL(window.location.href).searchParams.get("mission") || "",
    games: items.map(parseGame),
  };
})();
