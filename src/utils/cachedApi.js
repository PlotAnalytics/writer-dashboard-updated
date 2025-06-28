import axios from 'axios';
import cacheManager, { CACHE_TTL } from './cacheManager.js';
import { buildApiUrl } from '../config/api.js';

// Cached API wrapper
class CachedApi {
  constructor() {
    this.axios = axios.create();
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor to add auth headers
    this.axios.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Generate cache key from URL and params
  getCacheKey(url, params = {}) {
    return cacheManager.generateKey(url, params);
  }

  // Cached GET request
  async get(url, options = {}) {
    console.log('🌐 CachedApi.get called:', url, options);
    const {
      params = {},
      ttl = CACHE_TTL.ANALYTICS,
      useCache = true,
      forceRefresh = false,
      ...axiosOptions
    } = options;

    const fullUrl = buildApiUrl(url);
    const cacheKey = this.getCacheKey(url, params);
    console.log('🔑 Cache key generated:', cacheKey);

    // Check cache first (unless force refresh)
    if (useCache && !forceRefresh) {
      const cachedData = cacheManager.get(cacheKey);
      if (cachedData) {
        return { data: cachedData, fromCache: true };
      }
    }

    try {
      console.log('🌐 API Request:', fullUrl, params);
      const response = await this.axios.get(fullUrl, {
        params,
        ...axiosOptions
      });

      // Store in cache if successful
      if (useCache && response.data) {
        cacheManager.set(cacheKey, response.data, ttl);
      }

      return { data: response.data, fromCache: false };
    } catch (error) {
      // If API fails, try to return stale cache data as fallback
      if (useCache) {
        const staleData = cacheManager.get(cacheKey);
        if (staleData) {
          console.warn('🔄 API failed, returning stale cache data:', error.message);
          return { data: staleData, fromCache: true, stale: true };
        }
      }
      throw error;
    }
  }

  // Cached POST request (usually don't cache, but invalidate related cache)
  async post(url, data, options = {}) {
    const { invalidateCache = [], ...axiosOptions } = options;
    const fullUrl = buildApiUrl(url);

    try {
      const response = await this.axios.post(fullUrl, data, axiosOptions);

      // Invalidate related cache entries
      invalidateCache.forEach(pattern => {
        this.invalidateCache(pattern);
      });

      return { data: response.data, fromCache: false };
    } catch (error) {
      throw error;
    }
  }

  // Invalidate cache entries matching pattern
  invalidateCache(pattern) {
    if (typeof pattern === 'string') {
      cacheManager.remove(cacheManager.generateKey(pattern));
    } else if (pattern instanceof RegExp) {
      // For regex patterns, we'd need to iterate through cache keys
      console.log('🗑️ Cache invalidation pattern:', pattern);
    }
  }

  // Clear all cache
  clearCache() {
    cacheManager.clear();
  }

  // Get cache stats
  getCacheStats() {
    return cacheManager.getStats();
  }
}

// Create singleton instance
const cachedApi = new CachedApi();

// Convenience methods for different data types
export const analyticsApi = {
  getOverview: (options = {}) => {
    const { params = {}, ...otherOptions } = options;
    return cachedApi.get('/api/analytics', {
      params,
      ttl: CACHE_TTL.ANALYTICS,
      useCache: true,
      ...otherOptions
    });
  },
  
  getContent: (params = {}) => 
    cachedApi.get('/api/analytics/content', { 
      params, 
      ttl: CACHE_TTL.CONTENT 
    }),

  getLatestContent: (params = {}) => 
    cachedApi.get('/api/analytics/writer/latest-content', { 
      params, 
      ttl: CACHE_TTL.CONTENT 
    }),

  // Force refresh for real-time data
  getOverviewFresh: (params = {}) =>
    cachedApi.get('/api/analytics', {
      params,
      forceRefresh: true,
      useCache: false
    }),

  // Clear analytics cache
  clearCache: () => cachedApi.clearCache()
};

export const submissionsApi = {
  getScripts: (params = {}) => 
    cachedApi.get('/api/scripts', { 
      params, 
      ttl: CACHE_TTL.SUBMISSIONS 
    }),

  getVideos: (params = {}) => 
    cachedApi.get('/api/writer/videos', { 
      params, 
      ttl: CACHE_TTL.CONTENT 
    }),

  createScript: (data) => 
    cachedApi.post('/api/scripts', data, {
      invalidateCache: ['/api/scripts']
    })
};

export const staticDataApi = {
  getTropes: () => 
    cachedApi.get('/api/tropes', { 
      ttl: CACHE_TTL.TROPES 
    }),

  getStructures: () => 
    cachedApi.get('/api/structures', { 
      ttl: CACHE_TTL.STRUCTURES 
    }),

  getWriter: (params = {}) => 
    cachedApi.get('/api/getWriter', { 
      params, 
      ttl: CACHE_TTL.WRITER_DATA 
    })
};

export default cachedApi;
