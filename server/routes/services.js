const express = require('express');
const router = express.Router();
const pool = require('../db');

// Public: list services (optionally filter)
// Query:
// - category: exact match on category (or tag if category missing)
// - search: LIKE on name/description
// - include_unapproved=true: return all rows (default filters approved if column exists)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    const includeUnapproved =
      String(req.query.include_unapproved || '').toLowerCase() === 'true' ||
      String(req.query.includeUnapproved || '').toLowerCase() === 'true';

    // We keep the SQL tolerant: many schemas use either `category` or `tag`.
    // If your table doesn't have one of these columns, MySQL will throw and you'll see it in the response.
    let query = `
      SELECT *
      FROM services
      WHERE 1=1
    `;
    const params = [];

    if (!includeUnapproved) {
      // If your schema has is_approved, this filters to approved only.
      // If it doesn't, remove this line.
      query += ' AND (is_approved = 1 OR is_approved IS NULL)';
    }

    if (category) {
      query += ' AND (category = ? OR tag = ?)';
      params.push(category, category);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows || []);
  } catch (err) {
    console.error('SERVICES ERROR:', err);
    res.status(500).json({
      error: err.message || 'Unknown error',
      details: err
    });
  }
});

// Public: get single service
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET SERVICE ERROR:', err);
    res.status(500).json({
      error: err.message || 'Unknown error',
      details: err
    });
  }
});

module.exports = router;

