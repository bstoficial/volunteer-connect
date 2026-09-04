-- ========================================================
-- VolunteerConnect Database Schema and Initial Seed Data
-- ========================================================

CREATE DATABASE IF NOT EXISTS `volunteerconnect` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `volunteerconnect`;

-- --------------------------------------------------------
-- Table: admins
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    `last_login` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: volunteers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `volunteers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `location` VARCHAR(255) DEFAULT 'San Francisco, CA',
    `skills` TEXT NULL,
    `bio` TEXT NULL,
    `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    `email_verified` TINYINT(1) DEFAULT 1,
    `last_login` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: organizations
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `organizations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `address` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `category` VARCHAR(100) DEFAULT 'General',
    `status` ENUM('active', 'pending', 'suspended') DEFAULT 'active',
    `email_verified` TINYINT(1) DEFAULT 1,
    `last_login` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: volunteer_profiles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `volunteer_profiles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `volunteer_id` INT NOT NULL,
    `name` VARCHAR(100) NULL,
    `total_hours` INT DEFAULT 0,
    `total_applications` INT DEFAULT 0,
    `rating` DECIMAL(3,2) DEFAULT 0.00,
    `profile_completeness` INT DEFAULT 20,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: organization_profiles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `organization_profiles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT NOT NULL,
    `org_name` VARCHAR(150) NULL,
    `total_opportunities` INT DEFAULT 0,
    `total_volunteers` INT DEFAULT 0,
    `rating` DECIMAL(3,2) DEFAULT 0.00,
    `profile_completeness` INT DEFAULT 20,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: opportunities
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `opportunities` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `time_commitment` VARCHAR(100) DEFAULT 'Flexible',
    `spots_needed` INT NOT NULL DEFAULT 10,
    `spots_filled` INT NOT NULL DEFAULT 0,
    `start_date` DATE NOT NULL,
    `description` TEXT NOT NULL,
    `urgent` TINYINT(1) DEFAULT 0,
    `status` ENUM('active', 'closed', 'draft') DEFAULT 'active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: applications
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `applications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `volunteer_id` INT NOT NULL,
    `opportunity_id` INT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'waitlisted') DEFAULT 'pending',
    `applied_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: login_attempts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_attempts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(100) NOT NULL,
    `attempt_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `status` VARCHAR(20) DEFAULT 'failed',
    `ip_address` VARCHAR(45) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: activity_logs
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `user_role` VARCHAR(50) NULL,
    `activity` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: user_sessions
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_sessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `user_role` VARCHAR(50) NOT NULL,
    `action` VARCHAR(50) DEFAULT 'login',
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- Seed Initial Accounts
-- ========================================================

-- Admins
-- Password: admin123 ($2y$10$GfeUbNDCYeWSrPGDMxUSVeFOc5TkZoh.in40hLAzl8DeXDCMW/BXu)
INSERT INTO `admins` (`id`, `name`, `email`, `password`, `status`) 
VALUES (1, 'Admin User', 'admin@volunteerconnect.org', '$2y$10$GfeUbNDCYeWSrPGDMxUSVeFOc5TkZoh.in40hLAzl8DeXDCMW/BXu', 'active')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

