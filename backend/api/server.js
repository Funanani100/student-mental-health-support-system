// backend/api/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mental_health',
  password: process.env.DB_PASSWORD || 'Your_Password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Database connection error', err.stack));

// Middleware
app.use(cors());
app.use(bodyParser.json());

// JWT Secrets
const SCHOOL_SECRET = process.env.SCHOOL_SECRET || 'school_secret';
const APP_SECRET = process.env.APP_SECRET || 'app_secret';

// Authentication Middleware
const authenticateStudent = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, SCHOOL_SECRET);
    const result = await pool.query('SELECT * FROM sessions WHERE token = $1', [token]);
    if (result.rows.length) {
      req.studentId = decoded.studentId;
      next();
    } else {
      res.status(401).json({ error: 'Invalid session' });
    }
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, APP_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length) {
      req.user = result.rows[0];
      next();
    } else {
      res.status(401).json({ error: 'User not found' });
    }
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Alert Engine
const checkForRisk = (text) => {
  const riskKeywords = ['suicidal', 'kill myself', 'end it all', 'want to die', 'harm myself'];
  return riskKeywords.some(keyword => text.toLowerCase().includes(keyword));
};

const createAlert = async (studentId, type, metadata) => {
  try {
    await pool.query(
      'INSERT INTO alerts (studentId, type, metadata) VALUES ($1, $2, $3)',
      [studentId, type, metadata]
    );
    // Notify counselors in real-time
    io.emit('new-alert', { studentId, type, metadata });
  } catch (err) {
    console.error('Failed to create alert:', err);
  }
};

// Services
// Mood Service
app.post('/api/mood', authenticateStudent, async (req, res) => {
  const { mood } = req.body;
  if (mood < 1 || mood > 5) {
    return res.status(400).json({ error: 'Invalid mood value' });
  }

  try {
    await pool.query(
      'INSERT INTO mood_logs (studentId, mood) VALUES ($1, $2)',
      [req.studentId, mood]
    );
    
    // Trigger alert for low mood
    if (mood <= 2) {
      await createAlert(req.studentId, 'mood', `Low mood: ${mood}`);
    }
    
    res.status(201).json({ message: 'Mood recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/mood', authenticateStudent, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM mood_logs WHERE studentId = $1 ORDER BY date DESC LIMIT 30',
      [req.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Appointment Service
app.post('/api/appointments', authenticateStudent, async (req, res) => {
  const { counselorId, datetime } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO appointments (studentId, counselorId, datetime, status) 
       VALUES ($1, $2, $3, 'scheduled') RETURNING *`,
      [req.studentId, counselorId, datetime]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/appointments', authenticateStudent, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT a.*, u.username AS counselorName FROM appointments a ' +
      'JOIN users u ON a.counselorId = u.id WHERE studentId = $1',
      [req.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/appointments/counselor', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT a.*, s.studentId FROM appointments a ' +
      'LEFT JOIN sessions s ON a.studentId = s.studentId::text ' +
      'WHERE counselorId = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Resource Service
app.get('/api/resources', authenticateStudent, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resources');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/resources', authenticateUser, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { title, link, type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO resources (title, link, type) VALUES ($1, $2, $3) RETURNING *',
      [title, link, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Alert Service
app.get('/api/alerts', authenticateUser, async (req, res) => {
  if (req.user.role !== 'counselor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Counselor access required' });
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// User Management Service
app.post('/api/users', authenticateUser, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { username, password, role } = req.body;
  if (!['counselor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
      [username, password, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/users', authenticateUser, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  try {
    const result = await pool.query('SELECT id, username, role FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Analytics Service
app.get('/api/analytics/mood-trends', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date, AVG(mood) as avg_mood 
       FROM mood_logs 
       WHERE date > CURRENT_DATE - INTERVAL '30 days'
       GROUP BY date 
       ORDER BY date`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/analytics/chat-stats', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DATE(timestamp) as date, COUNT(*) as count 
       FROM chats 
       GROUP BY DATE(timestamp) 
       ORDER BY date DESC 
       LIMIT 30`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Counselor Endpoint
app.get('/api/counselors', authenticateStudent, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username as name, 'General' as specialty FROM users WHERE role = 'counselor'"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Login Endpoint for Counselors/Admins
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = jwt.sign({ userId: user.id }, APP_SECRET, { expiresIn: '8h' });
      
      // Store user info for frontend
      res.json({ 
        token, 
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Real-time Chat with Socket.IO
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('auth', async ({ token, role }, callback) => {
    try {
      if (role === 'student') {
        const decoded = jwt.verify(token, SCHOOL_SECRET);
        const session = await pool.query('SELECT * FROM sessions WHERE token = $1', [token]);
        
        if (session.rows.length) {
          socket.studentId = decoded.studentId;
          socket.join(`student_${socket.studentId}`);
          callback({ status: 'authenticated' });
        } else {
          callback({ status: 'error', message: 'Invalid session' });
        }
      } else { // Counselor or admin
        const decoded = jwt.verify(token, APP_SECRET);
        const user = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
        
        if (user.rows.length && ['counselor', 'admin'].includes(user.rows[0].role)) {
          socket.user = user.rows[0];
          socket.join('counselors');
          callback({ status: 'authenticated', user: socket.user });
        } else {
          callback({ status: 'error', message: 'Unauthorized' });
        }
      }
    } catch (err) {
      callback({ status: 'error', message: 'Authentication failed' });
    }
  });
  
  socket.on('join', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });
  
  socket.on('message', async (data) => {
    try {
      // Save message to database
      const result = await pool.query(
        `INSERT INTO chats (studentId, counselorId, message) 
         VALUES ($1, $2, $3) RETURNING *`,
        [data.studentId, data.counselorId, data.text]
      );
      
      const savedMessage = result.rows[0];
      
      // Check for risk keywords
      if (checkForRisk(data.text)) {
        await createAlert(data.studentId, 'chat', `Message: ${data.text.substring(0, 50)}...`);
      }
      
      // Broadcast message
      const messageData = {
        id: savedMessage.id,
        text: data.text,
        studentId: data.studentId,
        counselorId: data.counselorId,
        timestamp: savedMessage.timestamp,
        sender: socket.studentId ? 'student' : 'counselor'
      };
      
      // Send to student's room
      io.to(`student_${data.studentId}`).emit('message', messageData);
      
      // Send to counselor
      if (data.counselorId) {
        io.to(`counselor_${data.counselorId}`).emit('message', messageData);
      }
    } catch (err) {
      console.error('Chat error:', err);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO listening on port ${PORT}`);
});