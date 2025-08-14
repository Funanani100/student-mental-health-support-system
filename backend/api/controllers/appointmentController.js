// controllers/appointmentController.js
const pool = require('../db');

// Book a new appointment
exports.bookAppointment = async (req, res) => {
  try {
    const studentId = req.studentId;                   // <--- use token-derived id
    const { counselorId, datetime } = req.body;

    if (!counselorId || !datetime) {
      return res.status(400).json({ error: 'counselorId and datetime required' });
    }

    const result = await pool.query(
      `INSERT INTO appointments (studentId, counselorId, datetime, status)
       VALUES ($1, $2, $3, 'scheduled')
       RETURNING id, studentId, counselorId, datetime, status`,
      [studentId, counselorId, datetime]
    );

    // create alert (optional)
    await pool.query(
      'INSERT INTO alerts (studentId, type, metadata) VALUES ($1, $2, $3)',
      [studentId, 'appointment_booked', JSON.stringify(result.rows[0])]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
};

// Get upcoming appointments for the authenticated student
exports.getAppointments = async (req, res) => {
  try {
    const studentId = req.studentId;                   // <--- use token-derived id

    const result = await pool.query(
      `SELECT a.id, a.datetime, a.status, u.username AS counselorname
       FROM appointments a
       LEFT JOIN users u ON a.counselorId = u.id
       WHERE a.studentId = $1
       ORDER BY a.datetime DESC`,
      [studentId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

// Update (reschedule) appointment
exports.updateAppointment = async (req, res) => {
  try {
    const studentId = req.studentId;
    const { id } = req.params;
    const { datetime } = req.body;

    const result = await pool.query(
      `UPDATE appointments
       SET datetime = $1, status = 'rescheduled'
       WHERE id = $2 AND studentId = $3
       RETURNING *`,
      [datetime, id, studentId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    await pool.query(
      'INSERT INTO alerts (studentId, type, metadata) VALUES ($1, $2, $3)',
      [studentId, 'appointment_rescheduled', JSON.stringify(result.rows[0])]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
  try {
    const studentId = req.studentId;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE appointments
       SET status = 'cancelled'
       WHERE id = $1 AND studentId = $2
       RETURNING *`,
      [id, studentId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    await pool.query(
      'INSERT INTO alerts (studentId, type, metadata) VALUES ($1, $2, $3)',
      [studentId, 'appointment_cancelled', JSON.stringify(result.rows[0])]
    );

    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};
