<?php
/**
 * Logout API Handler
 * Handles user session termination
 */

require_once __DIR__ . '/../config/database.php';

// Get request method
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    handleLogout();
} elseif ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method Not Allowed. POST is required.'
    ]);
    exit();
}

/**
 * Main logout handler
 */
function handleLogout() {
    global $conn;
    
    // Check if user is logged in
    $userId = $_SESSION['user_id'] ?? null;
    $userRole = $_SESSION['user_role'] ?? 'guest';
    
    if ($userId) {
        // Log logout activity safely
        logUserActivity($conn, $userId, $userRole, 'logout');
    }
    
    // Clear session variables
    $_SESSION = array();
    
    // Destroy session
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    
    // Delete session cookie
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Logout successful',
        'redirect' => 'home'
    ]);
}

/**
 * Log user activity safely
 */
function logUserActivity($conn, $userId, $userRole, $activity) {
    if (!$conn) return;
    try {
        $query = "INSERT INTO `activity_logs` (`user_id`, `user_role`, `activity`, `timestamp`) VALUES (?, ?, ?, NOW())";
        $stmt = $conn->prepare($query);
        if ($stmt) {
            $stmt->bind_param("iss", $userId, $userRole, $activity);
            $stmt->execute();
            $stmt->close();
        }
    } catch (Throwable $e) {
        error_log("Failed to log activity: " . $e->getMessage());
    }
}
?>
