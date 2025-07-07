const redis = require('redis');

async function clearRedisCache() {
  // Create Redis client using same config as the app
  const client = redis.createClient({
    socket: {
      host: 'redis-11139.fcrce180.us-east-1-1.ec2.redns.redis-cloud.com',
      port: 11139,
      connectTimeout: 10000,
      commandTimeout: 5000
    },
    username: 'default',
    password: 'ZJ9DzdcYe9D0iNtQ48hkdRCIyD2KdoEK'
  });

  try {
    console.log('🔄 Connecting to Redis...');
    await client.connect();
    console.log('✅ Connected to Redis');

    // Get all keys
    const keys = await client.keys('*');
    console.log(`📊 Found ${keys.length} keys in Redis`);

    if (keys.length > 0) {
      // Delete all keys
      await client.del(keys);
      console.log(`✅ Deleted ${keys.length} keys from Redis cache`);
    } else {
      console.log('ℹ️ No keys found in Redis cache');
    }

    // Verify cache is empty
    const remainingKeys = await client.keys('*');
    console.log(`📊 Remaining keys after clear: ${remainingKeys.length}`);

  } catch (error) {
    console.error('❌ Error clearing Redis cache:', error);
  } finally {
    await client.quit();
    console.log('🔌 Redis connection closed');
  }
}

clearRedisCache();
