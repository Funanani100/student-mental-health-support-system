-- Sample sessions (for testing)
INSERT INTO sessions (token, studentId) VALUES
('valid_token_1', 'STUD123'),
('valid_token_2', 'STUD456');

-- 2. Insert mock counselors and an admin
INSERT INTO users (username, password, role) VALUES
  ('Dr. Sarah Johnson', 'password123', 'counselor'),
  ('Dr. Michael Chen', 'password123', 'counselor'),
  ('dr_emily',  'password123', 'counselor'),
  ('Dr. Emily Rodriguez','adminpass', 'admin')
ON CONFLICT (username) DO NOTHING;
