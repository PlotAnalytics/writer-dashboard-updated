const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Create PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '34.10.59.242',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'simplepass123',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Vercel serverless function for authentication
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    console.log('🔐 Login attempt for username:', username);

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    // Find user in PostgreSQL database
    const result = await pool.query(
      "SELECT * FROM login WHERE username = $1 AND password = $2",
      [username, password]
    );

    const user = result.rows[0];

    if (user) {
      console.log('✅ User found:', user.username, 'Role:', user.role);

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
    } else {
      console.log('❌ Invalid credentials for username:', username);
      res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message
    });
  }
}
