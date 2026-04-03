(function () {
  const sessionStorageKey = "cloudshirt.sessionId";

  function getSessionId() {
    const existing = localStorage.getItem(sessionStorageKey);
    if (existing) {
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `cs-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    localStorage.setItem(sessionStorageKey, generated);
    return generated;
  }

  function formatPrice(value) {
    return Number(value || 0).toFixed(2);
  }

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  window.cloudshirtCore = {
    sessionStorageKey,
    getSessionId,
    formatPrice,
    normalize,
    escapeHtml,
    slugify,
  };
})();
