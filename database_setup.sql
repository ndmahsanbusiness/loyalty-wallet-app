-- MySQL Database Setup for LoyalChain

CREATE DATABASE IF NOT EXISTS loyalchain_db;
USE loyalchain_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    total_points INT DEFAULT 0,
    role ENUM('user', 'admin') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    avatar VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NULL,
    receiver_id INT NULL,
    transaction_type ENUM('earn', 'redeem', 'transfer') NOT NULL,
    points INT NOT NULL,
    balance_after INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 3. Initial Demo Data (Matches current App.jsx simulation)
INSERT INTO users (full_name, phone_number, password, total_points, role, is_active, avatar) VALUES
('Alexandra Chen', '+15550101', 'password123', 4850, 'user', 1, 'AC'),
('Marcus Williams', '+15550202', 'password123', 2300, 'user', 1, 'MW'),
('Sarah Jenkins', '+15550303', 'password123', 12500, 'user', 0, 'SJ'),
('Administrator', '+15559999', '11223344', 1000000, 'admin', 1, 'ROOT'),
('Demo User PK', '+923009623321', 'password123', 10000, 'user', 1, 'PK')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- 4. Initial Transactions
INSERT INTO transactions (sender_id, receiver_id, transaction_type, points, balance_after, description) VALUES
(NULL, 1, 'earn', 5000, 5000, 'Welcome Reward'),
(1, NULL, 'redeem', -150, 4850, 'Coffee Purchase'),
(NULL, 5, 'earn', 10000, 10000, 'Registration Bonus')
ON DUPLICATE KEY UPDATE description=VALUES(description);
