(function () {
  const sessionStorageKey = "cloudshirt.sessionId";

  function getSessionId() {
    const existing = localStorage.getItem(sessionStorageKey);
    if (existing) {
      return existing;
    }

    let generated = "";
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      generated = crypto.randomUUID();
    } else if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      generated = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } else {
      generated = `cs-${Date.now()}`;
    }
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
