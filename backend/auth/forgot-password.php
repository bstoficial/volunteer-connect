<?php
/**
 * Password reset request handler.
 * Creates a single-use, time-limited reset token for a matching account.
 */

require_once __DIR__ . '/../config/database.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method Not Allowed. POST is required.'], 405);
}

$input = requestData();
$email = trim((string)($input['email'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Please provide a valid email address.'], 400);
}

$accounts = [
    'volunteers' => 'volunteer',
    'organizations' => 'organization',
    'admins' => 'admin'
];
$account = null;
$table = null;

foreach ($accounts as $candidateTable => $role) {
    $stmt = $conn->prepare("SELECT id, email FROM `$candidateTable` WHERE email = ? LIMIT 1");
    if (!$stmt) {
        continue;
    }
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result && ($account = $result->fetch_assoc())) {
        $table = $candidateTable;
        $account['role'] = $role;
        $stmt->close();
        break;
    }
    $stmt->close();
}

// Keep the response identical for unknown emails to avoid account enumeration.
if (!$account) {
    jsonResponse(['success' => true, 'message' => 'If that email is registered, a password reset link has been created.']);
}

$rawToken = bin2hex(random_bytes(32));
$tokenHash = hash('sha256', $rawToken);
$expiresAt = date('Y-m-d H:i:s', time() + 3600);

$stmt = $conn->prepare("UPDATE `$table` SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?");
if (!$stmt) {
    jsonResponse(['success' => false, 'message' => 'Could not create a password reset request.'], 500);
}
$stmt->bind_param('ssi', $tokenHash, $expiresAt, $account['id']);
$updated = $stmt->execute();
$stmt->close();

if (!$updated) {
    jsonResponse(['success' => false, 'message' => 'Could not create a password reset request.'], 500);
}

$basePath = rtrim(dirname(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? ''))), '/\\');
$resetUrl = $basePath . '/pages/reset-password.html?token=' . urlencode($rawToken) . '&email=' . urlencode($account['email']);
$response = [
    'success' => true,
    'message' => 'If that email is registered, a password reset link has been sent.'
];

// Never expose the raw token outside local development. Production should send this URL by SMTP.
$host = strtolower((string)($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? ''));
if (in_array($host, ['localhost', '127.0.0.1'], true)) {
    $response['message'] = 'Password reset link created for local testing.';
    $response['reset_link'] = $resetUrl;
    $response['expires_at'] = $expiresAt;
}

jsonResponse($response);