// =============================================================
// DeltaOps Parsing — Content Script
// =============================================================
// Парсер для страниц миссий tsgames.ru
// =============================================================

const parsers = [
  {
    name: "TSGames — Миссия",
    urlPattern: /^https?:\/\/(www\.)?tsgames\.ru\/missions\/[^\/]+/,
    parse() {
      const BASE_URL = "https://tsgames.ru";

      // --- Mission Title ---
      const title = document.querySelector(".main-container h2")?.textContent?.trim() || "";

      // --- Metadata Table ---
      const metaRow = document.querySelector(".table.table-striped tbody tr");
      const metaCells = metaRow ? Array.from(metaRow.querySelectorAll("td")) : [];

      const map = metaCells[1]?.textContent?.trim() || "";
      const authors = metaCells[6]
        ? Array.from(metaCells[6].querySelectorAll("a")).map(a => a.textContent.trim())
        : [];
      const version = metaCells[7]?.textContent?.trim() || "";

      // --- Mission Info Panel (li.list-group-item) ---
      const infoItems = document.querySelectorAll(".panel-heading + .panel-body .list-group .list-group-item");

      function getInfoItem(label) {
        for (const li of infoItems) {
          const strong = li.querySelector("strong");
          if (strong && strong.textContent.trim().includes(label)) {
            return li;
          }
        }
        return null;
      }

      // Download link
      const downloadLi = getInfoItem("Ссылка на скачивание");
      const downloadLink = downloadLi?.querySelector("a")?.getAttribute("href") || "";

      // Sides raw text
      const sidesLi = getInfoItem("Стороны");
      const sidesRaw = sidesLi ? sidesLi.textContent.replace("Стороны", "").trim() : "";

      // Description
      const descLi = getInfoItem("Краткое описание");
      const description = descLi
        ? descLi.textContent.replace("Краткое описание", "").trim()
        : "";

      // Additional conditions
      const condLi = getInfoItem("Дополнительные условия");
      const additionalConditions = condLi
        ? condLi.textContent.replace("Дополнительные условия", "").trim()
        : "";

      // --- Vehicle/Equipment per side ---
      const vehicleColors = ["синих", "красных", "зеленых"];
      const vehicleColorMap = { "синих": "blue", "красных": "red", "зеленых": "green" };
      const vehicles = {};

      for (const color of vehicleColors) {
        const li = getInfoItem(`Техника ${color}`);
        if (li) {
          const span = li.querySelector("span.blue, span.red, span.green");
          vehicles[vehicleColorMap[color]] = span?.textContent?.trim() || li.textContent.replace(`Техника ${color}`, "").trim();
        }
      }

      // --- Parse Sides (panels) ---
      const sideColorMap = {
        "panel-side-blue": "blue",
        "panel-side-red": "red",
        "panel-side-green": "green"
      };

      const sidePanels = document.querySelectorAll(".panel[class*='panel-side-']");
      const sides = [];

      for (const panel of sidePanels) {
        const classList = Array.from(panel.classList);
        const colorClass = classList.find(c => c.startsWith("panel-side-"));
        const color = sideColorMap[colorClass] || "unknown";

        // Side name
        const sideName = panel.querySelector(".panel-title a")?.textContent?.trim() || "";

        // Extract side number from heading ID (headingSide1, headingSide2, headingSide3)
        const headingId = panel.querySelector(".panel-heading")?.id || "";
        const sideNum = headingId.replace("headingSide", "");

        // --- Parse role and player count from sidesRaw ---
        let role = "";
        let players = 0;

        // Find matching span in the sides info
        if (sidesLi) {
          const spans = sidesLi.querySelectorAll(`span.${color}`);
          for (const span of spans) {
            const text = span.textContent.trim();
            // Format: "Name: 100"
            const countMatch = text.match(/:\s*(\d+)$/);
            if (countMatch) {
              players = parseInt(countMatch[1], 10);
            }
          }
          // Look for role after the span: (Оборона) or (Атака)
          const sidesHtml = sidesLi.innerHTML;
          const roleMatch = sidesHtml.match(new RegExp(`<span class="${color}">[^<]+</span>\\s*(?:\\+\\s*<span[^>]*>[^<]+</span>\\s*)?\\(([^)]+)\\)`));
          if (roleMatch) {
            role = roleMatch[1].trim();
          }
          // Also check if the role is before the span combination
          const roleBeforeMatch = sidesHtml.match(new RegExp(`\\(([^)]+)\\)\\s*(?:VS)?\\s*<span class="${color}">`));
          if (!role && roleBeforeMatch) {
            role = roleBeforeMatch[1].trim();
          }
        }

        // --- Squads (Отделения) ---
        const squadsContainer = panel.querySelector(`#squadsTree-${sideNum}`);
        const squadPanels = squadsContainer
          ? squadsContainer.querySelectorAll(".panel.panel-warning")
          : [];

        const squads = [];
        for (const sp of squadPanels) {
          const titleEl = sp.querySelector(".panel-title a");
          const fullTitle = titleEl?.textContent?.trim() || "";

          // Parse "Alpha-1-1 (11)" → name: "Alpha-1-1", size: 11
          const titleMatch = fullTitle.match(/^(.+?)\s*\((\d+)\)$/);
          const squadName = titleMatch ? titleMatch[1].trim() : fullTitle;
          const squadSize = titleMatch ? parseInt(titleMatch[2], 10) : 0;

          // Slots
          const slotEls = sp.querySelectorAll(".list-group-item");
          const slots = Array.from(slotEls).map(el => el.textContent.trim());

          squads.push({
            name: squadName,
            size: squadSize,
            slots
          });
        }

        // --- Gallery (screenshots) ---
        const galleryContainer = panel.querySelector(`#screenshot-gallery-${sideNum}`);
        const galleryLinks = galleryContainer
          ? Array.from(galleryContainer.querySelectorAll("a[href*='/images/screenshots']"))
          : [];

        const gallery = galleryLinks.map(a => {
          const href = a.getAttribute("href") || "";
          return href.startsWith("http") ? href : BASE_URL + href;
        });

        // --- Vehicles for this side ---
        const sideVehicles = vehicles[color] || "";

        sides.push({
          name: sideName,
          color,
          role,
          players,
          vehicles: sideVehicles,
          squads,
          gallery
        });
      }

      return {
        title,
        map,
        authors,
        version,
        downloadLink: downloadLink ? BASE_URL + downloadLink : "",
        description,
        sidesRaw,
        additionalConditions,
        sides,
        scrapedAt: new Date().toISOString(),
        sourceUrl: window.location.href
      };
    }
  }
];

// =============================================================
// Engine: select parser and run
// =============================================================
(() => {
  const url = window.location.href;
  const parser = parsers.find(p => p.urlPattern.test(url));

  if (!parser) {
    return {
      error: `Нет парсера для этого URL: ${url}`,
      url
    };
  }

  try {
    const data = parser.parse();
    return {
      parserName: parser.name,
      data
    };
  } catch (err) {
    return {
      error: `Ошибка парсера "${parser.name}": ${err.message}`,
      parserName: parser.name
    };
  }
})();
