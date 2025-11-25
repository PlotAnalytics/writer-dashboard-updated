const express = require('express');
const jwt = require('jsonwebtoken');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Import PostgreSQL pool
const pool = require('../config/database');

// Simplified function to get account names from BigQuery (similar to getBigQueryAudienceRetention)
async function getAccountNameFromBigQuery(videoId, writerId) {
  try {
    console.log(`📊 Getting account name for video ${videoId}, writer ${writerId}`);

    // Use the global BigQuery client
    const bigqueryClient = getBigQueryClient();
    if (!bigqueryClient) {
      throw new Error('BigQuery client not initialized');
    }

    // Extract YouTube video ID from PostgreSQL video ID
    const videoQuery = `SELECT url FROM video WHERE id = $1`;
    const { rows: videoRows } = await pool.query(videoQuery, [parseInt(videoId)]);

    if (videoRows.length === 0) {
      throw new Error(`Video with ID ${videoId} not found`);
    }

    const videoUrl = videoRows[0].url;
    const youtubeVideoId = extractVideoId(videoUrl);

    if (!youtubeVideoId) {
      throw new Error(`Could not extract YouTube video ID from URL: ${videoUrl}`);
    }

    console.log(`🔍 Extracted YouTube video ID: ${youtubeVideoId} from URL: ${videoUrl}`);

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [parseInt(writerId)]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writerId} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`👤 Found writer name: ${writerName}`);

    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = "dbt_youtube_analytics";

    // Query BigQuery for account name using the same approach as individual videos
    const accountQuery = `
      SELECT DISTINCT
        account_id,
        video_id
      FROM \`${projectId}.${dataset}.audience_retention_historical\`
      WHERE video_id = @video_id
        AND writer_id = @writer_id
      LIMIT 1
    `;

    const [accountRows] = await bigqueryClient.query({
      query: accountQuery,
      params: {
        video_id: youtubeVideoId,
        writer_id: parseInt(writerId)
      }
    });

    if (accountRows.length > 0) {
      const accountId = accountRows[0].account_id;
      console.log(`📊 Found account_id: ${accountId} for video ${youtubeVideoId}`);

      // Get account name from PostgreSQL posting_accounts table
      const accountNameQuery = `SELECT account_name FROM posting_accounts WHERE id = $1`;
      const { rows: accountNameRows } = await pool.query(accountNameQuery, [accountId]);

      if (accountNameRows.length > 0) {
        const accountName = accountNameRows[0].account_name;
        console.log(`✅ Found account name: ${accountName} for account_id: ${accountId}`);
        return accountName;
      }
    }

    console.log(`❌ No account name found for video ${videoId}`);
    return null;

  } catch (error) {
    console.error('❌ Error getting account name from BigQuery:', error);
    return null;
  }
}

// Initialize InfluxDB service
let influxService;
try {
  const InfluxService = require('../services/influxService');
  // Set credentials
  process.env.INFLUXDB_URL = 'https://us-east-1-1.aws.cloud2.influxdata.com';
  process.env.INFLUXDB_TOKEN = 'ojNizGw1U0VID3ltz1khIx2aOQAHG0gIFEbR7VqVk6Ns23fzXOcJG-JxPkGKWL6lluFBQKdagMRbHm6-2iVHSw==';
  process.env.INFLUXDB_ORG = 'engineering team';
  process.env.INFLUXDB_BUCKET = 'youtube_api';
  influxService = new InfluxService();
  console.log('✅ InfluxDB service initialized for analytics');
} catch (error) {
  console.error('❌ Failed to initialize InfluxDB for analytics:', error);
}

// Load environment variables from root directory
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// BigQuery setup with admin_dashboard.json credentials
const setupBigQueryClient = async () => {
  try {
    const fs = require('fs');
    const path = require('path');

    // Try to load credentials from admin_dashboard.json file first
    let credentials;
    const credentialsPath = path.join(__dirname, '..', '..', 'admin_dashboard.json');

    if (fs.existsSync(credentialsPath)) {
      console.log(`🔍 Analytics BigQuery: Loading credentials from admin_dashboard.json`);
      const credentialsFile = fs.readFileSync(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsFile);
    } else {
      // Fallback to environment variable
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

      if (!credentialsJson) {
        throw new Error('Neither admin_dashboard.json file nor GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable found');
      }

      console.log(`🔍 Analytics BigQuery: Loading credentials from environment variable`);
      credentials = JSON.parse(credentialsJson);
    }

    const projectId = credentials.project_id || process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";

    const bigquery = new BigQuery({
      credentials: credentials,
      projectId: projectId,
      location: "US",
    });

    console.log(`✅ Analytics BigQuery client initialized successfully for project: ${projectId}`);
    console.log(`✅ Analytics using service account: ${credentials.client_email}`);
    return bigquery;
  } catch (error) {
    console.error("❌ Failed to set up BigQuery client:", error);
    throw error;
  }
};

// Use global BigQuery client instead of local initialization
let bigquery = null;

// Initialize BigQuery client on startup
const initializeBigQuery = async () => {
  try {
    bigquery = await setupBigQueryClient();
    console.log('✅ Analytics routes: BigQuery client initialized successfully');
  } catch (error) {
    console.error('❌ Analytics routes: Failed to initialize BigQuery client:', error);
  }
};

// Initialize immediately
initializeBigQuery();

// Google Sheets API setup using the same credentials as BigQuery
const setupGoogleSheetsClient = async () => {
  try {
    let credentials;
    const credentialsPath = path.join(__dirname, '..', '..', 'admin_dashboard.json');

    if (fs.existsSync(credentialsPath)) {
      console.log(`🔍 Analytics Google Sheets: Loading credentials from admin_dashboard.json`);
      const credentialsFile = fs.readFileSync(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsFile);
    } else {
      // Fallback to environment variable
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

      if (!credentialsJson) {
        throw new Error('Neither admin_dashboard.json file nor GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable found');
      }

      console.log(`🔍 Analytics Google Sheets: Loading credentials from environment variable`);
      credentials = JSON.parse(credentialsJson);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log(`✅ Analytics Google Sheets client initialized successfully`);
    return sheets;
  } catch (error) {
    console.error("❌ Failed to set up Google Sheets client:", error);
    throw error;
  }
};

const getBigQueryClient = () => {
  // Use global client if available, otherwise try local initialization
  if (global.bigqueryClient) {
    return global.bigqueryClient;
  }

  // Fallback to local client if global not available
  return bigquery;
};

// COMMENTED OUT: Original BigQuery + InfluxDB data fetching mechanism
// TODO: Uncomment this section to restore original BigQuery + InfluxDB functionality
/*
// BigQuery helper functions - Updated to use youtube_video_report_historical exactly as QA script
async function getBigQueryViews(writerId, startDate, endDate, influxService = null) {
  try {
    console.log(`📊 QA Script Analytics: Getting views for writer ${writerId} from ${startDate} to ${endDate}`);

    // Use global BigQuery client
    const bigqueryClient = getBigQueryClient();
    if (!bigqueryClient) {
      throw new Error('BigQuery client not initialized');
    }

    // First, get the writer name from PostgreSQL for BigQuery filtering
    console.log(`🔍 Getting writer name for writer_id=${writerId}`);
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);

    if (writerRows.length === 0) {
      throw new Error(`No writer found with id=${writerId}`);
    }

    const writerName = writerRows[0].name;
    console.log(`✅ Found writer: ${writerName}`);

    let allData = [];
*/

// Helper function to parse YouTube PT duration format (PT2M58S, PT43S)
function parseYouTubeDuration(duration) {
  if (!duration || typeof duration !== 'string') return 0;

  // Match PT format: PT2M58S, PT43S, PT1H2M3S, etc.
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return (hours * 3600) + (minutes * 60) + seconds;
}

// NEW: Daily view increase calculation using youtube_metadata_historical with shorts/long split
async function getBigQueryViews(writerId, startDate, endDate, influxService = null) {
  try {
    console.log(`📊 NEW APPROACH: Getting daily view increases for writer ${writerId} from ${startDate} to ${endDate}`);

    // Check if this writer should get shorts/long split
    const splitWriters = [1001, 1002, 1004, 130, 136, 131];
    const shouldSplitByType = splitWriters.includes(parseInt(writerId));

    console.log(`📊 Writer ${writerId} split by type: ${shouldSplitByType}`);

    // Use global BigQuery client
    const bigqueryClient = getBigQueryClient();
    if (!bigqueryClient) {
      throw new Error('BigQuery client not initialized');
    }

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);

    if (writerRows.length === 0) {
      throw new Error(`No writer found with id=${writerId}`);
    }

    const writerName = writerRows[0].name;
    console.log(`📊 NEW APPROACH: Found writer name: ${writerName}`);

    // Step 1: Get distinct video_ids for this writer
    // Use youtube_video_report_historical up to July 3rd, then youtube_metadata_historical for newer dates
    const cutoffDate = '2025-07-03';
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const cutoffDateObj = new Date(cutoffDate);

    let videoIds = [];

    // If date range is entirely before or on cutoff date, use youtube_video_report_historical
    if (endDateObj <= cutoffDateObj) {
      console.log(`📊 Using youtube_video_report_historical for entire date range (before ${cutoffDate})`);
      const videoIdsQuery = `
        SELECT DISTINCT video_id
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
        WHERE writer_name = @writer_name
          AND date_day BETWEEN @start_date AND @end_date
          AND writer_name IS NOT NULL
          AND video_id IS NOT NULL
      `;

      const [videoIdsRows] = await bigqueryClient.query({
        query: videoIdsQuery,
        params: {
          writer_name: writerName,
          start_date: startDate,
          end_date: endDate
        }
      });

      videoIds = videoIdsRows.map(row => row.video_id);
    }
    // If date range is entirely after cutoff date, use youtube_metadata_historical
    else if (startDateObj > cutoffDateObj) {
      console.log(`📊 Using youtube_metadata_historical for entire date range (after ${cutoffDate})`);
      const videoIdsQuery = `
        SELECT DISTINCT video_id
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_id = @writer_id
          AND DATE(snapshot_date) BETWEEN @start_date AND @end_date
          AND writer_id IS NOT NULL
          AND video_id IS NOT NULL
      `;

      const [videoIdsRows] = await bigqueryClient.query({
        query: videoIdsQuery,
        params: {
          writer_id: parseInt(writerId),
          start_date: startDate,
          end_date: endDate
        }
      });

      videoIds = videoIdsRows.map(row => row.video_id);
    }
    // If date range spans across cutoff date, combine both sources
    else {
      console.log(`📊 Using both data sources: youtube_video_report_historical up to ${cutoffDate}, youtube_metadata_historical after`);

      // Get video IDs from youtube_video_report_historical (up to cutoff date)
      const historicalVideoIdsQuery = `
        SELECT DISTINCT video_id
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
        WHERE writer_name = @writer_name
          AND date_day BETWEEN @start_date AND @cutoff_date
          AND writer_name IS NOT NULL
          AND video_id IS NOT NULL
      `;

      const [historicalVideoIdsRows] = await bigqueryClient.query({
        query: historicalVideoIdsQuery,
        params: {
          writer_name: writerName,
          start_date: startDate,
          cutoff_date: cutoffDate
        }
      });

      // Get video IDs from youtube_metadata_historical (after cutoff date)
      const recentVideoIdsQuery = `
        SELECT DISTINCT video_id
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_id = @writer_id
          AND DATE(snapshot_date) > @cutoff_date
          AND DATE(snapshot_date) <= @end_date
          AND writer_id IS NOT NULL
          AND video_id IS NOT NULL
      `;

      const [recentVideoIdsRows] = await bigqueryClient.query({
        query: recentVideoIdsQuery,
        params: {
          writer_id: parseInt(writerId),
          cutoff_date: cutoffDate,
          end_date: endDate
        }
      });

      // Combine and deduplicate video IDs
      const historicalVideoIds = historicalVideoIdsRows.map(row => row.video_id);
      const recentVideoIds = recentVideoIdsRows.map(row => row.video_id);
      videoIds = [...new Set([...historicalVideoIds, ...recentVideoIds])];

      console.log(`📊 Found ${historicalVideoIds.length} videos from historical data, ${recentVideoIds.length} from recent data`);
    }

    console.log(`📊 Found ${videoIds.length} distinct videos for writer ${writerName}`);

    if (videoIds.length === 0) {
      console.log(`📊 No videos found for writer ${writerName} in date range`);
      return shouldSplitByType ? { shorts: [], longs: [] } : [];
    }

    // Step 1.5: Get video durations for type categorization (only for split writers)
    let videoDurations = new Map();
    if (shouldSplitByType && videoIds.length > 0) {
      console.log(`📊 Getting video durations for ${videoIds.length} videos to categorize shorts vs longs`);

      const durationsQuery = `
        SELECT DISTINCT
          video_id,
          content_details_duration
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE video_id IN UNNEST(@video_ids)
          AND content_details_duration IS NOT NULL
      `;

      try {
        const [durationsRows] = await bigqueryClient.query({
          query: durationsQuery,
          params: { video_ids: videoIds }
        });

        console.log(`📊 Retrieved ${durationsRows.length} duration records`);

        durationsRows.forEach(row => {
          if (row.video_id && row.content_details_duration) {
            const durationSeconds = parseYouTubeDuration(row.content_details_duration);
            const isShort = durationSeconds > 0 && durationSeconds <= 193; // 3 minutes 13 seconds
            videoDurations.set(row.video_id, {
              duration: row.content_details_duration,
              seconds: durationSeconds,
              isShort: isShort,
              type: isShort ? 'short' : 'long'
            });

            console.log(`📊 Video ${row.video_id}: ${row.content_details_duration} = ${durationSeconds}s = ${isShort ? 'SHORT' : 'LONG'}`);
          }
        });

        console.log(`📊 Categorized ${videoDurations.size} videos by duration`);
      } catch (durationError) {
        console.warn(`⚠️ Failed to get video durations: ${durationError.message}`);
      }
    }

    // Step 2: Get daily view counts from youtube_metadata_historical for these videos
    // FIXED: Get extended date range to ensure we have previous day data for proper daily increase calculation
    const extendedStartDate = new Date(startDate);
    extendedStartDate.setDate(extendedStartDate.getDate() - 7); // Go back 7 days to ensure we have previous data
    const extendedStartDateStr = extendedStartDate.toISOString().split('T')[0];

    const viewCountsQuery = `
      SELECT
        video_id,
        DATE(snapshot_date) as date_day,
        statistics_view_count,
        snippet_published_at
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
      WHERE video_id IN UNNEST(@video_ids)
        AND DATE(snapshot_date) BETWEEN @extended_start_date AND @end_date
        AND statistics_view_count IS NOT NULL
      ORDER BY video_id, snapshot_date ASC
    `;

    console.log(`📊 Getting view counts for ${videoIds.length} videos (extended range: ${extendedStartDateStr} to ${endDate})`);
    const [viewCountsRows] = await bigqueryClient.query({
      query: viewCountsQuery,
      params: {
        video_ids: videoIds,
        extended_start_date: extendedStartDateStr,
        end_date: endDate
      }
    });

    console.log(`📊 Retrieved ${viewCountsRows.length} view count records`);

    // Step 3: Calculate daily increases for each video
    const videoViewIncreases = new Map();
    const shortsViewIncreases = new Map(); // For shorts videos
    const longsViewIncreases = new Map();  // For long videos

    // Group by video_id
    const videoGroups = new Map();
    viewCountsRows.forEach(row => {
      const videoId = row.video_id;
      if (!videoGroups.has(videoId)) {
        videoGroups.set(videoId, []);
      }
      videoGroups.get(videoId).push({
        date: row.date_day.value instanceof Date ?
          row.date_day.value.toISOString().split('T')[0] :
          row.date_day.value,
        views: parseInt(row.statistics_view_count || 0),
        publishedAt: row.snippet_published_at ? row.snippet_published_at.value : null
      });
    });

    console.log(`📊 Processing ${videoGroups.size} videos for daily increases`);

    // Calculate daily increases for each video (FIXED LOGIC)
    videoGroups.forEach((dates, videoId) => {
      // Sort by date
      dates.sort((a, b) => new Date(a.date) - new Date(b.date));

      let previousViews = null;

      for (let i = 0; i < dates.length; i++) {
        const currentDate = dates[i].date;
        const currentViews = dates[i].views;
        const publishedAt = dates[i].publishedAt;

        // FIXED: Only include dates within our target range for output
        if (currentDate < startDate || currentDate > endDate) {
          // Still track previous views for calculation, but don't include in output
          previousViews = currentViews;
          continue;
        }

        let dailyIncrease;

        if (previousViews === null) {
          // FIXED: No previous data available - check if this is a legitimate first day
          let useFirstDay = false;

          if (publishedAt) {
            const publishDate = publishedAt;
            const daysDifference = (new Date(currentDate) - new Date(publishDate)) / (1000 * 60 * 60 * 24);
            useFirstDay = daysDifference <= 2;

            if (useFirstDay) {
              console.log(`📅 Video ${videoId}: First day data (${currentDate}) is within ${daysDifference.toFixed(1)} days of publish date (${publishDate}), using first day views: ${currentViews.toLocaleString()}`);
            } else {
              console.log(`📅 Video ${videoId}: First day data (${currentDate}) is ${daysDifference.toFixed(1)} days after publish date (${publishDate}), skipping (no previous data)`);
            }
          } else {
            console.log(`📅 Video ${videoId}: No publish date available, skipping first day (no previous data)`);
          }

          if (useFirstDay) {
            // Use first day views as-is (it's a legitimate first day)
            dailyIncrease = currentViews;
          } else {
            // Skip this day - no previous data and not a legitimate first day
            previousViews = currentViews;
            continue;
          }
        } else {
          // FIXED: Calculate daily increase from previous day (ALWAYS use this logic when previous data exists)
          dailyIncrease = Math.max(0, currentViews - previousViews);
          console.log(`📊 Video ${videoId} on ${currentDate}: ${previousViews.toLocaleString()} → ${currentViews.toLocaleString()} = +${dailyIncrease.toLocaleString()}`);
        }

        // Aggregate increases by video type if splitting is enabled
        if (shouldSplitByType) {
          const videoDuration = videoDurations.get(videoId);
          const isShort = videoDuration ? videoDuration.isShort : false; // Default to long if no duration data

          if (isShort) {
            if (!shortsViewIncreases.has(currentDate)) {
              shortsViewIncreases.set(currentDate, 0);
            }
            shortsViewIncreases.set(currentDate, shortsViewIncreases.get(currentDate) + dailyIncrease);
            console.log(`📊 SHORT Video ${videoId} on ${currentDate}: +${dailyIncrease.toLocaleString()} views`);
          } else {
            if (!longsViewIncreases.has(currentDate)) {
              longsViewIncreases.set(currentDate, 0);
            }
            longsViewIncreases.set(currentDate, longsViewIncreases.get(currentDate) + dailyIncrease);
            console.log(`📊 LONG Video ${videoId} on ${currentDate}: +${dailyIncrease.toLocaleString()} views`);
          }
        }

        // Always aggregate total increases for backward compatibility
        if (!videoViewIncreases.has(currentDate)) {
          videoViewIncreases.set(currentDate, 0);
        }
        videoViewIncreases.set(currentDate, videoViewIncreases.get(currentDate) + dailyIncrease);

        previousViews = currentViews;
      }
    });

    // Step 4: Convert to the expected format
    // Always create combined data for backward compatibility
    const allData = [];
    videoViewIncreases.forEach((totalIncrease, date) => {
      allData.push({
        time: { value: date },
        views: totalIncrease,
        source: 'BigQuery_Daily_Increases'
      });
    });
    allData.sort((a, b) => new Date(a.time.value) - new Date(b.time.value));

    if (shouldSplitByType) {
      // Create separate data arrays for shorts and longs
      const shortsData = [];
      shortsViewIncreases.forEach((totalIncrease, date) => {
        shortsData.push({
          time: { value: date },
          views: totalIncrease,
          source: 'BigQuery_Daily_Increases_Shorts'
        });
      });

      const longsData = [];
      longsViewIncreases.forEach((totalIncrease, date) => {
        longsData.push({
          time: { value: date },
          views: totalIncrease,
          source: 'BigQuery_Daily_Increases_Longs'
        });
      });

      // Sort by date
      shortsData.sort((a, b) => new Date(a.time.value) - new Date(b.time.value));
      longsData.sort((a, b) => new Date(a.time.value) - new Date(b.time.value));

      console.log(`📊 NEW APPROACH (SPLIT): Calculated daily increases for ${shortsData.length} days (shorts), ${longsData.length} days (longs)`);
      console.log(`📊 Shorts sample:`, shortsData.slice(0, 3));
      console.log(`📊 Longs sample:`, longsData.slice(0, 3));
      console.log(`📊 Total videos processed: ${videoGroups.size} (${videoDurations.size} categorized by duration)`);

      return {
        shorts: shortsData,
        longs: longsData,
        combined: allData // Also return combined for backward compatibility
      };
    } else {
      // Original behavior for non-split writers
      console.log(`📊 NEW APPROACH: Calculated daily increases for ${allData.length} days`);
      console.log(`📊 Sample data:`, allData.slice(0, 3));
      console.log(`📊 Total videos processed: ${videoGroups.size}`);

      return allData;
    }

  } catch (error) {
    console.error('❌ NEW APPROACH: Error calculating daily view increases:', error);
    throw error;
  }
}

async function getBigQueryTopVideos(writerId, startDate, endDate, limit = 10) {
  try {
    console.log(`🎬 BigQuery: Getting top videos for writer ${writerId}`);

    // Get writer name from PostgreSQL
    const writerQuery = `
      SELECT name FROM writer WHERE id = $1
    `;
    const { rows: writerRows } = await pool.query(writerQuery, [parseInt(writerId)]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writerId} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`📝 Found writer name: ${writerName} for top videos`);

    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = process.env.BIGQUERY_DATASET || "dashboard_prod";
    const table = process.env.BIGQUERY_TABLE || "daily_view_growth";

    // Simple PostgreSQL query to get top videos
    const query = `
      SELECT
        video.id as video_id,
        video.script_title AS title,
        video.url,
        COALESCE(statistics_youtube_api.views_total, 0) AS total_views,
        COALESCE(statistics_youtube_api.likes_total, 0) AS total_likes,
        COALESCE(statistics_youtube_api.comments_total, 0) AS total_comments,
        statistics_youtube_api.preview,
        statistics_youtube_api.duration,
        statistics_youtube_api.posted_date as first_date
      FROM video
      LEFT JOIN statistics_youtube_api
          ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
      WHERE video.writer_id = $1
        AND video.url LIKE '%youtube.com%'
        AND statistics_youtube_api.views_total IS NOT NULL
        AND statistics_youtube_api.posted_date BETWEEN $2 AND $3
      ORDER BY statistics_youtube_api.views_total DESC
      LIMIT $4
    `;

    const queryParams = [
      parseInt(writerId),
      startDate.toISOString(),
      endDate.toISOString(),
      parseInt(limit)
    ];

    console.log('🔍 PostgreSQL top videos query:', query);
    console.log('📊 Query params:', queryParams);

    const { rows } = await pool.query(query, queryParams);
    console.log(`🎬 PostgreSQL returned ${rows.length} top videos for writer ${writerId}`);

    // Get video titles from PostgreSQL for better display
    const videoTitles = new Map();
    if (rows.length > 0) {
      try {
        const urls = rows.map(row => row.url).filter(url => url);
        if (urls.length > 0) {
          const titleQuery = `
            SELECT url, script_title
            FROM video
            WHERE url = ANY($1) AND writer_id = $2
          `;
          const { rows: titleRows } = await pool.query(titleQuery, [urls, parseInt(writerId)]);
          titleRows.forEach(row => {
            if (row.script_title) {
              videoTitles.set(row.url, row.script_title);
            }
          });
        }
      } catch (titleError) {
        console.error('⚠️ Error getting video titles:', titleError);
      }
    }

    return rows
      .filter(row => row.duration) // Only process videos with actual duration data
      .map(row => {
      // Use actual duration from database (no fallbacks)
      const duration = row.duration;

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

      return {
        id: row.video_id,
        title: row.title || `Video ${row.video_id}`,
        views: parseInt(row.total_views || 0),
        url: row.url,
        thumbnail: row.preview || (row.url ? `https://img.youtube.com/vi/${extractVideoId(row.url)}/maxresdefault.jpg` : '/path/to/default-thumbnail.jpg'),
        posted_date: row.first_date || new Date().toISOString(),
        type: videoType,
        isShort: isShort,
        duration: duration,
        engagement: Math.floor(Math.random() * 15) + 85, // 85-100% engagement
        likes: parseInt(row.total_likes || 0),
        comments: parseInt(row.total_comments || 0)
      };
    });
  } catch (error) {
    console.error('❌ BigQuery top videos query error:', error);
    throw error;
  }
}

// PostgreSQL-based Content function with BigQuery account name enhancement
async function getPostgresContentVideosWithBigQueryNames(writerId, dateRange, page = 1, limit = 20, type = 'all') {
  try {
    console.log(`🎬 PostgreSQL Content: Getting videos for writer ${writerId}, range: ${dateRange}, type: ${type}`);

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [parseInt(writerId)]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writerId} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`📝 Found writer name: ${writerName} for content videos`);

    // Calculate date filter based on dateRange parameter
    let dateCondition = '';
    let queryParams = [parseInt(writerId)];

    if (dateRange !== 'lifetime') {
      const rangeNum = parseInt(dateRange) || 28;

      // Create date filter with timezone consideration
      // Use current date in UTC but subtract an extra day to be more inclusive
      const now = new Date();
      const dateFilter = new Date(now.getTime() - (rangeNum + 1) * 24 * 60 * 60 * 1000);
      const dateFilterStr = dateFilter.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Also log current date for debugging
      const currentDateStr = now.toISOString().split('T')[0];

      dateCondition = 'AND (s.posted_date >= $2 OR s.posted_date IS NULL)';
      queryParams.push(dateFilterStr);
      console.log(`📅 Date filter: Last ${rangeNum} days (since ${dateFilterStr}) - Current date: ${currentDateStr}, includes extra day for timezone safety`);
    } else {
      console.log(`📅 Date filter: Lifetime (no date restriction)`);
    }

    // Step 1: Get videos from statistics_youtube_api for the writer with date filtering
    // Add virals filtering at database level if type is 'virals'
    const viralsCondition = type === 'virals' ? 'AND COALESCE(s.views_total, 0) >= 1000000' : '';

    const postgresQuery = `
      SELECT
        v.id,
        v.script_title as title,
        v.url,
        v.writer_id,
        v.video_cat,
        v.trello_card_id,
        COALESCE(s.views_total, 0) as views,
        COALESCE(s.likes_total, 0) as likes,
        COALESCE(s.comments_total, 0) as comments,
        s.posted_date,
        s.duration,
        s.preview,
        pa.account as account_name,
        sc.google_doc_link,
        sc.ai_chat_url,
        sc.core_concept_doc
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN posting_accounts pa ON v.account_id = pa.id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE v.writer_id = $1
        AND (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND v.url IS NOT NULL
        AND (v.video_type IS NULL OR v.video_type != 'Archived')
        ${dateCondition}
        ${viralsCondition}
      ORDER BY s.posted_date DESC NULLS LAST, v.id DESC
    `;

    const { rows: postgresRows } = await pool.query(postgresQuery, queryParams);
    console.log(`📊 PostgreSQL returned ${postgresRows.length} videos for writer ${writerId}`);

    // DEBUG: Check if writer has ANY videos in video table
    const debugVideoQuery = `
      SELECT COUNT(*) as total_videos,
             COUNT(CASE WHEN url LIKE '%youtube%' THEN 1 END) as youtube_videos
      FROM video
      WHERE writer_id = $1
    `;
    const debugResult = await pool.query(debugVideoQuery, [parseInt(writerId)]);
    console.log(`🔍 DEBUG: Writer ${writerId} has ${debugResult.rows[0].total_videos} total videos, ${debugResult.rows[0].youtube_videos} YouTube videos in video table`);

    // DEBUG: Check statistics_youtube_api table for this writer's videos
    const debugStatsQuery = `
      SELECT COUNT(*) as stats_count
      FROM video v
      INNER JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
    `;
    const debugStatsResult = await pool.query(debugStatsQuery, [parseInt(writerId)]);
    console.log(`🔍 DEBUG: Writer ${writerId} has ${debugStatsResult.rows[0].stats_count} videos with statistics_youtube_api data`);

    // DEBUG: Check date range of videos for this writer
    const debugDateQuery = `
      SELECT
        MIN(s.posted_date) as earliest_date,
        MAX(s.posted_date) as latest_date,
        COUNT(*) as total_with_dates
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
        AND (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND s.posted_date IS NOT NULL
    `;
    const debugDateResult = await pool.query(debugDateQuery, [parseInt(writerId)]);
    console.log(`🔍 DEBUG: Writer ${writerId} video dates: earliest=${debugDateResult.rows[0].earliest_date}, latest=${debugDateResult.rows[0].latest_date}, total_with_dates=${debugDateResult.rows[0].total_with_dates}`);

    // DEBUG: Check for recent videos and sync status
    const recentDebugQuery = `
      SELECT
        v.id,
        v.script_title,
        s.posted_date as youtube_publish_date,
        s.updated_at as last_sync_time,
        s.views_total,
        CASE
          WHEN s.posted_date >= CURRENT_DATE - INTERVAL '1 day' THEN 'Published Today'
          WHEN s.posted_date >= CURRENT_DATE - INTERVAL '2 days' THEN 'Published Yesterday'
          WHEN s.posted_date >= CURRENT_DATE - INTERVAL '3 days' THEN 'Published 2 days ago'
          ELSE 'Published Earlier'
        END as youtube_publish_relative,
        CASE
          WHEN s.updated_at >= CURRENT_DATE - INTERVAL '1 day' THEN 'Synced Today'
          WHEN s.updated_at >= CURRENT_DATE - INTERVAL '2 days' THEN 'Synced Yesterday'
          WHEN s.updated_at >= CURRENT_DATE - INTERVAL '3 days' THEN 'Synced 2 days ago'
          ELSE 'Synced Earlier'
        END as sync_relative
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
        AND (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND (s.posted_date >= CURRENT_DATE - INTERVAL '5 days' OR s.updated_at >= CURRENT_DATE - INTERVAL '2 days')
      ORDER BY s.posted_date DESC NULLS LAST, s.updated_at DESC NULLS LAST
      LIMIT 15
    `;
    const recentDebugResult = await pool.query(recentDebugQuery, [parseInt(writerId)]);
    console.log(`🔍 DEBUG: Writer ${writerId} recent videos and sync status:`, recentDebugResult.rows.map(row => ({
      id: row.id,
      title: row.script_title?.substring(0, 50),
      youtube_publish_date: row.youtube_publish_date,
      last_sync_time: row.last_sync_time,
      youtube_publish_relative: row.youtube_publish_relative,
      sync_relative: row.sync_relative,
      views: row.views_total
    })));

    // DEBUG: Check overall sync status
    const syncStatusQuery = `
      SELECT
        COUNT(*) as total_videos_with_stats,
        MAX(s.updated_at) as last_sync_time,
        COUNT(CASE WHEN s.updated_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as synced_today,
        COUNT(CASE WHEN s.posted_date >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as published_today,
        COUNT(CASE WHEN s.posted_date >= CURRENT_DATE - INTERVAL '2 days' THEN 1 END) as published_last_2_days
      FROM statistics_youtube_api s
      INNER JOIN video v ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
    `;
    const syncStatusResult = await pool.query(syncStatusQuery, [parseInt(writerId)]);
    console.log(`🔍 DEBUG: Writer ${writerId} sync status:`, syncStatusResult.rows[0]);

    // Step 2: Get duration data from BigQuery for accurate video type determination
    let bigQueryDurationMap = new Map();

    if (bigquery && postgresRows.length > 0) {
      try {
        const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
        const dataset = "dbt_youtube_analytics";

        // Query video report table for duration data (has video_duration_seconds)
        const reportQuery = `
          SELECT DISTINCT
            video_id,
            account_name,
            channel_title,
            video_duration_seconds
          FROM \`${projectId}.${dataset}.youtube_video_report_historical\`
          WHERE writer_name = @writer_name
            AND video_id IS NOT NULL
            AND video_duration_seconds IS NOT NULL
        `;

        console.log(`🔍 Querying BigQuery youtube_video_report_historical for duration data`);
        const [reportRows] = await bigquery.query({
          query: reportQuery,
          params: { writer_name: writerName }
        });

        console.log(`📊 BigQuery youtube_video_report_historical returned ${reportRows.length} videos with duration data`);

        const bigQueryRows = reportRows;

        // Create map of video_id to duration data
        bigQueryRows.forEach(row => {
          if (row.video_id) {
            bigQueryDurationMap.set(row.video_id, {
              account_name: row.account_name,
              channel_title: row.channel_title,
              video_duration_seconds: row.video_duration_seconds
            });
          }
        });

        console.log(`📊 BigQuery duration data available for ${bigQueryDurationMap.size} videos`);

        // Debug: Show sample BigQuery duration data
        if (bigQueryDurationMap.size > 0) {
          const sampleEntry = Array.from(bigQueryDurationMap.entries())[0];
          console.log(`🔍 Sample BigQuery duration data:`, {
            video_id: sampleEntry[0],
            account_name: sampleEntry[1].account_name,
            channel_title: sampleEntry[1].channel_title,
            duration_seconds: sampleEntry[1].video_duration_seconds
          });
        }
      } catch (bigQueryError) {
        console.log(`⚠️ BigQuery duration lookup failed, using PostgreSQL duration only:`, bigQueryError.message);
      }
    }

    // Step 3: Transform ALL PostgreSQL videos with BigQuery duration enhancement
    const videos = postgresRows.map(row => {
      // Extract YouTube video ID for BigQuery duration lookup
      const youtubeVideoId = extractVideoId(row.url);
      const bigQueryData = bigQueryDurationMap.get(youtubeVideoId) || {};

      // Debug: Show video ID matching for first few videos
      if (bigQueryDurationMap.size > 0 && Math.random() < 0.1) { // 10% chance to log
        console.log(`🔍 Video ID matching debug:`, {
          postgres_url: row.url,
          extracted_video_id: youtubeVideoId,
          bigquery_has_data: !!bigQueryData.account_name || !!bigQueryData.channel_title || !!bigQueryData.video_duration_seconds,
          bigquery_account_name: bigQueryData.account_name,
          bigquery_channel_title: bigQueryData.channel_title,
          bigquery_duration_seconds: bigQueryData.video_duration_seconds
        });
      }

      // Determine video type: BigQuery duration first, then PostgreSQL duration, then URL pattern
      let videoType = 'video'; // default to video (not short)
      let isShort = false;
      let durationSource = 'default';

      // Priority 1: Use BigQuery video_duration_seconds (most accurate)
      if (bigQueryData && bigQueryData.video_duration_seconds !== undefined && bigQueryData.video_duration_seconds !== null) {
        const durationSeconds = parseFloat(bigQueryData.video_duration_seconds);
        if (durationSeconds > 0 && durationSeconds < 183) { // Less than 3 minutes 3 seconds (183 seconds)
          videoType = 'short';
          isShort = true;
        } else if (durationSeconds >= 183) {
          videoType = 'video';
          isShort = false;
        }
        durationSource = 'bigquery';
        console.log(`🎬 Video type determined by BigQuery duration: ${durationSeconds}s = ${videoType}`);
      }
      // Priority 2: Use PostgreSQL duration as fallback (format: "HH:MM:SS" or "MM:SS")
      else if (row.duration && row.duration !== '0:00' && row.duration !== '00:00:00') {
        try {
          const parts = row.duration.split(':');
          let totalSeconds = 0;

          if (parts.length === 3) {
            // Format: "HH:MM:SS"
            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            const seconds = parseInt(parts[2]) || 0;
            totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
          } else if (parts.length === 2) {
            // Format: "MM:SS"
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            totalSeconds = (minutes * 60) + seconds;
          }

          if (totalSeconds > 0 && totalSeconds < 183) { // Less than 3 minutes 3 seconds
            videoType = 'short';
            isShort = true;
          } else if (totalSeconds >= 183) {
            videoType = 'video';
            isShort = false;
          }
          durationSource = 'postgres';
          console.log(`🎬 Video type determined by PostgreSQL duration: ${totalSeconds}s (${row.duration}) = ${videoType}`);
        } catch (durationError) {
          console.log(`⚠️ Error parsing PostgreSQL duration "${row.duration}" for video ${youtubeVideoId}`);
          durationSource = 'error';
        }
      }

      // Priority 3: Use URL pattern as last resort
      if (durationSource === 'default' || durationSource === 'error') {
        if (row.url && row.url.includes('/shorts/')) {
          videoType = 'short';
          isShort = true;
          durationSource = 'url_pattern';
        } else {
          videoType = 'video';
          isShort = false;
          durationSource = 'url_pattern';
        }
        console.log(`🎬 Video type determined by URL pattern: ${videoType} (${row.url?.includes('/shorts/') ? 'shorts URL' : 'regular URL'})`);
      }

      // Calculate engagement rate
      const engagement = row.views > 0
        ? Math.round(((row.likes + row.comments) / row.views) * 100 * 100) / 100
        : 0;

      // Use whatever account name is available: BigQuery account_name, channel_title, or PostgreSQL account_name
      const enhancedAccountName = bigQueryData.account_name || bigQueryData.channel_title || row.account_name || 'Not Available';

      return {
        id: row.id,
        title: row.title || 'Untitled Video',
        url: row.url,
        writer_id: parseInt(writerId),
        writer_name: writerName,
        account_name: enhancedAccountName,
        preview: row.preview || `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
        views: parseInt(row.views) || 0,
        likes: parseInt(row.likes) || 0,
        comments: parseInt(row.comments) || 0,
        posted_date: row.posted_date || new Date().toISOString(),
        duration: row.duration || '0:00',
        type: videoType,
        isShort: isShort,
        engagement: engagement,
        status: "Published",
        durationSource: durationSource, // Track where duration came from for debugging
        source: bigQueryData.account_name || bigQueryData.channel_title ? 'postgres_with_bigquery_duration' : 'postgres_only',
        google_doc_link: row.google_doc_link,
        ai_chat_url: row.ai_chat_url,
        core_concept_doc: row.core_concept_doc
      };
    }); // Show ALL videos from PostgreSQL statistics_youtube_api table

    console.log(`🎬 Total videos from statistics_youtube_api: ${videos.length} videos for writer ${writerId}`);

    // Debug: Log sample video types before filtering
    console.log(`🔍 Sample video types before filtering:`, videos.slice(0, 5).map(v => ({
      id: v.id,
      title: v.title?.substring(0, 30),
      type: v.type,
      isShort: v.isShort,
      duration: v.duration,
      durationSource: v.durationSource,
      url: v.url?.includes('/shorts/') ? 'shorts_url' : 'regular_url'
    })));

    // Step 4: Apply type filtering
    let filteredVideos = videos;

    console.log(`🔍 Filtering by type: '${type}'`);

    if (type === 'short' || type === 'shorts') {
      filteredVideos = videos.filter(video => video.isShort);
      console.log(`🔍 Filtering for shorts: ${filteredVideos.length} videos where isShort=true`);
    } else if (type === 'video' || type === 'content') {
      filteredVideos = videos.filter(video => !video.isShort);
      console.log(`🔍 Filtering for videos: ${filteredVideos.length} videos where isShort=false`);
    }
    // If type === 'all', show all videos (no filtering)

    // Calculate type counts
    const shortCount = videos.filter(v => v.isShort).length;
    const videoCount = videos.filter(v => !v.isShort).length;

    console.log(`🎬 Type filtering results: ${filteredVideos.length}/${videos.length} videos match type '${type}'`);
    console.log(`📊 Type breakdown: ${shortCount} shorts, ${videoCount} videos`);

    // Debug: Log sample filtered videos
    if (filteredVideos.length > 0) {
      console.log(`🔍 Sample filtered videos:`, filteredVideos.slice(0, 3).map(v => ({
        id: v.id,
        title: v.title?.substring(0, 30),
        type: v.type,
        isShort: v.isShort,
        duration: v.duration
      })));
    } else {
      console.log(`⚠️ No videos match the filter type '${type}'!`);
    }

    // Step 5: Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

    console.log(`📄 Pagination: Page ${page}, showing ${startIndex + 1}-${Math.min(endIndex, filteredVideos.length)} of ${filteredVideos.length} filtered videos`);

    return {
      videos: paginatedVideos,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredVideos.length / parseInt(limit)),
        totalVideos: filteredVideos.length,
        videosPerPage: parseInt(limit),
        hasNextPage: endIndex < filteredVideos.length,
        hasPrevPage: parseInt(page) > 1
      },
      typeCounts: {
        all: videos.length,
        short: shortCount,
        video: videoCount
      }
    };

  } catch (error) {
    console.error('❌ PostgreSQL content videos query error:', error);
    throw error;
  }
}

// Helper function to extract video ID from YouTube URL
function extractVideoId(url) {
  if (!url) return 'dQw4w9WgXcQ'; // Default video ID

  // Handle YouTube Shorts URLs: https://youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return shortsMatch[1];
  }

  // Handle regular YouTube URLs: https://youtube.com/watch?v=VIDEO_ID
  const regularMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return regularMatch ? regularMatch[1] : 'dQw4w9WgXcQ';
}

// Helper function to format duration from seconds to MM:SS format
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0:00';

  const totalSeconds = parseInt(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Assumes `bigquery` (BigQuery client) and `pool` (pg Pool) are initialized at module scope.
// Requires an InfluxDB service with a `queryFlux(flux: string): Promise<any[]>` method.

async function getBigQueryAnalyticsOverview(
  writerId,
  range = '30d',
  writerName = null,
  limit = 100,
  customStartDate = null,
  customEndDate = null
) {
  try {
    console.log(`📊 ANALYTICS OVERVIEW: writer=${writerId} (${writerName}), range=${range}, limit=${limit}`);
    console.log(`📊 Custom dates: start=${customStartDate}, end=${customEndDate}`);

    // ———————————————— 1) Ensure BigQuery client ————————————————
    if (!bigquery) throw new Error('BigQuery client not initialized');

    // ———————————————— 2) Lookup writerName if missing ————————————————
    if (!writerName) {
      const res = await pool.query('SELECT name FROM writer WHERE id = $1', [parseInt(writerId, 10)]);
      if (res.rows.length === 0) throw new Error(`Writer with ID ${writerId} not found`);
      writerName = res.rows[0].name;
    }

    // ———————————————— 3) Compute date window ————————————————
    let finalStartDate, finalEndDate;

    if (customStartDate && customEndDate) {
      // Use custom date range
      finalStartDate = customStartDate;
      finalEndDate = customEndDate;
      console.log(`📅 Using CUSTOM date range: ${finalStartDate} → ${finalEndDate}`);
    } else {
      // Use predefined range
      const endDate = new Date();
      const startDate = new Date();
      let days;
      switch (range) {
        case '7d':       days = 7;   break;
        case 'lifetime': days = 365; break;
        default:         days = 30;  break;
      }
      startDate.setDate(endDate.getDate() - days);
      finalStartDate = startDate.toISOString().slice(0, 10);
      finalEndDate = endDate.toISOString().slice(0, 10);
      console.log(`📅 Using PREDEFINED date range: ${finalStartDate} → ${finalEndDate}`);
    }

    // ———————————————— 4) Determine data source strategy ————————————————
    // REVERT TO ORIGINAL WORKING LOGIC: Use EDT (Eastern Daylight Time) which is UTC-4 during summer
    // Calculate current EDT time by subtracting 4 hours from UTC
    const nowUTC = new Date();
    const nowEDT = new Date(nowUTC.getTime() - (4 * 60 * 60 * 1000)); // Subtract 4 hours for EDT

    const threeDaysAgo = new Date(nowEDT);
    threeDaysAgo.setDate(nowEDT.getDate() - 3);
    const cutoffDateStr = threeDaysAgo.toISOString().slice(0, 10);

    console.log(`📅 REVERTED to original working logic:
      Current UTC: ${nowUTC.toISOString()}
      Current EDT: ${nowEDT.toISOString()}
      Cutoff date (3 days ago): ${cutoffDateStr}`);

    const requestStartDate = new Date(finalStartDate);
    const requestEndDate = new Date(finalEndDate);

    // NEW STRATEGY: Always use BigQuery for line chart data (all available historical data)
    // InfluxDB is only used for real-time bar chart (last 24 hours)
    let useBigQuery = true;
    let useInfluxDB = false; // No longer used for line chart
    let finalBigQueryEndDate = finalEndDate;
    let finalInfluxStartDate = cutoffDateStr;

    console.log(`📊 NEW Data source strategy: BigQuery ONLY for line chart (all historical data from ${finalStartDate} to ${finalEndDate})`);

    console.log(`🔍 Date range analysis: {
      finalStartDate: '${finalStartDate}',
      finalEndDate: '${finalEndDate}',
      cutoffDateStr: '${cutoffDateStr}',
      useBigQuery: ${useBigQuery},
      useInfluxDB: ${useInfluxDB},
      finalBigQueryEndDate: '${finalBigQueryEndDate}',
      finalInfluxStartDate: '${finalInfluxStartDate}'
    }`);

    // ———————————————— 5) QA: Raw Views from BigQuery ————————————————

    let rawViewsRows = [];
    if (useBigQuery) {
      const rawViewsQuery = `
        SELECT
          FORMAT_DATE('%Y-%m-%d', date_day) as date_string,
          video_id,
          video_title,
          views,
          account_name
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
        WHERE writer_name = @writer_name
          AND date_day >= @start_date
          AND date_day <= @end_date
          ${useBigQuery && useInfluxDB ? 'AND date_day <= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)' : ''}
          AND writer_name IS NOT NULL
          AND views IS NOT NULL
        ORDER BY date_day DESC, views DESC;

      `;
      const [bigQueryRawRows] = await bigquery.query({
        query: rawViewsQuery,
        params: {
          writer_name: writerName,
          start_date: finalStartDate,
          end_date: finalBigQueryEndDate,
        }
      });
      rawViewsRows = bigQueryRawRows;
    }
    console.log(`📋 Raw Views (${rawViewsRows.length} rows):`);
    console.table(rawViewsRows.slice(0, 100).map(row => ({
      date_string: row.date_string,
      video_id: row.video_id,
      video_title: row.video_title,
      views: row.views,
      account_name: row.account_name
    })));

    console.log('✅ Raw views processing completed successfully');
    console.log('🔍 About to start daily totals query...');

    // ——— NEW APPROACH: Daily view increases via BigQuery metadata ———
    console.log('🔍 Executing NEW daily view increase calculation...');

    let dailyTotalsRows = [];
    if (useBigQuery) {
      try {
        console.log('📊 NEW APPROACH: Getting daily view increases using youtube_metadata_historical (priority) + historical_video_metadata_past (fallback)');

        // Step 1: Get historical data from historical_video_metadata_past (January-June, more accurate)
        console.log('🔍 Step 1: Getting historical data from historical_video_metadata_past for writer:', writerName, 'writerId:', writerId);
        const historicalDataQuery = `
          SELECT
            Date as date_day,
            SUM(CAST(Views AS INT64)) as total_views
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.historical_video_metadata_past\`
          WHERE writer_id = @writer_id
            AND Date IS NOT NULL
            AND Views IS NOT NULL
          GROUP BY Date
          ORDER BY Date
        `;

        const [historicalDataResult] = await bigquery.query({
          query: historicalDataQuery,
          params: {
            writer_id: parseFloat(writerId) // Convert to float to match the 94.0 format
          }
        });

        console.log(`📊 Found ${historicalDataResult.length} historical days for writer ${writerName} (writer_id: ${parseFloat(writerId)})`);
        if (historicalDataResult.length > 0) {
          console.log(`📅 Historical data sample:`, historicalDataResult.slice(0, 3));
        } else {
          console.log(`⚠️ No historical data found for writer_id ${parseFloat(writerId)} in historical_video_metadata_past table`);
        }

        // Step 2: Get distinct video_ids for this writer from both tables
        // Use youtube_video_report_historical for dates up to July 3rd
        // Use youtube_metadata_historical for July 4th onwards (more up-to-date)
        console.log('🔍 Step 2: Getting distinct video_ids from both tables for writer:', writerName);

        const cutoffDate = '2025-07-03';
        let allVideoIds = new Set();

        // Get video IDs from youtube_video_report_historical (up to July 3rd)
        if (finalStartDate <= cutoffDate) {
          const videoIdsQuery1 = `
            SELECT DISTINCT video_id
            FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
            WHERE writer_name = @writer_name
              AND date_day <= @cutoff_date
          `;

          const [videoIdsResult1] = await bigquery.query({
            query: videoIdsQuery1,
            params: {
              writer_name: writerName,
              cutoff_date: cutoffDate
            }
          });

          console.log(`📊 Found ${videoIdsResult1.length} video IDs from youtube_video_report_historical (up to ${cutoffDate})`);
          videoIdsResult1.forEach(row => allVideoIds.add(row.video_id));
        }

        // Get video IDs from youtube_metadata_historical (July 4th onwards)
        if (finalEndDate > cutoffDate) {
          const videoIdsQuery2 = `
            SELECT DISTINCT video_id
            FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
            WHERE writer_name = @writer_name
              AND snapshot_date > @cutoff_date
          `;

          const [videoIdsResult2] = await bigquery.query({
            query: videoIdsQuery2,
            params: {
              writer_name: writerName,
              cutoff_date: cutoffDate
            }
          });

          console.log(`📊 Found ${videoIdsResult2.length} video IDs from youtube_metadata_historical (after ${cutoffDate})`);
          videoIdsResult2.forEach(row => allVideoIds.add(row.video_id));
        }

        const videoIds = Array.from(allVideoIds);
        console.log(`📊 Total unique video IDs for writer: ${videoIds.length}`);

        // Step 3: Process historical data (sum views by date, no daily increase calculation)
        const historicalDailyTotals = new Map();
        historicalDataResult.forEach(row => {
          const dateStr = row.date_day.value; // BigQuery DATE type
          const totalViews = parseInt(row.total_views);
          historicalDailyTotals.set(dateStr, totalViews);
          console.log(`📅 Historical: ${dateStr} = ${totalViews.toLocaleString()} total views`);
        });

        if (videoIds.length === 0) {
          console.log('⚠️ No video IDs found for this writer and date range');
          // If no current videos but we have historical data, use historical data only
          if (historicalDailyTotals.size > 0) {
            dailyTotalsRows = Array.from(historicalDailyTotals.entries()).map(([dateStr, totalViews]) => ({
              date_string: dateStr,
              total_views: totalViews,
              unique_videos: 1 // Approximate since we don't have video count from historical table
            }));
          } else {
            dailyTotalsRows = [];
          }
        } else {
          // Step 4: Get daily view counts from youtube_metadata_historical
          // CRITICAL FIX: Use extended date range to get previous day data for daily increase calculations
          const extendedStartDate = new Date(finalStartDate);
          extendedStartDate.setDate(extendedStartDate.getDate() - 7); // Get 7 days before for proper calculations
          const extendedStartDateStr = extendedStartDate.toISOString().slice(0, 10);

          // Check if this is an STL writer that needs duration filtering
          const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL", "Steven Abreu"];
          const isSTLWriter = stlWriters.includes(writerName);

          let viewCountsQuery;
          if (isSTLWriter) {
            console.log(`🎬 STL Writer detected: ${writerName} - applying duration filter (>189 seconds)`);
            viewCountsQuery = `
              SELECT
                video_id,
                DATE(snapshot_date) as date_day,
                statistics_view_count,
                DATE(snippet_published_at) as published_date,
                content_details_duration
              FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
              WHERE video_id IN UNNEST(@video_ids)
                AND DATE(snapshot_date) BETWEEN @extended_start_date AND @end_date
                ${useBigQuery && useInfluxDB ? `AND DATE(snapshot_date) <= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)` : ''}
                AND content_details_duration IS NOT NULL
                AND (
                  -- Parse PT format duration to seconds and filter >189 seconds
                  CASE
                    WHEN REGEXP_CONTAINS(content_details_duration, r'^PT(\\d+)H(\\d+)M(\\d+)S$') THEN
                      CAST(REGEXP_EXTRACT(content_details_duration, r'^PT(\\d+)H') AS INT64) * 3600 +
                      CAST(REGEXP_EXTRACT(content_details_duration, r'H(\\d+)M') AS INT64) * 60 +
                      CAST(REGEXP_EXTRACT(content_details_duration, r'M(\\d+)S$') AS INT64)
                    WHEN REGEXP_CONTAINS(content_details_duration, r'^PT(\\d+)M(\\d+)S$') THEN
                      CAST(REGEXP_EXTRACT(content_details_duration, r'^PT(\\d+)M') AS INT64) * 60 +
                      CAST(REGEXP_EXTRACT(content_details_duration, r'M(\\d+)S$') AS INT64)
                    WHEN REGEXP_CONTAINS(content_details_duration, r'^PT(\\d+)S$') THEN
                      CAST(REGEXP_EXTRACT(content_details_duration, r'^PT(\\d+)S$') AS INT64)
                    WHEN REGEXP_CONTAINS(content_details_duration, r'^PT(\\d+)H(\\d+)S$') THEN
                      CAST(REGEXP_EXTRACT(content_details_duration, r'^PT(\\d+)H') AS INT64) * 3600 +
                      CAST(REGEXP_EXTRACT(content_details_duration, r'H(\\d+)S$') AS INT64)
                    WHEN REGEXP_CONTAINS(content_details_duration, r'^PT(\\d+)H$') THEN
                      CAST(REGEXP_EXTRACT(content_details_duration, r'^PT(\\d+)H$') AS INT64) * 3600
                    WHEN REGEXP_CONTAINS(content_details_duration, r'^PT(\\d+)M$') THEN
                      CAST(REGEXP_EXTRACT(content_details_duration, r'^PT(\\d+)M$') AS INT64) * 60
                    ELSE 0
                  END > 189
                )
              ORDER BY video_id, snapshot_date
            `;
          } else {
            console.log(`📊 Regular writer: ${writerName} - no duration filtering`);
            viewCountsQuery = `
              SELECT
                video_id,
                DATE(snapshot_date) as date_day,
                statistics_view_count,
                DATE(snippet_published_at) as published_date
              FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
              WHERE video_id IN UNNEST(@video_ids)
                AND DATE(snapshot_date) BETWEEN @extended_start_date AND @end_date
                ${useBigQuery && useInfluxDB ? `AND DATE(snapshot_date) <= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)` : ''}
              ORDER BY video_id, snapshot_date
            `;
          }

          console.log('🔍 Step 4: Getting daily view counts from youtube_metadata_historical');
          console.log(`🔍 Using extended date range: ${extendedStartDateStr} to ${finalBigQueryEndDate} (extended by 7 days for daily increase calculations)`);
          const [viewCountsResult] = await bigquery.query({
            query: viewCountsQuery,
            params: {
              video_ids: videoIds,
              extended_start_date: extendedStartDateStr,
              end_date: finalBigQueryEndDate
            }
          });

          console.log(`📊 Retrieved ${viewCountsResult.length} view count records`);

          // Step 5: Calculate daily increases for each video (current metadata)
          const dailyTotals = new Map();

          // Group by video_id and calculate increases
          const videoGroups = new Map();
          viewCountsResult.forEach(row => {
            const videoId = row.video_id;
            if (!videoGroups.has(videoId)) {
              videoGroups.set(videoId, []);
            }
            videoGroups.get(videoId).push({
              date: row.date_day.value, // BigQuery DATE type
              views: parseInt(row.statistics_view_count),
              publishedDate: row.published_date ? row.published_date.value : null
            });
          });

          // Calculate increases for each video
          videoGroups.forEach((records, videoId) => {
            // Sort by date
            records.sort((a, b) => new Date(a.date) - new Date(b.date));

            let previousViews = 0;
            records.forEach((record, index) => {
              const dateStr = record.date;
              const currentViews = record.views;
              const publishedDate = record.publishedDate;

              if (index === 0) {
                // First day: check if it's within 2 days of publish date
                let useFirstDay = false;

                if (publishedDate) {
                  const firstDataDate = new Date(dateStr);
                  const publishDate = new Date(publishedDate);
                  const daysDifference = Math.abs((firstDataDate - publishDate) / (1000 * 60 * 60 * 24));

                  if (daysDifference <= 2) {
                    useFirstDay = true;
                    console.log(`📅 Video ${videoId}: First day data (${dateStr}) is within ${daysDifference.toFixed(1)} days of publish date (${publishedDate}), keeping first day views: ${currentViews}`);
                  } else {
                    console.log(`📅 Video ${videoId}: First day data (${dateStr}) is ${daysDifference.toFixed(1)} days after publish date (${publishedDate}), skipping first day`);
                  }
                } else {
                  console.log(`📅 Video ${videoId}: No publish date available, skipping first day`);
                }

                if (useFirstDay) {
                  // Use first day views as-is (it's a legitimate first day)
                  const dailyIncrease = currentViews;

                  if (!dailyTotals.has(dateStr)) {
                    dailyTotals.set(dateStr, { total_views: 0, unique_videos: new Set() });
                  }
                  dailyTotals.get(dateStr).total_views += dailyIncrease;
                  dailyTotals.get(dateStr).unique_videos.add(videoId);
                }

                previousViews = currentViews;
                return;
              }

              // From second day onwards: calculate increase from previous day
              const dailyIncrease = Math.max(0, currentViews - previousViews);

              // Add to daily totals
              if (!dailyTotals.has(dateStr)) {
                dailyTotals.set(dateStr, { total_views: 0, unique_videos: new Set() });
              }
              dailyTotals.get(dateStr).total_views += dailyIncrease;
              dailyTotals.get(dateStr).unique_videos.add(videoId);

              previousViews = currentViews;
            });
          });

          // Step 6: Fill missing dates in the requested range with historical data
          console.log('🔄 Step 6: Filling missing dates with historical data');

          // Create a complete list of dates in the requested range
          const requestedDates = [];
          const startDate = new Date(finalStartDate);
          const endDate = new Date(finalBigQueryEndDate);

          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            requestedDates.push(d.toISOString().slice(0, 10));
          }

          console.log(`📅 Requested date range: ${finalStartDate} to ${finalBigQueryEndDate} (${requestedDates.length} days)`);
          console.log(`📅 Current metadata covers ${dailyTotals.size} days`);

          // For each requested date, check if we have data, if not try historical data
          requestedDates.forEach(dateStr => {
            if (!dailyTotals.has(dateStr)) {
              // Missing date - check if we have historical data for this date
              if (historicalDailyTotals.has(dateStr)) {
                const totalViews = historicalDailyTotals.get(dateStr);
                dailyTotals.set(dateStr, {
                  total_views: totalViews,
                  unique_videos: new Set(['historical_data']) // Placeholder since we don't have video count
                });
                console.log(`📅 Gap filled: ${dateStr} = ${totalViews.toLocaleString()} views (from historical_video_metadata_past)`);
              } else {
                console.log(`📅 Missing: ${dateStr} - no data in either source`);
              }
            } else {
              console.log(`📅 Present: ${dateStr} = ${dailyTotals.get(dateStr).total_views.toLocaleString()} views (from youtube_metadata_historical)`);
            }
          });

          // Step 7: Add hardcoded supplement data for specific writers during gap period
          console.log('🔄 Step 7: Adding hardcoded supplement data for gap period');

          // Hardcoded data for writers 135 (Benni Taylor) and 78 (Grace) during Oct 23-26, 2025
          const hardcodedSupplementData = [
            // Benni Taylor (writer_id: 135)
            { writer_id: 135, date: '2025-10-23', views: 4654 },
            { writer_id: 135, date: '2025-10-24', views: 9051 },
            { writer_id: 135, date: '2025-10-25', views: 7901 },
            { writer_id: 135, date: '2025-10-26', views: 4197 },
            { writer_id: 135, date: '2025-10-23', views: 4487 },
            { writer_id: 135, date: '2025-10-24', views: 6694 },
            { writer_id: 135, date: '2025-10-25', views: 7978 },
            { writer_id: 135, date: '2025-10-26', views: 7134 },
            { writer_id: 135, date: '2025-10-23', views: 8999 },
            { writer_id: 135, date: '2025-10-24', views: 5093 },
            { writer_id: 135, date: '2025-10-25', views: 1846 },
            { writer_id: 135, date: '2025-10-26', views: 1261 },
            { writer_id: 135, date: '2025-10-23', views: 10912 },
            { writer_id: 135, date: '2025-10-24', views: 8999 },
            { writer_id: 135, date: '2025-10-25', views: 60957 },
            { writer_id: 135, date: '2025-10-26', views: 180337 },
            // Grace (writer_id: 78)
            { writer_id: 78, date: '2025-10-23', views: 12044 },
            { writer_id: 78, date: '2025-10-24', views: 1193 },
            { writer_id: 78, date: '2025-10-25', views: 4970 },
            { writer_id: 78, date: '2025-10-26', views: 35665 },
            { writer_id: 78, date: '2025-10-23', views: 7261 },
            { writer_id: 78, date: '2025-10-24', views: 2107 },
            { writer_id: 78, date: '2025-10-25', views: 1002 },
            { writer_id: 78, date: '2025-10-26', views: 433 }
          ];

          // Check if current writer needs supplement data
          const currentWriterId = parseInt(writerId);
          const writerSupplementData = hardcodedSupplementData.filter(item => item.writer_id === currentWriterId);

          if (writerSupplementData.length > 0) {
            console.log(`📊 Adding hardcoded supplement data for writer ${currentWriterId} (${writerSupplementData.length} entries)`);

            // Group supplement data by date and sum views
            const supplementByDate = new Map();
            writerSupplementData.forEach(item => {
              if (!supplementByDate.has(item.date)) {
                supplementByDate.set(item.date, 0);
              }
              supplementByDate.set(item.date, supplementByDate.get(item.date) + item.views);
            });

            // Add supplement data to dailyTotals
            supplementByDate.forEach((supplementViews, dateStr) => {
              if (dailyTotals.has(dateStr)) {
                // Add to existing data
                const existing = dailyTotals.get(dateStr);
                existing.total_views += supplementViews;
                existing.unique_videos.add('hardcoded_supplement');
                console.log(`📊 Supplement added: ${dateStr} += ${supplementViews.toLocaleString()} views (total now: ${existing.total_views.toLocaleString()})`);
              } else {
                // Create new entry for this date
                dailyTotals.set(dateStr, {
                  total_views: supplementViews,
                  unique_videos: new Set(['hardcoded_supplement'])
                });
                console.log(`📊 Supplement created: ${dateStr} = ${supplementViews.toLocaleString()} views (new entry)`);
              }
            });
          } else {
            console.log(`📊 No hardcoded supplement data needed for writer ${currentWriterId}`);
          }

          // Convert to array format expected by the rest of the function
          // CRITICAL FIX: Only include dates within the target range in final output
          dailyTotalsRows = Array.from(dailyTotals.entries())
            .filter(([dateStr, data]) => {
              const date = new Date(dateStr);
              const startDate = new Date(finalStartDate);
              const endDate = new Date(finalBigQueryEndDate);
              return date >= startDate && date <= endDate;
            })
            .map(([dateStr, data]) => ({
              date_string: dateStr,
              total_views: data.total_views,
              unique_videos: data.unique_videos.size
            }))
            .sort((a, b) => new Date(b.date_string) - new Date(a.date_string));

          console.log(`📊 NEW APPROACH: Calculated ${dailyTotalsRows.length} daily totals (${historicalDailyTotals.size} from historical, ${dailyTotals.size - historicalDailyTotals.size} from current metadata)`);
        }

      } catch (bigQueryError) {
        console.error('❌ FIXED APPROACH BigQuery error:', bigQueryError);
        // Fallback to empty array if new approach fails
        dailyTotalsRows = [];
      }
    }

    console.log('✅ FIXED APPROACH: Total views per day calculation completed successfully');
    console.log(`📋 Total Views Per Day (${dailyTotalsRows.length} days):`);
    console.table(dailyTotalsRows);

    // ——— Summary stats from TOTAL VIEWS PER DAY ———
    const totalViews   = dailyTotalsRows.reduce((sum, r) => sum + parseInt(r.total_views, 10), 0);
    const uniqueVideos = dailyTotalsRows.reduce((sum, r) => sum + parseInt(r.unique_videos, 10), 0);
    const uniqueDates  = dailyTotalsRows.length;
    console.log('📊 Summary from FIXED APPROACH (Total Views Per Day):');
    console.log(`   Daily Total Rows: ${dailyTotalsRows.length}`);
    console.log(`   Total Views: ${totalViews.toLocaleString()}`);
    console.log(`   Unique Videos:        ${uniqueVideos}`);
    console.log(`   Unique Dates:         ${uniqueDates}`);

    console.log('🎯 FIXED APPROACH: TOTAL VIEWS PER DAY PROCESSING COMPLETED SUCCESSFULLY!');
    console.log('🚀 REACHED INFLUXDB SECTION - About to start InfluxDB integration...');

    // ———————————————— 6) COMMENTED OUT: InfluxDB data (now only used for real-time bar chart) ————————————————
    const influxData = [];
    // COMMENTED OUT: InfluxDB data fetching for line chart
    if (false && useInfluxDB) {
      try {
        console.log('📊 Fetching InfluxDB data for real-time data...');
        console.log('📊 About to initialize InfluxDB service...');
        const InfluxService = require('../services/influxService');
        const influx = new InfluxService();
        console.log('📊 InfluxDB service initialized successfully');

        // Determine the range for InfluxDB based on the request
        let influxRange = '3d'; // default
        if (!useBigQuery) {
          // If only using InfluxDB, calculate the range from the custom dates
          const startDate = new Date(finalStartDate);
          const endDate = new Date(finalEndDate);
          const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
          influxRange = `${daysDiff}d`;
          console.log(`📊 InfluxDB-only mode: using ${influxRange} range for custom dates ${finalStartDate} to ${finalEndDate}`);
        }

        // Use the existing getDashboardAnalytics method
        const hourlyData = await influx.getDashboardAnalytics(influxRange, writerId);
        console.log(`📊 InfluxDB returned ${hourlyData.length} daily data points`);

        // Filter InfluxDB data using the calculated start date
        const influxFilterStartDate = useBigQuery ?
          // If using both sources, use the calculated InfluxDB start date
          finalInfluxStartDate :
          // If InfluxDB only, use the user's start date
          finalStartDate;

        console.log(`📊 InfluxDB date filtering: start=${influxFilterStartDate}, end=${finalEndDate}`);

        hourlyData.forEach(point => {
          const estDate = point.date.toISOString().split('T')[0]; // YYYY-MM-DD format

          // Include dates from InfluxDB start date to end date
          if (estDate >= influxFilterStartDate && estDate <= finalEndDate) {
            influxData.push({
              date: estDate,
              views: point.views,
              source: 'InfluxDB_RealTime'
            });
          }
        });

        // Sort by date
        influxData.sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`📊 InfluxDB daily aggregates (EST, filtered):`, influxData);

      } catch (err) {
        console.error('❌ InfluxDB error in getBigQueryAnalyticsOverview:', err.message);
        console.error('❌ InfluxDB error stack:', err.stack);
      }
    }

    // ———————————————— 6) Transform DAILY TOTALS data for frontend ————————————————
    // Use DAILY TOTALS BigQuery data for chart (solid lines)
    // FORMAT_DATE returns a string, no timezone conversion needed!
    const dailyTotalsData = dailyTotalsRows.map(row => ({
      time: row.date_string, // FORMAT_DATE string, no timezone issues!
      views: parseInt(row.total_views || 0),
      unique_videos: parseInt(row.unique_videos || 0),
      source: 'BigQuery'
    }));

    // COMMENTED OUT: InfluxDB real-time data (dotted lines) - now only used for real-time bar chart
    // influxData.forEach(item => {
    //   dailyTotalsData.push({
    //     time: item.date,
    //     views: item.views,
    //     source: 'InfluxDB'
    //   });
    // });

    // Sort by date
    dailyTotalsData.sort((a, b) => new Date(a.time) - new Date(b.time));

    // Calculate chart data for frontend - DAILY TOTALS data points
    const chartData = dailyTotalsData.map(item => ({
      date: item.time,
      views: item.views,
      formattedDate: new Date(item.time).toLocaleDateString(),
      unique_videos: item.unique_videos || 0,
      source: item.source
    }));

    // Calculate final total views including fallback data
    const finalTotalViews = dailyTotalsData.reduce((sum, item) => sum + item.views, 0);

    console.log(`📊 Analytics Overview complete: ${dailyTotalsData.length} data points`);
    console.log(`📊 Final total views (BigQuery + InfluxDB): ${finalTotalViews.toLocaleString()}`);
    console.log(`📊 BigQuery total views: ${totalViews.toLocaleString()}`);
    console.log(`📊 InfluxDB data points: ${influxData.length}`);

    // Get total submissions count for this writer from BigQuery (videos posted in timeframe)
    let totalSubmissionsCount = 0; // default fallback
    console.log(`🔍 DEBUG: About to query total submissions for writer ${writerId} - LOGIC: Posted in timeframe (snippet_published_at)`);

    try {
      const totalSubmissionsQuery = `
        SELECT COUNT(DISTINCT video_id) as total_count
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_name = @writer_name
          AND writer_name IS NOT NULL
          AND snippet_published_at IS NOT NULL
          AND DATE(snippet_published_at) >= @start_date
          AND DATE(snippet_published_at) <= @end_date
      `;

      console.log(`🔍 DEBUG: Executing total submissions query for writer ${writerName}, date range: ${finalStartDate} to ${finalEndDate}`);
      const [totalSubmissionsResult] = await bigquery.query({
        query: totalSubmissionsQuery,
        params: {
          writer_name: writerName,
          start_date: finalStartDate,
          end_date: finalEndDate
        }
      });
      console.log(`🔍 DEBUG: Submissions query result:`, totalSubmissionsResult);

      if (totalSubmissionsResult.length > 0) {
        const rawCount = totalSubmissionsResult[0].total_count;
        totalSubmissionsCount = parseInt(rawCount) || 0;
        console.log(`📊 Total submissions posted in timeframe for writer ${writerName}: ${totalSubmissionsCount} (raw: ${rawCount}, ${finalStartDate} to ${finalEndDate})`);
      } else {
        console.log(`⚠️ No rows returned from total submissions query for writer ${writerName}`);
      }
    } catch (totalSubmissionsError) {
      console.error('❌ Error getting total submissions count from BigQuery:', totalSubmissionsError);
    }

    // Get video performance breakdown (posted in time frame with different view thresholds) from BigQuery
    let megaViralsCount = 0;
    let viralsCount = 0;
    let almostViralsCount = 0;
    let decentVideosCount = 0;
    let flopsCount = 0;
    console.log(`🔥 DEBUG: About to query video performance breakdown for writer ${writerId} - LOGIC: Posted in timeframe with view thresholds`);

    try {
      // Check if this is an STL writer with different thresholds
      const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL", "Steven Abreu"];
      const isSTLWriter = stlWriters.includes(writerName);

      console.log(`🔍 Writer: ${writerName}, Is STL Writer: ${isSTLWriter}`);

      const performanceQuery = `
        WITH video_metadata AS (
          SELECT DISTINCT
            video_id,
            writer_name,
            snippet_published_at,
            CAST(statistics_view_count AS INT64) as current_views
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
          WHERE writer_name = @writer_name
            AND writer_name IS NOT NULL
            AND statistics_view_count IS NOT NULL
            AND CAST(statistics_view_count AS INT64) > 0
            AND snippet_published_at IS NOT NULL
            AND DATE(snippet_published_at) >= @start_date
            AND DATE(snippet_published_at) <= @end_date
            ${isSTLWriter ? `
            AND (
              CASE
                WHEN REGEXP_CONTAINS(content_details_duration, r'PT(\\d+)M(\\d+)S') THEN
                  CAST(REGEXP_EXTRACT(content_details_duration, r'PT(\\d+)M') AS INT64) * 60 +
                  CAST(REGEXP_EXTRACT(content_details_duration, r'M(\\d+)S') AS INT64)
                WHEN REGEXP_CONTAINS(content_details_duration, r'PT(\\d+)S') THEN
                  CAST(REGEXP_EXTRACT(content_details_duration, r'PT(\\d+)S') AS INT64)
                WHEN REGEXP_CONTAINS(content_details_duration, r'PT(\\d+)M') THEN
                  CAST(REGEXP_EXTRACT(content_details_duration, r'PT(\\d+)M') AS INT64) * 60
                ELSE 0
              END
            ) < 190
            ` : ''}
        ),
        latest_views AS (
          SELECT
            video_id,
            MAX(current_views) as max_views
          FROM video_metadata
          GROUP BY video_id
        )
        SELECT
          ${isSTLWriter ? `
          COUNT(CASE WHEN max_views >= 1500000 THEN 1 END) as mega_virals_count,
          COUNT(CASE WHEN max_views >= 500000 AND max_views < 1500000 THEN 1 END) as virals_count,
          COUNT(CASE WHEN max_views >= 250000 AND max_views < 500000 THEN 1 END) as almost_virals_count,
          COUNT(CASE WHEN max_views >= 50000 AND max_views < 250000 THEN 1 END) as decent_videos_count,
          COUNT(CASE WHEN max_views < 50000 THEN 1 END) as flops_count
          ` : `
          COUNT(CASE WHEN max_views >= 3000000 THEN 1 END) as mega_virals_count,
          COUNT(CASE WHEN max_views >= 1000000 AND max_views < 3000000 THEN 1 END) as virals_count,
          COUNT(CASE WHEN max_views >= 500000 AND max_views < 1000000 THEN 1 END) as almost_virals_count,
          COUNT(CASE WHEN max_views >= 100000 AND max_views < 500000 THEN 1 END) as decent_videos_count,
          COUNT(CASE WHEN max_views < 100000 THEN 1 END) as flops_count
          `}
        FROM latest_views
      `;

      console.log(`🔥 DEBUG: Executing performance breakdown query for writer ${writerName}, date range: ${finalStartDate} to ${finalEndDate}`);
      const [performanceResult] = await bigquery.query({
        query: performanceQuery,
        params: {
          writer_name: writerName,
          start_date: finalStartDate,
          end_date: finalEndDate
        }
      });
      console.log(`🔥 DEBUG: Performance breakdown query result:`, performanceResult);

      if (performanceResult.length > 0) {
        const result = performanceResult[0];
        megaViralsCount = parseInt(result.mega_virals_count) || 0;
        viralsCount = parseInt(result.virals_count) || 0;
        almostViralsCount = parseInt(result.almost_virals_count) || 0;
        decentVideosCount = parseInt(result.decent_videos_count) || 0;
        flopsCount = parseInt(result.flops_count) || 0;

        console.log(`🔥 Video performance breakdown for writer ${writerName}:`);
        console.log(`   📈 Mega Virals (3M+): ${megaViralsCount}`);
        console.log(`   🔥 Virals (1M-3M): ${viralsCount}`);
        console.log(`   ⚡ Almost Virals (500K-1M): ${almostViralsCount}`);
        console.log(`   👍 Decent Videos (100K-500K): ${decentVideosCount}`);
        console.log(`   💔 Flops (<100K): ${flopsCount}`);
      } else {
        console.log(`⚠️ No rows returned from performance breakdown query for writer ${writerName}`);
      }
    } catch (performanceError) {
      console.error('❌ Error getting video performance breakdown from BigQuery:', performanceError);
    }

    // Calculate hit rate percentages
    const calculatePercentage = (count, total) => {
      if (total === 0) return 0;
      return Math.round((count / total) * 100 * 10) / 10; // Round to 1 decimal place
    };

    const megaViralsPercentage = calculatePercentage(megaViralsCount, totalSubmissionsCount);
    const viralsPercentage = calculatePercentage(viralsCount, totalSubmissionsCount);
    const almostViralsPercentage = calculatePercentage(almostViralsCount, totalSubmissionsCount);
    const decentVideosPercentage = calculatePercentage(decentVideosCount, totalSubmissionsCount);
    const flopsPercentage = calculatePercentage(flopsCount, totalSubmissionsCount);

    console.log(`📊 Hit Rate Percentages for writer ${writerName}:`);
    console.log(`   📈 Mega Virals: ${megaViralsCount}/${totalSubmissionsCount} (${megaViralsPercentage}%)`);
    console.log(`   🔥 Virals: ${viralsCount}/${totalSubmissionsCount} (${viralsPercentage}%)`);
    console.log(`   ⚡ Almost Virals: ${almostViralsCount}/${totalSubmissionsCount} (${almostViralsPercentage}%)`);
    console.log(`   👍 Decent Videos: ${decentVideosCount}/${totalSubmissionsCount} (${decentVideosPercentage}%)`);
    console.log(`   💔 Flops: ${flopsCount}/${totalSubmissionsCount} (${flopsPercentage}%)`);

    // ———————————————— 7.5) Get video details for each category ————————————————
    let categoryVideos = {
      megaVirals: [],
      virals: [],
      almostVirals: [],
      decentVideos: [],
      flops: []
    };

    try {
      console.log(`🎬 Getting video details for each category for writer ${writerName}`);

      // Check if this is an STL writer with different thresholds
      const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL", "Steven Abreu"];
      const isSTLWriter = stlWriters.includes(writerName);

      const videoDetailsQuery = `
        WITH video_metadata AS (
          SELECT DISTINCT
            video_id,
            writer_name,
            snippet_published_at,
            CAST(statistics_view_count AS INT64) as current_views
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
          WHERE writer_name = @writer_name
            AND writer_name IS NOT NULL
            AND statistics_view_count IS NOT NULL
            AND CAST(statistics_view_count AS INT64) > 0
            AND snippet_published_at IS NOT NULL
            AND DATE(snippet_published_at) >= @start_date
            AND DATE(snippet_published_at) <= @end_date
            ${isSTLWriter ? `
            AND (
              CASE
                WHEN REGEXP_CONTAINS(content_details_duration, r'PT(\\d+)M(\\d+)S') THEN
                  CAST(REGEXP_EXTRACT(content_details_duration, r'PT(\\d+)M') AS INT64) * 60 +
                  CAST(REGEXP_EXTRACT(content_details_duration, r'M(\\d+)S') AS INT64)
                WHEN REGEXP_CONTAINS(content_details_duration, r'PT(\\d+)S') THEN
                  CAST(REGEXP_EXTRACT(content_details_duration, r'PT(\\d+)S') AS INT64)
                WHEN REGEXP_CONTAINS(content_details_duration, r'PT(\\d+)M') THEN
                  CAST(REGEXP_EXTRACT(content_details_duration, r'PT(\\d+)M') AS INT64) * 60
                ELSE 0
              END
            ) < 190
            ` : ''}
        ),
        latest_views AS (
          SELECT
            video_id,
            MAX(current_views) as max_views
          FROM video_metadata
          GROUP BY video_id
        ),
        video_with_trello AS (
          SELECT
            lv.video_id,
            lv.max_views,
            v.trello_card_id,
            CASE
              ${isSTLWriter ? `
              WHEN lv.max_views >= 1500000 THEN 'megaVirals'
              WHEN lv.max_views >= 500000 AND lv.max_views < 1500000 THEN 'virals'
              WHEN lv.max_views >= 250000 AND lv.max_views < 500000 THEN 'almostVirals'
              WHEN lv.max_views >= 50000 AND lv.max_views < 250000 THEN 'decentVideos'
              ELSE 'flops'
              ` : `
              WHEN lv.max_views >= 3000000 THEN 'megaVirals'
              WHEN lv.max_views >= 1000000 AND lv.max_views < 3000000 THEN 'virals'
              WHEN lv.max_views >= 500000 AND lv.max_views < 1000000 THEN 'almostVirals'
              WHEN lv.max_views >= 100000 AND lv.max_views < 500000 THEN 'decentVideos'
              ELSE 'flops'
              `}
            END as category
          FROM latest_views lv
          LEFT JOIN \`speedy-web-461014-g3.postgres.video\` v
            ON v.url LIKE CONCAT('%', lv.video_id, '%')
        )
        SELECT
          vt.video_id,
          vt.max_views as views,
          vt.category,
          s.google_doc_link,
          s.ai_chat_url
        FROM video_with_trello vt
        LEFT JOIN \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
          ON s.trello_card_id = vt.trello_card_id
        ORDER BY vt.max_views DESC
      `;

      const [videoDetailsResult] = await bigquery.query({
        query: videoDetailsQuery,
        params: {
          writer_name: writerName,
          start_date: finalStartDate,
          end_date: finalEndDate
        }
      });

      console.log(`🎬 Found ${videoDetailsResult.length} videos with details`);

      // Group videos by category
      videoDetailsResult.forEach(row => {
        const category = row.category;
        if (categoryVideos[category]) {
          categoryVideos[category].push({
            video_id: row.video_id,
            views: parseInt(row.views),
            google_doc_link: row.google_doc_link,
            ai_chat_url: row.ai_chat_url
          });
        }
      });

      console.log(`🎬 Video details by category:`);
      console.log(`   📈 Mega Virals: ${categoryVideos.megaVirals.length} videos`);
      console.log(`   🔥 Virals: ${categoryVideos.virals.length} videos`);
      console.log(`   ⚡ Almost Virals: ${categoryVideos.almostVirals.length} videos`);
      console.log(`   👍 Decent Videos: ${categoryVideos.decentVideos.length} videos`);
      console.log(`   💔 Flops: ${categoryVideos.flops.length} videos`);

    } catch (videoDetailsError) {
      console.error('❌ Error getting video details by category:', videoDetailsError);
    }

    // ———————————————— 8) Calculate SHORTS ONLY views for STL writers ————————————————
    let shortsOnlyViews = 0; // Default to 0 for non-STL writers
    let totalAllViews = finalTotalViews; // Default to current total views (long videos for STL)

    // Check if this is an STL writer that needs shorts calculation
    const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL", "Steven Abreu"];
    const isSTLWriter = stlWriters.includes(writerName);

    if (isSTLWriter) {
      console.log(`🎬 STL Writer detected: ${writerName} - will calculate from chart data`);

      // For STL writers, we'll calculate the totals from the chart data
      // after it's generated (see below after chart calculation)
      console.log(`🎬 STL ${writerName}: Deferring calculation until chart data is ready`);
    }

    // ———————————————— 9) Calculate STL totals from chart data ————————————————
    if (isSTLWriter && chartData && chartData.length > 0) {
      // IMPORTANT: For STL writers, chartData contains LONG videos (>189s) only due to the query filter
      // The frontend will show:
      // - Blue line = "Long Videos" (chartData - videos >189s)
      // - Orange line = "Shorts Videos" (shortsData - videos ≤189s)
      // - Tooltip total = blue + orange combined

      const chartTotalViews = chartData.reduce((sum, day) => sum + (day.views || 0), 0);

      // For STL writers:
      // - shortsOnlyViews = will be calculated from shortsData in frontend (≤189s)
      // - totalAllViews = shorts + longs combined from chart data
      // - chartTotalViews = long videos only (>189s) - this is what blue line shows

      shortsOnlyViews = 0; // Will be calculated from shortsData in frontend

      // For STL writers, defer calculation until split data is available
      console.log(`🎬 STL ${writerName}: Deferring calculation until chart data is ready`);

      // Use chart total for now, will be updated later with split data
      totalAllViews = chartTotalViews;
    }

    // ———————————————— 10) Return frontend-compatible DAILY TOTALS data ————————————————
    return {
      totalViews: isSTLWriter ? totalAllViews : finalTotalViews, // For STL: shorts+longs combined, for others: current logic
      longViews: isSTLWriter ? chartData.reduce((sum, day) => sum + (day.views || 0), 0) : finalTotalViews, // For STL: long videos only (>189s), for others: all
      shortsViews: shortsOnlyViews, // For STL: will be calculated from shortsData in frontend (≤189s)
      isSTLWriter: isSTLWriter, // Flag to tell frontend this is an STL writer
      chartData: chartData,
      aggregatedViewsData: dailyTotalsData, // Use daily totals data as QA script shows
      avgDailyViews: dailyTotalsData.length > 0 ? Math.round(finalTotalViews / dailyTotalsData.length) : 0,
      totalSubmissions: totalSubmissionsCount, // Add total submissions to the return data
      // Video performance breakdown with counts
      megaViralsCount: megaViralsCount, // 3M+ views
      viralsCount: viralsCount, // 1M-3M views
      almostViralsCount: almostViralsCount, // 500K-1M views
      decentVideosCount: decentVideosCount, // 100K-500K views
      flopsCount: flopsCount, // <100K views
      // Video performance breakdown with percentages (hit rates)
      megaViralsPercentage: megaViralsPercentage,
      viralsPercentage: viralsPercentage,
      almostViralsPercentage: almostViralsPercentage,
      decentVideosPercentage: decentVideosPercentage,
      flopsPercentage: flopsPercentage,
      // Video details for each category (video_id and views)
      categoryVideos: categoryVideos,
      summary: {
        progressToTarget: (finalTotalViews / 100000000) * 100,
        highestDay: dailyTotalsData.length > 0 ? Math.max(...dailyTotalsData.map(d => d.views)) : 0,
        lowestDay: dailyTotalsData.length > 0 ? Math.min(...dailyTotalsData.map(d => d.views)) : 0
      },
      metadata: {
        source: 'BigQuery youtube_video_report_historical (confirmed YouTube Analytics data)',
        dataSource: 'BigQuery: all historical data from YouTube Analytics',
        lastUpdated: new Date().toISOString(),
        range: range,
        bigQueryIntegrated: true,
        influxDBIntegrated: false,
        tableUsed: 'youtube_video_report_historical',
        influxDBDays: 0
      },
      // Keep raw data for debugging
      rawViews: rawViewsRows,
      dailyTotals: dailyTotalsRows,
      influxData: [] // Always empty since InfluxDB is disabled
    };
  }
  catch (err) {
    console.error('❌ Analytics overview error:', err);
    throw err;
  }
}

// Example Express endpoint
router.get('/analytics-overview', async (req, res) => {
  try {
    const { writerId, range, limit } = req.query;
    const result = await getBigQueryAnalyticsOverview(writerId, range, null, parseInt(limit) || 100);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test endpoint without auth for debugging
router.get('/test-overview', async (req, res) => {
  try {
    // Mock user data for testing - find the correct login_id for writer_id=110
    console.log('🧪 Test overview endpoint called');

    // First, find the login_id for writer_id=110
    const writerQuery = `SELECT login_id FROM writer WHERE id = 110`;
    const writerResult = await pool.query(writerQuery);

    let userId = 1; // default fallback
    if (writerResult.rows.length > 0) {
      userId = writerResult.rows[0].login_id;
      console.log(`✅ Found login_id ${userId} for writer_id 110`);
    } else {
      console.log('⚠️ No login_id found for writer_id 110, using default user id 1');
    }

    req.user = { id: userId };
    req.query = { range: '30d', ...req.query };

    // Call the main analytics logic
    return await handleAnalyticsRequest(req, res);
  } catch (error) {
    console.error('❌ Test overview error:', error);
    res.status(500).json({ message: 'Test overview error', error: error.message });
  }
});

// Direct test endpoint for writer_id=110
router.get('/test-writer-110', async (req, res) => {
  try {
    console.log('🧪 Direct test for writer_id=110');

    const writerId = 110;
    const range = '30d';

    // Get writer name
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    const writerName = writerRows[0]?.name || 'Unknown Writer';

    console.log(`📝 Testing with writer: ${writerName} (ID: ${writerId})`);

    // Call our analytics function directly
    const analyticsData = await getBigQueryAnalyticsOverview(writerId, range, writerName);

    console.log('✅ Direct test successful:', {
      totalViews: analyticsData.totalViews,
      chartDataPoints: analyticsData.chartData?.length || 0,
      aggregatedViewsDataPoints: analyticsData.aggregatedViewsData?.length || 0
    });

    res.json(analyticsData);
  } catch (error) {
    console.error('❌ Direct test error:', error);
    res.status(500).json({ message: 'Direct test error', error: error.message, stack: error.stack });
  }
});

// Debug endpoint to check raw InfluxDB data
router.get('/debug-influx-raw', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Checking raw InfluxDB data');

    const writerId = 110;
    const range = '7d'; // Use shorter range for debugging

    // Get writer name
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    const writerName = writerRows[0]?.name || 'Unknown Writer';

    console.log(`🔍 DEBUG: Writer: ${writerName} (ID: ${writerId})`);

    // Check if InfluxDB service is available
    const InfluxService = require('../services/influxService');
    const influxService = new InfluxService();

    if (!influxService) {
      return res.json({ error: 'InfluxDB service not available' });
    }

    console.log(`🔍 DEBUG: Getting InfluxDB data for range: ${range}`);

    // Get both total views and daily analytics
    const [totalViews, dailyAnalytics] = await Promise.all([
      influxService.getTotalViews(range, writerId),
      influxService.getDashboardAnalytics(range, writerId)
    ]);

    console.log(`🔍 DEBUG: InfluxDB total views: ${totalViews}`);
    console.log(`🔍 DEBUG: InfluxDB daily analytics: ${dailyAnalytics.length} records`);

    // Transform daily analytics for debugging
    const transformedDaily = dailyAnalytics.map(day => ({
      date: new Date(day.date).toISOString().split('T')[0],
      views: day.views,
      rawDate: day.date
    }));

    console.log(`🔍 DEBUG: Sample daily data:`, transformedDaily.slice(0, 3));

    // Calculate total from daily data
    const calculatedTotal = transformedDaily.reduce((sum, day) => sum + day.views, 0);

    res.json({
      success: true,
      writer: { id: writerId, name: writerName },
      range: range,
      influxTotalViews: totalViews,
      dailyAnalyticsCount: dailyAnalytics.length,
      dailyAnalytics: transformedDaily,
      calculatedTotalFromDaily: calculatedTotal,
      discrepancy: Math.abs(totalViews - calculatedTotal),
      sampleRawDaily: dailyAnalytics.slice(0, 3)
    });

  } catch (error) {
    console.error('🔍 DEBUG: Error in InfluxDB debug endpoint:', error);
    res.status(500).json({
      error: 'InfluxDB debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Debug endpoint to check raw BigQuery data
router.get('/debug-bigquery-raw', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Checking raw BigQuery data');

    const writerId = 110;
    const range = '7d'; // Use shorter range for debugging

    // Get writer name
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    const writerName = writerRows[0]?.name || 'Unknown Writer';

    console.log(`🔍 DEBUG: Writer: ${writerName} (ID: ${writerId})`);

    if (!bigquery) {
      return res.json({ error: 'BigQuery client not initialized' });
    }

    // Calculate date range
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    const startDateStr = startDate.toISOString().split('T')[0];

    console.log(`🔍 DEBUG: Date range: ${startDateStr} to ${endDate}`);

    // Raw BigQuery query
    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const analyticsDataset = process.env.BIGQUERY_ANALYTICS_DATASET || "dbt_youtube_analytics";
    const analyticsTable = process.env.BIGQUERY_ANALYTICS_TABLE || "youtube_metadata_historical";

    const bigQueryQuery = `
      SELECT
        snapshot_date AS time,
        SUM(CAST(statistics_view_count AS INT64)) AS views
      FROM \`${projectId}.${analyticsDataset}.${analyticsTable}\`
      WHERE writer_id = @writer_id
        AND DATE(snapshot_date) BETWEEN @start_date AND @end_date
        AND writer_id IS NOT NULL
        AND statistics_view_count IS NOT NULL
      GROUP BY snapshot_date
      ORDER BY snapshot_date ASC;
    `;

    console.log(`🔍 DEBUG: Executing BigQuery query:`, bigQueryQuery);
    console.log(`🔍 DEBUG: Query params:`, { writer_id: writerId, start_date: startDateStr, end_date: endDate });

    const [bigQueryRows] = await bigquery.query({
      query: bigQueryQuery,
      params: {
        writer_id: parseInt(writerId),
        start_date: startDateStr,
        end_date: endDate
      }
    });

    console.log(`🔍 DEBUG: BigQuery returned ${bigQueryRows.length} rows`);

    // Show raw data
    // FIX: Convert BigQuery date to string to prevent timezone shifts
    const rawData = bigQueryRows.map(row => ({
      date: row.time.value instanceof Date ?
        row.time.value.toISOString().split('T')[0] :
        row.time.value,
      absoluteViews: parseInt(row.views || 0)
    }));

    console.log(`🔍 DEBUG: Raw BigQuery data:`, rawData);

    // Calculate daily increases
    const dailyIncreases = [];
    for (let i = 0; i < rawData.length; i++) {
      const currentDay = rawData[i];
      let dailyIncrease = 0;

      if (i === 0) {
        // First day - use absolute count as baseline
        dailyIncrease = currentDay.absoluteViews;
        console.log(`🔍 DEBUG: ${currentDay.date} baseline: ${dailyIncrease} views`);
      } else {
        // Subsequent days - calculate increase
        const previousDay = rawData[i - 1];
        dailyIncrease = currentDay.absoluteViews - previousDay.absoluteViews;
        console.log(`🔍 DEBUG: ${currentDay.date}: ${currentDay.absoluteViews} - ${previousDay.absoluteViews} = ${dailyIncrease} increase`);
      }

      dailyIncreases.push({
        date: currentDay.date,
        absoluteViews: currentDay.absoluteViews,
        dailyIncrease: Math.max(0, dailyIncrease)
      });
    }

    const totalViews = dailyIncreases.reduce((sum, day) => sum + day.dailyIncrease, 0);

    console.log(`🔍 DEBUG: Total views calculated: ${totalViews.toLocaleString()}`);

    res.json({
      success: true,
      writer: { id: writerId, name: writerName },
      dateRange: { start: startDateStr, end: endDate },
      rawBigQueryRows: bigQueryRows.length,
      rawData: rawData,
      dailyIncreases: dailyIncreases,
      totalViews: totalViews,
      avgDailyViews: dailyIncreases.length > 0 ? Math.round(totalViews / dailyIncreases.length) : 0
    });

  } catch (error) {
    console.error('🔍 DEBUG: Error in debug endpoint:', error);
    res.status(500).json({
      error: 'Debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Debug endpoint to compare all data sources
router.get('/debug-data-comparison', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Comparing all data sources');

    const writerId = 110;
    const range = '7d';

    // Get writer name
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    const writerName = writerRows[0]?.name || 'Unknown Writer';

    console.log(`🔍 DEBUG: Comparing data for writer: ${writerName} (ID: ${writerId})`);

    const results = {
      writer: { id: writerId, name: writerName },
      range: range,
      influxData: null,
      bigQueryData: null,
      combinedData: null,
      errors: []
    };

    // 1. Test InfluxDB
    try {
      const InfluxService = require('../services/influxService');
      const influxService = new InfluxService();

      const [influxTotal, influxDaily] = await Promise.all([
        influxService.getTotalViews(range, writerId),
        influxService.getDashboardAnalytics(range, writerId)
      ]);

      const influxTransformed = influxDaily.map(day => ({
        date: new Date(day.date).toISOString().split('T')[0],
        views: day.views
      }));

      results.influxData = {
        totalViews: influxTotal,
        dailyCount: influxDaily.length,
        dailyData: influxTransformed,
        calculatedTotal: influxTransformed.reduce((sum, day) => sum + day.views, 0)
      };

      console.log(`🔍 DEBUG: InfluxDB - Total: ${influxTotal}, Daily records: ${influxDaily.length}`);

    } catch (influxError) {
      console.error('🔍 DEBUG: InfluxDB error:', influxError);
      results.errors.push(`InfluxDB: ${influxError.message}`);
    }

    // 2. Test BigQuery
    try {
      if (bigquery) {
        const today = new Date();
        const endDate = today.toISOString().split('T')[0];
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        const startDateStr = startDate.toISOString().split('T')[0];

        const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
        const analyticsDataset = process.env.BIGQUERY_ANALYTICS_DATASET || "dbt_youtube_analytics";
        const analyticsTable = process.env.BIGQUERY_ANALYTICS_TABLE || "youtube_metadata_historical";

        const bigQueryQuery = `
          SELECT
            snapshot_date AS time,
            SUM(CAST(statistics_view_count AS INT64)) AS views
          FROM \`${projectId}.${analyticsDataset}.${analyticsTable}\`
          WHERE writer_id = @writer_id
            AND DATE(snapshot_date) BETWEEN @start_date AND @end_date
            AND writer_id IS NOT NULL
            AND statistics_view_count IS NOT NULL
          GROUP BY snapshot_date
          ORDER BY snapshot_date ASC;
        `;

        const [bigQueryRows] = await bigquery.query({
          query: bigQueryQuery,
          params: {
            writer_id: parseInt(writerId),
            start_date: startDateStr,
            end_date: endDate
          }
        });

        const bigQueryRaw = bigQueryRows.map(row => ({
          date: row.time.value instanceof Date ?
            row.time.value.toISOString().split('T')[0] :
            row.time.value,
          absoluteViews: parseInt(row.views || 0)
        }));

        // Calculate daily increases
        const bigQueryIncreases = [];
        for (let i = 0; i < bigQueryRaw.length; i++) {
          const currentDay = bigQueryRaw[i];
          let dailyIncrease = 0;

          if (i === 0) {
            dailyIncrease = currentDay.absoluteViews; // This is the problem!
          } else {
            const previousDay = bigQueryRaw[i - 1];
            dailyIncrease = currentDay.absoluteViews - previousDay.absoluteViews;
          }

          bigQueryIncreases.push({
            date: currentDay.date,
            absoluteViews: currentDay.absoluteViews,
            dailyIncrease: Math.max(0, dailyIncrease)
          });
        }

        results.bigQueryData = {
          rawCount: bigQueryRows.length,
          rawData: bigQueryRaw,
          increasesData: bigQueryIncreases,
          totalFromIncreases: bigQueryIncreases.reduce((sum, day) => sum + day.dailyIncrease, 0),
          firstDayProblem: bigQueryIncreases.length > 0 ? bigQueryIncreases[0].dailyIncrease : 0
        };

        console.log(`🔍 DEBUG: BigQuery - Raw records: ${bigQueryRows.length}, First day increase: ${results.bigQueryData.firstDayProblem}`);

      } else {
        results.errors.push('BigQuery: Client not initialized');
      }

    } catch (bigQueryError) {
      console.error('🔍 DEBUG: BigQuery error:', bigQueryError);
      results.errors.push(`BigQuery: ${bigQueryError.message}`);
    }

    // 3. Test combined analytics function
    try {
      const analyticsData = await getBigQueryAnalyticsOverview(writerId, range, writerName);

      results.combinedData = {
        totalViews: analyticsData.totalViews,
        chartDataCount: analyticsData.chartData?.length || 0,
        aggregatedDataCount: analyticsData.aggregatedViewsData?.length || 0,
        sampleChartData: analyticsData.chartData?.slice(0, 3) || [],
        sampleAggregatedData: analyticsData.aggregatedViewsData?.slice(0, 3) || []
      };

      console.log(`🔍 DEBUG: Combined function - Total: ${analyticsData.totalViews}, Chart points: ${analyticsData.chartData?.length}`);

    } catch (combinedError) {
      console.error('🔍 DEBUG: Combined function error:', combinedError);
      results.errors.push(`Combined: ${combinedError.message}`);
    }

    res.json(results);

  } catch (error) {
    console.error('🔍 DEBUG: Error in data comparison endpoint:', error);
    res.status(500).json({
      error: 'Data comparison endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Quick data analysis endpoint for past 30 days including June 5th
router.get('/debug-30days-june5', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Analyzing 30 days including June 5th');

    const writerId = 110;
    const endDate = '2025-06-05'; // June 5th
    const startDate = '2025-05-06'; // 30 days before

    // Get writer info
    const writerQuery = `SELECT id, name, login_id FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);

    if (writerRows.length === 0) {
      return res.json({ error: `Writer ${writerId} not found` });
    }

    const writer = writerRows[0];
    console.log(`📝 Analyzing writer: ${writer.name} (ID: ${writer.id})`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    const results = {
      writer: writer,
      dateRange: { start: startDate, end: endDate },
      influxData: null,
      bigQueryData: null,
      errors: []
    };

    // 1. InfluxDB Data
    try {
      const InfluxService = require('../services/influxService');
      const influxService = new InfluxService();

      // Calculate time range for InfluxDB
      const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
      const timeRange = `${daysDiff + 5}d`;

      console.log(`🔍 InfluxDB time range: ${timeRange}`);

      const [influxTotal, influxDaily] = await Promise.all([
        influxService.getTotalViews(timeRange, writerId),
        influxService.getDashboardAnalytics(timeRange, writerId)
      ]);

      // Filter to exact date range and transform
      const filteredDaily = influxDaily
        .map(day => ({
          date: new Date(day.date).toISOString().split('T')[0],
          views: day.views,
          rawDate: day.date
        }))
        .filter(day => day.date >= startDate && day.date <= endDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const calculatedTotal = filteredDaily.reduce((sum, day) => sum + day.views, 0);

      results.influxData = {
        totalViews: influxTotal,
        dailyRecords: filteredDaily.length,
        dailyData: filteredDaily.slice(0, 10), // First 10 days for display
        calculatedTotal: calculatedTotal,
        avgDaily: filteredDaily.length > 0 ? Math.round(calculatedTotal / filteredDaily.length) : 0,
        firstDay: filteredDaily[0] || null,
        lastDay: filteredDaily[filteredDaily.length - 1] || null
      };

      console.log(`📊 InfluxDB: ${influxTotal.toLocaleString()} total, ${filteredDaily.length} daily records`);

    } catch (influxError) {
      console.error('❌ InfluxDB error:', influxError);
      results.errors.push(`InfluxDB: ${influxError.message}`);
    }

    // 2. BigQuery Data
    try {
      if (bigquery) {
        const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
        const dataset = "dbt_youtube_analytics";
        const table = "youtube_metadata_historical";

        const bigQueryQuery = `
          SELECT
            snapshot_date AS time,
            SUM(CAST(statistics_view_count AS INT64)) AS views
          FROM \`${projectId}.${dataset}.${table}\`
          WHERE writer_id = @writer_id
            AND DATE(snapshot_date) BETWEEN @start_date AND @end_date
            AND writer_id IS NOT NULL
            AND statistics_view_count IS NOT NULL
          GROUP BY snapshot_date
          ORDER BY snapshot_date ASC;
        `;

        console.log(`🔍 BigQuery query for writer ${writerId}, ${startDate} to ${endDate}`);

        const [bigQueryRows] = await bigquery.query({
          query: bigQueryQuery,
          params: {
            writer_id: parseInt(writerId),
            start_date: startDate,
            end_date: endDate
          }
        });

        const bigQueryRaw = bigQueryRows.map(row => ({
          date: row.time.value instanceof Date ?
            row.time.value.toISOString().split('T')[0] :
            row.time.value,
          absoluteViews: parseInt(row.views || 0)
        }));

        // Calculate daily increases (showing the problem)
        const bigQueryIncreases = [];
        for (let i = 0; i < bigQueryRaw.length; i++) {
          const currentDay = bigQueryRaw[i];
          let dailyIncrease = 0;

          if (i === 0) {
            // THIS IS THE PROBLEM!
            dailyIncrease = currentDay.absoluteViews;
            console.log(`🚨 FIRST DAY PROBLEM: Using ${currentDay.absoluteViews.toLocaleString()} as daily increase!`);
          } else {
            const previousDay = bigQueryRaw[i - 1];
            dailyIncrease = currentDay.absoluteViews - previousDay.absoluteViews;
          }

          bigQueryIncreases.push({
            date: currentDay.date,
            absoluteViews: currentDay.absoluteViews,
            dailyIncrease: Math.max(0, dailyIncrease),
            isFirstDay: i === 0
          });
        }

        const totalFromIncreases = bigQueryIncreases.reduce((sum, day) => sum + day.dailyIncrease, 0);

        results.bigQueryData = {
          rawRecords: bigQueryRows.length,
          rawData: bigQueryRaw.slice(0, 5), // First 5 for display
          increasesData: bigQueryIncreases.slice(0, 10), // First 10 for display
          totalFromIncreases: totalFromIncreases,
          firstDayProblem: bigQueryIncreases.length > 0 ? bigQueryIncreases[0].dailyIncrease : 0,
          firstDay: bigQueryIncreases[0] || null,
          lastDay: bigQueryIncreases[bigQueryIncreases.length - 1] || null
        };

        console.log(`📊 BigQuery: ${bigQueryRows.length} records, total from increases: ${totalFromIncreases.toLocaleString()}`);
        console.log(`🚨 First day problem: ${results.bigQueryData.firstDayProblem.toLocaleString()}`);

      } else {
        results.errors.push('BigQuery: Not available');
      }

    } catch (bigQueryError) {
      console.error('❌ BigQuery error:', bigQueryError);
      results.errors.push(`BigQuery: ${bigQueryError.message}`);
    }

    // Summary
    if (results.influxData && results.bigQueryData) {
      results.comparison = {
        influxTotal: results.influxData.calculatedTotal,
        bigQueryTotal: results.bigQueryData.totalFromIncreases,
        difference: Math.abs(results.influxData.calculatedTotal - results.bigQueryData.totalFromIncreases),
        ratio: results.bigQueryData.totalFromIncreases / results.influxData.calculatedTotal,
        firstDayIssue: results.bigQueryData.firstDayProblem
      };

      console.log(`🔍 COMPARISON:`);
      console.log(`   InfluxDB: ${results.comparison.influxTotal.toLocaleString()}`);
      console.log(`   BigQuery: ${results.comparison.bigQueryTotal.toLocaleString()}`);
      console.log(`   Ratio: ${results.comparison.ratio.toFixed(2)}x`);
      console.log(`   First Day Issue: ${results.comparison.firstDayIssue.toLocaleString()}`);
    }

    res.json(results);

  } catch (error) {
    console.error('🔍 DEBUG: Error in 30-day analysis:', error);
    res.status(500).json({
      error: '30-day analysis error',
      message: error.message
    });
  }
});

// Clear Redis cache endpoint for debugging (no auth for testing)
router.get('/clear-cache-debug', async (req, res) => {
  try {
    const redisService = global.redisService;
    if (redisService && redisService.isAvailable()) {
      // Clear all analytics cache
      await redisService.clearPattern('analytics:*');
      console.log('✅ Cleared all analytics cache (debug endpoint)');
      res.json({ success: true, message: 'Analytics cache cleared via debug endpoint' });
    } else {
      res.json({ success: false, message: 'Redis not available' });
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Clear Redis cache endpoint for debugging
router.get('/clear-cache', authenticateToken, async (req, res) => {
  try {
    const redisService = global.redisService;
    if (redisService && redisService.isAvailable()) {
      // Clear all analytics cache
      await redisService.clearPattern('analytics:*');
      console.log('✅ Cleared all analytics cache');
      res.json({ success: true, message: 'Analytics cache cleared' });
    } else {
      res.json({ success: false, message: 'Redis not available' });
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Get analytics data with BigQuery
router.get('/', authenticateToken, async (req, res) => {
  return await handleAnalyticsRequest(req, res);
});

// Handle video details requests using same auth as main analytics
async function handleVideoDetailsRequest(req, res) {
  try {
    const { category, startDate, endDate } = req.query;

    console.log(`🔍 Video details request: category=${category}, startDate=${startDate}, endDate=${endDate}`);

    if (!category || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: category, startDate, endDate'
      });
    }

    // Get writer info from token (same as main analytics)
    const writerId = req.user?.writerId || req.user?.userId;
    if (!writerId) {
      return res.status(401).json({
        success: false,
        message: 'Writer ID not found in token'
      });
    }

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    if (writerRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Writer not found'
      });
    }
    const writerName = writerRows[0].name;

    // Check if this is an STL writer with different thresholds
    const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL", "Steven Abreu"];
    const isSTLWriter = stlWriters.includes(writerName);

    console.log(`🔍 Video Details - Writer: ${writerName}, Is STL Writer: ${isSTLWriter}`);

    // Define view thresholds for each category - using same logic as counts
    const categoryConditions = isSTLWriter ? {
      megaVirals: 'max_views >= 1500000',
      virals: 'max_views >= 500000 AND max_views < 1500000',
      almostVirals: 'max_views >= 250000 AND max_views < 500000',
      decentVideos: 'max_views >= 50000 AND max_views < 250000',
      flops: 'max_views < 50000'
    } : {
      megaVirals: 'max_views >= 3000000',
      virals: 'max_views >= 1000000 AND max_views < 3000000',
      almostVirals: 'max_views >= 500000 AND max_views < 1000000',
      decentVideos: 'max_views >= 100000 AND max_views < 500000',
      flops: 'max_views < 100000'
    };

    const condition = categoryConditions[category];
    if (!condition) {
      return res.status(400).json({
        success: false,
        message: `Invalid category: ${category}`
      });
    }

    // Use SAME query logic as the counts - from youtube_metadata_historical
    const query = `
      WITH video_metadata AS (
        SELECT DISTINCT
          video_id,
          writer_name,
          snippet_published_at,
          snippet_title,
          snippet_thumbnails,
          CAST(statistics_view_count AS INT64) as current_views
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_name = @writer_name
          AND writer_name IS NOT NULL
          AND statistics_view_count IS NOT NULL
          AND CAST(statistics_view_count AS INT64) > 0
          AND snippet_published_at IS NOT NULL
          AND DATE(snippet_published_at) >= @start_date
          AND DATE(snippet_published_at) <= @end_date
      ),
      latest_views AS (
        SELECT
          video_id,
          snippet_published_at,
          snippet_title,
          snippet_thumbnails,
          MAX(current_views) as max_views
        FROM video_metadata
        GROUP BY video_id, snippet_published_at, snippet_title, snippet_thumbnails
      ),
      filtered_videos AS (
        SELECT *
        FROM latest_views
        WHERE ${condition}
      )
      SELECT
        fv.video_id,
        fv.max_views as views,
        fv.snippet_title as title,
        fv.snippet_published_at as published_date,
        fv.snippet_thumbnails,
        0 as last_day_views,
        CONCAT('https://www.youtube.com/watch?v=', fv.video_id) as url
      FROM filtered_videos fv
      ORDER BY fv.max_views DESC
      LIMIT 50
    `;

    console.log(`🔍 Executing video details query for category: ${category}, writer: ${writerName}`);

    const options = {
      query: query,
      params: {
        writer_name: writerName,
        start_date: startDate,
        end_date: endDate
      }
    };

    const [rows] = await bigQueryClient.query(options);

    console.log(`📊 Video details query returned ${rows.length} videos for category ${category}`);

    const videos = rows.map(row => ({
      video_id: row.video_id,
      views: row.views,
      title: row.title,
      published_date: row.published_date,
      snippet_thumbnails: row.snippet_thumbnails,
      last_day_views: row.last_day_views,
      url: row.url
    }));

    return res.status(200).json({
      success: true,
      data: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('❌ Video details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch video details',
      error: error.message
    });
  }
}

// Main analytics logic (extracted for reuse)
async function handleAnalyticsRequest(req, res) {
  try {
    console.log('🔥 OVERVIEW ENDPOINT CALLED! Query params:', req.query);

    // Video details are now embedded in the main analytics response
    // No separate handling needed

    let { range = '30d', start_date, end_date } = req.query;

    let writerId = req.user.writerId || req.user.userId;

    // Check if this is a custom date range
    let customStartDate = null;
    let customEndDate = null;

    if (range.startsWith('custom_')) {
      // Parse custom date range from format: custom_2025-06-03_2025-06-06
      const parts = range.split('_');
      if (parts.length === 3) {
        customStartDate = parts[1];
        customEndDate = parts[2];
        range = 'custom';
        console.log(`📅 Parsed custom date range: ${customStartDate} to ${customEndDate}`);
      }
    } else if (start_date && end_date) {
      // Handle direct start_date and end_date parameters
      customStartDate = start_date;
      customEndDate = end_date;
      range = 'custom';
      console.log(`📅 Using direct custom date range: ${customStartDate} to ${customEndDate}`);
    }

    // Enhanced frontend time ranges mapping with dynamic date calculation
    const timeRangeMap = {
      'last7days': '7d',
      'last30days': '30d',
      'last90days': '90d',
      'last365days': '365d',
      'lifetime': 'lifetime',
      '2025': 'year_2025',
      '2024': 'year_2024',
      'may': 'month_may',
      'april': 'month_april',
      'march': 'march_march',
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
      'custom': 'custom'
    };

    range = timeRangeMap[range] || '30d';
    const userId = req.user.id;

    console.log('📊 Getting analytics for user ID:', userId, 'Range:', range);

    // Get writer information from PostgreSQL (get both ID and name)
    // writerId already declared above for caching
    let writerName = null;
    try {
      const writerQuery = `
        SELECT w.id as writer_id, w.name as writer_name
        FROM writer w
        WHERE w.login_id = $1
      `;
      const writerResult = await pool.query(writerQuery, [userId]);
      if (writerResult.rows.length > 0) {
        writerId = writerResult.rows[0].writer_id;
        writerName = writerResult.rows[0].writer_name;
        console.log('✅ Found writer:', { id: writerId, name: writerName }, 'for user:', userId);
      } else {
        console.log('⚠️ No writer found for user:', userId);
      }
    } catch (dbError) {
      console.error('❌ Error getting writer info:', dbError);
    }

    // Calculate actual date range for cache key (same logic as in getBigQueryAnalyticsOverview)
    let actualStartDate, actualEndDate;
    if (customStartDate && customEndDate) {
      actualStartDate = customStartDate;
      actualEndDate = customEndDate;
    } else {
      // Calculate predefined range dates
      const endDate = new Date();
      const startDate = new Date();
      let days;
      switch (range) {
        case '7d':       days = 7;   break;
        case 'lifetime': days = 365; break;
        default:         days = 30;  break;
      }
      startDate.setDate(endDate.getDate() - days);
      actualStartDate = startDate.toISOString().slice(0, 10);
      actualEndDate = endDate.toISOString().slice(0, 10);
    }

    console.log(`📅 Cache key will use actual dates: ${actualStartDate} → ${actualEndDate}`);

    // Check Redis cache after we have the correct writerId and actual dates
    const redisService = global.redisService;
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `analytics:overview:v10:writer:${writerId}:range:${range}:start:${actualStartDate}:end:${actualEndDate}`;
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached analytics overview data');
        console.log('🔍 DEBUG: Cached data includes viralsCount?', cachedData.viralsCount !== undefined ? `YES (${cachedData.viralsCount})` : 'NO');
        return res.json(cachedData);
      } else {
        console.log('❌ Cache MISS for key:', cacheKey);
      }
    }

    if (writerId) {
      try {
        console.log('🔥 About to call getBigQueryAnalyticsOverview with params:', {
          writerId,
          range,
          writerName,
          limit: 100,
          customStartDate,
          customEndDate
        });

        // Check if this writer should get shorts/long split
        const splitWriters = [1001, 1002, 1004, 130, 136, 131];
        const shouldSplitByType = splitWriters.includes(parseInt(writerId));

        // Use BigQuery for analytics overview with writer name from PostgreSQL
        const analyticsData = await getBigQueryAnalyticsOverview(
          writerId,
          range,
          writerName,
          100,
          customStartDate,
          customEndDate
        );

        // Check if this is an STL writer for special calculation
        const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL"];
        const isSTLWriter = stlWriters.includes(writerName);

        // If this writer should get split data, add shorts/longs breakdown
        if (shouldSplitByType) {
          console.log(`📊 Adding shorts/longs split for writer ${writerId}`);

          // Calculate date range for split data
          let splitStartDate, splitEndDate;
          if (customStartDate && customEndDate) {
            splitStartDate = customStartDate;
            splitEndDate = customEndDate;
          } else {
            // Calculate predefined range dates
            const endDate = new Date();
            const startDate = new Date();
            let days;
            switch (range) {
              case '7d': days = 7; break;
              case '30d': days = 30; break;
              case '90d': days = 90; break;
              case '1y': days = 365; break;
              default: days = 30;
            }
            startDate.setDate(endDate.getDate() - days);
            splitStartDate = startDate.toISOString().split('T')[0];
            splitEndDate = endDate.toISOString().split('T')[0];
          }

          try {
            const splitData = await getBigQueryViews(writerId, splitStartDate, splitEndDate);

            if (splitData && splitData.shorts && splitData.longs) {
              console.log(`📊 Split data retrieved: ${splitData.shorts.length} shorts points, ${splitData.longs.length} longs points`);

              // Add split data to analytics response
              analyticsData.shortsData = splitData.shorts.map(item => ({
                date: item.time.value,
                views: item.views,
                formattedDate: new Date(item.time.value).toLocaleDateString(),
                source: item.source
              }));

              analyticsData.longsData = splitData.longs.map(item => ({
                date: item.time.value,
                views: item.views,
                formattedDate: new Date(item.time.value).toLocaleDateString(),
                source: item.source
              }));

              analyticsData.hasSplitData = true;

              // For STL writers, recalculate totals using split data
              if (isSTLWriter) {
                const shortsTotal = splitData.shorts.reduce((sum, day) => sum + (day.views || 0), 0);
                const longsTotal = splitData.longs.reduce((sum, day) => sum + (day.views || 0), 0);
                const combinedTotal = shortsTotal + longsTotal;

                // Update analytics data with correct totals
                analyticsData.totalViews = combinedTotal; // SHORTS + LONG card
                analyticsData.longViews = longsTotal; // SHORTS VIEWS card (actually long videos)

                console.log(`🎬 STL ${writerName}: Recalculated with split data`);
                console.log(`🎬 STL ${writerName}: SHORTS views (orange line) = ${shortsTotal.toLocaleString()}`);
                console.log(`🎬 STL ${writerName}: LONG views (blue line) = ${longsTotal.toLocaleString()}`);
                console.log(`🎬 STL ${writerName}: COMBINED total (SHORTS + LONG card) = ${combinedTotal.toLocaleString()}`);
              }

              console.log(`📊 Added split data to analytics response`);
            }
          } catch (splitError) {
            console.warn(`⚠️ Failed to get split data for writer ${writerId}:`, splitError.message);
            analyticsData.hasSplitData = false;
          }
        }

        console.log('📊 BigQuery analytics data sent:', {
          totalViews: analyticsData.totalViews,
          totalSubmissions: analyticsData.totalSubmissions,
          megaViralsCount: analyticsData.megaViralsCount,
          viralsCount: analyticsData.viralsCount,
          almostViralsCount: analyticsData.almostViralsCount,
          decentVideosCount: analyticsData.decentVideosCount,
          flopsCount: analyticsData.flopsCount,
          topVideosCount: analyticsData.topVideos?.length || 0,
          hasLatestContent: !!analyticsData.latestContent,
          range: analyticsData.range,
          customDateRange: customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : null
        });

        // Cache the response data using actual dates with custom TTL
        if (redisService && redisService.isAvailable()) {
          const cacheKey = `analytics:overview:v10:writer:${writerId}:range:${range}:start:${actualStartDate}:end:${actualEndDate}`;

          // Calculate TTL to expire at 10:36:46 AM UTC+5:30 (6 minutes after 10:30:46 AM)
          const calculateCustomTTL = () => {
            const now = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000; // UTC+5:30 in milliseconds
            const nowIST = new Date(now.getTime() + istOffset);

            // Target time: 10:36:46 AM IST (6 minutes after 10:30:46 AM)
            const targetTime = new Date(nowIST);
            targetTime.setHours(10, 36, 46, 0);

            // If target time has passed today, set for tomorrow
            if (nowIST >= targetTime) {
              targetTime.setDate(targetTime.getDate() + 1);
            }

            // Calculate seconds until target time
            const ttlMs = targetTime.getTime() - nowIST.getTime();
            const ttlSeconds = Math.floor(ttlMs / 1000);

            console.log(`🕐 Cache will expire at: ${targetTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
            console.log(`⏱️ TTL set to: ${ttlSeconds} seconds (${Math.floor(ttlSeconds / 3600)}h ${Math.floor((ttlSeconds % 3600) / 60)}m)`);

            return Math.max(ttlSeconds, 60); // Minimum 1 minute TTL
          };

          const customTTL = calculateCustomTTL();
          await redisService.set(cacheKey, analyticsData, customTTL);
          console.log('✅ Cached analytics overview data with custom daily expiration:', {
            megaVirals: analyticsData.megaViralsCount,
            virals: analyticsData.viralsCount,
            almostVirals: analyticsData.almostViralsCount,
            decent: analyticsData.decentVideosCount,
            flops: analyticsData.flopsCount
          });
        }

        res.json(analyticsData);
        return;

      } catch (bigQueryError) {
        console.error('❌ BigQuery error in analytics overview:', bigQueryError);
        console.error('❌ BigQuery error details:', bigQueryError.message);
        console.error('❌ BigQuery error stack:', bigQueryError.stack);

        // Return error response instead of fallback
        return res.status(500).json({
          error: 'BigQuery analytics data unavailable',
          message: 'Unable to fetch analytics data from BigQuery',
          details: bigQueryError.message
        });
      }
    }

    // Fallback to dummy data if InfluxDB fails
    const dummyData = {
      // Don't include totalViews here - let channel endpoint handle it
      totalSubmissions: 15,
      acceptedSubmissions: 8,
      rejectedSubmissions: 4,
      pendingSubmissions: 3,
      acceptanceRate: 53.3,
      monthlySubmissions: [
        { month: 'Jan', submissions: 2, accepted: 1 },
        { month: 'Feb', submissions: 3, accepted: 2 },
        { month: 'Mar', submissions: 4, accepted: 2 },
        { month: 'Apr', submissions: 6, accepted: 3 }
      ],
      submissionsByType: [
        { type: 'Trope', count: 8 },
        { type: 'Original', count: 5 },
        { type: 'TLDR', count: 2 }
      ],
      recentActivity: [
        { date: '2025-04-20', action: 'Submission created', title: '[STL] test test do not edit this' },
        { date: '2025-04-15', action: 'Submission created', title: '[Original] My family has a death' },
        { date: '2025-03-16', action: 'Submission accepted', title: '[STL] My boy best friend thinks...' },
        { date: '2025-03-01', action: 'Submission rejected', title: '[STL] testing 123' }
      ]
    };

    res.json(dummyData);
  } catch (error) {
    console.error('❌ Analytics endpoint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Helper function to generate monthly statistics
function generateMonthlyStats(submissions) {
  const monthlyData = {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  submissions.forEach(submission => {
    const date = new Date(submission.submittedOn);
    const monthKey = months[date.getMonth()];

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { month: monthKey, submissions: 0, accepted: 0 };
    }

    monthlyData[monthKey].submissions++;
    if (submission.status === 'Posted') {
      monthlyData[monthKey].accepted++;
    }
  });

  return Object.values(monthlyData);
}

// Get submission statistics by date range
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Dummy filtered statistics
    const stats = {
      period: `${startDate} to ${endDate}`,
      totalSubmissions: 8,
      acceptedSubmissions: 4,
      rejectedSubmissions: 2,
      pendingSubmissions: 2,
      averageResponseTime: '5.2 days',
      topPerformingTypes: [
        { type: 'Trope', acceptanceRate: 60 },
        { type: 'Original', acceptanceRate: 40 },
        { type: 'TLDR', acceptanceRate: 50 }
      ]
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get channel analytics data with real InfluxDB data
router.get('/channel', authenticateToken, async (req, res) => {
  try {
    const { range = 'lifetime' } = req.query;
    console.log('🔥 CHANNEL ENDPOINT CALLED! Query params:', req.query);
    console.log('🔥 User from token:', req.user);

    const userId = req.user.id;

    // Check Redis cache first
    const redisService = global.redisService;
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `channel:analytics:user:${userId}:range:${range}`;
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached channel analytics data');
        return res.json(cachedData);
      }
    }

    // Convert frontend range to InfluxDB range
    const convertRange = (range) => {
      switch (range) {
        case 'last7days': return '7d';
        case 'last28days': return '28d';
        case 'last30days': return '30d';
        case 'last90days': return '90d';
        case 'last365days': return '365d';
        case 'lifetime': return '3y'; // Use 3 years for lifetime
        case '2025': return '150d';
        case '2024': return '365d';
        case 'may': return '31d';
        case 'april': return '30d';
        case 'march': return '31d';
        default: return '30d';
      }
    };

    const influxRange = convertRange(range);
    console.log('🔥 Converted range:', range, '->', influxRange);

    // Get writer information from PostgreSQL
    let writerId = null;
    // userId already declared above for caching
    console.log('🔥 Looking up writer for user ID:', userId);

    try {

      const writerQuery = `
        SELECT w.id as writer_id, w.name as writer_name
        FROM writer w
        WHERE w.login_id = $1
      `;
      console.log('🔥 Executing writer query:', writerQuery, 'with user ID:', userId);
      const writerResult = await pool.query(writerQuery, [userId]);
      console.log('🔥 Writer query result:', writerResult.rows);

      if (writerResult.rows.length > 0) {
        writerId = writerResult.rows[0].writer_id;
        console.log('✅ Found writer ID:', writerId, 'for user:', userId);
      } else {
        console.log('⚠️ No writer found for user:', userId);
        console.log('🔍 Let me check what users exist in the login table...');

        // Debug: Check what users exist
        const debugQuery = 'SELECT id, username FROM login LIMIT 10';
        const debugResult = await pool.query(debugQuery);
        console.log('🔍 Available users in login table:', debugResult.rows);

        // Debug: Check what writers exist
        const writerDebugQuery = 'SELECT id, login_id, name FROM writer LIMIT 10';
        const writerDebugResult = await pool.query(writerDebugQuery);
        console.log('🔍 Available writers:', writerDebugResult.rows);
      }
    } catch (dbError) {
      console.error('❌ Error getting writer ID for channel analytics:', dbError);
    }

    // Get real data from BigQuery for chart data and views, InfluxDB for top videos
    let totalViews = 0;
    let chartData = [];
    let dataSource = 'BigQuery - Real Data';
    let hasDataIssues = false;

    console.log(`🔍 DEBUGGING: Checking BigQuery condition: writerId=${writerId}, bigquery=${!!bigquery}`);

    if (writerId && bigquery) {
      try {
        console.log(`🔍 Getting BigQuery data for writer ${writerId}, range: ${influxRange}`);

        // Convert range to start/end dates for BigQuery
        const endDate = new Date();
        const startDate = new Date();

        switch (influxRange) {
          case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case '28d':
            startDate.setDate(endDate.getDate() - 28);
            break;
          case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
          case '365d':
            startDate.setDate(endDate.getDate() - 365);
            break;
          case '3y':
            startDate.setFullYear(endDate.getFullYear() - 3);
            break;
          default:
            startDate.setDate(endDate.getDate() - 30);
        }

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log(`📊 BigQuery date range: ${startDateStr} to ${endDateStr}`);

        // Get chart data from BigQuery
        const bigQueryData = await getBigQueryViews(writerId, startDateStr, endDateStr, influxService);

        // Transform BigQuery data for chart
        // FIX: Convert BigQuery date to string to prevent timezone shifts
        chartData = bigQueryData.map(row => ({
          date: row.time.value instanceof Date ?
            row.time.value.toISOString().split('T')[0] :
            row.time.value,
          views: row.views,
          timestamp: new Date(row.time.value instanceof Date ?
            row.time.value.toISOString().split('T')[0] :
            row.time.value).getTime()
        })).sort((a, b) => a.timestamp - b.timestamp);

        // Calculate total views
        totalViews = chartData.reduce((sum, day) => sum + day.views, 0);

        console.log(`📊 BigQuery data processed: ${totalViews.toLocaleString()} total views, ${chartData.length} chart points`);
        console.log(`📊 Sample chart data:`, chartData.slice(0, 3));

      } catch (bigQueryError) {
        console.error('❌ BigQuery error for chart data:', bigQueryError);
        hasDataIssues = true;
        dataSource = 'BigQuery Error';

        // Generate minimal fallback data to prevent UI crashes
        const today = new Date();
        chartData = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - (6 - i));
          return {
            date: date.toISOString().split('T')[0],
            views: 0,
            timestamp: date.getTime()
          };
        });
        totalViews = 0;
      }
    } else {
      // If BigQuery is not available, use InfluxDB directly
      console.log(`🔄 BigQuery not available, using InfluxDB directly for writer ${writerId}`);
      if (influxService && writerId) {
        try {
          const [influxTotalViews, influxTotalLikes, influxTotalComments, dailyAnalytics] = await Promise.all([
            influxService.getTotalViews(influxRange, writerId),
            influxService.getTotalLikes(influxRange, writerId),
            influxService.getTotalComments(influxRange, writerId),
            influxService.getDashboardAnalytics(influxRange, writerId)
          ]);

          totalViews = influxTotalViews;
          totalLikes = influxTotalLikes;
          totalComments = influxTotalComments;

          chartData = dailyAnalytics
            .map(day => {
              // Convert InfluxDB UTC time to EST
              const utcDate = new Date(day.date);
              const estDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000)); // UTC-5 for EST
              return {
                date: estDate.toISOString().split('T')[0],
                views: Math.round(day.views),
                timestamp: estDate.getTime()
              };
            })
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter(day => day.views > 0);

          dataSource = 'InfluxDB - Real Data';
          console.log(`📊 InfluxDB data processed: ${totalViews.toLocaleString()} total views, ${totalLikes.toLocaleString()} total likes, ${totalComments.toLocaleString()} total comments, ${chartData.length} chart points`);
          console.log(`📊 Sample chart data:`, chartData.slice(0, 3));
        } catch (influxError) {
          console.error('❌ InfluxDB error:', influxError);
          hasDataIssues = true;
          dataSource = 'No Data Available';
        }
      }
    }

    // Get top videos from BigQuery first, then fallback to InfluxDB
    let topVideos = [];
    if (writerId) {
      try {
        // Try BigQuery first for top videos
        if (bigquery) {
          console.log(`🏆 Getting top videos from BigQuery for writer ${writerId}`);

          // Calculate date range for top videos (same as chart data)
          const topVideosEndDate = new Date();
          const topVideosStartDate = new Date();

          switch (influxRange) {
            case '7d':
              topVideosStartDate.setDate(topVideosEndDate.getDate() - 7);
              break;
            case '28d':
              topVideosStartDate.setDate(topVideosEndDate.getDate() - 28);
              break;
            case '30d':
              topVideosStartDate.setDate(topVideosEndDate.getDate() - 30);
              break;
            case '90d':
              topVideosStartDate.setDate(topVideosEndDate.getDate() - 90);
              break;
            case '365d':
              topVideosStartDate.setDate(topVideosEndDate.getDate() - 365);
              break;
            case '3y':
              topVideosStartDate.setFullYear(topVideosEndDate.getFullYear() - 3);
              break;
            default:
              topVideosStartDate.setDate(topVideosEndDate.getDate() - 30);
          }

          const topVideosStartDateStr = topVideosStartDate.toISOString().split('T')[0];
          const topVideosEndDateStr = topVideosEndDate.toISOString().split('T')[0];

          topVideos = await getBigQueryTopVideos(writerId, topVideosStartDateStr, topVideosEndDateStr, 10);
          console.log(`🏆 BigQuery top videos for writer ${writerId}: ${topVideos.length} records`);
        }

        // Fallback to InfluxDB if BigQuery fails or returns no data
        if (topVideos.length === 0 && influxService) {
          console.log(`🔄 Fallback: Getting top videos from InfluxDB for writer ${writerId}`);
          const allTopVideos = await influxService.getTopVideos(influxRange, 20);

          // Filter by writer and take top 10, then transform to match BigQuery format
          const influxTopVideos = allTopVideos
            .filter(video => video.writer_id == writerId || video.writer_id == writerId.toString())
            .slice(0, 10);

          // Transform InfluxDB data to match VideoAnalytics expected format
          topVideos = influxTopVideos.map((video, index) => ({
            id: video.video_id || `video_${index}`,
            title: video.title || `Video ${video.video_id}`,
            views: parseInt(video.views) || 0,
            likes: Math.floor((video.views || 0) * 0.02), // Estimate 2% like rate
            comments: Math.floor((video.views || 0) * 0.001), // Estimate 0.1% comment rate
            url: video.url,
            preview: video.url ? `https://img.youtube.com/vi/${extractVideoId(video.url)}/maxresdefault.jpg` : "",
            thumbnail: `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`,
            posted_date: new Date().toISOString(),
            type: video.url && video.url.includes('/shorts/') ? 'short' : 'video',
            duration: video.url && video.url.includes('/shorts/') ? '0:30' : '5:00',
            engagement: Math.floor(Math.random() * 15) + 85,
            isShort: video.url && video.url.includes('/shorts/'),
            avgViewDuration: video.url && video.url.includes('/shorts/') ? '0:25' : '2:30',
            account_name: video.account_name || 'Unknown Account', // Include account_name from InfluxDB
            writer_name: video.writer_name || 'Unknown Writer' // Include writer_name from InfluxDB
          }));

          console.log(`🏆 InfluxDB fallback top videos for writer ${writerId}: ${topVideos.length} records`);
        }

        // If still no data, create mock data to ensure UI works
        if (topVideos.length === 0) {
          console.log(`🎬 Creating mock top videos data for writer ${writerId}`);
          topVideos = [
            {
              id: 'mock_1',
              title: 'Children of family vloggers, what\'s the reality behind never seen?',
              views: 2316236,
              likes: Math.floor(2316236 * 0.02),
              comments: Math.floor(2316236 * 0.001),
              url: 'https://www.youtube.com/shorts/PaCJ6ZCxAyI',
              preview: 'https://img.youtube.com/vi/PaCJ6ZCxAyI/maxresdefault.jpg',
              thumbnail: 'https://img.youtube.com/vi/PaCJ6ZCxAyI/mqdefault.jpg',
              posted_date: new Date('2025-05-15').toISOString(),
              type: 'short',
              duration: '0:30',
              engagement: 91,
              isShort: true,
              avgViewDuration: '0:25'
            },
            {
              id: 'mock_2',
              title: 'What types of bad parenting do kids not recover from?',
              views: 1561619,
              likes: Math.floor(1561619 * 0.02),
              comments: Math.floor(1561619 * 0.001),
              url: 'https://www.youtube.com/shorts/UdfSPz1LYek',
              preview: 'https://img.youtube.com/vi/UdfSPz1LYek/maxresdefault.jpg',
              thumbnail: 'https://img.youtube.com/vi/UdfSPz1LYek/mqdefault.jpg',
              posted_date: new Date('2025-05-14').toISOString(),
              type: 'short',
              duration: '0:30',
              engagement: 88,
              isShort: true,
              avgViewDuration: '0:25'
            },
            {
              id: 'mock_3',
              title: 'Parents, what\'s the creepiest thing your child has ever said?',
              views: 1219181,
              likes: Math.floor(1219181 * 0.02),
              comments: Math.floor(1219181 * 0.001),
              url: 'https://www.youtube.com/shorts/xyz123',
              preview: 'https://img.youtube.com/vi/xyz123/maxresdefault.jpg',
              thumbnail: 'https://img.youtube.com/vi/xyz123/mqdefault.jpg',
              posted_date: new Date('2025-05-13').toISOString(),
              type: 'short',
              duration: '0:30',
              engagement: 93,
              isShort: true,
              avgViewDuration: '0:25'
            },
            {
              id: 'mock_4',
              title: 'Single moms, when did you realize you had to cut out?',
              views: 1076414,
              likes: Math.floor(1076414 * 0.02),
              comments: Math.floor(1076414 * 0.001),
              url: 'https://www.youtube.com/shorts/abc456',
              preview: 'https://img.youtube.com/vi/abc456/maxresdefault.jpg',
              thumbnail: 'https://img.youtube.com/vi/abc456/mqdefault.jpg',
              posted_date: new Date('2025-05-12').toISOString(),
              type: 'short',
              duration: '0:30',
              engagement: 87,
              isShort: true,
              avgViewDuration: '0:25'
            },
            {
              id: 'mock_5',
              title: 'What secret would you never tell your family but would?',
              views: 976414,
              likes: Math.floor(976414 * 0.02),
              comments: Math.floor(976414 * 0.001),
              url: 'https://www.youtube.com/shorts/def789',
              preview: 'https://img.youtube.com/vi/def789/maxresdefault.jpg',
              thumbnail: 'https://img.youtube.com/vi/def789/mqdefault.jpg',
              posted_date: new Date('2025-05-11').toISOString(),
              type: 'short',
              duration: '0:30',
              engagement: 89,
              isShort: true,
              avgViewDuration: '0:25'
            }
          ];
          console.log(`🎬 Created ${topVideos.length} mock videos for display`);
        }

        console.log(`🎬 Raw top videos sample:`, topVideos.slice(0, 2).map(v => ({
          video_id: v.id,
          title: v.title,
          views: v.views,
          url: v.url
        })));
      } catch (topVideosError) {
        console.log(`⚠️ Top videos failed:`, topVideosError.message);
        topVideos = [];
      }
    }

    // Calculate performance metrics
    const avgDailyViews = chartData.length > 0 ? Math.floor(totalViews / chartData.length) : 0;
    const highestDay = chartData.length > 0 ? Math.max(...chartData.map(d => d.views)) : 0;
    const lowestDay = chartData.length > 0 ? Math.min(...chartData.map(d => d.views)) : 0;

    // Top videos are already transformed from BigQuery or InfluxDB
    const transformedTopVideos = topVideos;

    // Get latest content (first video from top videos or from PostgreSQL)
    let latestContent = null;
    if (transformedTopVideos.length > 0) {
      // Use the first top video as latest content with complete data structure
      latestContent = {
        ...transformedTopVideos[0],
        engagement: Math.floor(Math.random() * 15 + 5) // Placeholder engagement percentage
      };
    } else {
      // Fallback: Get latest content from PostgreSQL
      try {

        const latestQuery = `
          SELECT url, upload_date
          FROM video
          WHERE writer_id = $1
          ORDER BY upload_date DESC
          LIMIT 1
        `;
        const latestResult = await pool.query(latestQuery, [writerId]);
        if (latestResult.rows.length > 0) {
          const latest = latestResult.rows[0];
          latestContent = {
            id: 'pg_' + Date.now(),
            title: 'Latest Video',
            views: 0, // No view data from PostgreSQL
            type: latest.url && latest.url.includes('/shorts/') ? 'short' : 'video',
            duration: latest.url && latest.url.includes('/shorts/') ? '0:30' : '5:00',
            posted_date: latest.upload_date,
            url: latest.url,
            engagement: 0
          };
          console.log('📺 Latest content from PostgreSQL:', latestContent.title);
        }
      } catch (pgError) {
        console.log('⚠️ Could not get latest content from PostgreSQL:', pgError.message);
      }
    }

    // If still no latest content, create mock latest content
    if (!latestContent) {
      console.log('📺 Creating mock latest content');
      latestContent = {
        id: 'mock_latest',
        title: 'Has your teen ever stolen your business?',
        views: 3500,
        likes: Math.floor(3500 * 0.02),
        comments: Math.floor(3500 * 0.001),
        type: 'short',
        duration: '0:30',
        posted_date: new Date('2025-05-23').toISOString(),
        url: 'https://www.youtube.com/shorts/latest123',
        preview: 'https://img.youtube.com/vi/latest123/maxresdefault.jpg',
        thumbnail: 'https://img.youtube.com/vi/latest123/mqdefault.jpg',
        engagement: 95,
        isShort: true,
        avgViewDuration: '0:25'
      };
    }

    console.log(`🔍 ANALYTICS DATA SUMMARY:`);
    console.log(`   - Data source: ${dataSource}`);
    console.log(`   - Total views: ${totalViews}`);
    console.log(`   - Chart data points: ${chartData.length}`);
    console.log(`   - Top videos: ${transformedTopVideos.length}`);
    console.log(`   - Latest content: ${latestContent ? 'YES' : 'NO'}`);
    console.log(`   - Has data issues: ${hasDataIssues}`);

    // Calculate trend based on recent data
    let trend = 'stable';
    if (chartData.length >= 7) {
      const recentWeek = chartData.slice(-7);
      const previousWeek = chartData.slice(-14, -7);
      if (recentWeek.length > 0 && previousWeek.length > 0) {
        const recentAvg = recentWeek.reduce((sum, day) => sum + day.views, 0) / recentWeek.length;
        const previousAvg = previousWeek.reduce((sum, day) => sum + day.views, 0) / previousWeek.length;
        trend = recentAvg > previousAvg ? 'up' : recentAvg < previousAvg ? 'down' : 'stable';
      }
    }



    const analyticsData = {
      totalViews: totalViews,
      totalLikes: totalLikes || 0,
      totalComments: totalComments || 0,
      avgDailyViews: avgDailyViews,
      hasDataIssues: hasDataIssues,
      dateRange: range,
      chartData: chartData,
      topVideos: transformedTopVideos,
      latestContent: latestContent,

      // Enhanced performance summary
      summary: {
        highestDay: highestDay,
        lowestDay: lowestDay,
        trend: trend,
        progressToTarget: Math.min((totalViews / 100000000) * 100, 100), // Progress to 100M
        totalVideos: transformedTopVideos.length,
        avgViewsPerVideo: transformedTopVideos.length > 0 ? Math.floor(totalViews / transformedTopVideos.length) : 0,
        topVideoViews: transformedTopVideos.length > 0 ? transformedTopVideos[0].views : 0,
        engagementRate: transformedTopVideos.length > 0 ?
          Math.floor(transformedTopVideos.reduce((sum, v) => sum + v.engagement, 0) / transformedTopVideos.length) : 0
      },

      // Performance metrics for dashboard cards
      performance: {
        viewsGrowth: trend === 'up' ? '+12.5%' : trend === 'down' ? '-3.2%' : '0%',
        engagementRate: '8.7%',
        avgWatchTime: '2:45',
        subscriberGrowth: '+5.2%'
      },

      metadata: {
        lastUpdated: new Date().toISOString(),
        dataQuality: hasDataIssues ? 'partial' : 'complete',
        source: dataSource,
        writerId: writerId,
        userId: userId,
        rangeProcessed: influxRange
      }
    };

    console.log('🚀 SENDING HYBRID DATA TO FRONTEND:', JSON.stringify({
      totalViews: analyticsData.totalViews,
      totalLikes: analyticsData.totalLikes,
      totalComments: analyticsData.totalComments,
      avgDailyViews: analyticsData.avgDailyViews,
      chartDataLength: analyticsData.chartData.length,
      topVideosCount: analyticsData.topVideos?.length || 0,
      latestContent: analyticsData.latestContent ? 'YES' : 'NO',
      hasDataIssues: analyticsData.hasDataIssues,
      dataSource: dataSource
    }));

    console.log('🎬 TOP VIDEOS DATA:', analyticsData.topVideos?.slice(0, 3).map(v => ({
      id: v.id,
      title: v.title?.substring(0, 30) + '...',
      views: v.views
    })));

    // Cache the response data
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `channel:analytics:user:${userId}:range:${range}`;
      await redisService.set(cacheKey, analyticsData, 1800); // Cache for 30 minutes
      console.log('✅ Cached channel analytics data');
    }

    res.json(analyticsData);
  } catch (error) {
    console.error('❌ Channel analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get writer views data from BigQuery (for WriterAnalytics component)
router.get('/writer/views', authenticateToken, async (req, res) => {
  try {
    const { writer_id, startDate, endDate } = req.query;

    console.log('📊 BigQuery views endpoint called:', { writer_id, startDate, endDate });

    if (!writer_id || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: writer_id, startDate, endDate'
      });
    }

    // Check Redis cache first
    const redisService = global.redisService;
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `writer:views:${writer_id}:start:${startDate}:end:${endDate}`;
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached writer views data');
        return res.json(cachedData);
      }
    }

    try {
      // Get BigQuery views data
      const bigQueryRows = await getBigQueryViews(writer_id, startDate, endDate, influxService);
      console.log(`📊 BigQuery returned ${bigQueryRows.length} rows for writer ${writer_id}`);

      // Transform data to match WriterAnalytics component format
      // FIX: Convert BigQuery date to string to prevent timezone shifts
      const transformedData = bigQueryRows.map(row => ({
        time: { value: row.time.value instanceof Date ?
          row.time.value.toISOString().split('T')[0] :
          row.time.value },
        views: parseInt(row.views)
      }));

      console.log(`✅ Sending ${transformedData.length} BigQuery data points to WriterAnalytics`);

      // Cache the response data
      if (redisService && redisService.isAvailable()) {
        const cacheKey = `writer:views:${writer_id}:start:${startDate}:end:${endDate}`;
        await redisService.set(cacheKey, transformedData, 1800); // Cache for 30 minutes
        console.log('✅ Cached writer views data (BigQuery)');
      }

      res.json(transformedData);

    } catch (bigQueryError) {
      console.error('❌ BigQuery error in writer/views endpoint:', bigQueryError);

      // Fallback to InfluxDB if BigQuery fails
      if (influxService) {
        console.log('🔄 Falling back to InfluxDB for writer/views');

        // Convert date range to InfluxDB format
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const influxRange = `${daysDiff}d`;

        const dailyAnalytics = await influxService.getDashboardAnalytics(influxRange, writer_id);

        // Transform InfluxDB data to match BigQuery format with UTC to EST conversion
        const fallbackData = dailyAnalytics
          .filter(day => {
            // Convert InfluxDB UTC time to EST for date comparison
            const utcDate = new Date(day.date);
            const estDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000)); // UTC-5 for EST
            const dayDate = estDate.toISOString().split('T')[0];
            return dayDate >= startDate && dayDate <= endDate;
          })
          .map(day => {
            // Convert InfluxDB UTC time to EST
            const utcDate = new Date(day.date);
            const estDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000)); // UTC-5 for EST
            return {
              time: { value: estDate.toISOString().split('T')[0] },
              views: day.views
            };
          });

        console.log(`✅ Sending ${fallbackData.length} InfluxDB fallback data points to WriterAnalytics`);

        // Cache the fallback response data
        if (redisService && redisService.isAvailable()) {
          const cacheKey = `writer:views:${writer_id}:start:${startDate}:end:${endDate}`;
          await redisService.set(cacheKey, fallbackData, 900); // Cache for 15 minutes (shorter for fallback)
          console.log('✅ Cached writer views data (InfluxDB fallback)');
        }

        res.json(fallbackData);
      } else {
        res.status(500).json({ error: 'Both BigQuery and InfluxDB failed' });
      }
    }

  } catch (error) {
    console.error('❌ Writer views endpoint error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Function to get ALL viral videos across all writers (for virals tab)
// FULLY BIGQUERY: Use optimized query with CTEs for video, script, and views data
async function getAllViralVideosAcrossWriters(dateRange, page = 1, limit = 20) {
  try {
    console.log(`🔥 Getting ALL viral videos using optimized BigQuery query, page: ${page}`);

    if (!global.bigqueryClient) {
      console.log('⚠️ BigQuery client not available, falling back to PostgreSQL');
      return await getAllViralVideosPostgreSQL(dateRange, page, limit);
    }

    // Use the optimized query with snippet_published_at and writer_name
    const bigQueryQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        s.google_doc_link,
        s.approval_status,
        s.created_at,
        s.ai_chat_url,
        s.inspiration_link,
        s.core_concept_doc,
        v.url,
        v.writer_id,
        w.name as writer_name,
        meta.snippet_title,
        meta.snippet_channel_title,
        meta.content_details_duration,
        meta.statistics_view_count,
        meta.snippet_published_at,
        meta.thumbnail_url
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta
        ON v.video_id = meta.video_id
      LEFT JOIN \`speedy-web-461014-g3.postgres.writer\` w
        ON v.writer_id = w.id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
      ORDER BY meta.snippet_published_at DESC, CAST(meta.statistics_view_count AS INT64) DESC
      LIMIT @limit OFFSET @offset
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    console.log(`🔍 Executing optimized BigQuery viral videos query with limit: ${limit}, offset: ${offset}`);

    const [rows] = await global.bigqueryClient.query({
      query: bigQueryQuery,
      params: {
        limit: parseInt(limit),
        offset: offset
      }
    });

    console.log(`🔥 BigQuery returned ${rows.length} viral videos`);

    // Get total count using same query structure
    const countQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.statistics_view_count
        FROM (
          SELECT m.video_id, m.statistics_view_count,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as total
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
    `;

    const [countRows] = await global.bigqueryClient.query({
      query: countQuery
    });

    const totalVideos = parseInt(countRows[0].total) || 0;
    console.log(`📊 Total viral videos available: ${totalVideos}`);

    // Format videos for frontend
    const videos = rows.map(row => {
      // Parse the BigQuery timestamp properly
      let formattedDate = null;
      if (row.snippet_published_at && row.snippet_published_at.value) {
        formattedDate = new Date(row.snippet_published_at.value).toISOString();
      } else if (row.snippet_published_at) {
        formattedDate = new Date(row.snippet_published_at).toISOString();
      }

      return {
        id: parseInt(row.writer_id) || Math.floor(Math.random() * 1000000), // Use writer_id as ID for now
        title: row.snippet_title,
        url: row.url,
        writer_id: parseInt(row.writer_id),
        writer_name: row.writer_name,
        views: parseInt(row.statistics_view_count) || 0,
        likes: 0, // Not available in this query
        comments: 0, // Not available in this query
        posted_date: formattedDate, // Use properly formatted date
        preview: row.thumbnail_url || `https://img.youtube.com/vi/${extractVideoId(row.url)}/maxresdefault.jpg`,
        duration: row.content_details_duration || '00:02:30',
        core_concept_doc: row.core_concept_doc,
        type: 'viral'
      };
    });

    return {
      videos,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalVideos / parseInt(limit)),
        totalVideos,
        hasNextPage: parseInt(page) < Math.ceil(totalVideos / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    };

  } catch (error) {
    console.error('❌ BigQuery viral videos error:', error);
    console.log('⚠️ Falling back to PostgreSQL due to BigQuery error');
    return await getAllViralVideosPostgreSQL(dateRange, page, limit);
  }
}

// Fallback PostgreSQL function for viral videos
async function getAllViralVideosPostgreSQL(dateRange, page = 1, limit = 20) {
  try {
    console.log(`🔄 Using PostgreSQL fallback for viral videos, page: ${page}`);

    const postgresQuery = `
      SELECT
        v.id,
        v.url,
        v.script_title AS title,
        v.writer_id,
        w.name as writer_name,
        s.posted_date,
        s.preview,
        s.duration,
        COALESCE(s.likes_total, 0) AS likes_total,
        COALESCE(s.comments_total, 0) AS comments_total,
        COALESCE(s.views_total, 0) AS views_total,
        sc.core_concept_doc
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN writer w ON v.writer_id = w.id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND s.views_total >= 500000
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
      ORDER BY s.views_total DESC
      LIMIT $1 OFFSET $2
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows: postgresRows } = await pool.query(postgresQuery, [parseInt(limit), offset]);
    console.log(`🔥 PostgreSQL returned ${postgresRows.length} viral videos`);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND s.views_total >= 500000
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
    `;

    const { rows: countRows } = await pool.query(countQuery);
    const totalVideos = parseInt(countRows[0].total);

    // Format videos for frontend
    const videos = postgresRows.map(row => ({
      id: row.id,
      title: row.title,
      url: row.url,
      writer_id: row.writer_id,
      writer_name: row.writer_name,
      views: parseInt(row.views_total) || 0,
      likes: parseInt(row.likes_total) || 0,
      comments: parseInt(row.comments_total) || 0,
      posted_date: row.posted_date,
      preview: row.preview,
      duration: row.duration,
      core_concept_doc: row.core_concept_doc,
      type: 'viral'
    }));

    return {
      videos,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalVideos / parseInt(limit)),
        totalVideos,
        hasNextPage: parseInt(page) < Math.ceil(totalVideos / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    };

  } catch (error) {
    console.error('❌ PostgreSQL viral videos fallback error:', error);
    throw error;
  }
}

// Writer videos endpoint for Content page - shows ALL videos from statistics_youtube_api
router.get('/writer/videos', async (req, res) => {
  try {
    const { writer_id, range = '28', page = '1', limit = '20', type = 'all' } = req.query;

    // For virals, allow no writer_id to get ALL viral videos across all writers
    if (!writer_id && type !== 'virals') {
      console.log(`❌ Writer Videos API: Missing writer_id (required for non-virals)`);
      return res.status(400).json({ error: 'missing writer_id' });
    }

    if (type === 'virals' && !writer_id) {
      console.log(`🔥 Writer Videos API: Getting ALL viral videos across all writers, range: ${range}, page: ${page}`);
    } else {
      console.log(`🎬 Writer Videos API: Getting ALL videos for writer ${writer_id}, range: ${range}, page: ${page}, type: ${type}`);
    }

    // Use different function for virals (all writers) vs specific writer
    let result;
    if (type === 'virals' && !writer_id) {
      result = await getAllViralVideosAcrossWriters(range, page, limit);
    } else {
      result = await getPostgresContentVideosWithBigQueryNames(writer_id, range, page, limit, type);
    }

    console.log(`✅ Writer Videos: Found ${result.videos.length} videos for writer ${writer_id}`);
    console.log(`📊 Pagination: Page ${result.pagination.currentPage}/${result.pagination.totalPages}, Total: ${result.pagination.totalVideos}`);

    // Debug: Log video types being returned
    if (result.videos.length > 0) {
      const typeBreakdown = result.videos.reduce((acc, video) => {
        acc[video.type || 'unknown'] = (acc[video.type || 'unknown'] || 0) + 1;
        return acc;
      }, {});
      console.log(`🔍 API Response type breakdown for type='${type}':`, typeBreakdown);
      console.log(`🔍 Sample videos being returned:`, result.videos.slice(0, 3).map(v => ({
        title: v.title?.substring(0, 50),
        type: v.type,
        isShort: v.isShort,
        url: v.url?.substring(0, 50)
      })));
    }

    // Return the data in the format expected by Content.jsx
    res.json({
      videos: result.videos,
      pagination: result.pagination,
      typeCounts: {
        all: result.pagination.totalVideos,
        short: result.videos.filter(v => v.type === 'short').length,
        video: result.videos.filter(v => v.type === 'video').length
      }
    });

  } catch (error) {
    console.error('❌ Writer Videos API error:', error);
    res.status(500).json({ error: 'Error getting writer videos', message: error.message });
  }
});

// Get content/videos data for Content page
router.get('/content', authenticateToken, async (req, res) => {
  try {
    const { range = '30d', type = 'all', limit = 10, sort = 'views' } = req.query;
    const userId = req.user.id;

    console.log('🎬 Getting content data for user ID:', userId, 'Range:', range, 'Type:', type);

    // Check Redis cache first
    const redisService = global.redisService;
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `content:data:user:${userId}:range:${range}:type:${type}:limit:${limit}:sort:${sort}`;
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached content data');
        return res.json(cachedData);
      }
    }

    // Get writer information from PostgreSQL
    let writerId = null;
    try {

      const writerQuery = `
        SELECT w.id as writer_id
        FROM writer w
        WHERE w.login_id = $1
      `;
      const writerResult = await pool.query(writerQuery, [userId]);
      if (writerResult.rows.length > 0) {
        writerId = writerResult.rows[0].writer_id;
        console.log('✅ Found writer ID:', writerId, 'for content');
      }
    } catch (dbError) {
      console.error('❌ Error getting writer ID for content:', dbError);
    }

    if (influxService) {
      try {
        // Convert frontend range to InfluxDB range for content
        const convertContentRange = (range) => {
          switch (range) {
            case 'last7days': return '7d';
            case 'last28days': return '28d';
            case 'last30days': return '30d';
            case 'last90days': return '90d';
            case 'last365days': return '365d';
            case 'lifetime': return '3y'; // Use 3 years for lifetime
            case '2025': return '150d';
            case '2024': return '365d';
            case 'may': return '31d';
            case 'april': return '30d';
            case 'march': return '31d';
            default: return '30d';
          }
        };

        const influxRange = convertContentRange(range);
        console.log(`🎬 Converting range '${range}' to InfluxDB format '${influxRange}'`);

        // Get real content data from InfluxDB filtered by writer
        const contentData = await influxService.getWriterSubmissions(writerId, influxRange);

        // Transform data for Content page format
        const transformedContent = contentData
          .map((video, index) => {
            // Format the posted date properly
            let formattedDate = 'Unknown Date';
            if (video.submittedOn) {
              try {
                const date = new Date(video.submittedOn);
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
              id: video.id || index + 1,
              title: video.title,
              thumbnail: `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`,
              views: video.views,
              publishDate: formattedDate,
              posted_date: video.submittedOn,
              status: 'Published',
              type: video.url && video.url.includes('/shorts/') ? 'short' : 'video',
              url: video.url,
              engagement: Math.floor(Math.random() * 20) + 80, // Placeholder engagement
              duration: video.url && video.url.includes('/shorts/') ? '0:30' : '5:00',
              writer_name: video.writer_name,
              account_name: video.account_name || 'Unknown Account', // Include account_name from InfluxDB
              video_id: video.video_id,
              timestamp: new Date(video.submittedOn).getTime()
            };
          })
          .filter(item => {
            if (type === 'short') return item.type === 'short';
            if (type === 'video') return item.type === 'video';
            if (type === 'full_to_short') return item.type === 'full_to_short';
            return true; // 'all' or any other value
          })
          .sort((a, b) => {
            if (sort === 'latest') {
              return b.timestamp - a.timestamp; // Sort by date descending (newest first)
            }
            return b.views - a.views; // Default: sort by views descending
          })
          .slice(0, parseInt(limit));

        console.log('🎬 Real content data sent:', {
          count: transformedContent.length,
          range,
          writerId
        });

        const contentResponse = {
          success: true,
          data: transformedContent,
          metadata: {
            total: transformedContent.length,
            range: range,
            type: type,
            sort: sort,
            limit: limit,
            writerId: writerId,
            source: 'InfluxDB - Real Data'
          }
        };

        // Cache the response data
        if (redisService && redisService.isAvailable()) {
          const cacheKey = `content:data:user:${userId}:range:${range}:type:${type}:limit:${limit}:sort:${sort}`;
          await redisService.set(cacheKey, contentResponse, 1800); // Cache for 30 minutes
          console.log('✅ Cached content data');
        }

        res.json(contentResponse);
        return;
      } catch (influxError) {
        console.error('❌ InfluxDB error in content, falling back to dummy data:', influxError);
      }
    }

    // Fallback to dummy data if InfluxDB fails
    const dummyContent = [
      {
        id: 1,
        title: 'Sample Video Title',
        thumbnail: 'https://via.placeholder.com/320x180',
        views: 150000,
        publishDate: new Date().toLocaleDateString(),
        status: 'Published',
        type: 'Short',
        engagement: 85,
        duration: '0:30',
        account_name: 'Sample Account', // Include account_name in dummy data
        writer_name: 'Sample Writer'
      }
    ];

    const fallbackResponse = {
      success: true,
      data: dummyContent,
      metadata: {
        total: dummyContent.length,
        range: range,
        type: type,
        source: 'Dummy Data - InfluxDB Unavailable'
      }
    };

    // Cache the fallback response data
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `content:data:user:${userId}:range:${range}:type:${type}:limit:${limit}:sort:${sort}`;
      await redisService.set(cacheKey, fallbackResponse, 900); // Cache for 15 minutes (shorter for fallback)
      console.log('✅ Cached fallback content data');
    }

    res.json(fallbackResponse);

  } catch (error) {
    console.error('❌ Content endpoint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug endpoint to check video data for writer 121 (mylogumbs) - no auth required
router.get('/debug-writer-121-videos', async (req, res) => {
  try {
    const writerId = 121;
    console.log(`🔍 DEBUG: Checking video data for writer ${writerId} (mylogumbs)`);

    // Check writer exists
    const writerQuery = `SELECT id, name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    console.log(`👤 Writer info:`, writerRows[0] || 'Not found');

    // Check videos in video table with YouTube URLs
    const videoTableQuery = `
      SELECT id, script_title, url, video_cat, writer_id
      FROM video
      WHERE writer_id = $1
        AND (url LIKE '%youtube.com%' OR url LIKE '%youtu.be%')
        AND url IS NOT NULL
      ORDER BY id DESC
    `;
    const { rows: videoTableRows } = await pool.query(videoTableQuery, [writerId]);
    console.log(`📊 YouTube videos in video table: ${videoTableRows.length}`);

    // Get total count using the same query as analytics
    const totalCountQuery = `
      SELECT COUNT(*) as total_count
      FROM video
      WHERE writer_id = $1
        AND (url LIKE '%youtube.com%' OR url LIKE '%youtu.be%')
        AND url IS NOT NULL
    `;
    const { rows: countRows } = await pool.query(totalCountQuery, [writerId]);
    const totalCount = countRows[0]?.total_count || 0;
    console.log(`📊 Total count from analytics query: ${totalCount}`);

    // Check videos in statistics_youtube_api table
    const statsTableQuery = `
      SELECT video_id, duration, views_total, posted_date
      FROM statistics_youtube_api
      WHERE video_id IN (
        SELECT CAST(id AS VARCHAR) FROM video WHERE writer_id = $1
      )
      ORDER BY video_id DESC
    `;
    const { rows: statsTableRows } = await pool.query(statsTableQuery, [writerId]);
    console.log(`📊 Videos in statistics_youtube_api table: ${statsTableRows.length}`);

    // Check which videos are missing from statistics_youtube_api
    const videoIds = videoTableRows.map(v => v.id.toString());
    const statsVideoIds = new Set(statsTableRows.map(s => s.video_id));
    const missingFromStats = videoTableRows.filter(v => !statsVideoIds.has(v.id.toString()));

    // Check INNER JOIN result (what the current query returns)
    const innerJoinQuery = `
      SELECT v.id, v.script_title, v.url, s.duration, s.views_total
      FROM video v
      INNER JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
        AND v.url LIKE '%youtube.com%'
      ORDER BY v.id DESC
    `;
    const { rows: innerJoinRows } = await pool.query(innerJoinQuery, [writerId]);

    res.json({
      success: true,
      writerId: writerId,
      videoTable: {
        count: videoTableRows.length,
        sample: videoTableRows.slice(0, 5).map(v => ({
          id: v.id,
          title: v.script_title,
          url: v.url?.substring(0, 50) + '...',
          category: v.video_cat
        }))
      },
      statisticsTable: {
        count: statsTableRows.length,
        sample: statsTableRows.slice(0, 5).map(s => ({
          video_id: s.video_id,
          duration: s.duration,
          views: s.views_total,
          posted_date: s.posted_date
        }))
      },
      missingFromStats: {
        count: missingFromStats.length,
        videos: missingFromStats.slice(0, 10).map(v => ({
          id: v.id,
          title: v.script_title,
          url: v.url?.substring(0, 50) + '...',
          category: v.video_cat
        }))
      },
      innerJoinResult: {
        count: innerJoinRows.length,
        sample: innerJoinRows.slice(0, 5).map(v => ({
          id: v.id,
          title: v.script_title,
          duration: v.duration,
          views: v.views_total
        }))
      }
    });

  } catch (error) {
    console.error('❌ Debug writer 121 videos error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get writer streak and script stats
router.get('/writer/streak-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    console.log('📊 Getting streak and script stats for user:', userId);

    // Get writer ID from login ID (same pattern as other endpoints)
    let writerId = null;
    try {
      const writerQuery = `
        SELECT w.id as writer_id, w.name as writer_name
        FROM writer w
        WHERE w.login_id = $1
      `;
      const writerResult = await pool.query(writerQuery, [userId]);
      if (writerResult.rows.length > 0) {
        writerId = writerResult.rows[0].writer_id;
        console.log('✅ Found writer ID:', writerId, 'for user:', userId);
      } else {
        console.log('⚠️ No writer found for user:', userId);
        return res.status(404).json({ error: 'Writer not found for this user' });
      }
    } catch (dbError) {
      console.error('❌ Error getting writer ID:', dbError);
      return res.status(500).json({ error: 'Database error getting writer info' });
    }

    // Calculate submission streak (consecutive days with submissions, not affected by date picker)
    const streakQuery = `
      WITH daily_submissions AS (
        SELECT DISTINCT DATE(created_at) as submission_date
        FROM script
        WHERE writer_id = $1
        ORDER BY DATE(created_at) DESC
      )
      SELECT submission_date
      FROM daily_submissions
      ORDER BY submission_date DESC
    `;

    // Count posted scripts (filtered by date range if provided)
    let scriptsQuery = `
      SELECT COUNT(*) as posted_scripts
      FROM script
      WHERE writer_id = $1 AND approval_status = 'Posted'
    `;

    const queryParams = [writerId];

    if (start_date && end_date) {
      scriptsQuery += ` AND created_at BETWEEN $2 AND $3`;
      queryParams.push(start_date, end_date);
    }

    // Add debugging - check if writer has any scripts at all
    const debugQuery = `SELECT COUNT(*) as total_scripts, COUNT(CASE WHEN approval_status = 'Posted' THEN 1 END) as posted_scripts FROM script WHERE writer_id = $1`;
    const debugResult = await pool.query(debugQuery, [writerId]);
    console.log('📊 Debug - Writer has:', debugResult.rows[0], 'scripts total');

    // Add debugging for the queries
    console.log('📊 Executing streak query for writer:', writerId);
    console.log('📊 Executing scripts query with params:', queryParams);

    const [streakResult, scriptsResult] = await Promise.all([
      pool.query(streakQuery, [writerId]),
      pool.query(scriptsQuery, queryParams)
    ]);

    console.log('📊 Streak query returned:', streakResult.rows.length, 'submission dates');
    console.log('📊 Scripts query returned:', scriptsResult.rows[0]);

    // Calculate streak from the submission dates
    let streak = 0;
    if (streakResult.rows.length > 0) {
      console.log('📊 Submission dates found:', streakResult.rows.map(r => r.submission_date));

      const submissionDates = streakResult.rows.map(row => {
        const date = new Date(row.submission_date);
        date.setHours(0, 0, 0, 0);
        return date;
      }).sort((a, b) => b.getTime() - a.getTime()); // Sort descending (most recent first)

      console.log('📊 Sorted submission dates:', submissionDates.map(d => d.toISOString().split('T')[0]));

      // Calculate consecutive days streak from the most recent submission backwards
      if (submissionDates.length > 0) {
        streak = 1; // Start with the most recent submission

        // Start from the most recent submission and work backwards
        for (let i = 1; i < submissionDates.length; i++) {
          const currentDate = submissionDates[i];
          const previousDate = submissionDates[i - 1];

          // Calculate the difference in days
          const diffTime = previousDate.getTime() - currentDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          console.log(`📊 Checking consecutive days: ${previousDate.toISOString().split('T')[0]} -> ${currentDate.toISOString().split('T')[0]}, diff=${diffDays} days`);

          // If the difference is exactly 1 day, continue the streak
          if (diffDays === 1) {
            streak++;
            console.log(`📊 Streak continues: ${streak} days`);
          } else {
            // Streak is broken
            console.log(`📊 Streak broken at ${diffDays} day gap`);
            break;
          }
        }

        console.log(`📊 Final calculated streak: ${streak} consecutive days ending on ${submissionDates[0].toISOString().split('T')[0]}`);
      }
    } else {
      console.log('📊 No submission dates found for writer:', writerId);
    }

    const postedScripts = parseInt(scriptsResult.rows[0]?.posted_scripts || 0);

    console.log('📊 Final streak and script stats:', { streak, postedScripts });

    res.json({
      success: true,
      streak: streak,
      postedScripts: postedScripts
    });

  } catch (error) {
    console.error('❌ Error getting streak and script stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple test endpoint to verify frontend connectivity
router.get('/test-simple', authenticateToken, async (req, res) => {
  console.log('🧪 Simple test endpoint called');
  res.json({
    success: true,
    message: 'Frontend can reach backend!',
    totalViews: 139616232175,
    chartData: [
      { date: '2024-01-01', views: 1000000 },
      { date: '2024-01-02', views: 1200000 }
    ],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to see what frontend should receive
router.get('/test-frontend', authenticateToken, async (req, res) => {
  try {
    const writerId = req.user.writerId || req.user.userId;
    const range = '30d';

    console.log('🧪 Test endpoint called for writer:', writerId);

    if (influxService) {
      const [totalViews, dailyAnalytics] = await Promise.all([
        influxService.getTotalViews(range, writerId),
        influxService.getDashboardAnalytics(range, writerId)
      ]);

      const chartData = dailyAnalytics.map(day => {
        // Convert InfluxDB UTC time to EST
        const utcDate = new Date(day.date);
        const estDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000)); // UTC-5 for EST
        return {
          date: estDate.toISOString().split('T')[0],
          views: day.views,
          timestamp: estDate.getTime()
        };
      });

      const testData = {
        totalViews: totalViews,
        chartData: chartData,
        avgDailyViews: chartData.length > 0 ? Math.floor(totalViews / chartData.length) : 0,
        summary: {
          highestDay: chartData.length > 0 ? Math.max(...chartData.map(d => d.views)) : 0,
          lowestDay: chartData.length > 0 ? Math.min(...chartData.map(d => d.views)) : 0,
          progressToTarget: Math.min((totalViews / 100000000) * 100, 100)
        }
      };

      console.log('🧪 Test data prepared:', {
        totalViews: testData.totalViews,
        chartDataPoints: testData.chartData.length,
        avgDaily: testData.avgDailyViews
      });

      res.json({
        success: true,
        data: testData,
        debug: {
          writerId: writerId,
          range: range,
          rawTotalViews: totalViews,
          rawChartPoints: dailyAnalytics.length
        }
      });
    } else {
      res.json({
        success: false,
        error: 'InfluxDB service not available'
      });
    }
  } catch (error) {
    console.error('🧪 Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to explore InfluxDB data structure
router.get('/debug-influx', authenticateToken, async (req, res) => {
  try {
    const writerId = req.user.writerId || req.user.userId;
    console.log('🔍 Debug: Exploring InfluxDB data for writer:', writerId);

    if (!influxService) {
      return res.json({
        error: 'InfluxDB service not initialized',
        writerId: writerId
      });
    }

    const results = {
      writerId: writerId,
      measurements: [],
      sampleData: [],
      writerSpecificData: [],
      fieldAnalysis: {}
    };

    // 1. Get all measurements
    try {
      const measurementsQuery = `
        import "influxdata/influxdb/schema"
        schema.measurements(bucket: "youtube_api")
      `;

      await influxService.queryApi.queryRows(measurementsQuery, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          results.measurements.push(o._value);
        },
        error(error) {
          console.error('Error getting measurements:', error);
          results.measurements.push('Error: ' + error.message);
        },
        complete() {
          console.log('📊 Available measurements:', results.measurements);
        }
      });
    } catch (error) {
      results.measurements = ['Error getting measurements: ' + error.message];
    }

    // 2. Get sample data from the last 30 days
    try {
      const sampleQuery = `
        from(bucket: "youtube_api")
          |> range(start: -30d)
          |> limit(n: 5)
      `;

      await influxService.queryApi.queryRows(sampleQuery, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          results.sampleData.push(o);
        },
        error(error) {
          console.error('Error getting sample data:', error);
          results.sampleData.push('Error: ' + error.message);
        },
        complete() {
          console.log('📋 Sample data count:', results.sampleData.length);
        }
      });
    } catch (error) {
      results.sampleData = ['Error getting sample data: ' + error.message];
    }

    // 3. Try to get writer-specific data
    if (writerId) {
      try {
        const writerQuery = `
          from(bucket: "youtube_api")
            |> range(start: -30d)
            |> filter(fn: (r) => r.writer_id == "${writerId}" or r.writer_id == ${writerId})
            |> limit(n: 5)
        `;

        await influxService.queryApi.queryRows(writerQuery, {
          next(row, tableMeta) {
            const o = tableMeta.toObject(row);
            results.writerSpecificData.push(o);
          },
          error(error) {
            console.error('Error getting writer-specific data:', error);
            results.writerSpecificData.push('Error: ' + error.message);
          },
          complete() {
            console.log('👤 Writer-specific data count:', results.writerSpecificData.length);
          }
        });
      } catch (error) {
        results.writerSpecificData = ['Error getting writer data: ' + error.message];
      }
    }

    // 4. Get field analysis for main measurements
    for (const measurement of results.measurements.slice(0, 3)) {
      if (typeof measurement === 'string' && !measurement.includes('Error')) {
        try {
          const fieldsQuery = `
            import "influxdata/influxdb/schema"
            schema.fieldKeys(bucket: "youtube_api", measurement: "${measurement}")
          `;

          const fields = [];
          await influxService.queryApi.queryRows(fieldsQuery, {
            next(row, tableMeta) {
              const o = tableMeta.toObject(row);
              fields.push(o._value);
            },
            error(error) {
              console.error(`Error getting fields for ${measurement}:`, error);
            },
            complete() {
              results.fieldAnalysis[measurement] = fields;
            }
          });
        } catch (error) {
          results.fieldAnalysis[measurement] = ['Error: ' + error.message];
        }
      }
    }

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      writerId: req.user.writerId || req.user.userId
    });
  }
});

// BigQuery-powered Content page endpoint
router.get('/videos', authenticateToken, async (req, res) => {
  console.log(`🚀 BIGQUERY CONTENT ENDPOINT CALLED! Query params:`, req.query);
  console.log(`🚀 BIGQUERY CONTENT ENDPOINT: Headers:`, req.headers.authorization ? 'Token present' : 'No token');

  try {
    const { writer_id, range = '28', page = '1', limit = '20', type = 'all' } = req.query;

    // For virals, allow no writer_id to get ALL viral videos across all writers
    if (!writer_id && type !== 'virals') {
      console.log(`❌ BigQuery Content API: Missing writer_id (required for non-virals)`);
      return res.status(400).json({ error: 'missing writer_id' });
    }

    if (type === 'virals' && !writer_id) {
      console.log(`🔥 BigQuery Content API: Getting ALL viral videos across all writers, range: ${range}, page: ${page}`);
      // Use the viral videos function
      const result = await getAllViralVideosAcrossWriters(range, page, limit);
      return res.json({
        videos: result.videos,
        pagination: result.pagination,
        typeCounts: {
          all: result.pagination.totalVideos,
          virals: result.pagination.totalVideos
        }
      });
    }

    console.log(`🎬 PostgreSQL Content API: Getting videos for writer ${writer_id}, range: ${range}, page: ${page}, type: ${type}`);
    console.log(`🔍 PostgreSQL Content API: Authenticated user:`, req.user);

    try {
      console.log(`🔍 PostgreSQL Content API: About to call getPostgresContentVideosWithBigQueryNames...`);
      // Use PostgreSQL data enhanced with BigQuery account names
      const result = await getPostgresContentVideosWithBigQueryNames(writer_id, range, page, limit, type);

      console.log(`✅ BigQuery Content: Found ${result.videos.length} videos for writer ${writer_id}`);
      console.log(`📊 Pagination: Page ${result.pagination.currentPage}/${result.pagination.totalPages}, Total: ${result.pagination.totalVideos}`);

      // Debug: Log sample video data to see account names
      if (result.videos.length > 0) {
        console.log(`🔍 Sample BigQuery video data:`, {
          title: result.videos[0].title,
          account_name: result.videos[0].account_name,
          writer_name: result.videos[0].writer_name,
          views: result.videos[0].views,
          url: result.videos[0].url
        });
      }

      // Return the data in the format expected by Content.jsx
      if (result.pagination) {
        // Return paginated response
        res.json({
          videos: result.videos,
          pagination: result.pagination,
          typeCounts: {
            all: result.pagination.totalVideos,
            short: result.videos.filter(v => v.type === 'short').length,
            video: result.videos.filter(v => v.type === 'video').length
          }
        });
      } else {
        // Return simple array for backward compatibility
        res.json(result.videos);
      }

    } catch (bigQueryError) {
      console.error('❌ BigQuery error in content endpoint:', bigQueryError);
      console.error('❌ BigQuery error stack:', bigQueryError.stack);
      console.error('❌ BigQuery error message:', bigQueryError.message);

      // Fallback to mock data
      console.log('🔄 Using mock data fallback for content');
      const mockVideos = [
        {
          id: 1,
          url: "https://youtube.com/shorts/zQrDuHoNZCc",
          title: "Sample Short Video",
          writer_id: writer_id,
          writer_name: "Writer",
          account_name: "YouTube Channel",
          preview: "https://i.ytimg.com/vi/zQrDuHoNZCc/default.jpg",
          views: 216577,
          likes: 8462,
          comments: 52,
          posted_date: new Date().toISOString(),
          duration: "0:45",
          type: "short",
          status: "Published"
        },
        {
          id: 2,
          url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
          title: "Sample Long Video",
          writer_id: writer_id,
          writer_name: "Writer",
          account_name: "YouTube Channel",
          preview: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
          views: 89000,
          likes: 3200,
          comments: 180,
          posted_date: new Date(Date.now() - 86400000).toISOString(),
          duration: "15:30",
          type: "video",
          status: "Published"
        },
        {
          id: 3,
          url: "https://youtube.com/watch?v=sample3",
          title: "Sample Full to Short Video",
          writer_id: writer_id,
          writer_name: "Writer",
          account_name: "YouTube Channel",
          preview: "https://i.ytimg.com/vi/sample3/maxresdefault.jpg",
          views: 156000,
          likes: 7800,
          comments: 420,
          posted_date: new Date(Date.now() - 86400000 * 2).toISOString(),
          duration: "1:15",
          type: "full_to_short",
          status: "Published"
        }
      ];

      res.json({
        videos: mockVideos,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalVideos: 2,
          videosPerPage: 20,
          hasNextPage: false,
          hasPrevPage: false
        },
        typeCounts: {
          all: 2,
          short: 1,
          video: 1
        }
      });
    }

  } catch (error) {
    console.error('❌ BigQuery Content endpoint error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({ error: 'Failed to fetch content data', details: error.message });
  }
});

// Get viral videos (1M+ views) with core concept docs
router.get('/virals', authenticateToken, async (req, res) => {
  console.log(`🔥 VIRAL VIDEOS ENDPOINT CALLED! Query params:`, req.query);

  try {
    const { writer_id, range = '28', page = '1', limit = '20' } = req.query;

    if (!writer_id) {
      console.log(`❌ Viral Videos API: Missing writer_id`);
      return res.status(400).json({ error: 'missing writer_id' });
    }

    console.log(`🔥 Viral Videos API: Getting viral videos for writer ${writer_id}, range: ${range}`);

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [parseInt(writer_id)]);

    if (writerRows.length === 0) {
      throw new Error(`Writer with ID ${writer_id} not found`);
    }

    const writerName = writerRows[0].name;
    console.log(`🔥 Found writer: ${writerName}`);

    // Calculate date range
    let dateCondition = '';
    let queryParams = [parseInt(writer_id)];

    if (range !== 'lifetime') {
      const daysAgo = parseInt(range);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      dateCondition = `AND (video.upload_date >= $2 OR video.upload_date IS NULL)`;
      queryParams.push(startDate.toISOString().split('T')[0]);
    }

    // First, get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT video.id) as total
      FROM video
      LEFT JOIN script ON video.trello_card_id = script.trello_card_id
      WHERE video.writer_id = $1
        AND video.url IS NOT NULL
        AND video.url != ''
        ${dateCondition}
    `;

    const { rows: countRows } = await pool.query(countQuery, dateCondition ? [parseInt(writer_id), dateValue] : [parseInt(writer_id)]);
    const totalVideos = parseInt(countRows[0].total);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(totalVideos / limitNum);

    // Query PostgreSQL for videos with script data including core_concept_doc
    const viralQuery = `
      SELECT DISTINCT
        video.id,
        video.url,
        video.script_title as title,
        video.created as posted_date,
        video.writer_id,
        video.account_id,
        video.trello_card_id,
        script.core_concept_doc,
        script.google_doc_link,
        script.ai_chat_url,
        script.title as script_original_title
      FROM video
      LEFT JOIN script ON video.trello_card_id = script.trello_card_id
      WHERE video.writer_id = $1
        AND video.url IS NOT NULL
        AND video.url != ''
        ${dateCondition}
      ORDER BY video.created DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    console.log(`🔍 Viral Videos Query:`, viralQuery);
    console.log(`🔍 Query params:`, queryParams);

    const { rows: videoRows } = await pool.query(viralQuery, queryParams);
    console.log(`📊 Found ${videoRows.length} videos from PostgreSQL`);

    // Enhance with BigQuery data for views and thumbnails
    const enhancedVideos = [];

    for (const video of videoRows) {
      try {
        // Extract video ID from URL for BigQuery lookup
        let videoId = null;
        if (video.url) {
          const urlMatch = video.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
          if (urlMatch) {
            videoId = urlMatch[1];
          }
        }

        let views = 0;
        let thumbnail = null;

        if (videoId && global.bigqueryClient) {
          try {
            // Query BigQuery for view count and thumbnail
            const bigQueryQuery = `
              SELECT
                statistics_view_count as views,
                snippet_thumbnails
              FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
              WHERE video_id = @video_id
                AND writer_name = @writer_name
                AND statistics_view_count IS NOT NULL
              ORDER BY snapshot_date DESC
              LIMIT 1
            `;

            const [rows] = await global.bigqueryClient.query({
              query: bigQueryQuery,
              params: {
                video_id: videoId,
                writer_name: writerName
              }
            });

            if (rows.length > 0) {
              views = parseInt(rows[0].views) || 0;
              thumbnail = rows[0].snippet_thumbnails;
            }
          } catch (bqError) {
            console.log(`⚠️ BigQuery lookup failed for video ${videoId}:`, bqError.message);
          }
        }

        // Only include videos with 1M+ views
        if (views > 999999) {
          enhancedVideos.push({
            id: video.id,
            url: video.url,
            title: video.title || video.script_original_title || 'Untitled',
            views: views,
            preview: thumbnail,
            posted_date: video.posted_date,
            writer_id: video.writer_id,
            account_id: video.account_id,
            trello_card_id: video.trello_card_id,
            core_concept_doc: video.core_concept_doc,
            google_doc_link: video.google_doc_link,
            ai_chat_url: video.ai_chat_url,
            type: video.url && video.url.includes('/shorts/') ? 'short' : 'video'
          });
        }
      } catch (videoError) {
        console.log(`⚠️ Error processing video ${video.id}:`, videoError.message);
      }
    }

    console.log(`🔥 Found ${enhancedVideos.length} viral videos (1M+ views) on page ${pageNum}`);

    // Sort by views descending (but keep date ordering as primary)
    enhancedVideos.sort((a, b) => {
      // First sort by posted_date (newest first)
      const dateA = new Date(a.posted_date || 0);
      const dateB = new Date(b.posted_date || 0);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      // Then by views (highest first) as secondary sort
      return (b.views || 0) - (a.views || 0);
    });

    // Count how many are actually viral (1M+ views)
    const viralCount = enhancedVideos.filter(video => (video.views || 0) >= 1000000).length;

    res.json({
      success: true,
      videos: enhancedVideos,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalVideos: viralCount, // Only count actual viral videos
        videosPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Viral Videos endpoint error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch viral videos', details: error.message });
  }
});

// Get top content for analytics page (PostgreSQL + BigQuery enhanced) - Works like Content page
router.get('/writer/top-content', authenticateToken, async (req, res) => {
  try {
    const { writer_id, range = '28', limit = '20', type = 'all', start_date, end_date } = req.query;

    if (!writer_id) {
      return res.status(400).json({ error: 'missing writer_id' });
    }

    console.log('🏆 Getting top content like Content page for writer:', writer_id, 'Range:', range, 'Type:', type, 'Limit:', limit, 'Custom dates:', { start_date, end_date });

    // Check Redis cache
    const redisService = global.redisService;
    console.log('🔍 TOP CONTENT: Redis service available?', redisService ? redisService.isAvailable() : 'NO SERVICE');
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `analytics:top-content:writer:${writer_id}:range:${range}:type:${type}:limit:${limit}:start:${start_date || 'null'}:end:${end_date || 'null'}`;
      console.log('🔍 TOP CONTENT: Checking cache key:', cacheKey);
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached top content data');
        return res.json(cachedData);
      } else {
        console.log('❌ Cache MISS for top content key:', cacheKey);
      }
    } else {
      console.log('⚠️ TOP CONTENT: Redis service not available, skipping cache');
    }

    // Calculate date range - handle custom dates
    let startDate;
    let endDate;

    if (start_date && end_date) {
      // Use custom date range
      startDate = new Date(start_date);
      endDate = new Date(end_date);
      // For single day selection, set end date to end of day
      if (start_date === end_date) {
        endDate.setHours(23, 59, 59, 999);
      }
      console.log('📅 Using custom date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
    } else if (range === 'lifetime') {
      // For lifetime, don't set date restrictions
      startDate = null;
      endDate = null;
      console.log('📅 Using lifetime range (no date restrictions)');
    } else {
      // Use predefined ranges
      endDate = new Date();
      switch (range) {
        case '7':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '365':
          startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      }
      console.log('📅 Using predefined date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
    }

    // Use the same approach as Content page - get ALL videos first, then filter by type using BigQuery duration
    console.log('🎬 Using Content page approach: Get all videos from PostgreSQL, enhance with BigQuery, then filter by type');

    // Build date condition for PostgreSQL
    let dateCondition = '';
    let queryParams = [writer_id];
    if (startDate && endDate) {
      dateCondition = 'AND statistics_youtube_api.posted_date >= $2 AND statistics_youtube_api.posted_date <= $3';
      queryParams.push(startDate.toISOString(), endDate.toISOString());
    }

    // Query PostgreSQL for ALL videos (no type filtering yet) - like Content page
    const allVideosQuery = `
      SELECT
        video.id as video_id,
        video.script_title AS title,
        video.url,
        COALESCE(statistics_youtube_api.views_total, 0) AS views,
        COALESCE(statistics_youtube_api.likes_total, 0) AS likes,
        COALESCE(statistics_youtube_api.comments_total, 0) AS comments,
        statistics_youtube_api.posted_date,
        statistics_youtube_api.preview,
        statistics_youtube_api.duration
      FROM video
      LEFT JOIN statistics_youtube_api
          ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
      WHERE video.writer_id = $1
        AND (video.url LIKE '%youtube.com%' OR video.url LIKE '%youtu.be%')
        AND statistics_youtube_api.views_total IS NOT NULL
        ${dateCondition}
      ORDER BY statistics_youtube_api.views_total DESC
    `;

    console.log('🔍 PostgreSQL all videos query:', allVideosQuery);
    console.log('📊 Query params:', queryParams);

    const result = await pool.query(allVideosQuery, queryParams);
    const allVideosRows = result.rows;

    console.log(`🎬 PostgreSQL returned ${allVideosRows.length} total videos for writer ${writer_id}`);

    // Step 1: Transform PostgreSQL data (like Content page)
    const postgresVideos = allVideosRows.map(row => {
      // Use actual duration from database (no fallbacks)
      const duration = row.duration;

      // Determine video type based on PostgreSQL duration first (fallback)
      let videoType = 'video'; // default
      let isShort = false;

      if (duration) {
        const parts = duration.split(':');
        let totalSeconds = 0;

        if (parts.length === 3) {
          // Format: "HH:MM:SS"
          const hours = parseInt(parts[0]) || 0;
          const minutes = parseInt(parts[1]) || 0;
          const seconds = parseInt(parts[2]) || 0;
          totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        } else if (parts.length === 2) {
          // Format: "MM:SS"
          const minutes = parseInt(parts[0]) || 0;
          const seconds = parseInt(parts[1]) || 0;
          totalSeconds = (minutes * 60) + seconds;
        }

        if (totalSeconds > 0 && totalSeconds < 183) { // Less than 3 minutes 3 seconds (183 seconds)
          videoType = 'short';
          isShort = true;
        } else if (totalSeconds >= 183) {
          videoType = 'video';
          isShort = false;
        }
      }

      // Calculate dynamic engagement rate based on actual data
      const views = parseInt(row.views) || 0;
      const likes = parseInt(row.likes) || 0;
      const comments = parseInt(row.comments) || 0;

      let engagementRate = 0;
      if (views > 0) {
        engagementRate = ((likes + comments) / views) * 100;
        engagementRate = Math.min(100, Math.round(engagementRate * 10) / 10);
      }

      return {
        id: row.video_id,
        title: row.title || 'Untitled Video',
        url: row.url,
        views: views,
        likes: likes,
        comments: comments,
        type: videoType,
        isShort: isShort,
        posted_date: row.posted_date,
        thumbnail: row.preview || `https://img.youtube.com/vi/${extractVideoId(row.url)}/maxresdefault.jpg`,
        duration: duration,
        engagement: engagementRate
      };
    });

    // Step 2: Enhance with BigQuery duration data (like Content page)
    console.log('🔍 Step 2: Enhancing with BigQuery duration data...');

    // Extract video IDs for BigQuery lookup
    const videoIds = postgresVideos.map(video => extractVideoId(video.url)).filter(id => id);
    console.log(`🔍 Extracted ${videoIds.length} video IDs for BigQuery lookup`);

    let enhancedVideos = postgresVideos;
    let bigQueryDurations = new Map();

    if (videoIds.length > 0) {
      try {
        // Query BigQuery for duration data and account names from youtube_video_report_historical
        const bigQuerySql = `
          SELECT
            video_id,
            video_duration_seconds,
            channel_title
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
          WHERE video_id IN UNNEST(@video_ids)
          GROUP BY video_id, video_duration_seconds, channel_title
        `;

        const bigQueryOptions = {
          query: bigQuerySql,
          params: { video_ids: videoIds }
        };

        const [bigQueryRows] = await bigquery.query(bigQueryOptions);
        console.log(`📊 BigQuery returned ${bigQueryRows.length} duration records`);

        // Create duration map with channel_title as account name
        bigQueryRows.forEach(row => {
          if (row.video_id && row.video_duration_seconds !== null) {
            bigQueryDurations.set(row.video_id, {
              duration_seconds: parseFloat(row.video_duration_seconds),
              channel_title: row.channel_title,
              account_name: row.channel_title // Use channel_title as account_name
            });
          }
        });

        console.log(`📊 BigQuery duration map created with ${bigQueryDurations.size} entries`);
      } catch (bigQueryError) {
        console.warn('⚠️ BigQuery duration lookup failed:', bigQueryError.message);
      }
    }

    // Step 3: Apply BigQuery duration data and re-determine video types
    enhancedVideos = postgresVideos.map(video => {
      const youtubeVideoId = extractVideoId(video.url);
      const bigQueryData = bigQueryDurations.get(youtubeVideoId);

      let finalType = video.type; // Start with PostgreSQL type
      let finalIsShort = video.isShort;

      // Use BigQuery duration if available (priority over PostgreSQL)
      if (bigQueryData && bigQueryData.duration_seconds > 0) {
        if (bigQueryData.duration_seconds < 183) {
          finalType = 'short';
          finalIsShort = true;
        } else {
          finalType = 'video';
          finalIsShort = false;
        }
        console.log(`✅ Using BigQuery duration for video ${video.id}: ${bigQueryData.duration_seconds}s -> ${finalType}`);
      } else {
        console.log(`⚠️ No BigQuery duration data for video ${video.id}, using PostgreSQL type: ${finalType} (isShort: ${finalIsShort})`);
      }

      // Format duration properly from BigQuery seconds or PostgreSQL duration
      let formattedDuration = video.duration; // Default to PostgreSQL duration
      if (bigQueryData?.duration_seconds && bigQueryData.duration_seconds > 0) {
        const totalSeconds = Math.round(bigQueryData.duration_seconds);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      return {
        ...video,
        type: finalType,
        isShort: finalIsShort,
        video_duration_seconds: bigQueryData?.duration_seconds || null,
        duration: formattedDuration, // Use properly formatted duration
        account_name: bigQueryData?.channel_title || 'Unknown Account', // Use channel_title from youtube_video_report_historical
        channel_title: bigQueryData?.channel_title,
        thumbnail: video.thumbnail // Keep original thumbnail
      };
    });

    // Step 4: Apply type filtering with balanced results for 'all'
    let filteredVideos = enhancedVideos;
    let topContent = [];

    console.log(`🔍 Filtering by type: '${type}' with limit: ${limit}`);

    if (type === 'shorts') {
      filteredVideos = enhancedVideos.filter(video => video.isShort);
      console.log(`🔍 Filtering for shorts: ${filteredVideos.length} videos where isShort=true`);

      // Debug: Log videos that are being classified as shorts
      console.log('🔍 DEBUG: Videos classified as shorts:');
      filteredVideos.forEach(video => {
        console.log(`  - ${video.title?.substring(0, 50)}... | Duration: ${video.duration} | Duration Seconds: ${video.video_duration_seconds} | Type: ${video.type} | isShort: ${video.isShort}`);
      });

      topContent = filteredVideos
        .sort((a, b) => b.views - a.views)
        .slice(0, parseInt(limit));
    } else if (type === 'content' || type === 'videos') {
      filteredVideos = enhancedVideos.filter(video => !video.isShort);
      console.log(`🔍 Filtering for videos: ${filteredVideos.length} videos where isShort=false`);

      // Debug: Log videos that are being classified as videos
      console.log('🔍 DEBUG: Videos classified as videos:');
      filteredVideos.forEach(video => {
        console.log(`  - ${video.title?.substring(0, 50)}... | Duration: ${video.duration} | Duration Seconds: ${video.video_duration_seconds} | Type: ${video.type} | isShort: ${video.isShort}`);
      });

      topContent = filteredVideos
        .sort((a, b) => b.views - a.views)
        .slice(0, parseInt(limit));
    } else if (type === 'all') {
      // For 'all', get balanced results: 10 shorts + 10 videos (or half/half based on limit)
      const halfLimit = Math.floor(parseInt(limit) / 2);

      const topShorts = enhancedVideos
        .filter(video => video.isShort)
        .sort((a, b) => b.views - a.views)
        .slice(0, halfLimit);

      const topVideos = enhancedVideos
        .filter(video => !video.isShort)
        .sort((a, b) => b.views - a.views)
        .slice(0, halfLimit);

      // Combine and sort by views
      topContent = [...topShorts, ...topVideos]
        .sort((a, b) => b.views - a.views);

      console.log(`🔍 Balanced results for 'all': ${topShorts.length} shorts + ${topVideos.length} videos = ${topContent.length} total`);
    }

    console.log('🏆 Top content found after filtering and limiting:', topContent.length, 'videos');
    console.log('📊 Sample top content:', topContent[0]);

    // Step 6: Enhance with writer names
    let enhancedTopContent = topContent;
    try {
      console.log('🔍 Adding writer names to top content...');

      // Get writer name from PostgreSQL writer table
      const writerQuery = 'SELECT writer_name FROM writer WHERE id = $1';
      const writerResult = await pool.query(writerQuery, [writer_id]);
      const writerName = writerResult.rows[0]?.writer_name || 'Unknown Writer';

      // Add writer name to all videos
      enhancedTopContent = topContent.map(video => ({
        ...video,
        writer_name: writerName
      }));

      console.log('✅ Enhanced top content with writer names');
      console.log('📊 Sample enhanced content:', enhancedTopContent[0]);

    } catch (enhanceError) {
      console.warn('⚠️ Could not enhance with writer names:', enhanceError.message);
      enhancedTopContent = topContent;
    }

    // Debug: Log what we're actually sending to frontend
    console.log('📤 Sending top content response to frontend:');
    console.log('📊 Number of videos:', enhancedTopContent.length);
    if (enhancedTopContent.length > 0) {
      console.log('📊 Sample video data:', {
        title: enhancedTopContent[0].title,
        account_name: enhancedTopContent[0].account_name,
        writer_name: enhancedTopContent[0].writer_name,
        views: enhancedTopContent[0].views
      });
      console.log('📊 All account names:', enhancedTopContent.map(v => ({
        title: v.title?.substring(0, 30) + '...',
        account_name: v.account_name
      })));
    }

    const responseData = {
      success: true,
      data: enhancedTopContent,
      metadata: {
        writer_id: writer_id,
        range: range,
        type: type,
        total_found: enhancedTopContent.length,
        source: 'PostgreSQL + BigQuery Enhanced'
      }
    };

    // Cache the response data
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `analytics:top-content:writer:${writer_id}:range:${range}:type:${type}:limit:${limit}:start:${start_date || 'null'}:end:${end_date || 'null'}`;
      await redisService.set(cacheKey, responseData, 43200); // Cache for 12 hours
      console.log('✅ Cached top content data');
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error getting top content:', error);
    res.status(500).json({
      error: 'Failed to get top content',
      details: error.message
    });
  }
});

// Get latest content for analytics page (PostgreSQL + BigQuery enhanced)
router.get('/writer/latest-content', authenticateToken, async (req, res) => {
  try {
    const { writer_id } = req.query;

    if (!writer_id) {
      return res.status(400).json({ error: 'missing writer_id' });
    }

    console.log('📅 Getting latest content with BigQuery enhancement for writer:', writer_id);

    // Check Redis cache
    const redisService = global.redisService;
    console.log('🔍 LATEST CONTENT: Redis service available?', redisService ? redisService.isAvailable() : 'NO SERVICE');
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `analytics:latest-content:writer:${writer_id}`;
      console.log('🔍 LATEST CONTENT: Checking cache key:', cacheKey);
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached latest content data');
        return res.json(cachedData);
      } else {
        console.log('❌ Cache MISS for latest content key:', cacheKey);
      }
    } else {
      console.log('⚠️ LATEST CONTENT: Redis service not available, skipping cache');
    }

    // Get latest content from PostgreSQL
    const latestContentQuery = `
          SELECT
            video.id as video_id,
            video.script_title AS title,
            video.url,
            COALESCE(statistics_youtube_api.views_total, 0) AS views,
            COALESCE(statistics_youtube_api.likes_total, 0) AS likes,
            COALESCE(statistics_youtube_api.comments_total, 0) AS comments,
            COALESCE(statistics_youtube_api.posted_date, video.created) AS posted_date,
            statistics_youtube_api.preview,
            statistics_youtube_api.duration
          FROM video
          LEFT JOIN statistics_youtube_api
          ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
      WHERE video.writer_id = $1
        AND video.url LIKE '%youtube.com%'
        AND statistics_youtube_api.posted_date IS NOT NULL
      ORDER BY statistics_youtube_api.posted_date DESC
      LIMIT 1
    `;

    console.log('🔍 PostgreSQL latest content query:', latestContentQuery);
    const result = await pool.query(latestContentQuery, [writer_id]);
    const latestContentRows = result.rows;

    // Filter to only videos with duration data
    const videosWithDuration = latestContentRows.filter(row => row.duration);

    if (videosWithDuration.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No recent content found with duration data'
      });
    }

    const row = videosWithDuration[0];

    // Format the posted date properly
    let formattedDate = 'Unknown Date';
    if (row.posted_date) {
      try {
        const date = new Date(row.posted_date);
        formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (dateError) {
        console.error('❌ Error formatting date:', dateError);
      }
    }

    // Use actual duration from database (no fallbacks)
    const duration = row.duration;

    // Determine video type based on duration (< 3 minutes = short, >= 3 minutes = video)
    let videoType = 'video'; // default
    let isShort = false;

    const parts = duration.split(':');
    if (parts.length >= 2) {
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      const totalSeconds = minutes * 60 + seconds;

      if (totalSeconds < 183) { // Less than 3 minutes 3 seconds (183 seconds)
        videoType = 'short';
        isShort = true;
      }
    }

    // Calculate dynamic engagement rate based on actual data
    const views = parseInt(row.views) || 0;
    const likes = parseInt(row.likes) || 0;
    const comments = parseInt(row.comments) || 0;

    // Calculate engagement as (likes + comments) / views * 100
    let engagementRate = 0;
    if (views > 0) {
      engagementRate = ((likes + comments) / views) * 100;
      // Cap at 100% and round to 1 decimal place
      engagementRate = Math.min(100, Math.round(engagementRate * 10) / 10);
    }

    // Calculate "Stayed to Watch" from BigQuery retention data if available
    let stayedToWatch = null;
    try {
      const videoId = extractVideoId(row.url);
      if (videoId) {
        const retentionQuery = `
          SELECT AVG(audience_watch_ratio) * 100 AS percent_stayed
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.audience_retention_historical\`
          WHERE video_id = @video_id
            AND date = (SELECT MAX(date) FROM \`speedy-web-461014-g3.dbt_youtube_analytics.audience_retention_historical\` WHERE video_id = @video_id)
            AND elapsed_video_time_ratio BETWEEN 0.9 AND 1.0
        `;

        const retentionOptions = {
          query: retentionQuery,
          params: { video_id: videoId }
        };

        const [retentionRows] = await bigquery.query(retentionOptions);
        if (retentionRows.length > 0 && retentionRows[0].percent_stayed !== null) {
          stayedToWatch = parseFloat(retentionRows[0].percent_stayed);
          console.log(`📊 Stayed to Watch for ${videoId}:`, stayedToWatch.toFixed(1) + '%');
        }
      }
    } catch (retentionError) {
      console.warn('⚠️ Could not fetch retention data for latest content:', retentionError.message);
    }

    const latestContent = {
      id: row.video_id,
      title: row.title || 'Untitled Video',
      url: row.url,
      views: views,
      likes: likes,
      comments: comments,
      type: videoType,
      isShort: isShort,
      posted_date: row.posted_date,
      publishDate: formattedDate,
      thumbnail: row.preview || `https://img.youtube.com/vi/${extractVideoId(row.url)}/maxresdefault.jpg`,
      duration: duration,
      engagement: engagementRate,
      stayedToWatch: stayedToWatch
    };

    console.log('📅 Latest content found from PostgreSQL:', latestContent.title);

    // Enhance with BigQuery data for account names and writer names (using Content page approach)
    let enhancedLatestContent = latestContent;
    try {
      console.log('🔍 Enhancing latest content with BigQuery data using Content page approach...');

      // Get writer name from PostgreSQL writer table
      const writerQuery = 'SELECT writer_name FROM writer WHERE id = $1';
      const writerResult = await pool.query(writerQuery, [writer_id]);
      const writerName = writerResult.rows[0]?.writer_name || 'Unknown Writer';

      // Extract video_id from URL for BigQuery lookup
      const videoId = extractVideoId(latestContent.url);
      console.log('🔍 Extracted video ID for BigQuery lookup:', videoId, 'from URL:', latestContent.url);

      if (videoId) {
        // Query BigQuery for enhanced data (using youtube_video_report_historical like top content)
        const bigQuerySql = `
          SELECT
            video_id,
            channel_title
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
          WHERE video_id = @video_id
          GROUP BY video_id, channel_title
          LIMIT 1
        `;

        const bigQueryOptions = {
          query: bigQuerySql,
          params: { video_id: videoId }
        };

        console.log('🔍 BigQuery query for latest content:', bigQuerySql);
        console.log('🔍 BigQuery params:', bigQueryOptions.params);

        const [bigQueryRows] = await bigquery.query(bigQueryOptions);
        console.log('📊 BigQuery returned', bigQueryRows.length, 'rows for latest content');

        // Use direct BigQuery approach (like top content)
        if (bigQueryRows.length > 0) {
          const bigQueryData = bigQueryRows[0];
          console.log('✅ BigQuery data found for latest content:', {
            video_id: bigQueryData.video_id,
            channel_title: bigQueryData.channel_title
          });

          // Use channel_title as account name (like top content)
          const enhancedAccountName = bigQueryData.channel_title || 'Not Available';

          // Enhance the latest content with BigQuery data
          enhancedLatestContent = {
            ...latestContent,
            account_name: enhancedAccountName,
            writer_name: writerName,
            channelTitle: bigQueryData.channel_title,
            thumbnail: latestContent.thumbnail // Keep original thumbnail
          };
          console.log('✅ Enhanced latest content account_name:', enhancedLatestContent.account_name);
        } else {
          console.log('❌ No BigQuery data found for video ID:', videoId);
          // No BigQuery data found, add writer name only
          enhancedLatestContent = {
            ...latestContent,
            account_name: 'Not Available',
            writer_name: writerName
          };
        }
      } else {
        // Could not extract video ID, add writer name only
        enhancedLatestContent = {
          ...latestContent,
          account_name: 'Not Available',
          writer_name: writerName
        };
      }

      console.log('✅ Enhanced latest content with BigQuery data');
      console.log('📊 Enhanced latest content:', enhancedLatestContent.title, 'Account:', enhancedLatestContent.account_name);

    } catch (enhanceError) {
      console.warn('⚠️ Could not enhance latest content with BigQuery data:', enhanceError.message);
      // Continue with PostgreSQL data only, but add writer name
      try {
        const writerQuery = 'SELECT writer_name FROM writer WHERE id = $1';
        const writerResult = await pool.query(writerQuery, [writer_id]);
        const writerName = writerResult.rows[0]?.writer_name || 'Unknown Writer';

        enhancedLatestContent = {
          ...latestContent,
          account_name: 'Not Available',
          writer_name: writerName
        };
      } catch (writerError) {
        console.warn('⚠️ Could not get writer name:', writerError.message);
      }
    }

    // Debug: Log what we're actually sending to frontend
    console.log('📤 Sending latest content response to frontend:');
    console.log('📊 Latest content data:', {
      title: enhancedLatestContent.title,
      account_name: enhancedLatestContent.account_name,
      writer_name: enhancedLatestContent.writer_name,
      views: enhancedLatestContent.views
    });

    const responseData = {
      success: true,
      data: enhancedLatestContent,
      metadata: {
        writer_id: writer_id,
        source: 'PostgreSQL + BigQuery Enhanced'
      }
    };

    // Cache the response data
    if (redisService && redisService.isAvailable()) {
      const cacheKey = `analytics:latest-content:writer:${writer_id}`;
      await redisService.set(cacheKey, responseData, 43200); // Cache for 12 hours
      console.log('✅ Cached latest content data');
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error getting latest content:', error);
    res.status(500).json({
      error: 'Failed to get latest content',
      details: error.message
    });
  }
});

// Test endpoint for new BigQuery function (no auth for testing)
router.get('/test-new-bigquery', async (req, res) => {
  try {
    const { writer_id = '110', days = '45' } = req.query;

    console.log(`🧪 Testing new BigQuery function for writer ${writer_id}, last ${days} days`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`🧪 Date range: ${startDateStr} to ${endDateStr}`);

    const result = await getBigQueryViews(writer_id, startDateStr, endDateStr, influxService);

    res.json({
      success: true,
      writerId: writer_id,
      dateRange: { start: startDateStr, end: endDateStr },
      dataPoints: result.length,
      data: result,
      message: 'New BigQuery function test completed'
    });

  } catch (error) {
    console.error('🧪 Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'New BigQuery function test failed'
    });
  }
});

// Test endpoint for shorts/longs split functionality
router.get('/test-shorts-split', async (req, res) => {
  try {
    const { writer_id = '130', start_date = '2025-07-01', end_date = '2025-07-10' } = req.query;

    console.log(`🔍 Testing shorts/longs split for writer ${writer_id} from ${start_date} to ${end_date}`);

    // Use the new BigQuery function with split functionality
    const result = await getBigQueryViews(writer_id, start_date, end_date);

    res.json({
      success: true,
      writerId: writer_id,
      dateRange: { start: start_date, end: end_date },
      data: result,
      isSplit: typeof result === 'object' && result.shorts && result.longs,
      shortsCount: result.shorts ? result.shorts.length : 0,
      longsCount: result.longs ? result.longs.length : 0
    });

  } catch (error) {
    console.error('❌ Shorts/longs split test error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Test endpoint specifically for July 8th data investigation
router.get('/test-july-8th', async (req, res) => {
  try {
    const { writer_id = '130' } = req.query;

    console.log(`🔍 Investigating July 8th data for writer ${writer_id}`);

    // Use the new BigQuery function for July 8th specifically
    const result = await getBigQueryViews(writer_id, '2025-07-08', '2025-07-08');

    // Get raw totals from youtube_metadata_historical for comparison
    const bigqueryClient = getBigQueryClient();
    if (!bigqueryClient) {
      throw new Error('BigQuery client not initialized');
    }

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writer_id]);
    const writerName = writerRows[0].name;

    // Get raw totals for July 7th and 8th
    const rawTotalsQuery = `
      SELECT
        DATE(snapshot_date) as date_day,
        SUM(CAST(statistics_view_count AS INT64)) as total_views,
        COUNT(DISTINCT video_id) as video_count
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
      WHERE writer_id = @writer_id
        AND DATE(snapshot_date) IN ('2025-07-07', '2025-07-08')
      GROUP BY date_day
      ORDER BY date_day
    `;

    const [rawTotalsRows] = await bigqueryClient.query({
      query: rawTotalsQuery,
      params: {
        writer_id: parseInt(writer_id)
      }
    });

    // Get the calculation method used in the daily increases function
    const calculationDetails = {
      method: "The system calculates daily increases by comparing each video's view count from one day to the next",
      example: "If a video had 1000 views on July 7 and 1200 views on July 8, it counts as +200 views increase",
      note: "This is different from comparing the sum of all views across days, which can be affected by videos being added or removed"
    };

    res.json({
      success: true,
      writer_id: parseInt(writer_id),
      writer_name: writerName,
      date: '2025-07-08',
      calculated_daily_increases: result,
      calculated_total_increase: result.reduce((sum, day) => sum + day.views, 0),
      raw_daily_totals: rawTotalsRows.map(row => ({
        date: row.date_day,
        total_views: parseInt(row.total_views),
        video_count: parseInt(row.video_count)
      })),
      calculation_explanation: calculationDetails
    });

  } catch (error) {
    console.error('❌ July 8th test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Comprehensive diagnostic endpoint for writer 130 July 8th issue
router.get('/debug-writer-130-july-8', async (req, res) => {
  try {
    console.log('🔍 COMPREHENSIVE DEBUG: Writer 130 July 8th investigation');

    const writerId = 130;
    const targetDate = '2025-07-08';

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    const writerName = writerRows[0]?.name;

    console.log(`📝 Writer name from PostgreSQL: "${writerName}"`);

    const results = {
      writer_id: writerId,
      writer_name: writerName,
      target_date: targetDate,
      data_sources: {}
    };

    // Check youtube_video_report_historical
    try {
      const reportQuery = `
        SELECT
          date_day,
          video_id,
          video_title,
          views,
          account_name,
          writer_name
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_video_report_historical\`
        WHERE writer_name = @writer_name
          AND date_day = @target_date
        ORDER BY views DESC
        LIMIT 10
      `;

      const [reportRows] = await global.bigqueryClient.query({
        query: reportQuery,
        params: { writer_name: writerName, target_date: targetDate }
      });

      results.data_sources.youtube_video_report_historical = {
        found_records: reportRows.length,
        total_views: reportRows.reduce((sum, row) => sum + parseInt(row.views || 0), 0),
        sample_data: reportRows.slice(0, 3).map(row => ({
          video_id: row.video_id,
          video_title: row.video_title,
          views: row.views,
          writer_name: row.writer_name
        }))
      };
    } catch (error) {
      results.data_sources.youtube_video_report_historical = { error: error.message };
    }

    // Check historical_video_metadata_past
    try {
      const historicalQuery = `
        SELECT
          Date as date_day,
          SUM(CAST(Views AS INT64)) as total_views,
          COUNT(*) as video_count
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.historical_video_metadata_past\`
        WHERE writer_id = @writer_id
          AND Date = @target_date
        GROUP BY Date
      `;

      const [historicalRows] = await global.bigqueryClient.query({
        query: historicalQuery,
        params: { writer_id: 130.0, target_date: targetDate }  // Note: FLOAT type
      });

      results.data_sources.historical_video_metadata_past = {
        found_records: historicalRows.length,
        data: historicalRows.length > 0 ? {
          total_views: historicalRows[0].total_views,
          video_count: historicalRows[0].video_count
        } : null
      };
    } catch (error) {
      results.data_sources.historical_video_metadata_past = { error: error.message };
    }

    // Check PostgreSQL statistics_youtube_api
    try {
      const postgresQuery = `
        SELECT
          v.id,
          v.script_title as title,
          v.url,
          v.writer_id,
          COALESCE(s.views_total, 0) as views,
          s.posted_date
        FROM video v
        LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
        WHERE v.writer_id = $1
          AND (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
          AND v.url IS NOT NULL
          AND s.posted_date::date = $2
        ORDER BY s.views_total DESC NULLS LAST
        LIMIT 10
      `;

      const { rows: postgresRows } = await pool.query(postgresQuery, [writerId, targetDate]);

      results.data_sources.postgresql_statistics = {
        found_records: postgresRows.length,
        total_views: postgresRows.reduce((sum, row) => sum + parseInt(row.views || 0), 0),
        sample_data: postgresRows.slice(0, 3).map(row => ({
          video_id: row.id,
          title: row.title,
          views: row.views,
          posted_date: row.posted_date
        }))
      };
    } catch (error) {
      results.data_sources.postgresql_statistics = { error: error.message };
    }

    res.json(results);

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Simple cache clearing endpoint for testing (no auth required)
router.get('/clear-cache-simple', async (req, res) => {
  try {
    const redisService = global.redisService;
    let clearedKeys = 0;

    if (redisService && redisService.isAvailable()) {
      // Clear all analytics cache patterns
      const patterns = [
        'analytics:*',
        'writer:*',
        'bigquery:*',
        'daily:*',
        'views:*',
        'cache:*'
      ];

      for (const pattern of patterns) {
        const keys = await redisService.clearPattern(pattern);
        clearedKeys += keys;
        console.log(`✅ Cleared ${keys} keys for pattern: ${pattern}`);
      }

      console.log(`✅ Total cleared: ${clearedKeys} cache keys`);
      res.json({
        success: true,
        message: `Analytics cache cleared successfully - ${clearedKeys} keys deleted`,
        patterns_cleared: patterns,
        total_keys: clearedKeys
      });
    } else {
      res.json({ success: false, message: 'Redis not available' });
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache', details: error.message });
  }
});

// Debug cache endpoint
router.get('/debug-cache', async (req, res) => {
    try {
        console.log('🔍 Cache debug requested');

        const redisService = global.redisService;
        if (!redisService || !redisService.isAvailable()) {
            return res.json({ success: false, message: 'Redis not available' });
        }

        const patterns = ['analytics:*', 'writer:*', 'bigquery:*'];
        const cacheInfo = {};

        for (const pattern of patterns) {
            try {
                // Use the Redis client directly to get keys
                const keys = await redisService.client.keys(pattern);
                cacheInfo[pattern] = {
                    count: keys ? keys.length : 0,
                    keys: keys || []
                };

                // Get sample data for first few keys
                if (keys && keys.length > 0) {
                    const sampleKeys = keys.slice(0, 3);
                    const sampleData = {};

                    for (const key of sampleKeys) {
                        try {
                            const data = await redisService.get(key);
                            if (data) {
                                const parsed = JSON.parse(data);
                                // Only show structure, not full data
                                if (parsed && typeof parsed === 'object') {
                                    sampleData[key] = {
                                        type: Array.isArray(parsed) ? 'array' : 'object',
                                        length: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
                                        keys: Array.isArray(parsed) ? 'array' : Object.keys(parsed).slice(0, 5)
                                    };
                                } else {
                                    sampleData[key] = parsed;
                                }
                            } else {
                                sampleData[key] = null;
                            }
                        } catch (e) {
                            sampleData[key] = 'Error parsing data: ' + e.message;
                        }
                    }

                    cacheInfo[pattern].sampleData = sampleData;
                }
            } catch (error) {
                cacheInfo[pattern] = { error: error.message };
            }
        }

        res.json({
            success: true,
            cache_info: cacheInfo,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to get daily InfluxDB data for main chart
async function getDailyInfluxData(writerId, days = 30) {
  try {
    const InfluxService = require('../services/influxService');
    const influx = new InfluxService();

    // Query to get daily view increments (not cumulative totals) from InfluxDB
    const flux = `
      from(bucket: "youtube_api")
          |> range(start: -${parseInt(days)}d)
          |> filter(fn: (r) =>
               r._measurement == "views" and
               r._field       == "views" and
               r.writer_id    == "${writerId}"
             )
          |> map(fn: (r) => ({ r with _value: int(v: r._value) }))
          |> group(columns: ["video_id"])
          |> sort(columns: ["_time"])
          |> difference(nonNegative: true, columns: ["_value"])
          |> group()
          |> aggregateWindow(every: 1d, fn: sum, createEmpty: false)
          |> keep(columns: ["_time", "_value"])
          |> sort(columns: ["_time"])
    `;

    console.log(`📊 InfluxDB daily query for writer_id ${writerId}: ${flux}`);

    let influxResults = [];
    await new Promise((resolve, reject) => {
      influx.queryApi.queryRows(flux, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          influxResults.push({
            _time: o._time,
            _value: o._value || 0
          });
        },
        error(error) {
          console.error(`📊 InfluxDB daily queryRows error:`, error.message);
          reject(error);
        },
        complete() {
          console.log(`📊 InfluxDB daily queryRows returned ${influxResults.length} raw results`);
          resolve();
        }
      });
    });

    // Convert to format expected by frontend with UTC to EST conversion
    const dailyData = influxResults.map(item => {
      const utcDate = new Date(item._time);
      // Convert UTC to EST (UTC-5, or UTC-4 for EDT)
      const estDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/New_York"}));

      return {
        time: estDate.toISOString().split('T')[0], // YYYY-MM-DD format
        views: parseInt(item._value || 0),
        source: 'InfluxDB_Daily_Aggregation'
      };
    });

    console.log(`📊 InfluxDB daily returned ${dailyData.length} daily data points`);
    if (dailyData.length > 0) {
      console.log(`📊 Sample daily data:`, dailyData.slice(0, 3));
    }

    return dailyData;
  } catch (error) {
    console.error('📊 InfluxDB daily data error:', error.message);
    return [];
  }
}

// Realtime analytics endpoint - Last 24 hours hourly data (InfluxDB only)
router.get('/realtime', authenticateToken, async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const userId = req.user.id;

    console.log(`⚡ Realtime analytics requested for user ${userId}, last ${hours} hours`);

    // Get writer info directly using the user ID from JWT token
    const writerResult = await pool.query(
      'SELECT id, name FROM writer WHERE login_id = $1',
      [userId]
    );

    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }

    const writer = writerResult.rows[0];
    const writerId = writer.id.toString(); // Convert to string for InfluxDB query

    console.log(`⚡ Found writer: ${writer.name} (ID: ${writerId})`);

    // Calculate time range for last 24 hours
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (parseInt(hours) * 60 * 60 * 1000));

    console.log(`⚡ Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

    // Query InfluxDB youtube_api bucket for hourly data
    let hourlyData = [];
    let totalViews = 0;

    try {
      const InfluxService = require('../services/influxService');
      const influx = new InfluxService();



      // Query to get hourly view increments (not cumulative totals) from InfluxDB
const flux = `
    from(bucket: "youtube_api")
        |> range(start: -${parseInt(hours) + 1}h, stop: -1h)
        |> filter(fn: (r) =>
             r._measurement == "views" and
             r._field       == "views" and
             r.writer_id    == "${writerId}"
           )
        |> map(fn: (r) => ({ r with _value: int(v: r._value) }))
        |> group(columns: ["video_id"])
        |> sort(columns: ["_time"])
        |> difference(nonNegative: true, columns: ["_value"])
        |> group()
        |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
        |> keep(columns: ["_time", "_value"])
        |> sort(columns: ["_time"])
        |> limit(n: ${parseInt(hours)})
`;


      console.log(`⚡ InfluxDB youtube_api query for writer_id ${writerId}: ${flux}`);

      let influxResults = [];
      try {
        // Use Promise to ensure we wait for the query to complete
        await new Promise((resolve, reject) => {
          influx.queryApi.queryRows(flux, {
            next(row, tableMeta) {
              const o = tableMeta.toObject(row);
              influxResults.push({
                _time: o._time,
                _value: o._value || 0
              });
            },
            error(error) {
              console.error(`⚡ InfluxDB queryRows error:`, error.message);
              reject(error);
            },
            complete() {
              console.log(`⚡ InfluxDB queryRows returned ${influxResults.length} raw results`);
              resolve();
            }
          });
        });
      } catch (err) {
        console.error(`⚡ InfluxDB query error:`, err.message);
        influxResults = [];
      }

      // Convert to format expected by frontend
      hourlyData = influxResults.map(item => ({
        time: new Date(item._time).toISOString(),
        views: parseInt(item._value || 0)
      }));

      totalViews = hourlyData.reduce((sum, item) => sum + item.views, 0);

      console.log(`⚡ InfluxDB youtube_api returned ${hourlyData.length} hourly data points`);
      console.log(`⚡ InfluxDB total views: ${totalViews.toLocaleString()}`);

      // Log sample data for debugging
      if (hourlyData.length > 0) {
        console.log(`⚡ Sample hourly data:`, hourlyData.slice(0, 3));
      }

    } catch (influxError) {
      console.error('⚡ InfluxDB error:', influxError.message);

      // Return empty data if InfluxDB fails
      hourlyData = [];
      totalViews = 0;
    }

    // Create a complete time series for the last N hours (fill missing hours with 0)
    const now = new Date();
    const completeHourlyData = [];

    // Generate all hours from N hours ago to now
    for (let i = parseInt(hours) - 1; i >= 0; i--) {
      const hourTime = new Date(now.getTime() - (i * 60 * 60 * 1000));

      // Find matching data point from InfluxDB
      const matchingData = hourlyData.find(item => {
        const itemTime = new Date(item.time);
        return Math.abs(itemTime.getTime() - hourTime.getTime()) < 30 * 60 * 1000; // Within 30 minutes
      });

      completeHourlyData.push({
        time: hourTime.toISOString(),
        views: matchingData ? matchingData.views : 0
      });
    }

    // Format chart data for the widget (complete N bars representing hourly data)
    const chartData = completeHourlyData.map((item) => {
      const date = new Date(item.time);
      // Convert UTC to EST for display
      const estDate = new Date(date.getTime() - (5 * 60 * 60 * 1000));

      return {
        time: estDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        views: item.views,
        hour: estDate.getHours()
      };
    });

    const response = {
      totalViews: totalViews,
      chartData: chartData,
      lastUpdated: new Date().toISOString(),
      timeRange: `${hours} hours`,
      dataPoints: chartData.length, // Use chartData length (complete series)
      influxDataPoints: hourlyData.length, // Original InfluxDB data points
      writerId: writerId,
      writerName: writer.name
    };

    console.log(`⚡ Realtime response: ${totalViews.toLocaleString()} views, ${chartData.length} chart points (${hourlyData.length} from InfluxDB)`);

    res.json(response);

  } catch (error) {
    console.error('⚡ Realtime endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch realtime data' });
  }
});

// Test endpoint for InfluxDB only
router.get('/test-influx-only', async (req, res) => {
  try {
    const { writer_id = '110', days = '7' } = req.query;

    console.log(`🧪 Testing InfluxDB only for writer ${writer_id}, last ${days} days`);

    const InfluxService = require('../services/influxService');
    const influxService = new InfluxService();

    const timeRange = `${days}d`;
    const influxData = await influxService.getDashboardAnalytics(timeRange, writer_id);

    console.log(`📊 InfluxDB returned ${influxData.length} rows`);

    const formattedData = influxData.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      views: parseInt(row.views || 0)
    }));

    res.json({
      success: true,
      writerId: writer_id,
      timeRange: timeRange,
      dataPoints: formattedData.length,
      data: formattedData,
      message: 'InfluxDB test completed'
    });

  } catch (error) {
    console.error('🧪 InfluxDB test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'InfluxDB test failed'
    });
  }
});

// Test endpoint to check account name function
router.get('/test-account-name', async (req, res) => {
  try {
    const { video_id = '1', writer_id = '110' } = req.query;

    console.log(`🧪 Testing account name function for video ${video_id}, writer ${writer_id}`);

    const accountName = await getAccountNameFromBigQuery(video_id, writer_id);

    res.json({
      success: true,
      video_id: video_id,
      writer_id: writer_id,
      account_name: accountName,
      message: accountName ? 'Account name found' : 'No account name found'
    });

  } catch (error) {
    console.error('🧪 Account name test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Account name test failed'
    });
  }
});

// Test endpoint to show exact top content API response structure
router.get('/test-top-content-response', async (req, res) => {
  try {
    const { writer_id = '110' } = req.query;

    console.log(`🧪 Testing top content response structure for writer ${writer_id}`);

    // Call the actual top content function to see what it returns
    const topContentQuery = `
      SELECT
        video.id as video_id,
        video.script_title AS title,
        video.url,
        COALESCE(statistics_youtube_api.views_total, 0) AS views,
        COALESCE(statistics_youtube_api.likes_total, 0) AS likes,
        COALESCE(statistics_youtube_api.comments_total, 0) AS comments,
        statistics_youtube_api.preview,
        statistics_youtube_api.duration,
        statistics_youtube_api.posted_date as first_date
      FROM video
      LEFT JOIN statistics_youtube_api
          ON CAST(video.id AS VARCHAR) = statistics_youtube_api.video_id
      WHERE video.writer_id = $1
        AND video.url LIKE '%youtube.com%'
        AND statistics_youtube_api.views_total IS NOT NULL
      ORDER BY statistics_youtube_api.views_total DESC
      LIMIT 3
    `;

    const result = await pool.query(topContentQuery, [parseInt(writer_id)]);
    const topContent = result.rows;

    // Try to enhance with account names
    const enhancedContent = await Promise.all(topContent.map(async (video) => {
      const accountName = await getAccountNameFromBigQuery(video.video_id, writer_id);

      return {
        id: video.video_id,
        title: video.title,
        url: video.url,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        account_name: accountName || 'Not Available',
        writer_name: 'Test Writer',
        thumbnail: video.preview,
        duration: video.duration
      };
    }));

    console.log('🧪 Test response structure:', {
      total_videos: enhancedContent.length,
      sample_video: enhancedContent[0],
      all_account_names: enhancedContent.map(v => v.account_name)
    });

    res.json({
      success: true,
      data: enhancedContent,
      metadata: {
        writer_id: writer_id,
        total_found: enhancedContent.length,
        source: 'Test Endpoint'
      },
      debug: {
        message: 'This shows the exact structure being sent to frontend',
        account_names: enhancedContent.map(v => ({
          title: v.title,
          account_name: v.account_name
        }))
      }
    });

  } catch (error) {
    console.error('🧪 Test top content response error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test top content response failed'
    });
  }
});

// Test endpoint to verify top content functionality
router.get('/test/top-content', async (req, res) => {
  try {
    const { writer_id = '110', type = 'all' } = req.query;

    console.log('🧪 Testing top content endpoint with writer_id:', writer_id, 'type:', type);

    // Test the main endpoint
    const testUrl = `/api/analytics/writer/top-content?writer_id=${writer_id}&range=30&limit=20&type=${type}`;
    console.log('🧪 Test URL would be:', testUrl);

    res.json({
      message: 'Top content test endpoint',
      test_url: testUrl,
      expected_behavior: {
        all: '10 shorts + 10 videos (balanced)',
        shorts: 'Only videos < 183 seconds',
        content: 'Only videos >= 183 seconds'
      },
      bigquery_table: 'youtube_video_report_historical',
      account_name_source: 'channel_title'
    });

  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
});

// Validate virals count - shows actual videos counted as virals
router.get('/validate-virals', authenticateToken, async (req, res) => {
  try {
    const { writer_id, range = '30d', start_date, end_date } = req.query;

    if (!writer_id) {
      return res.status(400).json({ error: 'missing writer_id' });
    }

    // Get writer name from PostgreSQL
    const writerResult = await pool.query('SELECT name FROM writers WHERE id = $1', [writer_id]);
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    const writerName = writerResult.rows[0].name;

    // Calculate date range
    let finalStartDate, finalEndDate;
    if (start_date && end_date) {
      finalStartDate = start_date;
      finalEndDate = end_date;
    } else {
      const days = parseInt(range.replace('d', ''));
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      finalStartDate = startDate.toISOString().split('T')[0];
      finalEndDate = endDate.toISOString().split('T')[0];
    }

    console.log(`🔍 VALIDATING VIRALS: writer=${writerName} (${writer_id}), range: ${finalStartDate} to ${finalEndDate}`);

    // Query to get actual viral videos with details - NEW LOGIC: Posted in timeframe AND 1M+ views
    const viralsDetailQuery = `
      WITH video_metadata AS (
        SELECT DISTINCT
          video_id,
          writer_name,
          snippet_published_at,
          CAST(statistics_view_count AS INT64) as current_views
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_name = @writer_name
          AND writer_name IS NOT NULL
          AND statistics_view_count IS NOT NULL
          AND CAST(statistics_view_count AS INT64) > 0
          AND snippet_published_at IS NOT NULL
          AND DATE(snippet_published_at) >= @start_date
          AND DATE(snippet_published_at) <= @end_date
      ),
      latest_views AS (
        SELECT
          video_id,
          snippet_published_at,
          MAX(current_views) as max_views
        FROM video_metadata
        GROUP BY video_id, snippet_published_at
      )
      SELECT
        video_id,
        snippet_published_at,
        max_views
      FROM latest_views
      WHERE max_views >= 1000000
      ORDER BY max_views DESC
    `;

    const [viralsDetailResult] = await bigquery.query({
      query: viralsDetailQuery,
      params: {
        writer_name: writerName,
        start_date: finalStartDate,
        end_date: finalEndDate
      }
    });

    // Get video titles from PostgreSQL for the viral videos
    const videoIds = viralsDetailResult.map(row => row.video_id);
    let videoTitles = {};

    if (videoIds.length > 0) {
      const titleQuery = `
        SELECT id, script_title, url
        FROM video
        WHERE id = ANY($1::text[])
      `;
      const titleResult = await pool.query(titleQuery, [videoIds]);
      titleResult.rows.forEach(row => {
        videoTitles[row.id] = {
          title: row.script_title,
          url: row.url
        };
      });
    }

    // Combine the data
    const viralVideos = viralsDetailResult.map(row => ({
      video_id: row.video_id,
      title: videoTitles[row.video_id]?.title || 'Unknown Title',
      url: videoTitles[row.video_id]?.url || null,
      published_at: row.snippet_published_at,
      current_views: parseInt(row.max_views),
      is_viral: row.max_views >= 1000000
    }));

    res.json({
      success: true,
      writer_name: writerName,
      writer_id: writer_id,
      date_range: {
        start: finalStartDate,
        end: finalEndDate
      },
      virals_count: viralVideos.length,
      viral_videos: viralVideos,
      explanation: {
        criteria: "Videos that were POSTED during the time period AND have 1M+ views (regardless of when they reached 1M)",
        note: "NEW LOGIC: Shows videos posted in the timeframe that became viral (1M+ views)"
      }
    });

  } catch (error) {
    console.error('❌ Error validating virals:', error);
    res.status(500).json({ error: 'Failed to validate virals', details: error.message });
  }
});

// Debug virals count - no auth required for testing
router.get('/debug-virals/:writer_id', async (req, res) => {
  try {
    const { writer_id } = req.params;
    const { range = '30d', start_date, end_date } = req.query;

    // Get writer name from PostgreSQL
    const writerResult = await pool.query('SELECT name FROM writers WHERE id = $1', [writer_id]);
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    const writerName = writerResult.rows[0].name;

    // Calculate date range
    let finalStartDate, finalEndDate;
    if (start_date && end_date) {
      finalStartDate = start_date;
      finalEndDate = end_date;
    } else {
      const days = parseInt(range.replace('d', ''));
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      finalStartDate = startDate.toISOString().split('T')[0];
      finalEndDate = endDate.toISOString().split('T')[0];
    }

    console.log(`🔍 DEBUG VIRALS: writer=${writerName} (${writer_id}), range: ${finalStartDate} to ${finalEndDate}`);

    // Get the count using the same logic as the main function - NEW LOGIC: Posted in timeframe AND 1M+ views
    const viralsQuery = `
      WITH video_metadata AS (
        SELECT DISTINCT
          video_id,
          writer_name,
          snippet_published_at,
          CAST(statistics_view_count AS INT64) as current_views
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_name = @writer_name
          AND writer_name IS NOT NULL
          AND statistics_view_count IS NOT NULL
          AND CAST(statistics_view_count AS INT64) > 0
          AND snippet_published_at IS NOT NULL
          AND DATE(snippet_published_at) >= @start_date
          AND DATE(snippet_published_at) <= @end_date
      ),
      latest_views AS (
        SELECT
          video_id,
          snippet_published_at,
          MAX(current_views) as max_views
        FROM video_metadata
        GROUP BY video_id, snippet_published_at
      )
      SELECT
        video_id,
        snippet_published_at,
        max_views
      FROM latest_views
      WHERE max_views >= 1000000
      ORDER BY max_views DESC
      LIMIT 10
    `;

    const [viralsResult] = await bigquery.query({
      query: viralsQuery,
      params: {
        writer_name: writerName,
        start_date: finalStartDate,
        end_date: finalEndDate
      }
    });

    res.json({
      success: true,
      writer_name: writerName,
      writer_id: writer_id,
      date_range: `${finalStartDate} to ${finalEndDate}`,
      virals_count: viralsResult.length,
      sample_virals: viralsResult.map(row => ({
        video_id: row.video_id,
        published_at: row.snippet_published_at,
        current_views: parseInt(row.max_views),
        is_viral: row.max_views >= 1000000
      })),
      query_used: viralsQuery.replace(/@writer_name/g, `'${writerName}'`)
        .replace(/@start_date/g, `'${finalStartDate}'`)
        .replace(/@end_date/g, `'${finalEndDate}'`),
      explanation: "NEW LOGIC: Videos that were POSTED during the time period AND have 1M+ views (regardless of when they reached 1M)"
    });

  } catch (error) {
    console.error('❌ Error debugging virals:', error);
    res.status(500).json({ error: 'Failed to debug virals', details: error.message });
  }
});

// Fast Writer Leaderboard endpoint - using pre-calculated cache table
router.get('/writer/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, period = '30d' } = req.query;

    console.log(`🏆 Getting ${period} writer leaderboard from cache...`);

    if (!bigquery) {
      return res.status(503).json({ error: 'BigQuery not available' });
    }

    // Map frontend period to cache period
    let cachePeriod = period;
    if (period === '30d') cachePeriod = '30d';
    else if (period === '7d') cachePeriod = '7d';
    else if (period === '90d') cachePeriod = '30d'; // Fallback to 30d if 90d not available
    else if (period === '1y') cachePeriod = '30d'; // Fallback to 30d if 1y not available
    else cachePeriod = '14d'; // Default to 14d for other cases

    const cacheQuery = `
      SELECT
        writer_id,
        writer_name,
        total_views,
        total_videos,
        avg_daily_increase,
        rank_position as rank,
        calculation_date,
        period
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.writer_weekly_leaderboard\`
      WHERE calculation_date = CURRENT_DATE()
        AND period = @period
      ORDER BY rank_position
      LIMIT @limit
    `;

    console.log(`🏆 Fetching ${cachePeriod} leaderboard (limit: ${limit})`);

    const [leaderboardRows] = await bigquery.query({
      query: cacheQuery,
      params: {
        period: cachePeriod,
        limit: parseInt(limit)
      }
    });

    if (leaderboardRows.length === 0) {
      console.log(`⚠️ No cached data found for period ${cachePeriod}, trying to get latest available data`);

      // Fallback: get latest data regardless of date
      const fallbackQuery = `
        SELECT
          writer_id,
          writer_name,
          total_views,
          total_videos,
          avg_daily_increase,
          rank_position as rank,
          calculation_date,
          period
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.writer_weekly_leaderboard\`
        WHERE period = @period
        ORDER BY calculation_date DESC, rank_position
        LIMIT @limit
      `;

      const [fallbackRows] = await bigquery.query({
        query: fallbackQuery,
        params: {
          period: cachePeriod,
          limit: parseInt(limit)
        }
      });

      if (fallbackRows.length === 0) {
        return res.json({
          success: true,
          data: [],
          metadata: {
            period: period,
            cache_period: cachePeriod,
            total_writers: 0,
            calculation_method: 'cached_daily_increases',
            cache_date: null,
            last_updated: null,
            message: 'No leaderboard data available'
          }
        });
      }

      leaderboardRows.push(...fallbackRows);
    }

    // Get avatar seeds for all writers in the leaderboard
    const writerNames = leaderboardRows.map(row => row.writer_name);
    let avatarSeeds = {};

    if (writerNames.length > 0) {
      try {
        const avatarQuery = `
          SELECT w.name, l.avatar_seed, l.username
          FROM writer w
          JOIN login l ON w.login_id = l.id
          WHERE w.name = ANY($1)
        `;

        const avatarResult = await pool.query(avatarQuery, [writerNames]);

        // Create a map of writer_name -> avatar_seed
        avatarResult.rows.forEach(row => {
          avatarSeeds[row.name] = row.avatar_seed || row.username;
        });

        console.log('🎭 Avatar seeds fetched for leaderboard:', avatarSeeds);
      } catch (error) {
        console.error('❌ Error fetching avatar seeds:', error);
        // Continue without avatar seeds if there's an error
      }
    }

    const leaderboardData = leaderboardRows.map(row => ({
      rank: parseInt(row.rank),
      writer_name: row.writer_name,
      writer_id: row.writer_id,
      total_views: parseInt(row.total_views),
      total_videos: parseInt(row.total_videos),
      avg_daily_views: parseInt(row.avg_daily_increase),
      days_active: cachePeriod === '7d' ? 7 : cachePeriod === '14d' ? 14 : 30,
      first_active_date: null, // Not stored in cache
      last_active_date: null, // Not stored in cache
      progress_to_1b_percent: parseFloat(((parseInt(row.total_views) / 1000000000.0) * 100).toFixed(2)),
      views_per_million: (parseInt(row.total_views) / 1000000).toFixed(1),
      is_active: true, // All cached entries are considered active
      avatar_seed: avatarSeeds[row.writer_name] || row.writer_name // Add avatar seed
    }));

    console.log(`✅ Fast leaderboard retrieved: ${leaderboardData.length} writers`);

    res.json({
      success: true,
      data: leaderboardData,
      metadata: {
        period: period,
        cache_period: cachePeriod,
        total_writers: leaderboardData.length,
        calculation_method: 'cached_daily_increases',
        cache_date: leaderboardRows[0]?.calculation_date?.value || null,
        last_updated: leaderboardRows[0]?.calculation_date?.value || null
      }
    });

  } catch (error) {
    console.error('❌ Error getting cached leaderboard:', error);
    res.status(500).json({
      error: 'Failed to get writer leaderboard',
      details: error.message
    });
  }
});

// Get all retention data for retention master view with pagination
router.get('/retention-master', async (req, res) => {
  try {
    console.log('🎯 Retention master endpoint called');

    const projectId = process.env.BIGQUERY_PROJECT_ID || "speedy-web-461014-g3";
    const dataset = "dbt_youtube_analytics";

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 200; // 200 videos per page
    const offset = (page - 1) * limit;

    console.log(`📄 Pagination: Page ${page}, Limit ${limit}, Offset ${offset}`);

    // First, get total count of videos with retention data
    const countQuery = `
      WITH unique_videos AS (
        SELECT DISTINCT video_id
        FROM \`${projectId}.${dataset}.audience_retention_historical\`
        WHERE video_id IS NOT NULL
      )
      SELECT COUNT(DISTINCT v.video_id) as total_count
      FROM \`${projectId}.${dataset}.youtube_video_report_historical\` v
      INNER JOIN unique_videos uv ON v.video_id = uv.video_id
      WHERE v.video_title IS NOT NULL
    `;

    console.log('🔍 Getting total count of videos with retention data');
    const [countRows] = await bigquery.query({
      query: countQuery
    });
    const totalVideos = parseInt(countRows[0].total_count);
    const totalPages = Math.ceil(totalVideos / limit);

    console.log(`📊 Total videos: ${totalVideos}, Total pages: ${totalPages}`);

    // Query to get paginated videos with retention data
    const videosQuery = `
      WITH unique_videos AS (
        SELECT DISTINCT video_id
        FROM \`${projectId}.${dataset}.audience_retention_historical\`
        WHERE video_id IS NOT NULL
      ),
      unique_video_reports AS (
        SELECT DISTINCT
          v.video_id,
          FIRST_VALUE(v.video_title) OVER (PARTITION BY v.video_id ORDER BY v.date_day DESC) as video_title,
          FIRST_VALUE(v.video_duration_seconds) OVER (PARTITION BY v.video_id ORDER BY v.date_day DESC) as video_duration_seconds,
          FIRST_VALUE(v.writer_name) OVER (PARTITION BY v.video_id ORDER BY v.date_day DESC) as writer_name,
          FIRST_VALUE(v.account_name) OVER (PARTITION BY v.video_id ORDER BY v.date_day DESC) as account_name
        FROM \`${projectId}.${dataset}.youtube_video_report_historical\` v
        INNER JOIN unique_videos uv ON v.video_id = uv.video_id
        WHERE v.video_title IS NOT NULL
      )
      SELECT DISTINCT
        video_id,
        video_title,
        video_duration_seconds,
        writer_name,
        account_name
      FROM unique_video_reports
      ORDER BY video_title
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    console.log('🔍 Executing videos query for retention master');
    const [videoRows] = await bigquery.query({
      query: videosQuery
    });

    console.log(`📊 Found ${videoRows.length} videos with retention data for page ${page}`);

    // No need for hard limit since we're using proper pagination
    const limitedVideoRows = videoRows;
    console.log(`🔒 Processing ${limitedVideoRows.length} videos for page ${page}`);

    // Process videos in smaller batches to avoid overwhelming BigQuery
    const batchSize = 10;
    const videosWithRetention = [];

    for (let i = 0; i < limitedVideoRows.length; i += batchSize) {
      const batch = limitedVideoRows.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(limitedVideoRows.length/batchSize)}`);

      const batchResults = await Promise.all(
        batch.map(async (video) => {
        try {
          // Get retention data for this video
          const retentionQuery = `
            SELECT
              elapsed_video_time_ratio,
              audience_watch_ratio,
              relative_retention_performance,
              date
            FROM \`${projectId}.${dataset}.audience_retention_historical\`
            WHERE video_id = @video_id
            ORDER BY date DESC, elapsed_video_time_ratio ASC
          `;

          const [retentionRows] = await bigquery.query({
            query: retentionQuery,
            params: {
              video_id: video.video_id
            }
          });

          // Process retention data for chart
          const videoDurationSeconds = video.video_duration_seconds || 178;

          const processedData = retentionRows.map(point => {
            const elapsedRatio = point.elapsed_video_time_ratio || 0;
            const audienceWatch = point.audience_watch_ratio || 0;
            const elapsedTimeSeconds = elapsedRatio * videoDurationSeconds;

            return {
              elapsed_video_time_seconds: elapsedTimeSeconds,
              audience_watch_ratio: audienceWatch * 100, // Convert to percentage
              relative_retention_performance: point.relative_retention_performance,
              date: point.date
            };
          });

          // Aggregate data by elapsed time in seconds
          const aggregatedData = new Map();
          processedData.forEach(point => {
            const roundedSeconds = Math.round(point.elapsed_video_time_seconds);

            if (!aggregatedData.has(roundedSeconds)) {
              aggregatedData.set(roundedSeconds, {
                elapsed_video_time_seconds: roundedSeconds,
                audience_watch_ratios: [],
                relative_performance_ratios: []
              });
            }

            aggregatedData.get(roundedSeconds).audience_watch_ratios.push(point.audience_watch_ratio);
            if (point.relative_retention_performance !== null) {
              aggregatedData.get(roundedSeconds).relative_performance_ratios.push(point.relative_retention_performance);
            }
          });

          // Calculate averages for chart data
          const chartData = Array.from(aggregatedData.values()).map(group => ({
            elapsed_video_time_seconds: group.elapsed_video_time_seconds,
            audienceRetention: group.audience_watch_ratios.length > 0
              ? group.audience_watch_ratios.reduce((sum, val) => sum + val, 0) / group.audience_watch_ratios.length
              : 0
          })).sort((a, b) => a.elapsed_video_time_seconds - b.elapsed_video_time_seconds);

          return {
            video_id: video.video_id,
            title: video.video_title,
            url: `https://www.youtube.com/watch?v=${video.video_id}`,
            writer_name: video.writer_name,
            account_name: video.account_name,
            video_duration_seconds: videoDurationSeconds,
            retention_data: chartData
          };

        } catch (retentionError) {
          console.warn(`⚠️ Could not fetch retention data for video ${video.video_id}:`, retentionError.message);
          return {
            video_id: video.video_id,
            title: video.video_title,
            url: `https://www.youtube.com/watch?v=${video.video_id}`,
            writer_name: video.writer_name,
            account_name: video.account_name,
            video_duration_seconds: video.video_duration_seconds || 178,
            retention_data: []
          };
        }
        }) // Close the async (video) => { function
      ); // Close Promise.all

      videosWithRetention.push(...batchResults);

      // Small delay between batches to avoid overwhelming BigQuery
      if (i + batchSize < limitedVideoRows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Processed retention data for ${videosWithRetention.length} videos`);

    res.json({
      success: true,
      videos: videosWithRetention,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_videos: totalVideos,
        videos_per_page: limit,
        has_next_page: page < totalPages,
        has_prev_page: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Error in retention master endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch retention data',
      details: error.message
    });
  }
});

// Test endpoint to check BigQuery date range
router.get('/test-bigquery-date-range', async (req, res) => {
  try {
    console.log('🔍 Checking BigQuery youtube_metadata_historical date range...');

    const query = `
      SELECT
        MIN(DATE(snapshot_date)) as earliest_date,
        MAX(DATE(snapshot_date)) as latest_date,
        COUNT(DISTINCT DATE(snapshot_date)) as total_days,
        COUNT(*) as total_records,
        COUNT(DISTINCT video_id) as unique_videos
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
      WHERE snapshot_date IS NOT NULL
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length > 0) {
      const result = rows[0];
      console.log('📊 BigQuery youtube_metadata_historical date range results:', result);

      res.json({
        success: true,
        table: 'youtube_metadata_historical',
        data: {
          earliest_date: result.earliest_date ? result.earliest_date.value : null,
          latest_date: result.latest_date ? result.latest_date.value : null,
          total_days: parseInt(result.total_days),
          total_records: parseInt(result.total_records),
          unique_videos: parseInt(result.unique_videos)
        }
      });
    } else {
      res.json({
        success: false,
        message: 'No data found in BigQuery youtube_metadata_historical table'
      });
    }
  } catch (error) {
    console.error('❌ Error checking BigQuery youtube_metadata_historical date range:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to check BigQuery table schema
router.get('/test-bigquery-schema', async (req, res) => {
  try {
    console.log('🔍 Checking BigQuery youtube_metadata_historical schema...');

    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'youtube_metadata_historical'
      ORDER BY ordinal_position
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length > 0) {
      console.log('📊 BigQuery youtube_metadata_historical schema:', rows);

      res.json({
        success: true,
        table: 'youtube_metadata_historical',
        schema: rows.map(row => ({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable
        }))
      });
    } else {
      res.json({
        success: false,
        message: 'No schema found for youtube_metadata_historical table'
      });
    }
  } catch (error) {
    console.error('❌ Error checking BigQuery schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to get sample data from youtube_metadata_historical
router.get('/test-bigquery-sample', async (req, res) => {
  try {
    console.log('🔍 Getting sample data from youtube_metadata_historical...');

    const query = `
      SELECT *
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
      ORDER BY snapshot_date DESC
      LIMIT 5
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length > 0) {
      console.log('📊 Sample data from youtube_metadata_historical:', rows);

      res.json({
        success: true,
        table: 'youtube_metadata_historical',
        sample_count: rows.length,
        sample_data: rows
      });
    } else {
      res.json({
        success: false,
        message: 'No data found in youtube_metadata_historical table'
      });
    }
  } catch (error) {
    console.error('❌ Error getting sample data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to mimic exact frontend call for July 8th
router.get('/test-frontend-july-8th', async (req, res) => {
  try {
    console.log('🧪 Testing exact frontend call for July 8th...');

    // Mimic the exact parameters the frontend would send
    const mockReq = {
      user: { writerId: 94 },
      query: {
        start_date: '2025-07-08',
        end_date: '2025-07-08'
      }
    };

    console.log('📊 Calling handleAnalyticsRequest with mock frontend params...');

    // Create a mock response object to capture the data
    let responseData = null;
    const mockRes = {
      json: (data) => {
        responseData = data;
        console.log('📊 Mock response data:', JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          responseData = { statusCode: code, ...data };
          console.log('📊 Mock error response:', responseData);
        }
      })
    };

    // Call the actual handler
    await handleAnalyticsRequest(mockReq, mockRes);

    res.json({
      success: true,
      message: 'Frontend call simulation completed',
      frontend_would_receive: responseData
    });

  } catch (error) {
    console.error('❌ Error simulating frontend call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint - no auth
router.get('/video-details-test', async (req, res) => {
  res.json({ success: true, message: 'Test endpoint works!', params: req.query });
});

// Video details by category endpoint for performance modals
router.get('/video-details', authenticateToken, async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;

    console.log(`🔍 API called with params:`, { category, startDate, endDate });

    if (!category || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Missing required parameters: category, startDate, endDate'
      });
    }

    // Get writer info from token
    const writerId = req.user?.writerId || req.user?.userId;
    if (!writerId) {
      return res.status(401).json({ message: 'Writer ID not found in token' });
    }

    // Get writer name from PostgreSQL
    const writerQuery = `SELECT name FROM writer WHERE id = $1`;
    const { rows: writerRows } = await pool.query(writerQuery, [writerId]);
    if (writerRows.length === 0) {
      return res.status(404).json({ message: 'Writer not found' });
    }
    const writerName = writerRows[0].name;

    // Check if this is an STL writer with different thresholds
    const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL", "Steven Abreu"];
    const isSTLWriter = stlWriters.includes(writerName);

    console.log(`🔍 Video Details v2 - Writer: ${writerName}, Is STL Writer: ${isSTLWriter}`);

    // Define view thresholds for each category - using same logic as counts
    const categoryConditions = isSTLWriter ? {
      megaVirals: 'max_views >= 1500000',
      virals: 'max_views >= 500000 AND max_views < 1500000',
      almostVirals: 'max_views >= 250000 AND max_views < 500000',
      decentVideos: 'max_views >= 50000 AND max_views < 250000',
      flops: 'max_views < 50000'
    } : {
      megaVirals: 'max_views >= 3000000',
      virals: 'max_views >= 1000000 AND max_views < 3000000',
      almostVirals: 'max_views >= 500000 AND max_views < 1000000',
      decentVideos: 'max_views >= 100000 AND max_views < 500000',
      flops: 'max_views < 100000'
    };

    const condition = categoryConditions[category];
    if (!condition) {
      return res.status(400).json({ message: `Invalid category: ${category}` });
    }

    // Use SAME query logic as the counts - from youtube_metadata_historical
    const query = `
      WITH video_metadata AS (
        SELECT DISTINCT
          video_id,
          writer_name,
          snippet_published_at,
          snippet_title,
          snippet_thumbnails,
          CAST(statistics_view_count AS INT64) as current_views
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE writer_name = @writer_name
          AND writer_name IS NOT NULL
          AND statistics_view_count IS NOT NULL
          AND CAST(statistics_view_count AS INT64) > 0
          AND snippet_published_at IS NOT NULL
          AND DATE(snippet_published_at) >= @start_date
          AND DATE(snippet_published_at) <= @end_date
      ),
      latest_views AS (
        SELECT
          video_id,
          snippet_published_at,
          snippet_title,
          snippet_thumbnails,
          MAX(current_views) as max_views
        FROM video_metadata
        GROUP BY video_id, snippet_published_at, snippet_title, snippet_thumbnails
      ),
      filtered_videos AS (
        SELECT *
        FROM latest_views
        WHERE ${condition}
      ),
      videos_with_urls AS (
        SELECT
          fv.*,
          CONCAT('https://www.youtube.com/watch?v=', fv.video_id) as url,
          v.trello_card_id
        FROM filtered_videos fv
        LEFT JOIN \`speedy-web-461014-g3.postgres.video\` v
          ON CONCAT('https://www.youtube.com/watch?v=', fv.video_id) LIKE CONCAT(SPLIT(v.url, '&')[OFFSET(0)], '%')
      )
      SELECT
        vwu.video_id,
        vwu.max_views as views,
        vwu.snippet_title as title,
        vwu.snippet_published_at as published_date,
        vwu.snippet_thumbnails,
        0 as last_day_views,  -- TODO: Calculate if needed
        vwu.url,
        s.google_doc_link,
        s.ai_chat_url
      FROM videos_with_urls vwu
      LEFT JOIN \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
        ON vwu.trello_card_id = s.trello_card_id
      ORDER BY vwu.max_views DESC
      LIMIT 50
    `;

    console.log(`🔍 Executing BigQuery for category: ${category} with condition: ${condition}`);
    console.log(`📅 Date range: ${startDate} to ${endDate}, Writer: ${writerName}`);

    const options = {
      query: query,
      params: {
        writer_name: writerName,
        start_date: startDate,
        end_date: endDate
      }
    };

    const [rows] = await bigQueryClient.query(options);

    console.log(`📊 BigQuery returned ${rows.length} rows for ${category}`);

    const videos = rows.map(row => ({
      video_id: row.video_id,
      views: row.views,
      title: row.title,
      published_date: row.published_date,
      snippet_thumbnails: row.snippet_thumbnails,
      last_day_views: row.last_day_views,
      url: row.url,
      google_doc_link: row.google_doc_link,
      ai_chat_url: row.ai_chat_url
    }));

    console.log(`📊 Query returned ${videos.length} videos for category ${category}`);

    res.status(200).json({
      success: true,
      data: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch video details',
      error: error.message
    });
  }
});

// DEBUG: Troubleshoot September virals data connection
router.get('/debug/september-virals', async (req, res) => {
  try {
    console.log('🔍 TROUBLESHOOTING: September virals data connection...');

    // Query 1: Check videos posted after August 28th with core concept docs
    const septemberVideosQuery = `
      SELECT
        v.id,
        v.script_title,
        v.url,
        v.created as video_created_date,
        v.trello_card_id,
        w.name as writer_name,
        sc.core_concept_doc,
        s.posted_date as stats_posted_date,
        s.views_total,
        s.video_id as stats_video_id,
        CASE WHEN s.video_id IS NULL THEN 'NO_STATS_DATA' ELSE 'HAS_STATS_DATA' END as stats_status
      FROM video v
      LEFT JOIN writer w ON v.writer_id = w.id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
        AND v.created >= '2025-08-28'
      ORDER BY v.created DESC
      LIMIT 50
    `;

    const { rows: septemberRows } = await pool.query(septemberVideosQuery);

    // Query 2: Check statistics_youtube_api table for September data
    const statsTableQuery = `
      SELECT
        COUNT(*) as total_stats_records,
        COUNT(CASE WHEN posted_date >= '2025-08-28' THEN 1 END) as stats_after_aug28,
        MIN(posted_date) as earliest_stats_date,
        MAX(posted_date) as latest_stats_date,
        COUNT(CASE WHEN views_total >= 500000 AND posted_date >= '2025-08-28' THEN 1 END) as viral_stats_after_aug28
      FROM statistics_youtube_api
      WHERE posted_date IS NOT NULL
    `;

    const { rows: statsRows } = await pool.query(statsTableQuery);

    // Query 3: Check video table for September videos
    const videoTableQuery = `
      SELECT
        COUNT(*) as total_videos_after_aug28,
        COUNT(CASE WHEN sc.core_concept_doc IS NOT NULL AND sc.core_concept_doc != '' THEN 1 END) as videos_with_docs_after_aug28,
        MIN(v.created) as earliest_video_date,
        MAX(v.created) as latest_video_date
      FROM video v
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND v.created >= '2025-08-28'
    `;

    const { rows: videoRows } = await pool.query(videoTableQuery);

    // Query 4: Sample of videos that should be viral but missing stats
    const missingStatsQuery = `
      SELECT
        v.id,
        v.script_title,
        v.created,
        v.trello_card_id,
        sc.core_concept_doc,
        s.video_id as has_stats
      FROM video v
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
        AND v.created >= '2025-08-28'
        AND s.video_id IS NULL
      ORDER BY v.created DESC
      LIMIT 20
    `;

    const { rows: missingStatsRows } = await pool.query(missingStatsQuery);

    res.json({
      success: true,
      troubleshooting: {
        september_videos_with_docs: {
          count: septemberRows.length,
          videos: septemberRows
        },
        statistics_table_summary: statsRows[0],
        video_table_summary: videoRows[0],
        videos_missing_stats: {
          count: missingStatsRows.length,
          videos: missingStatsRows
        },
        data_connection_analysis: {
          issue: "Videos posted after Aug 28th may not have statistics_youtube_api data yet",
          video_table_join: "video.id = statistics_youtube_api.video_id",
          script_table_join: "video.trello_card_id = script.trello_card_id",
          views_source: "statistics_youtube_api.views_total",
          potential_problems: [
            "statistics_youtube_api table not updated for recent videos",
            "video.id not matching statistics_youtube_api.video_id for new videos",
            "Data pipeline delay for September videos"
          ]
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ September virals troubleshooting error:', error);
    res.status(500).json({ error: 'Failed to troubleshoot September virals', details: error.message });
  }
});

// DEBUG: Detailed breakdown of videos with core concept docs
router.get('/debug/video-breakdown', async (req, res) => {
  try {
    console.log('🔍 Analyzing detailed breakdown of videos with core concept docs...');

    // Query to break down videos by view ranges
    const breakdownQuery = `
      SELECT
        COUNT(*) as total_videos,
        COUNT(CASE WHEN s.views_total >= 3000000 THEN 1 END) as mega_virals_3m_plus,
        COUNT(CASE WHEN s.views_total >= 1000000 AND s.views_total < 3000000 THEN 1 END) as virals_1m_to_3m,
        COUNT(CASE WHEN s.views_total >= 500000 AND s.views_total < 1000000 THEN 1 END) as almost_virals_500k_to_1m,
        COUNT(CASE WHEN s.views_total >= 100000 AND s.views_total < 500000 THEN 1 END) as decent_100k_to_500k,
        COUNT(CASE WHEN s.views_total >= 10000 AND s.views_total < 100000 THEN 1 END) as low_10k_to_100k,
        COUNT(CASE WHEN s.views_total < 10000 OR s.views_total IS NULL THEN 1 END) as very_low_under_10k,
        COUNT(CASE WHEN s.views_total >= 500000 THEN 1 END) as total_viral_500k_plus,
        COUNT(CASE WHEN s.views_total IS NULL THEN 1 END) as no_view_data
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
    `;

    const { rows: breakdownRows } = await pool.query(breakdownQuery);

    // Sample videos from each category
    const sampleQuery = `
      SELECT
        v.id,
        v.script_title,
        COALESCE(s.views_total, 0) as views,
        CASE
          WHEN s.views_total >= 3000000 THEN 'mega_viral_3m+'
          WHEN s.views_total >= 1000000 THEN 'viral_1m-3m'
          WHEN s.views_total >= 500000 THEN 'almost_viral_500k-1m'
          WHEN s.views_total >= 100000 THEN 'decent_100k-500k'
          WHEN s.views_total >= 10000 THEN 'low_10k-100k'
          ELSE 'very_low_under_10k'
        END as category
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
      ORDER BY COALESCE(s.views_total, 0) DESC
      LIMIT 50
    `;

    const { rows: sampleRows } = await pool.query(sampleQuery);

    res.json({
      success: true,
      breakdown: breakdownRows[0],
      sample_videos_by_category: sampleRows,
      explanation: {
        total_with_docs: "1674 videos have core concept docs",
        viral_threshold: "Only 303 videos have 500k+ views (viral threshold)",
        missing_videos: "1371 videos have core concept docs but less than 500k views",
        categories: {
          "mega_virals_3m+": "3M+ views",
          "virals_1m_to_3m": "1M-3M views",
          "almost_virals_500k_to_1m": "500k-1M views",
          "decent_100k_to_500k": "100k-500k views",
          "low_10k_to_100k": "10k-100k views",
          "very_low_under_10k": "Under 10k views or no data"
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Video breakdown error:', error);
    res.status(500).json({ error: 'Failed to analyze video breakdown', details: error.message });
  }
});

// DEBUG: Check if specific September viral videos are in virals endpoint
router.get('/debug/check-september-virals', async (req, res) => {
  try {
    console.log('🔍 Checking if September viral videos appear in virals endpoint...');

    // Get all viral videos from endpoint
    const result = await getAllViralVideosAcrossWriters('30', 1, 500); // Get more videos

    // September viral video IDs we found
    const septemberViralIds = [136183, 136145];

    // Check if they're in the results
    const foundSeptemberVirals = result.videos.filter(video =>
      septemberViralIds.includes(video.id)
    );

    // Get videos posted after Aug 28th from endpoint
    const videosAfterAug28 = result.videos.filter(video =>
      new Date(video.posted_date) >= new Date('2025-08-28')
    );

    res.json({
      success: true,
      analysis: {
        total_viral_videos_from_endpoint: result.videos.length,
        total_available: result.pagination.totalVideos,
        september_viral_ids_to_find: septemberViralIds,
        found_september_virals: {
          count: foundSeptemberVirals.length,
          videos: foundSeptemberVirals
        },
        videos_after_aug28_from_endpoint: {
          count: videosAfterAug28.length,
          videos: videosAfterAug28.slice(0, 10) // Show first 10
        },
        issue_analysis: {
          expected_september_virals: 2,
          found_in_endpoint: foundSeptemberVirals.length,
          missing_count: 2 - foundSeptemberVirals.length,
          possible_causes: [
            "Frontend filtering removing September videos",
            "Google Sheets core concept title lookup failing",
            "Database query issue in getAllViralVideosAcrossWriters",
            "Data type mismatch in joins"
          ]
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ September virals check error:', error);
    res.status(500).json({ error: 'Failed to check September virals', details: error.message });
  }
});

// DEBUG: Test viral counts with Google Sheets filtering
router.get('/debug/viral-counts-with-sheets', async (req, res) => {
  try {
    console.log('🔍 Testing viral counts with Google Sheets filtering...');

    // Get all viral videos from BigQuery
    const viralVideos = await getAllViralVideosAcrossWriters('30', 1, 1000); // Get large sample
    console.log(`📊 BigQuery returned ${viralVideos.videos.length} viral videos`);

    // Get Google Sheets core concept titles
    const sheets = await setupGoogleSheetsClient();
    const spreadsheetId = '1rQ5POXEqdguOQ-91IcFXbRr62UoyPWT4vzILPeujNZs';
    const range = 'Sheet1!B:C'; // Column B (Core Concept Doc URLs) and Column C (Titles)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    const coreConceptTitles = {};

    if (rows && rows.length > 0) {
      // Skip header row (index 0) and process data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row && row.length >= 2) {
          const docUrl = row[0]; // Column B - Core Concept Doc URL
          const title = row[1]; // Column C - Title

          if (docUrl && title) {
            // Extract document ID from Google Docs URL
            const docIdMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
            if (docIdMatch) {
              const docId = docIdMatch[1];
              coreConceptTitles[docId] = title;
            }
          }
        }
      }
    }

    console.log(`📊 Google Sheets returned ${Object.keys(coreConceptTitles).length} core concept titles`);

    // Function to extract document ID from core concept URL (same as frontend)
    const extractDocumentId = (url) => {
      if (!url) return null;
      const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    };

    // Function to get core concept title from URL (same as frontend)
    const getCoreConceptTitle = (coreConceptUrl) => {
      if (!coreConceptUrl) return null;
      const docId = extractDocumentId(coreConceptUrl);
      return docId ? coreConceptTitles[docId] : null;
    };

    // Apply frontend filtering logic
    let filteredVideos = viralVideos.videos.filter(video => {
      // Must have views over 500,000 (already filtered in BigQuery)
      const views = video.views || 0;
      if (views <= 500000) return false;

      // Must have a core concept doc
      if (!video.core_concept_doc) return false;

      // Must have a core concept title from Google Sheets
      const title = getCoreConceptTitle(video.core_concept_doc);
      if (!title) return false;

      return true;
    });

    console.log(`🔥 After Google Sheets filtering: ${filteredVideos.length} videos remain`);

    // Get some examples of filtered out videos
    const filteredOutVideos = viralVideos.videos.filter(video => {
      if (!video.core_concept_doc) return true;
      const title = getCoreConceptTitle(video.core_concept_doc);
      return !title;
    });

    res.json({
      success: true,
      counts: {
        bigquery_total: viralVideos.videos.length,
        google_sheets_titles_available: Object.keys(coreConceptTitles).length,
        after_sheets_filtering: filteredVideos.length,
        filtered_out_count: filteredOutVideos.length
      },
      sample_filtered_videos: filteredVideos.slice(0, 5).map(v => ({
        title: v.title,
        views: v.views,
        writer_name: v.writer_name,
        core_concept_doc: v.core_concept_doc,
        core_concept_title: getCoreConceptTitle(v.core_concept_doc)
      })),
      sample_filtered_out: filteredOutVideos.slice(0, 5).map(v => ({
        title: v.title,
        views: v.views,
        core_concept_doc: v.core_concept_doc,
        reason: !v.core_concept_doc ? 'No core concept doc' : 'Core concept doc not found in Google Sheets'
      })),
      message: 'Viral videos count with Google Sheets filtering complete'
    });
  } catch (error) {
    console.error('❌ Viral counts with sheets error:', error);
    res.status(500).json({ error: 'Viral counts with sheets failed', details: error.message });
  }
});

// DEBUG: Test viral counts with different filters
router.get('/debug/viral-counts-breakdown', async (req, res) => {
  try {
    console.log('🔍 Testing viral counts with different filter levels...');

    if (!global.bigqueryClient) {
      return res.json({ error: 'BigQuery client not available' });
    }

    // Count 1: All videos with 500k+ views
    const count1Query = `
      WITH latest_metadata AS (
        SELECT
          m.video_id,
          m.statistics_view_count,
          ROW_NUMBER() OVER (
            PARTITION BY m.video_id
            ORDER BY m.snapshot_date DESC
          ) AS rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
        WHERE m.statistics_view_count IS NOT NULL
          AND CAST(m.statistics_view_count AS INT64) >= 500000
      )
      SELECT COUNT(*) as total
      FROM latest_metadata
      WHERE rn = 1
    `;

    // Count 2: Videos with 500k+ views that have matching video records
    const count2Query = `
      WITH video_base AS (
        SELECT
          v.url,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.statistics_view_count,
          ROW_NUMBER() OVER (
            PARTITION BY m.video_id
            ORDER BY m.snapshot_date DESC
          ) AS rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
        WHERE m.statistics_view_count IS NOT NULL
          AND CAST(m.statistics_view_count AS INT64) >= 500000
      )
      SELECT COUNT(*) as total
      FROM video_base v
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE meta.rn = 1 AND meta.statistics_view_count IS NOT NULL
    `;

    // Count 3: Videos with 500k+ views + core concept docs
    const count3Query = `
      WITH video_base AS (
        SELECT
          v.url,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.statistics_view_count,
          ROW_NUMBER() OVER (
            PARTITION BY m.video_id
            ORDER BY m.snapshot_date DESC
          ) AS rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
        WHERE m.statistics_view_count IS NOT NULL
          AND CAST(m.statistics_view_count AS INT64) >= 500000
      )
      SELECT COUNT(*) as total
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE meta.rn = 1
        AND meta.statistics_view_count IS NOT NULL
        AND s.core_concept_doc IS NOT NULL
        AND s.core_concept_doc != ''
    `;

    const [count1] = await global.bigqueryClient.query({ query: count1Query });
    const [count2] = await global.bigqueryClient.query({ query: count2Query });
    const [count3] = await global.bigqueryClient.query({ query: count3Query });

    res.json({
      success: true,
      breakdown: {
        step1_all_500k_plus_videos: parseInt(count1[0].total),
        step2_with_video_records: parseInt(count2[0].total),
        step3_with_core_concept_docs: parseInt(count3[0].total),
        final_available_for_frontend: parseInt(count3[0].total)
      },
      message: 'Viral videos count breakdown complete',
      note: 'Frontend may apply additional Google Sheets filtering which could reduce the final count'
    });
  } catch (error) {
    console.error('❌ Viral counts breakdown error:', error);
    res.status(500).json({ error: 'Viral counts breakdown failed', details: error.message });
  }
});

// DEBUG: Test BigQuery connectivity
router.get('/debug/test-bigquery-simple', async (req, res) => {
  try {
    console.log('🔍 Testing simple BigQuery connectivity...');

    if (!global.bigqueryClient) {
      return res.json({ error: 'BigQuery client not available' });
    }

    const simpleQuery = `
      SELECT COUNT(*) as total_videos
      FROM \`speedy-web-461014-g3.postgres.video\`
      WHERE url LIKE '%youtube.com%' OR url LIKE '%youtu.be%'
    `;

    const [rows] = await global.bigqueryClient.query({ query: simpleQuery });

    res.json({
      success: true,
      bigquery_available: true,
      total_youtube_videos: rows[0].total_videos,
      message: 'BigQuery connectivity test successful'
    });
  } catch (error) {
    console.error('❌ BigQuery test error:', error);
    res.status(500).json({ error: 'BigQuery test failed', details: error.message });
  }
});

// DEBUG: Test virals endpoint without auth
router.get('/debug/test-virals', async (req, res) => {
  try {
    console.log('🔥 Testing virals endpoint without auth...');
    const result = await getAllViralVideosAcrossWriters('30', 1, 10);
    res.json({
      success: true,
      count: result.videos.length,
      totalAvailable: result.pagination.totalVideos,
      sampleVideos: result.videos.slice(0, 5),
      message: `Found ${result.pagination.totalVideos} total viral videos (no date filter applied)`
    });
  } catch (error) {
    console.error('❌ Test virals error:', error);
    res.status(500).json({ error: 'Failed to test virals', details: error.message });
  }
});

// DEBUG: Test September virals with different JOIN strategies
router.get('/debug/september-virals-joins', async (req, res) => {
  try {
    console.log('🔍 Testing September virals with different JOIN strategies...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Query 1: INNER JOIN (like our main query)
    const innerJoinQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(v.url, r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})') AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT s.trello_card_id, s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT m.video_id, m.statistics_view_count, m.snippet_published_at
        FROM (
          SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.video_id ORDER BY m.snapshot_date DESC) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as count_inner_join
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND meta.snippet_published_at >= '2025-09-12'
    `;

    // Query 2: LEFT JOIN (more inclusive)
    const leftJoinQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(v.url, r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})') AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT s.trello_card_id, s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT m.video_id, m.statistics_view_count, m.snippet_published_at
        FROM (
          SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.video_id ORDER BY m.snapshot_date DESC) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as count_left_join
      FROM video_base v
      LEFT JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND meta.snippet_published_at >= '2025-09-12'
    `;

    const [innerResult] = await global.bigqueryClient.query({ query: innerJoinQuery });
    const [leftResult] = await global.bigqueryClient.query({ query: leftJoinQuery });

    res.json({
      success: true,
      join_comparison: {
        inner_join_count: innerResult[0].count_inner_join,
        left_join_count: leftResult[0].count_left_join,
        missing_due_to_script_join: leftResult[0].count_left_join - innerResult[0].count_inner_join
      },
      analysis: {
        user_found: 22,
        our_inner_join: innerResult[0].count_inner_join,
        our_left_join: leftResult[0].count_left_join,
        conclusion: innerResult[0].count_inner_join === 22 ? "INNER JOIN is correct" : "INNER JOIN is excluding videos"
      }
    });
  } catch (error) {
    console.error('❌ September virals JOIN analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze JOINs', details: error.message });
  }
});

// NEW: Dynamic virals endpoint with sorting and filtering
router.get('/public/virals-dynamic', async (req, res) => {
  try {
    const { sortBy = 'title', sortOrder = 'asc', limit = '35' } = req.query;
    console.log(`🔥 DYNAMIC VIRALS: sortBy: ${sortBy}, sortOrder: ${sortOrder}, limit: ${limit}`);

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Get ALL viral videos first (no pagination limit in BigQuery)
    const allViralQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        s.google_doc_link,
        s.approval_status,
        s.created_at,
        s.ai_chat_url,
        s.inspiration_link,
        s.core_concept_doc,
        v.url,
        v.writer_id,
        w.name as writer_name,
        meta.snippet_title,
        meta.snippet_channel_title,
        meta.content_details_duration,
        meta.statistics_view_count,
        meta.snippet_published_at,
        meta.thumbnail_url
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta
        ON v.video_id = meta.video_id
      LEFT JOIN \`speedy-web-461014-g3.postgres.writer\` w
        ON v.writer_id = w.id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
    `;

    const [rows] = await global.bigqueryClient.query({
      query: allViralQuery
    });

    console.log(`📊 BigQuery returned ${rows.length} total viral videos`);

    // Transform data
    const transformedVideos = rows.map(row => {
      let formattedDate = null;
      if (row.snippet_published_at && row.snippet_published_at.value) {
        formattedDate = new Date(row.snippet_published_at.value).toISOString();
      } else if (row.snippet_published_at) {
        formattedDate = new Date(row.snippet_published_at).toISOString();
      }

      return {
        id: parseInt(row.writer_id) || Math.floor(Math.random() * 1000000),
        title: row.snippet_title,
        url: row.url,
        writer_id: parseInt(row.writer_id),
        writer_name: row.writer_name,
        views: parseInt(row.statistics_view_count) || 0,
        posted_date: formattedDate,
        core_concept_doc: row.core_concept_doc,
        preview: row.thumbnail_url, // Use BigQuery thumbnail
        duration: row.content_details_duration, // Use BigQuery duration
        type: 'viral'
      };
    }).filter(video => video.posted_date !== null);

    console.log(`📊 After transformation: ${transformedVideos.length} videos`);

    res.json({
      success: true,
      videos: transformedVideos,
      totalVideos: transformedVideos.length,
      sortBy,
      sortOrder,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Dynamic virals error:', error);
    res.status(500).json({ error: 'Failed to fetch dynamic virals', details: error.message });
  }
});

// DEBUG: Test exact query from getAllViralVideosAcrossWriters for September
router.get('/debug/september-exact-query', async (req, res) => {
  try {
    console.log('🔍 Testing exact getAllViralVideosAcrossWriters query for September...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // EXACT query from getAllViralVideosAcrossWriters with September filter
    const exactQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        s.google_doc_link,
        s.approval_status,
        s.created_at,
        s.ai_chat_url,
        s.inspiration_link,
        s.core_concept_doc,
        v.url,
        v.writer_id,
        w.name as writer_name,
        meta.snippet_title,
        meta.snippet_channel_title,
        meta.content_details_duration,
        meta.statistics_view_count,
        meta.snippet_published_at,
        meta.thumbnail_url
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta
        ON v.video_id = meta.video_id
      LEFT JOIN \`speedy-web-461014-g3.postgres.writer\` w
        ON v.writer_id = w.id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND meta.snippet_published_at >= '2025-09-12'
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    const [rows] = await global.bigqueryClient.query({
      query: exactQuery
    });

    console.log(`📊 Exact query found ${rows.length} September viral videos`);

    // Apply the same data transformation as getAllViralVideosAcrossWriters
    const transformedVideos = rows.map(row => {
      let formattedDate = null;
      if (row.snippet_published_at && row.snippet_published_at.value) {
        formattedDate = new Date(row.snippet_published_at.value).toISOString();
      } else if (row.snippet_published_at) {
        formattedDate = new Date(row.snippet_published_at).toISOString();
      }

      return {
        id: parseInt(row.writer_id) || Math.floor(Math.random() * 1000000),
        title: row.snippet_title,
        url: row.url,
        writer_id: parseInt(row.writer_id),
        writer_name: row.writer_name,
        views: parseInt(row.statistics_view_count) || 0,
        posted_date: formattedDate,
        core_concept_doc: row.core_concept_doc,
        type: 'viral'
      };
    }).filter(video => video.posted_date !== null); // Filter out videos with null dates

    res.json({
      success: true,
      raw_bigquery_count: rows.length,
      transformed_count: transformedVideos.length,
      videos: transformedVideos.slice(0, 10), // Show first 10
      comparison: {
        user_analysis: 22,
        exact_bigquery: rows.length,
        after_transformation: transformedVideos.length,
        api_endpoint: 6
      }
    });
  } catch (error) {
    console.error('❌ September exact query error:', error);
    res.status(500).json({ error: 'Failed to run exact query', details: error.message });
  }
});

// DEBUG: Test September virals specifically to match user's BigQuery analysis
router.get('/debug/september-virals-bigquery', async (req, res) => {
  try {
    console.log('🔍 Testing September virals with direct BigQuery...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Direct BigQuery query to match user's analysis
    const septemberQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.statistics_view_count,
          m.snippet_published_at
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        s.core_concept_doc,
        CAST(meta.statistics_view_count AS INT64) as statistics_view_count,
        meta.snippet_published_at,
        v.writer_id,
        w.name as writer_name
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      LEFT JOIN \`speedy-web-461014-g3.postgres.writer\` w ON v.writer_id = w.id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND meta.snippet_published_at >= '2025-09-12'
      ORDER BY meta.snippet_published_at DESC
    `;

    const [rows] = await global.bigqueryClient.query({
      query: septemberQuery
    });

    console.log(`📊 Direct BigQuery found ${rows.length} September viral videos`);

    // Test the same data transformation logic as getAllViralVideosAcrossWriters
    const transformedVideos = rows.map(row => {
      let formattedDate = null;
      if (row.snippet_published_at && row.snippet_published_at.value) {
        formattedDate = new Date(row.snippet_published_at.value).toISOString();
      } else if (row.snippet_published_at) {
        formattedDate = new Date(row.snippet_published_at).toISOString();
      }

      return {
        core_concept_doc: row.core_concept_doc,
        views: row.statistics_view_count,
        published_at: row.snippet_published_at?.value || row.snippet_published_at,
        formatted_date: formattedDate,
        writer_id: row.writer_id,
        writer_name: row.writer_name,
        date_parsing_success: formattedDate !== null
      };
    });

    const videosWithNullDates = transformedVideos.filter(v => !v.date_parsing_success);

    res.json({
      success: true,
      total_september_virals: rows.length,
      videos: transformedVideos,
      videos_with_null_dates: {
        count: videosWithNullDates.length,
        videos: videosWithNullDates
      },
      comparison: {
        user_analysis: 22,
        our_bigquery: rows.length,
        api_endpoint: 6,
        discrepancy: 22 - rows.length
      }
    });
  } catch (error) {
    console.error('❌ September virals BigQuery error:', error);
    res.status(500).json({ error: 'Failed to query September virals', details: error.message });
  }
});

// PUBLIC: Get all viral videos across all writers (for virals tab) - NO AUTH REQUIRED
router.get('/public/virals', async (req, res) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    console.log(`🔥 PUBLIC VIRALS: Getting all viral videos, page: ${page}, limit: ${limit}`);

    // Always use lifetime range for virals tab - no date filtering
    const result = await getAllViralVideosAcrossWriters('lifetime', parseInt(page), parseInt(limit));

    res.json({
      videos: result.videos,
      pagination: result.pagination,
      typeCounts: {
        all: result.pagination.totalVideos,
        virals: result.pagination.totalVideos
      }
    });
  } catch (error) {
    console.error('❌ Public virals failed:', error);
    res.status(500).json({ error: 'Failed to fetch viral videos', details: error.message });
  }
});

// DEBUG: Step-by-step workflow analysis to find where September virals are lost
router.get('/debug/workflow-analysis', async (req, res) => {
  try {
    console.log('🔍 Step-by-step workflow analysis for September virals...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Step 1: Check video_base CTE
    const step1Query = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      )
      SELECT COUNT(*) as video_base_count
      FROM video_base
      WHERE video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
    `;

    // Step 2: Check script_base CTE
    const step2Query = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      )
      SELECT COUNT(*) as video_script_join_count
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      WHERE v.video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
    `;

    // Step 3: Check latest_metadata CTE
    const step3Query = `
      WITH latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as metadata_count
      FROM latest_metadata
      WHERE video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
    `;

    // Step 4: Check full JOIN with metadata
    const step4Query = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as full_join_count
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE v.video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
    `;

    // Step 5: Check with core concept filter
    const step5Query = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as with_core_concept_count
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE v.video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
      AND s.core_concept_doc IS NOT NULL
      AND s.core_concept_doc != ''
    `;

    // Step 6: Check with viral views filter
    const step6Query = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT COUNT(*) as final_viral_count
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE v.video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
      AND CAST(meta.statistics_view_count AS INT64) >= 500000
      AND s.core_concept_doc IS NOT NULL
      AND s.core_concept_doc != ''
    `;

    // Execute all steps
    const [step1Result] = await global.bigqueryClient.query({ query: step1Query });
    const [step2Result] = await global.bigqueryClient.query({ query: step2Query });
    const [step3Result] = await global.bigqueryClient.query({ query: step3Query });
    const [step4Result] = await global.bigqueryClient.query({ query: step4Query });
    const [step5Result] = await global.bigqueryClient.query({ query: step5Query });
    const [step6Result] = await global.bigqueryClient.query({ query: step6Query });

    // Get detailed breakdown of which videos fail at each step
    const detailQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        v.video_id,
        meta.snippet_title,
        CAST(meta.statistics_view_count AS INT64) as views,
        s.core_concept_doc,
        CASE WHEN s.core_concept_doc IS NULL OR s.core_concept_doc = '' THEN 'NO_CORE_CONCEPT' ELSE 'HAS_CORE_CONCEPT' END as core_concept_status,
        CASE WHEN CAST(meta.statistics_view_count AS INT64) >= 500000 THEN 'VIRAL' ELSE 'NOT_VIRAL' END as viral_status,
        CASE
          WHEN s.core_concept_doc IS NULL OR s.core_concept_doc = '' THEN 'FAILED_CORE_CONCEPT'
          WHEN CAST(meta.statistics_view_count AS INT64) < 500000 THEN 'FAILED_VIEWS'
          ELSE 'PASSED_ALL'
        END as failure_reason
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE v.video_id IN (
        'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
        '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
      )
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    const [detailResult] = await global.bigqueryClient.query({ query: detailQuery });

    res.json({
      success: true,
      workflow_analysis: {
        step1_video_base: {
          description: "Videos found in video table with extracted video_ids",
          count: step1Result[0].video_base_count,
          expected: 9
        },
        step2_script_join: {
          description: "Videos that successfully join with script table",
          count: step2Result[0].video_script_join_count,
          expected: 9
        },
        step3_metadata_available: {
          description: "Videos that have metadata in youtube_metadata_historical",
          count: step3Result[0].metadata_count,
          expected: 9
        },
        step4_full_join: {
          description: "Videos after all JOINs (video + script + metadata)",
          count: step4Result[0].full_join_count,
          expected: 9
        },
        step5_core_concept_filter: {
          description: "Videos with core concept docs",
          count: step5Result[0].with_core_concept_count,
          expected: 9
        },
        step6_viral_filter: {
          description: "Final viral videos (500k+ views + core concept)",
          count: step6Result[0].final_viral_count,
          expected: 9
        }
      },
      detailed_breakdown: {
        videos: detailResult.map(row => ({
          video_id: row.video_id,
          title: row.snippet_title,
          views: parseInt(row.views),
          core_concept_status: row.core_concept_status,
          viral_status: row.viral_status,
          failure_reason: row.failure_reason,
          core_concept_doc: row.core_concept_doc ? 'HAS_DOC' : 'NO_DOC'
        })),
        summary: {
          failed_core_concept: detailResult.filter(r => r.failure_reason === 'FAILED_CORE_CONCEPT').length,
          failed_views: detailResult.filter(r => r.failure_reason === 'FAILED_VIEWS').length,
          passed_all: detailResult.filter(r => r.failure_reason === 'PASSED_ALL').length
        }
      },
      analysis: {
        bottleneck_step: step1Result[0].video_base_count < 9 ? "video_base" :
                        step2Result[0].video_script_join_count < 9 ? "script_join" :
                        step3Result[0].metadata_count < 9 ? "metadata_availability" :
                        step4Result[0].full_join_count < 9 ? "full_join" :
                        step5Result[0].with_core_concept_count < 9 ? "core_concept_filter" :
                        step6Result[0].final_viral_count < 9 ? "viral_filter" : "no_bottleneck",
        september_video_ids_tested: [
          'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
          '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Workflow analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze workflow', details: error.message });
  }
});

// DEBUG: Check why September virals are missing from main virals endpoint
router.get('/debug/missing-september-virals', async (req, res) => {
  try {
    console.log('🔍 Debugging why September virals are missing from main endpoint...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Test with the correct 9 September video IDs that have core concept docs
    const septemberViralIds = [
      'wZosDVBE0Cs', 'GSScFOsKB_U', 'mBTVlkN_-wE', 'pe5MafGU_7Q', 'ZDiXgAw94W8',
      'zcRuP1uMKN0', 'JTUnX-i4EiM', 'KeVzbUN8hik', '3bcNw44p_9U'
    ];

    // Get the exact same query as the main virals endpoint but with debug info
    const debugQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        s.google_doc_link,
        s.approval_status,
        s.created_at,
        s.ai_chat_url,
        s.inspiration_link,
        s.core_concept_doc,
        v.url,
        v.writer_id,
        w.name as writer_name,
        meta.snippet_title,
        meta.snippet_channel_title,
        meta.content_details_duration,
        meta.statistics_view_count,
        meta.snippet_published_at,
        meta.thumbnail_url,
        -- Debug fields
        CASE WHEN meta.video_id IS NULL THEN 'NO_METADATA' ELSE 'HAS_METADATA' END as metadata_status,
        CASE WHEN s.core_concept_doc IS NULL OR s.core_concept_doc = '' THEN 'NO_CORE_CONCEPT' ELSE 'HAS_CORE_CONCEPT' END as core_concept_status,
        CASE WHEN CAST(meta.statistics_view_count AS INT64) >= 500000 THEN 'VIRAL' ELSE 'NOT_VIRAL' END as viral_status,
        DATE(meta.snippet_published_at) as publish_date
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta
        ON v.video_id = meta.video_id
      LEFT JOIN \`speedy-web-461014-g3.postgres.writer\` w
        ON v.writer_id = w.id
      WHERE v.video_id IN (${septemberViralIds.map(id => `'${id}'`).join(', ')})
        AND CAST(meta.statistics_view_count AS INT64) >= 500000
        AND s.core_concept_doc IS NOT NULL
        AND s.core_concept_doc != ''
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    const [debugResult] = await global.bigqueryClient.query({
      query: debugQuery
    });

    // Also get the total count from the main endpoint for comparison
    const mainEndpointResult = await getAllViralVideosAcrossWriters('lifetime', 1, 1000);

    res.json({
      success: true,
      debug_september_virals: {
        count: debugResult.length,
        videos: debugResult.map(row => ({
          video_id: row.video_id,
          title: row.snippet_title,
          views: parseInt(row.statistics_view_count),
          published_at: row.snippet_published_at,
          publish_date: row.publish_date,
          core_concept_doc: row.core_concept_doc,
          writer_name: row.writer_name,
          metadata_status: row.metadata_status,
          core_concept_status: row.core_concept_status,
          viral_status: row.viral_status
        }))
      },
      main_endpoint_comparison: {
        total_count: mainEndpointResult.pagination.totalVideos,
        returned_count: mainEndpointResult.videos.length,
        september_videos_in_main: mainEndpointResult.videos.filter(v =>
          new Date(v.posted_date) >= new Date('2025-09-12')
        ).length
      },
      analysis: {
        september_virals_found_in_debug: debugResult.length,
        september_virals_in_main_endpoint: mainEndpointResult.videos.filter(v =>
          new Date(v.posted_date) >= new Date('2025-09-12')
        ).length,
        issue: debugResult.length > mainEndpointResult.videos.filter(v =>
          new Date(v.posted_date) >= new Date('2025-09-12')
        ).length ? 'Main endpoint missing September videos' : 'No issue found'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug missing September virals error:', error);
    res.status(500).json({ error: 'Failed to debug missing September virals', details: error.message });
  }
});

// DEBUG: Find ALL September virals (12 total) to identify the missing 3 video IDs
router.get('/debug/all-september-virals', async (req, res) => {
  try {
    console.log('🔍 Finding ALL September virals (should be 12 total)...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Your exact query to find all 12 September virals
    const allSeptemberQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        v.video_id,
        s.google_doc_link,
        s.approval_status,
        s.created_at,
        s.ai_chat_url,
        s.inspiration_link,
        s.core_concept_doc,
        v.url,
        meta.snippet_title,
        meta.snippet_channel_title,
        meta.content_details_duration,
        meta.statistics_view_count,
        meta.thumbnail_url,
        meta.snippet_published_at
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta
        ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND DATE(meta.snippet_published_at) >= '2025-09-12'
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    const [allSeptemberResult] = await global.bigqueryClient.query({
      query: allSeptemberQuery
    });

    const myTestedVideoIds = [
      'Hl_0DB2LwqA', 'GhR9G62dmok', 'GmZoShranAE', 'Mv_5N8UxemI',
      '710RLnRve30', 'SsxlxZkA5mk', 'MeBl3mS3z7c', 'oC4sFr-qn28', 'K0a0pKgo4EE'
    ];

    const allVideoIds = allSeptemberResult.map(row => row.video_id);
    const missingVideoIds = allVideoIds.filter(id => !myTestedVideoIds.includes(id));

    res.json({
      success: true,
      all_september_virals: {
        total_count: allSeptemberResult.length,
        videos: allSeptemberResult.map(row => ({
          video_id: row.video_id,
          title: row.snippet_title,
          views: parseInt(row.statistics_view_count),
          published_at: row.snippet_published_at,
          has_core_concept: row.core_concept_doc ? true : false,
          core_concept_doc: row.core_concept_doc
        }))
      },
      analysis: {
        total_september_virals: allSeptemberResult.length,
        videos_i_tested: myTestedVideoIds.length,
        missing_video_ids: missingVideoIds,
        videos_with_core_concept: allSeptemberResult.filter(row => row.core_concept_doc).length,
        videos_without_core_concept: allSeptemberResult.filter(row => !row.core_concept_doc).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ All September virals error:', error);
    res.status(500).json({ error: 'Failed to get all September virals', details: error.message });
  }
});

// DEBUG: Compare main query vs debug query to find the difference
router.get('/debug/query-comparison', async (req, res) => {
  try {
    console.log('🔍 Comparing main query vs debug query...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Main query (exactly as used in getAllViralVideosAcrossWriters)
    const mainQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        v.video_id,
        meta.snippet_title,
        CAST(meta.statistics_view_count AS INT64) as views,
        DATE(meta.snippet_published_at) as publish_date
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND s.core_concept_doc IS NOT NULL
        AND s.core_concept_doc != ''
        AND DATE(meta.snippet_published_at) >= '2025-09-12'
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    // Debug query (your original query)
    const debugQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        v.video_id,
        meta.snippet_title,
        CAST(meta.statistics_view_count AS INT64) as views,
        DATE(meta.snippet_published_at) as publish_date
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND DATE(meta.snippet_published_at) >= '2025-09-12'
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    const [mainResult] = await global.bigqueryClient.query({ query: mainQuery });
    const [debugResult] = await global.bigqueryClient.query({ query: debugQuery });

    const mainVideoIds = mainResult.map(row => row.video_id);
    const debugVideoIds = debugResult.map(row => row.video_id);

    const missingInMain = debugVideoIds.filter(id => !mainVideoIds.includes(id));
    const extraInMain = mainVideoIds.filter(id => !debugVideoIds.includes(id));

    res.json({
      success: true,
      comparison: {
        main_query_results: mainResult.length,
        debug_query_results: debugResult.length,
        missing_in_main: missingInMain,
        extra_in_main: extraInMain,
        main_video_ids: mainVideoIds,
        debug_video_ids: debugVideoIds
      },
      analysis: {
        difference: `Main query returns ${mainResult.length}, debug query returns ${debugResult.length}`,
        issue: missingInMain.length > 0 ? `Main query missing: ${missingInMain.join(', ')}` : 'No missing videos'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Query comparison error:', error);
    res.status(500).json({ error: 'Failed to compare queries', details: error.message });
  }
});

// DEBUG: Check which September virals have Google Sheets title mappings
router.get('/debug/september-title-mappings', async (req, res) => {
  try {
    console.log('🔍 Checking September virals Google Sheets title mappings...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Get all September virals with core concept docs
    const septemberQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.google_doc_link,
          s.approval_status,
          s.created_at,
          s.ai_chat_url,
          s.inspiration_link,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.snippet_channel_title,
          m.content_details_duration,
          m.statistics_view_count,
          m.snippet_published_at,
          COALESCE(
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.maxres.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.standard.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.high.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.medium.url"),
            JSON_EXTRACT_SCALAR(m.snippet_thumbnails, "$.default.url")
          ) AS thumbnail_url
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
        ) m
        WHERE rn = 1
      )
      SELECT
        v.video_id,
        s.core_concept_doc,
        meta.snippet_title,
        CAST(meta.statistics_view_count AS INT64) as views,
        meta.snippet_published_at
      FROM video_base v
      JOIN script_base s ON v.trello_card_id = s.trello_card_id
      LEFT JOIN latest_metadata meta ON v.video_id = meta.video_id
      WHERE CAST(meta.statistics_view_count AS INT64) >= 500000
        AND s.core_concept_doc IS NOT NULL
        AND s.core_concept_doc != ''
        AND DATE(meta.snippet_published_at) >= '2025-09-12'
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
    `;

    const [septemberResult] = await global.bigqueryClient.query({ query: septemberQuery });

    // Function to extract document ID from Google Docs URL
    const extractDocumentId = (url) => {
      if (!url) return null;
      const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    };

    // Get Google Sheets core concept titles using existing pattern
    const sheets = await setupGoogleSheetsClient();
    const spreadsheetId = '1rQ5POXEqdguOQ-91IcFXbRr62UoyPWT4vzILPeujNZs';
    const range = 'Sheet1!B:C'; // Column B (Core Concept Doc URLs) and Column C (Titles)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    const coreConceptTitles = {};

    if (rows && rows.length > 1) {
      // Skip header row and process data
      for (let i = 1; i < rows.length; i++) {
        const [docUrl, title] = rows[i];
        if (docUrl && title) {
          const docId = extractDocumentId(docUrl);
          if (docId) {
            coreConceptTitles[docId] = title;
          }
        }
      }
    }

    // Check which videos have title mappings
    const videosWithMappings = [];
    const videosWithoutMappings = [];

    septemberResult.forEach(video => {
      const docId = extractDocumentId(video.core_concept_doc);
      const hasMapping = docId && coreConceptTitles[docId];

      const videoData = {
        video_id: video.video_id,
        title: video.snippet_title,
        views: parseInt(video.views),
        published_at: video.snippet_published_at,
        core_concept_doc: video.core_concept_doc,
        doc_id: docId,
        google_sheets_title: hasMapping ? coreConceptTitles[docId] : null
      };

      if (hasMapping) {
        videosWithMappings.push(videoData);
      } else {
        videosWithoutMappings.push(videoData);
      }
    });

    res.json({
      success: true,
      september_virals_analysis: {
        total_september_virals: septemberResult.length,
        videos_with_title_mappings: videosWithMappings.length,
        videos_without_title_mappings: videosWithoutMappings.length,
        videos_with_mappings: videosWithMappings,
        videos_without_mappings: videosWithoutMappings
      },
      google_sheets_info: {
        total_titles_in_sheets: Object.keys(coreConceptTitles).length,
        sample_titles: Object.entries(coreConceptTitles).slice(0, 5).map(([docId, title]) => ({ docId, title }))
      },
      analysis: {
        issue: videosWithoutMappings.length > 0 ?
          `${videosWithoutMappings.length} September virals missing Google Sheets title mappings` :
          'All September virals have title mappings',
        frontend_will_show: videosWithMappings.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ September title mappings error:', error);
    res.status(500).json({ error: 'Failed to check title mappings', details: error.message });
  }
});

// DEBUG: Check BigQuery virals from September 12th onwards with 500k+ views and core concept docs
router.get('/debug/september-virals-count', async (req, res) => {
  try {
    console.log('🔍 Checking BigQuery virals from September 12th onwards...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Query to count virals from September 12th onwards with core concept docs
    const countQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
        WHERE s.core_concept_doc IS NOT NULL
          AND s.core_concept_doc != ''
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.statistics_view_count,
          m.snippet_published_at
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
            AND CAST(m.statistics_view_count AS INT64) >= 500000
            AND DATE(m.snippet_published_at) >= '2025-09-12'
        ) m
        WHERE rn = 1
      )
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN CAST(meta.statistics_view_count AS INT64) >= 500000 THEN 1 END) as over_500k_count,
        COUNT(CASE WHEN CAST(meta.statistics_view_count AS INT64) >= 1000000 THEN 1 END) as over_1m_count,
        MIN(DATE(meta.snippet_published_at)) as earliest_date,
        MAX(DATE(meta.snippet_published_at)) as latest_date
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      JOIN latest_metadata meta
        ON v.video_id = meta.video_id
    `;

    const [countResult] = await global.bigqueryClient.query({
      query: countQuery
    });

    // Also get sample videos
    const sampleQuery = `
      WITH video_base AS (
        SELECT
          v.url,
          v.writer_id,
          REGEXP_EXTRACT(
            v.url,
            r'(?:youtu\.be/|youtube\.com/(?:shorts/|watch\\?v=))([A-Za-z0-9_-]{6,})'
          ) AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      script_base AS (
        SELECT
          s.trello_card_id,
          s.core_concept_doc
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s
        WHERE s.core_concept_doc IS NOT NULL
          AND s.core_concept_doc != ''
      ),
      latest_metadata AS (
        SELECT
          m.video_id,
          m.snippet_title,
          m.statistics_view_count,
          m.snippet_published_at
        FROM (
          SELECT m.*,
            ROW_NUMBER() OVER (
              PARTITION BY m.video_id
              ORDER BY m.snapshot_date DESC
            ) AS rn
          FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
          WHERE m.statistics_view_count IS NOT NULL
            AND CAST(m.statistics_view_count AS INT64) >= 500000
            AND DATE(m.snippet_published_at) >= '2025-09-12'
        ) m
        WHERE rn = 1
      )
      SELECT
        v.video_id,
        meta.snippet_title,
        meta.statistics_view_count,
        meta.snippet_published_at,
        s.core_concept_doc,
        w.name as writer_name
      FROM video_base v
      JOIN script_base s
        ON v.trello_card_id = s.trello_card_id
      JOIN latest_metadata meta
        ON v.video_id = meta.video_id
      LEFT JOIN \`speedy-web-461014-g3.postgres.writer\` w
        ON v.writer_id = w.id
      ORDER BY CAST(meta.statistics_view_count AS INT64) DESC
      LIMIT 20
    `;

    const [sampleResult] = await global.bigqueryClient.query({
      query: sampleQuery
    });

    res.json({
      success: true,
      counts: countResult[0] || {},
      sample_videos: sampleResult.map(row => ({
        video_id: row.video_id,
        title: row.snippet_title,
        views: parseInt(row.statistics_view_count),
        published_at: row.snippet_published_at,
        core_concept_doc: row.core_concept_doc,
        writer_name: row.writer_name
      })),
      query_info: {
        date_filter: 'September 12th, 2025 onwards',
        view_threshold: '500,000+',
        requires_core_concept_doc: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ September virals count error:', error);
    res.status(500).json({ error: 'Failed to check September virals', details: error.message });
  }
});

// DEBUG: Check recent viral videos and BigQuery data freshness
router.get('/debug/recent-virals', async (req, res) => {
  try {
    console.log('🔍 Checking recent viral videos and BigQuery data freshness...');

    if (!global.bigqueryClient) {
      return res.status(500).json({ error: 'BigQuery client not available' });
    }

    // Check latest data in BigQuery metadata table
    const latestDataQuery = `
      SELECT
        MAX(snapshot_date) as latest_snapshot,
        COUNT(DISTINCT video_id) as total_videos,
        COUNT(DISTINCT CASE WHEN DATE(snapshot_date) >= '2024-09-12' THEN video_id END) as videos_since_sept12,
        COUNT(DISTINCT CASE WHEN CAST(statistics_view_count AS INT64) >= 500000 THEN video_id END) as viral_videos_500k,
        COUNT(DISTINCT CASE WHEN CAST(statistics_view_count AS INT64) >= 500000 AND DATE(snippet_published_at) >= '2024-09-12' THEN video_id END) as viral_videos_500k_since_sept12
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
      WHERE statistics_view_count IS NOT NULL
    `;

    const [latestDataResult] = await global.bigqueryClient.query({
      query: latestDataQuery
    });

    // Check recent videos with high views (might be viral soon)
    const recentHighViewsQuery = `
      WITH latest_metadata AS (
        SELECT
          video_id,
          snippet_published_at,
          statistics_view_count,
          snippet_title,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY snapshot_date DESC) as rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE statistics_view_count IS NOT NULL
          AND snippet_published_at IS NOT NULL
      )
      SELECT
        video_id,
        snippet_published_at,
        CAST(statistics_view_count AS INT64) as views,
        snippet_title
      FROM latest_metadata
      WHERE rn = 1
        AND DATE(snippet_published_at) >= '2024-09-12'
        AND CAST(statistics_view_count AS INT64) >= 100000
      ORDER BY CAST(statistics_view_count AS INT64) DESC
      LIMIT 20
    `;

    const [recentHighViewsResult] = await global.bigqueryClient.query({
      query: recentHighViewsQuery
    });

    // Check if any recent videos have core concept docs
    const recentWithDocsQuery = `
      WITH recent_videos AS (
        SELECT DISTINCT
          v.url,
          REGEXP_EXTRACT(v.url, r'(?:youtu\\.be/|youtube\\.com/(?:shorts/|watch\\\\?v=))([A-Za-z0-9_-]{6,})') AS video_id,
          v.trello_card_id
        FROM \`speedy-web-461014-g3.postgres.video\` v
        WHERE v.url IS NOT NULL
      ),
      recent_metadata AS (
        SELECT
          m.video_id,
          m.snippet_published_at,
          CAST(m.statistics_view_count AS INT64) as views,
          m.snippet_title,
          ROW_NUMBER() OVER (PARTITION BY m.video_id ORDER BY m.snapshot_date DESC) as rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\` m
        WHERE m.statistics_view_count IS NOT NULL
          AND DATE(m.snippet_published_at) >= '2024-09-12'
      )
      SELECT
        rv.video_id,
        rm.snippet_published_at,
        rm.views,
        rm.snippet_title,
        s.core_concept_doc
      FROM recent_videos rv
      JOIN recent_metadata rm ON rv.video_id = rm.video_id AND rm.rn = 1
      JOIN \`speedy-web-461014-g3.dbt_youtube_analytics.script\` s ON rv.trello_card_id = s.trello_card_id
      WHERE s.core_concept_doc IS NOT NULL
        AND s.core_concept_doc != ''
        AND rm.views >= 100000
      ORDER BY rm.views DESC
      LIMIT 15
    `;

    const [recentWithDocsResult] = await global.bigqueryClient.query({
      query: recentWithDocsQuery
    });

    res.json({
      success: true,
      latest_data_info: latestDataResult[0],
      recent_high_views_videos: recentHighViewsResult.map(row => ({
        video_id: row.video_id,
        published_at: row.snippet_published_at,
        views: row.views,
        title: row.snippet_title?.substring(0, 80),
        is_viral: row.views >= 500000
      })),
      recent_videos_with_docs: recentWithDocsResult.map(row => ({
        video_id: row.video_id,
        published_at: row.snippet_published_at,
        views: row.views,
        title: row.snippet_title?.substring(0, 80),
        core_concept_doc: row.core_concept_doc?.substring(0, 50),
        is_viral: row.views >= 500000
      })),
      analysis: {
        bigquery_data_freshness: latestDataResult[0]?.latest_snapshot,
        videos_since_sept12: latestDataResult[0]?.videos_since_sept12,
        viral_videos_since_sept12: latestDataResult[0]?.viral_videos_500k_since_sept12,
        potential_issue: latestDataResult[0]?.viral_videos_500k_since_sept12 === 0 ?
          "No viral videos (500k+) found since Sept 12th in BigQuery" :
          "Recent viral videos exist in BigQuery"
      }
    });

  } catch (error) {
    console.error('❌ Recent virals debug error:', error);
    res.status(500).json({ error: 'Failed to debug recent virals', details: error.message });
  }
});

// DEBUG: Endpoint to analyze viral videos data discrepancy
router.get('/debug/virals-analysis', async (req, res) => {
  try {
    console.log('🔍 DEBUGGING: Analyzing viral videos data discrepancy...');

    // Query 1: Count ALL videos with core concept docs using different join methods
    const allWithDocsQuery1 = `
      SELECT
        COUNT(*) as total_videos_with_core_concept_title_join,
        COUNT(CASE WHEN s.views_total >= 500000 THEN 1 END) as videos_500k_plus,
        COUNT(CASE WHEN s.views_total >= 1000000 THEN 1 END) as videos_1m_plus
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN script sc ON v.script_title = sc.title
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
    `;

    // Query 2: Count using trello_card_id join method
    const allWithDocsQuery2 = `
      SELECT
        COUNT(*) as total_videos_with_core_concept_trello_join,
        COUNT(CASE WHEN s.views_total >= 500000 THEN 1 END) as videos_500k_plus,
        COUNT(CASE WHEN s.views_total >= 1000000 THEN 1 END) as videos_1m_plus
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
    `;

    // Query 3: Count ALL scripts with core concept docs (regardless of video join)
    const allScriptsWithDocsQuery = `
      SELECT
        COUNT(*) as total_scripts_with_core_concept
      FROM script
      WHERE core_concept_doc IS NOT NULL
        AND core_concept_doc != ''
    `;

    // Query 4: Count videos that have trello_card_id but no script match
    const orphanedVideosQuery = `
      SELECT
        COUNT(*) as videos_with_trello_no_script_match
      FROM video v
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND v.trello_card_id IS NOT NULL
        AND sc.trello_card_id IS NULL
    `;

    const { rows: countRows1 } = await pool.query(allWithDocsQuery1);
    const { rows: countRows2 } = await pool.query(allWithDocsQuery2);
    const { rows: scriptsRows } = await pool.query(allScriptsWithDocsQuery);
    const { rows: orphanedRows } = await pool.query(orphanedVideosQuery);

    // Query 5: Get sample viral videos with docs that should appear in virals tab (FIXED VERSION)
    const sampleViralQuery = `
      SELECT
        v.id,
        v.script_title,
        s.views_total,
        sc.core_concept_doc,
        w.name as writer_name,
        s.posted_date
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      LEFT JOIN writer w ON v.writer_id = w.id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND s.views_total >= 500000
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
      ORDER BY s.views_total DESC
      LIMIT 20
    `;

    const { rows: sampleRows } = await pool.query(sampleViralQuery);

    // Query 3: Check what the FIXED virals endpoint returns
    const currentViralQuery = `
      SELECT
        v.id,
        v.url,
        v.script_title AS title,
        v.writer_id,
        w.name as writer_name,
        s.posted_date,
        s.preview,
        s.duration,
        COALESCE(s.likes_total, 0) AS likes_total,
        COALESCE(s.comments_total, 0) AS comments_total,
        COALESCE(s.views_total, 0) AS views_total,
        sc.core_concept_doc
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      LEFT JOIN writer w ON v.writer_id = w.id
      LEFT JOIN script sc ON v.trello_card_id = sc.trello_card_id
      WHERE (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND s.views_total >= 500000
        AND sc.core_concept_doc IS NOT NULL
        AND sc.core_concept_doc != ''
      ORDER BY s.views_total DESC
      LIMIT 100
    `;

    const { rows: currentEndpointRows } = await pool.query(currentViralQuery);

    res.json({
      success: true,
      analysis: {
        database_counts_comparison: {
          script_title_join: countRows1[0],
          trello_card_id_join: countRows2[0],
          total_scripts_with_docs: scriptsRows[0],
          orphaned_videos: orphanedRows[0]
        },
        sample_viral_videos: sampleRows,
        current_endpoint_results: {
          count: currentEndpointRows.length,
          videos: currentEndpointRows.slice(0, 10) // First 10 for brevity
        },
        discrepancy_notes: [
          "Comparing script.title vs trello_card_id join methods",
          "Total scripts with core concept docs vs videos that can access them",
          "Current virals endpoint filters by 500k+ views + core concept docs + 30 days",
          "Frontend additionally filters by 500k+ views and core concept titles",
          "Check if script.title matching is causing issues vs trello_card_id matching"
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug virals analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze virals data', details: error.message });
  }
});

// Endpoint to fetch core concept titles from Google Sheets
router.get('/core-concept-titles', async (req, res) => {
  try {
    console.log('📊 Fetching core concept titles from Google Sheets...');

    const sheets = await setupGoogleSheetsClient();
    const spreadsheetId = '1rQ5POXEqdguOQ-91IcFXbRr62UoyPWT4vzILPeujNZs';
    const range = 'Sheet1!B:C'; // Column B (Core Concept Doc URLs) and Column C (Titles)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No data found in Google Sheets');
      return res.status(404).json({
        success: false,
        message: 'No data found in Google Sheets'
      });
    }

    // Create a mapping of document ID to title
    const titleMapping = {};

    // Skip header row (index 0) and process data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length >= 2) {
        const docUrl = row[0]; // Column B - Core Concept Doc URL
        const title = row[1]; // Column C - Title

        if (docUrl && title) {
          // Extract document ID from Google Docs URL
          const docIdMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
          if (docIdMatch) {
            const docId = docIdMatch[1];
            titleMapping[docId] = title;
          }
        }
      }
    }

    console.log(`✅ Successfully mapped ${Object.keys(titleMapping).length} core concept titles`);

    res.json({
      success: true,
      titleMapping: titleMapping,
      count: Object.keys(titleMapping).length
    });

  } catch (error) {
    console.error('❌ Error fetching core concept titles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch core concept titles',
      error: error.message
    });
  }
});

// Script submissions endpoint for tooltip data
router.post('/script-submissions', async (req, res) => {
  try {
    const { writerId, startDate, endDate } = req.body;

    if (!writerId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required parameters: writerId, startDate, endDate' });
    }

    console.log('🔍 Fetching script submissions for tooltip:', { writerId, startDate, endDate });

    // Query script table for daily submission counts
    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        array_agg(id) as script_ids,
        array_agg(created_at) as timestamps
      FROM script
      WHERE writer_id = $1
        AND DATE(created_at) >= $2
        AND DATE(created_at) <= $3
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const result = await pool.query(query, [writerId, startDate, endDate]);

    console.log('✅ Script submissions fetched:', result.rows.length, 'days with data');

    // Debug: Log detailed results with timezone info
    result.rows.forEach(row => {
      console.log(`📅 Raw Date: ${row.date}, ISO: ${row.date.toISOString().split('T')[0]}, Count: ${row.count}`);
      console.log(`📅 Sample timestamps: ${row.timestamps?.slice(0, 2)}`);
    });

    // Format the response - avoid timezone conversion by using local date formatting
    const formattedData = result.rows.map(row => {
      // Use local date formatting to avoid UTC conversion
      const year = row.date.getFullYear();
      const month = String(row.date.getMonth() + 1).padStart(2, '0');
      const day = String(row.date.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;

      console.log(`📅 Date conversion: ${row.date} -> ${localDateStr} (count: ${row.count})`);

      return {
        date: localDateStr,
        count: parseInt(row.count)
      };
    });

    console.log('📊 Formatted response:', formattedData);

    res.json(formattedData);

  } catch (error) {
    console.error('❌ Error fetching script submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// YTD (Year-to-Date) views endpoint
router.post('/ytd-views', async (req, res) => {
  try {
    const { writerId, year } = req.body;

    if (!writerId || !year) {
      return res.status(400).json({ error: 'Missing required parameters: writerId, year' });
    }

    console.log(`📊 Fetching YTD ${year} views for writer ${writerId}`);

    // Use the global BigQuery client
    const bigqueryClient = getBigQueryClient();
    if (!bigqueryClient) {
      throw new Error('BigQuery client not initialized');
    }

    // First, let's test a simple query to see if the writer exists
    const testQuery = `
      SELECT COUNT(*) as total_records
      FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
      WHERE writer_id = @writerId
      LIMIT 1
    `;

    console.log('📊 Testing writer existence with query:', testQuery);
    console.log('📊 Writer ID:', writerId);

    const testOptions = {
      query: testQuery,
      params: {
        writerId: parseInt(writerId) // Convert to integer for BigQuery
      }
    };

    const [testRows] = await bigqueryClient.query(testOptions);
    console.log('📊 Test query results:', testRows);

    // Query to get YTD views for the writer
    const query = `
      WITH latest_metadata AS (
        SELECT
          video_id,
          writer_id,
          statistics_view_count,
          snippet_published_at,
          ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY snapshot_date DESC) as rn
        FROM \`speedy-web-461014-g3.dbt_youtube_analytics.youtube_metadata_historical\`
        WHERE statistics_view_count IS NOT NULL
          AND writer_id = @writerId
          AND snippet_published_at IS NOT NULL
          AND EXTRACT(YEAR FROM snippet_published_at) = @year
      )
      SELECT
        SUM(CAST(statistics_view_count AS INT64)) as total_views,
        COUNT(DISTINCT video_id) as video_count
      FROM latest_metadata
      WHERE rn = 1
    `;

    const options = {
      query: query,
      params: {
        writerId: parseInt(writerId), // Convert to integer for BigQuery
        year: parseInt(year)
      }
    };

    console.log('📊 Executing YTD BigQuery:', query);
    console.log('📊 Query params:', options.params);

    const [rows] = await bigqueryClient.query(options);

    console.log('📊 YTD BigQuery results:', rows);
    console.log('📊 YTD BigQuery first row:', rows[0]);
    console.log('📊 YTD total_views value:', rows[0]?.total_views);
    console.log('📊 YTD video_count value:', rows[0]?.video_count);

    const result = {
      totalViews: rows[0]?.total_views || 0,
      videoCount: rows[0]?.video_count || 0,
      year: year,
      writerId: writerId
    };

    console.log('📊 YTD response being sent:', result);

    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching YTD views:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.bigquery = bigquery;
