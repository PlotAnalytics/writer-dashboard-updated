const express = require('express');
const router = express.Router();

// Import your database pool and other utilities
const pool = require('../config/database');

// Import authentication middleware if needed
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  // Add your JWT verification logic here
  // For now, just pass through
  next();
};

// Broadcast function - you'll need to set this up properly
// For now, we'll use a simple console log
const broadcastUpdate = (data) => {
  console.log('📡 Broadcasting update:', data.id || 'unknown');
  // TODO: Import actual broadcast function from main server
};

// Update script status endpoint
router.post('/', async (req, res) => {
  const {
    trello_card_id,
    status,
    long_video_url,
    timestamp,
    loom,
    short_video_url,
    posting_account,
  } = req.body;

  // Input validation
  if (!trello_card_id || !status) {
    return res.status(400).json({ error: "Missing required fields: trello_card_id, status" });
  }

  let posting_account_id = null;

  if (posting_account && typeof posting_account === 'string') {
    try {
      const result = await pool.query(
        `SELECT id FROM posting_accounts WHERE account ILIKE $1 LIMIT 1`,
        [`%${posting_account.trim()}%`]
      );
      
      if (result.rows.length > 0) {
        posting_account_id = result.rows[0].id;
        console.log(`✅ Found posting account: ${posting_account} -> ID: ${posting_account_id}`);
      } else {
        console.log(`⚠️ Posting account not found: ${posting_account}`);
      }
    } catch (error) {
      console.error(`❌ Error looking up posting account:`, error);
    }
  }

  // Validate trello_card_id is a string
  if (typeof trello_card_id !== 'string' || !trello_card_id.trim()) {
    return res.status(400).json({ error: "Invalid trello_card_id" });
  }

  // Validate status is a string
  if (typeof status !== 'string' || !status.trim()) {
    return res.status(400).json({ error: "Invalid status" });
  }

  // Validate timestamp if provided
  if (timestamp) {
    const parsedTimestamp = new Date(timestamp);
    if (isNaN(parsedTimestamp.getTime())) {
      return res.status(400).json({ error: "Invalid timestamp format" });
    }
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const scriptStatus = status.trim();
    let updatedScript = null;

    if (scriptStatus.toLowerCase() === "rejected") {
      // Update script with rejection
      const updateFields = ['approval_status = $1', 'loom_url = $2', 'updated_at = NOW()'];
      const updateValues = [scriptStatus, loom || null];

      // Add account_id if posting_account was provided and found
      if (posting_account_id) {
        updateFields.push('account_id = $' + (updateValues.length + 1));
        updateValues.push(posting_account_id);
      }

      updateValues.push(trello_card_id.trim()); // trello_card_id is always last

      const result = await client.query(`
        UPDATE script
        SET ${updateFields.join(', ')}
        WHERE trello_card_id = $${updateValues.length}
        RETURNING *;
      `, updateValues);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Script not found" });
      }

      updatedScript = result.rows[0];
      console.log(`❌ Script rejected: ${trello_card_id}`);

    } else if (scriptStatus.toLowerCase() === "posted") {
      // Validate posting account is provided and is a string
      if (!posting_account || typeof posting_account !== 'string' || !posting_account.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Valid posting_account required for posted status" });
      }

      // Validate at least one video URL is provided
      const hasShortVideo = short_video_url && typeof short_video_url === 'string' && short_video_url.trim();
      const hasLongVideo = long_video_url && typeof long_video_url === 'string' && long_video_url.trim();

      if (!hasShortVideo && !hasLongVideo) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "At least one valid video URL required for posted status" });
      }

      // Validate posting account was found
      if (!posting_account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Posting account not found: ${posting_account}` });
      }

      // Fetch script details
      const scriptResult = await client.query(
        `SELECT writer_id, title FROM script WHERE trello_card_id = $1;`, 
        [trello_card_id.trim()]
      );

      if (scriptResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Script not found" });
      }

      const { writer_id, title: script_title } = scriptResult.rows[0];

      // Prepare video URLs to insert (already validated above)
      const urlsToInsert = [];
      if (hasShortVideo) {
        urlsToInsert.push({ url: short_video_url.trim(), type: 'short', account_id: posting_account_id });
      }
      if (hasLongVideo) {
        urlsToInsert.push({ url: long_video_url.trim(), type: 'long', account_id: posting_account_id });
      }

      // Upsert videos
      const videoIds = [];
      const videoDetails = [];
      
      for (const videoData of urlsToInsert) {
        try {
          const videoResult = await client.query(`
            INSERT INTO video (url, created, writer_id, script_title, trello_card_id, account_id, video_cat)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (url) 
            DO UPDATE SET
              created = EXCLUDED.created,
              writer_id = EXCLUDED.writer_id,
              script_title = EXCLUDED.script_title,
              trello_card_id = EXCLUDED.trello_card_id,
              account_id = EXCLUDED.account_id,
              video_cat = EXCLUDED.video_cat,
              updated_at = NOW()
            RETURNING id, (xmax = 0) AS inserted;
          `, [
            videoData.url,
            timestamp || new Date().toISOString(),
            writer_id,
            script_title,
            trello_card_id.trim(),
            videoData.account_id,
            videoData.type
          ]);

          const { id: videoId, inserted: wasInserted } = videoResult.rows[0];
          videoIds.push(videoId);
          videoDetails.push({
            id: videoId,
            url: videoData.url,
            type: videoData.type,
            action: wasInserted ? 'inserted' : 'updated'
          });
          
          console.log(
            wasInserted 
              ? `✅ Inserted ${videoData.type} video: ${videoId}` 
              : `🔄 Updated ${videoData.type} video: ${videoId}`
          );
        } catch (videoError) {
          // If video insert fails, rollback everything
          await client.query('ROLLBACK');
          console.error(`❌ Error upserting ${videoData.type} video:`, videoError);
          
          // Check if it's a constraint error
          if (videoError.code === '23503') {
            return res.status(400).json({ error: "Foreign key constraint violation in video insert" });
          }
          
          throw videoError; // Re-throw to be caught by outer catch
        }
      }

      // Update script status and account_id for posted status
      const updateFields = ['approval_status = $1', 'updated_at = NOW()'];
      const updateValues = [scriptStatus];

      // Add account_id if posting_account was provided and found
      if (posting_account_id) {
        updateFields.push('account_id = $' + (updateValues.length + 1));
        updateValues.push(posting_account_id);
      }

      updateValues.push(trello_card_id.trim()); // trello_card_id is always last

      const scriptUpdateResult = await client.query(`
        UPDATE script
        SET ${updateFields.join(', ')}
        WHERE trello_card_id = $${updateValues.length}
        RETURNING *;
      `, updateValues);

      updatedScript = { 
        ...scriptUpdateResult.rows[0], 
        video_ids: videoIds,
        video_details: videoDetails
      };
      console.log(`✅ Script posted: ${trello_card_id}`);

    } else {
      // Handle other status changes
      const updateFields = ['approval_status = $1', 'updated_at = NOW()'];
      const updateValues = [scriptStatus];

      // Add account_id if posting_account was provided and found
      if (posting_account_id) {
        updateFields.push('account_id = $' + (updateValues.length + 1));
        updateValues.push(posting_account_id);
      }

      updateValues.push(trello_card_id.trim()); // trello_card_id is always last

      const scriptUpdateResult = await client.query(`
        UPDATE script
        SET ${updateFields.join(', ')}
        WHERE trello_card_id = $${updateValues.length}
        RETURNING *;
      `, updateValues);

      if (scriptUpdateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Script not found" });
      }

      updatedScript = scriptUpdateResult.rows[0];
      console.log(`📝 Script status updated: ${trello_card_id} -> ${scriptStatus}`);
    }

    // Log movement for ALL status changes (runs after all branches)
    let movementResult;
    try {
      movementResult = await client.query(`
        INSERT INTO trello_card_movements (timestamp, trello_card_id, status)
        VALUES ($1, $2, $3)
        RETURNING *;
      `, [timestamp || new Date().toISOString(), trello_card_id.trim(), scriptStatus]);
    } catch (movementError) {
      await client.query('ROLLBACK');
      console.error("❌ Error inserting movement record:", movementError);
      throw movementError;
    }

    await client.query('COMMIT');
    
    // Build comprehensive response with all updated data
    const responseData = {
      script: updatedScript,
      movement: movementResult.rows[0],
      status: scriptStatus,
      trello_card_id: trello_card_id.trim(),
    };

    // Add branch-specific data
    if (scriptStatus === "rejected") {
      responseData.rejection_details = {
        loom_url: loom || null,
        rejected_at: updatedScript.updated_at
      };
    } else if (scriptStatus === "posted") {
      responseData.posting_details = {
        posting_account: posting_account.trim(),
        video_ids: updatedScript.video_ids,
        video_details: updatedScript.video_details,
        short_video_url: short_video_url?.trim() || null,
        long_video_url: long_video_url?.trim() || null,
        posted_at: updatedScript.updated_at
      };
    }
    
    // Broadcast update
    broadcastUpdate(responseData);
    
    return res.json({ 
      success: true, 
      data: responseData,
      message: `Script status updated to '${scriptStatus}' successfully`
    });

  } catch (error) {
    // Ensure rollback happens even if not already done
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error("❌ Error during rollback:", rollbackError);
    }
    
    console.error("❌ Error updating script status:", error);
    
    // Provide more specific error messages
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: "Duplicate entry detected",
        message: error.message 
      });
    }
    
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  } finally {
    client.release();
  }
});

module.exports = router;