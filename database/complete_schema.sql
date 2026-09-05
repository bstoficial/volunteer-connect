CREATE DATABASE IF NOT EXISTS volunteerconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE volunteerconnect;

CREATE TABLE IF NOT EXISTS volunteers (
 id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,email VARCHAR(255) UNIQUE NOT NULL,password VARCHAR(255) NOT NULL,
 phone VARCHAR(50),location VARCHAR(255),skills TEXT,bio TEXT,profile_image VARCHAR(255),status ENUM('active','inactive','suspended') DEFAULT 'active',email_verified TINYINT(1) DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,last_login TIMESTAMP NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS organizations (
 id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,email VARCHAR(255) UNIQUE NOT NULL,password VARCHAR(255) NOT NULL,phone VARCHAR(50),address VARCHAR(255),city VARCHAR(100),state VARCHAR(100),postal_code VARCHAR(20),country VARCHAR(100),website VARCHAR(255),description TEXT,category VARCHAR(100),registration_number VARCHAR(100),profile_image VARCHAR(255),status ENUM('pending','active','inactive','rejected') DEFAULT 'pending',email_verified TINYINT(1) DEFAULT 0,document_verified TINYINT(1) DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,last_login TIMESTAMP NULL,verified_by INT NULL,verified_at TIMESTAMP NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS admins (
 id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,email VARCHAR(255) UNIQUE NOT NULL,password VARCHAR(255) NOT NULL,phone VARCHAR(50),role ENUM('super_admin','moderator','viewer') DEFAULT 'moderator',status ENUM('active','inactive') DEFAULT 'active',permissions JSON NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,last_login TIMESTAMP NULL,created_by INT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS volunteer_profiles (id INT AUTO_INCREMENT PRIMARY KEY,volunteer_id INT NOT NULL UNIQUE,name VARCHAR(255),rating DECIMAL(3,2) DEFAULT 0,total_hours INT DEFAULT 0,total_applications INT DEFAULT 0,accepted_applications INT DEFAULT 0,profile_completeness INT DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS organization_profiles (id INT AUTO_INCREMENT PRIMARY KEY,organization_id INT NOT NULL UNIQUE,org_name VARCHAR(255),rating DECIMAL(3,2) DEFAULT 0,total_opportunities INT DEFAULT 0,total_volunteers INT DEFAULT 0,total_hours_contributed INT DEFAULT 0,profile_completeness INT DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_sessions (id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,user_role ENUM('volunteer','organization','admin') NOT NULL,action VARCHAR(50),ip_address VARCHAR(45),user_agent TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS login_attempts (id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(255) NOT NULL,attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,status ENUM('success','failed') DEFAULT 'failed',ip_address VARCHAR(45)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS activity_logs (id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,user_role ENUM('volunteer','organization','admin') NOT NULL,activity VARCHAR(255),description TEXT,ip_address VARCHAR(45),timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS password_reset_tokens (id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(255) NOT NULL,token VARCHAR(255) UNIQUE NOT NULL,user_role ENUM('volunteer','organization','admin') NOT NULL,expires_at TIMESTAMP NULL,used TINYINT(1) DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) UNIQUE NOT NULL,status ENUM('active','inactive') DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS opportunities (
 id INT AUTO_INCREMENT PRIMARY KEY,organization_id INT NOT NULL,title VARCHAR(255) NOT NULL,category VARCHAR(100) NOT NULL,location VARCHAR(255) NOT NULL,time_commitment VARCHAR(50) NOT NULL,spots INT NOT NULL,start_date DATE NOT NULL,description TEXT NOT NULL,opportunity_image VARCHAR(255) NULL,urgent TINYINT(1) DEFAULT 0,status ENUM('active','closed','draft') DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,INDEX(category),INDEX(location),INDEX(status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS applications (
 id INT AUTO_INCREMENT PRIMARY KEY,opportunity_id INT NOT NULL,volunteer_id INT NOT NULL,status ENUM('pending','approved','rejected','waitlisted') DEFAULT 'pending',message TEXT,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,reviewed_at TIMESTAMP NULL,reviewed_by INT NULL,UNIQUE KEY unique_application(opportunity_id,volunteer_id),FOREIGN KEY(opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,FOREIGN KEY(volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,INDEX(status)
) ENGINE=InnoDB;

INSERT IGNORE INTO admins(name,email,password,role,status) VALUES('System Admin','admin@volunteerconnect.org','$2y$12$q6lzKBKQH2WSIH9RhK4FSOMH2VdZ0BG74xBLU288c8xFVmd1gCI5K','super_admin','active');
INSERT IGNORE INTO categories(name,status) VALUES ('Environment','active'),('Education','active'),('Healthcare','active'),('Community','active'),('Technology','active'),('Animals','active');

