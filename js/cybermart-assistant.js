// ============================================================
// cybermart-assistant.js — CyberMart AI Assistant (OpenRouter)
// Note: filename must not contain "chat" — InfinityFree blocks such URLs (403).
// ============================================================
// API key: set OPENROUTER_API_KEY in .env, then run: npm run env
// Or set window.__CYBERMART_ENV__.OPENROUTER_API_KEY in js/env-config.js
// Optional: OPENROUTER_MODEL (default: openrouter/free)
// ============================================================

(function () {
  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const DEFAULT_MODEL = 'openrouter/free';

  function getOpenRouterApiKey() {
    if (typeof window === 'undefined') return '';
    const env = window.__CYBERMART_ENV__ || {};
    const fromEnv = env.OPENROUTER_API_KEY;
    if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
    if (window.CYBERMART_OPENROUTER_API_KEY) return String(window.CYBERMART_OPENROUTER_API_KEY).trim();
    return '';
  }

  function getOpenRouterModel() {
    if (typeof window === 'undefined') return DEFAULT_MODEL;
    const env = window.__CYBERMART_ENV__ || {};
    const m = env.OPENROUTER_MODEL;
    if (m && String(m).trim()) return String(m).trim();
    if (window.CYBERMART_OPENROUTER_MODEL) return String(window.CYBERMART_OPENROUTER_MODEL).trim();
    return DEFAULT_MODEL;
  }

  function getAiProxyUrl() {
    if (typeof window === 'undefined') return '';
    const env = window.__CYBERMART_ENV__ || {};
    var explicit = env.AI_PROXY_URL || window.CYBERMART_AI_PROXY_URL;
    if (explicit && String(explicit).trim()) {
      return String(explicit).trim().replace(/\/+$/, '');
    }
    // Same origin as REST API: …/api + /ai/chat → …/api/ai/chat (avoids typos vs /api/chat).
    var apiBase = env.API_BASE;
    if (apiBase && String(apiBase).trim()) {
      return String(apiBase).trim().replace(/\/+$/, '') + '/ai/chat';
    }
    return '';
  }

  const SYSTEM_PROMPT = `You are CyberMart's AI assistant for a cybersecurity marketplace (English only).
Always reply in clear, professional English, even if the user writes in another language.

You help with:
- Orders: status, tracking, delivery expectations, order history (buyer dashboard).
- Cancellations: how to request or cancel an order, refund timelines, policies — give general guidance only; you cannot cancel orders yourself.
- Payments & money: checkout, secure payments, pricing questions — direct users to cart/checkout and official payment flows; never ask for full card numbers or passwords.
- Login & account: sign-in, registration, MFA, password reset, role dashboards (buyer / seller / admin), session and security tips.
- Products: catalog, categories (Network Testing, Auth Devices, Storage), browsing products.html.

Rules:
- Be concise, friendly, and security-aware. Never fabricate private order data; say users should check dashboard-buyer.html or their account for live details.
- If asked to perform account actions, explain the steps and link to the relevant page (e.g. login.html, cart.html, dashboard-buyer.html).
- Do not claim you executed cancellations or refunds; only explain how CyberMart typically handles them.`;

  const MAX_HISTORY = 10;
  const STORAGE_KEY = 'cm_ai_chat_v2';
  const SIZE_STORAGE_KEY = 'cm_ai_chat_size';
  const PANEL_DEFAULT_W = 360;
  const PANEL_DEFAULT_H = 440;
  const PANEL_MIN_W = 260;
  const PANEL_MIN_H = 280;

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_HISTORY) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(h) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-MAX_HISTORY)));
    } catch {}
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatReply(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function demoReply(text) {
    const q = (text || '').toLowerCase();
    if (/hello|hi\b|hey\b|greetings/.test(q))
      return "Hi! I'm the CyberMart assistant. I can help with orders, payments, login, MFA, and finding security products.";
    if (/order|track|shipping|delivery/.test(q))
      return 'For order status and history, sign in as a Buyer and open dashboard-buyer.html. I cannot see your private orders—use your account for live details.';
    if (/cancel|refund|return/.test(q))
      return 'Cancellation and refund rules depend on order state and seller policy. Open your buyer dashboard to request a cancellation or contact support from there. I cannot cancel an order for you from chat.';
    if (/pay|payment|money|price|checkout|cart/.test(q))
      return 'Add items in cart.html, then proceed to checkout. Payments are processed securely; never share full card numbers or passwords in chat.';
    if (/login|sign in|password|sign up|register|mfa|2fa/.test(q))
      return 'Use login.html to sign in. Demo shortcuts for Buyer, Seller, and Admin are on that page. MFA is available for stronger account protection.';
    if (/seller|vendor|listing/.test(q))
      return 'Sellers manage listings from dashboard-seller.html. New products may require admin approval before they appear in the catalog.';
    if (/product|browse|buy|shop|catalog/.test(q))
      return 'Browse the catalog at products.html. Categories include Network Testing, Auth Devices, and Storage.';
    if (/openrouter|ai|key|api/.test(q))
      return 'Recommended: set AI_PROXY_URL to your Railway /api/ai/chat endpoint and keep API_AI_KEY only on server. For local fallback you can set OPENROUTER_API_KEY in .env and run npm run env.';
    return 'Ask about orders, checkout, login, or products.';
  }

  async function callOpenRouter(userText, priorHistory) {
    const proxyUrl = getAiProxyUrl();
    if (proxyUrl) {
      try {
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText, history: priorHistory })
        });
        const proxyData = await proxyRes.json().catch(function () {
          return {};
        });
        if (proxyRes.ok && proxyData && typeof proxyData.reply === 'string' && proxyData.reply.trim()) {
          return proxyData.reply.trim();
        }
        if (proxyRes.ok && proxyData && proxyData.error) {
          return (
            'AI server error: ' +
            String(proxyData.error) +
            ' — Check Railway variables OPEN_ROUTER_API_KEY (or OPENROUTER_API_KEY) for /api/ai/chat.'
          );
        }
        if (!proxyRes.ok) {
          const proxyMsg = (proxyData && proxyData.error) || ('HTTP ' + proxyRes.status);
          return 'AI proxy error: ' + proxyMsg;
        }
        return (
          'AI proxy returned no reply. Ensure Railway has a valid Open Router key and redeploy the API.'
        );
      } catch (e) {
        console.error('[CyberMart AI] Proxy fetch error:', e);
        return (
          'Cannot reach the AI API at ' +
          proxyUrl +
          '. If the site is on another domain, CORS must allow it (server uses open CORS when ALLOWED_ORIGINS is unset). Error: ' +
          (e && e.message ? e.message : String(e))
        );
      }
    }

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      return demoReply(userText);
    }

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    priorHistory.forEach(function (m) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    });
    messages.push({ role: 'user', content: userText });

    const referer =
      typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : 'https://cybermart.local';

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
          'HTTP-Referer': referer,
          'X-Title': 'CyberMart Assistant'
        },
        body: JSON.stringify({
          model: getOpenRouterModel(),
          messages: messages,
          max_tokens: 512,
          temperature: 0.7
        })
      });

      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok) {
        const errMsg =
          (data.error && (data.error.message || data.error.metadata)) ||
          (typeof data.message === 'string' && data.message) ||
          'HTTP ' + res.status;
        console.error('[CyberMart AI] OpenRouter error:', data);
        return 'OpenRouter error: ' + errMsg;
      }

      const choice = data.choices && data.choices[0];
      const msg = choice && choice.message;
      const reply = msg && msg.content != null ? String(msg.content).trim() : '';
      return reply || demoReply(userText);
    } catch (e) {
      console.error('[CyberMart AI] Fetch error:', e);
      return demoReply(userText);
    }
  }

  function buildWidget() {
    const style = document.createElement('style');
    style.textContent = [
      '.ai-chat-root{position:fixed;bottom:1.5rem;right:1.5rem;z-index:2147483000;font-family:inherit}',
      '.ai-chat-backdrop{display:none;position:fixed;inset:0;z-index:0;background:rgba(0,0,0,.35);cursor:pointer}',
      '.ai-chat-open .ai-chat-backdrop{display:block}',
      '.ai-chat-surface{position:relative;z-index:2;pointer-events:auto}',
      '.ai-chat-fab{position:relative;z-index:3;width:58px;height:58px;border-radius:14px;background:linear-gradient(135deg,#00ff88,#00c9ff);border:2px solid rgba(255,255,255,.35);cursor:pointer;box-shadow:0 6px 28px rgba(0,255,136,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;font-size:.75rem;font-weight:800;color:#04120a;letter-spacing:.02em;transition:transform .2s,box-shadow .2s;line-height:1}',
      '.ai-chat-fab:hover{transform:scale(1.06);box-shadow:0 8px 36px rgba(0,255,136,.55)}',
      '.ai-chat-open .ai-chat-fab{transform:scale(.96)}',
      '.ai-chat-fab-emoji{font-size:1.15rem;line-height:1}',
      '.ai-chat-fab-label{font-size:.62rem;font-weight:800;text-transform:uppercase;opacity:.9}',
      '.ai-chat-panel{position:absolute;bottom:calc(100% + 12px);right:0;width:360px;height:440px;min-width:260px;min-height:280px;max-width:calc(100vw - 1rem);max-height:min(90vh,calc(100vh - 70px));box-sizing:border-box;background:#0d1117;border:1px solid #30363d;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;resize:both;opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;transition:opacity .22s ease,transform .22s ease;z-index:4}',
      '.ai-chat-panel.ai-chat-resizing{transition:none}',
      '.ai-chat-panel::-webkit-resizer{background:transparent}',
      '.ai-chat-resize-right{position:absolute;top:52px;right:0;width:10px;height:calc(100% - 74px);cursor:ew-resize;z-index:6;touch-action:none}',
      '.ai-chat-resize-top{position:absolute;top:0;left:14px;width:calc(100% - 28px);height:10px;cursor:ns-resize;z-index:6;touch-action:none}',
      '.ai-chat-resize{position:absolute;right:0;bottom:0;width:22px;height:22px;cursor:nwse-resize;z-index:6;border-radius:0 0 14px 0;background:linear-gradient(135deg,transparent 50%,rgba(48,54,61,.85) 50%);touch-action:none}',
      '.ai-chat-resize:hover{background:linear-gradient(135deg,transparent 45%,rgba(0,255,136,.35) 45%,rgba(0,255,136,.35) 55%,rgba(48,54,61,.6) 55%)}',
      '.ai-chat-resize::after{content:"";position:absolute;right:5px;bottom:5px;width:10px;height:10px;border-right:2px solid #8b949e;border-bottom:2px solid #8b949e;opacity:.9;pointer-events:none}',
      '.ai-chat-open .ai-chat-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:all}',
      '.ai-chat-head{display:flex;align-items:center;gap:.75rem;padding:.9rem 1rem;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0}',
      '.ai-chat-head-icon{width:36px;height:36px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,#00ff88,#00c9ff);display:flex;align-items:center;justify-content:center;font-size:1rem}',
      '.ai-chat-head-text{flex:1;min-width:0}',
      '.ai-chat-title{display:block;font-size:.9rem;font-weight:700;color:#e6edf3}',
      '.ai-chat-sub{display:block;font-size:.72rem;color:#8b949e}',
      '.ai-chat-status{display:flex;align-items:center;gap:4px;font-size:.68rem;color:#00ff88;font-weight:600}',
      '.ai-chat-status-dot{width:6px;height:6px;border-radius:50%;background:#00ff88;animation:ai-pulse 2s infinite}',
      '@keyframes ai-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
      '.ai-chat-close{background:none;border:none;cursor:pointer;color:#8b949e;font-size:1rem;padding:4px 6px;border-radius:6px;transition:background .15s,color .15s}',
      '.ai-chat-close:hover{background:#21262d;color:#e6edf3}',
      '.ai-chat-msgs{flex:1;min-height:0;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;scrollbar-width:thin;scrollbar-color:#30363d transparent}',
      '.ai-chat-msgs::-webkit-scrollbar{width:4px}',
      '.ai-chat-msgs::-webkit-scrollbar-thumb{background:#30363d;border-radius:2px}',
      '.ai-chat-row{display:flex;gap:.5rem;align-items:flex-start}',
      '.ai-chat-row-user{flex-direction:row-reverse}',
      '.ai-chat-avatar{width:28px;height:28px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700}',
      '.ai-chat-row-user .ai-chat-avatar{background:#1f6feb;color:#fff}',
      '.ai-chat-row-assistant .ai-chat-avatar{background:linear-gradient(135deg,#00ff88,#00c9ff);color:#000}',
      '.ai-chat-bubble{max-width:78%;padding:.55rem .8rem;border-radius:12px;font-size:.83rem;line-height:1.5;color:#e6edf3}',
      '.ai-chat-row-user .ai-chat-bubble{background:#1f6feb;border-radius:12px 4px 12px 12px}',
      '.ai-chat-row-assistant .ai-chat-bubble{background:#21262d;border-radius:4px 12px 12px 12px}',
      '.ai-chat-bubble code{background:#0d1117;padding:1px 4px;border-radius:4px;font-size:.8em}',
      '.ai-chat-bubble a{color:#00ff88}',
      '.ai-chat-typing .ai-chat-bubble{display:flex;gap:4px;align-items:center;padding:.7rem .8rem}',
      '.ai-dot{width:6px;height:6px;border-radius:50%;background:#8b949e;animation:ai-bounce 1.2s infinite}',
      '.ai-dot:nth-child(2){animation-delay:.2s}',
      '.ai-dot:nth-child(3){animation-delay:.4s}',
      '@keyframes ai-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}',
      '.ai-chat-foot{display:flex;gap:.5rem;padding:.75rem 2rem .75rem .9rem;border-top:1px solid #30363d;background:#161b22;flex-shrink:0;position:relative}',
      '.ai-chat-input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:.5rem .75rem;color:#e6edf3;font-size:.83rem;outline:none;transition:border-color .2s;font-family:inherit}',
      '.ai-chat-input:focus{border-color:#00ff88}',
      '.ai-chat-input::placeholder{color:#484f58}',
      '.ai-chat-send{background:linear-gradient(135deg,#00ff88,#00c9ff)!important;color:#000!important;border:none;border-radius:8px;padding:.5rem .85rem;font-weight:700;cursor:pointer;font-size:.8rem;transition:opacity .15s,transform .1s;white-space:nowrap}',
      '.ai-chat-send:hover{opacity:.9}',
      '.ai-chat-send:active{transform:scale(.95)}',
      '.ai-chat-send:disabled{opacity:.45;cursor:not-allowed}',
      '.ai-key-badge{font-size:.65rem;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:.4rem}',
      '.ai-key-set{background:rgba(0,255,136,.15);color:#00ff88}',
      '.ai-key-notset{background:rgba(255,200,0,.15);color:#f0b429}'
    ].join('');
    document.head.appendChild(style);

    const keySet = !!getOpenRouterApiKey();
    const keyBadge = keySet
      ? '<span class="ai-key-badge ai-key-set">Live AI</span>'
      : '<span class="ai-key-badge ai-key-notset">Demo mode</span>';

    const root = document.createElement('div');
    root.className = 'ai-chat-root';
    root.innerHTML =
      '<div class="ai-chat-backdrop" id="ai-chat-backdrop" aria-hidden="true"></div>' +
      '<div class="ai-chat-surface">' +
      '<button type="button" class="ai-chat-fab" id="ai-chat-fab" aria-expanded="false" aria-controls="ai-chat-panel" title="CyberMart AI Assistant">' +
      '<span class="ai-chat-fab-emoji" aria-hidden="true">✨</span>' +
      '<span class="ai-chat-fab-label">AI</span>' +
      '</button>' +
      '<div class="ai-chat-panel" id="ai-chat-panel" role="dialog" aria-modal="true" aria-label="CyberMart AI" aria-hidden="true">' +
      '<div class="ai-chat-head">' +
      '<div class="ai-chat-head-icon">🤖</div>' +
      '<div class="ai-chat-head-text">' +
      '<span class="ai-chat-title">CyberMart AI ' +
      keyBadge +
      '</span>' +
      '<span class="ai-chat-sub">Orders · Login · Payments · Catalog</span>' +
      '</div>' +
      '<div class="ai-chat-status"><div class="ai-chat-status-dot"></div> Online</div>' +
      '<button type="button" class="ai-chat-close" id="ai-chat-close" aria-label="Close chat">✕</button>' +
      '</div>' +
      '<div class="ai-chat-msgs" id="ai-chat-msgs"></div>' +
      '<div class="ai-chat-foot">' +
      '<input type="text" class="ai-chat-input" id="ai-chat-input" placeholder="Ask about orders, login, checkout…" autocomplete="off" maxlength="2000"/>' +
      '<button type="button" class="ai-chat-send" id="ai-chat-send">Send</button>' +
      '</div>' +
      '<div class="ai-chat-resize-right" id="ai-chat-resize-right" aria-hidden="true"></div>' +
      '<div class="ai-chat-resize-top" id="ai-chat-resize-top" aria-hidden="true"></div>' +
      '<div class="ai-chat-resize" id="ai-chat-resize" role="separator" aria-orientation="both" aria-label="Drag to resize chat" title="Drag to resize"></div>' +
      '</div>' +
      '</div>';

    document.body.appendChild(root);

    const backdrop = document.getElementById('ai-chat-backdrop');
    const fab = document.getElementById('ai-chat-fab');
    const panel = document.getElementById('ai-chat-panel');
    const closeBtn = document.getElementById('ai-chat-close');
    const msgs = document.getElementById('ai-chat-msgs');
    const input = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send');
    const resizeEl = document.getElementById('ai-chat-resize');
    const resizeRightEl = document.getElementById('ai-chat-resize-right');
    const resizeTopEl = document.getElementById('ai-chat-resize-top');

    function clampSize(n, lo, hi) {
      return Math.max(lo, Math.min(hi, n));
    }

    function maxPanelW() {
      return Math.max(PANEL_MIN_W, window.innerWidth - 16);
    }

    function maxPanelH() {
      return Math.min(window.innerHeight * 0.85, window.innerHeight - 100);
    }

    function loadPanelSize() {
      try {
        const raw = sessionStorage.getItem(SIZE_STORAGE_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (o && typeof o.w === 'number' && typeof o.h === 'number') return { w: o.w, h: o.h };
      } catch {}
      return null;
    }

    function applyPanelSize() {
      const saved = loadPanelSize();
      const w = saved ? clampSize(saved.w, PANEL_MIN_W, maxPanelW()) : PANEL_DEFAULT_W;
      const h = saved ? clampSize(saved.h, PANEL_MIN_H, maxPanelH()) : PANEL_DEFAULT_H;
      panel.style.width = w + 'px';
      panel.style.height = h + 'px';
    }

    function savePanelSize() {
      try {
        sessionStorage.setItem(
          SIZE_STORAGE_KEY,
          JSON.stringify({ w: panel.offsetWidth, h: panel.offsetHeight })
        );
      } catch {}
    }

    applyPanelSize();

    let resizeActive = false;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartW = 0;
    let resizeStartH = 0;
    let resizeMode = 'both';

    function onResizePointerMove(clientX, clientY) {
      if (!resizeActive) return;
      var dw = clientX - resizeStartX;
      var dh = clientY - resizeStartY;
      var nw = resizeMode === 'height' ? resizeStartW : clampSize(resizeStartW + dw, PANEL_MIN_W, maxPanelW());
      var nh = resizeMode === 'width' ? resizeStartH : clampSize(resizeStartH + dh, PANEL_MIN_H, maxPanelH());
      panel.style.width = nw + 'px';
      panel.style.height = nh + 'px';
      scrollBottom();
    }

    function endResize() {
      if (!resizeActive) return;
      resizeActive = false;
      panel.classList.remove('ai-chat-resizing');
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onResizeMouseMove);
      document.removeEventListener('mouseup', endResize);
      document.removeEventListener('touchmove', onResizeTouchMove);
      document.removeEventListener('touchend', endResize);
      document.removeEventListener('touchcancel', endResize);
      savePanelSize();
    }

    function onResizeMouseMove(e) {
      onResizePointerMove(e.clientX, e.clientY);
    }

    function onResizeTouchMove(e) {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        onResizePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }

    if (resizeEl) {
      resizeEl.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        resizeActive = true;
        panel.classList.add('ai-chat-resizing');
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartW = panel.offsetWidth;
        resizeStartH = panel.offsetHeight;
        resizeMode = 'both';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onResizeMouseMove);
        document.addEventListener('mouseup', endResize);
      });
      resizeEl.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches[0]) return;
        e.stopPropagation();
        resizeActive = true;
        panel.classList.add('ai-chat-resizing');
        resizeStartX = e.touches[0].clientX;
        resizeStartY = e.touches[0].clientY;
        resizeStartW = panel.offsetWidth;
        resizeStartH = panel.offsetHeight;
        resizeMode = 'both';
        document.body.style.userSelect = 'none';
        document.addEventListener('touchmove', onResizeTouchMove, { passive: false });
        document.addEventListener('touchend', endResize);
        document.addEventListener('touchcancel', endResize);
      });
    }

    function bindResizeHandle(el, mode) {
      if (!el) return;
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        resizeActive = true;
        resizeMode = mode;
        panel.classList.add('ai-chat-resizing');
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartW = panel.offsetWidth;
        resizeStartH = panel.offsetHeight;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onResizeMouseMove);
        document.addEventListener('mouseup', endResize);
      });
      el.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches[0]) return;
        e.preventDefault();
        e.stopPropagation();
        resizeActive = true;
        resizeMode = mode;
        panel.classList.add('ai-chat-resizing');
        resizeStartX = e.touches[0].clientX;
        resizeStartY = e.touches[0].clientY;
        resizeStartW = panel.offsetWidth;
        resizeStartH = panel.offsetHeight;
        document.body.style.userSelect = 'none';
        document.addEventListener('touchmove', onResizeTouchMove, { passive: false });
        document.addEventListener('touchend', endResize);
        document.addEventListener('touchcancel', endResize);
      });
    }

    bindResizeHandle(resizeRightEl, 'width');
    bindResizeHandle(resizeTopEl, 'height');

    window.addEventListener('resize', function () {
      var nw = clampSize(panel.offsetWidth, PANEL_MIN_W, maxPanelW());
      var nh = clampSize(panel.offsetHeight, PANEL_MIN_H, maxPanelH());
      panel.style.width = nw + 'px';
      panel.style.height = nh + 'px';
    });

    let open = false;
    let busy = false;
    let history = loadHistory();

    function scrollBottom() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    function appendBubble(role, content, isHtml) {
      const row = document.createElement('div');
      row.className = 'ai-chat-row ai-chat-row-' + role;
      const label = role === 'user' ? 'You' : 'AI';
      row.innerHTML =
        '<div class="ai-chat-avatar">' +
        label +
        '</div>' +
        '<div class="ai-chat-bubble">' +
        (isHtml ? content : escapeHtml(content)) +
        '</div>';
      msgs.appendChild(row);
      scrollBottom();
      return row;
    }

    function setOpen(v) {
      open = v;
      root.classList.toggle('ai-chat-open', v);
      panel.setAttribute('aria-hidden', v ? 'false' : 'true');
      backdrop.setAttribute('aria-hidden', v ? 'false' : 'true');
      fab.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) {
        input.focus();
        scrollBottom();
      } else {
        fab.focus();
      }
    }

    function initGreeting() {
      if (history.length) {
        history.forEach(function (m) {
          if (m.role === 'user' || m.role === 'assistant') appendBubble(m.role, m.content, false);
        });
        return;
      }
      var greeting = keySet
        ? "Hi! I'm your CyberMart assistant. Ask about orders, login, checkout, or products."
        : "Hi! <strong>Demo mode</strong> — add <code>OPENROUTER_API_KEY</code> to <code>.env</code>, run <code>npm install</code> and <code>npm run env</code>, then reload. Or edit <code>js/env-config.js</code>. See <code>.env.example</code>.";
      appendBubble('assistant', greeting, true);
    }

    fab.addEventListener('click', function () {
      setOpen(!open);
    });
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(false);
    });
    backdrop.addEventListener('click', function () {
      setOpen(false);
    });
    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          setOpen(false);
        }
      },
      true
    );

    async function send() {
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = '';
      busy = true;
      sendBtn.disabled = true;

      appendBubble('user', text, false);
      history.push({ role: 'user', content: text });

      var typingRow = document.createElement('div');
      typingRow.className = 'ai-chat-row ai-chat-row-assistant ai-chat-typing';
      typingRow.innerHTML =
        '<div class="ai-chat-avatar">AI</div>' +
        '<div class="ai-chat-bubble"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>';
      msgs.appendChild(typingRow);
      scrollBottom();

      var reply = await callOpenRouter(text, history.slice(0, -1));
      typingRow.remove();

      appendBubble('assistant', formatReply(reply), true);
      history.push({ role: 'assistant', content: reply });
      saveHistory(history);
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    initGreeting();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
