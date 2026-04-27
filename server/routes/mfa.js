const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('../db');
const authenticate = require('../middleware/authenticate');

// Setup MFA - generate secret and QR code
router.post('/setup', authenticate, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `CyberMart (${req.user.email})`,
      length: 20
    });

    // Save secret temporarily (not enabled yet)
    await pool.query(
      'UPDATE users SET mfa_secret = ? WHERE id = ?',
      [secret.base32, req.user.id]
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      message: 'Scan the QR code with Google Authenticator',
      secret: secret.base32,
      qrCode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify and enable MFA
router.post('/verify', authenticate, async (req, res) => {
  const { token } = req.body;
  try {
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const [rows] = await pool.query('SELECT mfa_secret FROM users WHERE id = ?', [req.user.id]);

    if (!rows[0].mfa_secret) {
      return res.status(400).json({ error: 'MFA not set up. Call /api/mfa/setup first' });
    }

    const verified = speakeasy.totp.verify({
      secret: rows[0].mfa_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token. Try again' });
    }

    await pool.query(
      'UPDATE users SET mfa_enabled = 1 WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'MFA enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disable MFA
router.post('/disable', authenticate, async (req, res) => {
  const { token } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!rows[0].mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: rows[0].mfa_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    await pool.query(
      'UPDATE users SET mfa_secret = NULL, mfa_enabled = 0 WHERE id = ?',
      [req.user.id]
    );

    res.json({ message: 'MFA disabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;