<?php
/**
 * Authentication Middleware
 * Handles permission checks and authentication verification
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Check if user is logged in
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

/**
 * Check if user has specific role
 */
function hasRole($required_role) {
    if (!isLoggedIn()) {
        return false;
    }
    
    return $_SESSION['user_role'] === $required_role;
}

/**
 * Check if user is volunteer
 */
function isVolunteer() {
    return hasRole('volunteer');
}

/**
 * Check if user is organization
 */
function isOrganization() {
    return hasRole('organization');
}

/**
 * Check if user is admin
 */
function isAdmin() {
    return hasRole('admin');
}

/**
 * Get current user ID
 */
function getCurrentUserId() {
    return isLoggedIn() ? $_SESSION['user_id'] : null;
}

/**
 * Get current user role
 */
function getCurrentUserRole() {
    return isLoggedIn() ? $_SESSION['user_role'] : null;
}

/**
 * Get current user data
 */
function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }
    
    return [
        'id' => $_SESSION['user_id'],
        'email' => $_SESSION['user_email'],
        'name' => $_SESSION['user_name'],
        'role' => $_SESSION['user_role'],
        'status' => $_SESSION['user_status']
    ];
}

/**
 * Redirect to login if not authenticated
 */
function requireLogin() {
    if (!isLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized. Please log in.',
            'redirect' => 'pages/login.html'
        ]);
        exit();
    }
}

/**
 * Require specific role
 */
function requireRole($role) {
    requireLogin();
    
    if ($_SESSION['user_role'] !== $role) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => "Access denied. This section is for $role only."
        ]);
        exit();
    }
}

/**
 * Require one of multiple roles
 */
function requireRoles($roles) {
    requireLogin();
    
    if (!in_array($_SESSION['user_role'], $roles)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Access denied. Insufficient permissions.'
        ]);
        exit();
    }
}

/**
 * Verify JWT token
 */
function verifyJWT($token) {
    $parts = explode('.', $token);
    
    if (count($parts) !== 3) {
        return false;
    }
    
    $header = base64url_decode($parts[0]);
    $payload = base64url_decode($parts[1]);
    $signature = $parts[2];
    
    // Verify signature
    $secret = defined('JWT_SECRET') ? JWT_SECRET : 'volunteerconnect_jwt_secret_2026';
    $expected_signature = base64url_encode(
        hash_hmac('SHA256', "$parts[0].$parts[1]", $secret, true)
    );
    
    if ($signature !== $expected_signature) {
        return false;
    }
    
    // Decode payload
    $payload_data = json_decode($payload, true);
    
    // Check expiration
    if (isset($payload_data['exp']) && $payload_data['exp'] < time()) {
        return false;
    }
    
    return $payload_data;
}

/**
 * Get user by ID and role
 */
function getUserData($conn, $user_id, $role) {
    $table = getTableByRole($role);
    
    $query = "SELECT id, name, email, status FROM $table WHERE id = ?";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return null;
    }
    
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result && $result->num_rows > 0) {
        $user = $result->fetch_assoc();
        $user['role'] = $role;
        $stmt->close();
        return $user;
    }
    
    $stmt->close();
    return null;
}

/**
 * Get table name by role
 */
function getTableByRole($role) {
    $tables = [
        'volunteer' => 'volunteers',
        'organization' => 'organizations',
        'admin' => 'admins'
    ];
    
    return isset($tables[$role]) ? $tables[$role] : null;
}

/**
 * Check if user account is active
 */
function isUserActive($conn, $user_id, $role) {
    $table = getTableByRole($role);
    
    $query = "SELECT status FROM $table WHERE id = ? LIMIT 1";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return false;
    }
    
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result && $result->num_rows > 0) {
        $user = $result->fetch_assoc();
        $stmt->close();
        return $user['status'] === 'active';
    }
    
    $stmt->close();
    return false;
}

/**
 * Log user session
 */
function logUserSession($conn, $user_id, $role, $action = 'login') {
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '';
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    $query = "INSERT INTO user_sessions (user_id, user_role, action, ip_address, user_agent, created_at) 
              VALUES (?, ?, ?, ?, ?, NOW())";
    
    $stmt = $conn->prepare($query);
    
    if ($stmt) {
        $stmt->bind_param("issss", $user_id, $role, $action, $ip_address, $user_agent);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * Validate CSRF token
 */
function validateCSRFToken($token) {
    if (!isset($_SESSION['csrf_token'])) {
        return false;
    }
    
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    return $_SESSION['csrf_token'];
}

?>
