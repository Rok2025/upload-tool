-- Database Schema for Upload Tool

CREATE DATABASE IF NOT EXISTS upload_tool;
USE upload_tool;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'developer') DEFAULT 'developer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Modules Table
CREATE TABLE IF NOT EXISTS modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    name VARCHAR(50) NOT NULL, -- e.g., gateway, system, frontend
    type VARCHAR(20) NOT NULL, -- frontend, backend
    remote_path VARCHAR(255) NOT NULL, -- Path on target server
    log_path VARCHAR(255), -- Path to log file on target server
    start_command TEXT, -- Command to start the service
    stop_command TEXT, -- Command to stop the service
    backup_path VARCHAR(255), -- Path for backups on target server
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 4. Environments Table (Target Servers)
CREATE TABLE IF NOT EXISTS environments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- e.g., Testing, Production
    host VARCHAR(100) NOT NULL,
    port INT DEFAULT 22,
    username VARCHAR(50) NOT NULL,
    password_encrypted TEXT, -- AES Encrypted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. User Permissions Table (Module-level)
CREATE TABLE IF NOT EXISTS user_module_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_id INT NOT NULL,
    can_deploy BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- 6. Deploy Logs Table
CREATE TABLE IF NOT EXISTS deploy_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_id INT NOT NULL,
    environment_id INT NOT NULL,
    status ENUM('pending', 'deploying', 'success', 'failed', 'rollback') DEFAULT 'pending',
    version VARCHAR(50), -- e.g., V2026.01.12.01
    log_output LONGTEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (module_id) REFERENCES modules(id),
    FOREIGN KEY (environment_id) REFERENCES environments(id)
);
