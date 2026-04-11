const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Get all approved products (with seller name)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT p.*, u.name AS seller_name 
      FROM products p 
      JOIN users u ON p.seller_id = u.id
      WHERE p.is_approved = 1
    `;
    const params = [];

    if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product by ID (with seller name)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS seller_name 
       FROM products p 
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a product (seller only)
router.post('/', authenticate, authorize('seller'), async (req, res) => {
  const { name, description, price, category, stock, icon } = req.body;
  try {
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'name, price and category are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO products (name, description, price, category, stock, seller_id, icon, is_approved) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [name, description, price, category, stock || 0, req.user.id, icon || null]
    );

    const [newRows] = await pool.query(
      `SELECT p.*, u.name AS seller_name 
       FROM products p 
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Product submitted and awaiting admin approval',
      product: newRows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a product (seller must own it)
router.put('/:id', authenticate, authorize('seller'), async (req, res) => {
  const { name, description, price, category, stock, icon } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Product not found' });
    if (rows[0].seller_id !== req.user.id)
      return res.status(403).json({ error: 'You can only edit your own products' });

    await pool.query(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, category = ?, stock = ?, icon = ?, is_approved = 0
       WHERE id = ?`,
      [
        name || rows[0].name,
        description || rows[0].description,
        price || rows[0].price,
        category || rows[0].category,
        stock ?? rows[0].stock,
        icon || rows[0].icon,
        req.params.id
      ]
    );

    const [updated] = await pool.query(
      `SELECT p.*, u.name AS seller_name 
       FROM products p 
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    res.json({
      message: 'Product updated and resubmitted for approval',
      product: updated[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a product (seller owns it, or admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Product not found' });

    if (req.user.role !== 'admin' && rows[0].seller_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized to delete this product' });

    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve a product (admin only)
router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Product not found' });

    await pool.query(
      'UPDATE products SET is_approved = 1 WHERE id = ?', [req.params.id]
    );
    res.json({ message: 'Product approved and now visible to buyers' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;