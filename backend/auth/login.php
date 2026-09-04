<?php
/**
 * Login API Handler
 * Handles authentication for Volunteers, Organizations, and Admins
 */

require_once __DIR__ . '/../config/database.php';

// Method check
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    handleLogin();
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
 * Main login handler
 */
function handleLogin() {
    global $conn;
    
    try {
        // Read input (support JSON body or standard form POST)
        $rawInput = file_get_contents("php://input");
        $input = json_decode($rawInput, true);
        if (!$input && !empty($_POST)) {
            $input = $_POST;
        }
        
        // Validate presence of credentials
        if (!isset($input['email']) || !isset($input['password']) || trim($input['email']) === '' || trim($input['password']) === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Email and password are required'
            ]);
            return;
        }
        
        $email = sanitize($conn, $input['email']);
        $password = (string)$input['password'];
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid email format'
            ]);
            return;
        }
        
        // Authenticate user across user tables
        $authResult = authenticateUser($conn, $email, $password);
        
        if ($authResult['success']) {
            $user = $authResult['user'];
            
            // Set session variables
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_email'] = $user['email'];
            $_SESSION['user_name'] = $user['name'];
            $_SESSION['user_role'] = $user['role'];
            $_SESSION['user_status'] = $user['status'];
            $_SESSION['login_time'] = time();
            
            // Generate JWT token
            $token = generateJWT($user['id'], $user['role']);
            $redirect = getDashboardURL($user['role']);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => $user,
                'token' => $token,
                'redirect' => $redirect
            ]);
        } else {
            // Log failed attempt safely
            logFailedLogin($conn, $email);
            
            $code = isset($authResult['code']) ? $authResult['code'] : 401;
            http_response_code($code);
            echo json_encode([
                'success' => false,
                'message' => $authResult['message']
            ]);
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Server error during authentication',
            'error' => $e->getMessage()
        ]);
    }
}

/**
 * Authenticate user across user tables (admins, organizations, volunteers)
 * Returns structured array with user data or error details
 */
function authenticateUser($conn, $email, $password) {
    if (!$conn) {
        return [
            'success' => false,
            'code' => 500,
            'message' => 'Database connection unavailable'
        ];
    }
    
    // Priority order: admins, organizations, volunteers
    $tables = [
        'admins' => 'admin',
        'organizations' => 'organization',
        'volunteers' => 'volunteer'
    ];
    
    foreach ($tables as $table => $role) {
        $query = "SELECT * FROM `$table` WHERE `email` = ? LIMIT 1";
        $stmt = $conn->prepare($query);
        
        if (!$stmt) {
            continue;
        }
        
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result && $result->num_rows > 0) {
            $user = $result->fetch_assoc();
            $stmt->close();
            
            // Verify password
            $isValidPassword = verifyPassword($password, $user['password']);
            
            if (!$isValidPassword) {
                return [
                    'success' => false,
                    'code' => 401,
                    'message' => 'Invalid email or password'
                ];
            }
            
            // If stored password was plaintext, automatically upgrade to bcrypt hash
            if ($password === $user['password']) {
                $upgradedHash = hashPassword($password);
                $updateStmt = $conn->prepare("UPDATE `$table` SET `password` = ? WHERE `id` = ?");
                if ($updateStmt) {
                    $updateStmt->bind_param("si", $upgradedHash, $user['id']);
                    $updateStmt->execute();
                    $updateStmt->close();
                }
            }
            
            // Check account status
            $status = strtolower($user['status'] ?? 'active');
            
            if ($status === 'pending') {
                return [
                    'success' => false,
                    'code' => 403,
                    'message' => 'Your account is currently pending administrator verification. Please check back soon.'
                ];
            }
            
            if ($status === 'suspended') {
                return [
                    'success' => false,
                    'code' => 403,
                    'message' => 'Your account has been suspended. Please contact support.'
                ];
            }
            
            if ($status !== 'active') {
                return [
                    'success' => false,
                    'code' => 403,
                    'message' => 'Your account is inactive. Please contact an administrator.'
                ];
            }
            
            // Update last login timestamp safely
            updateLastLogin($conn, $table, $user['id']);
            
            // Format sanitized user object for frontend
            unset($user['password']);
            $user['role'] = $role;
            $user['status'] = $status;
            
            return [
                'success' => true,
                'user' => $user
            ];
        }
        
        $stmt->close();
    }
    
    return [
        'success' => false,
        'code' => 401,
        'message' => 'Invalid email or password'
    ];
}

/**
 * Update last login timestamp safely
 */
function updateLastLogin($conn, $table, $userId) {
    if (!$conn) return;
    try {
        $stmt = $conn->prepare("UPDATE `$table` SET `last_login` = NOW() WHERE `id` = ?");
        if ($stmt) {
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $stmt->close();
        }
    } catch (Throwable $e) {
        // Non-critical, do not block login
        error_log("Failed to update last_login for $table id $userId: " . $e->getMessage());
    }
}

/**
 * Log failed login attempts safely
 */
function logFailedLogin($conn, $email) {
    if (!$conn) return;
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $stmt = $conn->prepare("INSERT INTO `login_attempts` (`email`, `attempt_time`, `status`, `ip_address`) VALUES (?, NOW(), 'failed', ?)");
        if ($stmt) {
            $stmt->bind_param("ss", $email, $ip);
            $stmt->execute();
            $stmt->close();
        }
    } catch (Throwable $e) {
        // Non-critical, ignore if login_attempts table is unavailable
        error_log("Failed to log login attempt: " . $e->getMessage());
    }
}

/**
 * Helper for Base64URL encoding (RFC 7519 standard)
 */
if (!function_exists('base64url_encode')) {
    function base64url_encode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

/**
 * Generate standard URL-safe JWT token
 */
function generateJWT($userId, $role) {
    $secret = defined('JWT_SECRET') ? JWT_SECRET : 'volunteerconnect_jwt_secret_2026';
    
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + (86400 * 7) // 7 days expiration
    ]);
    
    $encodedHeader = base64url_encode($header);
    $encodedPayload = base64url_encode($payload);
    
    $signature = hash_hmac('SHA256', "$encodedHeader.$encodedPayload", $secret, true);
    $encodedSignature = base64url_encode($signature);
    
    return "$encodedHeader.$encodedPayload.$encodedSignature";
}

/**
 * Get dashboard URL/route identifier based on user role
 */
function getDashboardURL($role) {
    $dashboards = [
        'volunteer' => 'volunteer-dashboard',
        'organization' => 'org-dashboard',
        'admin' => 'admin-dashboard'
    ];
    
    return isset($dashboards[$role]) ? $dashboards[$role] : 'volunteer-dashboard';
}
?>
