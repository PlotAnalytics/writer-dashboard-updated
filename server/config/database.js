const { Pool } = require('pg');

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

// Test the connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('🔗 PostgreSQL connection test successful');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error);
    return false;
  }
}

// Initialize connection test
testConnection();

module.exports = pool;
