const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.post('/apply', authenticate, authorize('seller'), async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT * FROM seller_applications WHERE user_id = ?', [req.user.id]
    );
    if ((existing || []).length > 0)
      return res.status(400).json({ error: 'Application already submitted' });
    const [result] = await pool.query(
      'INSERT INTO seller_applications (user_id) VALUES (?)',
      [req.user.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/apply/status', authenticate, authorize('seller'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM seller_applications WHERE user_id = ?', [req.user.id]
  );
  if ((rows || []).length === 0)
    return res.status(404).json({ error: 'No application found' });
  res.json(rows[0]);
});

module.exports = router;