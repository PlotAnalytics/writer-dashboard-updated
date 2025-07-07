const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      // Redis connection configuration
      const redisConfig = {
        host: 'redis-11139.fcrce180.us-east-1-1.ec2.redns.redis-cloud.com',
        port: 11139,
        password: 'ZJ9DzdcYe9D0iNtQ48hkdRCIyD2KdoEK',
        username: 'default',
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000
      };

      console.log('🔄 Initializing Redis connection...');
      
      // Create Redis client
      this.client = redis.createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout
        },
        password: redisConfig.password,
        username: redisConfig.username
      });

      // Event handlers
      this.client.on('connect', () => {
        console.log('🔗 Redis client connected');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready for commands');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis client disconnected');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test the connection
      await this.client.ping();
      console.log('✅ Redis connection test successful');

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  // Check if Redis is available
  isAvailable() {
    return this.isConnected && this.client;
  }

  // Generic cache get method
  async get(key) {
    if (!this.isAvailable()) {
      console.log('⚠️ Redis not available, skipping cache get');
      return null;
    }

    try {
      const result = await this.client.get(key);
      if (result) {
        console.log(`✅ Cache HIT for key: ${key}`);
        return JSON.parse(result);
      } else {
        console.log(`❌ Cache MISS for key: ${key}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  // Generic cache set method
  async set(key, value, ttlSeconds = 3600) {
    if (!this.isAvailable()) {
      console.log('⚠️ Redis not available, skipping cache set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
      console.log(`✅ Cache SET for key: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error(`❌ Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  // Delete cache key
  async del(key) {
    if (!this.isAvailable()) {
      console.log('⚠️ Redis not available, skipping cache delete');
      return false;
    }

    try {
      await this.client.del(key);
      console.log(`✅ Cache DELETE for key: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Redis DELETE error for key ${key}:`, error);
      return false;
    }
  }

  // Clear all cache keys matching a pattern
  async clearPattern(pattern) {
    if (!this.isAvailable()) {
      console.log('⚠️ Redis not available, skipping pattern clear');
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`✅ Cache CLEAR pattern: ${pattern} (${keys.length} keys deleted)`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Redis CLEAR PATTERN error for ${pattern}:`, error);
      return false;
    }
  }

  // Analytics-specific cache methods
  async getAnalyticsData(writerId, startDate, endDate) {
    const key = `analytics:daily_totals:writer:${writerId}:${startDate}:${endDate}`;
    return await this.get(key);
  }

  async setAnalyticsData(writerId, startDate, endDate, data, ttlSeconds = 1800) {
    const key = `analytics:daily_totals:writer:${writerId}:${startDate}:${endDate}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getVideoIds(writerId) {
    const key = `bigquery:video_ids:writer:${writerId}`;
    return await this.get(key);
  }

  async setVideoIds(writerId, videoIds, ttlSeconds = 7200) {
    const key = `bigquery:video_ids:writer:${writerId}`;
    return await this.set(key, videoIds, ttlSeconds);
  }

  async getWriterName(writerId) {
    const key = `postgres:writer_name:${writerId}`;
    return await this.get(key);
  }

  async setWriterName(writerId, writerName, ttlSeconds = 86400) {
    const key = `postgres:writer_name:${writerId}`;
    return await this.set(key, writerName, ttlSeconds);
  }

  async getTotalSubmissions(writerId) {
    const key = `postgres:submissions_total:writer:${writerId}`;
    return await this.get(key);
  }

  async setTotalSubmissions(writerId, count, ttlSeconds = 3600) {
    const key = `postgres:submissions_total:writer:${writerId}`;
    return await this.set(key, count, ttlSeconds);
  }

  // Content page cache methods
  async getContentData(writerId, page = 1, limit = 20) {
    const key = `content:videos:writer:${writerId}:page:${page}:limit:${limit}`;
    return await this.get(key);
  }

  async setContentData(writerId, page, limit, data, ttlSeconds = 1800) {
    const key = `content:videos:writer:${writerId}:page:${page}:limit:${limit}`;
    return await this.set(key, data, ttlSeconds);
  }

  // Invalidate all cache for a writer (useful when data changes)
  async invalidateWriterCache(writerId) {
    const patterns = [
      `analytics:*:writer:${writerId}:*`,
      `bigquery:*:writer:${writerId}*`,
      `postgres:*:writer:${writerId}*`,
      `content:*:writer:${writerId}:*`
    ];

    for (const pattern of patterns) {
      await this.clearPattern(pattern);
    }
    console.log(`✅ Invalidated all cache for writer ${writerId}`);
  }

  // Close connection
  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('🔌 Redis connection closed');
    }
  }
}

module.exports = RedisService;
