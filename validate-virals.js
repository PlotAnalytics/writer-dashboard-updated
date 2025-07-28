#!/usr/bin/env node

/**
 * Virals Count Validation Script
 * 
 * This script helps validate the accuracy of the virals count by:
 * 1. Calling the validation endpoint
 * 2. Showing detailed breakdown of viral videos
 * 3. Comparing with expected results
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const WRITER_ID = process.argv[2] || '121'; // Default to mylogumbs
const RANGE = process.argv[3] || '30d';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(url, token) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function validateVirals() {
  try {
    colorLog('cyan', '🔍 VIRALS COUNT VALIDATION');
    colorLog('cyan', '========================');
    console.log(`Writer ID: ${WRITER_ID}`);
    console.log(`Range: ${RANGE}`);
    console.log(`API URL: ${BASE_URL}`);
    console.log('');

    // You'll need to get a valid token - this is a placeholder
    const token = 'your-auth-token-here';
    
    const validationUrl = `${BASE_URL}/api/analytics/validate-virals?writer_id=${WRITER_ID}&range=${RANGE}`;
    
    colorLog('yellow', '📡 Calling validation endpoint...');
    const result = await makeRequest(validationUrl, token);

    if (result.success) {
      colorLog('green', '✅ Validation successful!');
      console.log('');
      
      colorLog('bright', `📊 RESULTS FOR ${result.writer_name.toUpperCase()}`);
      colorLog('bright', '='.repeat(50));
      
      colorLog('magenta', `📅 Date Range: ${result.date_range.start} to ${result.date_range.end}`);
      colorLog('magenta', `🔥 Total Virals Count: ${result.virals_count}`);
      console.log('');
      
      if (result.viral_videos.length > 0) {
        colorLog('blue', '🎬 VIRAL VIDEOS BREAKDOWN:');
        console.log('');
        
        result.viral_videos.forEach((video, index) => {
          console.log(`${index + 1}. ${colors.bright}${video.title}${colors.reset}`);
          console.log(`   Video ID: ${video.video_id}`);
          console.log(`   Max Views During Period: ${colors.green}${video.max_views_during_period.toLocaleString()}${colors.reset}`);
          console.log(`   Max Views Before Period: ${colors.yellow}${video.max_views_before_period.toLocaleString()}${colors.reset}`);
          console.log(`   Views Gained: ${colors.cyan}+${video.views_gained_in_period.toLocaleString()}${colors.reset}`);
          console.log(`   Crossed 1M in Period: ${video.crossed_1m_in_period ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
          if (video.url) {
            console.log(`   URL: ${video.url}`);
          }
          console.log('');
        });
      } else {
        colorLog('yellow', '⚠️ No viral videos found for this period');
      }
      
      colorLog('blue', '📋 CRITERIA:');
      console.log(`   ${result.explanation.criteria}`);
      console.log(`   ${result.explanation.note}`);
      
    } else {
      colorLog('red', '❌ Validation failed');
      console.log(result);
    }

  } catch (error) {
    colorLog('red', '❌ Error during validation:');
    console.error(error.message);
    console.log('');
    colorLog('yellow', '💡 TROUBLESHOOTING:');
    console.log('1. Make sure the server is running on the correct port');
    console.log('2. Update the token in this script with a valid auth token');
    console.log('3. Check if the writer_id exists in the database');
  }
}

// Usage instructions
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('');
  colorLog('cyan', 'VIRALS VALIDATION SCRIPT');
  console.log('Usage: node validate-virals.js [writer_id] [range]');
  console.log('');
  console.log('Examples:');
  console.log('  node validate-virals.js 121 30d    # Validate mylogumbs for last 30 days');
  console.log('  node validate-virals.js 110 7d     # Validate writer 110 for last 7 days');
  console.log('');
  console.log('Note: You need to update the auth token in the script first!');
  console.log('');
  process.exit(0);
}

// Run the validation
validateVirals();
