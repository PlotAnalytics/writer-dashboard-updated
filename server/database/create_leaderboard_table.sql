-- Writer Leaderboard Pre-calculated Table
-- Run this daily after BigQuery data is updated to keep leaderboard fast

-- Drop existing table if it exists
DROP TABLE IF EXISTS writer_leaderboard_cache;

-- Create the leaderboard cache table
CREATE TABLE writer_leaderboard_cache (
    id SERIAL PRIMARY KEY,
    writer_name VARCHAR(255) NOT NULL,
    period VARCHAR(10) NOT NULL, -- '7d', '30d', '90d', '1y'
    total_views BIGINT NOT NULL DEFAULT 0,
    days_active INTEGER NOT NULL DEFAULT 0,
    avg_daily_views INTEGER NOT NULL DEFAULT 0,
    first_active_date DATE,
    last_active_date DATE,
    progress_to_1b_percent DECIMAL(10,2) DEFAULT 0,
    views_per_million DECIMAL(10,1) DEFAULT 0,
    is_active BOOLEAN DEFAULT FALSE,
    rank_position INTEGER,
    calculation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(writer_name, period),
    INDEX idx_period_rank (period, rank_position),
    INDEX idx_writer_period (writer_name, period),
    INDEX idx_calculation_date (calculation_date)
);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_leaderboard_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leaderboard_timestamp
    BEFORE UPDATE ON writer_leaderboard_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_leaderboard_timestamp();
