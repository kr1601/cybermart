const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

async function logAction(userId, action, details) {
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
    [userId, action, details]
  );
}

router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  const result = await pool.query('SELECT id, email, role, is_locked, created_at FROM users');
  res.json(result.rows);
});

router.patch('/users/:id/lock', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { is_locked } = req.body;
  await pool.query('UPDATE users SET is_locked = $1 WHERE id = $2', [is_locked, id]);
  await logAction(req.user.id, is_locked ? 'LOCK_USER' : 'UNLOCK_USER', `User ID: ${id}`);
  res.json({ message: `User ${is_locked ? 'locked' : 'unlocked'}` });
});

router.get('/applications', authenticate, authorize('admin'), async (req, res) => {
  const result = await pool.query(
    'SELECT sa.*, u.email FROM seller_applications sa JOIN users u ON sa.user_id = u.id'
  );
  res.json(result.rows);
});

router.patch('/applications/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await pool.query(
    'UPDATE seller_applications SET status = $1, reviewed_at = NOW() WHERE id = $2',
    [status, id]
  );
  await logAction(req.user.id, 'REVIEW_APPLICATION', `App ID: ${id}, Status: ${status}`);
  res.json({ message: `Application ${status}` });
});

router.get('/logs', authenticate, authorize('admin'), async (req, res) => {
  const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
  res.json(result.rows);
});

module.exports = router;