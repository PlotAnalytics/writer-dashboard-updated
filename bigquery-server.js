const express = require('./server/node_modules/express');
const cors = require('./server/node_modules/cors');
const jwt = require('./server/node_modules/jsonwebtoken');
const { BigQuery } = require('./server/node_modules/@google-cloud/bigquery');
const { Storage } = require('./server/node_modules/@google-cloud/storage');
const { Pool } = require('./server/node_modules/pg');
const path = require('path');

console.log('🚀 Starting BigQuery server...');

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
    throw error;
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
  res.json({ status: 'OK', message: 'BigQuery server is running' });
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

// Initialize BigQuery client once at startup
let bigqueryClient = null;

const initializeBigQuery = async () => {
  try {
    bigqueryClient = await setupBigQueryClient();
    console.log('🎯 BigQuery client ready for requests');
  } catch (error) {
    console.error('❌ Failed to initialize BigQuery at startup:', error);
    process.exit(1); // Exit if BigQuery setup fails since it's required
  }
};

// BigQuery writer views endpoint
app.get("/api/writer/views", authenticateToken, async (req, res) => {
  const { writer_id, startDate, endDate } = req.query;

  // Validate required parameters
  if (!writer_id || !startDate || !endDate) {
    return res.status(400).json({ 
      error: "Missing writer_id, startDate, or endDate" 
    });
  }

  try {
    console.log('📊 BigQuery views request:', { writer_id, startDate, endDate });

    if (!bigqueryClient) {
      return res.status(500).json({ error: "BigQuery client not initialized" });
    }

    // Get excluded URLs from Postgres
    const excludeQuery = `
      SELECT url 
      FROM video 
      WHERE writer_id = $1 
        AND video_cat = 'full to short'
    `;
    const { rows: excludeRows } = await pool.query(excludeQuery, [parseInt(writer_id)]);
    const excludeUrls = excludeRows.map((row) => row.url);

    // Get writer name from PostgreSQL
    const writerQuery = `
      SELECT name FROM writer WHERE id = $1
    `;
    const { rows: writerRows } = await pool.query(writerQuery, [parseInt(writer_id)]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writer_id} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`📝 Found writer name: ${writerName} for ID: ${writer_id}`);

    // Build the exclusion part for BigQuery
    let urlExclusionClause = "";
    let bigQueryParams = {
      writer_id: parseInt(writer_id), // Use writer_id for BigQuery table
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

    // Build the final BigQuery SQL using correct table schema
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

    // Run the query
    const rows = await runBigQuery(bigqueryClient, query, bigQueryParams);

    // Transform data to match frontend format
    const transformedData = rows.map(row => ({
      time: { value: row.time.value },
      views: parseInt(row.views)
    }));

    console.log(`✅ Sending ${transformedData.length} BigQuery data points`);
    res.json(transformedData);

  } catch (error) {
    console.error("❌ Error querying BigQuery views data:", error);
    res.status(500).json({ error: "Error querying BigQuery views data" });
  }
});

// Start server after BigQuery initialization
const startServer = async () => {
  try {
    await initializeBigQuery();
    
    app.listen(PORT, () => {
      console.log(`✅ BigQuery server running on port ${PORT}`);
      console.log(`📋 Health: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
      console.log(`📊 Views: http://localhost:${PORT}/api/writer/views`);
      console.log(`🎯 BigQuery integration: ACTIVE`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
});

// Start the server
startServer();
