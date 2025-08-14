const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Student login
router.post('/login', authController.studentLogin);

// Student logout
router.post('/logout', authController.studentLogout);

module.exports = router;