const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

/**
 * Run the viewer retention reason migration
 */
async function runViewerRetentionMigration() {
  try {
    console.log('🚀 Running viewer retention reason migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add_viewer_retention_reason_column.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration (remove the \d script command as it's PostgreSQL specific)
    const cleanSql = migrationSql.replace(/\\d script;/g, '');
    
    await pool.query(cleanSql);
    
    console.log('✅ Migration completed successfully');
    
    // Verify the column was added
    const verifyQuery = `
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'script' 
      AND column_name = 'viewer_retention_reason';
    `;
    
    const result = await pool.query(verifyQuery);
    
    if (result.rows.length > 0) {
      console.log('📋 Column details:', result.rows[0]);
      console.log('🎉 viewer_retention_reason column added successfully!');
    } else {
      console.log('❌ Column not found after migration');
    }
    
    return {
      success: true,
      columnAdded: result.rows.length > 0,
      columnDetails: result.rows[0] || null
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// If this file is run directly, execute the migration
if (require.main === module) {
  runViewerRetentionMigration()
    .then((result) => {
      console.log('🎉 Migration complete:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runViewerRetentionMigration
};
