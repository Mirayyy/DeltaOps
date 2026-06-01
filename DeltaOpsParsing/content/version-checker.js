// =============================================================
// DeltaOps Parsing — Version Checker
// =============================================================
// Проверяет, есть ли на странице миссии предупреждение о новой версии.
// Если да — возвращает URL новой версии.
// =============================================================

(() => {
  const alert = document.querySelector(".alert.alert-warning");

  if (alert) {
    const link = alert.querySelector("a.alert-link[href*='/missions/']");
    if (link) {
      const href = link.getAttribute("href") || "";
      const url = href.startsWith("http") ? href : "https://tsgames.ru" + href;
      return { hasNewerVersion: true, newerUrl: url };
    }
  }

  return { hasNewerVersion: false, newerUrl: null };
})();
