const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const NotificationService = require('../services/notificationService');
const { authenticateToken } = require('../middleware/auth');

const notificationService = new NotificationService();

/**
 * Get notifications for the authenticated writer
 * GET /api/notifications
 * Query params: limit, offset, unread_only
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unread_only = 'false' } = req.query;
    
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id 
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    
    let notifications;
    if (unread_only === 'true') {
      notifications = {
        notifications: await notificationService.getUnreadNotifications(writerId),
        total: 0,
        hasMore: false
      };
      notifications.total = notifications.notifications.length;
    } else {
      notifications = await notificationService.getNotifications(
        writerId, 
        parseInt(limit), 
        parseInt(offset)
      );
    }
    
    res.json({
      success: true,
      ...notifications
    });
    
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications' 
    });
  }
});

/**
 * Get notification counts for the authenticated writer
 * GET /api/notifications/count
 */
router.get('/count', authenticateToken, async (req, res) => {
  try {
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id 
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    const counts = await notificationService.getNotificationCount(writerId);
    
    res.json({
      success: true,
      total: parseInt(counts.total),
      unread: parseInt(counts.unread),
      uncelebrated: parseInt(counts.uncelebrated)
    });
    
  } catch (error) {
    console.error('❌ Error fetching notification counts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notification counts' 
    });
  }
});

/**
 * Get uncelebrated notifications (for celebration popups)
 * GET /api/notifications/uncelebrated
 */
router.get('/uncelebrated', authenticateToken, async (req, res) => {
  try {
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id 
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    const notifications = await notificationService.getUncebratedNotifications(writerId);
    
    res.json({
      success: true,
      notifications
    });
    
  } catch (error) {
    console.error('❌ Error fetching uncelebrated notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch uncelebrated notifications' 
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id 
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    const notification = await notificationService.markAsRead(notificationId, writerId);
    
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        error: 'Notification not found' 
      });
    }
    
    res.json({
      success: true,
      notification
    });
    
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read' 
    });
  }
});

/**
 * Mark notification as celebrated
 * PUT /api/notifications/:id/celebrated
 */
router.put('/:id/celebrated', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id 
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    const notification = await notificationService.markAsCelebrated(notificationId, writerId);
    
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        error: 'Notification not found' 
      });
    }
    
    res.json({
      success: true,
      notification
    });
    
  } catch (error) {
    console.error('❌ Error marking notification as celebrated:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as celebrated' 
    });
  }
});

/**
 * Mark all notifications as read for the authenticated writer
 * PUT /api/notifications/read-all
 */
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id 
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    
    const updateQuery = `
      UPDATE milestone_notifications 
      SET is_read = TRUE 
      WHERE writer_id = $1 AND is_read = FALSE
      RETURNING id
    `;
    
    const result = await pool.query(updateQuery, [writerId]);
    
    res.json({
      success: true,
      updated_count: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark all notifications as read' 
    });
  }
});

/**
 * Trigger milestone check for the authenticated writer (manual trigger)
 * POST /api/notifications/check-milestones
 */
router.post('/check-milestones', authenticateToken, async (req, res) => {
  try {
    // Get writer ID from authenticated user
    const writerQuery = `
      SELECT w.id as writer_id, w.name as writer_name
      FROM writer w 
      WHERE w.login_id = $1
    `;
    const writerResult = await pool.query(writerQuery, [req.user.id]);
    
    if (writerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Writer not found' });
    }
    
    const writerId = writerResult.rows[0].writer_id;
    const writerName = writerResult.rows[0].writer_name;
    
    // Get videos from PostgreSQL statistics_youtube_api table
    const videosQuery = `
      SELECT 
        v.id,
        v.script_title as title,
        v.url,
        COALESCE(s.views_total, 0) as views
      FROM video v
      LEFT JOIN statistics_youtube_api s ON CAST(v.id AS VARCHAR) = s.video_id
      WHERE v.writer_id = $1
        AND (v.url LIKE '%youtube.com%' OR v.url LIKE '%youtu.be%')
        AND v.url IS NOT NULL
        AND s.views_total IS NOT NULL
      ORDER BY s.views_total DESC
    `;
    
    const videosResult = await pool.query(videosQuery, [writerId]);
    const videos = videosResult.rows;
    
    console.log(`🔍 Checking milestones for ${writerName} (${writerId}) with ${videos.length} videos`);
    
    // Check for milestones
    const newNotifications = await notificationService.checkMilestonesForWriter(writerId, videos);
    
    res.json({
      success: true,
      writer_id: writerId,
      writer_name: writerName,
      videos_checked: videos.length,
      new_notifications: newNotifications.length,
      notifications: newNotifications
    });
    
  } catch (error) {
    console.error('❌ Error checking milestones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check milestones' 
    });
  }
});

module.exports = router;
