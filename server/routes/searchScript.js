const express = require('express');
const router = express.Router();

// Import PostgreSQL pool
const pool = require('../config/database');

// Search for script using video ID
router.get('/search-script', async (req, res) => {
  try {
    const { videoId } = req.query;

    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Video ID is required' 
      });
    }

    console.log(`🔍 Searching for script with video ID: ${videoId}`);

    // Search for the video in the video table using the video ID
    const videoQuery = `
      SELECT trello_card_id 
      FROM video 
      WHERE url LIKE $1 
      LIMIT 1
    `;
    
    const { rows: videoRows } = await pool.query(videoQuery, [`%${videoId}%`]);

    if (videoRows.length === 0) {
      console.log(`❌ Video not found for video ID: ${videoId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Video not found in database' 
      });
    }

    const trelloCardId = videoRows[0].trello_card_id;

    if (!trelloCardId) {
      console.log(`❌ No Trello card ID for video ID: ${videoId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'No Trello card ID associated with this video' 
      });
    }

    console.log(`📋 Found Trello card ID: ${trelloCardId}`);

    // Search for the script in the script table using the trello_card_id
    const scriptQuery = `
      SELECT google_doc_link 
      FROM script 
      WHERE trello_card_id = $1 
      LIMIT 1
    `;
    
    const { rows: scriptRows } = await pool.query(scriptQuery, [trelloCardId]);

    if (scriptRows.length === 0) {
      console.log(`❌ No script found for Trello card ID: ${trelloCardId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'No script found for this video' 
      });
    }

    const googleDocLink = scriptRows[0].google_doc_link;

    if (!googleDocLink) {
      console.log(`❌ No Google Doc link for Trello card ID: ${trelloCardId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Script found but no Google Doc link available' 
      });
    }

    console.log(`✅ Found Google Doc link: ${googleDocLink}`);

    // Return the successful result
    return res.status(200).json({
      success: true,
      videoId: videoId,
      trelloCardId: trelloCardId,
      googleDocLink: googleDocLink
    });

  } catch (error) {
    console.error('❌ Database error in search-script:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Database error occurred while searching for script' 
    });
  }
});

module.exports = router;
