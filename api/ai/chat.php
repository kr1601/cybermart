<?php
declare(strict_types=1);

/**
 * Chat proxy to OpenAI (API key stays on the server only).
 *
 * Configuration (pick one):
 * 1) Environment: OPENAI_API_KEY, optional OPENAI_MODEL (default gpt-4o-mini)
 * 2) Same directory: openai-key.php returning ['openai_api_key' => 'sk-...']
 *    (add openai-key.php to .gitignore when you commit)
 *
 * Request JSON: { "message": "...", "history": [ { "role": "user"|"assistant", "content": "..." } ] }
 * Response JSON: { "reply": "..." } or { "error": "..." }
 */

require_once __DIR__ . '/../_json.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    json_response(['ok' => true]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$message = trim((string)($body['message'] ?? ''));
$history = $body['history'] ?? [];
if (!is_array($history)) {
    $history = [];
}

if ($message === '') {
    json_response(['error' => 'Empty message'], 400);
}

$apiKey = getenv('OPENAI_API_KEY') ?: '';
$keyFile = __DIR__ . '/openai-key.php';
if ($apiKey === '' && is_readable($keyFile)) {
    $cfg = require $keyFile;
    if (is_array($cfg) && !empty($cfg['openai_api_key'])) {
        $apiKey = (string) $cfg['openai_api_key'];
    }
}

if ($apiKey === '') {
    json_response([
        'error' => 'AI not configured: set OPENAI_API_KEY or create api/ai/openai-key.php (see chat.php header).',
    ], 503);
}

$model = getenv('OPENAI_MODEL') ?: 'gpt-4o-mini';

$messages = [
    [
        'role' => 'system',
        'content' => 'You are the CyberMart assistant: a concise, friendly guide for a cybersecurity marketplace (products, cart, checkout, buyer/seller/admin dashboards). Keep answers practical and short unless the user asks for detail.',
    ],
];

foreach ($history as $h) {
    if (!is_array($h)) {
        continue;
    }
    $role = (string) ($h['role'] ?? '');
    $content = trim((string) ($h['content'] ?? ''));
    if (($role === 'user' || $role === 'assistant') && $content !== '') {
        $messages[] = ['role' => $role, 'content' => $content];
    }
}
$messages[] = ['role' => 'user', 'content' => $message];

$payload = json_encode([
    'model' => $model,
    'messages' => $messages,
    'max_tokens' => 600,
], JSON_UNESCAPED_UNICODE);

if (!function_exists('curl_init')) {
    json_response(['error' => 'PHP cURL extension required for AI proxy'], 500);
}

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 90,
]);
$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false || $curlErr !== '') {
    json_response(['error' => 'AI request failed: ' . ($curlErr ?: 'unknown')], 502);
}

$data = json_decode((string) $response, true);
if (!is_array($data)) {
    json_response(['error' => 'Invalid AI response'], 502);
}

if ($httpCode !== 200) {
    $msg = $data['error']['message'] ?? ('HTTP ' . $httpCode);
    json_response(['error' => $msg], 502);
}

$reply = trim((string) ($data['choices'][0]['message']['content'] ?? ''));
if ($reply === '') {
    json_response(['error' => 'Empty reply from model'], 502);
}

json_response(['reply' => $reply]);
