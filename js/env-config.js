/**
 * Load before `api.js` and `cybermart-assistant.js`.
 * Set API_BASE to your Railway API root (must end with /api).
 * AI chat URL is derived as API_BASE + '/ai/chat' unless you set AI_PROXY_URL explicitly.
 * AI key lives only on Railway (Variables for the Node service). Test in browser:
 *   GET {API_BASE}/ai/chat  →  "keyConfigured": true/false
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__CYBERMART_ENV__ = window.__CYBERMART_ENV__ || {};
  window.__CYBERMART_ENV__.API_BASE = 'https://cybermart-production.up.railway.app/api';
  window.__CYBERMART_ENV__.OPENROUTER_MODEL = 'openrouter/free';
})();
