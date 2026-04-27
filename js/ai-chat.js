// CyberMart AI assistant — UI + POST /api/ai/chat.php { message, history }
// Backend should return { reply: "..." } or { error: "..." }. Key stays on server.

(function () {
  const MAX_HISTORY = 16;
  const STORAGE_KEY = 'cm_ai_chat_v1';

  function baseUrl() {
    return typeof API_BASE !== 'undefined' ? API_BASE : '/api';
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_HISTORY) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(h) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-MAX_HISTORY)));
    } catch (e) { /* ignore */ }
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function demoReply(text) {
    const q = (text || '').toLowerCase();
    if (/hello|hi\b|hey\b|greetings/.test(q)) {
      return 'Hi! I\'m the CyberMart assistant. I can help with security products, cart checkout, or buyer/seller accounts.';
    }
    if (/cart|checkout|pay|payment|order/.test(q)) {
      return 'To shop: sign in as a Buyer → add items from Products → open Cart → Proceed to Checkout. Real payments need a payment gateway integrated on your server.';
    }
    if (/login|sign in|password|sign up|register/.test(q)) {
      return 'The Login page has quick demo links for Buyer / Seller / Admin. Production should call your real auth API (see TODO in login.html).';
    }
    if (/seller|vendor|listing/.test(q)) {
      return 'Sellers use dashboard-seller for listings and orders. With a backend, that data will come from your API instead of the demo tables.';
    }
    if (/product|browse|buy|shop/.test(q)) {
      return 'See products.html for the catalog (currently mock data in api.js). Later, replace it with GET /api/products.';
    }
    if (/ai|chat|gpt|openai|model|claude|gemini/.test(q)) {
      return 'Deploy /api/ai/chat.php as a server-side proxy to OpenAI, Claude, or Gemini (API key on the server only). Answers will then come from the model; right now you may see this offline demo.';
    }
    return 'Ask about products, cart, checkout, login, or dashboards. For open-ended answers, connect your AI endpoint on the server.';
  }

  async function fetchReply(userText, history) {
    const payload = {
      message: userText,
      history: history.map(function (m) { return { role: m.role, content: m.content }; })
    };
    if (typeof apiPost === 'function') {
      const data = await apiPost('/ai/chat.php', payload);
      if (data && data.error) return String(data.error);
      if (data && data.reply && String(data.reply).trim()) return String(data.reply).trim();
    } else {
      try {
        const res = await fetch(baseUrl() + '/ai/chat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && data.error) return String(data.error);
        if (data && data.reply && String(data.reply).trim()) return String(data.reply).trim();
      } catch (e) { /* fall through */ }
    }
    return demoReply(userText);
  }

  function buildWidget() {
    const root = document.createElement('div');
    root.className = 'ai-chat-root';
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="ai-chat-surface">' +
      '  <button type="button" class="ai-chat-fab" id="ai-chat-fab" aria-expanded="false" aria-controls="ai-chat-panel" title="AI Assistant">' +
      '  <span class="ai-chat-fab-icon" aria-hidden="true">✨</span></button>' +
      '  <div class="ai-chat-panel" id="ai-chat-panel" role="dialog" aria-modal="true" aria-label="CyberMart AI chat" aria-hidden="true">' +
      '    <div class="ai-chat-head">' +
      '      <div class="ai-chat-head-text"><span class="ai-chat-title">CyberMart AI</span><span class="ai-chat-sub">Help &amp; tips</span></div>' +
      '      <button type="button" class="ai-chat-close" id="ai-chat-close" title="Close" aria-label="Close chat">✕</button>' +
      '    </div>' +
      '    <div class="ai-chat-msgs" id="ai-chat-msgs"></div>' +
      '    <div class="ai-chat-foot">' +
      '      <input type="text" class="ai-chat-input" id="ai-chat-input" placeholder="Ask about products, cart, checkout…" autocomplete="off" maxlength="2000"/>' +
      '      <button type="button" class="btn btn-primary ai-chat-send" id="ai-chat-send">Send</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="ai-chat-backdrop" id="ai-chat-backdrop" aria-hidden="true"></div>';
    document.body.appendChild(root);

    const backdrop = root.querySelector('#ai-chat-backdrop');
    const fab = root.querySelector('#ai-chat-fab');
    const panel = root.querySelector('#ai-chat-panel');
    const closeBtn = root.querySelector('#ai-chat-close');
    const msgs = root.querySelector('#ai-chat-msgs');
    const input = root.querySelector('#ai-chat-input');
    const sendBtn = root.querySelector('#ai-chat-send');

    let open = false;
    let busy = false;
    let history = loadHistory();

    function scrollBottom() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    function appendBubble(role, text) {
      const row = document.createElement('div');
      row.className = 'ai-chat-row ai-chat-row-' + role;
      row.innerHTML =
        '<div class="ai-chat-avatar">' + (role === 'user' ? 'You' : 'AI') + '</div>' +
        '<div class="ai-chat-bubble">' + escapeHtml(text) + '</div>';
      msgs.appendChild(row);
      scrollBottom();
    }

    function setOpen(v) {
      open = v;
      root.classList.toggle('ai-chat-open', v);
      panel.setAttribute('aria-hidden', v ? 'false' : 'true');
      if (backdrop) {
        backdrop.setAttribute('aria-hidden', v ? 'false' : 'true');
      }
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
          if (m.role === 'user' || m.role === 'assistant') appendBubble(m.role, m.content);
        });
        return;
      }
      appendBubble('assistant', 'Hello! I\'m the CyberMart assistant. What would you like to know—products, how to check out, or your account?');
    }

    fab.addEventListener('click', function () {
      setOpen(!open);
    });
    function closeChat() {
      setOpen(false);
    }
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeChat();
    });
    if (backdrop) {
      backdrop.addEventListener('click', closeChat);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closeChat();
      }
    }, true);

    async function send() {
      const text = input.value.trim();
      if (!text || busy) return;
      input.value = '';
      busy = true;
      sendBtn.disabled = true;
      appendBubble('user', text);
      history.push({ role: 'user', content: text });

      const typing = document.createElement('div');
      typing.className = 'ai-chat-row ai-chat-row-assistant ai-chat-typing';
      typing.innerHTML = '<div class="ai-chat-avatar">AI</div><div class="ai-chat-bubble pulsing">Thinking…</div>';
      msgs.appendChild(typing);
      scrollBottom();

      const reply = await fetchReply(text, history.slice(0, -1));
      typing.remove();
      appendBubble('assistant', reply);
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
