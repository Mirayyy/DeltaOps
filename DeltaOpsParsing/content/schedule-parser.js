// =============================================================
// DeltaOps Parsing — Schedule Parser
// =============================================================
// Парсит страницу расписания tsgames.ru/missions/list/schedule
// Возвращает миссии с URL, датами и ротационными сторонами
// =============================================================

(() => {
  const BASE_URL = "https://tsgames.ru";

  // Находим колонки: Пятница (первая) и Суббота (вторая)
  const columns = document.querySelectorAll(".container-fluid.no-padding > .col-sm-6");

  if (columns.length < 2) {
    return { error: "Не найдены колонки расписания (Пятница / Суббота)" };
  }

  function parseSides(panel) {
    const sideGroups = panel.querySelectorAll(".missions-schedule-item-sides-group");
    const rotationSides = [];

    for (const group of sideGroups) {
      // Rotation color from group class: -group-red → 'red', -group-blue → 'blue'
      const rotColor = group.classList.contains("missions-schedule-item-sides-group-red") ? "red"
        : group.classList.contains("missions-schedule-item-sides-group-blue") ? "blue" : "unknown";

      const role = group.querySelector("h4")?.textContent?.trim() || "";

      // Game sides inside this rotation group (can be multiple for 3+ side missions)
      const items = group.querySelectorAll(".missions-schedule-item-sides-item");
      const gameSides = [];

      for (const item of items) {
        const gameColor = item.classList.contains("missions-schedule-item-sides-blue") ? "blue"
          : item.classList.contains("missions-schedule-item-sides-red") ? "red"
          : item.classList.contains("missions-schedule-item-sides-green") ? "green" : "unknown";
        const name = item.querySelector("strong")?.textContent?.trim() || "";
        const players = parseInt(item.querySelector(".missions-schedule-item-slots")?.textContent?.trim(), 10) || 0;
        gameSides.push({ color: gameColor, name, players });
      }

      rotationSides.push({ color: rotColor, role, gameSides });
    }

    return rotationSides;
  }

  function parseColumn(column) {
    // Дата из заголовка: <h1>Пятница <small>27.03.2026</small></h1>
    const header = column.querySelector(".page-header h1");
    const dayName = header?.childNodes[0]?.textContent?.trim() || "";
    const dateStr = header?.querySelector("small")?.textContent?.trim() || "";

    // Миссии внутри колонки
    const missionPanels = column.querySelectorAll(".missions-schedule-item");
    const missions = [];

    for (const panel of missionPanels) {
      const title = panel.querySelector(".panel-title")?.textContent?.trim() || "";
      const linkEl = panel.querySelector("a.btn[href*='/missions/']");
      const href = linkEl?.getAttribute("href") || "";
      const url = href.startsWith("http") ? href : BASE_URL + href;
      const rotationSides = parseSides(panel);

      missions.push({ title, url, rotationSides });
    }

    return { dayName, dateStr, missions };
  }

  const friday = parseColumn(columns[0]);
  const saturday = parseColumn(columns[1]);

  // Собираем слоты
  const slots = {
    friday_1: {
      ...friday.missions[0],
      dayName: friday.dayName,
      dateStr: friday.dateStr
    },
    friday_2: {
      ...friday.missions[1],
      dayName: friday.dayName,
      dateStr: friday.dateStr
    },
    saturday_1: {
      ...saturday.missions[0],
      dayName: saturday.dayName,
      dateStr: saturday.dateStr
    },
    saturday_2: {
      ...saturday.missions[1],
      dayName: saturday.dayName,
      dateStr: saturday.dateStr
    }
  };

  return { slots };
})();
