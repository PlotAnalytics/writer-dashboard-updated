import axios from 'axios';
import { buildApiUrl } from '../config/api.js';

// Simple API wrapper without caching
class SimpleApi {
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

  // Simple GET request without caching
  async get(url, options = {}) {
    console.log('🌐 SimpleApi.get called:', url, options);
    const { params = {}, ...axiosOptions } = options;

    const fullUrl = buildApiUrl(url);

    try {
      console.log('🌐 API Request:', fullUrl, params);
      const response = await this.axios.get(fullUrl, {
        params,
        ...axiosOptions
      });

      return { data: response.data, fromCache: false };
    } catch (error) {
      throw error;
    }
  }

  // Simple POST request
  async post(url, data, options = {}) {
    const fullUrl = buildApiUrl(url);

    try {
      const response = await this.axios.post(fullUrl, data, options);
      return { data: response.data, fromCache: false };
    } catch (error) {
      throw error;
    }
  }
}

// Create singleton instance
const simpleApi = new SimpleApi();

// Simple API methods without caching
export const analyticsApi = {
  getOverview: (options = {}) => {
    const { params = {} } = options;
    // Add cache-busting parameter to force fresh data
    params._t = Date.now();
    return simpleApi.get('/api/analytics', { params });
  },

  getContent: (params = {}) =>
    simpleApi.get('/api/analytics/content', { params }),

  getLatestContent: (params = {}) =>
    simpleApi.get('/api/analytics/writer/latest-content', { params }),

  // Writer leaderboard
  getLeaderboard: (params = {}) =>
    simpleApi.get('/api/analytics/writer/leaderboard', { params })
};

export const contentApi = {
  getVideos: (params = {}) =>
    simpleApi.get('/api/writer/videos', { params })
};

export const staticDataApi = {
  getTropes: () =>
    simpleApi.get('/api/tropes'),

  getStructures: () =>
    simpleApi.get('/api/structures'),

  getWriter: (params = {}) =>
    simpleApi.get('/api/getWriter', { params })
};

export default simpleApi;
