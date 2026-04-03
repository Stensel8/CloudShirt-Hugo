(function () {
  function create(config) {
    const apiBase = config && config.apiBase ? config.apiBase : "/api";
    const getAuthToken = config && typeof config.getAuthToken === "function" ? config.getAuthToken : () => "";
    const getSessionId = config && typeof config.getSessionId === "function" ? config.getSessionId : () => "";
    const getCartItems = config && typeof config.getCartItems === "function" ? config.getCartItems : () => [];

    function getAuthHeaders() {
      const headers = { "Content-Type": "application/json" };
      const token = getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      return headers;
    }

    async function fetchJSON(url, options) {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorBody = (await response.text()).trim();
        const error = new Error(errorBody || `request failed: ${response.status}`);
        error.status = response.status;
        error.body = errorBody;
        throw error;
      }
      return response.json();
    }

    async function checkApiHealth() {
      await fetchJSON(`${apiBase}/health`);
    }

    async function loadCatalog() {
      return fetchJSON(`${apiBase}/catalog/items`);
    }

    async function loadRemoteBasket() {
      const payload = await fetchJSON(`${apiBase}/basket/${encodeURIComponent(getSessionId())}`);
      return Array.isArray(payload.items) ? payload.items : [];
    }

    async function saveRemoteBasket() {
      await fetchJSON(`${apiBase}/basket/${encodeURIComponent(getSessionId())}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: getCartItems() }),
      });
    }

    async function placeOrder(email) {
      return fetchJSON(`${apiBase}/orders`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ sessionId: getSessionId(), email }),
      });
    }

    async function getOrdersForUser() {
      const payload = await fetchJSON(`${apiBase}/orders/me`, {
        headers: getAuthHeaders(),
      });
      return Array.isArray(payload.orders) ? payload.orders : [];
    }

    async function getOrdersForAdmin() {
      const payload = await fetchJSON(`${apiBase}/admin/orders`, {
        headers: getAuthHeaders(),
      });
      return Array.isArray(payload.orders) ? payload.orders : [];
    }

    async function getProductsForAdmin() {
      const payload = await fetchJSON(`${apiBase}/admin/products`, {
        headers: getAuthHeaders(),
      });
      return Array.isArray(payload.items) ? payload.items : [];
    }

    async function updateAdminProduct(productId, payload) {
      return fetchJSON(`${apiBase}/admin/products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
    }

    async function login(email, password, sessionId) {
      return fetchJSON(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, sessionId }),
      });
    }

    async function logout() {
      await fetchJSON(`${apiBase}/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
    }

    async function loadAuthMe() {
      const payload = await fetchJSON(`${apiBase}/auth/me`, {
        headers: getAuthHeaders(),
      });
      return payload.user;
    }

    return {
      checkApiHealth,
      loadCatalog,
      loadRemoteBasket,
      saveRemoteBasket,
      placeOrder,
      getOrdersForUser,
      getOrdersForAdmin,
      getProductsForAdmin,
      updateAdminProduct,
      login,
      logout,
      loadAuthMe,
    };
  }

  window.cloudshirtApiFactory = {
    create,
  };
})();
