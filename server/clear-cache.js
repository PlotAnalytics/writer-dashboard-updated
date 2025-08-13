const { createClient } = require('redis');

async function clearRedisCache() {
  try {
    console.log('🔄 Connecting to Redis...');

    // Create Redis client with the same configuration as your app
    const redis = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Handle connection events
    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    // Connect to Redis
    await redis.connect();

    console.log('🗑️ Clearing all Redis cache...');

    // Clear all cache
    await redis.flushAll();

    console.log('✅ Redis cache cleared successfully!');

    // Close connection
    await redis.disconnect();

  } catch (error) {
    console.error('❌ Error clearing Redis cache:', error);
    process.exit(1);
  }
}

// Run the cache clearing
clearRedisCache();
