// middleware/auth.js
const jwt = require('jsonwebtoken');

// 1) Verify mock-server token, extract studentId → req.mockStudentId
function verifyMockToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing mock token' });
  }
  const token = auth.split(' ')[1];
  try {
    const { studentId } = jwt.verify(token, process.env.SCHOOL_SECRET);
    req.mockStudentId = studentId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid mock token' });
  }
}

// 2) Verify app-level token, extract studentId → req.studentId
function authenticateStudent(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing app token' });
  }
  const token = auth.split(' ')[1];
  try {
    const { studentId } = jwt.verify(token, process.env.APP_SECRET);
    req.studentId = studentId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid app token' });
  }
}

module.exports = { verifyMockToken, authenticateStudent };
