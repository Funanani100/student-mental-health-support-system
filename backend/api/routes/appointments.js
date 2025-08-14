// routes/appointments.js
const router = require('express').Router();
const { authenticateStudent } = require('../middleware/auth'); // your middleware must set req.studentId
const appointmentController = require('../controllers/appointmentController');

router.use(authenticateStudent);

router.post('/', appointmentController.bookAppointment);
router.get('/', appointmentController.getAppointments);
router.put('/:id', appointmentController.updateAppointment);
router.delete('/:id', appointmentController.cancelAppointment);

module.exports = router;
