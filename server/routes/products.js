const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// ✅ Get all products (DEBUG SAFE VERSION)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    let query = `
      SELECT * 
      FROM products
      WHERE 1=1
    `;

    const params = [];

    // TEMP: remove approval filter for debugging
    // query += ' AND is_approved = 1';

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id DESC';

    console.log("QUERY:", query);
    console.log("PARAMS:", params);

    const [rows] = await pool.query(query, params);

    console.log("RESULT:", rows);

    res.json(rows || []);

  } catch (err) {
    console.error("FULL ERROR:", err);

    res.status(500).json({
      error: err.message || "Unknown error",
      details: err
    });
  }
});

// ✅ Get single product (safe)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM products WHERE id = ?`,
      [req.params.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error("GET PRODUCT ERROR:", err);

    res.status(500).json({
      error: err.message || "Unknown error",
      details: err
    });
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

    res.status(201).json({
      message: 'Product created',
      id: result.insertId
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);

    res.status(500).json({
      error: err.message || "Unknown error",
      details: err
    });
  }
});

// ✅ Approve product
router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE products SET is_approved = 1 WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Product approved' });

  } catch (err) {
    console.error("APPROVE ERROR:", err);

    res.status(500).json({
      error: err.message || "Unknown error",
      details: err
    });
  }
});

module.exports = router;