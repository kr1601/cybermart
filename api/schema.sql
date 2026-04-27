-- Minimal schema to support POST /api/auth/login.php
-- Run this in your MySQL (XAMPP phpMyAdmin or hosting panel).

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('buyer','seller','admin') NOT NULL,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Demo user (password: 123456)
-- Replace email/name as you like.
INSERT INTO users (email, password_hash, role, name)
VALUES (
  'buyer@example.com',
  '$2y$10$6kQ5Yy7iIPQvQ8XQvJkH9u1pYtT1z2l8Qkz5WfN9v3V9wqC1o7G7m',
  'buyer',
  'Alex Buyer'
)
ON DUPLICATE KEY UPDATE email=email;

