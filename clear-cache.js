#!/usr/bin/env node

/**
 * Cache Clearing Script
 * 
 * This script clears the Redis analytics cache directly
 */

const redis = require('redis');

async function clearCache() {
  let client;
  
  try {
    console.log('🔄 Connecting to Redis...');
    
    // Redis connection configuration (same as in redisService.js)
    client = redis.createClient({
      socket: {
        host: 'redis-11139.fcrce180.us-east-1-1.ec2.redns.redis-cloud.com',
        port: 11139,
        connectTimeout: 10000,
        commandTimeout: 5000
      },
      password: 'ZJ9DzdcYe9D0iNtQ48hkdRCIyD2KdoEK',
      username: 'default'
    });

    // Connect to Redis
    await client.connect();
    console.log('✅ Connected to Redis');

    // Test connection
    await client.ping();
    console.log('✅ Redis ping successful');

    // Get all analytics cache keys
    console.log('🔍 Finding analytics cache keys...');
    const keys = await client.keys('analytics:*');
    console.log(`📊 Found ${keys.length} analytics cache keys`);

    if (keys.length > 0) {
      // Delete all analytics cache keys
      console.log('🗑️ Clearing analytics cache...');
      await client.del(keys);
      console.log(`✅ Cleared ${keys.length} analytics cache keys`);
      
      // Show some of the cleared keys
      console.log('🔍 Sample cleared keys:');
      keys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
      if (keys.length > 5) {
        console.log(`  ... and ${keys.length - 5} more`);
      }
    } else {
      console.log('ℹ️ No analytics cache keys found to clear');
    }

    console.log('🎉 Cache clearing completed successfully!');

  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.quit();
      console.log('🔌 Disconnected from Redis');
    }
  }
}

// Run the cache clearing
clearCache();
