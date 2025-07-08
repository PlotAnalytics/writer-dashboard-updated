const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

/**
 * Initialize notification database schema
 * Creates tables for milestone notifications and tracking
 */
async function initializeNotificationSchema() {
  try {
    console.log('🚀 Initializing notification database schema...');
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'notifications_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schemaSql);
    
    console.log('✅ Notification schema initialized successfully');
    
    // Verify tables were created
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('milestone_notifications', 'video_milestone_tracking', 'notification_preferences')
      ORDER BY table_name;
    `;
    
    const result = await pool.query(verifyQuery);
    console.log('📋 Created tables:', result.rows.map(row => row.table_name));
    
    // Check if we have any existing writers to set up preferences for
    const writerCountQuery = 'SELECT COUNT(*) as count FROM writer';
    const writerCount = await pool.query(writerCountQuery);
    console.log(`👥 Found ${writerCount.rows[0].count} writers in database`);
    
    return {
      success: true,
      tablesCreated: result.rows.map(row => row.table_name),
      writerCount: parseInt(writerCount.rows[0].count)
    };
    
  } catch (error) {
    console.error('❌ Failed to initialize notification schema:', error);
    throw error;
  }
}

/**
 * Check if notification schema exists
 */
async function checkNotificationSchema() {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('milestone_notifications', 'video_milestone_tracking', 'notification_preferences');
    `;
    
    const result = await pool.query(checkQuery);
    const existingTables = result.rows.map(row => row.table_name);
    
    return {
      exists: existingTables.length === 3,
      existingTables,
      missingTables: ['milestone_notifications', 'video_milestone_tracking', 'notification_preferences']
        .filter(table => !existingTables.includes(table))
    };
  } catch (error) {
    console.error('❌ Error checking notification schema:', error);
    return { exists: false, error: error.message };
  }
}

/**
 * Drop notification schema (for development/testing)
 */
async function dropNotificationSchema() {
  try {
    console.log('🗑️ Dropping notification schema...');
    
    const dropSql = `
      DROP TABLE IF EXISTS milestone_notifications CASCADE;
      DROP TABLE IF EXISTS video_milestone_tracking CASCADE;
      DROP TABLE IF EXISTS notification_preferences CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `;
    
    await pool.query(dropSql);
    console.log('✅ Notification schema dropped successfully');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to drop notification schema:', error);
    throw error;
  }
}

// If this file is run directly, initialize the schema
if (require.main === module) {
  initializeNotificationSchema()
    .then((result) => {
      console.log('🎉 Notification database setup complete:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = {
  initializeNotificationSchema,
  checkNotificationSchema,
  dropNotificationSchema
};
