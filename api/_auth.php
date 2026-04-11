<?php
declare(strict_types=1);

require_once __DIR__ . '/_db.php';
require_once __DIR__ . '/_json.php';

function require_user(): array
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        json_response(['error' => 'Missing Authorization token'], 401);
    }
    $token = $m[1];

    $stmt = db()->prepare(
        'SELECT u.id, u.email, u.role, u.name
         FROM auth_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token = ? AND t.expires_at > NOW()
         LIMIT 1'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user) json_response(['error' => 'Invalid or expired token'], 401);

    return $user;
}

function require_role(array $roles): array
{
    $u = require_user();
    if (!in_array($u['role'], $roles, true)) {
        json_response(['error' => 'Forbidden'], 403);
    }
    return $u;
}

