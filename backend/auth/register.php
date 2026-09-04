<?php
/**
 * Registration API Handler
 * Handles account creation for Volunteers, Organizations, and Admins
 */

require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    handleRegister();
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
 * Main registration handler
 */
function handleRegister() {
    global $conn;
    
    // Get JSON input
    $input = json_decode(file_get_contents("php://input"), true);
    
    // Validate required fields
    $required = ['name', 'email', 'password', 'confirm_password', 'role'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => ucfirst(str_replace('_', ' ', $field)) . ' is required'
            ]);
            return;
        }
    }
    
    // Sanitize inputs
    $name = sanitize($conn, $input['name']);
    $email = sanitize($conn, $input['email']);
    $password = $input['password'];
    $confirm_password = $input['confirm_password'];
    $role = sanitize($conn, $input['role']);
    
    // Validate role
    if (!in_array($role, ['volunteer', 'organization'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid role. Must be volunteer or organization'
        ]);
        return;
    }
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid email format'
        ]);
        return;
    }
    
    // Validate password
    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Password must be at least 8 characters long'
        ]);
        return;
    }
    
    // Validate password match
    if ($password !== $confirm_password) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Passwords do not match'
        ]);
        return;
    }
    
    // Check if email already exists
    if (emailExists($conn, $email)) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'Email already registered'
        ]);
        return;
    }
    
    // Hash password
    $hashed_password = hashPassword($password);
    
    // Register user based on role
    if ($role === 'volunteer') {
        $result = registerVolunteer($conn, $name, $email, $hashed_password);
    } else {
        $result = registerOrganization($conn, $name, $email, $hashed_password);
    }
    
    if ($result) {
        // Send verification email (optional)
        // sendVerificationEmail($email, $name);
        
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Account created successfully. Please log in.',
            'role' => $role,
            'redirect' => 'pages/login.html'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error creating account. Please try again.'
        ]);
    }
}

/**
 * Register a new volunteer
 */
function registerVolunteer($conn, $name, $email, $hashed_password) {
    // Additional volunteer fields from input
    $input = json_decode(file_get_contents("php://input"), true);
    
    $location = isset($input['location']) ? sanitize($conn, $input['location']) : '';
    $skills = isset($input['skills']) ? sanitize($conn, $input['skills']) : '';
    $bio = isset($input['bio']) ? sanitize($conn, $input['bio']) : '';
    
    $query = "INSERT INTO volunteers (name, email, password, location, skills, bio, status, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())";
    
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        error_log('Prepare failed: ' . $conn->error);
        return false;
    }
    
    $stmt->bind_param("ssssss", $name, $email, $hashed_password, $location, $skills, $bio);
    
    if ($stmt->execute()) {
        $volunteer_id = $conn->insert_id;
        
        // Create initial volunteer profile
        createVolunteerProfile($conn, $volunteer_id, $name);
        
        $stmt->close();
        return true;
    } else {
        error_log('Execute failed: ' . $stmt->error);
        $stmt->close();
        return false;
    }
}

/**
 * Register a new organization
 */
function registerOrganization($conn, $name, $email, $hashed_password) {
    // Additional organization fields from input
    $input = json_decode(file_get_contents("php://input"), true);
    
    $phone = isset($input['phone']) ? sanitize($conn, $input['phone']) : '';
    $address = isset($input['address']) ? sanitize($conn, $input['address']) : '';
    $description = isset($input['description']) ? sanitize($conn, $input['description']) : '';
    $category = isset($input['category']) ? sanitize($conn, $input['category']) : 'General';
    
    $query = "INSERT INTO organizations (name, email, password, phone, address, description, category, status, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())";
    
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        error_log('Prepare failed: ' . $conn->error);
        return false;
    }
    
    $stmt->bind_param("sssssss", $name, $email, $hashed_password, $phone, $address, $description, $category);
    
    if ($stmt->execute()) {
        $org_id = $conn->insert_id;
        
        // Create initial organization profile
        createOrganizationProfile($conn, $org_id, $name);
        
        // Send verification email to admin
        sendAdminNotification($conn, $name, $email, 'organization');
        
        $stmt->close();
        return true;
    } else {
        error_log('Execute failed: ' . $stmt->error);
        $stmt->close();
        return false;
    }
}

/**
 * Check if email already exists in any table
 */
function emailExists($conn, $email) {
    $tables = ['volunteers', 'organizations', 'admins'];
    
    foreach ($tables as $table) {
        $query = "SELECT id FROM $table WHERE email = ?";
        $stmt = $conn->prepare($query);
        
        if ($stmt) {
            $stmt->bind_param("s", $email);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $stmt->close();
                return true;
            }
            
            $stmt->close();
        }
    }
    
    return false;
}

/**
 * Create volunteer profile record
 */
function createVolunteerProfile($conn, $volunteer_id, $name) {
    $query = "INSERT INTO volunteer_profiles (volunteer_id, name, rating, profile_completeness) 
              VALUES (?, ?, 0, 20)";
    
    $stmt = $conn->prepare($query);
    if ($stmt) {
        $stmt->bind_param("is", $volunteer_id, $name);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * Create organization profile record
 */
function createOrganizationProfile($conn, $org_id, $name) {
    $query = "INSERT INTO organization_profiles (organization_id, org_name, rating, profile_completeness) 
              VALUES (?, ?, 0, 20)";
    
    $stmt = $conn->prepare($query);
    if ($stmt) {
        $stmt->bind_param("is", $org_id, $name);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * Send notification to admin about new organization registration
 */
function sendAdminNotification($conn, $org_name, $org_email, $type) {
    // This would send an email to admin
    // For now, we'll just log it
    error_log("New $type registration: $org_name ($org_email)");
    
    // You can implement actual email sending here using PHPMailer or similar
}

/**
 * Send verification email (optional implementation)
 */
function sendVerificationEmail($email, $name) {
    // Implementation for sending verification emails
    // You can use PHPMailer or mail() function
    
    /*
    $to = $email;
    $subject = "Verify your VolunteerConnect account";
    $message = "Hello $name,\n\nPlease verify your email to activate your account.";
    $headers = "From: noreply@volunteerconnect.org";
    
    mail($to, $subject, $message, $headers);
    */
}

?>
