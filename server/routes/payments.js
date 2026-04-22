// server/routes/payments.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const { authenticate } = require('../middleware/authenticate');

// POST /api/payments/create-intent
// Creates a Stripe PaymentIntent for the current cart
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get cart items with product prices
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

    // Calculate total in cents
    const totalAmount = cartItems.reduce((sum, item) => {
      return sum + Math.round(item.price * item.quantity * 100);
    }, 0);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        userId: String(userId),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: totalAmount,
    });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/webhook
// Stripe calls this when payment succeeds/fails
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const userId = paymentIntent.metadata.userId;

    try {
      // Get cart items
      const [cartItems] = await db.query(
        `SELECT ci.product_id, ci.quantity, p.price
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         WHERE ci.user_id = ?`,
        [userId]
      );

      if (cartItems.length > 0) {
        const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Create order
        const [orderResult] = await db.query(
          `INSERT INTO orders (user_id, total, status, stripe_payment_intent_id)
           VALUES (?, ?, 'paid', ?)`,
          [userId, total, paymentIntent.id]
        );

        const orderId = orderResult.insertId;

        // Insert order items
        for (const item of cartItems) {
          await db.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price)
             VALUES (?, ?, ?, ?)`,
            [orderId, item.product_id, item.quantity, item.price]
          );
        }

        // Clear cart
        await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

        console.log(`✅ Order ${orderId} created for user ${userId}`);
      }
    } catch (dbErr) {
      console.error('DB error after payment:', dbErr);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    console.log(`❌ Payment failed for user ${paymentIntent.metadata.userId}`);
  }

  res.json({ received: true });
});

// POST /api/payments/confirm
// Called by frontend after Stripe confirms payment (fallback if webhook is delayed)
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.user.id;

    // Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Check if order already created by webhook
    const [existing] = await db.query(
      'SELECT id FROM orders WHERE stripe_payment_intent_id = ?',
      [paymentIntentId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, orderId: existing[0].id, message: 'Order already exists' });
    }

    // Create order (webhook may have been delayed)
    const [cartItems] = await db.query(
      `SELECT ci.product_id, ci.quantity, p.price
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [userId]
    );

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

    await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    res.json({ success: true, orderId });
  } catch (err) {
    console.error('Confirm payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
