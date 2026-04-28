// ============================================================
// api.js — CyberMart · API only (catalog from database)
// ============================================================

const DEFAULT_API_BASE = 'https://cybermart-production.up.railway.app/api';
const CYBERMART_WEB_BUILD = '2026-04-27c';

/**
 * If API_BASE is only an origin (e.g. https://app.up.railway.app), append /api.
 * Otherwise requests become …/payments/… instead of …/api/payments/… → HTTP 404 on Express.
 */
function normalizeApiRoot(base) {
  const b = String(base).trim().replace(/\/+$/, '');
  if (!b) return b;
  try {
    const u = new URL(b);
    const pathOnly = (u.pathname || '/').replace(/\/+$/, '') || '/';
    if (pathOnly === '/') {
      return u.origin + '/api';
    }
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch (_) {
    return b;
  }
}

function getApiBase() {
  const env = (typeof window !== 'undefined' && window.__CYBERMART_ENV__) || {};
  const fromEnv = env.API_BASE || (typeof window !== 'undefined' && window.CYBERMART_API_BASE);
  // Local dev convenience:
  // - If opening HTML via file:// or running on localhost, prefer the local API (unless explicitly overridden).
  const shouldPreferLocal =
    typeof window !== 'undefined' &&
    !fromEnv &&
    (window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  let base = String((shouldPreferLocal ? 'http://localhost:3000/api' : null) || fromEnv || DEFAULT_API_BASE).trim();
  base = base.replace(/\/+$/, '');
  return normalizeApiRoot(base);
}

if (typeof window !== 'undefined') {
  window.__CYBERMART_WEB_BUILD__ = CYBERMART_WEB_BUILD;
  console.info('[CyberMart] api.js build', CYBERMART_WEB_BUILD);
}

function apiUrl(endpoint) {
  const base = String(getApiBase()).replace(/\/+$/, '');
  let ep = String(endpoint || '');
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

/** Resolve a site page URL with query params (works when the site lives under a subpath, e.g. GitHub Pages /repo/). */
function pageHref(filename, queryParams) {
  if (typeof window === 'undefined') return filename;
  const u = new URL(filename, window.location.href);
  if (queryParams && typeof queryParams === 'object') {
    Object.keys(queryParams).forEach((k) => {
      if (queryParams[k] != null && queryParams[k] !== '') {
        u.searchParams.set(k, String(queryParams[k]));
      }
    });
  }
  return u.href;
}

// ── Storage helpers ──────────────────────────────────────────
function getToken()   { return localStorage.getItem('cm_token'); }
function getRole()    { return localStorage.getItem('cm_role'); }
function getName()    { return localStorage.getItem('cm_name'); }

function setSession(token, role, name) {
  localStorage.setItem('cm_token', token);
  localStorage.setItem('cm_role', role);
  localStorage.setItem('cm_name', name);
}
function clearSession() {
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_role');
  localStorage.removeItem('cm_name');
}
function isLoggedIn() { return !!getToken(); }

// ── Redirect by role ─────────────────────────────────────────
function redirectByRole(role) {
  const map = {
    buyer:  'dashboard-buyer.html',
    seller: 'dashboard-seller.html',
    admin:  'dashboard-admin.html'
  };
  window.location.href = new URL(map[role] || 'index.html', window.location.href).href;
}

/** Login URL that resolves correctly on GitHub Pages (/repo/) and InfinityFree. */
function goToLoginWithReturn() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const u = new URL('login.html', window.location.href);
  u.searchParams.set('next', page);
  window.location.assign(u.href);
}

// ── Auth guard ───────────────────────────────────────────────
function requireAuth(allowedRoles) {
  if (!isLoggedIn()) {
    goToLoginWithReturn();
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(getRole())) {
    window.location.href = new URL('index.html', window.location.href).href;
    return false;
  }
  return true;
}

// ── Headers helper ───────────────────────────────────────────
function getHeaders(isProtected = false) {
  const h = { 'Content-Type': 'application/json' };
  if (isProtected && getToken()) h['Authorization'] = 'Bearer ' + getToken();
  return h;
}

// ── Core fetch wrappers ──────────────────────────────────────
async function apiGet(endpoint, isProtected = false) {
  try {
    const res = await fetch(apiUrl(endpoint), { headers: getHeaders(isProtected) });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    if (!res.ok) return { error: (parsed && parsed.error) || `HTTP ${res.status}` };
    if (!parsed)  return { error: 'Invalid JSON from server' };
    return parsed;
  } catch (e) {
    return { error: 'Network error. ' + (e?.message || '') };
  }
}

async function apiPost(endpoint, data, isProtected = false) {
  try {
    const res = await fetch(apiUrl(endpoint), {
      method:  'POST',
      headers: getHeaders(isProtected),
      body:    JSON.stringify(data)
    });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    if (!res.ok) return { error: (parsed && parsed.error) || `HTTP ${res.status}` };
    if (!parsed)  return { error: 'Invalid JSON from server' };
    return parsed;
  } catch (e) {
    return { error: 'Network error. ' + (e?.message || '') };
  }
}

async function apiPut(endpoint, data) {
  try {
    const res = await fetch(apiUrl(endpoint), {
      method:  'PUT',
      headers: getHeaders(true),
      body:    JSON.stringify(data)
    });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    if (!res.ok) return { error: (parsed && parsed.error) || `HTTP ${res.status}` };
    return parsed || {};
  } catch (e) {
    return { error: 'Network error. ' + (e?.message || '') };
  }
}

async function apiDelete(endpoint) {
  try {
    const res = await fetch(apiUrl(endpoint), {
      method:  'DELETE',
      headers: getHeaders(true)
    });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    if (!res.ok) return { error: (parsed && parsed.error) || `HTTP ${res.status}` };
    return parsed || {};
  } catch (e) {
    return { error: 'Network error. ' + (e?.message || '') };
  }
}

async function apiPatch(endpoint, data = {}) {
  try {
    const res = await fetch(apiUrl(endpoint), {
      method:  'PATCH',
      headers: getHeaders(true),
      body:    JSON.stringify(data)
    });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    if (!res.ok) return { error: (parsed && parsed.error) || `HTTP ${res.status}` };
    return parsed || {};
  } catch (e) {
    return { error: 'Network error. ' + (e?.message || '') };
  }
}

// ── Products — database only (no mock) ───────────────────────
/** @returns {{ data: object[], error: string|null }} */
async function getProducts() {
  const data = await apiGet('/products', false);
  if (data && data.error) return { data: [], error: data.error };
  if (!Array.isArray(data)) return { data: [], error: 'Invalid response from server' };
  return { data, error: null };
}

/** @returns {{ data: object[], error: string|null }} */
async function getServices() {
  const data = await apiGet('/services', false);
  if (data && data.error) return { data: [], error: data.error };
  if (!Array.isArray(data)) return { data: [], error: 'Invalid response from server' };
  const normalized = data.map((s) => ({
    id: s.id,
    name: s.name || 'Service',
    description: s.description || '',
    price: s.price,
    category: s.category || s.tag || '',
    tag: s.tag || s.category || '',
    provider_id: s.provider_id,
    provider_name: s.provider_name || s.provider || '',
    image_url: s.image_url || s.imageUrl || '',
    icon: s.icon || '🛡️'
  }));
  return { data: normalized, error: null };
}

// ── Auth shortcuts ───────────────────────────────────────────
async function login(data)    { return await apiPost('/auth/login',    data); }
async function register(data) { return await apiPost('/auth/register', data); }

// ── Logout ───────────────────────────────────────────────────
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Navbar ───────────────────────────────────────────────────
function escapeNavHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Dashboard href for current role (localStorage may be tampered — validate). */
function dashboardHrefForRole(role) {
  const map = {
    buyer:  'dashboard-buyer.html',
    seller: 'dashboard-seller.html',
    admin:  'dashboard-admin.html'
  };
  return map[role] || 'index.html';
}

/** Right side of navbar when signed in: role badge, name → dashboard, Logout. */
function htmlNavRightLoggedIn() {
  const role    = getRole();
  const roleMap = { buyer: 'badge-buyer', seller: 'badge-seller', admin: 'badge-admin' };
  const dash    = dashboardHrefForRole(role);
  const name    = escapeNavHtml(getName() || 'Account');
  const roleLbl = escapeNavHtml(String(role || '').toUpperCase());
  return (
    '<span class="badge ' + (roleMap[role] || '') + '">' + roleLbl + '</span>' +
    '<a href="' + dash + '" class="nav-btn nav-user-name-link" title="Open your dashboard">' + name + '</a>' +
    '<button type="button" class="btn btn-danger btn-sm" onclick="logout()">Logout</button>'
  );
}

function htmlNavRightGuest() {
  return (
    '<a href="login.html" class="nav-btn">Login</a>' +
    '<a href="register.html" class="btn btn-primary btn-sm">Register</a>'
  );
}

/** Update static pages that already contain <nav class="navbar">…</nav>. */
function applyNavAuthState() {
  const navRight = document.querySelector('nav.navbar .nav-right');
  if (!navRight || !isLoggedIn()) return;
  navRight.innerHTML = htmlNavRightLoggedIn();
}

function initNavAuthState() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyNavAuthState);
  } else {
    applyNavAuthState();
  }
}

function renderNavbar(activePage = '') {
  const navRight = isLoggedIn() ? htmlNavRightLoggedIn() : htmlNavRightGuest();

  document.getElementById('navbar-placeholder').innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="logo">Cyber<span>Mart</span></a>
      <div class="nav-links">
        <a href="index.html"    class="nav-btn ${activePage==='home'    ? 'active' : ''}">Home</a>
        <a href="products.html" class="nav-btn ${activePage==='products'? 'active' : ''}">Products</a>
        <a href="services.html" class="nav-btn ${activePage==='services'? 'active' : ''}">Services</a>
      </div>
      <div class="nav-right">${navRight}</div>
    </nav>`;
}

// ── Add to cart (API) ─────────────────────────────────────────
async function addToCart(id, name) {
  try {
    if (!isLoggedIn()) {
      if (
        !confirm(
          'You need to sign in (as a buyer) to add items to your cart.\n\nGo to the login page now?'
        )
      ) {
        return;
      }
      goToLoginWithReturn();
      return;
    }
    if (getRole() !== 'buyer') {
      alert(
        'Only buyer accounts can use the cart. You are signed in as ' +
          String(getRole() || 'unknown') +
          '. Register or log in as a buyer.'
      );
      return;
    }
    const data = await apiPost('/cart', { product_id: id, quantity: 1 }, true);
    if (data.error) {
      alert('⚠ ' + data.error);
    } else {
      alert(`✅ "${name}" added to cart!`);
    }
  } catch (e) {
    alert(
      'Could not update cart: ' +
        (e && e.message ? e.message : String(e)) +
        '. Check the browser console (F12) and that API_BASE in js/env-config.js points to your HTTPS Railway API.'
    );
  }
}

function bookService(id, name) {
  if (!isLoggedIn()) {
    if (
      !confirm(
        'You need to sign in (as a buyer) to book a service.\n\nGo to the login page now?'
      )
    ) {
      return;
    }
    goToLoginWithReturn();
    return;
  }
  const b = new URL('bookings.html', window.location.href);
  b.searchParams.set('service', String(id));
  window.location.href = b.href;
}

// ── Utilities ─────────────────────────────────────────────────
function parsePriceValue(price) {
  const n = Number(String(price || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ── Render helpers ────────────────────────────────────────────
function renderProductCards(list, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;grid-column:1/-1">No products found.</p>';
    return;
  }
  el.innerHTML = list.map(p => {
    const tag       = p.tag       || '';
    const icon      = p.icon      || '🔒';
    const imageUrl  = p.image_url || p.imageUrl || '';
    const seller    = p.seller    || p.seller_name || 'Unknown';
    const priceDisp = typeof p.price === 'number'
      ? '$' + p.price.toFixed(2)
      : p.price;
    const mediaHtml = imageUrl
      ? `<img src="${String(imageUrl).replace(/"/g, '&quot;')}" alt="${String(p.name || 'Product').replace(/"/g, '&quot;')}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.replaceWith(document.createTextNode('${String(icon).replace(/'/g, '&#39;')}'))" />`
      : String(icon);
    return `
    <div class="card">
      <div class="card-img">${mediaHtml}</div>
      <div class="card-body">
        ${tag ? `<span class="tag tag-green" style="margin-bottom:0.5rem;display:inline-block">${tag}</span>` : ''}
        <div class="card-title">${p.name}</div>
        <div class="card-meta">by ${seller}</div>
        <div class="card-price">${priceDisp}</div>
        <div class="card-actions">
          <button type="button" class="btn btn-primary btn-sm cm-cart-btn"
            data-cart="${encodeURIComponent(JSON.stringify({ id: p.id, name: String(p.name || '') }))}">Add to Cart</button>
          <a href="product-detail.html?id=${p.id}" class="btn btn-outline btn-sm"
            >Details</a>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderServiceCards(list, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;grid-column:1/-1">No services listed yet.</p>';
    return;
  }
  el.innerHTML = list.map(s => `
    <div class="card">
      <div class="card-img">${
        (s.image_url || s.imageUrl)
          ? `<img src="${String(s.image_url || s.imageUrl).replace(/"/g, '&quot;')}" alt="${String(s.name || 'Service').replace(/"/g, '&quot;')}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.replaceWith(document.createTextNode('${String(s.icon || '🛡️').replace(/'/g, '&#39;')}'))" />`
          : (s.icon || '🛡️')
      }</div>
      <div class="card-body">
        <span class="tag tag-blue" style="margin-bottom:0.5rem;display:inline-block">${escapeNavHtml(s.category || s.tag || 'Service')}</span>
        <div class="card-title">${s.name}</div>
        <div class="card-meta">by ${escapeNavHtml(s.provider_name || s.provider || 'Unknown')}</div>
        <div class="card-price">${s.price}</div>
        <div class="card-actions">
          <button type="button" class="btn btn-blue btn-sm cm-book-btn" data-service-id="${String(s.id).replace(/"/g, '&quot;')}">Book Now</button>
          <a href="${pageHref('service-detail.html', { id: s.id })}" class="btn btn-outline btn-sm">Info</a>
        </div>
      </div>
    </div>`).join('');
}

initNavAuthState();

/* Delegate cart/book buttons — avoids broken onclick HTML when product names contain quotes/SVG-breakers */
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__cmCartBookDelegateInstalled) {
  window.__cmCartBookDelegateInstalled = true;
  document.addEventListener('click', function (e) {
    var cart = e.target && e.target.closest ? e.target.closest('.cm-cart-btn') : null;
    if (cart) {
      e.preventDefault();
      try {
        var raw = cart.getAttribute('data-cart');
        if (!raw) return;
        var payload = JSON.parse(decodeURIComponent(raw));
        if (payload != null && payload.id != null) {
          addToCart(payload.id, String(payload.name != null ? payload.name : ''));
        }
      } catch (err) {
        console.error('[CyberMart] Add to cart', err);
      }
      return;
    }
    var book = e.target && e.target.closest ? e.target.closest('.cm-book-btn') : null;
    if (book) {
      e.preventDefault();
      var sid = book.getAttribute('data-service-id');
      if (sid == null || sid === '') return;
      bookService(Number(sid), '');
    }
  });
}

/* Inline handlers removed in favor of delegation; globals kept for callers that still onclick= */
if (typeof window !== 'undefined') {
  window.addToCart = addToCart;
  window.bookService = bookService;
  window.pageHref = pageHref;
  window.__cybermartGetApiBase = getApiBase;
}

