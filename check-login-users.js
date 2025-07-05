const { Pool } = require('pg');

// Create PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: '34.10.59.242',
  database: 'postgres',
  password: 'simplepass123',
  port: 5432,
  ssl: false
});

async function checkLoginUsers() {
  try {
    console.log('🔍 Checking users in PostgreSQL login table...');
    
    // Get all users from login table
    const result = await pool.query('SELECT id, username, role FROM login ORDER BY id');
    
    console.log(`📊 Found ${result.rows.length} users in login table:`);
    result.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}, Username: "${user.username}", Role: ${user.role}`);
    });
    
    // Also check writer table to see the mapping
    console.log('\n🔍 Checking writer table mapping...');
    const writerResult = await pool.query(`
      SELECT w.id as writer_id, w.name as writer_name, w.login_id, l.username 
      FROM writer w 
      LEFT JOIN login l ON w.login_id = l.id 
      ORDER BY w.id
    `);
    
    console.log(`📊 Found ${writerResult.rows.length} writers with login mapping:`);
    writerResult.rows.forEach((writer, index) => {
      console.log(`  ${index + 1}. Writer ID: ${writer.writer_id}, Name: "${writer.writer_name}", Login ID: ${writer.login_id}, Username: "${writer.username}"`);
    });
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await pool.end();
  }
}

checkLoginUsers();
