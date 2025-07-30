const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'school_secret';
const VALID_CODES = ['STUD123', 'STUD456', 'STUD789'];

app.post('/api/verify-code', (req, res) => {
  const { code } = req.body;
  if (VALID_CODES.includes(code)) {
    const token = jwt.sign({ studentId: code }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid code' });
  }
});

app.listen(3001, () => console.log('Mock School Server running on port 3001'));