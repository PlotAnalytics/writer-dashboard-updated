const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '34.10.59.242',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'simplepass123',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000, // Increased to 30 seconds
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  query_timeout: 30000, // Add query timeout
  max: 10, // Reduced max connections for better stability
  min: 2, // Minimum connections to keep alive
  acquireTimeoutMillis: 30000, // Time to wait for connection from pool
  createTimeoutMillis: 30000, // Time to wait for new connection creation
  destroyTimeoutMillis: 5000, // Time to wait for connection destruction
  reapIntervalMillis: 1000, // How often to check for idle connections
  createRetryIntervalMillis: 200 // Retry interval for failed connections
});

// Enhanced connection monitoring
pool.on('connect', (client) => {
  console.log('✅ New PostgreSQL client connected');

  // Set client encoding and timezone
  client.query('SET application_name = $1', ['writer-dashboard']);
});

pool.on('acquire', () => {
  console.log('🔄 PostgreSQL client acquired from pool');
});

pool.on('remove', () => {
  console.log('🗑️ PostgreSQL client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ PostgreSQL pool error:', err.message);
  console.error('❌ Error details:', {
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    address: err.address,
    port: err.port
  });

  // Try to reconnect after error
  setTimeout(() => {
    console.log('🔄 Attempting to reconnect to PostgreSQL...');
    testConnection(1);
  }, 5000);
});

// Test connection on startup with retry logic
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔍 Testing PostgreSQL connection (attempt ${i + 1}/${retries})...`);
      const client = await pool.connect();

      // Test with a simple query
      const result = await client.query('SELECT NOW() as current_time');
      console.log('🔗 PostgreSQL connection test successful:', result.rows[0].current_time);

      client.release();
      return true;
    } catch (error) {
      console.error(`❌ PostgreSQL connection test failed (attempt ${i + 1}/${retries}):`, error.message);

      if (i < retries - 1) {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error('❌ All PostgreSQL connection attempts failed');
  return false;
}

// Initialize connection test
testConnection();

module.exports = pool;
