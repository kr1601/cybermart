// ============================================================
// api.js — shared fetch wrapper + auth helpers
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
  const map = { buyer: 'dashboard-buyer.html', seller: 'dashboard-seller.html', admin: 'dashboard-admin.html' };
  window.location.href = map[role] || 'index.html';
}

// ── Auth guard (call at top of protected pages) ──────────────
function requireAuth(allowedRoles) {
  if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
  if (allowedRoles && !allowedRoles.includes(getRole())) {
    window.location.href = 'index.html'; return false;
  }
  return true;
}

// ── API fetch wrappers ────────────────────────────────────────
async function apiPost(endpoint, data) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {})
      },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    return { error: 'Network error. Please try again.' };
  }
}

async function apiGet(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return await res.json();
  } catch (e) {
    return { error: 'Network error. Please try again.' };
  }
}

async function apiDelete(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return await res.json();
  } catch (e) {
    return { error: 'Network error. Please try again.' };
  }
}

async function apiPut(endpoint, data) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {})
      },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    return { error: 'Network error. Please try again.' };
  }
}

// ── Navbar renderer ───────────────────────────────────────────
function renderNavbar(activePage = '') {
  const loggedIn = isLoggedIn();
  const role = getRole();
  const roleMap = { buyer: 'badge-buyer', seller: 'badge-seller', admin: 'badge-admin' };

  const navRight = loggedIn
    ? `<span class="badge ${roleMap[role] || ''}">${(role || '').toUpperCase()}</span>
       <a href="dashboard-${role}.html" class="btn btn-outline btn-sm">Dashboard</a>
       <button class="btn btn-danger btn-sm" onclick="logout()">Logout</button>`
    : `<a href="login.html" class="btn btn-outline btn-sm">Login</a>
       <a href="register.html" class="btn btn-primary btn-sm">Register</a>`;

  document.getElementById('navbar-placeholder').innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="logo">Cyber<span>Mart</span></a>
      <div class="nav-links">
        <a href="index.html"    class="nav-btn ${activePage==='home'?'active':''}">Home</a>
        <a href="products.html" class="nav-btn ${activePage==='products'?'active':''}">Products</a>
        <a href="services.html" class="nav-btn ${activePage==='services'?'active':''}">Services</a>
      </div>
      <div class="nav-right">${navRight}</div>
    </nav>`;
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Mock data (fallback) ──────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: 1, name: 'Portable Network Monitor', price: '$129', icon: '📡', cat: 'network', seller: 'NetDefend', tag: 'New', description: 'A pocket-sized passive tap for traffic capture and protocol analysis.', features: ['Gigabit Ethernet pass-through', 'PCAP export to USB', 'No driver install on monitored hosts', 'Rugged metal enclosure'] },
  { id: 2, name: 'Mini Firewall Appliance', price: '$249', icon: '🔥', cat: 'network', seller: 'SecureNet', tag: 'Best Seller', description: 'Compact edge firewall with application-aware rules, VPN server, and IDS signatures.', features: ['WireGuard & OpenVPN', 'Web filter categories', 'Automatic security patches', 'Under 10 W power draw'] },
  { id: 3, name: 'Cyber Lab Starter Kit', price: '$399', icon: '🧪', cat: 'network', seller: 'LabCyber', tag: 'Bundle', description: 'Everything to build a segmented practice network.', features: ['Pre-configured VLAN profiles', 'Scenario playbook PDF', '90-day update channel', 'Community forum access'] },
  { id: 4, name: 'USB Security Key', price: '$44', icon: '🔑', cat: 'auth', seller: 'SecureKeys', tag: 'Popular', description: 'FIDO2 / WebAuthn hardware key for passwordless login.', features: ['FIDO U2F & FIDO2', 'NFC + USB-C', 'Phishing-resistant', 'Water-resistant casing'] },
  { id: 5, name: 'OTP Token (x5 pack)', price: '$89', icon: '📲', cat: 'auth', seller: 'AuthPro', tag: 'Bundle', description: 'Time-based one-time password tokens for legacy systems.', features: ['TOTP / RFC 6238', '5-year typical battery life', 'Keyed to your org ID', 'Bulk provisioning tool'] },
  { id: 6, name: 'Smart Card Reader', price: '$32', icon: '💳', cat: 'auth', seller: 'CardSec', tag: '', description: 'USB-C smart card reader for PIV, CAC, and chip cards.', features: ['CCID class compliant', 'ISO 7816 contact interface', 'LED activity indicator', 'Works with major OS drivers'] },
  { id: 7, name: 'Encrypted USB Drive 256GB', price: '$64', icon: '💾', cat: 'storage', seller: 'DataVault', tag: 'New', description: 'AES-256 hardware encryption with PIN entry on the device.', features: ['Hardware AES-256', 'PIN unlock before USB mount', 'OS-independent', 'FIPS 140-2 module inside'] },
  { id: 8, name: 'Encrypted External 2TB', price: '$149', icon: '🗄️', cat: 'storage', seller: 'VaultDrive', tag: '', description: 'Desktop-grade encrypted HDD with keypad unlock.', features: ['2 TB 2.5" HDD', 'Separate admin & user PINs', 'Auto-lock on unplug', 'Bus-powered via USB 3'] },
  { id: 9, name: