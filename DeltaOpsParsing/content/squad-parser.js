// =============================================================
// DeltaOps Parsing — Squad Parser
// =============================================================
// Парсит страницу отряда tsgames.ru/squad/DELTA
// Возвращает: данные отряда (squad) + список игроков (players)
// =============================================================

(() => {
  const BASE_URL = "https://tsgames.ru";

  // --- Helper: найти li по тексту label в strong ---
  function getInfoValue(label) {
    const items = document.querySelectorAll(".list-group.light-border .list-group-item");
    for (const li of items) {
      const strong = li.querySelector("strong");
      if (strong && strong.textContent.trim().includes(label)) {
        const spans = li.querySelectorAll(":scope > span");
        const lastSpan = spans[spans.length - 1];
        return lastSpan?.textContent?.trim() || "";
      }
    }
    return "";
  }

  // --- Squad Info (config/squad) ---
  const name = document.querySelector(".main-container h2")?.textContent?.trim() || "";
  const tag = getInfoValue("Отрядный тег").replace(/^\[|\]$/g, "");

  // Лого отряда (внутри .squad-page, не из сайдбара "Наши отряды")
  const logoEl = document.querySelector(".squad-page .text-center img");
  let logo = logoEl?.getAttribute("src") || "";
  if (logo && !logo.startsWith("http")) {
    logo = BASE_URL + logo;
  }

  // Статус отряда
  const status = getInfoValue("Статус") || "active";

  const recruitmentRaw = getInfoValue("Набор в отряд");
  const recruitment = recruitmentRaw.includes("открыт") ? "open" : "closed";

  // Сервер: число → 'T2'|'T3'
  const serverRaw = parseInt(getInfoValue("Сервер"), 10) || 0;
  const server = serverRaw ? `T${serverRaw}` : "";

  // Сторона: ищем span с классом red/blue
  let side = "";
  const sideItems = document.querySelectorAll(".list-group.light-border .list-group-item");
  for (const li of sideItems) {
    const strong = li.querySelector("strong");
    if (strong && strong.textContent.trim().includes("Сторона")) {
      if (li.querySelector("span.red")) side = "red";
      else if (li.querySelector("span.blue")) side = "blue";
      break;
    }
  }

  const guaranteedSlots = parseInt(getInfoValue("Гарантированные слоты"), 10) || 0;
  const createdAt = getInfoValue("Дата создания") || "";

  // --- Players ---
  const playerElements = document.querySelectorAll(".profile-mini-card .profile-mini-card-element");
  const players = Array.from(playerElements).map(el => {
    const nickname = el.querySelector(".profile-mini-card-username > span")?.textContent?.trim() || "";
    const position = el.querySelector(".profile-mini-card-position span")?.textContent?.trim() || "Боец отряда";

    const imgEl = el.querySelector(".profile-mini-card-img");
    let avatar = imgEl?.getAttribute("src") || "";
    if (avatar && !avatar.startsWith("http")) {
      avatar = BASE_URL + avatar;
    }

    return { nickname, position, avatar };
  });

  const squad = {
    name,
    tag,
    logo,
    status,
    server,
    side,
    guaranteedSlots,
    recruitment,
    createdAt,
    scrapedAt: new Date().toISOString()
  };

  return { squad, players };
})();
