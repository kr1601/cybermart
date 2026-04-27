const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

function attachUserFromToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    return user;
  } catch {
    return null;
  }
}

// ✅ Get all products (DEBUG SAFE VERSION)
router.get('/', async (req, res) => {
  try {
    attachUserFromToken(req);
    const adminSeeAll =
      String(req.query.all || '').toLowerCase() === 'true' &&
      req.user &&
      req.user.role === 'admin';

    const { category, search } = req.query;

    let query = `
      SELECT p.*, u.name AS seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Public catalog: only approved. Admin + ?all=true sees pending too.
    if (!adminSeeAll) {
      query += ' AND IFNULL(p.is_approved, 1) = 1';
    }

    if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.id DESC';

    let rows;
    try {
      [rows] = await pool.query(query, params);
    } catch (firstErr) {
      const msg = String(firstErr.message || '');
      if (msg.includes('is_approved')) {
        query = `
      SELECT p.*, u.name AS seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE 1=1
    `;
        const params2 = [];
        if (category) {
          query += ' AND p.category = ?';
          params2.push(category);
        }
        if (search) {
          query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
          params2.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY p.id DESC';
        [rows] = await pool.query(query, params2);
      } else {
        throw firstErr;
      }
    }

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
    let rows;
    try {
      [rows] = await pool.query(
        `SELECT p.*, u.name AS seller_name
         FROM products p
         LEFT JOIN users u ON p.seller_id = u.id
         WHERE p.id = ? AND IFNULL(p.is_approved, 1) = 1`,
        [req.params.id]
      );
    } catch (e) {
      if (String(e.message || '').includes('is_approved')) {
        [rows] = await pool.query(
          `SELECT p.*, u.name AS seller_name
           FROM products p
           LEFT JOIN users u ON p.seller_id = u.id
           WHERE p.id = ?`,
          [req.params.id]
        );
      } else {
        throw e;
      }
    }

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