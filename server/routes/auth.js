const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

// Test endpoint for deployment debugging
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Login endpoint with PostgreSQL
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 Login attempt for username:', username);

    // Validate input
    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Special case for retention_master user
    if (username === 'retention_master' && password === 'Plotpointe!@3456') {
      console.log('✅ Retention master authenticated');

      // Generate JWT token for retention master
      const token = jwt.sign(
        {
          id: 'retention_master',
          username: 'retention_master',
          role: 'retention_master'
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: "24h" }
      );

      return res.json({
        success: true,
        token,
        role: 'retention_master',
        username: 'retention_master',
        user: {
          id: 'retention_master',
          username: 'retention_master',
          role: 'retention_master'
        }
      });
    }

    // Special case for master_editor user
    if (username === 'master_editor' && password === 'Plotpointe!@3456') {
      console.log('✅ Master editor authenticated');

      // Generate JWT token for master editor
      const token = jwt.sign(
        {
          id: 'master_editor',
          username: 'master_editor',
          role: 'master_editor'
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: "24h" }
      );

      return res.json({
        success: true,
        token,
        role: 'master_editor',
        username: 'master_editor',
        user: {
          id: 'master_editor',
          username: 'master_editor',
          role: 'master_editor'
        }
      });
    }

    // First check if user exists
    const userCheckResult = await pool.query(
      "SELECT * FROM login WHERE username = $1",
      [username]
    );

    if (userCheckResult.rows.length === 0) {
      console.log('❌ User not found:', username);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Then check password
    const user = userCheckResult.rows[0];
    if (user.password !== password) {
      console.log('❌ Password mismatch for username:', username);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    console.log('✅ User authenticated:', user.username, 'Role:', user.role);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      role: user.role,
      username: user.username,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// Registration endpoint
router.post('/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      password,
      email,
      registrationCode,
      writerType
    } = req.body;

    console.log('📝 Registration attempt for username:', username);

    // Validate input
    if (!firstName || !lastName || !username || !password || !email || !registrationCode || !writerType) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate registration code
    if (registrationCode !== '125646') {
      console.log('❌ Invalid registration code:', registrationCode);
      return res.status(400).json({
        success: false,
        message: 'Invalid registration code'
      });
    }

    // Check if username already exists
    const existingUserResult = await pool.query(
      "SELECT username FROM login WHERE username = $1",
      [username]
    );

    if (existingUserResult.rows.length > 0) {
      console.log('❌ Username already exists:', username);
      return res.status(400).json({
        success: false,
        message: 'Username already exists. Please choose a different username.'
      });
    }

    // Map writer type to secondary_role
    let secondaryRole;
    switch (writerType) {
      case 'interviewed':
        secondaryRole = 'Intern';
        break;
      case 'part-time':
        secondaryRole = 'Part Time';
        break;
      case 'full-time':
        secondaryRole = 'Full Time';
        break;
      case 'stl':
        secondaryRole = 'STL';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid writer type'
        });
    }

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert into login table
      const loginInsertResult = await client.query(
        `INSERT INTO login (username, password, email, role, secondary_role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [username, password, email, 'writer', secondaryRole]
      );

      const loginId = loginInsertResult.rows[0].id;
      console.log('✅ Login record created with ID:', loginId);

      // Insert into writer table
      const fullName = `${firstName} ${lastName}`;
      await client.query(
        `INSERT INTO writer (name, pw_hash, email, login_id)
         VALUES ($1, $2, $3, $4)`,
        [fullName, password, email, loginId]
      );

      console.log('✅ Writer record created for:', fullName);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Account created successfully! You can now log in.',
        username: username
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error("❌ Error during registration:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// Get writer information endpoint
router.get('/getWriter', async (req, res) => {
  try {
    const { username } = req.query;

    console.log('👤 Getting writer info for username:', username);

    const writerQuery = `
      SELECT
        w.id,
        w.name,
        w.email,
        w.login_id,
        w.payment_scale,
        wd.looker_studio_url,
        ws.skip_qa,
        ws.access_advanced_types
      FROM writer w
      JOIN login a ON w.login_id = a.id
      LEFT JOIN writer_dashboard wd ON w.id = wd.writer_id
      LEFT JOIN writer_settings ws ON w.id = ws.writer_id
      WHERE a.username = $1
    `;

    const writerResult = await pool.query(writerQuery, [username]);

    if (writerResult.rows.length === 0) {
      console.log('❌ Writer not found for username:', username);
      return res.status(404).json({ error: "Writer not found" });
    }

    const writer = writerResult.rows[0];
    console.log('✅ Writer found:', writer.name, 'ID:', writer.id);

    res.json(writer);
  } catch (error) {
    console.error("❌ Error fetching writer data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Verify token endpoint with PostgreSQL
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    // Special case for master_editor user
    if (decoded.role === 'master_editor') {
      return res.json({
        user: {
          id: 'master_editor',
          username: 'master_editor',
          role: 'master_editor',
          name: 'Master Editor',
          writerId: null,
          avatar: 'M'
        }
      });
    }

    // Get user from database
    const result = await pool.query(
      "SELECT id, username, role, avatar_seed, secondary_role FROM login WHERE id = $1",
      [decoded.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get writer information
    const writerQuery = `
      SELECT
        w.id as writer_id,
        w.name,
        w.email
      FROM writer w
      WHERE w.login_id = $1
    `;

    const writerResult = await pool.query(writerQuery, [user.id]);
    const writer = writerResult.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        secondaryRole: user.secondary_role,
        name: writer?.name || user.username,
        writerId: writer?.writer_id || null,
        avatar: writer?.name?.charAt(0)?.toUpperCase() || user.username.charAt(0).toUpperCase(),
        avatarSeed: user.avatar_seed || user.username
      }
    });
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Profile endpoint (alias for verify)
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    // Special case for retention_master user
    if (decoded.role === 'retention_master') {
      return res.json({
        success: true,
        user: {
          id: 'retention_master',
          username: 'retention_master',
          role: 'retention_master',
          name: 'Retention Master',
          writerId: null,
          avatar: 'R'
        }
      });
    }

    // Special case for master_editor user
    if (decoded.role === 'master_editor') {
      return res.json({
        success: true,
        user: {
          id: 'master_editor',
          username: 'master_editor',
          role: 'master_editor',
          name: 'Master Editor',
          writerId: null,
          avatar: 'M'
        }
      });
    }

    // Get user from database
    const result = await pool.query(
      "SELECT id, username, role, avatar_seed, secondary_role FROM login WHERE id = $1",
      [decoded.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get writer information
    const writerQuery = `
      SELECT
        w.id as writer_id,
        w.name,
        w.email
      FROM writer w
      WHERE w.login_id = $1
    `;

    const writerResult = await pool.query(writerQuery, [user.id]);
    const writer = writerResult.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        secondaryRole: user.secondary_role,
        name: writer?.name || user.username,
        writerId: writer?.writer_id || null,
        avatar: writer?.name?.charAt(0)?.toUpperCase() || user.username.charAt(0).toUpperCase(),
        avatarSeed: user.avatar_seed || user.username
      }
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Debug endpoint to trace authentication flow
router.get('/debug', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    console.log('🔍 Debug - JWT Decoded:', decoded);

    // Get user from login table
    const loginResult = await pool.query(
      "SELECT * FROM login WHERE id = $1",
      [decoded.id]
    );

    const loginUser = loginResult.rows[0];
    console.log('🔍 Debug - Login User:', loginUser);

    if (!loginUser) {
      return res.status(404).json({ message: 'User not found in login table' });
    }

    // Get writer information
    const writerQuery = `
      SELECT
        w.id as writer_id,
        w.name,
        w.email,
        w.login_id
      FROM writer w
      WHERE w.login_id = $1
    `;

    const writerResult = await pool.query(writerQuery, [loginUser.id]);
    const writer = writerResult.rows[0];
    console.log('🔍 Debug - Writer:', writer);

    // Test InfluxDB query with this writer ID
    const influxService = require('../services/influxService');
    let influxData = null;
    if (writer && influxService) {
      try {
        influxData = await influxService.getWriterSubmissions(writer.writer_id, '30d');
        console.log('🔍 Debug - InfluxDB Data Count:', influxData?.length || 0);
      } catch (influxError) {
        console.log('🔍 Debug - InfluxDB Error:', influxError.message);
      }
    }

    res.json({
      debug: true,
      jwt_decoded: decoded,
      login_user: loginUser,
      writer: writer,
      influx_data_count: influxData?.length || 0,
      influx_sample: influxData?.slice(0, 2) || [],
      mapping: {
        username: loginUser?.username,
        login_id: loginUser?.id,
        writer_id: writer?.writer_id,
        writer_name: writer?.name
      }
    });

  } catch (error) {
    console.error('🔍 Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;
