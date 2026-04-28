const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const pool = require('../db');

let stripeSingleton;
function getStripe() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!stripeSingleton) stripeSingleton = Stripe(k);
  return stripeSingleton;
}
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { computeCartTotals, lineItemsTotals } = require('../lib/checkoutTotals');

async function fulfillStripeOrder(userId, paymentIntentId) {
  const uid =
    typeof userId === 'number'
      ? userId
      : parseInt(String(userId), 10);
  if (Number.isNaN(uid)) {
    return { ok: false, reason: 'invalid_user' };
  }
  const conn = await pool.getConnection();

  try {
    const [existing] = await conn.query(
      `SELECT id FROM orders WHERE stripe_payment_intent_id = ?`,
      [paymentIntentId]
    );

    if (existing.length > 0) {
      conn.release();
      return { ok: true, duplicate: true, orderId: existing[0].id };
    }

    await conn.beginTransaction();

    const [cartItems] = await conn.query(
      `SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [uid]
    );

    if (!cartItems.length) {
      await conn.rollback();
      conn.release();
      return { ok: false, reason: 'empty_cart' };
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await conn.rollback();
        conn.release();
        return { ok: false, reason: 'stock', product: item.name };
      }
    }

    const { total } = lineItemsTotals(cartItems);

    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, total, status, stripe_payment_intent_id)
       VALUES (?, ?, 'paid', ?)`,
      [uid, total, paymentIntentId]
    );

    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price]
      );

      await conn.query(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    await conn.query(`DELETE FROM cart_items WHERE user_id = ?`, [uid]);
    await conn.commit();
    conn.release();

    return { ok: true, duplicate: false, orderId };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    conn.release();
    throw err;
  }
}

/*
  Public JSON for the checkout page (publishable key is meant for browsers).
  Defined on this router so GET /api/payments/client-config works whenever this
  router is mounted — older deployments only had these routes under /api/payments.
*/
router.get('/client-config', (req, res) => {
  const sk = process.env.STRIPE_SECRET_KEY;
  const pk = process.env.STRIPE_PUBLISHABLE_KEY;
  const enabled = !!(sk && pk);
  res.json({
    paymentsEnabled: enabled,
    publishableKey: enabled ? pk : ''
  });
});

router.post(
  '/create-intent',
  authenticate,
  authorize('buyer'),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const totals = await computeCartTotals(userId);
      if (!totals) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      for (const item of totals.cartItems) {
        if (item.stock < item.quantity) {
          return res.status(400).json({
            error: `Not enough stock for ${item.name}`
          });
        }
      }

      const paymentIntent = await getStripe().paymentIntents.create({
        amount: totals.totalCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId: String(userId)
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: totals.totalCents,
        currency: 'usd'
      });
    } catch (err) {
      console.error('Stripe create-intent error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata.userId;

      console.log(`Payment succeeded for user ${userId}`);

      const result = await fulfillStripeOrder(userId, paymentIntent.id);

      if (result.reason === 'empty_cart') {
        console.log('Webhook: cart empty at fulfillment (may already be fulfilled)');
      } else if (!result.ok && result.reason === 'stock') {
        console.error('Webhook: insufficient stock:', result.product);
      } else if (result.ok && !result.duplicate) {
        console.log(`Order ${result.orderId} created`);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      console.log(
        `Payment failed for user ${paymentIntent.metadata?.userId || '?'}`
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/confirm', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.user.id;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId required' });
    }

    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata.userId !== String(userId)) {
      return res.status(403).json({ error: 'Payment does not belong to this account' });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const [existing] = await pool.query(
      `SELECT id FROM orders WHERE stripe_payment_intent_id = ?`,
      [paymentIntentId]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        orderId: existing[0].id,
        message: 'Order already recorded'
      });
    }

    const totals = await computeCartTotals(userId);
    if (!totals || totals.totalCents !== paymentIntent.amount) {
      return res.status(400).json({
        error: 'Cart total no longer matches this payment. Contact support if you were charged.'
      });
    }

    const result = await fulfillStripeOrder(userId, paymentIntentId);

    if (!result.ok) {
      if (result.reason === 'stock') {
        return res.status(409).json({
          error: `Stock changed: ${result.product}. If payment succeeded, support will reconcile.`
        });
      }
      return res.status(400).json({ error: 'Could not complete order' });
    }

    res.json({ success: true, orderId: result.orderId });
  } catch (err) {
    console.error('Confirm payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
