<?php
/**
 * Authentication Utilities
 * Additional helper functions for authentication and authorization
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Get user permissions based on role
 */
function getUserPermissions($role) {
    $permissions = [
        'volunteer' => [
            'view_opportunities' => true,
            'apply_opportunity' => true,
            'edit_profile' => true,
            'view_applications' => true,
            'view_dashboard' => true,
            'create_opportunity' => false,
            'manage_volunteers' => false,
            'manage_users' => false,
            'view_analytics' => false,
            'verify_organizations' => false,
            'generate_reports' => false
        ],
        'organization' => [
            'view_opportunities' => false,
            'apply_opportunity' => false,
            'edit_profile' => true,
            'view_applications' => false,
            'view_dashboard' => true,
            'create_opportunity' => true,
            'manage_opportunities' => true,
            'manage_volunteers' => true,
            'manage_users' => false,
            'view_analytics' => true,
            'verify_organizations' => false,
            'generate_reports' => true
        ],
        'admin' => [
            'view_opportunities' => true,
            'apply_opportunity' => false,
            'edit_profile' => true,
            'view_applications' => true,
            'view_dashboard' => true,
            'create_opportunity' => true,
            'manage_opportunities' => true,
            'manage_volunteers' => true,
            'manage_users' => true,
            'manage_organizations' => true,
            'view_analytics' => true,
            'verify_organizations' => true,
            'generate_reports' => true
        ]
    ];
    
    return isset($permissions[$role]) ? $permissions[$role] : [];
}

/**
 * Check if user has specific permission
 */
function hasPermission($role, $permission) {
    $permissions = getUserPermissions($role);
    return isset($permissions[$permission]) ? $permissions[$permission] : false;
}

/**
 * Validate user account status
 */
function validateUserStatus($conn, $user_id, $role) {
    $table = getTableByRole($role);
    
    if (!$table) {
        return false;
    }
    
    $query = "SELECT status, email_verified FROM $table WHERE id = ? LIMIT 1";
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
        
        // Check status
        if ($user['status'] !== 'active') {
            return [
                'valid' => false,
                'reason' => 'Account is ' . $user['status']
            ];
        }
        
        // For organizations, check if verified
        if ($role === 'organization' && !$user['email_verified']) {
            return [
                'valid' => false,
                'reason' => 'Account pending verification'
            ];
        }
        
        return [
            'valid' => true,
            'reason' => 'Account is valid'
        ];
    }
    
    $stmt->close();
    return false;
}

/**
 * Get complete user profile data
 */
function getUserProfile($conn, $user_id, $role) {
    $table = getTableByRole($role);
    
    if (!$table) {
        return null;
    }
    
    $query = "SELECT * FROM $table WHERE id = ? LIMIT 1";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return null;
    }
    
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result && $result->num_rows > 0) {
        $user = $result->fetch_assoc();
        $stmt->close();
        
        // Remove password from response
        unset($user['password']);
        
        // Add role and permissions
        $user['role'] = $role;
        $user['permissions'] = getUserPermissions($role);
        
        // Add profile-specific data
        if ($role === 'volunteer') {
            $user['profile'] = getVolunteerProfileData($conn, $user_id);
        } elseif ($role === 'organization') {
            $user['profile'] = getOrganizationProfileData($conn, $user_id);
        }
        
        return $user;
    }
    
    $stmt->close();
    return null;
}

/**
 * Get volunteer profile data
 */
function getVolunteerProfileData($conn, $volunteer_id) {
    $query = "SELECT * FROM volunteer_profiles WHERE volunteer_id = ? LIMIT 1";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return null;
    }
    
    $stmt->bind_param("i", $volunteer_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result && $result->num_rows > 0) {
        $profile = $result->fetch_assoc();
        $stmt->close();
        return $profile;
    }
    
    $stmt->close();
    return null;
}

/**
 * Get organization profile data
 */
function getOrganizationProfileData($conn, $org_id) {
    $query = "SELECT * FROM organization_profiles WHERE organization_id = ? LIMIT 1";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return null;
    }
    
    $stmt->bind_param("i", $org_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result && $result->num_rows > 0) {
        $profile = $result->fetch_assoc();
        $stmt->close();
        return $profile;
    }
    
    $stmt->close();
    return null;
}

/**
 * Update user last activity
 */
function updateLastActivity($conn, $user_id, $role) {
    $table = getTableByRole($role);
    
    if (!$table) {
        return false;
    }
    
    $query = "UPDATE $table SET last_login = NOW() WHERE id = ?";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return false;
    }
    
    $stmt->bind_param("i", $user_id);
    $result = $stmt->execute();
    $stmt->close();
    
    return $result;
}

/**
 * Verify email address
 */
function verifyEmail($conn, $email) {
    $tables = ['volunteers', 'organizations', 'admins'];
    
    foreach ($tables as $table) {
        $query = "UPDATE $table SET email_verified = 1 WHERE email = ?";
        $stmt = $conn->prepare($query);
        
        if ($stmt) {
            $stmt->bind_param("s", $email);
            $stmt->execute();
            $stmt->close();
            return true;
        }
    }
    
    return false;
}

/**
 * Suspend user account
 */
function suspendUserAccount($conn, $user_id, $role, $reason = null) {
    $table = getTableByRole($role);
    
    if (!$table) {
        return false;
    }
    
    $query = "UPDATE $table SET status = 'suspended' WHERE id = ?";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return false;
    }
    
    $stmt->bind_param("i", $user_id);
    $result = $stmt->execute();
    $stmt->close();
    
    // Log the suspension
    if ($result && $reason) {
        logAdminAction($conn, $user_id, $role, 'suspend', $reason);
    }
    
    return $result;
}

/**
 * Reactivate user account
 */
function reactivateUserAccount($conn, $user_id, $role) {
    $table = getTableByRole($role);
    
    if (!$table) {
        return false;
    }
    
    $query = "UPDATE $table SET status = 'active' WHERE id = ?";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return false;
    }
    
    $stmt->bind_param("i", $user_id);
    $result = $stmt->execute();
    $stmt->close();
    
    return $result;
}

/**
 * Get user's account summary
 */
function getUserAccountSummary($conn, $user_id, $role) {
    $user = getUserProfile($conn, $user_id, $role);
    
    if (!$user) {
        return null;
    }
    
    $summary = [
        'id' => $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'status' => $user['status'],
        'joined' => $user['created_at'],
        'last_login' => $user['last_login'] ?? 'Never',
        'profile_complete' => isset($user['profile']['profile_completeness']) 
                            ? $user['profile']['profile_completeness'] 
                            : 0
    ];
    
    if ($role === 'volunteer' && isset($user['profile'])) {
        $summary['hours_logged'] = $user['profile']['total_hours'] ?? 0;
        $summary['applications'] = $user['profile']['total_applications'] ?? 0;
        $summary['rating'] = $user['profile']['rating'] ?? 0;
    } elseif ($role === 'organization' && isset($user['profile'])) {
        $summary['opportunities'] = $user['profile']['total_opportunities'] ?? 0;
        $summary['volunteers'] = $user['profile']['total_volunteers'] ?? 0;
        $summary['rating'] = $user['profile']['rating'] ?? 0;
    }
    
    return $summary;
}

/**
 * Log admin actions
 */
function logAdminAction($conn, $target_user_id, $target_role, $action, $details = null) {
    $admin_id = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
    
    if (!$admin_id) {
        return false;
    }
    
    $query = "INSERT INTO activity_logs (user_id, user_role, activity, description, timestamp) 
              VALUES (?, ?, ?, ?, NOW())";
    
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return false;
    }
    
    $activity = "admin_action: $action on $target_role ($target_user_id)";
    
    $stmt->bind_param("isss", $admin_id, $_SESSION['user_role'], $activity, $details);
    $result = $stmt->execute();
    $stmt->close();
    
    return $result;
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
 * Validate password strength
 */
function validatePasswordStrength($password) {
    $strength = [
        'score' => 0,
        'feedback' => []
    ];
    
    if (strlen($password) >= 8) {
        $strength['score']++;
    } else {
        $strength['feedback'][] = 'Password should be at least 8 characters long';
    }
    
    if (preg_match('/[a-z]/', $password)) {
        $strength['score']++;
    } else {
        $strength['feedback'][] = 'Password should contain lowercase letters';
    }
    
    if (preg_match('/[A-Z]/', $password)) {
        $strength['score']++;
    } else {
        $strength['feedback'][] = 'Password should contain uppercase letters';
    }
    
    if (preg_match('/[0-9]/', $password)) {
        $strength['score']++;
    } else {
        $strength['feedback'][] = 'Password should contain numbers';
    }
    
    if (preg_match('/[^a-zA-Z0-9]/', $password)) {
        $strength['score']++;
    } else {
        $strength['feedback'][] = 'Password should contain special characters';
    }
    
    return $strength;
}

/**
 * Export user data (GDPR compliance)
 */
function exportUserData($conn, $user_id, $role) {
    $user = getUserProfile($conn, $user_id, $role);
    
    if (!$user) {
        return null;
    }
    
    // Prepare JSON export
    $export = [
        'export_date' => date('Y-m-d H:i:s'),
        'user_data' => $user,
        'activity_history' => getUserActivityHistory($conn, $user_id, $role, 100)
    ];
    
    return json_encode($export, JSON_PRETTY_PRINT);
}

/**
 * Get user activity history
 */
function getUserActivityHistory($conn, $user_id, $role, $limit = 50) {
    $query = "SELECT * FROM activity_logs WHERE user_id = ? AND user_role = ? 
              ORDER BY timestamp DESC LIMIT ?";
    
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        return [];
    }
    
    $stmt->bind_param("isi", $user_id, $role, $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $history = [];
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $history[] = $row;
        }
    }
    
    $stmt->close();
    return $history;
}

?>
