// Cache Manager for API responses
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.cachePrefix = 'writer_dashboard_';
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
  }

  // Generate cache key
  generateKey(url, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${this.cachePrefix}${url}${paramString ? '?' + paramString : ''}`;
  }

  // Check if cache entry is valid
  isValid(entry) {
    return entry && entry.timestamp && (Date.now() - entry.timestamp) < entry.ttl;
  }

  // Get from memory cache first, then localStorage
  get(key) {
    console.log('🔍 Cache lookup for:', key);
    // Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key);
    if (this.isValid(memoryEntry)) {
      console.log('🚀 Cache HIT (memory):', key);
      return memoryEntry.data;
    }

    // Check localStorage (persistent across sessions)
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const entry = JSON.parse(stored);
        if (this.isValid(entry)) {
          console.log('🚀 Cache HIT (localStorage):', key);
          // Also store in memory for faster access
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Remove expired entry
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    console.log('❌ Cache MISS:', key);
    return null;
  }

  // Store in both memory and localStorage
  set(key, data, ttl = this.defaultTTL) {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Store in localStorage (with error handling)
    try {
      localStorage.setItem(key, JSON.stringify(entry));
      console.log('💾 Cache STORED:', key, `(TTL: ${ttl/1000}s)`);
    } catch (error) {
      console.warn('Cache storage error (localStorage full?):', error);
      // If localStorage is full, just keep in memory
    }
  }

  // Remove specific cache entry
  remove(key) {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(key);
      console.log('🗑️ Cache REMOVED:', key);
    } catch (error) {
      console.warn('Cache removal error:', error);
    }
  }

  // Clear all cache entries
  clear() {
    this.memoryCache.clear();
    try {
      // Remove only our cache entries from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🧹 Cache CLEARED:', keysToRemove.length, 'entries');
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  // Clear expired entries (cleanup)
  cleanup() {
    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Clean localStorage
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const entry = JSON.parse(stored);
            if (!this.isValid(entry)) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (keysToRemove.length > 0) {
        console.log('🧹 Cache CLEANUP:', keysToRemove.length, 'expired entries removed');
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  // Get cache statistics
  getStats() {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          localStorageSize++;
        }
      }
    } catch (error) {
      console.warn('Cache stats error:', error);
    }

    return {
      memoryEntries: memorySize,
      localStorageEntries: localStorageSize,
      prefix: this.cachePrefix
    };
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Auto-cleanup every 10 minutes
setInterval(() => {
  cacheManager.cleanup();
}, 10 * 60 * 1000);

export default cacheManager;

// Cache TTL constants for different data types
export const CACHE_TTL = {
  ANALYTICS: 3 * 60 * 1000,      // 3 minutes - analytics data
  // REMOVED: SUBMISSIONS - no caching for submissions to prevent duplicate submissions
  CONTENT: 5 * 60 * 1000,        // 5 minutes - content lists (videos/published content)
  TROPES: 30 * 60 * 1000,        // 30 minutes - tropes (rarely change)
  STRUCTURES: 30 * 60 * 1000,    // 30 minutes - structures (rarely change)
  WRITER_DATA: 10 * 60 * 1000,   // 10 minutes - writer profile data
  REALTIME: 30 * 1000            // 30 seconds - real-time data
};
