const express = require('./server/node_modules/express');
const cors = require('./server/node_modules/cors');
const { Pool } = require('./server/node_modules/pg');
const jwt = require('./server/node_modules/jsonwebtoken');
const { BigQuery } = require('./server/node_modules/@google-cloud/bigquery');
const { Storage } = require('./server/node_modules/@google-cloud/storage');
const path = require('path');

console.log('🚀 Starting complete server with all endpoints...');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: '34.10.59.242',
  database: 'postgres',
  password: 'simplepass123',
  port: 5432,
  ssl: false
});

// Load environment variables
require('dotenv').config();

// BigQuery setup with environment credentials
const setupBigQueryClient = async () => {
  try {
    // Get credentials from environment variable
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!credentialsJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set');
    }

    const credentials = JSON.parse(credentialsJson);
    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";

    const bigquery = new BigQuery({
      credentials: credentials,
      projectId: projectId,
      location: "US",
    });

    console.log(`✅ BigQuery client initialized successfully for project: ${projectId}`);
    return bigquery;
  } catch (error) {
    console.error("❌ Failed to set up BigQuery client:", error);
    return null;
  }
};

// Helper function to run BigQuery queries
const runBigQuery = async (bigquery, query, params) => {
  try {
    console.log('📊 Executing BigQuery:', query.substring(0, 100) + '...');
    console.log('📊 With params:', params);

    const options = { query, params };
    const [rows] = await bigquery.query(options);
    console.log(`📊 BigQuery returned ${rows.length} rows`);
    return rows;
  } catch (error) {
    console.error("❌ Error querying BigQuery:", error);
    throw error;
  }
};

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Health check
app.get('/api/health', (req, res) => {
  console.log('📋 Health check requested');
  res.json({ status: 'OK', message: 'Complete server is running' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password required' 
      });
    }

    // Check user in database
    const userQuery = 'SELECT * FROM login WHERE username = $1';
    const userResult = await pool.query(userQuery, [username]);

    if (userResult.rows.length === 0) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = userResult.rows[0];
    console.log('👤 User found:', user.username, 'Role:', user.role);

    // Check password
    if (user.password !== password) {
      console.log('❌ Password mismatch for:', username);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      'fallback_secret',
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for:', username);

    res.json({
      success: true,
      token,
      username: user.username,
      role: user.role,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Profile endpoint
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    console.log('👤 Profile request for user:', req.user.username);
    
    // Get writer information
    const writerQuery = `
      SELECT w.id as writer_id, w.name, w.email
      FROM writer w
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    const userData = {
      username: req.user.username,
      role: req.user.role,
      name: req.user.username,
      writerId: writerResult.rows[0]?.writer_id || null
    };
    
    res.json({ user: userData });
  } catch (error) {
    console.error('❌ Profile error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submissions endpoint (using your PostgreSQL script suggestion)
app.get('/api/submissions', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Submissions request for user:', req.user.username);
    
    // Get writer_id for this user
    const writerQuery = `
      SELECT w.id as writer_id
      FROM writer w
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      console.log('⚠️ No writer record found for user:', req.user.username);
      return res.json([]);
    }
    
    const writerId = writerResult.rows[0].writer_id;
    console.log('✅ Found writer ID:', writerId);
    
    // Get scripts for this writer
    const { startDate, endDate, searchTitle } = req.query;
    
    let query = `
      SELECT id, title, google_doc_link, approval_status, created_at, loom_url, ai_chat_url, trello_card_id
      FROM script
      WHERE writer_id = $1
    `;
    
    const params = [writerId];
    
    if (startDate && endDate) {
      query += " AND created_at BETWEEN $2 AND $3";
      params.push(startDate, endDate);
    }
    
    if (searchTitle) {
      query += ` AND title ILIKE $${params.length + 1}`;
      params.push(`%${searchTitle}%`);
    }
    
    query += " ORDER BY created_at DESC LIMIT 50;";
    
    const { rows } = await pool.query(query, params);
    
    console.log('📝 Found', rows.length, 'submissions for writer', writerId);
    
    // Transform data for frontend
    const submissions = rows.map(row => ({
      id: row.id,
      title: row.title,
      googleDocLink: row.google_doc_link,
      google_doc_link: row.google_doc_link, // Keep both formats for compatibility
      approval_status: row.approval_status || 'Pending',
      status: row.approval_status || 'Pending',
      created_at: row.created_at,
      submittedOn: row.created_at,
      loom_url: row.loom_url,
      loomUrl: row.loom_url,
      ai_chat_url: row.ai_chat_url,
      trello_card_id: row.trello_card_id,
      type: 'Script' // Default type
    }));
    
    res.json(submissions);
    
  } catch (error) {
    console.error('❌ Submissions error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create submission endpoint
app.post('/api/submissions', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Creating submission for user:', req.user.username);
    
    // Get writer_id for this user
    const writerQuery = `
      SELECT w.id as writer_id
      FROM writer w
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(400).json({ message: 'Writer record not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    const { title, googleDocLink, type } = req.body;
    
    // Insert new script
    const insertQuery = `
      INSERT INTO script (writer_id, title, google_doc_link, approval_status, created_at)
      VALUES ($1, $2, $3, 'Pending', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [writerId, title, googleDocLink]);
    const newScript = result.rows[0];
    
    console.log('✅ Created submission:', newScript.id);
    
    res.json({
      id: newScript.id,
      title: newScript.title,
      googleDocLink: newScript.google_doc_link,
      status: newScript.approval_status,
      submittedOn: newScript.created_at,
      type: type || 'Script'
    });
    
  } catch (error) {
    console.error('❌ Create submission error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// BigQuery writer views endpoint
app.get("/api/writer/views", authenticateToken, async (req, res) => {
  const { writer_id, startDate, endDate } = req.query;

  // Validate required parameters
  if (!writer_id || !startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "Missing writer_id, startDate, or endDate" });
  }

  try {
    console.log('📊 BigQuery views request:', { writer_id, startDate, endDate });

    // Initialize BigQuery client
    const bigquery = await setupBigQueryClient();
    if (!bigquery) {
      console.log('⚠️ BigQuery not available, returning mock data');
      // Return mock data for testing
      const mockData = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        mockData.push({
          time: { value: d.toISOString().split('T')[0] },
          views: Math.floor(Math.random() * 100000) + 50000
        });
      }

      console.log(`📊 Returning ${mockData.length} mock data points`);
      return res.json(mockData);
    }

    // 1️⃣ Get excluded URLs from Postgres
    const excludeQuery = `
      SELECT url
      FROM video
      WHERE writer_id = $1
        AND video_cat = 'full to short'
    `;
    const { rows: excludeRows } = await pool.query(excludeQuery, [
      parseInt(writer_id),
    ]);
    const excludeUrls = excludeRows.map((row) => row.url);

    // 2️⃣ Get writer name from PostgreSQL and build the exclusion part for BigQuery
    const writerQuery = `
      SELECT name FROM writer WHERE id = $1
    `;
    const { rows: writerRows } = await pool.query(writerQuery, [parseInt(writer_id)]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writer_id} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`📝 Found writer name: ${writerName} for ID: ${writer_id}`);

    let urlExclusionClause = "";
    let bigQueryParams = {
      writer_name: writerName, // Use actual writer name from PostgreSQL
      startDate,
      endDate,
    };

    if (excludeUrls.length > 0) {
      const urlPlaceholders = excludeUrls
        .map((_, idx) => `@url${idx}`)
        .join(", ");
      urlExclusionClause = `AND url NOT IN (${urlPlaceholders})`;

      excludeUrls.forEach((url, idx) => {
        bigQueryParams[`url${idx}`] = url;
      });
    }

    // 3️⃣ Build the final BigQuery SQL using correct table schema
    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = "dbt_youtube_analytics";
    const table = "youtube_metadata_historical";

    const query = `
      SELECT snapshot_date AS time, SUM(CAST(statistics_view_count AS INT64)) AS views
      FROM \`${projectId}.${dataset}.${table}\`
      WHERE writer_id = @writer_id
        AND snapshot_date BETWEEN @startDate AND @endDate
        AND snapshot_date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
        ${urlExclusionClause}
      GROUP BY snapshot_date
      ORDER BY snapshot_date DESC;
    `;

    // 4️⃣ Run the query
    const rows = await runBigQuery(bigquery, query, bigQueryParams);

    // 5️⃣ Transform data to match frontend format
    const transformedData = rows.map(row => ({
      time: { value: row.time.value },
      views: parseInt(row.views)
    }));

    console.log(`✅ Sending ${transformedData.length} BigQuery data points`);
    res.json(transformedData);

  } catch (error) {
    console.error("❌ Error querying views data:", error);
    res.status(500).json({ error: "Error querying views data" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Complete server running on port ${PORT}`);
  console.log(`📋 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`👤 Profile: http://localhost:${PORT}/api/auth/profile`);
  console.log(`📝 Submissions: http://localhost:${PORT}/api/submissions`);
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
});
