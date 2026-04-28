const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.post('/', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const { service_id, scheduled_date, notes } = req.body;
    const sid = parseInt(String(service_id), 10);
    if (!sid || Number.isNaN(sid)) {
      return res.status(400).json({ error: 'service_id is required' });
    }
    if (!scheduled_date || String(scheduled_date).trim() === '') {
      return res.status(400).json({ error: 'scheduled_date is required' });
    }

    const userId = req.user.id;

    const [svc] = await pool.query('SELECT id FROM services WHERE id = ?', [sid]);
    if (!svc.length) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let dt = String(scheduled_date).trim();
    if (dt.includes('T') && !dt.includes(' ')) {
      dt = dt.replace('T', ' ');
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dt)) {
      dt += ':00';
    }

    const [result] = await pool.query(
      `INSERT INTO bookings (buyer_id, service_id, scheduled_date, status, notes)
       VALUES (?, ?, ?, 'pending', ?)`,
      [userId, sid, dt, notes ? String(notes).slice(0, 2000) : null]
    );

    res.status(201).json({
      message: 'Booking created',
      bookingId: result.insertId
    });
  } catch (err) {
    console.error('POST booking error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

router.get('/mine', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.scheduled_date, b.status, b.notes, b.created_at,
              s.name AS service_name, s.price,
              u.name AS provider_name
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON s.provider_id = u.id
       WHERE b.buyer_id = ?
       ORDER BY b.scheduled_date DESC`,
      [req.user.id]
    );
    res.json(rows || []);
  } catch (err) {
    console.error('GET bookings mine error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

module.exports = router;
