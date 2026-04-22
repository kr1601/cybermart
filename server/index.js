const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

/* =========================
   ✅ CORS CONFIG (FIXED)
========================= */
app.use(cors({
  origin: [
    'https://securelink.infinityfree.me',  // your domain
    'http://localhost:5500',               // local testing (optional)
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());

/* =========================
   ROUTES
========================= */
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const sellerRoutes = require('./routes/seller');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const mfaRoutes = require('./routes/mfa');
const paymentsRouter = require('./routes/payments');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments', paymentsRouter);
/* =========================
   HEALTH CHECK
========================= */
app.get('/', (req, res) => {
  res.json({ message: '🚀 Marketplace API is running!' });
});

/* =========================
   ERROR HANDLER (VERY IMPORTANT)
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