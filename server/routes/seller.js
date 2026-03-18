const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.post('/apply', authenticate, authorize('seller'), async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM seller_applications WHERE user_id = $1', [req.user.id]
    );
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Application already submitted' });
    const result = await pool.query(
      'INSERT INTO seller_applications (user_id) VALUES ($1) RETURNING *',
      [req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/apply/status', authenticate, authorize('seller'), async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM seller_applications WHERE user_id = $1', [req.user.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'No application found' });
  res.json(result.rows[0]);
});

module.exports = router;