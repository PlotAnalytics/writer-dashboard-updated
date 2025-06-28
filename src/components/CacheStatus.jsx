import React, { useState, useEffect } from 'react';
import { Box, Chip, Tooltip, IconButton } from '@mui/material';
import { 
  Speed as SpeedIcon, 
  Refresh as RefreshIcon,
  Storage as StorageIcon 
} from '@mui/icons-material';
import cacheManager from '../utils/cacheManager.js';

const CacheStatus = ({ onClearCache }) => {
  const [stats, setStats] = useState({ memoryEntries: 0, localStorageEntries: 0 });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setStats(cacheManager.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    cacheManager.clear();
    setStats({ memoryEntries: 0, localStorageEntries: 0 });
    if (onClearCache) {
      onClearCache();
    }
  };

  const totalEntries = stats.memoryEntries + stats.localStorageEntries;

  if (totalEntries === 0) {
    return null; // Don't show if no cache
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip 
        title={`Cache: ${stats.memoryEntries} in memory, ${stats.localStorageEntries} stored locally. Cached data loads instantly!`}
        arrow
      >
        <Chip
          icon={<SpeedIcon />}
          label={`${totalEntries} cached`}
          size="small"
          color="success"
          variant="outlined"
          sx={{
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderColor: 'rgba(76, 175, 80, 0.3)',
            color: '#4CAF50',
            fontSize: '0.75rem',
            '& .MuiChip-icon': {
              color: '#4CAF50'
            }
          }}
        />
      </Tooltip>
      
      <Tooltip title="Clear cache and refresh data" arrow>
        <IconButton
          size="small"
          onClick={handleClearCache}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default CacheStatus;
