<?php
/**
 * Password reset handler.
 * Validates a single-use token and replaces the account password.
 */

require_once __DIR__ . '/../config/database.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method Not Allowed. POST is required.'], 405);
}

$input = requestData();
$email = trim((string)($input['email'] ?? ''));
$token = trim((string)($input['token'] ?? ''));
$password = (string)($input['password'] ?? '');
$confirmPassword = (string)($input['confirm_password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $token === '') {
    jsonResponse(['success' => false, 'message' => 'A valid email and reset token are required.'], 400);
}
if (strlen($password) < 8) {
    jsonResponse(['success' => false, 'message' => 'Password must be at least 8 characters long.'], 400);
}
if ($password !== $confirmPassword) {
    jsonResponse(['success' => false, 'message' => 'Passwords do not match.'], 400);
}

$tokenHash = hash('sha256', $token);
$accounts = ['volunteers', 'organizations', 'admins'];
$account = null;
$table = null;

foreach ($accounts as $candidateTable) {
    $stmt = $conn->prepare("SELECT id FROM `$candidateTable` WHERE email = ? AND reset_token = ? AND reset_token_expires_at > NOW() LIMIT 1");
    if (!$stmt) {
        continue;
    }
    $stmt->bind_param('ss', $email, $tokenHash);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result && ($account = $result->fetch_assoc())) {
        $table = $candidateTable;
        $stmt->close();
        break;
    }
    $stmt->close();
}

if (!$account) {
    jsonResponse(['success' => false, 'message' => 'The reset token is invalid or has expired.'], 400);
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("UPDATE `$table` SET password = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ? AND reset_token = ? AND reset_token_expires_at > NOW()");
if (!$stmt) {
    jsonResponse(['success' => false, 'message' => 'Could not reset the password.'], 500);
}
$stmt->bind_param('sis', $passwordHash, $account['id'], $tokenHash);
$updated = $stmt->execute() && $stmt->affected_rows === 1;
$stmt->close();

if (!$updated) {
    jsonResponse(['success' => false, 'message' => 'The reset token is invalid or has expired.'], 400);
}

jsonResponse(['success' => true, 'message' => 'Password reset successful. You can now log in.']);