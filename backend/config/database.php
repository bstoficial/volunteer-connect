<?php
/**
 * Database Configuration & Connection Manager
 * Handles database connection, auto-initialization, CORS, and security helpers.
 */

// 1. Send CORS and JSON Headers immediately before any output
if (!headers_sent()) {
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = [
        'null',
        'http://localhost',
        'http://127.0.0.1',
        'https://localhost',
        'https://127.0.0.1'
    ];
    if (in_array($requestOrigin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $requestOrigin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Content-Type: application/json; charset=UTF-8');
}

// 2. Handle HTTP OPTIONS preflight request immediately
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 3. Start Session securely if not started
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

// 4. Database & Auth credentials
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');
if (!defined('DB_NAME')) define('DB_NAME', 'volunteerconnect');
if (!defined('JWT_SECRET')) define('JWT_SECRET', 'volunteerconnect_jwt_secret_2026');

// 5. Connect and auto-initialize database
$conn = null;

try {
    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS);

    if ($conn->connect_error) {
        throw new Exception($conn->connect_error);
    }

    $conn->set_charset("utf8mb4");

    $dbCreateQuery = "CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    if (!$conn->query($dbCreateQuery)) {
        throw new Exception("Failed to verify/create database: " . $conn->error);
    }

    if (!$conn->select_db(DB_NAME)) {
        throw new Exception("Could not select database " . DB_NAME . ": " . $conn->error);
    }

    ensureTablesExist($conn);
    migrateApplicationTables($conn);
    removeDemoData($conn);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed. Please ensure MySQL is running in XAMPP.',
        'error' => $e->getMessage()
    ]);
    exit();
}

/**
 * Automatically create tables and seed default data if missing
 */
function ensureTablesExist($conn) {
    $check = $conn->query("SHOW TABLES LIKE 'volunteers'");
    if ($check && $check->num_rows > 0) {
        return;
    }

    $schemaFile = __DIR__ . '/../../database/volunteerconnect.sql';
    if (file_exists($schemaFile)) {
        $sql = file_get_contents($schemaFile);
        if (!empty($sql)) {
            $conn->multi_query($sql);
            while ($conn->more_results() && $conn->next_result()) {
                if ($res = $conn->store_result()) {
                    $res->free();
                }
            }
        }
    }
}

/**
 * Add tables and columns introduced after the original database install.
 */
function migrateApplicationTables($conn) {
    foreach (['volunteers', 'organizations', 'admins'] as $profileTable) {
        $columns = [];
        $result = $conn->query("SHOW COLUMNS FROM $profileTable");
        if ($result) {
            while ($column = $result->fetch_assoc()) $columns[$column['Field']] = true;
        }
        if (!isset($columns['profile_image'])) {
            $conn->query("ALTER TABLE $profileTable ADD COLUMN profile_image VARCHAR(255) NULL");
        }
        if (!isset($columns['reset_token'])) {
            $conn->query("ALTER TABLE $profileTable ADD COLUMN reset_token CHAR(64) NULL");
        }
        if (!isset($columns['reset_token_expires_at'])) {
            $conn->query("ALTER TABLE $profileTable ADD COLUMN reset_token_expires_at TIMESTAMP NULL");
        }
    }

    $conn->query("CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('unread','read') NOT NULL DEFAULT 'unread',
        review_status ENUM('pending','verified','fraud') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_contact_messages_status (status),
        INDEX idx_contact_messages_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $conn->query("ALTER TABLE contact_messages ADD COLUMN review_status ENUM('pending','verified','fraud') NOT NULL DEFAULT 'pending'");

    $opportunities = $conn->query("SHOW TABLES LIKE 'opportunities'");
    if (!$opportunities || $opportunities->num_rows === 0) {
        $schemaFile = __DIR__ . '/../../database/volunteerconnect.sql';
        if (file_exists($schemaFile)) {
            $sql = file_get_contents($schemaFile);
            if ($sql && $conn->multi_query($sql)) {
                while ($conn->more_results() && $conn->next_result()) {
                    if ($res = $conn->store_result()) $res->free();
                }
            }
        }
        return;
    }

    $columns = [];
    $result = $conn->query("SHOW COLUMNS FROM opportunities");
    if ($result) {
        while ($column = $result->fetch_assoc()) $columns[$column['Field']] = true;
    }
    if (!isset($columns['spots_needed']) && isset($columns['spots'])) {
        $conn->query("ALTER TABLE opportunities CHANGE COLUMN spots spots_needed INT NOT NULL DEFAULT 10");
    }
    if (!isset($columns['spots_filled'])) {
        $conn->query("ALTER TABLE opportunities ADD COLUMN spots_filled INT NOT NULL DEFAULT 0 AFTER spots_needed");
    }
    if (!isset($columns['opportunity_image'])) {
        $conn->query("ALTER TABLE opportunities ADD COLUMN opportunity_image VARCHAR(255) NULL AFTER description");
    }
    if (!isset($columns['map_url'])) {
        $conn->query("ALTER TABLE opportunities ADD COLUMN map_url VARCHAR(500) NULL AFTER opportunity_image");
    }
    if (!isset($columns['contact_phone'])) {
        $conn->query("ALTER TABLE opportunities ADD COLUMN contact_phone VARCHAR(50) NULL AFTER map_url");
    }
    if (!isset($columns['contact_email'])) {
        $conn->query("ALTER TABLE opportunities ADD COLUMN contact_email VARCHAR(255) NULL AFTER contact_phone");
    }
    $conn->query("ALTER TABLE opportunities MODIFY COLUMN status ENUM('pending','active','closed','rejected','draft') NOT NULL DEFAULT 'pending'");

    $applications = $conn->query("SHOW TABLES LIKE 'applications'");
    if ($applications && $applications->num_rows > 0) {
        $applicationColumns = [];
        $result = $conn->query("SHOW COLUMNS FROM applications");
        if ($result) {
            while ($column = $result->fetch_assoc()) $applicationColumns[$column['Field']] = true;
        }
        if (!isset($applicationColumns['message'])) {
            $conn->query("ALTER TABLE applications ADD COLUMN message TEXT NULL AFTER status");
        }
    }

    $conn->query("CREATE TABLE IF NOT EXISTS opportunity_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opportunity_id INT NOT NULL,
        organization_id INT NOT NULL,
        volunteer_id INT NOT NULL,
        rating TINYINT NOT NULL,
        review TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_opportunity_review (opportunity_id, volunteer_id),
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

/**
 * Remove fixture accounts from databases created by older schema versions.
 */
function removeDemoData($conn) {
    $demoOrganizations = "'david@hoperising.org','org@demo.com','marcus@greenearth.org','pending@ngo.org','hoperising@volunteerconnect.org','greenearth@volunteerconnect.org','pending@volunteerconnect.org'";
    $demoVolunteers = "'sarah@example.com','volunteer@demo.com','priya@example.com','tom@example.com','volunteer@volunteerconnect.org'";
    $conn->query("DELETE FROM organizations WHERE email IN ($demoOrganizations)");
    $conn->query("DELETE FROM volunteers WHERE email IN ($demoVolunteers)");
}

/**
 * Send JSON response and exit
 */
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

/**
 * Get request data (JSON body or POST)
 */
function requestData() {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) return $decoded;
    }
    return $_POST;
}

/**
 * Get the current logged-in user from session
 */
function currentUser() {
    if (!empty($_SESSION['user_id'])) {
        return [
            'id'    => $_SESSION['user_id'],
            'name'  => $_SESSION['user_name'] ?? '',
            'email' => $_SESSION['user_email'] ?? '',
            'role'  => $_SESSION['user_role'] ?? '',
        ];
    }
    return null;
}

/**
 * Require user to be logged in
 */
function requireLogin() {
    if (!currentUser()) {
        jsonResponse(['success' => false, 'message' => 'Authentication required.'], 401);
    }
}

/**
 * Require user to have a specific role
 */
function requireRole($role) {
    $user = currentUser();
    if (!$user) {
        jsonResponse(['success' => false, 'message' => 'Authentication required.'], 401);
    }
    if ($user['role'] !== $role) {
        jsonResponse(['success' => false, 'message' => 'Access denied.'], 403);
    }
}

/**
 * Log an activity
 */
function audit($conn, $activity, $description = '') {
    $user = currentUser();
    if (!$user) return;
    $uid  = (int)$user['id'];
    $role = $user['role'];
    $stmt = $conn->prepare("INSERT INTO activity_logs(user_id,user_role,activity,description) VALUES(?,?,?,?)");
    if ($stmt) {
        $stmt->bind_param('isss', $uid, $role, $activity, $description);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * Sanitize input
 */
function sanitize($conn, $data) {
    if ($data === null) return '';
    $data = trim((string)$data);
    $data = strip_tags($data);
    return $conn ? $conn->real_escape_string($data) : addslashes($data);
}

/**
 * Hash password using bcrypt
 */
function hashPassword($password) {
    return password_hash($password, PASSWORD_BCRYPT);
}

/**
 * Verify password (supports bcrypt)
 */
function verifyPassword($password, $hash) {
    if (empty($password) || empty($hash)) return false;
    return password_verify($password, $hash);
}
?>
