(function () {
  const core = window.cloudshirtCore;
  if (!core) {
    return;
  }

  const { getSessionId, formatPrice, normalize, escapeHtml, slugify } = core;
  const authTokenStorageKey = "cloudshirt.authToken";
  const rememberedLoginStorageKey = "cloudshirt.rememberedEmail";
  const apiBase = "/api";
  const cart = [];
  const orders = [];
  let catalog = { brands: [], types: [], items: [] };
  let sessionId = "";
  let authToken = "";
  let authUser = null;

  const apiFactory = window.cloudshirtApiFactory;
  if (!apiFactory || typeof apiFactory.create !== "function") {
    return;
  }

  const api = apiFactory.create({
    apiBase,
    getAuthToken: () => authToken,
    getSessionId: () => sessionId,
    getCartItems: () => cart,
  });

  const {
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
  } = api;

  function showToast(root, message, kind = "info") {
    const type = ["success", "error", "info"].includes(kind) ? kind : "info";
    if (window.Swal) {
      const toast = window.Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
        background: "#ffffff",
      });

      toast.fire({
        icon: type === "error" ? "error" : type === "success" ? "success" : "info",
        title: message,
      });
      return;
    }

    window.alert(message);
  }

  function isUnauthorizedError(error) {
    return Boolean(error) && (error.status === 401 || error.status === 403);
  }

  function normalizePathname(pathname) {
    const normalized = String(pathname || "/").toLowerCase().replace(/\/+$/, "");
    return normalized || "/";
  }

  function getPathnameFromHref(href) {
    if (!href) {
      return "/";
    }

    try {
      const url = new URL(href, window.location.origin);
      return normalizePathname(url.pathname);
    } catch (error) {
      return "/";
    }
  }

  function isLoginLink(node) {
    if (!node || node.tagName !== "A") {
      return false;
    }

    const path = getPathnameFromHref(node.getAttribute("href"));
    return path.endsWith("/login");
  }

  function closeNavbarAccountMenus() {
    const menus = document.querySelectorAll("[data-nav-account-menu]");
    const toggles = document.querySelectorAll("[data-nav-account-toggle]");

    menus.forEach((menu) => {
      menu.hidden = true;
    });

    toggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function buildNavbarAccountNode(isMobile, links) {
    const wrapper = document.createElement("div");
    wrapper.className = isMobile ? "px-2 cs-nav-account cs-nav-account--mobile" : "cs-nav-account";
    wrapper.setAttribute("data-nav-account-root", "");
    const loginHref = links && links.login ? links.login : "/login/";
    const ordersHref = links && links.orders ? links.orders : "/orders/";
      const accountHref = links && links.account ? links.account : "/account/";
    wrapper.innerHTML = `
      <a class="cs-nav-account__login" href="${loginHref}" data-nav-account-login-direct>INLOGGEN</a>
      <button class="cs-nav-account__toggle" type="button" data-nav-account-toggle aria-haspopup="menu" aria-expanded="false" hidden>
        <span data-nav-account-name>Account</span>
        <span class="cs-nav-account__caret" aria-hidden="true">▾</span>
      </button>
      <div class="cs-nav-account__menu" data-nav-account-menu hidden>
        <a class="cs-nav-account__item" href="/admin/" data-nav-account-admin hidden>BEHEER</a>
        <a class="cs-nav-account__item" href="${ordersHref}" data-nav-account-orders>MIJN ORDERS</a>
        <a class="cs-nav-account__item" href="${accountHref}" data-nav-account-my-account>MIJN ACCOUNT</a>
        <button class="cs-nav-account__item" type="button" data-nav-account-logout>UITLOGGEN</button>
      </div>
    `;
    return wrapper;
  }

  function styleCartLinks() {
    const cartLinks = Array.from(document.querySelectorAll("nav a[href]")).filter((node) => {
      const path = getPathnameFromHref(node.getAttribute("href"));
      return path.endsWith("/cart");
    });

    cartLinks.forEach((link) => {
      if (link.dataset.csCartStyled === "1") {
        return;
      }

      const label = link.getAttribute("title") || "Winkelwagen";
      link.dataset.csCartStyled = "1";
      link.classList.add("cs-nav-cart");
      link.setAttribute("aria-label", label);
      link.innerHTML = '<span class="cs-nav-cart__icon" aria-hidden="true">🛒</span><span class="cs-nav-cart__badge" data-nav-cart-badge>0</span>';
    });
  }

  function syncCartBadges(quantity) {
    const badges = document.querySelectorAll("[data-nav-cart-badge]");
    badges.forEach((badge) => {
      badge.textContent = quantity > 99 ? "99+" : String(quantity);
      badge.classList.toggle("cs-nav-cart__badge--empty", Number(quantity) <= 0);
    });
  }

  function animateAddToCart(sourceNode) {
    const cartIcon = document.querySelector(".cs-nav-cart");
    if (cartIcon) {
      cartIcon.classList.remove("cs-nav-cart--bump");
      void cartIcon.offsetWidth;
      cartIcon.classList.add("cs-nav-cart--bump");
      window.setTimeout(() => cartIcon.classList.remove("cs-nav-cart--bump"), 420);
    }
  }

  function ensureNavbarAuthMenus() {
    const navNodes = Array.from(document.querySelectorAll("nav")).filter((nav) => nav.querySelector("a[href]"));

    navNodes.forEach((nav) => {
      const existing = nav.querySelector("[data-nav-account-root]");
      if (existing) {
        return;
      }

      const loginLinks = Array.from(nav.querySelectorAll("a[href]")).filter(isLoginLink);
      if (!loginLinks.length) {
        return;
      }

      const ordersLink = Array.from(nav.querySelectorAll("a[href]")).find((node) => {
        const path = getPathnameFromHref(node.getAttribute("href"));
        return path.endsWith("/orders");
      });

      const isMobile = Boolean(nav.closest("dialog"));
      const accountNode = buildNavbarAccountNode(isMobile, {
        login: loginLinks[0].getAttribute("href") || "/login/",
        orders: ordersLink ? ordersLink.getAttribute("href") : "/orders/",
        account: "/account/",
      });
      const anchorToReplace = loginLinks[0];
      const replaceTarget = isMobile && anchorToReplace.parentElement && anchorToReplace.parentElement.classList.contains("px-2")
        ? anchorToReplace.parentElement
        : anchorToReplace;

      replaceTarget.replaceWith(accountNode);

      loginLinks.slice(1).forEach((link) => {
        const mobileBlock = link.closest(".px-2");
        if (isMobile && mobileBlock) {
          mobileBlock.remove();
        } else {
          link.remove();
        }
      });

      const accountLinks = Array.from(nav.querySelectorAll("a[href]")).filter((node) => {
        const path = getPathnameFromHref(node.getAttribute("href"));
        return path.endsWith("/account");
      });
      accountLinks.forEach((link) => {
        if (!link.closest("[data-nav-account-root]")) {
          const block = link.closest(".px-2");
          if (block) {
            block.remove();
          } else {
            link.remove();
          }
        }
      });
    });
  }

  function syncNavbarAuthUI() {
    const isLoggedIn = Boolean(authUser);
    const loginLinks = Array.from(document.querySelectorAll("a[href]")).filter(isLoginLink);
    const accountRoots = document.querySelectorAll("[data-nav-account-root]");

    loginLinks.forEach((link) => {
      if (link.closest("[data-nav-account-root]")) {
        return;
      }
      const block = link.closest(".px-2");
      if (block) {
        block.classList.toggle("cs-hidden", isLoggedIn);
      } else {
        link.classList.toggle("cs-hidden", isLoggedIn);
      }
    });

    accountRoots.forEach((root) => {
      const nameNode = root.querySelector("[data-nav-account-name]");
      const loginDirect = root.querySelector("[data-nav-account-login-direct]");
      const toggle = root.querySelector("[data-nav-account-toggle]");
      const adminItem = root.querySelector("[data-nav-account-admin]");
      const ordersItem = root.querySelector("[data-nav-account-orders]");
      const logoutItem = root.querySelector("[data-nav-account-logout]");
      const accountItem = root.querySelector("[data-nav-account-my-account]");

      if (nameNode) {
        nameNode.textContent = isLoggedIn ? authUser.email : "Account";
      }

      if (loginDirect) {
        loginDirect.hidden = isLoggedIn;
      }

      if (toggle) {
        toggle.hidden = !isLoggedIn;
      }

      if (adminItem) {
        const isAdmin = isLoggedIn && String(authUser.role || "").toLowerCase() === "admin";
        adminItem.hidden = !isAdmin;
      }

      if (ordersItem) {
        ordersItem.hidden = !isLoggedIn;
      }

      if (logoutItem) {
        logoutItem.hidden = !isLoggedIn;
      }

      if (accountItem) {
        accountItem.hidden = !isLoggedIn;
      }
    });
  }

  async function clearAuthSession() {
    if (authToken) {
      try {
        await logout();
      } catch (error) {
        // Ignore logout API failures and clear local session anyway.
      }
    }

    authToken = "";
    authUser = null;
    localStorage.removeItem(authTokenStorageKey);
  }

  async function hydrateAuthFromStorage() {
    authToken = localStorage.getItem(authTokenStorageKey) || "";
    authUser = null;

    if (!authToken) {
      return null;
    }

    try {
      authUser = await loadAuthMe();
      return authUser;
    } catch (error) {
      await clearAuthSession();
      return null;
    }
  }

  function bindNavbarAuthEvents() {
    if (document.body.dataset.csNavbarAuthBound === "1") {
      return;
    }

    document.body.dataset.csNavbarAuthBound = "1";

    document.addEventListener("click", async (event) => {
      const toggle = event.target.closest("[data-nav-account-toggle]");
      if (toggle) {
        const root = toggle.closest("[data-nav-account-root]");
        const menu = root ? root.querySelector("[data-nav-account-menu]") : null;
        const willOpen = menu ? menu.hidden : false;

        closeNavbarAccountMenus();

        if (menu && willOpen) {
          menu.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
        }

        return;
      }

      const logoutNode = event.target.closest("[data-nav-account-logout]");
      if (logoutNode) {
        event.preventDefault();
        await clearAuthSession();
        syncNavbarAuthUI();
        closeNavbarAccountMenus();
        document.dispatchEvent(new CustomEvent("cloudshirt:logout"));
        return;
      }

      if (!event.target.closest("[data-nav-account-root]")) {
        closeNavbarAccountMenus();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNavbarAccountMenus();
      }
    });
  }

  function bootstrapLoginPage() {
    const loginPage = document.querySelector("[data-login-page]");
    ensureNavbarAuthMenus();
    styleCartLinks();
    bindNavbarAuthEvents();

    void (async () => {
      await hydrateAuthFromStorage();
      syncNavbarAuthUI();
    })();

    if (!loginPage) {
      return;
    }

    const loginForm = loginPage.querySelector("[data-login-form]");
    const emailInput = loginPage.querySelector("[data-login-email]");
    const passwordInput = loginPage.querySelector("[data-login-password]");
    const rememberInput = loginPage.querySelector("[data-login-remember]");
    const submitButton = loginPage.querySelector("[data-login-submit]");
    const statusNode = loginPage.querySelector("[data-login-status]");
    const presetButtons = Array.from(loginPage.querySelectorAll("[data-login-fill]"));
    const loginSessionId = getSessionId();

    const presets = {
      demo: {
        email: "demouser@microsoft.com",
        password: "Pass@word1",
      },
      admin: {
        email: "admin@microsoft.com",
        password: "Pass@word1",
      },
    };

    const rememberedEmail = localStorage.getItem(rememberedLoginStorageKey);
    if (emailInput && rememberedEmail) {
      emailInput.value = rememberedEmail;
      if (rememberInput) {
        rememberInput.checked = true;
      }
    }

    async function performLogin(email, password) {
      if (!email || !password) {
        if (statusNode) {
          statusNode.textContent = "Vul email en wachtwoord in.";
        }
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const payload = await login(email, password, loginSessionId);
        if (rememberInput && rememberInput.checked) {
          localStorage.setItem(rememberedLoginStorageKey, email);
        } else {
          localStorage.removeItem(rememberedLoginStorageKey);
        }
        localStorage.setItem(authTokenStorageKey, payload.token);
        const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";
        window.location.href = returnTo;
      } catch (error) {
        if (statusNode) {
          if (error && error.status === 423) {
            statusNode.textContent = "Account tijdelijk vergrendeld na te veel pogingen. Probeer later opnieuw.";
          } else if (error && error.status === 401) {
            statusNode.textContent = "Inloggen mislukt. Controleer de gegevens.";
          } else {
            statusNode.textContent = "Inloggen mislukt door een serverfout. Probeer opnieuw.";
          }
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    }

    if (loginForm) {
      loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";
        void performLogin(email, password);
      });
    }

    presetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const preset = presets[button.dataset.loginFill];
        if (!preset) {
          return;
        }

        if (emailInput) {
          emailInput.value = preset.email;
        }

        if (passwordInput) {
          passwordInput.value = preset.password;
        }

        if (statusNode) {
          statusNode.textContent = button.dataset.loginFill === "admin"
            ? "Admin-account ingevuld. Klik op Log in om door te gaan."
            : "Demo-account ingevuld. Klik op Log in om door te gaan.";
        }
      });
    });
  }

  function bootstrapAccountPage() {
    const accountPage = document.querySelector("[data-account-page]");
    if (!accountPage) {
      return;
    }

    ensureNavbarAuthMenus();
    styleCartLinks();
    bindNavbarAuthEvents();

    void (async () => {
      sessionId = getSessionId();
      await hydrateAuthFromStorage();
      syncNavbarAuthUI();

      const guestNode = accountPage.querySelector("[data-account-guest]");
      const profileNode = accountPage.querySelector("[data-account-profile]");
      const ordersNode = accountPage.querySelector("[data-account-orders]");
      const displayNameNode = accountPage.querySelector("[data-account-display-name]");
      const emailNode = accountPage.querySelector("[data-account-email]");
      const roleNode = accountPage.querySelector("[data-account-role]");
      const createdNode = accountPage.querySelector("[data-account-created]");
      const adminNodes = accountPage.querySelectorAll("[data-account-admin]");
      const logoutButton = accountPage.querySelector("[data-account-logout]");

      if (!authUser) {
        if (guestNode) {
          guestNode.hidden = false;
        }
        if (profileNode) {
          profileNode.hidden = true;
        }
        return;
      }

      if (guestNode) {
        guestNode.hidden = true;
      }
      if (profileNode) {
        profileNode.hidden = false;
      }

      if (displayNameNode) {
        displayNameNode.textContent = authUser.displayName || authUser.email;
      }
      if (emailNode) {
        emailNode.textContent = authUser.email || "-";
      }
      if (roleNode) {
        roleNode.textContent = String(authUser.role || "user").toUpperCase();
      }
      if (createdNode) {
        const created = authUser.createdAt ? new Date(authUser.createdAt) : null;
        createdNode.textContent = created && !Number.isNaN(created.getTime())
          ? created.toLocaleDateString("nl-NL")
          : "Onbekend";
      }

      const isAdmin = String(authUser.role || "").toLowerCase() === "admin";
      adminNodes.forEach((node) => {
        node.hidden = !isAdmin;
      });

      if (ordersNode) {
        try {
          const myOrders = await getOrdersForUser();
          const openOrders = myOrders.filter((order) => String(order.status || "").toLowerCase() === "submitted").length;
          ordersNode.textContent = `${myOrders.length} totaal, ${openOrders} open`;
        } catch (error) {
          ordersNode.textContent = "Niet beschikbaar";
        }
      }

      if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
          await clearAuthSession();
          syncNavbarAuthUI();
          window.location.href = "/login/?returnTo=/account/";
        });
      }
    })();
  }

  function initialize() {
    const root = document.querySelector("[data-cloudshirt-storefront]");
    if (!root) {
      bootstrapLoginPage();
      bootstrapAccountPage();
      return;
    }

    sessionId = getSessionId();

    const search = root.querySelector("[data-product-search]");
    const productCount = root.querySelector("[data-product-count]");
    const cartCount = root.querySelectorAll("[data-cart-count]");
    const cartTotal = root.querySelector("[data-cart-total]");
    const cartItems = root.querySelector("[data-cart-items]");
    const cartEmpty = root.querySelector("[data-cart-empty]");
    const checkoutButtons = Array.from(root.querySelectorAll("[data-place-order]"));
    const checkoutLink = root.querySelector("[data-checkout-link]");
    const checkoutStatus = root.querySelector("[data-checkout-status]");
    const sortButtons = Array.from(root.querySelectorAll("[data-sort]"));
    const brandFilterRoot = root.querySelector("[data-brand-filters]");
    const typeFilterRoot = root.querySelector("[data-type-filters]");
    const pagePrevButton = root.querySelector("[data-page-prev]");
    const pageNextButton = root.querySelector("[data-page-next]");
    const pageInfo = root.querySelector("[data-page-info]");
    const orderRows = root.querySelector("[data-order-rows]");
    const adminProductsRoot = root.querySelector("[data-admin-products]");
    const isAdminView = String(root.dataset.cloudshirtView || "").toLowerCase() === "admin";
    const authStatus = root.querySelector("[data-auth-status]");
    const apiBlocker = root.querySelector("[data-api-blocker]");
    let state = { brand: "all", type: "all", query: "", sort: "featured", page: 1, pageSize: 10 };

    ensureNavbarAuthMenus();
    styleCartLinks();
    bindNavbarAuthEvents();

    // Use this for blocking failures when the storefront cannot continue safely.
    function setFatalError(message) {
      if (apiBlocker) {
        apiBlocker.classList.remove("cs-hidden");
        apiBlocker.innerHTML = `<h3>Storefront tijdelijk niet beschikbaar</h3><p>${escapeHtml(message)}</p>`;
      }
      root.classList.add("cs-storefront--disabled");
    }

    function setAuthStatus(message) {
      if (authStatus) {
        authStatus.textContent = message;
      }
    }

    function setAuthUI() {
      const isLoggedIn = Boolean(authUser);

      if (isLoggedIn) {
        setAuthStatus(`Ingelogd als ${authUser.email}`);
      } else {
        setAuthStatus("Niet ingelogd.");
      }

      syncNavbarAuthUI();
      updateCheckoutUI();
    }

    function getCartQuantity() {
      return cart.reduce((total, item) => total + item.quantity, 0);
    }

    function getCartTotal() {
      return cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
    }

    function updateCheckoutUI() {
      const isLoggedIn = Boolean(authUser);
      const checkoutLabel = isLoggedIn ? "Afrekenen" : "Log in om af te rekenen";

      checkoutButtons.forEach((button) => {
        button.textContent = checkoutLabel;
      });

      if (checkoutLink) {
        checkoutLink.textContent = isLoggedIn ? "Bekijk orders" : "Log in om af te rekenen";
        checkoutLink.setAttribute("href", isLoggedIn ? "/orders/" : "/login/?returnTo=/cart/");
      }

      if (checkoutStatus) {
        checkoutStatus.textContent = isLoggedIn
          ? `Ingelogd als ${authUser.displayName}. Je doorloopt eerst een bevestiging en betaalstap.`
          : "Log in om af te rekenen. Je winkelwagen blijft bewaard.";
      }
    }

    function renderAdminProducts(items) {
      if (!adminProductsRoot) {
        return;
      }

      if (!items.length) {
        adminProductsRoot.innerHTML = '<div class="cs-storefront__muted">Geen producten gevonden.</div>';
        return;
      }

      adminProductsRoot.innerHTML = items.map((item) => `
        <article class="cs-admin-product" data-admin-product data-product-id="${item.id}">
          <div class="cs-admin-product__head">
            <h3 class="cs-admin-product__title">${escapeHtml(item.name)}</h3>
            <div class="cs-admin-product__meta">#${item.id}</div>
          </div>
          <div class="cs-admin-product__fields">
            <div class="cs-admin-product__field">
              <label>Naam</label>
              <input type="text" data-admin-field="name" value="${escapeHtml(item.name)}">
            </div>
            <div class="cs-admin-product__field">
              <label>Prijs</label>
              <input type="number" step="0.01" min="0" data-admin-field="price" value="${Number(item.price || 0).toFixed(2)}">
            </div>
            <div class="cs-admin-product__field">
              <label>Merk</label>
              <input type="text" data-admin-field="brand" value="${escapeHtml(item.brand)}">
            </div>
            <div class="cs-admin-product__field">
              <label>Type</label>
              <input type="text" data-admin-field="type" value="${escapeHtml(item.type)}">
            </div>
            <div class="cs-admin-product__field">
              <label>Afbeelding</label>
              <input type="text" data-admin-field="image" value="${escapeHtml(item.image)}">
            </div>
            <div class="cs-admin-product__field">
              <label>Omschrijving</label>
              <input type="text" data-admin-field="description" value="${escapeHtml(item.description || "")}">
            </div>
          </div>
          <div class="cs-storefront__filters">
            <button class="cs-button cs-button--accent" type="button" data-admin-save>Opslaan</button>
          </div>
        </article>
      `).join("");
    }

    function getAdminFieldValue(card, fieldName, fallback = "") {
      const node = card.querySelector(`[data-admin-field="${fieldName}"]`);
      if (!node) {
        return fallback;
      }
      return node.value || fallback;
    }

    function buildAdminProductPayload(card) {
      return {
        name: getAdminFieldValue(card, "name", ""),
        description: getAdminFieldValue(card, "description", ""),
        price: Number(getAdminFieldValue(card, "price", "0")),
        brand: getAdminFieldValue(card, "brand", ""),
        type: getAdminFieldValue(card, "type", ""),
        image: getAdminFieldValue(card, "image", ""),
      };
    }

    async function handleAdminProductSave(button) {
      const card = button.closest("[data-admin-product]");
      if (!card) {
        return;
      }

      const productId = Number(card.dataset.productId);
      const payload = buildAdminProductPayload(card);

      button.disabled = true;
      try {
        await updateAdminProduct(productId, payload);
        showToast(root, "Artikel opgeslagen.", "success");
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await clearAuthSession();
          syncNavbarAuthUI();
        }
        showToast(root, "Opslaan mislukt.", "error");
      } finally {
        button.disabled = false;
      }
    }

    async function handleCheckout(button) {
      const hasSwal = Boolean(window.Swal);
      if (!cart.length) {
        showToast(root, "Plaats eerst minimaal 1 product in je winkelwagen.", "info");
        return;
      }

      if (!authUser) {
        showToast(root, "Log in om af te rekenen.", "info");
        window.location.href = "/login/?returnTo=/cart/";
        return;
      }

      button.disabled = true;
      const proceed = hasSwal
        ? await window.Swal.fire({
          title: "Bestelling bevestigen",
          text: "Wil je doorgaan naar betalen?",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ja, ga verder",
          cancelButtonText: "Annuleren",
        }).then((result) => result.isConfirmed)
        : window.confirm("Wil je doorgaan naar betalen?");
      if (!proceed) {
        button.disabled = false;
        return;
      }

      showToast(root, "Betaalproces wordt gestart...", "info");
      await new Promise((resolve) => setTimeout(resolve, 850));
      try {
        await placeOrder(authUser.email);
        cart.splice(0, cart.length);
        renderCart();
        await syncBasket();
        await refreshOrders();
        if (hasSwal) {
          await window.Swal.fire({
            title: "Bedankt voor je bestelling!",
            text: "Je betaling is afgerond. Je bestelling staat nu bij je orders.",
            icon: "success",
            confirmButtonText: "Bekijk mijn orders",
          });
        } else {
          showToast(root, "Bedankt voor je bestelling!", "success");
        }
        window.location.href = "/orders/";
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await clearAuthSession();
          syncNavbarAuthUI();
        }
        showToast(root, "Order plaatsen mislukt. Probeer opnieuw.", "error");
      } finally {
        button.disabled = false;
      }
    }

    function setActiveButton(buttons, attributeName, value) {
      buttons.forEach((button) => {
        const isActive = button.dataset[attributeName] === value;
        button.classList.toggle("cs-filter--active", isActive);
        button.classList.toggle("cs-sort--active", isActive);
      });
    }

    function renderFilterButtons() {
      if (brandFilterRoot) {
        const brandButtonsMarkup = [
          '<button class="cs-filter cs-filter--active" type="button" data-filter-brand="all">Alle merken</button>',
          ...catalog.brands.map((brand) => `<button class="cs-filter" type="button" data-filter-brand="${slugify(brand)}">${escapeHtml(brand)}</button>`),
        ].join("");
        brandFilterRoot.innerHTML = brandButtonsMarkup;
      }

      if (typeFilterRoot) {
        const typeButtonsMarkup = [
          '<button class="cs-filter cs-filter--active" type="button" data-filter-type="all">Alle types</button>',
          ...catalog.types.map((type) => `<button class="cs-filter" type="button" data-filter-type="${slugify(type)}">${escapeHtml(type)}</button>`),
        ].join("");
        typeFilterRoot.innerHTML = typeButtonsMarkup;
      }
    }

    function renderCatalogItems() {
      const grid = root.querySelector("[data-product-grid]");
      if (!grid) {
        return;
      }

      grid.innerHTML = catalog.items
        .map((item, index) => {
          const name = escapeHtml(item.name);
          const brand = escapeHtml(item.brand);
          const type = escapeHtml(item.type);
          const image = escapeHtml(item.image);
          const price = Number(item.price || 0).toFixed(2);

          return `
          <article class="cs-product" data-product-card data-product-index="${index}" data-product-id="${item.id}" data-product-name="${name.toLowerCase()}" data-product-brand="${slugify(item.brand)}" data-product-type="${slugify(item.type)}" data-product-price="${price}">
            <div class="cs-product__media">
              <img class="cs-product__image" src="${image}" alt="${name}" loading="lazy" decoding="async" width="640" height="640">
              <span class="cs-product__badge">${brand}</span>
            </div>
            <div class="cs-product__body">
              <h3 class="cs-product__name">${name}</h3>
              <div class="cs-product__meta">
                <span>${type}</span>
                <span>Product #${item.id}</span>
              </div>
              <div class="cs-product__price">EUR ${price}</div>
              <button class="cs-button cs-button--accent cs-product__cta" type="button" data-add-to-cart data-product-id="${item.id}" data-product-name="${name}" data-product-price="${price}" data-product-image="${image}" data-product-brand="${brand}" data-product-type="${type}">Toevoegen aan winkelwagen</button>
            </div>
          </article>`;
        })
        .join("");
    }

    function renderOrders(orders) {
      if (!orderRows) {
        return;
      }

      orderRows.innerHTML = "";

      if (!orders.length) {
        orderRows.innerHTML = '<div class="cs-storefront__muted">Nog geen orders geplaatst.</div>';
        return;
      }

      orders.forEach((order, index) => {
        const details = document.createElement("details");
        details.className = "cs-order-card";

        if (index === 0) {
          details.open = true;
        }

        const items = Array.isArray(order.items) ? order.items : [];
        const orderDate = new Date(order.createdAt).toLocaleDateString("nl-NL");

        details.innerHTML = `
          <summary class="cs-order-card__summary">
            <div>
              <p class="cs-order-card__title">Order #${escapeHtml(order.id)}</p>
              <div class="cs-order-card__meta">
                <span>${escapeHtml(orderDate)}</span>
                <span>${escapeHtml(order.status)}</span>
                <span>${items.length} artikelen</span>
              </div>
            </div>
            <div class="cs-order-card__total">€${formatPrice(order.total)}</div>
          </summary>
          <div class="cs-order-card__body">
            <div class="cs-order-card__items">
              ${items
                .map((item) => `
                  <div class="cs-order-card__item">
                    <div>
                      <div class="cs-order-card__item-name">${escapeHtml(item.name)}</div>
                      <div class="cs-order-card__item-meta">${item.quantity} stuks · €${formatPrice(item.unitPrice)} per stuk</div>
                    </div>
                    <div class="cs-order-card__item-total">€${formatPrice(item.unitPrice * item.quantity)}</div>
                  </div>`)
                .join("")}
            </div>
          </div>`;

        orderRows.appendChild(details);
      });
    }

    // Load orders per context: admin gets all orders, users only their own orders.
    async function refreshOrders() {
      try {
        let loadedOrders = [];
        if (isAdminView) {
          if (!authUser) {
            showToast(root, "Log in als admin om het admin-paneel te gebruiken.", "info");
            window.location.href = "/login/?returnTo=/admin/";
            return;
          }
          loadedOrders = await getOrdersForAdmin();
        } else {
          if (!authUser) {
            showToast(root, "Log in om je orders te bekijken.", "info");
            window.location.href = "/login/?returnTo=/orders/";
            return;
          }
          loadedOrders = await getOrdersForUser();
        }
        orders.splice(0, orders.length, ...loadedOrders);
        renderOrders(orders);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          if (isAdminView) {
            showToast(root, error && error.status === 403 ? "Geen toegang tot admin orders." : "Sessie verlopen. Log opnieuw in.", "error");
          } else {
            showToast(root, "Sessie verlopen. Log opnieuw in.", "error");
          }
          await clearAuthSession();
          syncNavbarAuthUI();
          return;
        }
        showToast(root, "Orders laden mislukt", "error");
      }
    }

    async function refreshAdminProducts() {
      if (!isAdminView || !adminProductsRoot) {
        return;
      }

      try {
        const products = await getProductsForAdmin();
        renderAdminProducts(products);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          showToast(root, "Geen toegang tot artikelbeheer.", "error");
          await clearAuthSession();
          syncNavbarAuthUI();
          return;
        }
        showToast(root, "Producten laden mislukt.", "error");
      }
    }

    function renderCart() {
      const quantity = getCartQuantity();
      const total = getCartTotal();

      cartCount.forEach((node) => {
        node.textContent = String(quantity);
      });
      syncCartBadges(quantity);

      if (cartTotal) {
        cartTotal.textContent = formatPrice(total);
      }

      if (!cartItems || !cartEmpty) {
        return;
      }

      cartItems.innerHTML = "";

      if (!cart.length) {
        cartEmpty.hidden = false;
        return;
      }

      cartEmpty.hidden = true;

      cart.forEach((item) => {
        const row = document.createElement("article");
        row.className = "cs-cart__item";
        row.innerHTML = `
          <img class="cs-cart__thumb" src="${item.image}" alt="${item.name}" loading="lazy" decoding="async" width="96" height="96">
          <div>
            <h4 class="cs-cart__title">${item.name}</h4>
            <div class="cs-cart__meta">${item.brand} · ${item.type} · €${formatPrice(item.unitPrice)}</div>
            <div class="cs-cart__meta">Aantal: ${item.quantity}</div>
          </div>
          <div class="cs-cart__controls">
            <button class="cs-chip" type="button" data-cart-action="decrease" data-product-id="${item.productId}">−</button>
            <button class="cs-chip" type="button" data-cart-action="increase" data-product-id="${item.productId}">+</button>
            <button class="cs-chip" type="button" data-cart-action="remove" data-product-id="${item.productId}">Verwijder</button>
          </div>
        `;
        cartItems.appendChild(row);
      });
    }

    async function syncBasket() {
      await saveRemoteBasket();
    }

    function pulseProductCard(productId) {
      const card = root.querySelector(`[data-product-card][data-product-id="${productId}"]`);
      if (!card) {
        return;
      }
      card.classList.remove("cs-product--pulse");
      void card.offsetWidth;
      card.classList.add("cs-product--pulse");
      setTimeout(() => card.classList.remove("cs-product--pulse"), 300);
    }

    function flashProductButton(productId) {
      const button = root.querySelector(`[data-add-to-cart][data-product-id="${productId}"]`);
      if (!button) {
        return;
      }

      button.classList.remove("cs-product__cta--flash");
      void button.offsetWidth;
      button.classList.add("cs-product__cta--flash");
      window.setTimeout(() => button.classList.remove("cs-product__cta--flash"), 380);
    }

    async function syncCartItem(product, sourceNode) {
      const existing = cart.find((item) => String(item.productId) === String(product.productId));

      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          productId: Number(product.productId),
          name: product.name,
          unitPrice: Number(product.unitPrice),
          image: product.image,
          brand: product.brand,
          type: product.type,
          quantity: 1,
        });
      }

      renderCart();
      pulseProductCard(product.productId);
      flashProductButton(product.productId);
      animateAddToCart(sourceNode);
      try {
        await syncBasket();
        showToast(root, `${product.name} toegevoegd aan winkelwagen`, "success");
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await clearAuthSession();
          syncNavbarAuthUI();
        }
        showToast(root, "Product lokaal toegevoegd, maar sync met server faalde.", "error");
      }
    }

    async function updateCartItem(productId, delta) {
      const index = cart.findIndex((entry) => String(entry.productId) === String(productId));
      if (index < 0) {
        return;
      }

      if (delta === Infinity) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
          cart.splice(index, 1);
        }
      }

      renderCart();
      try {
        await syncBasket();
        showToast(root, "Winkelwagen bijgewerkt", "info");
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await clearAuthSession();
          syncNavbarAuthUI();
        }
        showToast(root, "Aanpassing gelukt, maar sync met server faalde.", "error");
      }
    }

    function sortCards(cardsToSort) {
      const sorted = [...cardsToSort];

      if (state.sort === "name-asc") {
        sorted.sort((left, right) => left.dataset.productName.localeCompare(right.dataset.productName));
      } else if (state.sort === "price-asc") {
        sorted.sort((left, right) => Number(left.dataset.productPrice) - Number(right.dataset.productPrice));
      } else if (state.sort === "price-desc") {
        sorted.sort((left, right) => Number(right.dataset.productPrice) - Number(left.dataset.productPrice));
      } else {
        sorted.sort((left, right) => Number(left.dataset.productIndex) - Number(right.dataset.productIndex));
      }

      return sorted;
    }

    function applyFilters() {
      const cards = Array.from(root.querySelectorAll("[data-product-card]"));
      const filteredCards = [];
      const searchValue = normalize(search ? search.value : state.query);

      cards.forEach((card) => {
        const matchesBrand = state.brand === "all" || card.dataset.productBrand === state.brand;
        const matchesType = state.type === "all" || card.dataset.productType === state.type;
        const matchesQuery = !searchValue || [card.dataset.productName, card.dataset.productBrand, card.dataset.productType].join(" ").includes(searchValue);
        const visible = matchesBrand && matchesType && matchesQuery;

        if (visible) {
          filteredCards.push(card);
        } else {
          card.classList.add("cs-is-hidden");
        }
      });

      const grid = root.querySelector("[data-product-grid]");
      const sorted = sortCards(filteredCards);
      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page > totalPages) {
        state.page = totalPages;
      }

      const startIndex = (state.page - 1) * state.pageSize;
      const endIndex = startIndex + state.pageSize;

      sorted.forEach((card, index) => {
        const onPage = index >= startIndex && index < endIndex;
        card.classList.toggle("cs-is-hidden", !onPage);
        grid.appendChild(card);
      });

      const start = total === 0 ? 0 : startIndex + 1;
      const end = Math.min(endIndex, total);
      if (pageInfo) {
        pageInfo.textContent = total === 0
          ? "Geen producten gevonden"
          : `Toont ${start}-${end} van ${total} producten - Pagina ${state.page} / ${totalPages}`;
      }

      if (pagePrevButton) {
        pagePrevButton.disabled = state.page <= 1;
      }

      if (pageNextButton) {
        pageNextButton.disabled = state.page >= totalPages;
      }

      if (productCount) {
        productCount.textContent = `${total} items zichtbaar`;
      }
    }

    root.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add-to-cart]");
      const cartButton = event.target.closest("[data-cart-action]");
      const brandButton = event.target.closest("[data-filter-brand]");
      const typeButton = event.target.closest("[data-filter-type]");
      const sortButton = event.target.closest("[data-sort]");
      const adminSaveButton = event.target.closest("[data-admin-save]");

      if (addButton) {
        void syncCartItem({
          productId: addButton.dataset.productId,
          name: addButton.dataset.productName,
          unitPrice: addButton.dataset.productPrice,
          image: addButton.dataset.productImage,
          brand: addButton.dataset.productBrand,
          type: addButton.dataset.productType,
        }, addButton);
        return;
      }

      if (cartButton) {
        const action = cartButton.dataset.cartAction;
        const productId = cartButton.dataset.productId;
        const row = cartButton.closest(".cs-cart__item");

        if (action === "increase") {
          void updateCartItem(productId, 1);
        } else if (action === "decrease") {
          void updateCartItem(productId, -1);
        } else if (action === "remove") {
          if (row) {
            row.classList.add("cs-cart__item--removing");
            setTimeout(() => {
              void updateCartItem(productId, Infinity);
            }, 190);
          } else {
            void updateCartItem(productId, Infinity);
          }
        }
        return;
      }

      if (brandButton) {
        state.brand = brandButton.dataset.filterBrand;
        state.page = 1;
        const brandButtons = Array.from(root.querySelectorAll("[data-filter-brand]"));
        setActiveButton(brandButtons, "filterBrand", state.brand);
        applyFilters();
        return;
      }

      if (typeButton) {
        state.type = typeButton.dataset.filterType;
        state.page = 1;
        const typeButtons = Array.from(root.querySelectorAll("[data-filter-type]"));
        setActiveButton(typeButtons, "filterType", state.type);
        applyFilters();
        return;
      }

      if (sortButton) {
        state.sort = sortButton.dataset.sort;
        state.page = 1;
        setActiveButton(sortButtons, "sort", state.sort);
        applyFilters();
        return;
      }

      if (adminSaveButton) {
        void handleAdminProductSave(adminSaveButton);
      }
    });

    if (search) {
      search.addEventListener("input", () => {
        state.query = search.value;
        state.page = 1;
        applyFilters();
      });
    }

    if (pagePrevButton) {
      pagePrevButton.addEventListener("click", () => {
        if (state.page <= 1) {
          return;
        }
        state.page -= 1;
        applyFilters();
      });
    }

    if (pageNextButton) {
      pageNextButton.addEventListener("click", () => {
        state.page += 1;
        applyFilters();
      });
    }

    if (checkoutButtons.length) {
      checkoutButtons.forEach((button) => {
        button.addEventListener("click", () => {
          void handleCheckout(button);
        });
      });
    }

    document.addEventListener("cloudshirt:logout", async () => {
      setAuthUI();
      await refreshOrders();
      showToast(root, "Uitgelogd.", "info");
      updateCheckoutUI();
    });

    (async function bootstrap() {
      try {
        await checkApiHealth();

        await hydrateAuthFromStorage();

        setAuthUI();

        catalog = await loadCatalog();
        renderFilterButtons();
        renderCatalogItems();

        const brandButtons = Array.from(root.querySelectorAll("[data-filter-brand]"));
        const typeButtons = Array.from(root.querySelectorAll("[data-filter-type]"));
        setActiveButton(brandButtons, "filterBrand", "all");
        setActiveButton(typeButtons, "filterType", "all");

        const remoteItems = await loadRemoteBasket();
        cart.splice(0, cart.length, ...remoteItems);
        renderCart();

        await refreshAdminProducts();
        await refreshOrders();
        applyFilters();
      } catch (error) {
        if (isUnauthorizedError(error)) {
          setFatalError("Je sessie is verlopen of ongeldig. Log opnieuw in.");
          return;
        }
        setFatalError("De API is niet bereikbaar, daarom kan de web storefront niet laden.");
      }
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
