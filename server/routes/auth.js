const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const pool = require('../db');
require('dotenv').config();

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, role || 'buyer']
    );
    res.status(201).json({
      user: {
        id: result.insertId,
        name,
        email,
        role: role || 'buyer'
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password, mfa_token } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'User not found' });
    if (user.is_locked) return res.status(403).json({ error: 'Account is locked' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await pool.query(
        'INSERT INTO audit_logs (user_id, event_type, ip_address, details) VALUES (?, ?, ?, ?)',
        [user.id, 'LOGIN_FAIL', req.ip, `Failed login for ${email}`]
      );
      return res.status(401).json({ error: 'Invalid password' });
    }

    // If MFA is enabled, require the token
    if (user.mfa_enabled) {
      if (!mfa_token) {
        return res.status(206).json({
          message: 'MFA token required',
          mfa_required: true
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: mfa_token,
        window: 1
      });

      if (!verified) {
        await pool.query(
          'INSERT INTO audit_logs (user_id, event_type, ip_address, details) VALUES (?, ?, ?, ?)',
          [user.id, 'LOGIN_FAIL_MFA', req.ip, `Failed MFA for ${email}`]
        );
        return res.status(401).json({ error: 'Invalid MFA token' });
      }
    }

    await pool.query(
      'INSERT INTO audit_logs (user_id, event_type, ip_address, details) VALUES (?, ?, ?, ?)',
      [user.id, 'LOGIN_SUCCESS', req.ip, `Login for ${email}`]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;