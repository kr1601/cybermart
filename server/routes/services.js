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

    // Base schema (schema.sql): services has category, no is_approved/tag.
    // Extended schemas may add those columns — try extended query first, then fall back.
    async function runQuery(useExtended) {
      let query = `
      SELECT s.*, u.name AS provider_name
      FROM services s
      LEFT JOIN users u ON s.provider_id = u.id
      WHERE 1=1
    `;
      const params = [];

      if (useExtended && !includeUnapproved) {
        query += ' AND (s.is_approved = 1 OR s.is_approved IS NULL)';
      }

      if (category) {
        query += useExtended
          ? ' AND (s.category = ? OR s.tag = ?)'
          : ' AND s.category = ?';
        if (useExtended) params.push(category, category);
        else params.push(category);
      }

      if (search) {
        query += ' AND (s.name LIKE ? OR s.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY s.id DESC';
      const [rows] = await pool.query(query, params);
      return rows || [];
    }

    let rows;
    try {
      rows = await runQuery(true);
    } catch (firstErr) {
      const msg = String(firstErr.message || '');
      if (msg.includes('Unknown column')) {
        rows = await runQuery(false);
      } else {
        throw firstErr;
      }
    }

    res.json(rows);
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
    const [rows] = await pool.query(
      `SELECT s.*, u.name AS provider_name
       FROM services s
       LEFT JOIN users u ON s.provider_id = u.id
       WHERE s.id = ?`,
      [req.params.id]
    );
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

