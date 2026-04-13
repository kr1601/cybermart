const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// ✅ Get all products (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    let query = `
      SELECT p.*, u.name AS seller_name 
      FROM products p 
      JOIN users u ON p.seller_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Optional: filter only approved (keep this for production)
    query += ' AND p.is_approved = 1';

    if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC';

    console.log("QUERY:", query);
    console.log("PARAMS:", params);

    const [rows] = await pool.query(query, params);

    if (!rows || rows.length === 0) {
      return res.json([]); // clean response instead of weird DB error
    }

    res.json(rows);

  } catch (err) {
    console.error("PRODUCTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get single product
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS seller_name 
       FROM products p 
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error("GET PRODUCT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create product
router.post('/', authenticate, authorize('seller'), async (req, res) => {
  const { name, description, price, category, stock, icon } = req.body;

  try {
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'name, price and category are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO products 
       (name, description, price, category, stock, seller_id, icon, is_approved) 
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
      message: 'Product submitted (needs admin approval)',
      product: newRows[0]
    });

  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update product
router.put('/:id', authenticate, authorize('seller'), async (req, res) => {
  const { name, description, price, category, stock, icon } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your product' });
    }

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

    res.json({ message: 'Updated (needs re-approval)' });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete product
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (req.user.role !== 'admin' && rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);

    res.json({ message: 'Deleted successfully' });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Approve product
router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE products SET is_approved = 1 WHERE id = ?', [req.params.id]
    );

    res.json({ message: 'Product approved' });

  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;