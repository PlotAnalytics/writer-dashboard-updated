const pool = require('../config/database');

/**
 * Notification Service for handling milestone notifications
 * Monitors video view counts and creates notifications when milestones are reached
 */
class NotificationService {
  constructor() {
    this.milestones = [
      { type: '1M_VIEWS', value: 1000000 },
      { type: '5M_VIEWS', value: 5000000 },
      { type: '10M_VIEWS', value: 10000000 },
      { type: '50M_VIEWS', value: 50000000 },
      { type: '100M_VIEWS', value: 100000000 }
    ];
  }

  /**
   * Check for milestone achievements for a specific writer
   * @param {number} writerId - The writer ID to check
   * @param {Array} videos - Array of video objects with view counts
   */
  async checkMilestonesForWriter(writerId, videos) {
    try {
      console.log(`🔍 Checking milestones for writer ${writerId} with ${videos.length} videos`);
      
      const newNotifications = [];
      
      for (const video of videos) {
        if (!video.views || !video.id) continue;
        
        const currentViews = parseInt(video.views);
        if (isNaN(currentViews)) continue;
        
        // Update or create tracking record
        await this.updateVideoTracking(video.id, writerId, video.title, video.url, currentViews);
        
        // Check each milestone
        for (const milestone of this.milestones) {
          if (currentViews >= milestone.value) {
            const notification = await this.createMilestoneNotification(
              writerId,
              video.id,
              video.title,
              video.url,
              milestone.type,
              milestone.value,
              currentViews
            );
            
            if (notification) {
              newNotifications.push(notification);
            }
          }
        }
      }
      
      console.log(`✅ Created ${newNotifications.length} new milestone notifications for writer ${writerId}`);
      return newNotifications;
      
    } catch (error) {
      console.error(`❌ Error checking milestones for writer ${writerId}:`, error);
      throw error;
    }
  }

  /**
   * Update video tracking record
   */
  async updateVideoTracking(videoId, writerId, title, url, currentViews) {
    try {
      const query = `
        INSERT INTO video_milestone_tracking 
        (video_id, writer_id, video_title, video_url, current_views, last_checked_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (video_id) 
        DO UPDATE SET 
          current_views = $5,
          last_checked_at = CURRENT_TIMESTAMP,
          video_title = COALESCE($3, video_milestone_tracking.video_title),
          video_url = COALESCE($4, video_milestone_tracking.video_url)
      `;
      
      await pool.query(query, [videoId, writerId, title, url, currentViews]);
      
    } catch (error) {
      console.error(`❌ Error updating video tracking for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Create milestone notification if it doesn't exist
   */
  async createMilestoneNotification(writerId, videoId, title, url, milestoneType, milestoneValue, currentViews) {
    try {
      // Check if notification already exists
      const existingQuery = `
        SELECT id FROM milestone_notifications 
        WHERE video_id = $1 AND milestone_type = $2
      `;
      const existing = await pool.query(existingQuery, [videoId, milestoneType]);
      
      if (existing.rows.length > 0) {
        return null; // Notification already exists
      }
      
      // Create new notification
      const insertQuery = `
        INSERT INTO milestone_notifications 
        (writer_id, video_id, video_title, video_url, milestone_type, milestone_value, current_views)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const result = await pool.query(insertQuery, [
        writerId, videoId, title, url, milestoneType, milestoneValue, currentViews
      ]);
      
      const notification = result.rows[0];
      console.log(`🎉 Created ${milestoneType} notification for video: ${title?.substring(0, 50)}...`);
      
      return notification;
      
    } catch (error) {
      console.error(`❌ Error creating milestone notification:`, error);
      throw error;
    }
  }

  /**
   * Get unread notifications for a writer
   */
  async getUnreadNotifications(writerId) {
    try {
      const query = `
        SELECT 
          id,
          video_id,
          video_title,
          video_url,
          milestone_type,
          milestone_value,
          current_views,
          achieved_at,
          is_celebrated
        FROM milestone_notifications 
        WHERE writer_id = $1 AND is_read = FALSE
        ORDER BY achieved_at DESC
      `;
      
      const result = await pool.query(query, [writerId]);
      return result.rows;
      
    } catch (error) {
      console.error(`❌ Error getting unread notifications for writer ${writerId}:`, error);
      throw error;
    }
  }

  /**
   * Get all notifications for a writer (with pagination)
   */
  async getNotifications(writerId, limit = 20, offset = 0) {
    try {
      const query = `
        SELECT 
          id,
          video_id,
          video_title,
          video_url,
          milestone_type,
          milestone_value,
          current_views,
          achieved_at,
          is_read,
          is_celebrated
        FROM milestone_notifications 
        WHERE writer_id = $1
        ORDER BY achieved_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await pool.query(query, [writerId, limit, offset]);
      
      // Also get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM milestone_notifications 
        WHERE writer_id = $1
      `;
      const countResult = await pool.query(countQuery, [writerId]);
      
      return {
        notifications: result.rows,
        total: parseInt(countResult.rows[0].total),
        hasMore: offset + limit < parseInt(countResult.rows[0].total)
      };
      
    } catch (error) {
      console.error(`❌ Error getting notifications for writer ${writerId}:`, error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, writerId) {
    try {
      const query = `
        UPDATE milestone_notifications 
        SET is_read = TRUE 
        WHERE id = $1 AND writer_id = $2
        RETURNING *
      `;
      
      const result = await pool.query(query, [notificationId, writerId]);
      return result.rows[0];
      
    } catch (error) {
      console.error(`❌ Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  }

  /**
   * Mark notification as celebrated (user has seen the animation)
   */
  async markAsCelebrated(notificationId, writerId) {
    try {
      const query = `
        UPDATE milestone_notifications 
        SET is_celebrated = TRUE 
        WHERE id = $1 AND writer_id = $2
        RETURNING *
      `;
      
      const result = await pool.query(query, [notificationId, writerId]);
      return result.rows[0];
      
    } catch (error) {
      console.error(`❌ Error marking notification ${notificationId} as celebrated:`, error);
      throw error;
    }
  }

  /**
   * Get notification count for a writer
   */
  async getNotificationCount(writerId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_read = FALSE) as unread,
          COUNT(*) FILTER (WHERE is_celebrated = FALSE) as uncelebrated
        FROM milestone_notifications 
        WHERE writer_id = $1
      `;
      
      const result = await pool.query(query, [writerId]);
      return result.rows[0];
      
    } catch (error) {
      console.error(`❌ Error getting notification count for writer ${writerId}:`, error);
      throw error;
    }
  }

  /**
   * Get uncelebrated notifications (for showing celebration popups)
   */
  async getUncebratedNotifications(writerId) {
    try {
      const query = `
        SELECT 
          id,
          video_id,
          video_title,
          video_url,
          milestone_type,
          milestone_value,
          current_views,
          achieved_at
        FROM milestone_notifications 
        WHERE writer_id = $1 AND is_celebrated = FALSE
        ORDER BY achieved_at ASC
        LIMIT 5
      `;
      
      const result = await pool.query(query, [writerId]);
      return result.rows;
      
    } catch (error) {
      console.error(`❌ Error getting uncelebrated notifications for writer ${writerId}:`, error);
      throw error;
    }
  }
}

module.exports = NotificationService;
