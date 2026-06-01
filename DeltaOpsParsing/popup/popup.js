const btnAll = document.getElementById("btn-all");
const statusEl = document.getElementById("status");
const slotButtons = document.querySelectorAll(".btn-slot-action");
const sidePickerEl = document.getElementById("side-picker");
const sideListEl = document.getElementById("side-list");
const btnSaveSides = document.getElementById("btn-save-sides");
const btnSkipSides = document.getElementById("btn-skip-sides");

const SLOT_LABELS = {
  friday_1: "Пятница 1",
  friday_2: "Пятница 2",
  saturday_1: "Суббота 1",
  saturday_2: "Суббота 2"
};

// State for side picker
let pendingSlot = null;
let pendingSides = [];
let sideAssignments = {}; // { sideColor: 'ally' | 'enemy' }

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (type ? " " + type : "");
}

function setAllDisabled(disabled) {
  slotButtons.forEach(btn => btn.disabled = disabled);
  btnAll.disabled = disabled;
}

function hideSidePicker() {
  sidePickerEl.style.display = "none";
  pendingSlot = null;
  pendingSides = [];
  sideAssignments = {};
}

function showSidePicker(slot, sides) {
  pendingSlot = slot;
  pendingSides = sides;
  sideAssignments = {};

  sideListEl.innerHTML = "";

  for (const side of sides) {
    const item = document.createElement("div");
    item.className = "side-item";
    item.innerHTML = `
      <span class="side-dot ${side.color}"></span>
      <span class="side-name">${side.name || side.color}</span>
      <span class="side-players">${side.players || ""}</span>
      <div class="side-toggle">
        <button data-color="${side.color}" data-team="ally">Союзник</button>
        <button data-color="${side.color}" data-team="enemy">Противник</button>
      </div>
    `;
    sideListEl.appendChild(item);
  }

  // Toggle handlers
  sideListEl.querySelectorAll(".side-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      const color = btn.dataset.color;
      const team = btn.dataset.team;

      // Clear sibling
      const sibling = btn.parentElement.querySelector(
        `[data-team="${team === "ally" ? "enemy" : "ally"}"]`
      );
      sibling.classList.remove("ally", "enemy");

      // Toggle this button
      if (btn.classList.contains(team)) {
        btn.classList.remove(team);
        delete sideAssignments[color];
      } else {
        btn.classList.add(team);
        sideAssignments[color] = team;
      }
    });
  });

  sidePickerEl.style.display = "";
}

// =============================================================
// Single slot → parse the currently open tab
// =============================================================
slotButtons.forEach(btn => {
  btn.addEventListener("click", async () => {
    const slot = btn.dataset.slot;
    const mode = btn.dataset.mode;
    const action = mode === "info" ? "updateMissionInfo" : "replaceMission";
    const actionLabel = mode === "info" ? "Инфо" : "Миссия";

    slotButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    hideSidePicker();

    setStatus(`${actionLabel}: ${SLOT_LABELS[slot]}...`, "loading");
    setAllDisabled(true);

    try {
      const response = await chrome.runtime.sendMessage({
        action,
        slot,
      });

      if (!response?.success) {
        throw new Error(response?.error || "Неизвестная ошибка");
      }

      let text = `✓ ${response.missionTitle} → ${SLOT_LABELS[slot]}`;
      if (response.followedNewerVersion) text += " [новая версия]";
      if (response.warnings?.length) text += " [статистика частично]";
      setStatus(text, "success");

      if (response.requiresSidePicker && response.sides && response.sides.length > 0) {
        showSidePicker(slot, response.sides);
      }
    } catch (err) {
      setStatus(`✗ ${err.message}`, "error");
    } finally {
      btn.classList.remove("active");
      setAllDisabled(false);
    }
  });
});

// =============================================================
// Save rotation sides
// =============================================================
btnSaveSides.addEventListener("click", async () => {
  if (!pendingSlot) return;

  const assigned = Object.keys(sideAssignments);
  if (assigned.length === 0) {
    setStatus("Выберите хотя бы одну сторону", "error");
    return;
  }

  setAllDisabled(true);
  btnSaveSides.disabled = true;
  btnSkipSides.disabled = true;
  setStatus("Сохранение сторон...", "loading");

  try {
    // Read squad side from Firestore
    const squadRes = await chrome.runtime.sendMessage({ action: "readSquadSide" });
    const squadSide = squadRes?.side;

    if (!squadSide) {
      throw new Error("Сторона ротации отряда не найдена в config/squad");
    }

    const otherSide = squadSide === "red" ? "blue" : "red";

    // Build rotationSides: allies → squadSide, enemies → otherSide
    const allyGameSides = [];
    const enemyGameSides = [];

    for (const side of pendingSides) {
      const gs = { color: side.color, name: side.name, players: side.players };
      if (sideAssignments[side.color] === "ally") {
        allyGameSides.push(gs);
      } else if (sideAssignments[side.color] === "enemy") {
        enemyGameSides.push(gs);
      }
    }

    const rotationSides = [];
    if (allyGameSides.length) {
      rotationSides.push({ color: squadSide, role: "", gameSides: allyGameSides });
    }
    if (enemyGameSides.length) {
      rotationSides.push({ color: otherSide, role: "", gameSides: enemyGameSides });
    }

    await chrome.runtime.sendMessage({
      action: "saveRotationSides",
      slot: pendingSlot,
      rotationSides
    });

    setStatus(`✓ Стороны сохранены → ${SLOT_LABELS[pendingSlot]}`, "success");
    hideSidePicker();
  } catch (err) {
    setStatus(`✗ ${err.message}`, "error");
  } finally {
    setAllDisabled(false);
  }
});

btnSkipSides.addEventListener("click", () => {
  hideSidePicker();
});

// =============================================================
// All 4 missions — full automatic (schedule → validate → parse)
// =============================================================
btnAll.addEventListener("click", async () => {
  setAllDisabled(true);
  btnAll.classList.add("running");
  hideSidePicker();
  setStatus("Загрузка всех миссий...", "loading");

  try {
    const response = await chrome.runtime.sendMessage({ action: "autoParseAll" });

    if (!response?.success) {
      throw new Error(response?.error || "Неизвестная ошибка");
    }

    const ok = response.results.length;
    const fail = response.errors.length;

    if (fail === 0) {
      setStatus(`✓ Все ${ok} миссии загружены`, "success");
    } else if (ok > 0) {
      setStatus(`✓ ${ok}/4 загружено, ${fail} ошибок`, "error");
    } else {
      setStatus(`✗ ${response.errors[0]?.error || "Ошибка"}`, "error");
    }
  } catch (err) {
    setStatus(`✗ ${err.message}`, "error");
  } finally {
    btnAll.classList.remove("running");
    setAllDisabled(false);
  }
});
