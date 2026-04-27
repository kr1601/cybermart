// ============================================================
// api.js — CyberMart · API only (catalog from database)
// ============================================================

const DEFAULT_API_BASE = 'https://cybermart-production.up.railway.app/api';

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

  const base = String((shouldPreferLocal ? 'http://localhost:3000/api' : null) || fromEnv || DEFAULT_API_BASE).trim();
  return base.replace(/\/+$/, '');
}

function apiUrl(endpoint) {
  return getApiBase() + endpoint;
}

function getApiRootBase() {
  // If API_BASE is ".../api", return the origin root; otherwise return as-is.
  return getApiBase().replace(/\/api\/?$/i, '');
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
  window.location.href = map[role] || 'index.html';
}

// ── Auth guard ───────────────────────────────────────────────
function requireAuth(allowedRoles) {
  if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
  if (allowedRoles && !allowedRoles.includes(getRole())) {
    window.location.href = 'index.html'; return false;
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

async function apiGetRaw(endpoint, isProtected = false) {
  try {
    const res = await fetch(apiUrl(endpoint), { headers: getHeaders(isProtected) });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      error: res.ok ? null : ((parsed && parsed.error) || `HTTP ${res.status}`)
    };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: 'Network error. ' + (e?.message || '') };
  }
}

async function fetchJsonUrl(url, isProtected = false) {
  try {
    const res = await fetch(url, { headers: getHeaders(isProtected) });
    const raw = await res.text();
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = null; }
    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      error: res.ok ? null : ((parsed && parsed.error) || `HTTP ${res.status}`)
    };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: 'Network error. ' + (e?.message || '') };
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
  // Keep same style as products endpoint, but tolerate hosting differences:
  // - Railway Node route: /services
  // - PHP shared hosting route: /services.php
  let result = await apiGetRaw('/services', false);
  if (!result.ok && result.status === 404) {
    // If API_BASE is configured as origin (without /api), our first call becomes:
    //   https://host/services
    // but backend is mounted at:
    //   https://host/api/services
    // So we also try the fully-qualified /api/services on the same host.
    result = await fetchJsonUrl(getApiRootBase() + '/api/services', false);
  }
  if (!result.ok && result.status === 404) {
    result = await apiGetRaw('/services.php', false);
  }
  // Final fallback: call same-origin PHP API directly (works on InfinityFree).
  if (!result.ok) {
    result = await fetchJsonUrl('/api/services.php', false);
  }
  const data = result.data;

  function extractRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.data && Array.isArray(payload.data.items)) return payload.data.items;
    if (payload.data && Array.isArray(payload.data.rows)) return payload.data.rows;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.services)) return payload.services;
    if (Array.isArray(payload.result)) return payload.result;
    return [];
  }

  const rows = extractRows(data);
  if (!rows.length && !result.ok) return { data: [], error: result.error || 'Invalid services response' };

  const normalized = rows.map((s) => {
    const approvedRaw = s?.is_approved;
    const approved =
      approvedRaw === undefined || approvedRaw === null
        ? true
        : approvedRaw === true || approvedRaw === 1 || approvedRaw === '1' || approvedRaw === 'true';

    return {
      id: s.id,
      name: s.name || 'Service',
      description: s.description || '',
      price: s.price,
      category: s.category || s.tag || '',
      provider_id: s.provider_id,
      provider_name: s.provider_name || s.provider || '',
      image_url: s.image_url || s.imageUrl || '',
      is_approved: approved
    };
  });

  const approved = normalized.filter((s) => s.is_approved);
  return { data: approved, error: null };
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
  if (!isLoggedIn()) {
    if (confirm(`Login required to add "${name}" to cart. Go to login?`))
      window.location.href = 'login.html';
    return;
  }
  // Try real API first
  const data = await apiPost('/cart', { product_id: id, quantity: 1 }, true);
  if (data.error) {
    alert('⚠ ' + data.error);
  } else {
    alert(`✅ "${name}" added to cart!`);
  }
}

function bookService(id, name) {
  if (!isLoggedIn()) {
    if (confirm(`Login required to book "${name}". Go to login?`))
      window.location.href = 'login.html';
    return;
  }
  window.location.href = `bookings.html?service=${id}`;
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
          <button type="button" class="btn btn-primary btn-sm"
            onclick="addToCart(${p.id},${JSON.stringify(p.name)})">Add to Cart</button>
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
        <span class="tag tag-blue" style="margin-bottom:0.5rem;display:inline-block">${s.tag}</span>
        <div class="card-title">${s.name}</div>
        <div class="card-meta">by ${s.provider || s.provider_name || 'Unknown'}</div>
        <div class="card-price">${s.price}</div>
        <div class="card-actions">
          <button class="btn btn-blue btn-sm" onclick="bookService(${s.id},'${s.name}')">Book Now</button>
          <button class="btn btn-outline btn-sm">Info</button>
        </div>
      </div>
    </div>`).join('');
}

initNavAuthState();

