const Redis = require('./server/node_modules/ioredis');

// Redis configuration
const redisConfig = {
  host: 'redis-11139.fcrce180.us-east-1-1.ec2.redns.redis-cloud.com',
  port: 11139,
  password: 'ZJ9DzdcYe9D0iNtQ48hkdRCIyD2KdoEK',
  username: 'default',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

async function clearRedisCache() {
  const client = new Redis(redisConfig);
  
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
