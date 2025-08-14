// server.js (full)
// Node 18+ required
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const fetch = global.fetch || require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

// ---------- Postgres pool (DATABASE_URL or env parts) ----------
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mental_health',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  });
}

// Quick DB test
pool.connect()
  .then(client => client.query('SELECT 1')
    .then(() => {
      client.release();
      console.log('Connected to Postgres');
    })
    .catch(err => {
      client.release();
      console.error('DB test query failed', err);
    }))
  .catch(err => console.error('DB connection error', err));

app.use(cors());
app.use(express.json());

// ---------- Auth helpers ----------

// Verify token received from mock server (signed by SCHOOL_SECRET)
function verifyMockToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing mock token' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.SCHOOL_SECRET);
    req.mockStudentId = decoded.studentId;
    next();
  } catch (err) {
    console.error('verifyMockToken:', err && err.message);
    return res.status(401).json({ error: 'Invalid mock token' });
  }
}

// Verify app-level token (issued by this server using APP_SECRET)
function authenticateStudent(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing app token' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.APP_SECRET);
    req.studentId = decoded.studentId;
    next();
  } catch (err) {
    console.error('authenticateStudent:', err && err.message);
    return res.status(401).json({ error: 'Invalid app token' });
  }
}

// ---------- Routes ----------

// Proxy verify-code to mock school server
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  try {
    const mockRes = await fetch('http://localhost:3001/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!mockRes.ok) {
      const err = await mockRes.json().catch(() => ({ error: 'mock server error' }));
      return res.status(mockRes.status).json({ error: err.error || 'Invalid code' });
    }

    const payload = await mockRes.json(); // { token }
    return res.json(payload);
  } catch (err) {
    console.error('verify-code proxy error:', err);
    return res.status(500).json({ error: 'Verification service error' });
  }
});

// Create session: accept mock token via Authorization header and return app token
app.post('/api/sessions', verifyMockToken, async (req, res) => {
  const mockToken = req.headers.authorization.split(' ')[1];
  const studentId = req.mockStudentId;

  try {
    // Save mock token server-side for session tracking
    await pool.query(
      `INSERT INTO sessions(token, studentId) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING`,
      [mockToken, studentId]
    );

    const appToken = jwt.sign({ studentId }, process.env.APP_SECRET, { expiresIn: '7d' });
    return res.json({ studentToken: appToken, studentId });
  } catch (err) {
    console.error('Session create error:', err);
    return res.status(500).json({ error: 'Could not create session' });
  }
});

// ---------- Mood routes (you already have these in previous server; included for completeness) ----------

// POST /api/mood
app.post('/api/mood', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  const { mood, date } = req.body;
  const moodValue = Number(mood);
  if (!Number.isInteger(moodValue) || moodValue < 1 || moodValue > 5) {
    return res.status(400).json({ error: 'Mood must be integer between 1 and 5' });
  }

  let dateVal = null;
  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid date' });
    dateVal = d.toISOString().slice(0, 10);
  }

  try {
    // Use upsert assuming unique (studentId, date) constraint exists. If not, fallback happens.
    const upsertQuery = dateVal
      ? `INSERT INTO mood_logs (studentId, date, mood) VALUES ($1, $2, $3)
         ON CONFLICT (studentId, date) DO UPDATE SET mood = EXCLUDED.mood RETURNING id, studentId, date, mood`
      : `INSERT INTO mood_logs (studentId, mood) VALUES ($1, $2)
         ON CONFLICT (studentId, date) DO UPDATE SET mood = EXCLUDED.mood RETURNING id, studentId, date, mood`;

    const args = dateVal ? [studentId, dateVal, moodValue] : [studentId, moodValue];
    const result = await pool.query(upsertQuery, args);
    const r = result.rows[0];
    r.date = r.date instanceof Date ? r.date.toISOString().slice(0,10) : r.date;
    return res.status(201).json(r);
  } catch (err) {
    console.error('POST /api/mood error:', err);
    return res.status(500).json({ error: 'Failed to record mood' });
  }
});

app.get('/api/mood', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  try {
    const result = await pool.query(
      `SELECT id, studentId, date, mood FROM mood_logs WHERE studentId = $1 ORDER BY date DESC LIMIT 30`,
      [studentId]
    );
    const rows = result.rows.map(r => ({
      id: r.id,
      studentId: r.studentid || r.studentId,
      date: (r.date instanceof Date) ? r.date.toISOString().slice(0,10) : r.date,
      mood: r.mood
    }));
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/mood error:', err);
    return res.status(500).json({ error: 'Could not fetch mood history' });
  }
});

app.get('/api/mood/today', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  try {
    const result = await pool.query(
      `SELECT id, studentId, date, mood FROM mood_logs WHERE studentId = $1 AND date = CURRENT_DATE LIMIT 1`,
      [studentId]
    );
    if (result.rows.length === 0) return res.status(204).send();
    const r = result.rows[0];
    r.date = r.date instanceof Date ? r.date.toISOString().slice(0,10) : r.date;
    return res.json(r);
  } catch (err) {
    console.error('GET /api/mood/today error:', err);
    return res.status(500).json({ error: 'Could not fetch today mood' });
  }
});

// ---------- Appointments & counselors ----------

app.post('/api/appointments', authenticateStudent, async (req, res) => {
  const { counselorId, datetime } = req.body;
  const studentId = String(req.studentId);
  if (!counselorId || !datetime) return res.status(400).json({ error: 'counselorId and datetime required' });

  try {
    const dateObj = new Date(datetime);
    if (isNaN(dateObj.getTime())) return res.status(400).json({ error: 'Invalid datetime' });
    const iso = dateObj.toISOString();

    const existing = await pool.query(
      `SELECT id FROM appointments WHERE studentId = $1 AND datetime = $2 AND status = 'scheduled'`,
      [studentId, iso]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'You already have an appointment at this time' });

    const conflict = await pool.query(
      `SELECT id FROM appointments WHERE counselorId = $1 AND datetime = $2 AND status = 'scheduled'`,
      [counselorId, iso]
    );
    if (conflict.rows.length > 0) return res.status(409).json({ error: 'This counselor already has an appointment at this time' });

    const insertQuery = `
      WITH ins AS (
        INSERT INTO appointments (studentId, counselorId, datetime, status)
        VALUES ($1, $2, $3, 'scheduled')
        RETURNING *
      )
      SELECT ins.*, u.id AS "counselorId", u.username AS "counselorUsername",
             INITCAP(REPLACE(u.username, '_', ' ')) AS "counselorName"
      FROM ins LEFT JOIN users u ON ins.counselorId = u.id
    `;
    const result = await pool.query(insertQuery, [studentId, counselorId, iso]);
    const appointment = result.rows[0];
    if (appointment && appointment.datetime instanceof Date) appointment.datetime = appointment.datetime.toISOString();
    return res.status(201).json(appointment);
  } catch (err) {
    console.error('POST /api/appointments error:', err);
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
});

app.get('/api/appointments', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  try {
    const q = `
      SELECT a.id, a.datetime, a.status,
             u.id AS "counselorId", u.username AS "counselorUsername",
             INITCAP(REPLACE(u.username, '_', ' ')) AS "counselorName"
      FROM appointments a
      LEFT JOIN users u ON a.counselorId = u.id
      WHERE a.studentId = $1
      ORDER BY a.datetime ASC
    `;
    const result = await pool.query(q, [studentId]);
    const rows = result.rows.map(r => ({ ...r, datetime: r.datetime instanceof Date ? r.datetime.toISOString() : r.datetime }));
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/appointments error:', err);
    return res.status(500).json({ error: 'Could not fetch appointments' });
  }
});

app.delete('/api/appointments/:id', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  const appointmentId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      `UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND studentId = $2 RETURNING *`,
      [appointmentId, studentId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found or unauthorized' });
    const appt = result.rows[0];
    if (appt.datetime instanceof Date) appt.datetime = appt.datetime.toISOString();
    return res.json({ message: 'Appointment cancelled', appointment: appt });
  } catch (err) {
    console.error('DELETE /api/appointments error:', err);
    return res.status(500).json({ error: 'Could not cancel appointment' });
  }
});

app.get('/api/counselors', authenticateStudent, async (req, res) => {
  try {
    const q = `SELECT id, username, INITCAP(REPLACE(username,'_',' ')) AS name FROM users WHERE role = 'counselor' ORDER BY id`;
    const result = await pool.query(q);
    const counselors = result.rows.map(r => ({ id: r.id, username: r.username, name: r.name }));
    return res.json(counselors);
  } catch (err) {
    console.error('GET /api/counselors error:', err);
    return res.status(500).json({ error: 'Could not fetch counselors' });
  }
});

// ---------- Chat endpoints (new) ----------

// Insert chat message (student)
app.post('/api/chats', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  const { counselorId, message, emergency } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (!counselorId && !emergency) {
    return res.status(400).json({ error: 'Select counselor or mark emergency' });
  }

  try {
    // If not emergency, ensure student has scheduled session with counselor near now
    if (!emergency) {
      const apptRes = await pool.query(
        `SELECT id, datetime FROM appointments
         WHERE studentId = $1
           AND counselorId = $2
           AND status = 'scheduled'
           AND datetime BETWEEN now() - INTERVAL '1 hour' AND now() + INTERVAL '6 hour'
         LIMIT 1`,
        [studentId, counselorId]
      );
      if (apptRes.rows.length === 0) {
        return res.status(403).json({ error: 'No active session with this counselor. Mark emergency to contact any counselor.' });
      }
    }

    // Insert into chats table
    const insert = await pool.query(
      `INSERT INTO chats (studentId, counselorId, message) VALUES ($1, $2, $3) RETURNING id, studentId, counselorId, message, timestamp`,
      [studentId, counselorId || null, message.trim()]
    );

    const row = insert.rows[0];

    // Fetch counselor display name if exists
    let counselorName = null;
    if (row.counselorid) {
      const u = await pool.query('SELECT username FROM users WHERE id = $1', [row.counselorid]);
      if (u.rows.length) counselorName = u.rows[0].username;
    }

    // Normalize timestamp
    if (row.timestamp instanceof Date) row.timestamp = row.timestamp.toISOString();

    return res.status(201).json({ ...row, counselorName });
  } catch (err) {
    console.error('POST /api/chats error:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET chats for student (optional filter by counselorId)
app.get('/api/chats', authenticateStudent, async (req, res) => {
  const studentId = String(req.studentId);
  const counselorId = req.query.counselorId ? parseInt(req.query.counselorId, 10) : null;
  try {
    let q = `
      SELECT c.id, c.studentId, c.counselorId, c.message, c.timestamp,
             u.username AS counselorUsername,
             INITCAP(REPLACE(u.username,'_',' ')) AS counselorName
      FROM chats c
      LEFT JOIN users u ON c.counselorId = u.id
      WHERE c.studentId = $1
    `;
    const args = [studentId];
    if (counselorId) {
      q += ' AND c.counselorId = $2';
      args.push(counselorId);
    }
    q += ' ORDER BY c.timestamp ASC'; // ascending for chat flow

    const result = await pool.query(q, args);
    const rows = result.rows.map(r => ({
      id: r.id,
      studentId: r.studentid || r.studentId,
      counselorId: r.counselorid || r.counselorId,
      message: r.message,
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
      counselorUsername: r.counselorusername || r.counselorUsername,
      counselorName: r.counselorname || r.counselorName
    }));
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/chats error:', err);
    return res.status(500).json({ error: 'Could not fetch chats' });
  }
});

// A small endpoint helper so client can verify token quickly
app.get('/api/me', authenticateStudent, (req, res) => {
  return res.json({ studentId: req.studentId });
});

// ---------- Start server ----------
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
