const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get user profile
router.get('/profile', authenticateToken, (req, res) => {
  try {
    // In a real app, fetch from database
    const userProfile = {
      id: req.user.userId,
      email: req.user.email,
      name: 'Steven Abreu',
      writerId: 74,
      avatar: 'L',
      joinedDate: '2024-01-15',
      totalSubmissions: 15,
      acceptedSubmissions: 8,
      bio: 'Passionate writer with a love for storytelling and creative expression.',
      preferences: {
        emailNotifications: true,
        submissionReminders: true,
        theme: 'dark'
      }
    };
    
    res.json(userProfile);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, bio, preferences, avatarSeed } = req.body;
    const userId = req.user.id;

    console.log('🔄 Updating user profile for ID:', userId);
    console.log('📝 Update data:', { name, bio, preferences, avatarSeed });

    // If avatarSeed is provided, update it in the database
    if (avatarSeed !== undefined) {
      console.log('🎭 Updating avatar seed to:', avatarSeed);

      const updateQuery = `
        UPDATE login
        SET avatar_seed = $1
        WHERE id = $2
        RETURNING id, username, avatar_seed
      `;

      const result = await pool.query(updateQuery, [avatarSeed, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log('✅ Avatar seed updated successfully:', result.rows[0]);

      return res.json({
        success: true,
        message: 'Avatar updated successfully',
        user: result.rows[0]
      });
    }

    // Handle other profile updates here if needed
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
