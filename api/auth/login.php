<?php
declare(strict_types=1);

require_once __DIR__ . '/../_db.php';
require_once __DIR__ . '/../_json.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$email = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($email === '' || $password === '') {
    json_response(['error' => 'Missing email or password'], 400);
}

$stmt = db()->prepare('SELECT id, email, password_hash, role, name FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_response(['error' => 'Invalid credentials'], 401);
}

$token = bin2hex(random_bytes(32));
$expiresAt = (new DateTimeImmutable('+7 days'))->format('Y-m-d H:i:s');

$ins = db()->prepare('INSERT INTO auth_tokens(token, user_id, expires_at) VALUES(?,?,?)');
$ins->execute([$token, (int)$user['id'], $expiresAt]);

json_response([
    'token' => $token,
    'role' => $user['role'],
    'name' => $user['name'],
]);

