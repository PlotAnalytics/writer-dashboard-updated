-- Notifications Schema for 1 Million View Milestones
-- This script creates the necessary tables for tracking and managing notifications

-- Table to store milestone notifications
CREATE TABLE IF NOT EXISTS milestone_notifications (
    id SERIAL PRIMARY KEY,
    writer_id INTEGER NOT NULL,
    video_id VARCHAR(50) NOT NULL, -- YouTube video ID
    video_title TEXT,
    video_url TEXT,
    milestone_type VARCHAR(50) NOT NULL DEFAULT '1M_VIEWS', -- Future: could add 5M, 10M, etc.
    milestone_value BIGINT NOT NULL DEFAULT 1000000, -- The milestone reached
    current_views BIGINT NOT NULL, -- Views when milestone was detected
    achieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    is_celebrated BOOLEAN DEFAULT FALSE, -- Track if user has seen celebration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_milestone_per_video UNIQUE (video_id, milestone_type),
    CONSTRAINT valid_milestone_type CHECK (milestone_type IN ('1M_VIEWS', '5M_VIEWS', '10M_VIEWS', '50M_VIEWS', '100M_VIEWS'))
);

-- Table to track video view milestones (for monitoring)
CREATE TABLE IF NOT EXISTS video_milestone_tracking (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(50) NOT NULL,
    writer_id INTEGER NOT NULL,
    video_title TEXT,
    video_url TEXT,
    current_views BIGINT NOT NULL DEFAULT 0,
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    milestones_achieved JSONB DEFAULT '[]'::jsonb, -- Array of achieved milestones
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_video_tracking UNIQUE (video_id)
);

-- Table for notification preferences (future expansion)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    writer_id INTEGER NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE,
    web_notifications BOOLEAN DEFAULT TRUE,
    milestone_1m BOOLEAN DEFAULT TRUE,
    milestone_5m BOOLEAN DEFAULT TRUE,
    milestone_10m BOOLEAN DEFAULT TRUE,
    milestone_50m BOOLEAN DEFAULT TRUE,
    milestone_100m BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_preferences_per_writer UNIQUE (writer_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_writer_id ON milestone_notifications(writer_id);
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_achieved_at ON milestone_notifications(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_unread ON milestone_notifications(writer_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_uncelebrated ON milestone_notifications(writer_id, is_celebrated) WHERE is_celebrated = FALSE;

CREATE INDEX IF NOT EXISTS idx_video_tracking_writer_id ON video_milestone_tracking(writer_id);
CREATE INDEX IF NOT EXISTS idx_video_tracking_last_checked ON video_milestone_tracking(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_video_tracking_views ON video_milestone_tracking(current_views DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_milestone_notifications_updated_at 
    BEFORE UPDATE ON milestone_notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_tracking_updated_at 
    BEFORE UPDATE ON video_milestone_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification preferences for existing writers
INSERT INTO notification_preferences (writer_id)
SELECT id FROM writer 
WHERE id NOT IN (SELECT writer_id FROM notification_preferences)
ON CONFLICT (writer_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE milestone_notifications IS 'Stores notifications for video milestone achievements (1M+ views)';
COMMENT ON TABLE video_milestone_tracking IS 'Tracks current view counts and milestone progress for videos';
COMMENT ON TABLE notification_preferences IS 'User preferences for different types of notifications';

COMMENT ON COLUMN milestone_notifications.milestone_type IS 'Type of milestone: 1M_VIEWS, 5M_VIEWS, etc.';
COMMENT ON COLUMN milestone_notifications.is_celebrated IS 'Whether user has seen the celebration animation';
COMMENT ON COLUMN video_milestone_tracking.milestones_achieved IS 'JSON array of milestone types already achieved';
