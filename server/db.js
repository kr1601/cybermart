const mysql = require('mysql2/promise');

/** Railway / hosts often use MYSQL_* or lowercase names — accept common aliases. */
function pickEnv(keys, fallback = undefined) {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return fallback;
}

const mysqlUrl = pickEnv(['MYSQL_URL', 'MYSQL_PUBLIC_URL', 'DATABASE_URL']);

function poolFromMysqlUrl(urlStr) {
  const u = new URL(urlStr);
  const database = u.pathname.replace(/^\//, '').split('?')[0];
  return mysql.createPool({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

let pool;

if (mysqlUrl && /^mysql/i.test(mysqlUrl)) {
  try {
    pool = poolFromMysqlUrl(mysqlUrl);
  } catch (e) {
    console.error('Invalid MYSQL_URL / DATABASE_URL:', e.message);
    pool = mysql.createPool({
      host: pickEnv(['DB_HOST', 'MYSQLHOST', 'MYSQL_HOST', 'db_host']),
      user: pickEnv(['DB_USER', 'MYSQLUSER', 'MYSQL_USER', 'db_user']),
      password: pickEnv(['DB_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_PASSWORD', 'db_password']),
      database: pickEnv(['DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE', 'db_name']),
      port: pickEnv(['DB_PORT', 'MYSQLPORT', 'MYSQL_PORT'])
        ? Number(pickEnv(['DB_PORT', 'MYSQLPORT', 'MYSQL_PORT']))
        : undefined,
      ssl: { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
} else {
  pool = mysql.createPool({
    host: pickEnv(['DB_HOST', 'MYSQLHOST', 'MYSQL_HOST', 'db_host']),
    user: pickEnv(['DB_USER', 'MYSQLUSER', 'MYSQL_USER', 'db_user']),
    password: pickEnv(['DB_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_PASSWORD', 'db_password']),
    database: pickEnv(['DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE', 'db_name']),
    port: pickEnv(['DB_PORT', 'MYSQLPORT', 'MYSQL_PORT'])
      ? Number(pickEnv(['DB_PORT', 'MYSQLPORT', 'MYSQL_PORT']))
      : undefined,

    ssl: { rejectUnauthorized: false },

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

module.exports = pool;