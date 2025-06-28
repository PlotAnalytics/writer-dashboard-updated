import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import cacheManager from '../utils/cacheManager.js';
import { staticDataApi } from '../utils/cachedApi.js';

const CacheTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [cacheStats, setCacheStats] = useState({ memoryEntries: 0, localStorageEntries: 0 });

  const addResult = (message) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const updateStats = () => {
    setCacheStats(cacheManager.getStats());
  };

  const testBasicCache = () => {
    addResult('🧪 Testing basic cache functionality...');
    
    // Test 1: Store and retrieve
    const testKey = 'test_key_123';
    const testData = { message: 'Hello Cache!', timestamp: Date.now() };
    
    cacheManager.set(testKey, testData, 60000); // 1 minute TTL
    const retrieved = cacheManager.get(testKey);
    
    if (retrieved && retrieved.message === testData.message) {
      addResult('✅ Basic cache store/retrieve works');
    } else {
      addResult('❌ Basic cache store/retrieve failed');
    }
    
    updateStats();
  };

  const testApiCache = async () => {
    addResult('🧪 Testing API cache functionality...');
    
    try {
      // First call - should hit API
      const start1 = Date.now();
      const result1 = await staticDataApi.getTropes();
      const time1 = Date.now() - start1;
      addResult(`📡 First API call took ${time1}ms, fromCache: ${result1.fromCache || false}`);
      
      // Second call - should hit cache
      const start2 = Date.now();
      const result2 = await staticDataApi.getTropes();
      const time2 = Date.now() - start2;
      addResult(`⚡ Second API call took ${time2}ms, fromCache: ${result2.fromCache || false}`);
      
      if (result2.fromCache && time2 < time1) {
        addResult('✅ API caching is working - second call was faster and from cache');
      } else {
        addResult('❌ API caching may not be working properly');
      }
      
    } catch (error) {
      addResult(`❌ API cache test failed: ${error.message}`);
    }
    
    updateStats();
  };

  const clearCache = () => {
    cacheManager.clear();
    addResult('🧹 Cache cleared');
    updateStats();
  };

  useEffect(() => {
    updateStats();
  }, []);

  return (
    <Box sx={{ p: 4, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Cache System Test
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={testBasicCache}>
          Test Basic Cache
        </Button>
        <Button variant="contained" onClick={testApiCache}>
          Test API Cache
        </Button>
        <Button variant="outlined" onClick={clearCache}>
          Clear Cache
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3, backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <Typography variant="h6" gutterBottom>
          Cache Statistics
        </Typography>
        <Typography>Memory Entries: {cacheStats.memoryEntries}</Typography>
        <Typography>LocalStorage Entries: {cacheStats.localStorageEntries}</Typography>
        <Typography>Total: {cacheStats.memoryEntries + cacheStats.localStorageEntries}</Typography>
      </Paper>

      <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <Typography variant="h6" gutterBottom>
          Test Results
        </Typography>
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {testResults.map((result, index) => (
            <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
              {result}
            </Typography>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default CacheTest;
