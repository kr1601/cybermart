// ============================================================
// api.js — FINAL UPDATED VERSION
// ============================================================

const API_BASE = 'https://cybermart-production.up.railway.app/api';

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
    buyer: 'dashboard-buyer.html',
    seller: 'dashboard-seller.html',
    admin: 'dashboard-admin.html'
  };
  window.location.href = map[role] || 'index.html';
}

// ── Auth guard ───────────────────────────────────────────────
function requireAuth(allowedRoles) {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(getRole())) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── API helpers ──────────────────────────────────────────────

// 🔥 FIX: Only attach token if needed
function getHeaders(isProtected = false) {
  const headers = { 'Content-Type': 'application/json' };

  if (isProtected && getToken()) {
    headers['Authorization'] = 'Bearer ' + getToken();
  }

  return headers;
}

// ✅ GET (public or protected)
async function apiGet(endpoint, isProtected = false) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      headers: getHeaders(isProtected)
    });

    const data = await res.json();

    if (!res.ok) throw data;

    return data;

  } catch (e) {
    console.error("GET ERROR:", e);
    return { error: e.error || 'Request failed' };
  }
}

// ✅ POST
async function apiPost(endpoint, data, isProtected = false) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: getHeaders(isProtected),
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!res.ok) throw result;

    return result;

  } catch (e) {
    console.error("POST ERROR:", e);
    return { error: e.error || 'Request failed' };
  }
}

// ✅ PUT
async function apiPut(endpoint, data, isProtected = true) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!res.ok) throw result;

    return result;

  } catch (e) {
    console.error("PUT ERROR:", e);
    return { error: e.error || 'Request failed' };
  }
}

// ✅ DELETE
async function apiDelete(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'DELETE',
      headers: getHeaders(true)
    });

    const result = await res.json();

    if (!res.ok) throw result;

    return result;

  } catch (e) {
    console.error("DELETE ERROR:", e);
    return { error: e.error || 'Request failed' };
  }
}

// ── 🔥 READY-TO-USE API CALLS ───────────────────────────────

// ✅ Get products (PUBLIC — no token needed)
async function getProducts() {
  return await apiGet('/products', false);
}

// ✅ Login
async function login(data) {
  return await apiPost('/auth/login', data);
}

// ✅ Register
async function register(data) {
  return await apiPost('/auth/register', data);
}

// ── Navbar ──────────────────────────────────────────────────
function renderNavbar(activePage = '') {
  const loggedIn = isLoggedIn();
  const role = getRole();

  const navRight = loggedIn
    ? `<span>${role.toUpperCase()}</span>
       <a href="dashboard-${role}.html">Dashboard</a>
       <button onclick="logout()">Logout</button>`
    : `<a href="login.html">Login</a>
       <a href="register.html">Register</a>`;

  document.getElementById('navbar-placeholder').innerHTML = `
    <nav>
      <a href="index.html">CyberMart</a>
      <a href="products.html">Products</a>
      ${navRight}
    </nav>`;
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
} 