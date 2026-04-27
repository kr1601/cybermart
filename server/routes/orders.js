const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Place order from cart (buyer only)
router.post('/checkout', authenticate, authorize('buyer'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // Get cart items
    const [cartItems] = await conn.query(
      `SELECT ci.*, p.price, p.stock, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );

    if (cartItems.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check stock for all items
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        conn.release();
        return res.status(400).json({
          error: `Not enough stock for ${item.name}`
        });
      }
    }

    await conn.beginTransaction();

    const createdOrders = [];

    for (const item of cartItems) {
      const total = (item.price * item.quantity).toFixed(2);

      // Insert order
      const [orderResult] = await conn.query(
        `INSERT INTO orders (buyer_id, product_id, quantity, total, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [req.user.id, item.product_id, item.quantity, total]
      );

      // Deduct stock
      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );

      createdOrders.push({
        order_id: orderResult.insertId,
        product: item.name,
        quantity: item.quantity,
        total
      });
    }

    // Clear cart
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: 'Order placed successfully',
      orders: createdOrders
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    res.status(500).json({ error: err.message });
  }
});

// Get my orders (buyer)
router.get('/', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.*, p.name AS product_name, p.category
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.buyer_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all orders (admin only)
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.*, p.name AS product_name, u.name AS buyer_name, u.email
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users u ON o.buyer_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status (admin only)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if ((rows || []).length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: `Order status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;