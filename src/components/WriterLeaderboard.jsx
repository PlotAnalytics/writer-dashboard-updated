import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  Visibility as ViewsIcon,
  CalendarToday as CalendarIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { analyticsApi } from '../utils/cachedApi.js';

const WriterLeaderboard = ({ currentWriterName }) => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [error, setError] = useState(null);

  const fetchLeaderboard = async (selectedPeriod = period) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await analyticsApi.getLeaderboard({ 
        period: selectedPeriod, 
        limit: 10 
      });
      
      setLeaderboardData(data.data || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handlePeriodChange = (event) => {
    const newPeriod = event.target.value;
    setPeriod(newPeriod);
    fetchLeaderboard(newPeriod);
  };

  const formatViews = (views) => {
    if (views >= 1000000000) return `${(views / 1000000000).toFixed(1)}B`;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
    if (rank === 2) return 'linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 100%)';
    if (rank === 3) return 'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)';
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  const isCurrentWriter = (writerName) => {
    return currentWriterName && writerName === currentWriterName;
  };

  if (loading) {
    return (
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(102, 126, 234, 0.2)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        p: 3
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress sx={{ color: '#667eea' }} />
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.08) 0%, rgba(244, 67, 54, 0.08) 100%)',
        border: '1px solid rgba(244, 67, 54, 0.2)',
        borderRadius: '16px',
        p: 3
      }}>
        <Typography color="error" align="center">{error}</Typography>
      </Card>
    );
  }

  return (
    <Card sx={{
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(102, 126, 234, 0.2)',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden'
    }}>
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Box sx={{
          p: 1.5,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
          borderBottom: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TrophyIcon sx={{ color: '#FFD700', fontSize: 16 }} />
              <Typography variant="subtitle2" sx={{
                fontWeight: 600,
                fontSize: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Writer Leaderboard
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={period}
                  onChange={handlePeriodChange}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      height: '32px',
                      fontSize: '12px',
                      '& fieldset': { border: '1px solid rgba(102, 126, 234, 0.3)' },
                      '&:hover fieldset': { border: '1px solid rgba(102, 126, 234, 0.5)' },
                      '&.Mui-focused fieldset': { border: '1px solid #667eea' }
                    }
                  }}
                >
                  <MenuItem value="7d" sx={{ fontSize: '12px' }}>7d</MenuItem>
                  <MenuItem value="30d" sx={{ fontSize: '12px' }}>30d</MenuItem>
                  <MenuItem value="90d" sx={{ fontSize: '12px' }}>90d</MenuItem>
                  <MenuItem value="1y" sx={{ fontSize: '12px' }}>1y</MenuItem>
                </Select>
              </FormControl>

              <IconButton
                onClick={() => fetchLeaderboard()}
                size="small"
                sx={{
                  color: '#667eea',
                  width: '32px',
                  height: '32px',
                  '&:hover': { background: 'rgba(102, 126, 234, 0.1)' }
                }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Leaderboard List */}
        <Box sx={{
          p: 1.5,
          maxHeight: '350px',
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a5d87 100%)',
          },
        }}>
          {leaderboardData.map((writer, index) => (
            <Box
              key={writer.writer_name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1,
                mb: 0.5,
                borderRadius: '6px',
                background: isCurrentWriter(writer.writer_name)
                  ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isCurrentWriter(writer.writer_name)
                  ? '2px solid rgba(102, 126, 234, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }
              }}
            >
              {/* Rank Badge */}
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: getRankColor(writer.rank),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '11px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                  mr: 1,
                  flexShrink: 0
                }}
              >
                {getRankIcon(writer.rank)}
              </Box>

              {/* Writer Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: isCurrentWriter(writer.writer_name) ? '#667eea' : 'inherit',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {writer.writer_name}
                  </Typography>
                  {isCurrentWriter(writer.writer_name) && (
                    <Chip
                      label="You"
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontSize: '8px',
                        height: '16px',
                        '& .MuiChip-label': { px: 0.5 }
                      }}
                    />
                  )}
                  {writer.is_active && (
                    <Chip
                      label="Active"
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                        color: 'white',
                        fontSize: '8px',
                        height: '16px',
                        '& .MuiChip-label': { px: 0.5 }
                      }}
                    />
                  )}

                  {/* Stats in same line */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#667eea', fontSize: '11px' }}>
                      {formatViews(writer.total_views)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                      {writer.days_active}d
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Progress to 1B */}
              <Box sx={{ textAlign: 'right', minWidth: '80px' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#667eea' }}>
                  {writer.progress_to_1b_percent}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  to 1B
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default WriterLeaderboard;
