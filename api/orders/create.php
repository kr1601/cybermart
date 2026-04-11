<?php
declare(strict_types=1);

require_once __DIR__ . '/../_json.php';
require_once __DIR__ . '/../_auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$user = require_role(['buyer']);
$body = read_json_body();

json_response([
    'ok' => true,
    'message' => 'Order created (demo real API endpoint).',
    'buyer' => ['id' => $user['id'], 'email' => $user['email']],
    'received' => $body,
]);

