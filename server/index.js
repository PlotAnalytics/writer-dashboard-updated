const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const WebSocket = require("ws");
const axios = require("axios");
const { BigQuery } = require("@google-cloud/bigquery");
const authRoutes = require("./routes/auth");
const submissionRoutes = require("./routes/submissions");
const analyticsRoutes = require("./routes/analytics");
const userRoutes = require("./routes/user");
const influxRoutes = require("./routes/influx");
const dataExplorerRoutes = require("./routes/dataExplorer");
const notificationRoutes = require("./routes/notifications");
const RedisService = require("./services/redisService");

dotenv.config();

// Initialize BigQuery client globally
const setupBigQueryClient = async () => {
  try {
    const fs = require('fs');
    const path = require('path');

    // Try to load credentials from admin_dashboard.json file first
    let credentials;
    const credentialsPath = path.join(__dirname, '..', 'admin_dashboard.json');

    if (fs.existsSync(credentialsPath)) {
      console.log(`🔍 BigQuery: Loading credentials from admin_dashboard.json`);
      const credentialsFile = fs.readFileSync(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsFile);
    } else {
      // Fallback to environment variable
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

      if (!credentialsJson) {
        throw new Error(
          "Neither admin_dashboard.json file nor GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable found"
        );
      }

      console.log(`🔍 BigQuery: Loading credentials from environment variable`);
      credentials = JSON.parse(credentialsJson);
    }

    const projectId = credentials.project_id || process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";

    console.log(`🔍 BigQuery Debug: Using project ID: "${projectId}"`);
    console.log(
      `🔍 BigQuery Debug: Credentials project_id: "${credentials.project_id}"`
    );
    console.log(
      `🔍 BigQuery Debug: Service account email: "${credentials.client_email}"`
    );

    const bigquery = new BigQuery({
      credentials: credentials,
      projectId: projectId,
      location: "US",
    });

    console.log(
      `✅ BigQuery client initialized successfully for project: ${projectId}`
    );
    console.log(
      `✅ Using service account: ${credentials.client_email}`
    );
    return bigquery;
  } catch (error) {
    console.error("❌ Failed to set up BigQuery client:", error);
    throw error;
  }
};

// Initialize BigQuery client
const initializeBigQuery = async () => {
  try {
    global.bigqueryClient = await setupBigQueryClient();
    console.log("🎯 BigQuery client ready for requests");
  } catch (error) {
    console.error("❌ Failed to initialize BigQuery:", error);
    global.bigqueryClient = null;
  }
};

// Initialize BigQuery on server start
initializeBigQuery();

// Initialize Redis service
const redisService = new RedisService();
global.redisService = redisService;

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize database connection
let pool;
try {
  pool = require("./config/database");
  console.log("✅ Database connection initialized");
} catch (error) {
  console.error("❌ Failed to initialize database:", error);
}

// Middleware
app.use(cors());
app.use(express.json());

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret"
    );
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/influx", influxRoutes);
app.use("/api/data-explorer", dataExplorerRoutes);
app.use("/api/notifications", notificationRoutes);

// Feedback endpoint for Slack integration
app.post('/api/feedback', async (req, res) => {
  try {
    const { problem, screenshot, timestamp, userAgent, url } = req.body;

    // Get user info from session if available
    const userId = req.session?.user?.id || 'Unknown';
    const userName = req.session?.user?.name || 'Anonymous User';

    // Format message for Slack
    const slackMessage = {
      text: "🐛 New Feedback Received",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🐛 New Feedback Report"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*User:* ${userName} (ID: ${userId})`
            },
            {
              type: "mrkdwn",
              text: `*Time:* ${new Date(timestamp).toLocaleString()}`
            },
            {
              type: "mrkdwn",
              text: `*Page:* ${url}`
            },
            {
              type: "mrkdwn",
              text: `*Browser:* ${userAgent.split(' ')[0]}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Problem Description:*\n\`\`\`${problem}\`\`\``
          }
        }
      ]
    };

    if (screenshot) {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Screenshot:* ${screenshot}`
        }
      });
    }

    // Send to Slack webhook - using environment variable for security
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/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';

    if (!slackWebhookUrl || slackWebhookUrl.includes('placeholder')) {
      console.error('SLACK_WEBHOOK_URL not properly configured');
      return res.status(500).json({ error: 'Slack integration not configured' });
    }

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    console.log('Feedback sent to Slack successfully');
    res.json({ success: true, message: 'Feedback sent successfully' });

  } catch (error) {
    console.error('Error sending feedback to Slack:', error);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

// Route /api/writer/videos to BigQuery-powered analytics endpoint
app.use("/api/writer", analyticsRoutes);

// Quick debug endpoint for writer 130 videos (no auth required)
app.get("/api/debug-writer-130", async (req, res) => {
  try {
    const writerId = 130;
    console.log(`🔍 DEBUG: Checking video data for writer ${writerId}`);

    if (!pool) {
      return res.json({ error: "Database not available" });
    }

    // Check videos in video table
    const videoTableQuery = `
      SELECT id, script_title, url, video_cat, writer_id
      FROM video
      WHERE writer_id = $1
        AND url LIKE '%youtube.com%'
      ORDER BY id DESC
      LIMIT 10
    `;
    const { rows: videoTableRows } = await pool.query(videoTableQuery, [writerId]);

    // Check videos in statistics_youtube_api table
    const statsTableQuery = `
      SELECT video_id, duration, views_total, posted_date
      FROM statistics_youtube_api
      WHERE video_id IN (
        SELECT CAST(id AS VARCHAR) FROM video WHERE writer_id = $1
      )
      ORDER BY video_id DESC
      LIMIT 10
    `;
    const { rows: statsTableRows } = await pool.query(statsTableQuery, [writerId]);

    // Check INNER JOIN result (what the current query returns)
    const innerJoinQuery = `
      SELECT v.id, v.script_title, v.url, s.duration, s.views_total
      FROM video v
      INNER JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
        AND v.url LIKE '%youtube.com%'
      ORDER BY v.id DESC
      LIMIT 10
    `;
    const { rows: innerJoinRows } = await pool.query(innerJoinQuery, [writerId]);

    res.json({
      success: true,
      writerId: writerId,
      videoTable: {
        count: videoTableRows.length,
        videos: videoTableRows.map(v => ({
          id: v.id,
          title: v.script_title,
          url: v.url?.substring(0, 60) + '...',
          category: v.video_cat
        }))
      },
      statisticsTable: {
        count: statsTableRows.length,
        videos: statsTableRows.map(s => ({
          video_id: s.video_id,
          duration: s.duration,
          views: s.views_total
        }))
      },
      innerJoinResult: {
        count: innerJoinRows.length,
        videos: innerJoinRows.map(v => ({
          id: v.id,
          title: v.script_title,
          duration: v.duration,
          views: v.views_total
        }))
      }
    });

  } catch (error) {
    console.error('❌ Debug writer 130 error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoints for Dashboard.jsx
app.get("/api/tropes", async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query(
        "SELECT id, number, name FROM tropes ORDER BY number"
      );
      res.json(result.rows);
    } else {
      // Fallback data
      res.json([
        { id: 1, number: 1, name: "Sample Trope 1" },
        { id: 2, number: 2, name: "Sample Trope 2" },
        { id: 3, number: 3, name: "Sample Trope 3" },
      ]);
    }
  } catch (error) {
    console.error("Error fetching tropes:", error);
    res.status(500).json({ error: "Failed to fetch tropes" });
  }
});

// Debug endpoint to test BigQuery avgViewDuration for specific YouTube video ID
app.get("/api/debug-bigquery-duration/:youtubeVideoId", async (req, res) => {
  try {
    const { youtubeVideoId } = req.params;
    const { writer_name = "Antonio Samson" } = req.query;

    console.log(`🔍 DEBUG: Testing BigQuery avgViewDuration for YouTube video ${youtubeVideoId} - v2`);

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: "BigQuery client not initialized" });
    }

    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = "dbt_youtube_analytics";
    const reportTable = "youtube_video_report_historical";

    const query = `
      SELECT
        video_id,
        video_title as title,
        average_view_duration_seconds,
        average_view_duration_percentage,
        watch_time_minutes,
        video_duration_seconds,
        writer_name,
        date_day
      FROM \`${projectId}.${dataset}.${reportTable}\`
      WHERE video_id = @video_id
        AND writer_name = @writer_name
      ORDER BY date_day DESC
      LIMIT 1
    `;

    const params = {
      writer_name: writer_name,
      video_id: youtubeVideoId,
    };

    console.log(`🔍 BigQuery query params:`, params);
    const [rows] = await global.bigqueryClient.query({ query, params });

    if (rows.length === 0) {
      return res.json({
        error: `Video ${youtubeVideoId} not found in BigQuery for writer ${writer_name}`,
        query_params: params
      });
    }

    const video = rows[0];

    // Calculate avgViewDuration from average_view_duration_seconds
    let avgViewDuration = "0:00";
    if (video.average_view_duration_seconds) {
      const totalSeconds = Math.floor(video.average_view_duration_seconds); // Use floor for consistency
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      avgViewDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    res.json({
      youtube_video_id: youtubeVideoId,
      writer_name: writer_name,
      bigquery_data: {
        title: video.title,
        average_view_duration_seconds: video.average_view_duration_seconds,
        calculated_avg_view_duration: avgViewDuration,
        average_view_duration_percentage: video.average_view_duration_percentage,
        watch_time_minutes: video.watch_time_minutes,
        video_duration_seconds: video.video_duration_seconds,
        date_day: video.date_day
      },
      calculation_details: {
        raw_seconds: video.average_view_duration_seconds,
        floored_seconds: Math.floor(video.average_view_duration_seconds),
        minutes: Math.floor(Math.floor(video.average_view_duration_seconds) / 60),
        remaining_seconds: Math.floor(video.average_view_duration_seconds) % 60,
        formatted: avgViewDuration
      }
    });

  } catch (error) {
    console.error("❌ BigQuery debug endpoint error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
});

app.get("/api/structures", async (req, res) => {
  try {
    if (pool) {
      const query = `
        SELECT s.id AS structure_id, s.name,
          COALESCE(json_agg(json_build_object('id', w.id, 'name', w.name))
            FILTER (WHERE w.id IS NOT NULL), '[]') AS writers
        FROM structures s
        LEFT JOIN writer_structures ws ON s.id = ws.structure_id
        LEFT JOIN writer w ON ws.writer_id = w.id
        GROUP BY s.id, s.name
        ORDER BY s.id ASC;
      `;
      const result = await pool.query(query);
      res.json({ structures: result.rows });
    } else {
      // Fallback data
      res.json({
        structures: [
          { structure_id: 1, name: "Three Act Structure", writers: [] },
          { structure_id: 2, name: "Hero's Journey", writers: [] },
        ],
      });
    }
  } catch (error) {
    console.error("Error fetching structures:", error);
    res.status(500).json({ error: "Error fetching structures." });
  }
});

app.get("/api/scripts", async (req, res) => {
  const { writer_id, startDate, endDate, searchTitle } = req.query;

  try {
    if (pool && writer_id) {
      let query = `
        SELECT id, title, google_doc_link, approval_status, created_at, loom_url, ai_chat_url
        FROM script
        WHERE writer_id = $1
      `;

      const params = [writer_id];

      if (startDate && endDate) {
        query += " AND created_at BETWEEN $2 AND $3";
        params.push(startDate, endDate);
      }

      if (searchTitle) {
        query += ` AND title ILIKE $${params.length + 1}`;
        params.push(`%${searchTitle}%`);
      }

      query += " ORDER BY created_at DESC;";

      const { rows } = await pool.query(query, params);
      res.json(rows);
    } else {
      // Return empty array if no writer_id or no database
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching scripts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Function to create Trello Card
const createTrelloCard = async (
  apiKey,
  token,
  listId,
  name,
  desc,
  attachments = []
) => {
  try {
    // Create Trello card
    const cardResponse = await axios.post(
      `https://api.trello.com/1/cards?key=${apiKey}&token=${token}`,
      {
        idList: listId,
        name,
        desc,
      }
    );

    const cardId = cardResponse.data.id;

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await axios.post(
          `https://api.trello.com/1/cards/${cardId}/attachments?key=${apiKey}&token=${token}`,
          { url: attachment }
        );
      }
    }

    return cardId;
  } catch (error) {
    console.error(
      "Failed to create Trello card:",
      error.response ? error.response.data : error.message
    );
    return null;
  }
};

app.post("/api/scripts", async (req, res) => {
  const { writer_id, title, googleDocLink, aiChatUrl } = req.body;
  try {
    // Fetch Trello settings
    const settingsResult = await pool.query(
      "SELECT api_key, token, list_id FROM settings ORDER BY id DESC LIMIT 1"
    );
    if (settingsResult.rows.length === 0) {
      return res.status(500).json({ error: "Trello settings not configured" });
    }
    const { api_key: apiKey, token, list_id: listId } = settingsResult.rows[0];

    // Fetch writer details (name and payment_scale)
    const writerResult = await pool.query(
      "SELECT name FROM writer WHERE id = $1",
      [writer_id]
    );
    const writerSettingsResult = await pool.query(
      "SELECT skip_qa FROM writer_settings WHERE writer_id = $1",
      [writer_id]
    );
    const name = writerResult.rows[0]?.name;
    const skipQA = writerSettingsResult.rows[0]?.skip_qa;
    if (!name) {
      return res.status(404).json({ error: "Writer not found" });
    }

    const storyContinuationID = "6801db782202edad6322e7f5";
    // Determine Trello list ID and status
    const autoApprovedListID = "66982de89e8cb1bfb456ba0a";

    // Check if title contains "STL" keyword
    const isStoryLine = title.includes("STL");
    let targetListId;
    let trelloStatus;

    // Handle STL case separately from skipQA logic
    if (isStoryLine) {
      // If it's a story line (contains STL), use story continuation list and status
      targetListId = storyContinuationID;
      trelloStatus = "Story Continuation";
    } else {
      // If it's not a story line, apply the skipQA logic
      targetListId = skipQA ? autoApprovedListID : listId;
      trelloStatus = skipQA
        ? "Approved Script. Ready for production"
        : "Writer Submissions (QA)";
    }

    // Create a Trello card
    const trelloCardId = await createTrelloCard(
      apiKey,
      token,
      targetListId,
      `${name} - ${title}`,
      `Script submitted by ${name}.`,
      [googleDocLink]
    );
    if (!trelloCardId) {
      return res.status(500).json({ error: "Failed to create Trello card" });
    }

    // Insert script into the database with trello_card_id (only if no errors occurred)
    const { rows } = await pool.query(
      `INSERT INTO script (writer_id, title, google_doc_link, approval_status, trello_card_id, ai_chat_url, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
      [writer_id, title, googleDocLink, trelloStatus, trelloCardId, aiChatUrl]
    );
    const script = rows[0];

    // Call getPostingAccount API to get a posting account for this card
    try {
      // Use the server's own URL for the API call
      // In production, use the actual domain; in development, use localhost
      const serverUrl =
        process.env.SERVER_URL ||
        (process.env.NODE_ENV === "production"
          ? `https://${
              process.env.VERCEL_URL ||
              "https://writer-dashboard-updated.vercel.app"
            }`
          : `http://localhost:${PORT}`);

      console.log(
        `Making internal API call to: ${serverUrl}/api/getPostingAccount`
      );
      const response = await axios.post(`${serverUrl}/api/getPostingAccount`, {
        trello_card_id: trelloCardId,
        ignore_daily_limit: Boolean(isStoryLine),
      });
      const accountName = response.data?.account;

      if (accountName) {
        try {
          // Query to find account ID based on the name
          const accountQuery = await pool.query(
            `SELECT id FROM posting_accounts WHERE account = $1`,
            [accountName]
          );
          const accountId = accountQuery.rows[0]?.id;

          if (accountId) {
            // Update script row with account_id
            await pool.query(
              `UPDATE script SET account_id = $1 WHERE id = $2`,
              [accountId, script.id]
            );
            console.log(
              `Updated script ${script.id} with account ID ${accountId}`
            );
          } else {
            console.warn(
              `Account name "${accountName}" not found in posting_accounts table`
            );
          }
        } catch (err) {
          console.error(
            "Failed to update script with posting account ID:",
            err
          );
        }
      }

      console.log(`Posting account assigned for card ${trelloCardId}`);
    } catch (postingAccountError) {
      console.error("Error assigning posting account:", postingAccountError);
      console.error("Error details:", {
        message: postingAccountError.message,
        code: postingAccountError.code,
        errno: postingAccountError.errno,
        syscall: postingAccountError.syscall,
        address: postingAccountError.address,
        port: postingAccountError.port,
        config: postingAccountError.config
          ? {
              url: postingAccountError.config.url,
              method: postingAccountError.config.method,
              baseURL: postingAccountError.config.baseURL,
            }
          : "No config available",
      });
      // Continue execution - don't fail the request if posting account assignment fails
    }

    // Send data to Google Sheets using Apps Script Web App URL
    const appsScriptUrl =
      "https://script.google.com/macros/s/AKfycbwILP9cSYbvA8yY1ZKXP-HYsB3u5ILtlZ52Iy6dPxjrFbXqdMPdQD995FItpP3Okj5Lgg/exec";
    const data = {
      writer_id: writer_id,
      title: title,
      google_doc_link: googleDocLink,
      approval_status: trelloStatus,
      created_at: script.created_at,
      trello_card_id: trelloCardId,
    };
    try {
      await axios.post(appsScriptUrl, data);
    } catch (appsScriptError) {
      console.error(
        "Error sending data to Google Apps Script:",
        appsScriptError
      );
      return res
        .status(500)
        .json({ error: "Failed to send data to Google Sheets" });
    }

    // Broadcast update via WebSocket
    broadcastUpdate(script);

    res.status(201).json(script);
  } catch (error) {
    console.error("Error submitting script:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update video links API
app.post("/api/updateLinks", async (req, res) => {
  const { trello_card_id, status, video_url, short_vid_url } = req.body;

  if (!trello_card_id || !status || !video_url || !short_vid_url) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const normalizedStatus = status.trim().toLowerCase();

    if (normalizedStatus === "posted") {
      const vidUpdateQuery = `
              UPDATE video
              SET url = CASE
                          WHEN video_cat = 'short' THEN $1
                          WHEN video_cat = 'full' THEN $2
                        END
              WHERE trello_card_id = $3
              RETURNING *;
          `;
      const result = await pool.query(vidUpdateQuery, [
        short_vid_url,
        video_url,
        trello_card_id,
      ]);

      console.log("Updated rows:", result.rows);
      res
        .status(200)
        .json({ message: "Video links updated", updated: result.rows });
    } else {
      res
        .status(200)
        .json({ message: `No update needed for status: ${normalizedStatus}` });
    }
  } catch (error) {
    console.error("Error updating video links:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update script status API
app.post("/api/updateStatus", async (req, res) => {
  const {
    trello_card_id,
    status,
    long_video_url,
    timestamp,
    loom,
    short_video_url,
  } = req.body;
  try {
    // Normalize the status
    const normalizedStatus =
      status.trim().toLowerCase() === "rejected" ? "Rejected" : status;
    // Update the script status in the script table
    const query = `
      UPDATE script
      SET approval_status = $1,
          loom_url = CASE WHEN $2 = 'Rejected' THEN $3 ELSE loom_url END
      WHERE trello_card_id = $4
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      normalizedStatus,
      normalizedStatus,
      loom,
      trello_card_id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({
        error: `Script not found for the given Trello Card ID: ${trello_card_id}. Unable to update status to ${normalizedStatus}.`,
      });
    }
    const script = rows[0];

    // Log the status update to trello_card_movements table
    const movementQuery = `
      INSERT INTO trello_card_movements (timestamp, trello_card_id, status)
      VALUES (NOW(), $1, $2)
    `;
    await pool.query(movementQuery, [trello_card_id, normalizedStatus]);
    console.log(`:white_check_mark: Status movement logged: ${trello_card_id} -> ${normalizedStatus}`);

    // If the status is "Posted", insert into the video table
    if (
      (normalizedStatus === "Posted" && short_video_url) ||
      (long_video_url && timestamp)
    ) {
      // Check if the video URL already exists
      const checkCardExist = `
            SELECT id FROM video WHERE trello_card_id = $1;
        `;
      const cardExistsResult = await pool.query(checkCardExist, [
        trello_card_id,
      ]);
      const checkUrlQuery = `
            SELECT id FROM video WHERE url = $1;
        `;
      const urlExistsResult = await pool.query(checkUrlQuery, [long_video_url]);
      const shortUrlCheck = `
            SELECT id FROM video WHERE url = $1;
        `;
      const shortUrlExistsResult = await pool.query(shortUrlCheck, [
        short_video_url,
      ]);
      // Fetch writer_id, title, account_id
      const writerQuery = `
            SELECT writer_id, title, account_id FROM script WHERE trello_card_id = $1;
        `;
      const writerResult = await pool.query(writerQuery, [trello_card_id]);
      const writer_id = writerResult.rows[0]?.writer_id;
      const script_title = writerResult.rows[0]?.title;
      let account_id = writerResult.rows[0]?.account_id;

      // If account_id is null, get it from Trello posting account field
      if (!account_id) {
        console.log(`🔍 No account_id in script table (value: ${account_id}), reading from Trello posting account field...`);
        try {
          const settingsResult = await pool.query(
            "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
          );

          if (settingsResult.rows.length > 0) {
            const { api_key, token } = settingsResult.rows[0];

            // Get card and board info
            const cardResponse = await axios.get(
              `https://api.trello.com/1/cards/${trello_card_id}?key=${api_key}&token=${token}&customFieldItems=true`
            );
            const boardId = cardResponse.data.idBoard;
            console.log(`🔧 Card board ID: ${boardId}`);
            console.log(`🔧 Custom field items on card:`, JSON.stringify(cardResponse.data.customFieldItems, null, 2));

            // Get custom fields on board
            const customFieldsResponse = await axios.get(
              `https://api.trello.com/1/boards/${boardId}/customFields?key=${api_key}&token=${token}`
            );
            console.log(`🔧 Available custom fields on board:`, customFieldsResponse.data.map(f => ({name: f.name, id: f.id, type: f.type})));

            // Find "Posting Account" field
            const postingAccountFieldDef = customFieldsResponse.data.find(
              field => field.name === "Posting Account"
            );

            if (postingAccountFieldDef) {
              console.log(`✅ Found "Posting Account" field definition:`, {
                id: postingAccountFieldDef.id,
                name: postingAccountFieldDef.name,
                type: postingAccountFieldDef.type,
                options: postingAccountFieldDef.options?.map(opt => ({id: opt.id, text: opt.value.text}))
              });

              // Find value for this field on the card
              const customFields = cardResponse.data.customFieldItems || [];
              const postingAccountField = customFields.find(field =>
                field.idCustomField === postingAccountFieldDef.id
              );

              console.log(`🔧 Posting account field value on card:`, postingAccountField);

              if (postingAccountField && (postingAccountField.value || postingAccountField.idValue)) {
                let accountName = null;

                console.log(`🔧 Raw posting account field:`, JSON.stringify(postingAccountField, null, 2));

                // Handle dropdown value (idValue) - check the field directly, not the value property
                if (postingAccountField.idValue) {
                  console.log(`🔧 Found idValue: ${postingAccountField.idValue}`);
                  const selectedOption = postingAccountFieldDef.options?.find(
                    option => option.id === postingAccountField.idValue
                  );
                  if (selectedOption) {
                    accountName = selectedOption.value.text;
                    console.log(`🔧 Mapped idValue to text: "${accountName}"`);
                  } else {
                    console.log(`⚠️ Could not find option for idValue: ${postingAccountField.idValue}`);
                  }
                }
                // Handle text value
                else if (postingAccountField.value && postingAccountField.value.text) {
                  accountName = postingAccountField.value.text;
                  console.log(`🔧 Found direct text value: "${accountName}"`);
                }
                // Handle number value (if account_id is passed directly)
                else if (postingAccountField.value && postingAccountField.value.number) {
                  console.log(`🔧 Found number value: ${postingAccountField.value.number}`);
                  account_id = postingAccountField.value.number;
                  console.log(`✅ Using direct account_id: ${account_id}`);
                }

                // If we got an account name, look it up in the database
                if (accountName) {
                  console.log(`📋 Looking up posting account in database: "${accountName}"`);

                  // Look up account_id from posting_accounts table
                  const accountQuery = await pool.query(
                    `SELECT id, account FROM posting_accounts WHERE account = $1`,
                    [accountName]
                  );

                  console.log(`🔍 Database lookup result:`, accountQuery.rows);

                  if (accountQuery.rows.length > 0) {
                    account_id = accountQuery.rows[0].id;
                    console.log(`✅ Using account_id: ${account_id} for "${accountName}"`);
                  } else {
                    console.warn(`⚠️ Account "${accountName}" not found in posting_accounts table`);

                    // Show available accounts for debugging
                    const allAccountsQuery = await pool.query(`SELECT id, account FROM posting_accounts LIMIT 10`);
                    console.log(`🔍 Available accounts in database:`, allAccountsQuery.rows);

                    account_id = 1; // Default
                  }
                } else if (!account_id) {
                  console.log(`📋 No posting account value found in any format`);
                  account_id = 1; // Default
                }
              } else {
                console.log(`📋 No posting account selected in Trello`);
                account_id = 1; // Default
              }
            } else {
              console.log(`⚠️ "Posting Account" custom field not found`);
              account_id = 1; // Default
            }
          } else {
            console.log(`⚠️ No Trello settings found`);
            account_id = 1; // Default
          }
        } catch (error) {
          console.error("Error reading posting account from Trello:", error.message);
          account_id = 1; // Default
        }
      }
      if (!writer_id) {
        return res.status(404).json({
          error: "Writer ID not found for the given Trello card.",
        });
      }
      // :one: Handle full video_url
      if (urlExistsResult.rows.length === 0) {
        const exists = cardExistsResult.rows.length > 0;
        let videoQuery;
        if (!exists) {
          videoQuery = `
                    INSERT INTO video
                    (url, created, writer_id, script_title, trello_card_id, account_id, video_cat)
                    VALUES ($1, $2, $3, $4, $5, $6, 'long')
                `;
        } else {
          videoQuery = `
                    UPDATE video
                    SET url = $1,
                        created = $2,
                        writer_id = $3,
                        script_title = $4,
                        account_id = $6,
                        video_cat = 'long'
                    WHERE trello_card_id = $5
                `;
        }
        await pool.query(videoQuery, [
          long_video_url,
          timestamp,
          writer_id,
          script_title,
          trello_card_id,
          account_id,
        ]);
      } else {
        console.log(
          ":white_check_mark: Full video URL already exists, skipping insert/update."
        );
      }
      // :two: Handle short_video_url
      if (
        short_video_url &&
        short_video_url !== long_video_url &&
        shortUrlExistsResult.rows.length === 0
      ) {
        const exists = cardExistsResult.rows.length > 0;
        let shortVideoQuery;
        if (!exists) {
          shortVideoQuery = `
                    INSERT INTO video
                    (url, created, writer_id, script_title, trello_card_id, account_id, video_cat)
                    VALUES ($1, $2, $3, $4, $5, $6, 'short')
                `;
        } else {
          shortVideoQuery = `
                    UPDATE video
                    SET url = $1,
                        created = $2,
                        writer_id = $3,
                        script_title = $4,
                        account_id = $6,
                        video_cat = 'short'
                    WHERE trello_card_id = $5
                `;
        }
        await pool.query(shortVideoQuery, [
          short_video_url,
          timestamp,
          writer_id,
          script_title,
          trello_card_id,
          account_id,
        ]);
      } else {
        console.log(
          ":white_check_mark: Short video URL already exists or matches full, skipping."
        );
      }
      // Send update to Google Sheets
      const appsScriptUrl =
        "https://script.google.com/macros/s/AKfycbxexwK5QwIwgYlFGRu7yg33pl46FLDDRyz9e0Z_lkcMYQ-pD8Q8UjZ3fGnEG6-LMSbK/exec";
      const data = {
        trello_card_id,
        approval_status: normalizedStatus,
      };
      try {
        await axios.post(appsScriptUrl, data);
        console.log(
          ":white_check_mark: Approval status updated in Google Sheets."
        );
      } catch (err) {
        console.error(
          ":x: Error sending approval status to Google Sheets:",
          err
        );
      }
    }
    // Broadcast and return success
    broadcastUpdate(script);
    return res.json(script);
  } catch (error) {
    console.error(":x: Error updating script status:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Manual Status Sync Tool - Sync database status with Trello status
app.post("/api/syncStatus", async (req, res) => {
  try {
    console.log("🔄 Starting manual status sync...");

    // Get Trello API credentials
    const settingsResult = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );

    if (settingsResult.rows.length === 0) {
      return res.status(500).json({ error: "Trello settings not configured" });
    }

    const { api_key: apiKey, token } = settingsResult.rows[0];

    // Get all scripts with Trello card IDs that might be out of sync
    const scriptsResult = await pool.query(`
      SELECT id, title, trello_card_id, approval_status, writer_id
      FROM script
      WHERE trello_card_id IS NOT NULL
      AND approval_status NOT IN ('Posted', 'Rejected')
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const scripts = scriptsResult.rows;
    console.log(`📊 Found ${scripts.length} scripts to check`);

    let syncedCount = 0;
    let errors = [];

    // Define Trello list IDs and their corresponding statuses
    const listStatusMap = {
      "66982de89e8cb1bfb456ba0a": "Approved Script. Ready for production", // Auto-approved list
      "6801db782202edad6322e7f5": "Story Continuation", // Story continuation list
      "66982de89e8cb1bfb456ba0b": "Posted", // Posted list (example ID)
      "66982de89e8cb1bfb456ba0c": "Rejected", // Rejected list (example ID)
    };

    for (const script of scripts) {
      try {
        // Get current Trello card info
        const trelloResponse = await axios.get(
          `https://api.trello.com/1/cards/${script.trello_card_id}?key=${apiKey}&token=${token}&fields=idList,name,closed`
        );

        const trelloCard = trelloResponse.data;

        // Skip archived/closed cards
        if (trelloCard.closed) {
          continue;
        }

        // Check if card is in "Posted" list (you'll need to update this with actual Posted list ID)
        let newStatus = null;

        // Get list name to determine status
        const listResponse = await axios.get(
          `https://api.trello.com/1/lists/${trelloCard.idList}?key=${apiKey}&token=${token}&fields=name`
        );

        const listName = listResponse.data.name.toLowerCase();

        // Map list names to statuses
        if (listName.includes('posted') || listName.includes('live')) {
          newStatus = 'Posted';
        } else if (listName.includes('rejected') || listName.includes('denied')) {
          newStatus = 'Rejected';
        } else if (listName.includes('approved') || listName.includes('production')) {
          newStatus = 'Approved Script. Ready for production';
        } else if (listName.includes('qa') || listName.includes('review')) {
          newStatus = 'Writer Submissions (QA)';
        } else if (listName.includes('story') || listName.includes('continuation')) {
          newStatus = 'Story Continuation';
        }

        // Update database if status has changed
        if (newStatus && newStatus !== script.approval_status) {
          await pool.query(
            "UPDATE script SET approval_status = $1 WHERE trello_card_id = $2",
            [newStatus, script.trello_card_id]
          );

          console.log(`✅ Updated ${script.title.substring(0, 50)}... from "${script.approval_status}" to "${newStatus}"`);
          syncedCount++;
        }

      } catch (error) {
        console.error(`❌ Error syncing ${script.title.substring(0, 30)}...`, error.message);
        errors.push({
          title: script.title.substring(0, 50),
          error: error.message
        });
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Sync complete! Updated ${syncedCount} scripts`);

    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} scripts`,
      syncedCount,
      totalChecked: scripts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("❌ Error in status sync:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

// Sync Video Table - Create missing video records for Posted scripts
app.post("/api/syncVideoTable", async (req, res) => {
  console.log("🎬 Starting video table sync...");

  try {
    // Find scripts that are "Posted" but don't have video table entries
    const missingVideosResult = await pool.query(`
      SELECT s.id, s.title, s.trello_card_id, s.writer_id, s.created_at
      FROM script s
      LEFT JOIN video v ON s.trello_card_id = v.trello_card_id
      WHERE s.approval_status = 'Posted'
      AND s.trello_card_id IS NOT NULL
      AND v.trello_card_id IS NULL
      ORDER BY s.created_at DESC
      LIMIT 50
    `);

    const missingVideos = missingVideosResult.rows;
    console.log(`📊 Found ${missingVideos.length} scripts missing video records`);

    if (missingVideos.length === 0) {
      return res.json({ message: "No missing video records found", created: 0 });
    }

    let createdCount = 0;

    // Create video records for each missing script
    for (const script of missingVideos) {
      try {
        // Create placeholder video record (URLs will be updated later when actual videos are posted)
        const videoQuery = `
          INSERT INTO video
          (url, created, writer_id, script_title, trello_card_id, account_id, video_cat)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `;

        const result = await pool.query(videoQuery, [
          '', // Empty URL - will be filled when actual video is posted
          script.created_at,
          script.writer_id,
          script.title,
          script.trello_card_id,
          1, // Default account_id
          'long' // Default to long video
        ]);

        const videoId = result.rows[0].id;
        console.log(`✅ Created video record ${videoId} for script: ${script.title.substring(0, 50)}...`);
        createdCount++;

      } catch (error) {
        console.error(`❌ Error creating video record for ${script.title.substring(0, 30)}:`, error.message);
        continue;
      }
    }

    console.log(`🎉 Video sync complete! Created ${createdCount} video records`);
    res.json({
      message: `Video sync complete! Created ${createdCount} video records`,
      created: createdCount,
      checked: missingVideos.length
    });

  } catch (error) {
    console.error("❌ Error in video table sync:", error);
    res.status(500).json({ error: "Failed to sync video table" });
  }
});

// Sync Video URLs - Populate missing URLs from Trello cards
app.post("/api/syncVideoUrls", async (req, res) => {
  console.log("🔗 Starting video URL sync...");

  try {
    // Get Trello API credentials
    const settingsResult = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );

    if (settingsResult.rows.length === 0) {
      return res.status(500).json({ error: "Trello settings not configured" });
    }

    const { api_key: trelloApiKey, token: trelloToken } = settingsResult.rows[0];

    // Find video records with empty URLs that have trello_card_id
    const emptyUrlsResult = await pool.query(`
      SELECT v.id, v.trello_card_id, v.script_title, s.approval_status, s.writer_id
      FROM video v
      JOIN script s ON v.trello_card_id = s.trello_card_id
      WHERE (v.url = '' OR v.url IS NULL)
      AND v.trello_card_id IS NOT NULL
      AND s.approval_status = 'Posted'
      ORDER BY v.created DESC
      LIMIT 100
    `);

    const emptyUrls = emptyUrlsResult.rows;
    console.log(`📊 Found ${emptyUrls.length} video records missing URLs`);

    if (emptyUrls.length === 0) {
      return res.json({ message: "No missing video URLs found", updated: 0 });
    }

    let updatedCount = 0;
    const results = [];

    // Check each Trello card for video URLs
    for (const video of emptyUrls) {
      try {
        console.log(`🔍 Checking Trello card ${video.trello_card_id} for URLs...`);

        // Get card details from Trello including comments and custom fields
        const cardResponse = await fetch(
          `https://api.trello.com/1/cards/${video.trello_card_id}?key=${trelloApiKey}&token=${trelloToken}&fields=name,desc&actions=commentCard&action_limit=50&customFieldItems=true`
        );

        if (!cardResponse.ok) {
          console.log(`❌ Failed to fetch Trello card ${video.trello_card_id}: ${cardResponse.status}`);
          results.push({
            video_id: video.id,
            title: video.script_title.substring(0, 50),
            status: 'trello_error',
            error: `HTTP ${cardResponse.status}`
          });
          continue;
        }

        const cardData = await cardResponse.json();
        let longVideoUrl = null;
        let shortVideoUrl = null;

        // Function to extract YouTube URLs from text
        const extractYouTubeUrls = (text) => {
          if (!text) return [];
          const urlRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[^\s\)]+/gi;
          return text.match(urlRegex) || [];
        };

        // Check custom fields for video URLs first (this is where URLs are stored)
        let customFieldUrls = [];
        if (cardData.customFieldItems && cardData.customFieldItems.length > 0) {
          for (const customField of cardData.customFieldItems) {
            if (customField.value && customField.value.text) {
              const urls = extractYouTubeUrls(customField.value.text);
              customFieldUrls = customFieldUrls.concat(urls);
            }
          }
        }

        // Check card description for URLs
        const descUrls = extractYouTubeUrls(cardData.desc);

        // Check comments for URLs
        let commentUrls = [];
        if (cardData.actions && cardData.actions.length > 0) {
          for (const action of cardData.actions) {
            if (action.type === 'commentCard' && action.data && action.data.text) {
              const urls = extractYouTubeUrls(action.data.text);
              commentUrls = commentUrls.concat(urls);
            }
          }
        }

        // Combine all found URLs (prioritize custom fields)
        const allUrls = [...customFieldUrls, ...descUrls, ...commentUrls];

        // Categorize URLs
        for (let url of allUrls) {
          // Ensure URL has protocol
          if (!url.startsWith('http')) {
            url = 'https://' + url;
          }

          if (url.includes('/shorts/')) {
            shortVideoUrl = url;
          } else if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            longVideoUrl = url;
          }
        }

        // Determine which URL to use (prefer long video, fallback to short)
        const finalUrl = longVideoUrl || shortVideoUrl;

        if (finalUrl) {
          // Update video record with found URL
          const updateQuery = `
            UPDATE video
            SET url = $1
            WHERE id = $2
            RETURNING id, url
          `;

          const result = await pool.query(updateQuery, [finalUrl, video.id]);
          console.log(`✅ Updated video ${video.id} with URL: ${finalUrl.substring(0, 60)}...`);
          updatedCount++;

          results.push({
            video_id: video.id,
            title: video.script_title.substring(0, 50),
            status: 'updated',
            url: finalUrl.substring(0, 60),
            url_type: longVideoUrl ? 'long' : 'short'
          });

        } else {
          console.log(`⚠️ No video URL found for: ${video.script_title.substring(0, 50)}...`);
          results.push({
            video_id: video.id,
            title: video.script_title.substring(0, 50),
            status: 'no_url_found',
            desc_checked: !!cardData.desc,
            comments_checked: cardData.actions ? cardData.actions.length : 0
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error processing video ${video.id}:`, error.message);
        results.push({
          video_id: video.id,
          title: video.script_title ? video.script_title.substring(0, 50) : 'Unknown',
          status: 'error',
          error: error.message
        });
        continue;
      }
    }

    console.log(`🎉 URL sync complete! Updated ${updatedCount} video URLs`);
    res.json({
      message: `URL sync complete! Updated ${updatedCount} video URLs`,
      updated: updatedCount,
      checked: emptyUrls.length,
      results: results
    });

  } catch (error) {
    console.error("❌ Error in video URL sync:", error);
    res.status(500).json({ error: "Failed to sync video URLs", details: error.message });
  }
});

// Vercel voice automation webhook
app.post("/api/vercel-voice-automation", async (req, res) => {
  const { trello_card_id } = req.body;

  try {
    // 1) Fetch Google Doc link
    const result = await pool.query(
      "SELECT google_doc_link FROM script WHERE trello_card_id = $1",
      [trello_card_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "Trello card id not found in Script table." });
    }

    const googleDocLink = result.rows[0].google_doc_link;
    if (!googleDocLink) {
      return res
        .status(400)
        .json({ error: "No Google Doc link found for this script." });
    }

    // 2) Send to Vercel voice-automation webhook
    await axios.post(
      "https://voice-automation-3j4l.vercel.app/api/webhook",
      { google_doc_link: googleDocLink }, // Send in request body
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": "your-secret-key",
        },
      }
    );

    return res
      .status(200)
      .json({ success: "Google Doc link sent to voice-automation webhook." });
  } catch (error) {
    console.error("Error in /api/vercel-voice-automation:", error);
    console.error("Response data:", error.response?.data);
    console.error("Status code:", error.response?.status);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
      details: error.response?.data,
    });
  }
});

app.get("/api/getWriter", async (req, res) => {
  const { username } = req.query;

  try {
    if (pool && username) {
      const query = `
        SELECT w.id, w.name, w.access_advanced_types, l.username
        FROM writer w
        JOIN login l ON w.login_id = l.id
        WHERE l.username = $1;
      `;

      const { rows } = await pool.query(query, [username]);
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.status(404).json({ error: "Writer not found" });
      }
    } else {
      res.status(400).json({ error: "Username required" });
    }
  } catch (error) {
    console.error("Error fetching writer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Writer videos endpoint for Content page - NOW USING BIGQUERY (moved to analytics routes)
/*
app.get("/api/writer/videos", async (req, res) => {
  const { writer_id, range = "28", page = "1", limit = "20", type = "all" } = req.query;

  if (!writer_id) {
    return res.status(400).json({ error: "missing writer_id" });
  }

  try {
    // First try InfluxDB for real-time data
    let influxService;
    try {
      const InfluxService = require('./services/influxService');
      influxService = new InfluxService();
      console.log('✅ InfluxDB service initialized for writer videos');
    } catch (error) {
      console.error('❌ Failed to initialize InfluxDB for writer videos:', error);
    }

    if (influxService) {
      try {
        console.log('🎬 Getting writer videos from InfluxDB for writer ID:', writer_id, 'Range:', range + 'd');

        // Custom query to get video data without grouping to avoid schema collision
        const query = `
          from(bucket: "${influxService.bucket}")
            |> range(start: -${range}d)
            |> filter(fn: (r) => r._measurement == "views")
            |> filter(fn: (r) => r.writer_id == "${writer_id}")
            |> last()
            |> sort(columns: ["_time"], desc: true)
        `;

        const results = [];
        const videoMap = new Map(); // To deduplicate videos by video_id

        await influxService.queryApi.queryRows(query, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            console.log('📊 InfluxDB row received:', {
              video_id: o.video_id,
              writer_id: o.writer_id,
              writer_name: o.writer_name,
              url: o.url,
              title: o.title,
              views: o.views,
              likes: o.likes,
              comments: o.comments,
              preview: o.preview,
              _time: o._time
            });

            // Use video_id as key to avoid duplicates
            const videoId = o.video_id || `video_${Date.now()}_${Math.random()}`;

            if (!videoMap.has(videoId)) {
              const duration = generateRandomDuration();
              const videoType = getVideoType(o.url);

              videoMap.set(videoId, {
                id: videoId,
                url: o.url || "",
                title: o.title || `Video ${o.video_id}`,
                writer_id: writer_id,
                writer_name: o.writer_name || "",
                account_name: o.account_name || "YouTube Channel",
                preview: o.preview || (o.url ? `https://img.youtube.com/vi/${extractVideoId(o.url)}/maxresdefault.jpg` : ""),
                views: o._value || 0,
                likes: o._value || 0,
                comments: o._value || 0,
                posted_date: o._time || new Date().toISOString(),
                duration: duration,
                type: videoType, // 'short' or 'video'
                status: "Published"
              });
            }
          },
          error(error) {
            console.error('❌ InfluxDB Query Error:', error);
            // Don't throw error, just log it and continue to fallback
            console.log('🔄 InfluxDB failed, will use PostgreSQL fallback');
          },
          async complete() {
            // Convert Map to Array
            const uniqueVideos = Array.from(videoMap.values());

            // Get account names from PostgreSQL for InfluxDB videos
            if (uniqueVideos.length > 0 && pool) {
              try {
                const videoIds = uniqueVideos.map(v => v.id).filter(id => id);
                if (videoIds.length > 0) {
                  const accountQuery = `
                    SELECT
                      video.id as video_id,
                      posting_accounts.account as account_name
                    FROM video
                    LEFT JOIN posting_accounts ON video.account_id = posting_accounts.id
                    WHERE video.id = ANY($1)
                  `;
                  const { rows: accountRows } = await pool.query(accountQuery, [videoIds]);

                  // Create account mapping
                  const accountMap = new Map();
                  accountRows.forEach(row => {
                    if (row.account_name) {
                      accountMap.set(row.video_id.toString(), row.account_name);
                    }
                  });

                  // Update videos with account names
                  uniqueVideos.forEach(video => {
                    const accountName = accountMap.get(video.id.toString());
                    if (accountName) {
                      video.account_name = accountName;
                    } else {
                      // Show "YouTube Channel" as fallback when account name not available
                      video.account_name = "YouTube Channel";
                    }
                  });
                }
              } catch (accountError) {
                console.error('⚠️ Failed to get account names from PostgreSQL:', accountError);
                // Set fallback account names for all videos
                uniqueVideos.forEach(video => {
                  if (!video.account_name || video.account_name === "") {
                    video.account_name = "YouTube Channel";
                  }
                });
              }
            }

            results.push(...uniqueVideos);
            console.log(`✅ InfluxDB query completed. Found ${results.length} unique videos for writer ${writer_id}`);
          }
        });

        if (results.length > 0) {
          console.log(`📺 Returning ${results.length} videos from InfluxDB for writer ${writer_id}`);
          res.json(results);
          return;
        } else {
          console.log('⚠️ No videos found in InfluxDB, trying PostgreSQL fallback');
        }
      } catch (influxError) {
        console.error('❌ InfluxDB error, trying PostgreSQL fallback:', influxError);
      }
    }

    // Fallback to PostgreSQL using your working API pattern with pagination
    console.log('🔄 Trying PostgreSQL fallback for writer:', writer_id, 'Page:', page, 'Limit:', limit);
    try {
      if (pool) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const offset = (pageNum - 1) * limitNum;

        // Calculate date filter
        let dateFilterStr;
        let dateCondition;

        if (range === 'lifetime') {
          // For lifetime, don't apply date filter
          dateCondition = '';
          console.log(`📅 Date filter: Lifetime (no date restriction)`);
        } else {
          const rangeNum = parseInt(range) || 28;
          const dateFilter = new Date();
          dateFilter.setDate(dateFilter.getDate() - rangeNum);
          dateFilterStr = dateFilter.toISOString().split('T')[0]; // YYYY-MM-DD format
          dateCondition = 'AND (statistics_youtube_api.posted_date >= $2 OR statistics_youtube_api.posted_date IS NULL)';
          console.log(`📅 Date filter: Last ${rangeNum} days (since ${dateFilterStr})`);
        }

        // Build type filter condition
        let typeCondition = '';
        let queryParams = [parseInt(writer_id)];

        // Add date parameter only if not lifetime
        if (range !== 'lifetime') {
          queryParams.push(dateFilterStr);
        }

        if (type === 'short') {
          typeCondition = "AND video.url LIKE '%/shorts/%'";
        } else if (type === 'video') {
          typeCondition = "AND video.url NOT LIKE '%/shorts/%'";
        }

        // Build the date condition based on parameter position
        const dateConditionInQuery = range === 'lifetime' ? '' :
          `AND (statistics_youtube_api.posted_date >= $${queryParams.length} OR statistics_youtube_api.posted_date IS NULL)`;

        // Get total count first with date and type filter
        const countQuery = `
          SELECT COUNT(*) as total
          FROM video
          LEFT JOIN statistics_youtube_api
              ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
          WHERE video.writer_id = $1
            AND video.url LIKE '%youtube.com%'
            ${dateConditionInQuery}
            ${typeCondition};
        `;

        const { rows: countRows } = await pool.query(countQuery, queryParams);
        const totalVideos = parseInt(countRows[0].total) || 0;
        const totalPages = Math.ceil(totalVideos / limitNum);

        // Get paginated videos with date and type filter
        const youtubeQuery = `
          SELECT
            video.url,
            video.script_title AS title,
            COALESCE(statistics_youtube_api.posted_date, video.created) AS posted_date,
            statistics_youtube_api.preview,
            statistics_youtube_api.duration,
            COALESCE(statistics_youtube_api.likes_total, 0) AS likes_total,
            COALESCE(statistics_youtube_api.comments_total, 0) AS comments_total,
            COALESCE(statistics_youtube_api.views_total, 0) AS views_total,
            video.id as video_id
          FROM video
          LEFT JOIN statistics_youtube_api
              ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
          WHERE video.writer_id = $1
            AND video.url LIKE '%youtube.com%'
            AND statistics_youtube_api.duration IS NOT NULL
            ${dateConditionInQuery}
            ${typeCondition}
          ORDER BY statistics_youtube_api.posted_date DESC
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
        `;

        // Add pagination parameters
        queryParams.push(limitNum, offset);
        const { rows } = await pool.query(youtubeQuery, queryParams);

        const transformedVideos = rows
          .filter(video => video.duration) // Only process videos with actual duration data
          .map((video, index) => {
          // Use actual duration from database (no fallbacks)
          const duration = video.duration;

          // Determine video type based on duration (< 3 minutes = short, >= 3 minutes = video)
          let videoType = 'video'; // default
          let isShort = false;

          const parts = duration.split(':');
          if (parts.length >= 2) {
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            const totalSeconds = minutes * 60 + seconds;

            if (totalSeconds < 180) { // Less than 3 minutes (180 seconds)
              videoType = 'short';
              isShort = true;
            }
          }

          // Format the posted date properly
          let formattedDate = 'Unknown Date';
          if (video.posted_date) {
            try {
              const date = new Date(video.posted_date);
              formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            } catch (dateError) {
              console.error('❌ Error formatting date:', dateError);
            }
          }

          return {
            id: video.video_id || index + 1,
            url: video.url || "",
            title: video.title || "Untitled Video",
            writer_id: writer_id,
            writer_name: "Writer",
            preview: video.preview || (video.url ? `https://img.youtube.com/vi/${extractVideoId(video.url)}/maxresdefault.jpg` : ""),
            views: video.views_total || 0,
            likes: video.likes_total || 0,
            comments: video.comments_total || 0,
            posted_date: video.posted_date || new Date().toISOString(),
            publishDate: formattedDate,
            duration: duration,
            type: videoType,
            isShort: isShort,
            status: "Published"
          };
        });

        // Get accurate type counts for all videos (not just current page)
        const countQueryParams = [parseInt(writer_id)];
        if (range !== 'lifetime') {
          countQueryParams.push(dateFilterStr);
        }

        const allCountQuery = `
          SELECT COUNT(*) as total
          FROM video
          LEFT JOIN statistics_youtube_api
              ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
          WHERE video.writer_id = $1
            AND video.url LIKE '%youtube.com%'
            ${dateConditionInQuery};
        `;

        const shortCountQuery = `
          SELECT COUNT(*) as total
          FROM video
          LEFT JOIN statistics_youtube_api
              ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
          WHERE video.writer_id = $1
            AND video.url LIKE '%youtube.com%'
            AND video.url LIKE '%/shorts/%'
            ${dateConditionInQuery};
        `;

        const videoCountQuery = `
          SELECT COUNT(*) as total
          FROM video
          LEFT JOIN statistics_youtube_api
              ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
          WHERE video.writer_id = $1
            AND video.url LIKE '%youtube.com%'
            AND video.url NOT LIKE '%/shorts/%'
            ${dateConditionInQuery};
        `;

        const [allCountResult, shortCountResult, videoCountResult] = await Promise.all([
          pool.query(allCountQuery, countQueryParams),
          pool.query(shortCountQuery, countQueryParams),
          pool.query(videoCountQuery, countQueryParams)
        ]);

        const allCount = parseInt(allCountResult.rows[0].total) || 0;
        const shortCount = parseInt(shortCountResult.rows[0].total) || 0;
        const videoCount = parseInt(videoCountResult.rows[0].total) || 0;

        console.log(`📊 Type counts for writer ${writer_id}: All=${allCount}, Shorts=${shortCount}, Videos=${videoCount}`);
        console.log(`📺 Current filter: ${type} - Showing ${transformedVideos.length} videos on page ${pageNum}`);

        // Videos are already filtered by the database query, no need for additional filtering
        const filteredVideos = transformedVideos;

        // Add InfluxDB total data for each video (no delta calculations)
        const videosWithInfluxData = await Promise.all(
          filteredVideos.map(async (video) => {
            try {
              if (video.url) {
                const influxData = await getVideoTotalData(video.url);
                // Use InfluxDB data if available, otherwise keep PostgreSQL data
                return {
                  ...video,
                  views: influxData.views || video.views,
                  likes: influxData.likes || video.likes,
                  comments: influxData.comments || video.comments,
                  influxData // Keep for debugging
                };
              }
              return video;
            } catch (error) {
              console.error(`❌ Error getting InfluxDB data for video ${video.id}:`, error);
              return video;
            }
          })
        );

        console.log(`✅ PostgreSQL fallback: Found ${videosWithInfluxData.length}/${totalVideos} videos for writer ${writer_id} (Page ${pageNum}/${totalPages}) Type: ${type}`);

        // Return paginated response with type counts
        res.json({
          videos: videosWithInfluxData,
          pagination: {
            currentPage: pageNum,
            totalPages: totalPages,
            totalVideos: totalVideos,
            videosPerPage: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
          },
          typeCounts: {
            all: allCount,
            short: shortCount,
            video: videoCount
          }
        });
        return;
      }
    } catch (pgError) {
      console.error('❌ PostgreSQL fallback error:', pgError);
    }

    // Final fallback to mock data
    console.log('📝 Using final mock data fallback for writer:', writer_id);
    const mockVideos = [
      {
        id: 1,
        url: "https://youtube.com/shorts/zQrDuHoNZCc",
        title: "Dare Roulette was just a harmless game we made up, until the new kid joined.",
        writer_id: writer_id,
        writer_name: "Hannah Moskowitz",
        account_name: "StoryChannel",
        preview: "https://i.ytimg.com/vi/zQrDuHoNZCc/default.jpg",
        views: 216577,
        likes: 8462,
        comments: 52,
        posted_date: new Date().toISOString(),
        duration: "0:45",
        type: "short", // YouTube Short
        status: "Published"
      },
      {
        id: 2,
        url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Long Form Story: The Complete Adventure",
        writer_id: writer_id,
        writer_name: "Hannah Moskowitz",
        account_name: "StoryChannel",
        preview: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        views: 89000,
        likes: 3200,
        comments: 180,
        posted_date: new Date(Date.now() - 86400000).toISOString(),
        duration: "15:30",
        type: "video", // Long-form video
        status: "Published"
      }
    ];

    res.json(mockVideos);
  } catch (error) {
    console.error("Error fetching writer videos:", error);
    res.status(500).json({ error: "Error fetching videos" });
  }
});
*/

// Helper function to extract video ID from YouTube URL
function extractVideoId(url) {
  if (!url) return null;

  // Multiple patterns to handle different YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/shorts\/([^"&?\/\s]{11})/,
    /youtube\.com\/watch\?v=([^"&?\/\s]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log(`🎯 Extracted video ID: ${match[1]} from URL: ${url}`);
      return match[1];
    }
  }

  console.log(`❌ Could not extract video ID from URL: ${url}`);
  return null;
}

// Helper function to identify video type from URL
function getVideoType(url) {
  if (!url) return "video";

  // Check for YouTube Shorts URLs
  if (url.includes("/shorts/") || url.includes("youtube.com/shorts")) {
    return "short";
  }

  // Check for other short-form indicators
  if (url.includes("youtu.be/") && url.length < 50) {
    return "short"; // youtu.be links are often shorts
  }

  // Default to long-form video
  return "video";
}

// Helper function to get video duration category
function getVideoDurationCategory(duration) {
  if (!duration) return "video";

  // Parse duration string (e.g., "0:45", "15:30")
  const parts = duration.split(":");
  let totalSeconds = 0;

  if (parts.length === 2) {
    totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 3) {
    totalSeconds =
      parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }

  // YouTube Shorts are typically under 60 seconds
  return totalSeconds <= 60 ? "short" : "video";
}


async function getYouTubeDurationsFromBigQuery(videoIds, writerName) {
  const bigquery = global.bigqueryClient;
  const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
  const dataset = "dbt_youtube_analytics";

  const durationQuery = `
    SELECT
      video_id,
      video_duration_seconds
    FROM \`${projectId}.${dataset}.youtube_video_report_historical\`
    WHERE video_id IN UNNEST(@video_ids)
      AND writer_name = @writer_name
  `;

  const [rows] = await bigquery.query({
    query: durationQuery,
    params: {
      video_ids: videoIds,
      writer_name: writerName,
    },
  });

  const durationMap = {};
  rows.forEach((row) => {
    durationMap[row.video_id] = row.video_duration_seconds;
  });

  return durationMap;
}
// Note: Removed generateRandomDuration function - now using only real database duration

// Your working PostgreSQL API for writer analytics with pagination
app.get("/api/writer/analytics", async (req, res) => {
  const { writer_id, page = "1", limit = "20", type = "all" } = req.query;
  if (!writer_id) {
    return res.status(400).json({ error: "Missing writer_id" });
  }

  // Query to get ALL YouTube video data from statistics_youtube_api for the writer
  const youtubeQuery = `
    SELECT
      video.url,
      video.script_title AS title,
      statistics_youtube_api.posted_date,
      statistics_youtube_api.preview,
      COALESCE(statistics_youtube_api.likes_total, 0) AS likes_total,
      COALESCE(statistics_youtube_api.comments_total, 0) AS comments_total,
      COALESCE(statistics_youtube_api.views_total, 0) AS views_total,
      video.id as video_id
    FROM video
    LEFT JOIN statistics_youtube_api
        ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
    WHERE video.writer_id = $1
      AND video.url LIKE '%youtube.com%'
      AND statistics_youtube_api.video_id IS NOT NULL
    ORDER BY statistics_youtube_api.posted_date DESC;
  `;

  try {
    if (pool) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Get ALL YouTube videos from statistics_youtube_api for the writer
      const { rows: youtubeRows } = await pool.query(youtubeQuery, [
        parseInt(writer_id),
      ]);

      console.log(`📊 Found ${youtubeRows.length} YouTube videos for writer ${writer_id}`);

      // Extract YouTube video IDs
      const youtubeVideoIds = youtubeRows
        .map((row) => extractVideoId(row.url))
        .filter((id) => !!id);

      // Fetch writer name
      const writerQuery = `SELECT name FROM writer WHERE id = $1`;
      const { rows: writerRows } = await pool.query(writerQuery, [
        parseInt(writer_id),
      ]);
      if (writerRows.length === 0) {
        throw new Error(`Writer with ID ${writer_id} not found`);
      }
      const writerName = writerRows[0].name;

      // Fetch durations from BigQuery - ONLY source for video type determination
      const youtubeDurations = await getYouTubeDurationsFromBigQuery(
        youtubeVideoIds,
        writerName
      );

      console.log(`✅ BigQuery duration data for ${youtubeVideoIds.length} videos:`, youtubeDurations);


      // Apply filtering based on BigQuery duration data ONLY
      let filteredData = youtubeRows; // Start with ALL YouTube videos

      if (type === "short" || type === "video") {
        filteredData = youtubeRows.filter((video) => {
          const videoId = extractVideoId(video.url);
          const duration = youtubeDurations[videoId];

          // Only filter if we have BigQuery duration data
          if (duration === undefined || duration === null) {
            console.log(`⚠️ No BigQuery duration for video ID: ${videoId}, showing in all results`);
            return true; // Show videos without BigQuery duration in all results
          }

          // Use 183 seconds threshold: < 183 = short, >= 183 = video
          const isShort = duration > 0 && duration < 183;
          return type === "short" ? isShort : !isShort;
        });
      }


      const totalVideos = filteredData.length;
      const totalPages = Math.ceil(totalVideos / limitNum);

      // Apply pagination
      const paginatedData = filteredData.slice(offset, offset + limitNum);

      // Transform for Content page format - show ALL videos
      const transformedData = paginatedData
        .map((video, index) => {
          const videoId = extractVideoId(video.url);
          const bigQueryDuration = youtubeDurations[videoId];

          // Determine video type using ONLY BigQuery duration data
          let videoType = "video"; // default
          let formattedDuration = "Unknown";

          if (bigQueryDuration !== undefined && bigQueryDuration !== null) {
            // Use BigQuery duration (float seconds) for type determination
            videoType = (bigQueryDuration > 0 && bigQueryDuration < 183) ? "short" : "video";
            // Format duration for display
            const minutes = Math.floor(bigQueryDuration / 60);
            const seconds = Math.floor(bigQueryDuration % 60);
            formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }

          console.log(`🎯 Video ${video.title}: BigQuery duration=${bigQueryDuration}s, type=${videoType}`);


          return {
            id: video.video_id || index + 1,
            url: video.url || "",
            title: video.title || "Untitled Video",
            writer_id: writer_id,
            writer_name: writerName,
            account_name: "Channel",
            preview:
              video.preview ||
              (video.url
                ? `https://img.youtube.com/vi/${extractVideoId(
                    video.url
                  )}/maxresdefault.jpg`
                : ""),
            views: video.views_total || 0,
            likes: video.likes_total || 0,
            comments: video.comments_total || 0,
            posted_date: video.posted_date || new Date().toISOString(),
            duration: formattedDuration, // Use formatted BigQuery duration
            bigQueryDuration: bigQueryDuration, // Include raw BigQuery duration for debugging
            type: videoType, // 'short' or 'video' based on BigQuery duration
            status: "Published",
          };
        }); // Show ALL videos, don't filter any out

      console.log(
        `✅ PostgreSQL analytics: Found ${transformedData.length}/${totalVideos} videos for writer ${writer_id} (Page ${pageNum}/${totalPages})`
      );

      // Return paginated response
      res.json({
        videos: transformedData,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalVideos: totalVideos,
          videosPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } else {
      res.status(500).json({ error: "Database not available" });
    }
  } catch (error) {
    console.error("Error querying PostgreSQL for writer analytics:", error);
    res.status(500).json({ error: "Error querying writer analytics data" });
  }
});


// BigQuery function to get audience retention data for individual video
async function getBigQueryAudienceRetention(videoId, writerId) {
  try {
    console.log(
      `📊 BigQuery: Getting audience retention for video ${videoId}, writer ${writerId}`
    );

    // Use the global BigQuery client
    if (!global.bigqueryClient) {
      throw new Error("BigQuery client not initialized");
    }

    const bigquery = global.bigqueryClient;
    console.log(
      `🔍 BigQuery Debug: Using client with project ID: ${bigquery.projectId}`
    );

    // First, get the YouTube video ID from PostgreSQL video table URL
    const videoQuery = `SELECT url FROM video WHERE id = $1 AND writer_id = $2`;
    const { rows: videoRows } = await pool.query(videoQuery, [
      parseInt(videoId),
      parseInt(writerId),
    ]);

    if (videoRows.length === 0) {
      throw new Error(
        `Video with ID ${videoId} not found for writer ${writerId}`
      );
    }

    const videoUrl = videoRows[0].url;
    // Extract YouTube video ID from URL (e.g., "Rde8GGIRSqo" from "https://www.youtube.com/shorts/Rde8GGIRSqo")
    const youtubeVideoId = extractVideoId(videoUrl);
    if (!youtubeVideoId) {
      throw new Error(
        `Could not extract YouTube video ID from URL: ${videoUrl}`
      );
    }

    console.log(
      `📊 Extracted YouTube video ID: ${youtubeVideoId} from URL: ${videoUrl}`
    );

    // Get writer name from PostgreSQL for youtube_video_report_historical query
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [
      parseInt(writerId),
    ]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writerId} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`👤 Found writer name: ${writerName} for retention queries`);

    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = "dbt_youtube_analytics";

    // Query 1: audience_retention_historical for graph data - Get ALL raw data points
    const retentionQuery = `
      SELECT
        elapsed_video_time_ratio,
        audience_watch_ratio,
        relative_retention_performance,
        account_id,
        writer_id,
        account_name,
        writer_name,
        snapshot_date,
        retention_snapshot_id
      FROM \`${projectId}.${dataset}.audience_retention_historical\`
      WHERE video_id = @video_id
        AND writer_id = @writer_id
        AND audience_watch_ratio IS NOT NULL
        AND elapsed_video_time_ratio IS NOT NULL
      ORDER BY snapshot_date DESC, elapsed_video_time_ratio ASC
    `;

    console.log(
      `🔍 Querying retention graph data for video ${videoId}, writer ${writerId}`
    );
    console.log(`🔍 EXACT BIGQUERY RETENTION QUERY:`, retentionQuery);
    console.log(`🔍 QUERY PARAMETERS:`, {
      video_id: youtubeVideoId,
      writer_id: parseInt(writerId),
    });

    const [retentionRows] = await bigquery.query({
      query: retentionQuery,
      params: {
        video_id: youtubeVideoId,
        writer_id: parseInt(writerId),
      },
    });

    console.log(
      `📊 BigQuery returned ${retentionRows.length} raw retention data points`
    );

    // Log date range information
    if (retentionRows.length > 0) {
      const dates = [...new Set(retentionRows.map(row => row.snapshot_date.value || row.snapshot_date))].sort();
      console.log(`📊 Retention data spans from ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} unique dates)`);
      console.log(`📊 ALL UNIQUE DATES FOUND:`, dates);

      // Log summary of data by date
      const dataByDate = {};
      retentionRows.forEach(row => {
        const dateStr = row.snapshot_date.value || row.snapshot_date.toString();
        if (!dataByDate[dateStr]) {
          dataByDate[dateStr] = [];
        }
        dataByDate[dateStr].push(row);
      });

      console.log(`📊 DATA BREAKDOWN BY DATE:`, Object.keys(dataByDate).sort().map(date => ({
        date: date,
        dataPoints: dataByDate[date].length,
        sampleRetention: (dataByDate[date][0]?.audience_watch_ratio * 100).toFixed(1) + '%'
      })));

      // Check if we're missing expected dates (June 7-12)
      const expectedDates = ['2025-06-07', '2025-06-08', '2025-06-09', '2025-06-10', '2025-06-11', '2025-06-12'];
      const missingDates = expectedDates.filter(date => !Object.keys(dataByDate).includes(date));
      if (missingDates.length > 0) {
        console.log(`⚠️ MISSING EXPECTED DATES:`, missingDates);
      }
    }

    // Query 2: youtube_video_report_historical for duration metrics
    const durationQuery = `
      SELECT
        watch_time_minutes,
        video_duration_seconds,
        average_view_duration_seconds,
        average_view_duration_percentage,
        video_id,
        date_day
      FROM \`${projectId}.${dataset}.youtube_video_report_historical\`
      WHERE video_id = @video_id
        AND writer_name = @writer_name
      ORDER BY date_day DESC
      LIMIT 1
    `;

    console.log(
      `🔍 Querying duration metrics for video ${videoId}, writer ${writerName}`
    );

    const [durationRows] = await bigquery.query({
      query: durationQuery,
      params: {
        video_id: youtubeVideoId,
        writer_name: writerName,
      },
    });

    console.log(`⏱️ BigQuery returned ${durationRows.length} duration records`);

    if (retentionRows.length === 0) {
      console.log(`⚠️ No retention data found for video ${videoId}`);
      return null;
    }

    // Get account name from PostgreSQL using account_id
    let accountName = "Unknown Account";
    if (retentionRows[0].account_id) {
      try {
        const accountQuery = `SELECT account FROM posting_accounts WHERE id = $1`;
        const { rows: accountRows } = await pool.query(accountQuery, [
          retentionRows[0].account_id,
        ]);
        if (accountRows.length > 0) {
          accountName = accountRows[0].account;
          console.log(
            `✅ Found account name: ${accountName} for account_id: ${retentionRows[0].account_id}`
          );
        }
      } catch (accountError) {
        console.error("⚠️ Error getting account name:", accountError);
      }
    }

    // Transform retention data for frontend using correct BigQuery fields
    console.log(`📊 Sample retention row:`, retentionRows[0]);

    // Get actual video duration from BigQuery duration metrics
    let actualVideoDurationSeconds = 143; // Default fallback
    if (durationRows.length > 0 && durationRows[0].video_duration_seconds) {
      actualVideoDurationSeconds = durationRows[0].video_duration_seconds;
    }

    console.log(`🕐 Video duration: ${actualVideoDurationSeconds} seconds from BigQuery`);

    // STEP 1: Convert ratio to actual seconds for each data point
    console.log(`📊 STEP 1: Converting elapsed_video_time_ratio to actual seconds...`);
    const rawDataWithSeconds = retentionRows.map((row, index) => {
      const timeRatio = parseFloat(row.elapsed_video_time_ratio || 0);
      const elapsedSeconds = timeRatio * actualVideoDurationSeconds; // Exact calculation as per methodology

      // Log first few conversions for debugging
      if (index < 5) {
        console.log(`🕐 Conversion ${index}: ratio=${timeRatio.toFixed(4)} × ${actualVideoDurationSeconds}s = ${elapsedSeconds.toFixed(2)}s`);
      }

      return {
        elapsed_video_time_seconds: elapsedSeconds,
        elapsed_video_time_ratio: timeRatio,
        audience_watch_ratio: parseFloat(row.audience_watch_ratio || 0),
        relative_retention_performance: row.relative_retention_performance ? parseFloat(row.relative_retention_performance) : null,
        snapshot_date: row.snapshot_date
      };
    });

    // STEP 2: Group by elapsed_video_time_seconds and calculate averages
    console.log(`📊 STEP 2: Grouping by elapsed seconds and calculating averages...`);
    const secondsGroupMap = new Map();

    // Log raw data around 30 seconds for debugging
    const thirtySecondRawData = rawDataWithSeconds.filter(point =>
      Math.abs(point.elapsed_video_time_seconds - 30) < 2.0 // Within 2 seconds of 30s
    );
    console.log(`🔍 RAW DATA AROUND 30 SECONDS (±2s):`, thirtySecondRawData.map(p => ({
      exactSeconds: p.elapsed_video_time_seconds.toFixed(2),
      retention: (p.audience_watch_ratio * 100).toFixed(1) + '%',
      date: p.snapshot_date,
      rawRatio: p.audience_watch_ratio.toFixed(4)
    })));

    rawDataWithSeconds.forEach(point => {
      const roundedSeconds = Math.round(point.elapsed_video_time_seconds * 100) / 100; // Round to 2 decimal places

      if (!secondsGroupMap.has(roundedSeconds)) {
        secondsGroupMap.set(roundedSeconds, {
          elapsed_video_time_seconds: roundedSeconds,
          audience_watch_ratios: [],
          relative_performance_ratios: [],
          dates: []
        });
      }

      const group = secondsGroupMap.get(roundedSeconds);
      group.audience_watch_ratios.push(point.audience_watch_ratio);
      if (point.relative_retention_performance !== null) {
        group.relative_performance_ratios.push(point.relative_retention_performance);
      }
      group.dates.push(point.snapshot_date);
    });

    // STEP 3: Calculate averages and sort by elapsed seconds
    console.log(`📊 STEP 3: Calculating averages and sorting by elapsed seconds...`);
    const retentionData = Array.from(secondsGroupMap.values()).map(group => {
      const avgAudienceWatch = group.audience_watch_ratios.reduce((sum, val) => sum + val, 0) / group.audience_watch_ratios.length;
      const avgRelativePerf = group.relative_performance_ratios.length > 0
        ? group.relative_performance_ratios.reduce((sum, val) => sum + val, 0) / group.relative_performance_ratios.length
        : null;

      // Convert seconds back to time format for display
      const totalSeconds = Math.floor(group.elapsed_video_time_seconds);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      return {
        time: timeStr,
        elapsed_video_time_seconds: group.elapsed_video_time_seconds,
        elapsed_video_time_ratio: group.elapsed_video_time_seconds / actualVideoDurationSeconds,
        audience_watch_ratio: avgAudienceWatch,
        relative_retention_performance: avgRelativePerf,
        // Keep raw values for frontend processing
        rawElapsedRatio: group.elapsed_video_time_seconds / actualVideoDurationSeconds,
        rawRetentionPerf: avgRelativePerf,
        rawAudienceWatch: avgAudienceWatch,
        // Metadata about averaging
        dataPointsCount: group.audience_watch_ratios.length,
        uniqueDates: [...new Set(group.dates)].length
      };
    }).sort((a, b) => a.elapsed_video_time_seconds - b.elapsed_video_time_seconds); // STEP 4: Sort by elapsed seconds

    console.log(`📊 STEP 4: Final aggregated data: ${retentionData.length} time points, spanning ${retentionData[0]?.elapsed_video_time_seconds.toFixed(2)}s to ${retentionData[retentionData.length - 1]?.elapsed_video_time_seconds.toFixed(2)}s`);

    // Log sample of aggregated data
    if (retentionData.length > 0) {
      console.log(`📊 Sample aggregated points:`, retentionData.slice(0, 3).map(p => ({
        seconds: p.elapsed_video_time_seconds.toFixed(2),
        retention: (p.audience_watch_ratio * 100).toFixed(1) + '%',
        dataPoints: p.dataPointsCount,
        dates: p.uniqueDates
      })));

      // Find and log the 30-second mark specifically
      const thirtySecondPoint = retentionData.find(p =>
        Math.abs(p.elapsed_video_time_seconds - 30) < 1.0 // Within 1 second of 30s
      );
      if (thirtySecondPoint) {
        console.log(`🎯 30-SECOND MARK ANALYSIS:`, {
          exactSeconds: thirtySecondPoint.elapsed_video_time_seconds.toFixed(2),
          averagedRetention: (thirtySecondPoint.audience_watch_ratio * 100).toFixed(1) + '%',
          dataPointsAveraged: thirtySecondPoint.dataPointsCount,
          uniqueDatesIncluded: thirtySecondPoint.uniqueDates,
          rawAudienceWatchRatio: thirtySecondPoint.audience_watch_ratio.toFixed(4)
        });

        // Show the individual values that were averaged
        const thirtySecondGroup = secondsGroupMap.get(thirtySecondPoint.elapsed_video_time_seconds);
        if (thirtySecondGroup) {
          console.log(`🔍 INDIVIDUAL VALUES AVERAGED FOR 30s:`, {
            individualRetentions: thirtySecondGroup.audience_watch_ratios.map(r => (r * 100).toFixed(1) + '%'),
            individualDates: thirtySecondGroup.dates,
            average: (thirtySecondGroup.audience_watch_ratios.reduce((sum, val) => sum + val, 0) / thirtySecondGroup.audience_watch_ratios.length * 100).toFixed(1) + '%'
          });
        }
      }
    }

    // Calculate "stayed to watch" - retention percentage at 30-second mark
    let stayedToWatch = 0;
    if (retentionData.length) {
      // Find the point closest to 30 seconds
      const thirtySecondPoint = retentionData.find(p =>
        Math.abs(p.elapsed_video_time_seconds - 30) < 1.0 // Within 1 second of 30s
      );

      if (thirtySecondPoint) {
        stayedToWatch = Math.round(thirtySecondPoint.audience_watch_ratio * 100);
        console.log(`📊 Stayed to watch (30s mark): ${stayedToWatch}% at ${thirtySecondPoint.elapsed_video_time_seconds.toFixed(2)}s`);
      } else {
        // Fallback: find closest point to 30 seconds if exact match not found
        const closestPoint = retentionData.reduce(
          (best, point) => {
            const dist = Math.abs(point.elapsed_video_time_seconds - 30);
            if (dist < best.dist) {
              return { dist, point };
            }
            return best;
          },
          { dist: Infinity, point: null }
        );

        if (closestPoint.point) {
          stayedToWatch = Math.round(closestPoint.point.audience_watch_ratio * 100);
          console.log(`📊 Stayed to watch (closest to 30s): ${stayedToWatch}% at ${closestPoint.point.elapsed_video_time_seconds.toFixed(2)}s`);
        }
      }
    }

    // 1b) new “global” metrics:
    const totalWatchTime = durationRows[0]?.watch_time_minutes || 0;
    const avgViewPct =
      Math.round(
        (durationRows[0]?.average_view_duration_percentage || 0) * 100
      ) / 100;

    // 1c) average audience_watch_ratio & relative_retention_performance across the curve:
    const avgAudienceWatchRatio = Math.round(
      (retentionRows.reduce(
        (sum, r) => sum + parseFloat(r.audience_watch_ratio),
        0
      ) /
        retentionRows.length) *
        100
    );
    const avgRelRetentionPerf = Math.round(
      (retentionRows.reduce(
        (sum, r) => sum + parseFloat(r.relative_retention_performance),
        0
      ) /
        retentionRows.length) *
        100
    );

    // 1d) find drop-off points (local minima) & key-moments (your existing isKeyMoment marker)
    const dropOffPoints = retentionData.filter((pt, i, arr) => {
      if (!arr[i - 1] || !arr[i + 1]) return false;
      return (
        pt.percentage < arr[i - 1].percentage &&
        pt.percentage < arr[i + 1].percentage
      );
    });
    const keyMomentMarkers = retentionData.filter((pt) => pt.isKeyMoment);

    // Calculate average view duration using BigQuery metrics
    // Method 1: Find where retention drops to 50% (common metric)
    // Method 2: Calculate weighted average based on retention curve
    //   let avgViewDuration = "0:00";
    if (retentionData.length > 0) {
      // Calculate weighted average view duration from retention curve
      let totalWeightedTime = 0;
      let totalWeight = 0;

      retentionData.forEach((point) => {
        const weight = point.percentage / 100; // Convert percentage to weight
        totalWeightedTime += point.timeRatio * weight;
        totalWeight += weight;
      });

      if (totalWeight > 0) {
        const avgTimeRatio = totalWeightedTime / totalWeight;
        // Convert back to time format (will be adjusted with actual duration later)
        const avgSeconds = Math.floor(avgTimeRatio * 600); // Using 10min placeholder
        const minutes = Math.floor(avgSeconds / 60);
        const seconds = avgSeconds % 60;
        avgViewDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;

        console.log(
          `📊 Calculated avg view duration: ratio=${avgTimeRatio.toFixed(
            3
          )} → ${avgViewDuration}`
        );
      }
    }

    // Extract duration metrics from youtube_video_report_historical
    let watchTimeMinutes = null;
    let videoDurationSeconds = null;
    let averageViewDurationSeconds = null;
    let averageViewDurationPercentage = null;
    let avgViewDurationFromReport = "0:00"; // Default fallback

    if (durationRows.length > 0) {
      const durationData = durationRows[0];
      watchTimeMinutes = durationData.watch_time_minutes;
      videoDurationSeconds = durationData.video_duration_seconds;
      averageViewDurationSeconds = durationData.average_view_duration_seconds;
      averageViewDurationPercentage =
        durationData.average_view_duration_percentage;

      // Use average_view_duration_seconds if available, otherwise convert watch_time_minutes
      if (averageViewDurationSeconds) {
        const totalSeconds = Math.floor(averageViewDurationSeconds); // Use floor for consistency
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        avgViewDurationFromReport = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;
      } else if (watchTimeMinutes) {
        const totalSeconds = Math.round(watchTimeMinutes * 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        avgViewDurationFromReport = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;
      }

      console.log(`⏱️ Duration metrics from youtube_video_report_historical:`);
      console.log(`   - watch_time_minutes: ${watchTimeMinutes}`);
      console.log(`   - video_duration_seconds: ${videoDurationSeconds}`);
      console.log(
        `   - average_view_duration_seconds: ${averageViewDurationSeconds}`
      );
      console.log(
        `   - average_view_duration_percentage: ${averageViewDurationPercentage}`
      );
      console.log(`   - formatted_duration: ${avgViewDurationFromReport}`);
    } else {
      console.log(
        `⚠️ No duration data found in youtube_video_report_historical for video ${videoId}`
      );
    }

    return {
      retentionData,
      accountName,
      metrics: {
        stayedToWatch, // e.g. 50
        avgAudienceWatchRatio, // e.g. 62  (%)    avgRelRetentionPerf,          // e.g. 85  (%)
        totalWatchTime, // e.g. 152.3 (minutes)
        avgViewPct, // e.g. 42.7 (%)
        avgViewDuration: avgViewDurationFromReport, // Add the formatted duration here
      },
      // Additional metrics from youtube_video_report_historical for retention section display
      durationMetrics: {
        watchTimeMinutes: watchTimeMinutes,
        videoDurationSeconds: videoDurationSeconds,
        averageViewDurationSeconds: averageViewDurationSeconds,
        averageViewDurationPercentage: averageViewDurationPercentage,
        avgViewDurationFormatted: avgViewDurationFromReport,
      },
      dropOffPoints, // [{ time, percentage }, …]
      keyMomentMarkers,
    };
  } catch (error) {
    console.error("❌ BigQuery audience retention query error:", error);
    return null;
  }
}

// BigQuery function for individual video analytics
async function getBigQueryVideoAnalytics(
  videoId,
  writerId,
  range = "lifetime"
) {
  try {
    console.log(
      `🎬 BigQuery: Getting video analytics for video ${videoId}, writer ${writerId}, range: ${range}`
    );

    // Use the global BigQuery client
    if (!global.bigqueryClient) {
      throw new Error("BigQuery client not initialized");
    }

    const bigquery = global.bigqueryClient;

    // First, get the YouTube video ID from PostgreSQL video table URL
    const videoQuery = `SELECT url FROM video WHERE id = $1 AND writer_id = $2`;
    const { rows: videoRows } = await pool.query(videoQuery, [
      parseInt(videoId),
      parseInt(writerId),
    ]);

    if (videoRows.length === 0) {
      throw new Error(
        `Video with ID ${videoId} not found for writer ${writerId}`
      );
    }

    const videoUrl = videoRows[0].url;
    // Extract YouTube video ID from URL (e.g., "Rde8GGIRSqo" from "https://www.youtube.com/shorts/Rde8GGIRSqo")
    const youtubeVideoId = extractVideoId(videoUrl);
    if (!youtubeVideoId) {
      throw new Error(
        `Could not extract YouTube video ID from URL: ${videoUrl}`
      );
    }

    console.log(
      `🎬 Extracted YouTube video ID: ${youtubeVideoId} from URL: ${videoUrl}`
    );

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [
      parseInt(writerId),
    ]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writerId} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`🎬 Found writer name: ${writerName} for video analytics`);

    // Calculate date range
    let dateCondition = "";
    let dateParam = null;

    if (range !== "lifetime") {
      const days = parseInt(range.replace("d", "")) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateParam = startDate.toISOString().split("T")[0];
      dateCondition = "AND date >= @startDate";
    }

    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = "dbt_youtube_analytics";
    const table = "youtube_metadata_historical";

    // Use youtube_video_report_historical for video analytics
    const reportTable = "youtube_video_report_historical";

    const query = `
      SELECT
        video_id,
        video_title as title,
        video_description,
        channel_title,
        high_thumbnail_url,
        medium_thumbnail_url,
        default_thumbnail_url,
        watch_time_minutes,
        video_duration_seconds,
        average_view_duration_seconds,
        average_view_duration_percentage,
        likes,
        comments,
        dislikes,
        shares,
        subscribers_gained,
        subscribers_lost,
        account_name,
        writer_name,
        date_day
      FROM \`${projectId}.${dataset}.${reportTable}\`
      WHERE video_id = @video_id
        AND writer_name = @writer_name
      ORDER BY date_day DESC
      LIMIT 1
    `;

    // Build parameters using YouTube video ID
    const params = {
      writer_name: writerName,
      video_id: youtubeVideoId,
    };

    const options = { query, params };
    console.log(`🔍 BigQuery query params:`, params);

    const [rows] = await bigquery.query(options);

    console.log(
      `🎬 BigQuery returned ${rows.length} video records for video ${videoId}`
    );

    if (rows.length === 0) {
      console.log(
        `❌ Video ${videoId} not found in BigQuery for writer ${writerName}`
      );
      throw new Error(
        `Video ${videoId} not found in BigQuery for writer ${writerName}`
      );
    }

    const video = rows[0];

    // Don't use BigQuery views - we'll get views from PostgreSQL/InfluxDB later

    // Get actual duration from PostgreSQL statistics_youtube_api table
    const durationQuery = `
      SELECT statistics_youtube_api.duration
      FROM video
      LEFT JOIN statistics_youtube_api ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
      WHERE video.id = $1
    `;
    const { rows: durationRows } = await pool.query(durationQuery, [
      parseInt(videoId),
    ]);
    const duration =
      durationRows.length > 0 && durationRows[0].duration
        ? durationRows[0].duration
        : null;

    if (!duration) {
      console.log(
        `⚠️ No duration data available for video ${videoId} - using fallback`
      );
    }

    // Calculate average view duration from BigQuery data
    let avgViewDuration = "0:00";
    if (video.average_view_duration_seconds) {
      const totalSeconds = Math.floor(video.average_view_duration_seconds); // Use floor instead of round for more accurate representation
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      avgViewDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    // Get real audience retention data from BigQuery - PRIMARY SOURCE
    let retentionData = [];
    let stayedToWatch = Math.round(video.average_view_duration_percentage || 0);
    let accountName = "Unknown Account";

    console.log(
      `📊 BigQuery PRIMARY: Getting audience retention for video ${videoId}, writer ${writerId}`
    );
    const retentionResult = await getBigQueryAudienceRetention(
      videoId,
      writerId
    );

    if (retentionResult) {
      retentionData = retentionResult.retentionData;
      // Use retention result's avgViewDuration if available, otherwise use calculated one
      if (retentionResult.metrics.avgViewDuration !== "0:00") {
        avgViewDuration = retentionResult.metrics.avgViewDuration;
      }
      stayedToWatch = retentionResult.metrics.stayedToWatch;
      accountName = retentionResult.accountName;

      // Adjust time format based on actual video duration
      const parts = duration.split(":");
      if (parts.length >= 2) {
        const totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        retentionData = retentionData.map((point) => {
          const actualSeconds = Math.floor(point.timeRatio * totalSeconds);
          const minutes = Math.floor(actualSeconds / 60);
          const seconds = actualSeconds % 60;

          return {
            ...point,
            time: `${minutes}:${seconds.toString().padStart(2, "0")}`,
          };
        });
      }

      console.log(
        `✅ BigQuery PRIMARY: Using real retention data: ${retentionData.length} points, account: ${accountName}`
      );
    } else {
      console.log(
        `⚠️ BigQuery PRIMARY: No retention data found for video ${videoId}, using report data only`
      );
      // Use the data from youtube_video_report_historical without throwing error
    }

    // Calculate real viewsIncrease using BigQuery data (no random values)
    let viewsIncrease = 0;
    try {
      if (global.bigqueryClient && videoUrl) {
        // Extract YouTube video ID from URL
        const youtubeVideoId = extractVideoId(videoUrl);
        if (youtubeVideoId) {
          // Get writer name for BigQuery query
          const writerQuery = `SELECT name FROM writer WHERE id = $1`;
          const { rows: writerRows } = await pool.query(writerQuery, [
            parseInt(writerId),
          ]);
          const writerName = writerRows[0]?.name;

          if (writerName) {
            const projectId =
              process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
            const dataset = "dbt_youtube_analytics";

            // 1️⃣ Get the writer's historic average views (excluding this video)
            // Only include videos from last 6 months with at least 1000 views for better average
            const avgViewsQuery = `
              SELECT
                AVG(views) AS avg_views,
                COUNT(*) AS video_count,
                MIN(views) AS min_views,
                MAX(views) AS max_views
              FROM \`${projectId}.${dataset}.youtube_video_report_historical\`
              WHERE writer_name = @writer_name
                AND video_id != @video_id
                AND views >= 1000
                AND DATE(est_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            `;
            const [avgRows] = await global.bigqueryClient.query({
              query: avgViewsQuery,
              params: {
                writer_name: writerName,
                video_id: youtubeVideoId,
              },
            });
            const avgViews = avgRows[0]?.avg_views || 0;
            const videoCount = avgRows[0]?.video_count || 0;

            // 2️⃣ Compute percent increase vs. average
            const thisViews = parseInt(video.views || 0);
            if (avgViews > 0 && videoCount >= 5) {
              // Need at least 5 videos for meaningful average
              viewsIncrease = Math.round(
                ((thisViews - avgViews) / avgViews) * 100
              );
            }

            console.log(
              `📊 BigQuery ViewsIncrease calculation: ${thisViews} views vs ${Math.round(
                avgViews
              )} avg (${videoCount} videos) = ${viewsIncrease}%`
            );
          }
        }
      }
    } catch (viewsIncreaseError) {
      console.error(
        "⚠️ BigQuery path: Error calculating viewsIncrease, using 0:",
        viewsIncreaseError
      );
      viewsIncrease = 0;
    }

    // Return BigQuery data for enhancement, but let PostgreSQL/InfluxDB handle views and chart data
    const videoData = {
      id: videoId,
      title: video.title || `Video ${videoId}`,
      description: video.video_description,
      channelTitle: video.channel_title,
      url: videoUrl, // Use the real URL from PostgreSQL video table
      // Get accurate likes and comments from PostgreSQL statistics_youtube_api table
      likes: await getPostgreSQLLikesComments(videoId, 'likes'),
      comments: await getPostgreSQLLikesComments(videoId, 'comments'),
      dislikes: parseInt(video.dislikes || 0),
      shares: parseInt(video.shares || 0),
      subscribersGained: parseInt(video.subscribers_gained || 0),
      subscribersLost: parseInt(video.subscribers_lost || 0),
      // Duration and retention data from BigQuery
      duration: duration,
      avgViewDuration: avgViewDuration,
      avgViewDurationSeconds: video.average_view_duration_seconds,
      avgViewDurationPercentage: video.average_view_duration_percentage,
      watchTimeMinutes: video.watch_time_minutes,
      videoDurationSeconds: video.video_duration_seconds,
      isShort:
        duration &&
        duration.split(":")[0] === "0" &&
        parseInt(duration.split(":")[1]) < 183.5,
      retentionRate: stayedToWatch,
      viewsIncrease: viewsIncrease,
      // Add metrics object for frontend compatibility
      metrics: {
        retentionRate: stayedToWatch,
        avgViewDurationPercentage: video.average_view_duration_percentage,
        watchTimeMinutes: video.watch_time_minutes,
        avgViewDuration: video.average_view_duration,
        avgViewDurationSeconds: video.average_view_duration_seconds,
      },
      // High-quality thumbnails from BigQuery
      preview:
        video.high_thumbnail_url ||
        video.medium_thumbnail_url ||
        video.default_thumbnail_url ||
        `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
      highThumbnail: video.high_thumbnail_url,
      mediumThumbnail: video.medium_thumbnail_url,
      defaultThumbnail: video.default_thumbnail_url,
      // Retention data from BigQuery
      retentionData: retentionData,
      accountName: video.account_name || accountName,
      writerName: video.writer_name,
      publishDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      needsViewsFromPostgres: true,
    };

    return videoData;
  } catch (error) {
    console.error("❌ BigQuery video analytics query error:", error);
    throw error;
  }
}

// Individual video data endpoint for VideoAnalytics page
app.get("/api/video/:id", async (req, res) => {
  const { id } = req.params;
  const { writer_id, range = "lifetime", start_date, end_date } = req.query;

  if (!id) {
    return res.status(400).json({ error: "missing video id" });
  }

  try {
    console.log(
      "🎬 Getting video details for ID:",
      id,
      "Writer:",
      writer_id,
      "Range:",
      range
    );

    // Try BigQuery first for enhanced data (but not views)
    let bigQueryData = null;
    try {
      console.log("🔍 Attempting BigQuery lookup for enhanced data:", id);
      bigQueryData = await getBigQueryVideoAnalytics(id, writer_id, range);
      console.log(`✅ BigQuery enhanced data for ${id}:`, bigQueryData.title);

      // If BigQuery has enhanced data but needs views from PostgreSQL, continue to get views
      if (bigQueryData.needsViewsFromPostgres) {
        console.log(
          "🔄 BigQuery enhanced data found, now getting views from PostgreSQL/InfluxDB..."
        );
      } else {
        // If BigQuery has complete data, return it
        return res.json(bigQueryData);
      }
    } catch (bigQueryError) {
      console.error(
        "❌ BigQuery error for video details:",
        bigQueryError.message
      );
      console.log("🔄 Falling back to InfluxDB/PostgreSQL...");
    }

    // Fallback to InfluxDB
    try {
      console.log("🔍 Querying InfluxDB for video ID:", id, "Range:", range);

      // Calculate date range for InfluxDB query
      let timeRange;
      if (range === "lifetime") {
        timeRange = "-5y"; // Use 5 years for lifetime
      } else {
        timeRange = `-${range}d`;
      }

      // Query InfluxDB for specific video data - try multiple field patterns
      console.log(
        `🔍 Searching InfluxDB for video ID: ${id} with time range: ${timeRange}`
      );

      const query = `
        from(bucket: "${bucket}")
          |> range(start: ${timeRange})
          |> filter(fn: (r) => r._measurement == "views")
          |> filter(fn: (r) => r.video_id == "${id}" or r.id == "${id}" or r.video_id == ${id})
          |> last()
      `;

      const results = await queryInfluxDB(query);

      console.log(
        `✅ InfluxDB video query completed. Found ${results.length} records for video ${id}`
      );

      if (results.length > 0) {
        console.log(`🎯 Using InfluxDB data for video ${id}`);
        const influxVideo = results[0];

        // Get additional metrics from InfluxDB
        const totalData = await getVideoTotalData(influxVideo.url || "");
        const chartData = await getVideoLineChartData(
          influxVideo.url || "",
          range || "7",
          start_date,
          end_date,
          influxVideo.posted_date
        );

        // Get actual duration from PostgreSQL statistics_youtube_api table
        const durationQuery = `
          SELECT statistics_youtube_api.duration
          FROM video
          LEFT JOIN statistics_youtube_api ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
          WHERE video.id = $1
        `;
        const { rows: durationRows } = await pool.query(durationQuery, [
          parseInt(id),
        ]);
        const duration =
          durationRows.length > 0 && durationRows[0].duration
            ? durationRows[0].duration
            : null;

        if (!duration) {
          console.log(
            `⚠️ No duration data available for video ${id} - using fallback duration`
          );
        }
        // Get real audience retention data from BigQuery - PRIMARY SOURCE
        let retentionData = [];
        let avgViewDuration = 0;
        let stayedToWatch = 0;
        let accountName = "Unknown Account";

        console.log(
          `📊 BigQuery PRIMARY (InfluxDB path): Getting audience retention for video ${id}, writer ${writer_id}`
        );
        const retentionResult = await getBigQueryAudienceRetention(
          id,
          writer_id
        );

        if (retentionResult) {
          retentionData = retentionResult.retentionData;
          avgViewDuration = retentionResult.metrics.avgViewDuration;
          stayedToWatch = retentionResult.metrics.stayedToWatch;
          accountName = retentionResult.accountName;

          // Adjust time format based on actual video duration
          const parts = duration.split(":");
          if (parts.length >= 2) {
            const totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            console.log(
              `🕐 Video duration: ${duration} = ${totalSeconds} seconds`
            );

            retentionData = retentionData.map((point, index) => {
              const actualSeconds = Math.floor(point.timeRatio * totalSeconds);
              const minutes = Math.floor(actualSeconds / 60);
              const seconds = actualSeconds % 60;
              const timeStr = `${minutes}:${seconds
                .toString()
                .padStart(2, "0")}`;

              // Log first few conversions for debugging
              if (index < 3) {
                console.log(
                  `🕐 Time conversion ${index}: ratio=${point.timeRatio} → ${actualSeconds}s → ${timeStr}`
                );
              }

              return {
                ...point,
                time: timeStr,
              };
            });
          }

          console.log(
            `✅ BigQuery PRIMARY (InfluxDB path): Using real retention data: ${retentionData.length} points, account: ${accountName}`
          );
        } else {
          console.log(
            `❌ BigQuery PRIMARY (InfluxDB path): No retention data found for video ${id} - this should not happen in production`
          );
          // Only log error, don't use fallback - BigQuery should be the primary source
          throw new Error(
            `No audience retention data available in BigQuery for video ${id}`
          );
        }

        // Calculate real viewsIncrease using BigQuery data (no random values)
        let viewsIncrease = 0;
        try {
          if (global.bigqueryClient && influxVideo.url) {
            // Extract YouTube video ID from URL
            const youtubeVideoId = extractVideoId(influxVideo.url);
            if (youtubeVideoId) {
              // Get writer name for BigQuery query
              const writerQuery = `SELECT name FROM writer WHERE id = $1`;
              const { rows: writerRows } = await pool.query(writerQuery, [
                parseInt(writer_id),
              ]);
              const writerName = writerRows[0]?.name;

              if (writerName) {
                const projectId =
                  process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
                const dataset = "dbt_youtube_analytics";

                // 1️⃣ Get the writer’s historic average views (excluding this video)
                // Only include videos from last 6 months with at least 1000 views for better average
                const avgViewsQuery = `
                  SELECT
                    AVG(views) AS avg_views,
                    COUNT(*) AS video_count,
                    MIN(views) AS min_views,
                    MAX(views) AS max_views
                  FROM \`${projectId}.${dataset}.youtube_video_report_historical\`
                  WHERE writer_name = @writer_name
                    AND video_id != @video_id
                    AND views >= 1000
                    AND DATE(est_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
                `;
                const [avgRows] = await global.bigqueryClient.query({
                  query: avgViewsQuery,
                  params: {
                    writer_name: writerName,
                    video_id: youtubeVideoId,
                  },
                });
                const avgViews = avgRows[0]?.avg_views || 0;
                const videoCount = avgRows[0]?.video_count || 0;

                // 2️⃣ Compute percent increase vs. average
                const thisViews = totalData.views || influxVideo._value || 0;
                if (avgViews > 0 && videoCount >= 5) {
                  // Need at least 5 videos for meaningful average
                  viewsIncrease = Math.round(
                    ((thisViews - avgViews) / avgViews) * 100
                  );
                }

                console.log(
                  `📊 InfluxDB ViewsIncrease calculation: ${thisViews} views vs ${Math.round(
                    avgViews
                  )} avg (${videoCount} videos) = ${viewsIncrease}%`
                );
              }
            }
          }
        } catch (viewsIncreaseError) {
          console.error(
            "⚠️ InfluxDB path: Error calculating viewsIncrease, using 0:",
            viewsIncreaseError
          );
          viewsIncrease = 0;
        }

        // Merge InfluxDB views data with BigQuery enhanced data if available
        const videoData = {
          id: id,
          title: bigQueryData?.title || influxVideo.title || `Video ${id}`,
          description: bigQueryData?.description || "",
          channelTitle: bigQueryData?.channelTitle || "",
          url: bigQueryData?.url || influxVideo.url || "",
          // Views from InfluxDB (original source)
          views: totalData.views || influxVideo._value || 0,

          // Engagement from PostgreSQL statistics_youtube_api (most accurate)
          likes: await getPostgreSQLLikesComments(id, 'likes'),
          comments: await getPostgreSQLLikesComments(id, 'comments'),
          dislikes: bigQueryData?.dislikes || 0,
          shares: bigQueryData?.shares || 0,
          subscribersGained: bigQueryData?.subscribersGained || 0,
          subscribersLost: bigQueryData?.subscribersLost || 0,
          // Duration and retention from BigQuery if available
          duration: bigQueryData?.duration || duration,
          avgViewDuration: bigQueryData?.avgViewDuration,
          avgViewDurationSeconds: bigQueryData?.avgViewDurationSeconds,
          avgViewDurationPercentage: bigQueryData?.avgViewDurationPercentage,
          watchTimeMinutes: bigQueryData?.watchTimeMinutes,
          videoDurationSeconds: bigQueryData?.videoDurationSeconds,
          isShort:
            bigQueryData?.isShort !== undefined
              ? bigQueryData.isShort
              : getVideoType(influxVideo.url) === "short",
          viewsIncrease: viewsIncrease,
          retentionRate: bigQueryData?.retentionRate || stayedToWatch,
          // Add metrics object for frontend compatibility
          metrics: {
            retentionRate: bigQueryData?.retentionRate || stayedToWatch,
            avgViewDurationPercentage: bigQueryData?.avgViewDurationPercentage,
            watchTimeMinutes: bigQueryData?.watchTimeMinutes,
            avgViewDuration: bigQueryData?.avgViewDuration,
            avgViewDurationSeconds: bigQueryData?.avgViewDurationSeconds,
          },
          // Thumbnails from BigQuery if available, otherwise InfluxDB
          preview:
            bigQueryData?.preview ||
            influxVideo.preview ||
            (influxVideo.url
              ? `https://img.youtube.com/vi/${extractVideoId(
                  influxVideo.url
                )}/maxresdefault.jpg`
              : ""),
          highThumbnail: bigQueryData?.highThumbnail,
          mediumThumbnail: bigQueryData?.mediumThumbnail,
          defaultThumbnail: bigQueryData?.defaultThumbnail,
          // Chart data from InfluxDB (original source)
          chartData: chartData,
          // Retention data from BigQuery if available
          retentionData: bigQueryData?.retentionData || retentionData,
          accountName: bigQueryData?.accountName || accountName,
          writerName: bigQueryData?.writerName,
          // Use consistent published date format - same as content page
          publishDate:
            bigQueryData?.publishDate ||
            (influxVideo.posted_date
              ? new Date(influxVideo.posted_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Unknown Date"),
          posted_date: bigQueryData?.posted_date || influxVideo.posted_date,
          influxData: totalData, // Keep this for reference
        };

        console.log(
          `✅ Returning InfluxDB data for video: ${videoData.title} (${videoData.views} views)`
        );
        console.log(`📊 Chart data points: ${chartData.length}`);
        return res.json(videoData);
      }

      // If no InfluxDB data found, fall back to PostgreSQL
      console.log("⚠️ No video found in InfluxDB, trying PostgreSQL fallback");
    } catch (influxError) {
      console.error(
        "❌ InfluxDB error for video details, trying PostgreSQL fallback:",
        influxError
      );
    }

    // Fallback to PostgreSQL
    if (pool) {
      console.log("🔄 Using PostgreSQL fallback for video details");

      // First, let's check if the video exists at all (debug query)
      const debugQuery = `
        SELECT
          video.id,
          video.url,
          video.script_title AS title,
          video.writer_id,
          video.video_cat,
          video.created,
          statistics_youtube_api.video_id as stats_video_id,
          statistics_youtube_api.posted_date,
          statistics_youtube_api.preview,
          COALESCE(statistics_youtube_api.likes_total, 0) AS likes_total,
          COALESCE(statistics_youtube_api.comments_total, 0) AS comments_total,
          COALESCE(statistics_youtube_api.views_total, 0) AS views_total
        FROM video
        LEFT JOIN statistics_youtube_api
            ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
        WHERE video.id = $1;
      `;

      console.log(`🔍 Debug: Checking if video ${id} exists in database...`);
      const { rows: debugRows } = await pool.query(debugQuery, [parseInt(id)]);

      if (debugRows.length > 0) {
        const debugVideo = debugRows[0];
        console.log(`📹 Debug: Found video ${id}:`, {
          id: debugVideo.id,
          title: debugVideo.title,
          url: debugVideo.url,
          writer_id: debugVideo.writer_id,
          video_cat: debugVideo.video_cat,
          stats_video_id: debugVideo.stats_video_id,
          has_youtube_url: debugVideo.url?.includes("youtube.com") || false,
        });
      } else {
        console.log(`❌ Debug: Video ${id} does not exist in video table`);
        return res.status(404).json({ error: "Video not found in database" });
      }

      // Now try the actual query with writer filter (always required for authenticated users)
      const videoQuery = `
        SELECT
          video.id,
          video.url,
          video.script_title AS title,
          video.writer_id,
          COALESCE(statistics_youtube_api.posted_date, video.created) AS posted_date,
          statistics_youtube_api.preview,
          statistics_youtube_api.duration,
          COALESCE(statistics_youtube_api.likes_total, 0) AS likes_total,
          COALESCE(statistics_youtube_api.comments_total, 0) AS comments_total,
          COALESCE(statistics_youtube_api.views_total, 0) AS views_total
        FROM video
        LEFT JOIN statistics_youtube_api
            ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
        WHERE video.id = $1
          AND video.writer_id = $2;
      `;
      const queryParams = [parseInt(id), parseInt(writer_id)];
      console.log(
        `🔍 PostgreSQL query with writer filter: video ${id}, writer ${writer_id}`
      );

      const { rows } = await pool.query(videoQuery, queryParams);

      if (rows.length === 0) {
        // Check specific reasons why video wasn't found
        const debugVideo = debugRows[0];
        let reason = "Unknown reason";

        if (debugVideo.writer_id !== parseInt(writer_id)) {
          reason = `Access denied: video belongs to writer ${debugVideo.writer_id}, you are writer ${writer_id}`;
        } else if (debugVideo.video_cat === "full to short") {
          reason = `Video type: full to short (now included)`;
        } else if (!debugVideo.url?.includes("youtube.com")) {
          reason = `Not a YouTube video: URL is '${debugVideo.url}'`;
        } else if (!debugVideo.account_id) {
          reason = `Video has no account mapping (account_id is NULL)`;
        }

        console.log(
          `❌ Video ${id} not found in PostgreSQL with filters. Reason: ${reason}`
        );
        return res.status(403).json({
          error:
            "Access denied: You can only view videos that belong to your account",
          debug: {
            video_exists: true,
            video_id: debugVideo.id,
            video_writer_id: debugVideo.writer_id,
            your_writer_id: writer_id,
            video_cat: debugVideo.video_cat,
            url: debugVideo.url,
            reason: reason,
          },
        });
      }

      const video = rows[0];
      console.log(
        `📹 Found video in PostgreSQL: ID=${video.id}, Title="${video.title}", URL="${video.url}"`
      );
      console.log(`📊 Raw video data from database:`, {
        id: video.id,
        duration: video.duration,
        views_total: video.views_total,
        likes_total: video.likes_total,
        comments_total: video.comments_total,
        posted_date: video.posted_date,
        preview: video.preview,
      });

      // Log if video has no duration data but continue processing
      if (!video.duration) {
        console.log(
          `⚠️ Video ${id} has no duration data - will use fallback duration`
        );
      }

      // Use actual duration from database (no fallbacks)
      const duration = video.duration;
      console.log(
        `✅ Using duration from statistics_youtube_api.duration: "${duration}"`
      );

      // Determine video type based on duration (< 3 minutes = short, >= 3 minutes = video)
      let videoType = "video"; // default
      let isShort = false;
      const fallbackDuration = duration || "0:00"; // Use fallback if duration is missing

      if (duration) {
        const parts = duration.split(":");
        if (parts.length >= 2) {
          const minutes = parseInt(parts[0]) || 0;
          const seconds = parseInt(parts[1]) || 0;
          const totalSeconds = minutes * 60 + seconds;

          if (totalSeconds < 180) {
            // Less than 3 minutes (180 seconds)
            videoType = "short";
            isShort = true;
          }
        }
      } else {
        // If no duration data, assume it's a video (not short) as default
        console.log(
          `⚠️ No duration data for video ${id}, defaulting to video type`
        );
      }

      console.log(
        `🎬 Video type determined by duration: ${videoType}, Duration: ${duration}, isShort: ${isShort}`
      );

      // Format the posted date properly
      let formattedDate = "Unknown Date";
      if (video.posted_date) {
        try {
          const date = new Date(video.posted_date);
          formattedDate = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        } catch (dateError) {
          console.error("❌ Error formatting date:", dateError);
        }
      }

      // Get real chart data from InfluxDB for individual video, filtered by published date
      const chartData = await getVideoLineChartData(
        video.url,
        range,
        start_date,
        end_date,
        video.posted_date
      );

      // Try to get real audience retention data from BigQuery, fallback to mock if not available
      let retentionData = 0;
      let avgViewDuration = 0;
      let stayedToWatch = 0;
      let accountName = "Unknown Account";

      try {
        const retentionResult = await getBigQueryAudienceRetention(
          video.id,
          video.writer_id
        );
        if (retentionResult) {
          retentionData = retentionResult.retentionData;
          avgViewDuration = retentionResult.metrics.avgViewDuration;
          stayedToWatch = retentionResult.metrics.stayedToWatch;
          accountName = retentionResult.accountName;

          // Adjust time format based on actual video duration
          if (duration) {
            const parts = duration.split(":");
            if (parts.length >= 2) {
              const totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
              console.log(
                `🕐 PostgreSQL path - Video duration: ${duration} = ${totalSeconds} seconds`
              );

              retentionData = retentionData.map((point, index) => {
                const actualSeconds = Math.floor(
                  point.timeRatio * totalSeconds
                );
                const minutes = Math.floor(actualSeconds / 60);
                const seconds = actualSeconds % 60;
                const timeStr = `${minutes}:${seconds
                  .toString()
                  .padStart(2, "0")}`;

                // Log first few conversions for debugging
                if (index < 3) {
                  console.log(
                    `🕐 PostgreSQL time conversion ${index}: ratio=${point.timeRatio} → ${actualSeconds}s → ${timeStr}`
                  );
                }

                return {
                  ...point,
                  time: timeStr,
                };
              });
            }
          }

          console.log(
            `📊 PostgreSQL path: Using real retention data: ${retentionData.length} points, account: ${accountName}`
          );
        }
      } catch (retentionError) {
        console.error(
          "⚠️ PostgreSQL path: Error getting retention data, using fallback:",
          retentionError
        );
      }

      // Calculate real viewsIncrease using BigQuery data (no random values)
      let viewsIncrease = 0;
      try {
        if (global.bigqueryClient && video.url) {
          // Extract YouTube video ID from URL
          const youtubeVideoId = extractVideoId(video.url);
          if (youtubeVideoId) {
            // Get writer name for BigQuery query
            const writerQuery = `SELECT name FROM writer WHERE id = $1`;
            const { rows: writerRows } = await pool.query(writerQuery, [
              parseInt(video.writer_id),
            ]);
            const writerName = writerRows[0]?.name;

            if (writerName) {
              const projectId =
                process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
              const dataset = "dbt_youtube_analytics";

              // 1️⃣ Get the writer's historic average views (excluding this video)
              // Only include videos from last 6 months with at least 1000 views for better average
              const avgViewsQuery = `
                SELECT
                  AVG(views) AS avg_views,
                  COUNT(*) AS video_count,
                  MIN(views) AS min_views,
                  MAX(views) AS max_views
                FROM \`${projectId}.${dataset}.youtube_video_report_historical\`
                WHERE writer_name = @writer_name
                  AND video_id != @video_id
                  AND views >= 1000
                  AND DATE(est_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
              `;
              const [avgRows] = await global.bigqueryClient.query({
                query: avgViewsQuery,
                params: {
                  writer_name: writerName,
                  video_id: youtubeVideoId,
                },
              });
              const avgViews = avgRows[0]?.avg_views || 0;
              const videoCount = avgRows[0]?.video_count || 0;

              // 2️⃣ Compute percent increase vs. average
              const thisViews = video.views_total || 0;
              if (avgViews > 0 && videoCount >= 5) {
                // Need at least 5 videos for meaningful average
                viewsIncrease = Math.round(
                  ((thisViews - avgViews) / avgViews) * 100
                );
              }

              console.log(
                `📊 PostgreSQL ViewsIncrease calculation: ${thisViews} views vs ${Math.round(
                  avgViews
                )} avg (${videoCount} videos) = ${viewsIncrease}%`
              );
            }
          }
        }
      } catch (viewsIncreaseError) {
        console.error(
          "⚠️ Error calculating viewsIncrease, using 0:",
          viewsIncreaseError
        );
        viewsIncrease = 0;
      }

      // Merge PostgreSQL views data with BigQuery enhanced data if available
      const videoData = {
        id: video.id,
        title: bigQueryData?.title || video.title || "Untitled Video",
        description: bigQueryData?.description || "",
        channelTitle: bigQueryData?.channelTitle || "",
        url: bigQueryData?.url || video.url,
        thumbnail: isShort ? "🎯" : "📺",
        color: isShort ? "#4CAF50" : "#2196F3",
        // Duration from BigQuery if available, otherwise PostgreSQL, with fallback
        duration: bigQueryData?.duration || fallbackDuration,
        // Views from PostgreSQL (original source)
        views: video.views_total || 0,
        viewsIncrease: viewsIncrease,
        // Engagement from BigQuery if available, otherwise PostgreSQL
        likes: bigQueryData?.likes || video.likes_total || 0,
        comments: bigQueryData?.comments || video.comments_total || 0,
        dislikes: bigQueryData?.dislikes || 0,
        shares: bigQueryData?.shares || 0,
        subscribersGained: bigQueryData?.subscribersGained || 0,
        subscribersLost: bigQueryData?.subscribersLost || 0,
        // Retention data from BigQuery if available
        retentionRate: bigQueryData?.retentionRate || stayedToWatch,
        avgViewDuration: bigQueryData?.avgViewDuration,
        avgViewDurationSeconds: bigQueryData?.avgViewDurationSeconds,
        avgViewDurationPercentage: bigQueryData?.avgViewDurationPercentage,
        watchTimeMinutes: bigQueryData?.watchTimeMinutes,
        videoDurationSeconds: bigQueryData?.videoDurationSeconds,
        // Add metrics object for frontend compatibility
        metrics: {
          retentionRate: bigQueryData?.retentionRate || stayedToWatch,
          avgViewDurationPercentage: bigQueryData?.avgViewDurationPercentage,
          watchTimeMinutes: bigQueryData?.watchTimeMinutes,
          avgViewDuration: bigQueryData?.avgViewDuration,
          avgViewDurationSeconds: bigQueryData?.avgViewDurationSeconds,
        },
        isShort:
          bigQueryData?.isShort !== undefined ? bigQueryData.isShort : isShort,
        publishDate: bigQueryData?.publishDate || formattedDate,
        posted_date: video.posted_date,
        // Thumbnails from BigQuery if available, otherwise PostgreSQL
        preview:
          bigQueryData?.preview ||
          video.preview ||
          (video.url
            ? `https://img.youtube.com/vi/${extractVideoId(
                video.url
              )}/maxresdefault.jpg`
            : ""),
        highThumbnail: bigQueryData?.highThumbnail,
        mediumThumbnail: bigQueryData?.mediumThumbnail,
        defaultThumbnail: bigQueryData?.defaultThumbnail,
        // Chart data from PostgreSQL (original mock data)
        chartData: chartData,
        // Retention data from BigQuery if available
        retentionData: bigQueryData?.retentionData || retentionData,
        accountName: bigQueryData?.accountName || accountName,
        writerName: bigQueryData?.writerName,
        // Add debug info
        writer_id: video.writer_id,
      };

      console.log(
        `✅ Found video from PostgreSQL: ${videoData.title} (${videoData.views} views, type: ${videoType})`
      );
      console.log(`📊 Chart data sample:`, videoData.chartData?.slice(0, 3));
      res.json(videoData);
    } else {
      res.status(500).json({ error: "Database not available" });
    }
  } catch (error) {
    console.error("Error fetching video details:", error);
    res.status(500).json({ error: "Error fetching video details" });
  }
});

// Helper function to generate average view duration based on total duration
function generateAverageViewDuration(totalDuration) {
  if (!totalDuration) return "1:30";

  const parts = totalDuration.split(":");
  let totalSeconds = 0;

  if (parts.length === 2) {
    totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  // Average view duration is typically 60-80% of total duration
  const avgSeconds = Math.floor(totalSeconds * (0.6 + Math.random() * 0.2));
  const minutes = Math.floor(avgSeconds / 60);
  const seconds = avgSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Helper function to get video line chart data using your InfluxDB API
async function getVideoLineChartData(
  url,
  timeRange = "7d",
  customStartDate = null,
  customEndDate = null,
  publishedDate = null
) {
  if (!url) {
    console.log("⚠️ No URL provided for line chart data");
    return []; // Return empty array instead of mock data
  }

  try {
    console.log(
      `📈 Getting InfluxDB line chart data for URL: ${url}, Range: ${timeRange}`
    );
    console.log(`🔍 DEBUG: Video URL being queried: "${url}"`);

    let influxRange;
    let startDate, endDate;

    // Handle custom date range
    if (timeRange === "custom" && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      console.log(
        `📈 Using custom date range: ${customStartDate} to ${customEndDate}`
      );

      // For InfluxDB, we'll use the start date directly
      influxRange = startDate.toISOString();
    } else {
      // Convert frontend range values to proper format
      if (timeRange === "lifetime") {
        influxRange = "-2y"; // 2 years for lifetime
      } else {
        // Handle numeric values from frontend (7, 14, 28, 90, 365)
        const days = parseInt(timeRange.toString().replace("d", "")) || 7;
        influxRange = `-${days}d`;
      }

      console.log(
        `📈 Converted range '${timeRange}' to InfluxDB format '${influxRange}'`
      );

      // Calculate date range for non-custom ranges
      endDate = new Date();
      startDate = new Date();

      if (timeRange === "lifetime") {
        startDate.setFullYear(startDate.getFullYear() - 2); // 2 years for lifetime
      } else {
        const days = parseInt(timeRange.toString().replace("d", "")) || 7;
        startDate.setDate(startDate.getDate() - days);
      }
    }

    // Use InfluxDB range format for better performance
    let query;

    if (timeRange === "custom" && customStartDate && customEndDate) {
      console.log(
        `📈 Getting line chart data for URL: ${url}, Custom Range: ${customStartDate} to ${customEndDate}`
      );
      query = `
        from(bucket: "youtube_api")
          |> range(start: ${startDate.toISOString()}, stop: ${endDate.toISOString()})
          |> filter(fn: (r) => r._measurement == "views")
          |> filter(fn: (r) => r._field == "views")
          |> filter(fn: (r) => r.url == "${url}")
          |> aggregateWindow(every: 1h, fn: last, createEmpty: false)
          |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
          |> sort(columns: ["_time"], desc: false)
      `;
    } else {
      console.log(
        `📈 Getting line chart data for URL: ${url}, InfluxDB Range: ${influxRange}`
      );
      query = `
        from(bucket: "youtube_api")
          |> range(start: ${influxRange})
          |> filter(fn: (r) => r._measurement == "views")
          |> filter(fn: (r) => r._field == "views")
          |> filter(fn: (r) => r.url == "${url}")
          |> aggregateWindow(every: 1h, fn: last, createEmpty: false)
          |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
          |> sort(columns: ["_time"], desc: false)
      `;
    }

    const result = await queryInfluxDB(query);
    console.log(
      `📊 InfluxDB line chart query returned ${result.length} data points`
    );

    if (result.length > 0) {
      // Sort by timestamp first to ensure chronological order
      result.sort((a, b) => new Date(a._time) - new Date(b._time));

      console.log(`🔍 DEBUG: Raw InfluxDB data for URL "${url}":`, {
        totalPoints: result.length,
        firstPoint: result[0]
          ? {
              time: result[0]._time,
              value: result[0]._value,
              url: result[0].url,
            }
          : null,
        lastPoint: result[result.length - 1]
          ? {
              time: result[result.length - 1]._time,
              value: result[result.length - 1]._value,
              url: result[result.length - 1].url,
            }
          : null,
      });

      // Filter data to only include dates after the video was published
      let filteredResult = result;
      if (publishedDate) {
        const publishedTimestamp = new Date(publishedDate).getTime();
        filteredResult = result.filter((item) => {
          const itemTimestamp = new Date(item._time).getTime();
          return itemTimestamp >= publishedTimestamp;
        });

        console.log(
          `🔍 DEBUG: Filtered chart data by published date ${publishedDate}:`
        );
        console.log(
          `📊 Original data points: ${result.length}, After filtering: ${filteredResult.length}`
        );

        if (filteredResult.length === 0) {
          console.log(
            `⚠️ No chart data found after video published date ${publishedDate}`
          );
          return [];
        }
      }

      // Transform to chart format using _value field with proper date formatting
      const chartData = filteredResult.map((item, index) => {
        const date = new Date(item._time);
        return {
          day: index,
          views: item._value || 0,
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          fullDate: date.toISOString(),
          timestamp: item._time,
        };
      });

      console.log(
        `✅ InfluxDB line chart data processed: ${chartData.length} points (sorted chronologically)`
      );
      console.log(
        `📊 Chart date range: ${chartData[0]?.date} to ${
          chartData[chartData.length - 1]?.date
        }`
      );
      return chartData;
    } else {
      console.log("⚠️ No InfluxDB line chart data found for this video");
      return []; // Return empty array instead of mock data
    }
  } catch (error) {
    console.error("❌ Error getting video line chart data:", error);
    return []; // Return empty array instead of mock data
  }
}

// Helper function to get accurate likes and comments from PostgreSQL statistics_youtube_api table
async function getPostgreSQLLikesComments(videoId, field) {
  try {
    const query = `
      SELECT
        COALESCE(statistics_youtube_api.likes_total, 0) AS likes_total,
        COALESCE(statistics_youtube_api.comments_total, 0) AS comments_total
      FROM video
      LEFT JOIN statistics_youtube_api ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
      WHERE video.id = $1
    `;

    const { rows } = await pool.query(query, [parseInt(videoId)]);

    if (rows.length > 0) {
      const result = field === 'likes' ? parseInt(rows[0].likes_total || 0) : parseInt(rows[0].comments_total || 0);
      console.log(`📊 PostgreSQL ${field} for video ${videoId}: ${result}`);
      return result;
    } else {
      console.log(`⚠️ No PostgreSQL data found for video ${videoId}`);
      return 0;
    }
  } catch (error) {
    console.error(`❌ Error getting PostgreSQL ${field} for video ${videoId}:`, error);
    return 0;
  }
}

// Helper function to get video total data from InfluxDB (using correct field names)
async function getVideoTotalData(url) {
  if (!url) {
    return { views: null, likes: null, comments: null };
  }

  try {
    const fields = ["views", "likes", "comments"];
    const totalData = {};

    for (let field of fields) {
      try {
        // Query InfluxDB for each field separately without using _value
        const query = `
          from(bucket: "youtube_api")
            |> range(start: -30d)
            |> filter(fn: (r) => r._measurement == "views")
            |> filter(fn: (r) => r._field == "${field}")
            |> filter(fn: (r) => r.url == "${url}")
            |> last()
        `;

        const result = await queryInfluxDB(query);

        if (result.length > 0) {
          // Use the field name directly from the result
          const value = result[0][field] || result[0]._value || 0;
          totalData[field] = value;
          console.log(
            `📊 InfluxDB ${field} for ${url}: ${value} (from ${
              result[0]._value ? "_value" : field
            } field)`
          );
          console.log(`🔍 Full result object:`, result[0]);
        } else {
          totalData[field] = 0;
          console.log(`⚠️ No InfluxDB data found for ${field} on ${url}`);
        }
      } catch (fieldError) {
        console.error(`❌ Error getting ${field} total:`, fieldError);
        totalData[field] = 0;
      }
    }

    return totalData;
  } catch (error) {
    console.error("❌ Error getting video total data:", error);
    return { views: 0, likes: 0, comments: 0 };
  }
}

// Helper function to generate views chart data from InfluxDB historical data
async function getVideoHistoricalData(
  influxService,
  videoId,
  timeRange = "7d"
) {
  if (!influxService) {
    return []; // Return empty array instead of mock data
  }

  try {
    const query = `
      from(bucket: "${influxService.bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "views")
        |> filter(fn: (r) => r._field == "views")
        |> filter(fn: (r) => r.video_id == "${videoId}")
        |> aggregateWindow(every: 1h, fn: last, createEmpty: false)
        |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
        |> sort(columns: ["_time"], desc: false)
    `;

    const results = [];
    await influxService.queryApi.queryRows(query, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        results.push({
          time: o._time,
          views: o._value || 0,
        });
      },
      error(error) {
        console.error("❌ Error getting video historical data:", error);
      },
      complete() {
        console.log(
          `📈 Historical data retrieved: ${results.length} data points for video ${videoId}`
        );
      },
    });

    // Transform to chart format
    return results.map((item, index) => ({
      day: index,
      views: item.views,
      date: new Date(item.time).toLocaleDateString(),
    }));
  } catch (error) {
    console.error("❌ Error querying historical data:", error);
    return []; // Return empty array instead of mock data
  }
}

// Helper function to generate mock views chart data (fallback)
function generateMockViewsChartData(totalViews, range = "7") {
  const data = [];
  let currentViews = 0;
  const today = new Date();

  // Determine number of days based on range
  let days;
  if (range === "lifetime") {
    days = 30; // Use 30 days for lifetime
  } else {
    days = parseInt(range.toString().replace("d", "")) || 7;
  }

  // Limit to reasonable number of data points for chart performance
  days = Math.min(days, 90); // Max 90 days for chart

  for (let day = 0; day <= days; day++) {
    // Simulate growth curve
    const progress = day / days;
    const growthFactor = Math.pow(progress, 0.7); // Slower growth at start, faster later
    currentViews = Math.floor(totalViews * growthFactor);

    // Create date for each day - start from oldest date and go forward
    const date = new Date(today);
    date.setDate(date.getDate() - (days - day));

    data.push({
      day,
      views: currentViews,
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      fullDate: date.toISOString(),
      timestamp: date.toISOString(),
    });
  }

  // Sort by timestamp to ensure chronological order
  data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return data;
}

// Helper function to generate retention data with key moments
function generateRetentionData(duration, avgViewDuration = null) {
  if (!duration) return [];

  const parts = duration.split(":");
  let totalSeconds = 0;

  if (parts.length === 2) {
    totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  const data = [];
  const intervals = Math.min(30, Math.max(10, totalSeconds / 10)); // 10-second intervals, 10-30 points

  // Calculate key moment at 30 seconds (or 25% of video, whichever is earlier)
  const keyMomentSeconds = Math.min(30, totalSeconds * 0.25);

  for (let i = 0; i <= intervals; i++) {
    const timeSeconds = Math.floor((totalSeconds * i) / intervals);
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = timeSeconds % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Simulate realistic retention curve
    const progress = i / intervals;
    let retention;

    if (progress < 0.1) {
      // High retention at start (90-100%)
      retention = 100 - progress * 100;
    } else if (progress < 0.3) {
      // Gradual drop (70-90%)
      retention = 90 - (progress - 0.1) * 100;
    } else {
      // Steady decline (40-70%)
      retention = 70 - (progress - 0.3) * 43;
    }

    // Add some randomness but keep it realistic
    retention += (Math.random() - 0.5) * 10;
    retention = Math.max(20, Math.min(180, retention)); // Keep between 20% and 180%

    // Mark key moment
    let keyMoment = null;
    if (Math.abs(timeSeconds - keyMomentSeconds) < 5) {
      keyMoment = retention + 20; // Show key moment marker
    }

    data.push({
      time: timeStr,
      percentage: Math.round(retention),
      keyMoment: keyMoment,
      isKeyMoment: Math.abs(timeSeconds - keyMomentSeconds) < 5,
    });
  }

  return data;
}

// Video analytics time-series data endpoint
app.get("/api/video/:id/analytics", async (req, res) => {
  const { id } = req.params;
  const { range = "lifetime" } = req.query;

  if (!id) {
    return res.status(400).json({ error: "missing video id" });
  }

  try {
    console.log(
      "📈 Getting time-series analytics for video ID:",
      id,
      "Range:",
      range
    );

    // Initialize InfluxDB service
    let influxService;
    try {
      const InfluxService = require("./services/influxService");
      influxService = new InfluxService();
    } catch (error) {
      console.error(
        "❌ Failed to initialize InfluxDB for video analytics:",
        error
      );
    }

    if (influxService) {
      try {
        // Calculate time range
        let timeRange;
        if (range === "lifetime") {
          timeRange = "-5y";
        } else {
          timeRange = `-${range}d`;
        }

        // Query for time-series views data
        const viewsQuery = `
          from(bucket: "${influxService.bucket}")
            |> range(start: ${timeRange})
            |> filter(fn: (r) => r._measurement == "views")
            |> filter(fn: (r) => r._field == "views")
            |> filter(fn: (r) => r.video_id == "${id}")
            |> aggregateWindow(every: 1h, fn: last, createEmpty: false)
            |> aggregateWindow(every: 1d, fn: last, createEmpty: false)
            |> sort(columns: ["_time"], desc: false)
        `;

        const viewsData = [];
        await influxService.queryApi.queryRows(viewsQuery, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            viewsData.push({
              date: o._time,
              views: o._value || 0,
            });
          },
          error(error) {
            console.error("❌ Error getting views time-series:", error);
          },
          complete() {
            console.log(
              `📊 Views time-series retrieved: ${viewsData.length} data points`
            );
          },
        });

        // Query for engagement data (likes, comments) - without pivot
        const engagementQuery = `
          from(bucket: "${influxService.bucket}")
            |> range(start: ${timeRange})
            |> filter(fn: (r) => r._measurement == "views")
            |> filter(fn: (r) => r._field == "likes" or r._field == "comments")
            |> filter(fn: (r) => r.video_id == "${id}")
            |> sort(columns: ["_time"], desc: false)
        `;

        const engagementData = [];
        await influxService.queryApi.queryRows(engagementQuery, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            engagementData.push({
              date: o._time,
              field: o._field,
              value: o._value || 0,
            });
          },
          error(error) {
            console.error("❌ Error getting engagement time-series:", error);
          },
          complete() {
            console.log(
              `💬 Engagement time-series retrieved: ${engagementData.length} data points`
            );
          },
        });

        // Return structured analytics data
        const analyticsData = {
          views: viewsData,
          engagement: engagementData,
          summary: {
            totalViews: viewsData.reduce((sum, item) => sum + item.views, 0),
            totalLikes: engagementData.reduce(
              (sum, item) => sum + item.likes,
              0
            ),
            totalComments: engagementData.reduce(
              (sum, item) => sum + item.comments,
              0
            ),
            dateRange: range,
            dataPoints: viewsData.length,
          },
        };

        console.log(
          `✅ Video analytics retrieved for ${id}: ${analyticsData.summary.totalViews} total views`
        );
        res.json(analyticsData);
        return;
      } catch (influxError) {
        console.error("❌ InfluxDB error for video analytics:", influxError);
      }
    }

    // Fallback to mock analytics data
    console.log("📝 Using mock analytics data for video:", id);
    const mockAnalytics = {
      views: 0,
      engagement: 0,
      summary: {
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        dateRange: 0,
        dataPoints: 0,
      },
    };

    res.json(mockAnalytics);
  } catch (error) {
    console.error("Error fetching video analytics:", error);
    res.status(500).json({ error: "Error fetching video analytics" });
  }
});

// Helper function to determine measurement and field based on URL and field
function getMeasurementAndField(url, field) {
  // Default measurement is "views"
  let measurement = "views";
  let adjustedField = field;

  // You can add logic here to adjust measurement/field based on URL patterns
  // For now, keeping it simple
  return { measurement, adjustedField };
}

// Helper function to check if video is a repost
async function isRepost(url) {
  // Add your logic to determine if a video is a repost
  // For now, returning false as default
  return false;
}

// InfluxDB client setup (using your existing pattern)
const { InfluxDB } = require("@influxdata/influxdb-client");

const influxDB = new InfluxDB({
  url: process.env.INFLUXDB_URL,
  token: process.env.INFLUXDB_TOKEN,
});
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET;

// Helper function to query InfluxDB (using your existing pattern)
const queryInfluxDB = async (query) => {
  const queryApi = influxDB.getQueryApi(org);
  const results = [];

  return new Promise((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const rowData = tableMeta.toObject(row);
        results.push(rowData);
      },
      error(error) {
        console.error("❌ InfluxDB Query Error:", error);
        reject(error);
      },
      complete() {
        console.log(
          `✅ InfluxDB query completed. Found ${results.length} records`
        );
        resolve(results);
      },
    });
  });
};

// InfluxDB Scorecard Data API (your existing endpoint)
app.post("/api/influx/scorecard-data", async (req, res) => {
  const { url, field } = req.body;
  const { measurement, field: adjustedField } = getMeasurementAndField(
    url,
    field
  );

  try {
    // Determine if the video is a repost and select the appropriate bucket
    const isRepostVideo = await isRepost(url);
    const bucketName = isRepostVideo ? "repost_views" : "youtube_api";

    const query = `
      from(bucket: "${bucketName}")
        |> range(start: -2d)
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> filter(fn: (r) => r["_field"] == "${adjustedField}")
        |> filter(fn: (r) => r["url"] == "${url}")
        |> aggregateWindow(every: 60m, fn: max, createEmpty: true)
        |> fill(usePrevious: true)
        |> derivative(unit: 60m)
        |> keep(columns: ["_time", "_value"])
    `;

    const result = await queryInfluxDB(query);

    // Initialize variables for the 24-hour periods
    const now = new Date();
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prev24hStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let latest24hTotal = 0;
    let previous24hTotal = 0;

    // Iterate through the results to calculate 24-hour totals
    result.forEach((record) => {
      const recordTime = new Date(record._time);
      const recordValue = record._value;

      if (recordValue !== null) {
        if (recordTime >= last24hStart && recordTime <= now) {
          latest24hTotal += recordValue;
        } else if (recordTime >= prev24hStart && recordTime < last24hStart) {
          previous24hTotal += recordValue;
        }
      }
    });

    // Calculate total value for the last 48 hours
    const totalValueLast48h = latest24hTotal + previous24hTotal;

    // Calculate delta as percentage change
    const delta =
      previous24hTotal > 0
        ? Math.round(
            ((latest24hTotal - previous24hTotal) / previous24hTotal) * 100
          )
        : null;

    // Return data in the required format
    res.json({
      value: totalValueLast48h,
      delta: delta,
      debug: {
        latest_24h_total: latest24hTotal,
        previous_24h_total: previous24hTotal,
        total_value_last_48h: totalValueLast48h,
      },
    });
  } catch (error) {
    console.error("Error querying InfluxDB:", error);
    res.status(500).json({ error: "Error fetching scorecard data" });
  }
});

// InfluxDB Line Chart Data API (your existing endpoint)
app.post("/api/influx/line-chart-data", async (req, res) => {
  const { url, startDate, endDate } = req.body;
  const { measurement, field: adjustedField } = getMeasurementAndField(
    url,
    "views"
  );

  try {
    // Determine if the video is a repost and select the appropriate bucket
    const isRepostVideo = await isRepost(url);
    const bucketName = isRepostVideo ? "repost_views" : "youtube_api";

    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();

    const query = `
      from(bucket: "${bucketName}")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r["_measurement"] == "${measurement}")
        |> filter(fn: (r) => r["_field"] == "${adjustedField}")
        |> filter(fn: (r) => r["url"] == "${url}")
        |> group(columns: ["url"])
        |> aggregateWindow(every: 60m, fn: max, createEmpty: true)
        |> fill(usePrevious: true)
        |> keep(columns: ["_time", "_value"])
    `;

    const result = await queryInfluxDB(query);
    res.json(result);
  } catch (error) {
    console.error("Error querying InfluxDB:", error);
    res.status(500).json({ error: "Error fetching line chart data" });
  }
});

// Helper functions for mock data
function generateMockTimeSeriesData(range) {
  const days = range === "lifetime" ? 30 : parseInt(range) || 7;
  const data = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    data.push({
      date: date.toISOString(),
      views: Math.floor(Math.random() * 5000) + 1000,
    });
  }

  return data;
}

function generateMockEngagementData(range) {
  const days = range === "lifetime" ? 30 : parseInt(range) || 7;
  const data = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    data.push({
      date: date.toISOString(),
      likes: Math.floor(Math.random() * 200) + 50,
      comments: Math.floor(Math.random() * 20) + 5,
    });
  }

  return data;
}

// Additional Trello API endpoints
app.post("/create-trello-card", async (req, res) => {
  const { apiKey, token, trelloListId, name, desc, attachments } = req.body;

  if (!apiKey || !token || !trelloListId || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const cardResponse = await axios.post(
      `https://api.trello.com/1/cards?key=${apiKey}&token=${token}`,
      {
        idList: trelloListId,
        name,
        desc,
      }
    );

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await axios.post(
          `https://api.trello.com/1/cards/${cardResponse.data.id}/attachments?key=${apiKey}&token=${token}`,
          { url: attachment }
        );
      }
    }

    res.json({ cardId: cardResponse.data.id });
  } catch (error) {
    console.error(
      "Failed to create Trello card:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to create Trello card" });
  }
});

// Function to select a random item from the list
function balancedRandomChoice(items) {
  if (!items || items.length === 0) {
    throw new Error("The list must not be empty.");
  }
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

// Function to add a comment to a Trello card
async function addCommentToTrelloCard(
  trello_card_id,
  selected_item,
  api_key,
  token
) {
  const url = `https://api.trello.com/1/cards/${trello_card_id}/actions/comments`;
  const params = {
    key: api_key,
    token: token,
    text: `Recommended Posting Account: **${selected_item}**`,
  };

  try {
    const response = await axios.post(url, null, { params });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error.message;
  }
}

// Function to get Trello API key and token from PostgreSQL database
async function getTrelloCredentials() {
  try {
    const result = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );
    if (result.rows.length === 0) {
      throw new Error("API credentials not found in the database.");
    }
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to retrieve API credentials: ${error.message}`);
  }
}

// Function to set Posting Account custom field value on a Trello card
const setPostingAccountValue = async (
  trello_card_id,
  newPostingAccountValue,
  api_key,
  token
) => {
  try {
    console.log(`🔧 setPostingAccountValue called with: card=${trello_card_id}, value='${newPostingAccountValue}'`);

    // Step 1: Fetch the card's custom fields to find the 'Posting Account'
    const cardDetailsUrl = `https://api.trello.com/1/cards/${trello_card_id}?key=${api_key}&token=${token}`;
    const cardDetailsResponse = await axios.get(cardDetailsUrl);
    const boardId = cardDetailsResponse.data.idBoard;
    console.log(`🔧 Found board ID: ${boardId}`);

    // Step 2: Get all custom fields on the board
    const customFieldsUrl = `https://api.trello.com/1/boards/${boardId}/customFields?key=${api_key}&token=${token}`;
    const customFieldsResponse = await axios.get(customFieldsUrl);
    console.log(`🔧 Found ${customFieldsResponse.data.length} custom fields on board`);

    // Step 3: Find the 'Posting Account' custom field ID
    const postingAccountField = customFieldsResponse.data.find(
      (field) => field.name === "Posting Account"
    );
    if (!postingAccountField) {
      const availableFields = customFieldsResponse.data.map(f => f.name).join(', ');
      throw new Error(`Custom field 'Posting Account' not found on the board. Available fields: ${availableFields}`);
    }
    const postingAccountFieldId = postingAccountField.id;
    console.log(`🔧 Found 'Posting Account' field: ID=${postingAccountFieldId}, type=${postingAccountField.type}`);

    // Step 4: Find the option ID for the desired value
    if (postingAccountField.type !== 'list') {
      throw new Error(`Posting Account field is not a dropdown/list field. Current type: ${postingAccountField.type}`);
    }

    console.log(`🔧 Available dropdown options:`, postingAccountField.options.map(opt => `"${opt.value.text}" (ID: ${opt.id})`));
    console.log(`🔧 Looking for option matching: "${newPostingAccountValue}"`);

    const targetOption = postingAccountField.options.find(
      (option) => option.value.text.toLowerCase() === newPostingAccountValue.toLowerCase()
    );

    if (!targetOption) {
      // Show available options for debugging
      const availableOptions = postingAccountField.options.map(opt => opt.value.text).join(', ');
      throw new Error(`Option '${newPostingAccountValue}' not found in dropdown. Available options: ${availableOptions}`);
    }

    console.log(`🔧 Found matching option: "${targetOption.value.text}" with ID: ${targetOption.id}`);

    // Step 5: Set the value using the option ID (not text)
    const setValueUrl = `https://api.trello.com/1/cards/${trello_card_id}/customField/${postingAccountFieldId}/item?key=${api_key}&token=${token}`;

    // Try different formats for dropdown values
    let setValueBody;

    // Format 1: Try with idValue (current approach)
    setValueBody = {
      value: { idValue: targetOption.id }
    };

    console.log(`🔧 Trying Format 1 - idValue:`, JSON.stringify(setValueBody, null, 2));
    console.log(`🔧 API URL: ${setValueUrl}`);

    try {
      await axios.put(setValueUrl, setValueBody);
      console.log(`✅ Format 1 (idValue) worked successfully!`);
    } catch (error1) {
      console.log(`❌ Format 1 (idValue) failed:`, error1.response?.data || error1.message);

      // Format 2: Try with just the option ID directly
      setValueBody = {
        idValue: targetOption.id
      };

      console.log(`🔧 Trying Format 2 - direct idValue:`, JSON.stringify(setValueBody, null, 2));

      try {
        await axios.put(setValueUrl, setValueBody);
        console.log(`✅ Format 2 (direct idValue) worked successfully!`);
      } catch (error2) {
        console.log(`❌ Format 2 (direct idValue) failed:`, error2.response?.data || error2.message);

        // Format 3: Try with text value as fallback
        setValueBody = {
          value: { text: newPostingAccountValue }
        };

        console.log(`🔧 Trying Format 3 - text fallback:`, JSON.stringify(setValueBody, null, 2));

        try {
          await axios.put(setValueUrl, setValueBody);
          console.log(`✅ Format 3 (text fallback) worked successfully!`);
        } catch (error3) {
          console.log(`❌ All formats failed. Last error:`, error3.response?.data || error3.message);
          throw new Error(`Failed to set dropdown value. Tried multiple formats. Last error: ${error3.response?.data?.message || error3.message}`);
        }
      }
    }
    console.log(
      `✅ Successfully set 'Posting Account' to '${newPostingAccountValue}' (ID: ${targetOption.id}) on card ID ${trello_card_id}.`
    );
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};

// Daily Limits and posting account management

/**
 * Checks if counters need to be reset based on the current time and last activity
 */
async function checkAndResetCounters() {
  const client = await pool.connect();
  try {
    // Use a transaction to prevent race conditions
    await client.query("BEGIN");

    // Get current date in US Eastern Time
    const now = new Date();

    // Format current date in YYYY-MM-DD format for consistent comparison and storage
    const estDate = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const currentDateStr = `${estDate.getFullYear()}-${String(
      estDate.getMonth() + 1
    ).padStart(2, "0")}-${String(estDate.getDate()).padStart(2, "0")}`;

    // Check if we've already reset counters today
    const lastResetQuery = `
          SELECT value FROM app_settings
          WHERE key = 'last_counter_reset_date'
      `;
    const lastResetResult = await client.query(lastResetQuery);
    const lastResetDate =
      lastResetResult.rows.length > 0 ? lastResetResult.rows[0].value : null;

    // If we've already reset today, no need to check further
    if (lastResetDate === currentDateStr) {
      console.log(`Counters already reset today (${currentDateStr})`);
      await client.query("COMMIT");
      return;
    }

    // Get the last activity timestamp from the audit table
    const lastActivityQuery = `
          SELECT timestamp
          FROM posting_account_audit
          ORDER BY timestamp DESC
          LIMIT 1
      `;

    const lastActivityResult = await client.query(lastActivityQuery);

    let shouldReset = false;

    // If there's a last activity record
    if (lastActivityResult.rows.length > 0) {
      const lastActivityTime = new Date(lastActivityResult.rows[0].timestamp);

      // Convert last activity to EST for comparison
      const lastActivityEst = new Date(
        lastActivityTime.toLocaleString("en-US", {
          timeZone: "America/New_York",
        })
      );

      // Compare just the date portions (year, month, day)
      const isSameDay =
        estDate.getFullYear() === lastActivityEst.getFullYear() &&
        estDate.getMonth() === lastActivityEst.getMonth() &&
        estDate.getDate() === lastActivityEst.getDate();

      if (!isSameDay) {
        console.log(
          `New day detected since last activity. Current: ${currentDateStr}, Last: ${
            lastActivityEst.toISOString().split("T")[0]
          }`
        );
        shouldReset = true;
      }
    } else {
      // No previous activity, check if it's midnight hour
      const estHour = estDate.getHours();
      if (estHour === 0) {
        console.log(
          "No previous activity and midnight detected. Resetting counters..."
        );
        shouldReset = true;
      }
    }

    // Reset counters if needed
    if (shouldReset) {
      console.log("Resetting daily posting account counters...");
      await client.query("CALL reset_posting_daily_used()");

      // Update the last reset date
      const updateLastResetQuery = `
              INSERT INTO app_settings (key, value)
              VALUES ('last_counter_reset_date', $1)
              ON CONFLICT (key) DO UPDATE SET value = $1
          `;
      await client.query(updateLastResetQuery, [currentDateStr]);

      console.log("Daily posting account counters reset successfully.");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in checkAndResetCounters:", error);
    // We don't rethrow the error to prevent it from affecting the main flow
  } finally {
    client.release();
  }
}

/**
 * Logs account activity to the audit table
 * @param {number} postAcctId - The ID of the posting account
 * @param {string} postAcctName - The name of the posting account
 * @param {string} trelloCardId - The ID of the Trello card
 * @returns {Promise<boolean>} - Whether the logging was successful
 */
async function logAccountActivity(postAcctId, postAcctName, trelloCardId) {
  // Validate inputs
  if (!postAcctId || !postAcctName || !trelloCardId) {
    console.error("Invalid parameters for logAccountActivity:", {
      postAcctId,
      postAcctName,
      trelloCardId,
    });
    return false;
  }

  try {
    const query = `
          INSERT INTO posting_account_audit
          (post_acct_id, post_acct_name, trello_card_id, timestamp)
          VALUES ($1, $2, $3, NOW())
          RETURNING id
      `;

    const result = await pool.query(query, [
      postAcctId,
      postAcctName.substring(0, 30), // Ensure it fits in VARCHAR(30)
      trelloCardId.substring(0, 30), // Ensure it fits in VARCHAR(30)
    ]);

    const logId = result.rows[0]?.id;
    console.log(
      `Logged activity (ID: ${logId}) for account ${postAcctName} (ID: ${postAcctId}) for card ${trelloCardId}`
    );
    return true;
  } catch (error) {
    // More specific error handling
    if (error.code === "23505") {
      // Unique violation
      console.error(
        "Duplicate entry error when logging account activity:",
        error.detail
      );
    } else if (error.code === "23503") {
      // Foreign key violation
      console.error(
        "Foreign key constraint error when logging account activity:",
        error.detail
      );
    } else if (error.code === "22001") {
      // String data right truncation
      console.error(
        "Data too long for column when logging account activity:",
        error.detail
      );
    } else {
      console.error("Error logging account activity:", error);
    }
    // We don't throw the error to prevent it from affecting the main flow
    return false;
  }
}

// Daily Limits and posting account management

/**
 * Checks if counters need to be reset based on the current time and last activity
 */
async function checkAndResetCounters() {
  const client = await pool.connect();
  try {
    // Use a transaction to prevent race conditions
    await client.query("BEGIN");

    // Get current date in US Eastern Time
    const now = new Date();

    // Format current date in YYYY-MM-DD format for consistent comparison and storage
    const estDate = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const currentDateStr = `${estDate.getFullYear()}-${String(
      estDate.getMonth() + 1
    ).padStart(2, "0")}-${String(estDate.getDate()).padStart(2, "0")}`;

    // Check if we've already reset counters today
    const lastResetQuery = `
          SELECT value FROM app_settings
          WHERE key = 'last_counter_reset_date'
      `;
    const lastResetResult = await client.query(lastResetQuery);
    const lastResetDate =
      lastResetResult.rows.length > 0 ? lastResetResult.rows[0].value : null;

    // If we've already reset today, no need to check further
    if (lastResetDate === currentDateStr) {
      console.log(`Counters already reset today (${currentDateStr})`);
      await client.query("COMMIT");
      return;
    }

    // Get the last activity timestamp from the audit table
    const lastActivityQuery = `
          SELECT timestamp
          FROM posting_account_audit
          ORDER BY timestamp DESC
          LIMIT 1
      `;

    const lastActivityResult = await client.query(lastActivityQuery);

    let shouldReset = false;

    // If there's a last activity record
    if (lastActivityResult.rows.length > 0) {
      const lastActivityTime = new Date(lastActivityResult.rows[0].timestamp);

      // Convert last activity to EST for comparison
      const lastActivityEst = new Date(
        lastActivityTime.toLocaleString("en-US", {
          timeZone: "America/New_York",
        })
      );

      // Compare just the date portions (year, month, day)
      const isSameDay =
        estDate.getFullYear() === lastActivityEst.getFullYear() &&
        estDate.getMonth() === lastActivityEst.getMonth() &&
        estDate.getDate() === lastActivityEst.getDate();

      if (!isSameDay) {
        console.log(
          `New day detected since last activity. Current: ${currentDateStr}, Last: ${
            lastActivityEst.toISOString().split("T")[0]
          }`
        );
        shouldReset = true;
      }
    } else {
      // No previous activity, check if it's midnight hour
      const estHour = estDate.getHours();
      if (estHour === 0) {
        console.log(
          "No previous activity and midnight detected. Resetting counters..."
        );
        shouldReset = true;
      }
    }

    // Reset counters if needed
    if (shouldReset) {
      console.log("Resetting daily posting account counters...");
      await client.query("CALL reset_posting_daily_used()");

      // Update the last reset date
      const updateLastResetQuery = `
              INSERT INTO app_settings (key, value)
              VALUES ('last_counter_reset_date', $1)
              ON CONFLICT (key) DO UPDATE SET value = $1
          `;
      await client.query(updateLastResetQuery, [currentDateStr]);

      console.log("Daily posting account counters reset successfully.");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in checkAndResetCounters:", error);
    // We don't rethrow the error to prevent it from affecting the main flow
  } finally {
    client.release();
  }
}

/**
 * Logs account activity to the audit table
 * @param {number} postAcctId - The ID of the posting account
 * @param {string} postAcctName - The name of the posting account
 * @param {string} trelloCardId - The ID of the Trello card
 * @returns {Promise<boolean>} - Whether the logging was successful
 */
async function logAccountActivity(postAcctId, postAcctName, trelloCardId) {
  // Validate inputs
  if (!postAcctId || !postAcctName || !trelloCardId) {
    console.error("Invalid parameters for logAccountActivity:", {
      postAcctId,
      postAcctName,
      trelloCardId,
    });
    return false;
  }

  try {
    const query = `
          INSERT INTO posting_account_audit
          (post_acct_id, post_acct_name, trello_card_id, timestamp)
          VALUES ($1, $2, $3, NOW())
          RETURNING id
      `;

    const result = await pool.query(query, [
      postAcctId,
      postAcctName.substring(0, 30), // Ensure it fits in VARCHAR(30)
      trelloCardId.substring(0, 30), // Ensure it fits in VARCHAR(30)
    ]);

    const logId = result.rows[0]?.id;
    console.log(
      `Logged activity (ID: ${logId}) for account ${postAcctName} (ID: ${postAcctId}) for card ${trelloCardId}`
    );
    return true;
  } catch (error) {
    // More specific error handling
    if (error.code === "23505") {
      // Unique violation
      console.error(
        "Duplicate entry error when logging account activity:",
        error.detail
      );
    } else if (error.code === "23503") {
      // Foreign key violation
      console.error(
        "Foreign key constraint error when logging account activity:",
        error.detail
      );
    } else if (error.code === "22001") {
      // String data right truncation
      console.error(
        "Data too long for column when logging account activity:",
        error.detail
      );
    } else {
      console.error("Error logging account activity:", error);
    }
    // We don't throw the error to prevent it from affecting the main flow
    return false;
  }
}

// Endpoint to handle the posting account request
app.post("/api/getPostingAccount", async (req, res) => {
  try {
    // Check if counters need to be reset based on time and last activity
    await checkAndResetCounters();

    // Validate request parameters
    const { trello_card_id, ignore_daily_limit = false } = req.body;
    if (!trello_card_id) {
      return res.status(400).json({
        success: false,
        error: "Trello card ID is required.",
      });
    }

    // Log if we're ignoring daily limits
    if (ignore_daily_limit) {
      console.log(
        `Request for card ${trello_card_id} is ignoring daily usage limits`
      );
    }

    // Retrieve Trello API credentials
    let api_key, token;
    try {
      const credentials = await getTrelloCredentials();
      api_key = credentials.api_key;
      token = credentials.token;
    } catch (error) {
      console.error("Error retrieving Trello credentials:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve Trello credentials.",
      });
    }

    // Retrieve accounts from the database
    let accounts;
    try {
      // If ignore_daily_limit is true, we'll get all accounts regardless of their daily usage
      // Otherwise, we'll use the standard post_acct_list view which may filter based on daily limits
      // Add a limit to prevent memory issues with large result sets
      let itemsListQuery;
      let queryParams = [];

      if (ignore_daily_limit) {
        itemsListQuery = `SELECT id, account FROM post_acct_list ORDER BY id LIMIT 1000`;
      } else {
        // Use parameterized query to avoid SQL injection - removed problematic cast
        itemsListQuery = `SELECT id, account from post_accts_by_trello_id_v3($1) ORDER BY id`;
        queryParams = [trello_card_id];
      }

      console.log(
        `Using query: ${itemsListQuery} (ignore_daily_limit=${ignore_daily_limit})`
      );

      const result = await pool.query(itemsListQuery, queryParams);
      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            "No accounts available. Please check account status and usage limits.",
        });
      }
      accounts = result.rows;
      console.log(`Found ${accounts.length} available accounts`);
    } catch (error) {
      console.error("Error retrieving accounts:", error);
      console.error("Error details:", {
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        where: error.where,
      });

      // Fallback to the simple query if the function fails
      try {
        console.log("Attempting fallback to post_acct_list...");
        const fallbackResult = await pool.query(
          `SELECT id, account FROM post_acct_list ORDER BY id LIMIT 1000`
        );
        accounts = fallbackResult.rows;
        console.log(
          `Fallback successful: Retrieved ${accounts.length} accounts`
        );

        if (accounts.length === 0) {
          return res.status(400).json({
            success: false,
            error:
              "No accounts available. Please check account status and usage limits.",
          });
        }
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        return res.status(500).json({
          success: false,
          error: "Failed to retrieve accounts from database.",
          details: error.message,
        });
      }
    }

    // Extract account names and create ID mapping
    const itemsList = accounts.map((row) => row.account);
    const accountIdMap = accounts.reduce((map, row) => {
      map[row.account] = row.id;
      return map;
    }, {});

    // Validate that we have accounts to select from
    if (itemsList.length === 0) {
      console.error("No accounts available for selection after filtering");
      return res.status(400).json({
        success: false,
        error: "No accounts available for selection after applying filters.",
      });
    }

    // Select a random account
    let selectedItem;
    try {
      selectedItem = balancedRandomChoice(itemsList);
      if (!selectedItem) {
        throw new Error("balancedRandomChoice returned null or undefined");
      }
    } catch (error) {
      console.error("Error selecting random account:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to select a random account.",
      });
    }

    // Validate the selected account has a valid ID
    const selectedAccountId = accountIdMap[selectedItem];
    if (!selectedAccountId) {
      console.error(`Selected account "${selectedItem}" has no valid ID`);
      return res.status(500).json({
        success: false,
        error: "Internal error: Invalid account selection.",
      });
    }

    // Update the usage counter in the database (unless ignore_daily_limit is true)
    if (!ignore_daily_limit) {
      try {
        const updateQuery = `
                  UPDATE posting_accounts
                  SET daily_used = daily_used + 1
                  WHERE id = $1
                  RETURNING id, account, daily_used;
              `;
        const updateResult = await pool.query(updateQuery, [selectedAccountId]);

        // Log the update result
        if (updateResult.rows.length > 0) {
          console.log(
            `Updated daily_used for account ${selectedItem}:`,
            updateResult.rows[0]
          );
        } else {
          console.warn(
            `No rows updated for account ${selectedItem} (ID: ${selectedAccountId})`
          );
        }
      } catch (error) {
        console.error(
          `Error updating usage counter for account ${selectedItem}:`,
          error
        );
        // Continue execution - we don't want to fail the request just because the counter update failed
      }
    } else {
      console.log(
        `Skipping daily usage update for account ${selectedItem} (ignore_daily_limit=true)`
      );
    }

    // Log this account activity to the audit table
    await logAccountActivity(selectedAccountId, selectedItem, trello_card_id);

    // Update Trello card with the selected account
    try {
      await setPostingAccountValue(
        trello_card_id,
        selectedItem,
        api_key,
        token
      );
      await addCommentToTrelloCard(
        trello_card_id,
        selectedItem,
        api_key,
        token
      );
    } catch (error) {
      console.error("Error updating Trello card:", error);
      // We still return the selected account even if Trello update fails
    }

    // Return the selected account
    return res.status(200).json({
      success: true,
      account: selectedItem,
      ignored_daily_limit: ignore_daily_limit,
    });
  } catch (error) {
    // Catch-all for any unhandled errors
    console.error("Unhandled error in getPostingAccount:", error);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while processing your request.",
      details: error.message,
    });
  }
});

//Archiving Of Trello Cards
// Endpoint to archive Trello cards based on scripts_for_archive table
app.get("/api/runArchiving", async (req, res) => {
  try {
    // Get Trello API credentials
    const settingsResult = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );

    if (settingsResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Trello settings not configured",
      });
    }

    const { api_key: apiKey, token } = settingsResult.rows[0];

    // Validate API credentials
    if (!apiKey || !token) {
      return res.status(500).json({
        success: false,
        error: "Invalid Trello API credentials. API key or token is missing.",
      });
    }

    // Get cards to archive from the database
    const cardsResult = await pool.query("SELECT * FROM scripts_for_archive");

    if (cardsResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No cards to archive",
        archived: 0,
      });
    }

    const cards = cardsResult.rows;
    console.log(`Found ${cards.length} cards to archive`);

    // Process cards in batches to respect Trello's rate limits
    // Trello has a rate limit of 100 requests per 10 seconds
    // We'll use 50 requests per 12 seconds to be safe and leave room for other API calls
    const batchSize = 50;
    const batchDelay = 12000; // 12 seconds

    let successCount = 0;
    let failureCount = 0;
    let processedCards = [];

    // Process cards in batches
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      console.log(
        `Processing batch ${i / batchSize + 1} of ${Math.ceil(
          cards.length / batchSize
        )}, size: ${batch.length}`
      );

      // Process each card in the batch
      const batchResults = await Promise.allSettled(
        batch.map((card) => archiveCard(card, apiKey, token))
      );

      // Count successes and failures
      const successfulCards = [];
      const successfulCardIds = [];

      batchResults.forEach((result, index) => {
        const card = batch[index];
        if (result.status === "fulfilled") {
          successCount++;
          successfulCards.push(card);
          successfulCardIds.push(card.trello_card_id);

          processedCards.push({
            id: card.id,
            trello_card_id: card.trello_card_id,
            script_id: card.script_id,
            script_updated: true, // Will be updated in bulk
            status: "success",
          });
        } else {
          failureCount++;
          console.error(
            `Failed to archive card ${card.trello_card_id}:`,
            result.reason
          );
          processedCards.push({
            id: card.id,
            trello_card_id: card.trello_card_id,
            status: "failed",
            error: result.reason.message,
          });
        }
      });

      // Update all successfully archived cards in the database
      if (successfulCardIds.length > 0) {
        try {
          // Convert array of IDs to a comma-separated string for the SQL IN clause
          const cardIdsForQuery = successfulCardIds
            .map((id) => `'${id}'`)
            .join(",");

          // Update all scripts with these Trello card IDs
          const updateQuery = `
                      UPDATE script
                      SET is_archived = true
                      WHERE trello_card_id IN (${cardIdsForQuery})
                  `;

          const updateResult = await pool.query(updateQuery);
          console.log(
            `Updated ${updateResult.rowCount} scripts with is_archived = true`
          );
        } catch (dbError) {
          console.error("Error updating scripts in database:", dbError);
          // Continue processing - don't fail the entire batch if the DB update fails
        }
      }

      // If this isn't the last batch, wait before processing the next batch
      if (i + batchSize < cards.length) {
        console.log(
          `Waiting ${batchDelay / 1000} seconds before processing next batch...`
        );
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    // Count how many scripts were updated
    const scriptsUpdated = processedCards.filter(
      (card) => card.script_updated
    ).length;

    // Return results
    return res.status(200).json({
      success: true,
      message: `Archiving process completed. ${successCount} cards archived successfully, ${failureCount} failed. ${scriptsUpdated} scripts marked as archived.`,
      total: cards.length,
      archived: successCount,
      failed: failureCount,
      scripts_updated: scriptsUpdated,
      details: processedCards,
    });
  } catch (error) {
    console.error("Error running archiving process:", error);
    return res.status(500).json({
      success: false,
      error: "Error running archiving process",
      details: error.message,
    });
  }
});

/**
 * Archive a single Trello card
 * @param {Object} card - Card object from the database
 * @param {string} apiKey - Trello API key
 * @param {string} token - Trello API token
 * @returns {Promise} - Resolves when the card is archived
 */
async function archiveCard(card, apiKey, token) {
  try {
    const trelloCardId = card.trello_card_id;

    if (!trelloCardId) {
      throw new Error(`Card ID ${card.id} has no Trello card ID`);
    }

    // Make API call to archive the card
    const response = await axios.put(
      `https://api.trello.com/1/cards/${trelloCardId}`,
      {
        closed: true, // Set closed to true to archive the card
        key: apiKey,
        token: token,
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status >= 200 && response.status < 300) {
      // We'll update the script table in bulk at the end of each batch
      console.log(`Successfully archived card ${trelloCardId}`);

      return { success: true, cardId: trelloCardId };
    } else {
      throw new Error(
        `Trello API returned status ${response.status}: ${response.statusText}`
      );
    }
  } catch (error) {
    console.error(`Error archiving card ${card.trello_card_id}:`, error);
    throw error;
  }
}

// Debug endpoint to check account data and URL analysis
app.get("/api/debug/accounts", async (req, res) => {
  try {
    console.log("🔍 Debug: Checking account data relationships");

    // Check posting_accounts table
    const accountsQuery = `SELECT id, account FROM posting_accounts ORDER BY id`;
    const { rows: accounts } = await pool.query(accountsQuery);

    // Check recent videos with their URLs for analysis
    const videosQuery = `
      SELECT
        id,
        script_title,
        account_id,
        writer_id,
        url
      FROM video
      WHERE writer_id = 110
        AND url LIKE '%youtube.com%'
      ORDER BY id DESC
      LIMIT 20
    `;
    const { rows: videos } = await pool.query(videosQuery);

    // Analyze URLs to extract potential channel info
    const videoAnalysis = videos.map((video) => {
      let detectedChannel = "Unknown";

      // Try to extract channel info from URL
      if (video.url) {
        // Look for @channel pattern
        const atMatch = video.url.match(/@([^\/\?&]+)/);
        if (atMatch) {
          detectedChannel = atMatch[1];
        }
        // Look for channel/ pattern
        else if (video.url.includes("/channel/")) {
          const channelMatch = video.url.match(/\/channel\/([^\/\?&]+)/);
          if (channelMatch) {
            detectedChannel = `Channel_${channelMatch[1].substring(0, 10)}`;
          }
        }
        // Look for /c/ pattern
        else if (video.url.includes("/c/")) {
          const cMatch = video.url.match(/\/c\/([^\/\?&]+)/);
          if (cMatch) {
            detectedChannel = cMatch[1];
          }
        }
        // Extract video ID as fallback
        else {
          const videoId = extractVideoId(video.url);
          detectedChannel = `Video_${videoId}`;
        }
      }

      return {
        video_id: video.id,
        title: video.script_title,
        url: video.url,
        current_account_id: video.account_id,
        detected_channel: detectedChannel,
      };
    });

    // Check the join query for writer 110
    const joinQuery = `
      SELECT
        video.id as video_id,
        video.script_title,
        video.url,
        video.account_id,
        posting_accounts.id as posting_account_id,
        posting_accounts.account as account_name
      FROM video
      LEFT JOIN posting_accounts ON video.account_id = posting_accounts.id
      WHERE video.writer_id = 110
        AND video.url LIKE '%youtube.com%'
      ORDER BY video.id DESC
      LIMIT 10
    `;
    const { rows: joinResults } = await pool.query(joinQuery);

    res.json({
      success: true,
      data: {
        posting_accounts: accounts,
        video_analysis: videoAnalysis,
        current_mappings: joinResults,
        summary: {
          total_accounts: accounts.length,
          videos_analyzed: videoAnalysis.length,
          videos_with_account_id: videoAnalysis.filter(
            (v) => v.current_account_id !== null
          ).length,
          successful_joins: joinResults.filter((r) => r.account_name).length,
        },
        instructions: {
          message:
            "Use the video_analysis to see detected channels and compare with posting_accounts",
          next_step:
            "Use POST /api/debug/map-accounts to correct any mismatches",
        },
      },
    });
  } catch (error) {
    console.error("❌ Debug accounts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fix account_id for videos by extracting channel info from URLs
app.get("/api/debug/fix-accounts", async (req, res) => {
  try {
    console.log("🔧 Debug: Fixing account_id for videos by analyzing URLs");

    // Get all posting accounts
    const accountsQuery = `SELECT id, account FROM posting_accounts ORDER BY id`;
    const { rows: accounts } = await pool.query(accountsQuery);

    if (accounts.length === 0) {
      return res.json({ error: "No posting accounts found" });
    }

    // Get videos that need account_id fixing
    const videosQuery = `
      SELECT id, url, script_title
      FROM video
      WHERE writer_id = 110
        AND url LIKE '%youtube.com%'
      ORDER BY id DESC
      LIMIT 50
    `;
    const { rows: videos } = await pool.query(videosQuery);

    let updatedCount = 0;
    const results = [];

    for (const video of videos) {
      try {
        // Extract channel info from URL by making a request to get channel name
        const channelInfo = await getChannelInfoFromUrl(video.url);

        if (channelInfo) {
          // Try to match with posting accounts
          const matchedAccount = accounts.find(
            (acc) =>
              acc.account.toLowerCase().includes(channelInfo.toLowerCase()) ||
              channelInfo.toLowerCase().includes(acc.account.toLowerCase())
          );

          if (matchedAccount) {
            // Update video with correct account_id
            await pool.query(`UPDATE video SET account_id = $1 WHERE id = $2`, [
              matchedAccount.id,
              video.id,
            ]);
            updatedCount++;
            results.push({
              video_id: video.id,
              title: video.script_title,
              url: video.url,
              detected_channel: channelInfo,
              matched_account: matchedAccount.account,
              account_id: matchedAccount.id,
            });
          } else {
            results.push({
              video_id: video.id,
              title: video.script_title,
              url: video.url,
              detected_channel: channelInfo,
              matched_account: null,
              account_id: null,
              note: "No matching account found",
            });
          }
        }
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        results.push({
          video_id: video.id,
          title: video.script_title,
          url: video.url,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Analyzed ${videos.length} videos, updated ${updatedCount} with correct account_id`,
      data: {
        total_analyzed: videos.length,
        updated_count: updatedCount,
        available_accounts: accounts,
        results: results,
      },
    });
  } catch (error) {
    console.error("❌ Fix accounts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Simple endpoint to reset all account_id to NULL so we can start fresh
app.get("/api/debug/reset-accounts", async (req, res) => {
  try {
    console.log("🔄 Debug: Resetting all account_id to NULL");

    const resetQuery = `
      UPDATE video
      SET account_id = NULL
      WHERE writer_id = 110
        AND url LIKE '%youtube.com%'
    `;
    const { rowCount } = await pool.query(resetQuery);

    res.json({
      success: true,
      message: `Reset ${rowCount} videos to have NULL account_id`,
      data: {
        reset_count: rowCount,
      },
    });
  } catch (error) {
    console.error("❌ Reset accounts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint for setPostingAccountValue function
app.post("/api/test/setPostingAccount", async (req, res) => {
  try {
    const { trello_card_id, posting_account_value } = req.body;

    if (!trello_card_id || !posting_account_value) {
      return res.status(400).json({
        success: false,
        error: "trello_card_id and posting_account_value are required"
      });
    }

    // Get Trello settings
    const settingsResult = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );

    if (settingsResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Trello settings not configured"
      });
    }

    const { api_key, token } = settingsResult.rows[0];

    console.log(`🧪 TEST: Attempting to set posting account '${posting_account_value}' on card ${trello_card_id}`);

    // Call the setPostingAccountValue function
    await setPostingAccountValue(trello_card_id, posting_account_value, api_key, token);

    res.json({
      success: true,
      message: `Successfully set posting account to '${posting_account_value}' on card ${trello_card_id}`,
      card_id: trello_card_id,
      account_value: posting_account_value
    });

  } catch (error) {
    console.error("🧪 TEST ERROR:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: "Check server logs for detailed debugging information"
    });
  }
});

// Quick fix to map all videos to Requestedreads account (ID 796)
app.get("/api/debug/fix-requestedreads", async (req, res) => {
  try {
    console.log("🔧 Debug: Mapping all videos to Requestedreads account");

    const updateQuery = `
      UPDATE video
      SET account_id = 796
      WHERE writer_id = 110
        AND url LIKE '%youtube.com%'
        AND account_id IS NULL
    `;
    const { rowCount } = await pool.query(updateQuery);

    res.json({
      success: true,
      message: `Updated ${rowCount} videos to Requestedreads account (ID: 796)`,
      data: {
        updated_count: rowCount,
        account_id: 796,
        account_name: "Requestedreads",
      },
    });
  } catch (error) {
    console.error("❌ Fix Requestedreads error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Check existing account mappings using the exact query you provided
app.get("/api/debug/existing-account-mappings", async (req, res) => {
  try {
    console.log("🔍 Checking existing account mappings using your query");

    const mappingsQuery = `
      SELECT
        v.id AS video_id,
        v.account_id,
        p.id AS posting_account_id,
        p.account AS posting_account_name,
        v.url AS youtube_url
      FROM
        video v
      INNER JOIN
        posting_accounts p
      ON
        v.account_id = p.id
      WHERE
        v.url ILIKE '%youtube.com%' OR v.url ILIKE '%youtu.be%'
      ORDER BY v.id DESC
      LIMIT 50
    `;

    const { rows: mappings } = await pool.query(mappingsQuery);

    // Also check how many videos have NULL account_id
    const nullAccountQuery = `
      SELECT COUNT(*) as null_count
      FROM video
      WHERE (url ILIKE '%youtube.com%' OR url ILIKE '%youtu.be%')
        AND account_id IS NULL
    `;

    const { rows: nullCount } = await pool.query(nullAccountQuery);

    // Get total video count
    const totalQuery = `
      SELECT COUNT(*) as total_count
      FROM video
      WHERE url ILIKE '%youtube.com%' OR url ILIKE '%youtu.be%'
    `;

    const { rows: totalCount } = await pool.query(totalQuery);

    res.json({
      success: true,
      message: `Found ${mappings.length} videos with account mappings`,
      data: {
        existing_mappings: mappings,
        mapped_count: mappings.length,
        null_account_count: nullCount[0].null_count,
        total_video_count: totalCount[0].total_count,
        summary: {
          mapped: mappings.length,
          unmapped: nullCount[0].null_count,
          total: totalCount[0].total_count,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error checking existing account mappings:", error);
    res.status(500).json({
      error: error.message,
      details: "Failed to check existing account mappings",
    });
  }
});

// Smart account mapping based on URL analysis
app.get("/api/debug/smart-account-mapping", async (req, res) => {
  try {
    console.log(
      "🔧 Smart account mapping: Analyzing URLs and mapping to correct accounts"
    );

    // First, get all posting accounts
    const accountsQuery = `
      SELECT id, account, platform
      FROM posting_accounts
      WHERE platform = 'YouTube' OR platform IS NULL
      ORDER BY account
    `;

    const { rows: accounts } = await pool.query(accountsQuery);
    console.log(
      `📋 Found ${accounts.length} posting accounts:`,
      accounts.map((a) => `${a.id}: ${a.account}`)
    );

    // Get videos that need account mapping for writer 110
    const videosQuery = `
      SELECT id, url, script_title, account_id
      FROM video
      WHERE writer_id = 110
        AND url LIKE '%youtube.com%'
        AND url IS NOT NULL
      ORDER BY id DESC
      LIMIT 50
    `;

    const { rows: videos } = await pool.query(videosQuery);
    console.log(`🎬 Found ${videos.length} videos to analyze`);

    let mappingResults = {
      total_videos: videos.length,
      mapped_count: 0,
      mapping_details: [],
      account_distribution: {},
    };

    // Helper function to extract channel info from YouTube URL
    function analyzeYouTubeURL(url) {
      if (!url) return null;

      // Extract video ID
      const videoIdMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
      );
      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      // Determine if it's a short
      const isShort = url.includes("/shorts/");

      // For now, we'll use URL patterns to guess the account
      // In a real scenario, you'd use YouTube API to get channel info

      return {
        videoId,
        isShort,
        url,
        // We'll map based on URL patterns or other logic
        suggestedAccountId: null,
      };
    }

    // Simple mapping logic based on URL patterns or other criteria
    for (const video of videos) {
      const analysis = analyzeYouTubeURL(video.url);
      let targetAccountId = null;
      let reason = "";

      if (analysis) {
        // Example mapping logic - you can customize this based on your needs
        if (analysis.isShort) {
          // Map shorts to specific accounts
          const shortsAccounts = accounts.filter(
            (a) =>
              a.account.toLowerCase().includes("shorts") ||
              a.account.toLowerCase().includes("short")
          );
          if (shortsAccounts.length > 0) {
            targetAccountId = shortsAccounts[0].id;
            reason = "Mapped to shorts account";
          }
        }

        // If no specific mapping found, use improved distribution logic
        if (!targetAccountId && accounts.length > 0) {
          // Exclude NoAvailableAccount and sample accounts for better distribution
          const validAccounts = accounts.filter(
            (a) =>
              a.id !== 99999 && // Exclude NoAvailableAccount
              a.account !== "sample" // Exclude sample account
          );

          if (validAccounts.length > 0) {
            // Use a combination of video ID and title hash for better distribution
            const titleHash = video.script_title
              ? video.script_title.length
              : 0;
            const distributionSeed =
              (parseInt(video.id) + titleHash) % validAccounts.length;
            targetAccountId = validAccounts[distributionSeed].id;
            reason = `Smart distribution (seed: ${distributionSeed}, account: ${validAccounts[distributionSeed].account})`;
          }
        }

        // Update the video with the new account_id
        if (targetAccountId && targetAccountId !== video.account_id) {
          const updateQuery = `
            UPDATE video
            SET account_id = $1
            WHERE id = $2
          `;
          await pool.query(updateQuery, [targetAccountId, video.id]);
          mappingResults.mapped_count++;

          const accountName =
            accounts.find((a) => a.id === targetAccountId)?.account ||
            "Unknown";

          mappingResults.mapping_details.push({
            video_id: video.id,
            title: video.script_title,
            url: video.url,
            old_account_id: video.account_id,
            new_account_id: targetAccountId,
            account_name: accountName,
            reason: reason,
          });

          // Track account distribution
          if (!mappingResults.account_distribution[accountName]) {
            mappingResults.account_distribution[accountName] = 0;
          }
          mappingResults.account_distribution[accountName]++;
        }
      }
    }

    console.log(
      `✅ Smart mapping completed: ${mappingResults.mapped_count}/${mappingResults.total_videos} videos mapped`
    );
    console.log(
      "📊 Account distribution:",
      mappingResults.account_distribution
    );

    res.json({
      success: true,
      message: `Smart account mapping completed: ${mappingResults.mapped_count} videos mapped`,
      data: mappingResults,
    });
  } catch (error) {
    console.error("❌ Smart account mapping error:", error);
    res.status(500).json({
      error: error.message,
      details: "Failed to perform smart account mapping",
    });
  }
});

// Manual account mapping endpoint for specific channels
app.post("/api/debug/map-accounts", async (req, res) => {
  try {
    const { mappings } = req.body; // Array of { video_id, account_id }

    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ error: "Invalid mappings format" });
    }

    let updatedCount = 0;
    const results = [];

    for (const mapping of mappings) {
      try {
        const { video_id, account_id } = mapping;

        // Update video with correct account_id
        const updateResult = await pool.query(
          `UPDATE video SET account_id = $1 WHERE id = $2 RETURNING id, script_title`,
          [account_id, video_id]
        );

        if (updateResult.rows.length > 0) {
          updatedCount++;
          results.push({
            video_id: video_id,
            account_id: account_id,
            title: updateResult.rows[0].script_title,
            status: "updated",
          });
        } else {
          results.push({
            video_id: video_id,
            account_id: account_id,
            status: "not_found",
          });
        }
      } catch (error) {
        results.push({
          video_id: mapping.video_id,
          account_id: mapping.account_id,
          status: "error",
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} videos with correct account mappings`,
      data: {
        updated_count: updatedCount,
        results: results,
      },
    });
  } catch (error) {
    console.error("❌ Map accounts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to extract channel info from YouTube URL
async function getChannelInfoFromUrl(url) {
  try {
    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId || videoId === "dQw4w9WgXcQ") {
      return null;
    }

    // For now, we'll extract channel info from the URL pattern
    // YouTube URLs can contain channel info in different ways
    if (url.includes("@")) {
      // Handle @channel format
      const match = url.match(/@([^\/\?&]+)/);
      if (match) {
        return match[1];
      }
    }

    // For more accurate channel detection, we would need YouTube API
    // For now, return a placeholder that indicates we need manual mapping
    return `Channel_for_${videoId}`;
  } catch (error) {
    console.error("Error extracting channel info:", error);
    return null;
  }
}

// Debug: Check specific Trello card
app.get("/api/debug/trello-card/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;

    // Get Trello API credentials
    const settingsResult = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );

    if (settingsResult.rows.length === 0) {
      return res.status(500).json({ error: "Trello settings not configured" });
    }

    const { api_key: trelloApiKey, token: trelloToken } = settingsResult.rows[0];

    // Get card details from Trello including custom fields, actions and attachments
    const cardResponse = await fetch(
      `https://api.trello.com/1/cards/${cardId}?key=${trelloApiKey}&token=${trelloToken}&fields=name,desc,url&attachments=true&actions=commentCard&action_limit=50&customFieldItems=true`
    );

    if (!cardResponse.ok) {
      return res.status(500).json({ error: `Failed to fetch Trello card: ${cardResponse.status}` });
    }

    const cardData = await cardResponse.json();

    // Function to extract YouTube URLs from text
    const extractYouTubeUrls = (text) => {
      if (!text) return [];
      const urlRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[^\s\)]+/gi;
      return text.match(urlRegex) || [];
    };

    // Check custom fields for URLs first
    let customFieldUrls = [];
    let customFields = [];
    if (cardData.customFieldItems && cardData.customFieldItems.length > 0) {
      for (const customField of cardData.customFieldItems) {
        customFields.push({
          id: customField.id,
          value: customField.value
        });
        if (customField.value && customField.value.text) {
          const urls = extractYouTubeUrls(customField.value.text);
          customFieldUrls = customFieldUrls.concat(urls);
        }
      }
    }

    // Check card description for URLs
    const descUrls = extractYouTubeUrls(cardData.desc);

    // Check comments for URLs
    let commentUrls = [];
    let comments = [];
    if (cardData.actions && cardData.actions.length > 0) {
      for (const action of cardData.actions) {
        if (action.type === 'commentCard' && action.data && action.data.text) {
          comments.push({
            text: action.data.text,
            date: action.date,
            member: action.memberCreator ? action.memberCreator.fullName : 'Unknown'
          });
          const urls = extractYouTubeUrls(action.data.text);
          commentUrls = commentUrls.concat(urls);
        }
      }
    }

    // Check attachments for URLs
    let attachmentUrls = [];
    let attachments = [];
    if (cardData.attachments && cardData.attachments.length > 0) {
      for (const attachment of cardData.attachments) {
        attachments.push({
          name: attachment.name,
          url: attachment.url,
          date: attachment.date
        });
        if (attachment.url && (attachment.url.includes('youtube.com') || attachment.url.includes('youtu.be'))) {
          attachmentUrls.push(attachment.url);
        }
      }
    }

    // Check if this card has a video record
    const videoQuery = `
      SELECT v.id, v.url, v.script_title
      FROM video v
      WHERE v.trello_card_id = $1
    `;
    const videoResult = await pool.query(videoQuery, [cardId]);

    res.json({
      success: true,
      card_id: cardId,
      card_name: cardData.name,
      description: cardData.desc,
      custom_fields: customFields,
      custom_field_urls: customFieldUrls,
      description_urls: descUrls,
      comments: comments,
      comment_urls: commentUrls,
      attachments: attachments,
      attachment_urls: attachmentUrls,
      all_urls: [...customFieldUrls, ...descUrls, ...commentUrls, ...attachmentUrls],
      video_record: videoResult.rows[0] || null
    });

  } catch (error) {
    console.error("❌ Debug Trello card error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Debug: Check video table status
app.get("/api/debug/video-status", async (req, res) => {
  try {
    // Count videos with and without URLs
    const statusQuery = `
      SELECT
        COUNT(*) as total_videos,
        COUNT(CASE WHEN v.url IS NOT NULL AND v.url != '' THEN 1 END) as videos_with_urls,
        COUNT(CASE WHEN v.url IS NULL OR v.url = '' THEN 1 END) as videos_without_urls
      FROM video v
      JOIN script s ON v.trello_card_id = s.trello_card_id
      WHERE s.approval_status = 'Posted'
    `;

    const statusResult = await pool.query(statusQuery);
    const stats = statusResult.rows[0];

    // Get sample videos without URLs
    const sampleQuery = `
      SELECT v.id, v.script_title, v.trello_card_id, v.url, s.approval_status
      FROM video v
      JOIN script s ON v.trello_card_id = s.trello_card_id
      WHERE s.approval_status = 'Posted'
      AND (v.url IS NULL OR v.url = '')
      ORDER BY v.created DESC
      LIMIT 5
    `;

    const sampleResult = await pool.query(sampleQuery);

    res.json({
      success: true,
      stats: {
        total_videos: parseInt(stats.total_videos),
        videos_with_urls: parseInt(stats.videos_with_urls),
        videos_without_urls: parseInt(stats.videos_without_urls)
      },
      sample_videos_without_urls: sampleResult.rows
    });

  } catch (error) {
    console.error("❌ Debug video status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Check status sync for last 5 days - Find mismatches between Trello and database
app.post("/api/syncRecentStatus", async (req, res) => {
  try {
    console.log("🔄 Starting recent status sync check (last 5 days)...");

    // Get Trello API credentials
    const settingsResult = await pool.query(
      "SELECT api_key, token FROM settings ORDER BY id DESC LIMIT 1"
    );

    if (settingsResult.rows.length === 0) {
      return res.status(500).json({ error: "Trello settings not configured" });
    }

    const { api_key: trelloApiKey, token: trelloToken } = settingsResult.rows[0];

    // Get all scripts from the last 5 days with trello_card_id
    const scriptsResult = await pool.query(`
      SELECT id, title, trello_card_id, approval_status, created_at, writer_id
      FROM script
      WHERE trello_card_id IS NOT NULL
      AND created_at >= NOW() - INTERVAL '5 days'
      ORDER BY created_at DESC
    `);

    const scripts = scriptsResult.rows;
    console.log(`📊 Found ${scripts.length} scripts from last 5 days to check`);

    if (scripts.length === 0) {
      return res.json({ message: "No scripts found from last 5 days", checked: 0 });
    }

    let syncedCount = 0;
    let mismatchCount = 0;
    const errors = [];
    const mismatches = [];

    // Function to determine Trello status from list name
    const getTrelloStatus = (listName) => {
      const listNameLower = listName.toLowerCase();
      if (listNameLower.includes('pending approval') || listNameLower.includes('pending_approval')) {
        return 'Pending Approval';
      } else if (listNameLower.includes('posted')) {
        return 'Posted';
      } else if (listNameLower.includes('rejected') || listNameLower.includes('denied')) {
        return 'Rejected';
      } else if (listNameLower.includes('pending posting') || listNameLower.includes('pending_posting')) {
        return 'Pending Posting';
      } else if (listNameLower.includes('pending')) {
        return 'Pending';
      }
      return null;
    };

    // Check each script's Trello status
    for (const script of scripts) {
      try {
        console.log(`🔍 Checking ${script.title.substring(0, 50)}... (${script.approval_status})`);

        // Get card details from Trello
        const cardResponse = await fetch(
          `https://api.trello.com/1/cards/${script.trello_card_id}?key=${trelloApiKey}&token=${trelloToken}&fields=name,list&list=true`
        );

        if (!cardResponse.ok) {
          console.log(`❌ Failed to fetch card ${script.trello_card_id}: ${cardResponse.status}`);
          errors.push({
            title: script.title.substring(0, 50),
            trello_card_id: script.trello_card_id,
            error: `HTTP ${cardResponse.status}`
          });
          continue;
        }

        const cardData = await cardResponse.json();
        const trelloListName = cardData.list ? cardData.list.name : 'Unknown';
        const newStatus = getTrelloStatus(trelloListName);

        console.log(`📋 Trello list: "${trelloListName}" → Status: "${newStatus}"`);

        // Check for mismatch
        if (newStatus && newStatus !== script.approval_status) {
          console.log(`⚠️ MISMATCH: DB="${script.approval_status}" vs Trello="${newStatus}"`);

          mismatchCount++;
          mismatches.push({
            script_id: script.id,
            title: script.title.substring(0, 60),
            trello_card_id: script.trello_card_id,
            database_status: script.approval_status,
            trello_status: newStatus,
            trello_list: trelloListName,
            created_at: script.created_at,
            writer_id: script.writer_id
          });

          // Update database if status has changed
          await pool.query(
            "UPDATE script SET approval_status = $1 WHERE trello_card_id = $2",
            [newStatus, script.trello_card_id]
          );

          console.log(`✅ Updated "${script.title.substring(0, 50)}..." from "${script.approval_status}" to "${newStatus}"`);
          syncedCount++;
        } else {
          console.log(`✅ Status matches: "${script.approval_status}"`);
        }

      } catch (error) {
        console.error(`❌ Error checking ${script.title.substring(0, 30)}...`, error.message);
        errors.push({
          title: script.title.substring(0, 50),
          trello_card_id: script.trello_card_id,
          error: error.message
        });
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`🎉 Recent sync complete! Found ${mismatchCount} mismatches, updated ${syncedCount} scripts`);

    res.json({
      success: true,
      message: `Recent status sync complete! Found ${mismatchCount} mismatches, updated ${syncedCount} scripts`,
      period: "last 5 days",
      totalChecked: scripts.length,
      mismatchesFound: mismatchCount,
      scriptsUpdated: syncedCount,
      mismatches: mismatches,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("❌ Error in recent status sync:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

// Comprehensive verification endpoint to check all sync steps
app.post("/api/verifyFullSync", async (req, res) => {
  try {
    console.log("🔍 Starting comprehensive sync verification...");

    // Step 1: Get all scripts from last 5 days that should be "Posted"
    const recentScriptsResult = await pool.query(`
      SELECT s.id, s.title, s.trello_card_id, s.approval_status, s.writer_id, s.created_at
      FROM script s
      WHERE s.trello_card_id IS NOT NULL
      AND s.created_at >= NOW() - INTERVAL '5 days'
      ORDER BY s.created_at DESC
    `);

    console.log(`📋 Found ${recentScriptsResult.rows.length} recent scripts with Trello cards`);

    let statusIssues = [];
    let videoMissing = [];
    let urlMissing = [];
    let fullyComplete = [];

    // Check each script for all three requirements
    for (const script of recentScriptsResult.rows) {
      try {
        // Check Trello status
        const cardResponse = await fetch(
          `https://api.trello.com/1/cards/${script.trello_card_id}?key=${trelloApiKey}&token=${trelloToken}&fields=name,list`
        );

        if (!cardResponse.ok) {
          console.log(`⚠️ Could not fetch Trello card ${script.trello_card_id}`);
          continue;
        }

        const cardData = await cardResponse.json();
        const listResponse = await fetch(
          `https://api.trello.com/1/lists/${cardData.list.id}?key=${trelloApiKey}&token=${trelloToken}&fields=name`
        );
        const listData = await listResponse.json();
        const trelloStatus = mapTrelloListToStatus(listData.name);

        // Only check scripts that should be "Posted" in Trello
        if (trelloStatus === "Posted") {
          // Check 1: Database status
          if (script.approval_status !== "Posted") {
            statusIssues.push({
              script_id: script.id,
              title: script.title.substring(0, 50),
              trello_card_id: script.trello_card_id,
              database_status: script.approval_status,
              trello_status: trelloStatus
            });
            continue; // Skip other checks if status is wrong
          }

          // Check 2: Video table record exists
          const videoResult = await pool.query(
            "SELECT id, url FROM video WHERE trello_card_id = $1",
            [script.trello_card_id]
          );

          if (videoResult.rows.length === 0) {
            videoMissing.push({
              script_id: script.id,
              title: script.title.substring(0, 50),
              trello_card_id: script.trello_card_id
            });
            continue; // Skip URL check if no video record
          }

          // Check 3: Video has URL
          const video = videoResult.rows[0];
          if (!video.url || video.url.trim() === '') {
            urlMissing.push({
              script_id: script.id,
              video_id: video.id,
              title: script.title.substring(0, 50),
              trello_card_id: script.trello_card_id
            });
          } else {
            fullyComplete.push({
              script_id: script.id,
              video_id: video.id,
              title: script.title.substring(0, 50),
              trello_card_id: script.trello_card_id,
              url: video.url
            });
          }
        }

      } catch (error) {
        console.log(`❌ Error checking script ${script.id}: ${error.message}`);
      }
    }

    console.log(`✅ Verification complete!`);
    console.log(`📊 Status issues: ${statusIssues.length}`);
    console.log(`📊 Missing video records: ${videoMissing.length}`);
    console.log(`📊 Missing URLs: ${urlMissing.length}`);
    console.log(`📊 Fully complete: ${fullyComplete.length}`);

    res.json({
      success: true,
      message: "Comprehensive sync verification complete",
      summary: {
        total_checked: recentScriptsResult.rows.length,
        status_issues: statusIssues.length,
        video_missing: videoMissing.length,
        url_missing: urlMissing.length,
        fully_complete: fullyComplete.length
      },
      issues: {
        status_issues: statusIssues,
        video_missing: videoMissing,
        url_missing: urlMissing
      },
      complete: fullyComplete.slice(0, 10) // Show first 10 complete records
    });

  } catch (error) {
    console.error("❌ Error in comprehensive verification:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check Posted scripts
app.get("/api/debug/posted-scripts", async (req, res) => {
  try {
    // Get Posted scripts from last 5 days
    const postedScriptsResult = await pool.query(`
      SELECT s.id, s.title, s.trello_card_id, s.approval_status, s.writer_id, s.created_at,
             v.id as video_id, v.url as video_url
      FROM script s
      LEFT JOIN video v ON s.trello_card_id = v.trello_card_id
      WHERE s.approval_status = 'Posted'
      AND s.created_at >= NOW() - INTERVAL '5 days'
      ORDER BY s.created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      count: postedScriptsResult.rows.length,
      scripts: postedScriptsResult.rows.map(row => ({
        script_id: row.id,
        title: row.title.substring(0, 60),
        trello_card_id: row.trello_card_id,
        status: row.approval_status,
        video_id: row.video_id,
        has_video: !!row.video_id,
        has_url: !!(row.video_url && row.video_url.trim()),
        url: row.video_url ? row.video_url.substring(0, 50) + '...' : null,
        created_at: row.created_at
      }))
    });

  } catch (error) {
    console.error("❌ Error checking posted scripts:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Writer Dashboard API is running" });
});

// Set up HTTP server and WebSocket server
const server = http.createServer(app);
const WS_PORT = process.env.WS_PORT || 8083; // Use different port to avoid conflicts
// const wss = new WebSocket.Server({ port: WS_PORT }); // Temporarily disabled

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const broadcastUpdate = (updatedScript) => {
  io.emit("statusUpdate", updatedScript);
};

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// WebSocket clients array
const clients = [];

// wss.on("connection", (ws) => {
//   clients.push(ws);

//   ws.on("close", () => {
//     const index = clients.indexOf(ws);
//     if (index > -1) {
//       clients.splice(index, 1);
//     }
//   });
// }); // Temporarily disabled

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server running on port ${WS_PORT}`);
});
