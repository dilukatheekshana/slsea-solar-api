const express = require('express');
const router = express.Router();
const { User } = require('../models');

// POST /auth/login & POST /login
router.post(['/auth/login', '/login'], async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Username and password are required'
        }
      });
    }

    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }

    const userJson = user.toJSON();

    res.status(200).json({
      message: 'Login successful',
      user: userJson
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

module.exports = router;
