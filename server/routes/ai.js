const express = require('express');

const router = express.Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey() {
  const keys = [
    'OPEN_ROUTER_API_KEY',
    'OPENROUTER_API_KEY',
    'OPEN_ROUTER_OPENROUTER',
    'OPENAI_API_KEY'
  ];
  for (const k of keys) {
    const v = String(process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

function useOpenRouterForKey() {
  if (String(process.env.OPEN_ROUTER_API_KEY || '').trim()) return true;
  if (String(process.env.OPENROUTER_API_KEY || '').trim()) return true;
  return String(getApiKey()).startsWith('sk-or-');
}

function getModel() {
  return (
    String(process.env.OPEN_ROUTER_MODEL || '').trim() ||
    String(process.env.OPENAI_MODEL || '').trim() ||
    'openai/gpt-4o-mini'
  );
}

/** GET /api/ai/chat — health check (also proves route exists; POST is used for real chat). */
router.get('/chat', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'CyberMart AI proxy is mounted. Use POST with JSON body { message, history }.',
    keyConfigured: !!getApiKey()
  });
});

/** POST /api/ai/chat — OpenAI-compatible (Open Router or OpenAI direct). Body: { message, history } */
router.post('/chat', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error:
        'AI not configured: set OPEN_ROUTER_API_KEY (or OPENAI_API_KEY) in server environment.'
    });
  }

  const message = String(req.body?.message ?? '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) {
    return res.status(400).json({ error: 'Empty message' });
  }

  const useOpenRouter = useOpenRouterForKey();
  const url = useOpenRouter ? OPENROUTER_URL : 'https://api.openai.com/v1/chat/completions';

  const system =
    'You are the CyberMart assistant: a concise, friendly guide for a cybersecurity marketplace (products, cart, checkout, buyer/seller/admin dashboards). Keep answers practical and short unless the user asks for detail.';

  const messages = [{ role: 'system', content: system }];

  for (const h of history) {
    if (!h || typeof h !== 'object') continue;
    const role = String(h.role || '');
    const content = String(h.content || '').trim();
    if ((role === 'user' || role === 'assistant') && content) {
      messages.push({ role, content });
    }
  }
  messages.push({ role: 'user', content: message });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey
  };

  if (useOpenRouter) {
    const site = String(process.env.OPEN_ROUTER_SITE_URL || process.env.PUBLIC_URL || '').trim();
    if (site) {
      headers['HTTP-Referer'] = site;
      headers['X-Title'] = 'CyberMart';
    }
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: getModel(),
        messages,
        max_tokens: 600
      })
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const msg =
        (data && data.error && (data.error.message || data.error)) ||
        `Upstream HTTP ${r.status}`;
      return res.status(502).json({ error: String(msg) });
    }

    const reply = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!reply) {
      return res.status(502).json({ error: 'Empty reply from model' });
    }

    return res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(502).json({
      error: err.message || 'AI request failed'
    });
  }
});

module.exports = router;
