-- Tables for mental_health database

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','counselor','admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Sessions table for student logins
CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mood logs table
CREATE TABLE mood_logs (
    id SERIAL PRIMARY KEY,
    studentId TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5)
);

-- Chats table
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    studentId TEXT NOT NULL,
    counselorId INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    studentId TEXT NOT NULL,
    counselorId INTEGER REFERENCES users(id),
    datetime TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled'
);

-- Resources table
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    link TEXT NOT NULL,
    type VARCHAR(50) NOT NULL
);

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    studentId TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data for counselors
INSERT INTO users (username, password, role) VALUES
('counselor1', 'password123', 'counselor'),
('counselor2', 'password123', 'counselor'),
('admin1', 'adminpass', 'admin');

-- Sample resources
INSERT INTO resources (title, link, type) VALUES
('Managing Anxiety', 'https://example.com/anxiety', 'article'),
('Stress Reduction Techniques', 'https://example.com/stress', 'video'),
('Crisis Hotline', 'tel:1-800-273-8255', 'contact');