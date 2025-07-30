const jwt = require('jsonwebtoken');
const { pool } = require('../db/db_connection');

const JWT_SECRET = 'school_secret';

exports.authenticateStudent = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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