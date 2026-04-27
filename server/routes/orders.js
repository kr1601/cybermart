const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/* =========================
   🛒 CHECKOUT (NO STRIPE VERSION)
========================= */
router.post('/checkout', authenticate, authorize('buyer'), async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = req.user.id;

    const [cartItems] = await conn.query(
      `SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [userId]
    );

    if (cartItems.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // stock check
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        conn.release();
        return res.status(400).json({
          error: `Not enough stock for ${item.name}`
        });
      }
    }

    await conn.beginTransaction();

    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // ✅ MAIN ORDER
    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, total, status)
       VALUES (?, ?, 'paid')`,
      [userId, total]
    );

    const orderId = orderResult.insertId;

    // ✅ ORDER ITEMS
    for (const item of cartItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price]
      );

      // stock update
      await conn.query(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // clear cart
    await conn.query(
      'DELETE FROM cart_items WHERE user_id = ?',
      [userId]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: 'Order placed successfully',
      orderId
    });

  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   👤 GET MY ORDERS (FIXED)
========================= */
router.get('/', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(`
      SELECT 
        o.id,
        o.total,
        o.status,
        o.created_at,
        COALESCE(GROUP_CONCAT(p.name SEPARATOR ', '), '') AS products
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [userId]);

    res.json(rows || []);

  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   👑 ADMIN - ALL ORDERS
========================= */
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        o.id,
        o.total,
        o.status,
        o.created_at,
        u.name AS buyer_name,
        u.email,
        COALESCE(GROUP_CONCAT(p.name SEPARATOR ', '), '') AS products
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    res.json(rows || []);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   🔄 UPDATE STATUS (ADMIN)
========================= */
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { status } = req.body;

  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'paid'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${validStatuses.join(', ')}`
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id FROM orders WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await pool.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    res.json({ message: `Order status updated to ${status}` });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;