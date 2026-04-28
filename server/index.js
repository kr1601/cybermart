const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

/* =========================
   ✅ CORS CONFIG
========================= */
function parseAllowedOriginsFromEnv() {
  const raw = String(process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const ALLOWED_ORIGINS_EXTRA = parseAllowedOriginsFromEnv();

const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...ALLOWED_ORIGINS_EXTRA
]);

function isInfinityFreeOrigin(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return (
      host === 'infinityfree.me' ||
      host.endsWith('.infinityfree.me') ||
      host === 'infinityfreeapp.com' ||
      host.endsWith('.infinityfreeapp.com')
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    // When ALLOWED_ORIGINS is unset, reflect the request origin so static hosts
    // (GitHub Pages, Netlify, another Railway URL) can call the API without extra env.
    if (ALLOWED_ORIGINS_EXTRA.length === 0) {
      return cb(null, true);
    }
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    if (isInfinityFreeOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

/* =========================
   🔥 STRIPE WEBHOOK RAW BODY (CRITICAL)
   MUST COME BEFORE express.json()
========================= */
const hasStripe = !!process.env.STRIPE_SECRET_KEY;

if (hasStripe) {
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
}

/* =========================
   NORMAL JSON PARSER
========================= */
app.use(express.json());

/* Public: lets the static site know whether to mount Stripe (publishable key is safe to expose). */
function sendPaymentsClientConfig(res) {
  const sk = process.env.STRIPE_SECRET_KEY;
  const pk = process.env.STRIPE_PUBLISHABLE_KEY;
  const enabled = !!(sk && pk);
  res.json({
    paymentsEnabled: enabled,
    publishableKey: enabled ? pk : ''
  });
}

app.get('/api/payments/client-config', (req, res) => sendPaymentsClientConfig(res));

/** Misconfigured clients used origin-only API_BASE → wrong path /payments/… (404). Same JSON here. */
app.get('/payments/client-config', (req, res) => sendPaymentsClientConfig(res));

/* =========================
   ROUTES
========================= */
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const sellerRoutes = require('./routes/seller');
const productRoutes = require('./routes/products');
const servicesRoutes = require('./routes/services');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const bookingRoutes = require('./routes/bookings');
const mfaRoutes = require('./routes/mfa');
const aiRoutes = require('./routes/ai');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bookings', bookingRoutes);
/** Same router without /api prefix — avoids 404 if a gateway or mis-set API_BASE hits …/bookings instead of …/api/bookings. */
app.use('/bookings', bookingRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/ai', aiRoutes);

/* =========================
   PAYMENTS ROUTES
========================= */
if (hasStripe) {
  const paymentsRouter = require('./routes/payments');
  app.use('/api/payments', paymentsRouter);
} else {
  app.use('/api/payments', (req, res) => {
    res.status(503).json({ error: 'Payments disabled: missing STRIPE_SECRET_KEY' });
  });
}

/* =========================
   HEALTH CHECK
========================= */
app.get('/', (req, res) => {
  res.json({ message: '🚀 Marketplace API is running!' });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    details: err.message
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});