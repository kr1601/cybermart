// server/routes/payments.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const db = require('../db');
const authenticate = require('../middleware/authenticate');


/* =========================
   CREATE PAYMENT INTENT
========================= */
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const [cartItems] = await db.query(
      `SELECT ci.quantity, p.price, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [userId]
    );

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const totalAmount = cartItems.reduce((sum, item) => {
      return sum + Math.round(item.price * item.quantity * 100);
    }, 0);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        userId: String(userId)
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount
    });

  } catch (err) {
    console.error('Stripe create-intent error:', err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   🔥 STRIPE WEBHOOK (FIXED)
========================= */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // ⚠️ raw body comes from index.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    /* =========================
       PAYMENT SUCCESS
    ========================= */
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata.userId;

      console.log(`💰 Payment succeeded for user ${userId}`);

      const [existing] = await db.query(
        `SELECT id FROM orders WHERE stripe_payment_intent_id = ?`,
        [paymentIntent.id]
      );

      if (existing.length > 0) {
        console.log('⚠️ Order already exists, skipping...');
        return res.json({ received: true });
      }

      const [cartItems] = await db.query(
        `SELECT ci.product_id, ci.quantity, p.price
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         WHERE ci.user_id = ?`,
        [userId]
      );

      if (!cartItems.length) {
        console.log('⚠️ Cart empty, nothing to process');
        return res.json({ received: true });
      }

      const total = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const [orderResult] = await db.query(
        `INSERT INTO orders (user_id, total, status, stripe_payment_intent_id)
         VALUES (?, ?, 'paid', ?)`,
        [userId, total, paymentIntent.id]
      );

      const orderId = orderResult.insertId;

      for (const item of cartItems) {
        await db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [orderId, item.product_id, item.quantity, item.price]
        );
      }

      await db.query(
        `DELETE FROM cart_items WHERE user_id = ?`,
        [userId]
      );

      console.log(`✅ Order ${orderId} created successfully`);
    }

    /* =========================
       PAYMENT FAILED
    ========================= */
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      console.log(`❌ Payment failed for user ${paymentIntent.metadata.userId}`);
    }

    res.json({ received: true });

  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   OPTIONAL CONFIRM (fallback)
========================= */
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.user.id;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const [existing] = await db.query(
      `SELECT id FROM orders WHERE stripe_payment_intent_id = ?`,
      [paymentIntentId]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        orderId: existing[0].id,
        message: 'Order already exists'
      });
    }

    const [cartItems] = await db.query(
      `SELECT ci.product_id, ci.quantity, p.price
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [userId]
    );

    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, total, status, stripe_payment_intent_id)
       VALUES (?, ?, 'paid', ?)`,
      [userId, total, paymentIntentId]
    );

    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    await db.query(
      `DELETE FROM cart_items WHERE user_id = ?`,
      [userId]
    );

    res.json({ success: true, orderId });

  } catch (err) {
    console.error('❌ Confirm payment error:', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;