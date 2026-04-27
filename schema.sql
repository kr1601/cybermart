/* AI AIDED, NOT FINAL PRODUCT !!*/
CREATE TABLE users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         ENUM('buyer','seller','admin') NOT NULL DEFAULT 'buyer',
  is_verified  TINYINT(1) DEFAULT 0,
  is_locked    TINYINT(1) DEFAULT 0,
  mfa_secret   VARCHAR(100) DEFAULT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seller_applications (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  company_name   VARCHAR(100) NOT NULL,
  credentials    TEXT NOT NULL,
  status         ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  submitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  event_type     ENUM('LOGIN_SUCCESS', 'LOGIN_FAIL', 'SELLER_APPROVED', 'ACCOUNT_LOCKED', 'MFA_VERIFIED') NOT NULL,
  user_id        INT DEFAULT NULL,
  ip_address     VARCHAR(45) NOT NULL,
  details        TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  price        DECIMAL(10, 2) NOT NULL,
  category     VARCHAR(100) NOT NULL,
  stock        INT DEFAULT 0,
  seller_id    INT NOT NULL,
  icon         VARCHAR(255),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  buyer_id     INT NOT NULL,
  product_id   INT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  total        DECIMAL(10, 2) NOT NULL,
  status       ENUM('processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'processing',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  price        DECIMAL(10, 2) NOT NULL,
  provider_id  INT NOT NULL,
  category     VARCHAR(100) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  buyer_id       INT NOT NULL,
  service_id     INT NOT NULL,
  scheduled_date DATETIME NOT NULL,
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);