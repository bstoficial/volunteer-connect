-- ==========================================
-- VOLUNTEER CONNECT DATABASE SCHEMA
-- ==========================================

-- Create database
CREATE DATABASE IF NOT EXISTS volunteerconnect;
USE volunteerconnect;

-- ==========================================
-- VOLUNTEERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS volunteers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    reset_token CHAR(64) NULL,
    reset_token_expires_at TIMESTAMP NULL,
    phone VARCHAR(20),
    location VARCHAR(255),
    skills TEXT,
    bio TEXT,
    profile_image VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- ORGANIZATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS organizations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    reset_token CHAR(64) NULL,
    reset_token_expires_at TIMESTAMP NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    website VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    registration_number VARCHAR(100),
    profile_image VARCHAR(255),
    status ENUM('pending', 'active', 'inactive', 'rejected') DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    document_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- ADMINS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    reset_token CHAR(64) NULL,
    reset_token_expires_at TIMESTAMP NULL,
    phone VARCHAR(20),
    role ENUM('super_admin', 'moderator', 'viewer') DEFAULT 'moderator',
    status ENUM('active', 'inactive') DEFAULT 'active',
    permissions JSON,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    created_by INT,
    
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- VOLUNTEER PROFILES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS volunteer_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    volunteer_id INT NOT NULL UNIQUE,
    name VARCHAR(255),
    rating DECIMAL(3,2) DEFAULT 0,
    total_hours INT DEFAULT 0,
    total_applications INT DEFAULT 0,
    accepted_applications INT DEFAULT 0,
    profile_completeness INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- ORGANIZATION PROFILES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS organization_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT NOT NULL UNIQUE,
    org_name VARCHAR(255),
    rating DECIMAL(3,2) DEFAULT 0,
    total_opportunities INT DEFAULT 0,
    total_volunteers INT DEFAULT 0,
    total_hours_contributed INT DEFAULT 0,
    profile_completeness INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- USER SESSIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_role ENUM('volunteer', 'organization', 'admin') NOT NULL,
    action VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_user_role (user_role),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- LOGIN ATTEMPTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('success', 'failed') DEFAULT 'failed',
    ip_address VARCHAR(45),
    
    INDEX idx_email (email),
    INDEX idx_attempt_time (attempt_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- ACTIVITY LOGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_role ENUM('volunteer', 'organization', 'admin') NOT NULL,
    activity VARCHAR(255),
    description TEXT,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_activity (activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- PASSWORD RESET TOKENS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_role ENUM('volunteer', 'organization', 'admin') NOT NULL,
    expires_at TIMESTAMP,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_token (token),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- CREATE SAMPLE ADMIN USER
-- ==========================================
-- Password: admin123 (hashed with bcrypt)
INSERT INTO admins (name, email, password, role, status) VALUES 
('System Admin', 'admin@volunteerconnect.org', '$2y$10$N9qo8uLOickgx2ZMRZoMye.123456789.encrypted', 'super_admin', 'active');

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX idx_volunteers_email ON volunteers(email);
CREATE INDEX idx_volunteers_status ON volunteers(status);
CREATE INDEX idx_organizations_email ON organizations(email);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_sessions_user ON user_sessions(user_id, user_role);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);

?>
