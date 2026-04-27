const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Get cart for logged-in buyer
router.get('/', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ci.id, ci.quantity, ci.created_at,
              p.id AS product_id, p.name, p.price, p.category,
              (ci.quantity * p.price) AS subtotal
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );

    const total = rows.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    res.json({ items: rows, total: total.toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item to cart
router.post('/', authenticate, authorize('buyer'), async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  try {
    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    const [products] = await pool.query(
      'SELECT * FROM products WHERE id = ? AND is_approved = 1',
      [product_id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found or not available' });
    }

    if (products[0].stock < quantity) {
      return res.status(400).json({ error: 'Not enough stock available' });
    }

    const [existing] = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (existing.length > 0) {
      const newQty = existing[0].quantity + quantity;
      if (products[0].stock < newQty) {
        return res.status(400).json({ error: 'Not enough stock available' });
      }
      await pool.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQty, existing[0].id]
      );
      return res.json({ message: 'Cart updated', quantity: newQty });
    }

    await pool.query(
      'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [req.user.id, product_id, quantity]
    );

    res.status(201).json({ message: 'Item added to cart' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update quantity of a cart item
router.put('/:id', authenticate, authorize('buyer'), async (req, res) => {
  const { quantity } = req.body;
  try {
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const [products] = await pool.query(
      'SELECT stock FROM products WHERE id = ?',
      [rows[0].product_id]
    );
    if (!products[0] || products[0].stock < quantity) {
      return res.status(400).json({ error: 'Not enough stock available' });
    }

    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [quantity, req.params.id]
    );

    res.json({ message: 'Cart item updated', quantity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove item from cart
router.delete('/:id', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    await pool.query('DELETE FROM cart_items WHERE id = ?', [req.params.id]);
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear entire cart
router.delete('/', authenticate, authorize('buyer'), async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;