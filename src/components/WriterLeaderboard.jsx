import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  IconButton
} from '@mui/material';
import {
  Refresh as RefreshIcon
} from '@mui/icons-material';
import BigHeadAvatar from './BigHeadAvatar.jsx';
import { analyticsApi } from '../utils/simpleApi.js';

const getRankStyle = (rank) => {
  switch (rank) {
    case 1:
      return {
        borderColor: '#FFD700',
        badgeColor: '#FFD700',
        badgeText: '1st',
        glowColor: 'rgba(255, 215, 0, 0.3)'
      };
    case 2:
      return {
        borderColor: '#C0C0C0',
        badgeColor: '#C0C0C0',
        badgeText: '2nd',
        glowColor: 'rgba(192, 192, 192, 0.3)'
      };
    case 3:
      return {
        borderColor: '#CD7F32',
        badgeColor: '#CD7F32',
        badgeText: '3rd',
        glowColor: 'rgba(205, 127, 50, 0.3)'
      };
    default:
      return {
        borderColor: '#666',
        badgeColor: '#666',
        badgeText: `${rank}th`,
        glowColor: 'rgba(102, 102, 102, 0.2)'
      };
  }
};

const WriterLeaderboard = ({ currentWriterName }) => {
  console.log('🏆 WriterLeaderboard component rendered, currentWriterName:', currentWriterName);

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [error, setError] = useState(null);

  // Fetch leaderboard data
  const fetchLeaderboardData = async () => {
    try {
      console.log('🏆 Starting leaderboard fetch for period:', period);
      setLoading(true);
      setError(null);

      const url = `/api/analytics/writer/leaderboard?period=${period}`;
      console.log('🏆 Fetching from URL:', url);

      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      console.log('🏆 Auth token available:', !!token);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('🏆 Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🏆 Leaderboard API Response:', data);

      // Extract the actual data array from the response
      const leaderboardArray = data.data || data || [];
      console.log('🏆 Leaderboard Array:', leaderboardArray);
      console.log('🏆 Array length:', leaderboardArray.length);

      setLeaderboardData(leaderboardArray);
    } catch (err) {
      console.error('❌ Error fetching leaderboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts or period changes
  useEffect(() => {
    console.log('🏆 WriterLeaderboard useEffect triggered, period:', period);
    fetchLeaderboardData();
  }, [period]);



  const handlePeriodChange = (event) => {
    const newPeriod = event.target.value;
    setPeriod(newPeriod);
  };

  const handleRefresh = () => {
    fetchLeaderboardData();
  };

  const formatViews = (views) => {
    if (views >= 1000000000) return `${(views / 1000000000).toFixed(1)}B`;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views?.toString() || '0';
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
    <Box sx={{
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(102, 126, 234, 0.2)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      overflow: 'hidden',
      p: 3,
      height: '500px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{
            fontWeight: 700,
            fontSize: '20px',
            color: 'white'
          }}>
            Leaderboard
          </Typography>
          <Typography variant="body2" sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '16px',
            ml: 0.5
          }}>
            ▶
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 40 }}>
            <Select
              value={period}
              onChange={handlePeriodChange}
              variant="outlined"
              MenuProps={{
                PaperProps: {
                  sx: {
                    background: 'rgba(30, 30, 50, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    '& .MuiMenuItem-root': {
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '12px',
                      minHeight: '24px',
                      padding: '4px 8px',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.1)'
                      },
                      '&.Mui-selected': {
                        background: 'rgba(102, 126, 234, 0.2)',
                        '&:hover': {
                          background: 'rgba(102, 126, 234, 0.3)'
                        }
                      }
                    }
                  }
                }
              }}
              sx={{
                height: '20px',
                minHeight: '20px',
                '& .MuiOutlinedInput-root': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '100px',
                  height: '20px',
                  minHeight: '20px',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 500,
                  border: 'none !important',
                  outline: 'none !important',
                  '& fieldset': {
                    border: 'none !important',
                    outline: 'none !important'
                  },
                  '&:hover fieldset': {
                    border: 'none !important',
                    outline: 'none !important'
                  },
                  '&.Mui-focused fieldset': {
                    border: 'none !important',
                    outline: 'none !important'
                  },
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.15)'
                  },
                  '& .MuiSelect-select': {
                    paddingLeft: '8px',
                    paddingRight: '20px !important',
                    paddingTop: '0px',
                    paddingBottom: '0px',
                    display: 'flex',
                    alignItems: 'center',
                    height: '20px',
                    minHeight: '20px',
                    lineHeight: '20px'
                  },
                  '& .MuiSelect-icon': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '12px',
                    right: '2px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }
                },
                '& .MuiInputBase-root': {
                  height: '20px',
                  minHeight: '20px'
                }
              }}
            >
              <MenuItem value="7d">7d</MenuItem>
              <MenuItem value="14d">14d</MenuItem>
              <MenuItem value="30d">30d</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Scrollable Content Container */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#667eea' }} />
            <Typography variant="body2" sx={{ color: 'white', ml: 2 }}>
              Loading leaderboard...
            </Typography>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Box sx={{
            textAlign: 'center',
            py: 4,
            color: '#ff6b6b'
          }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Error loading leaderboard
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
          </Box>
        )}

      {/* Top 3 - Podium Style */}
      {leaderboardData.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'end',
            gap: 2,
            mb: 3
          }}>
            {/* 2nd Place */}
            {leaderboardData[1] && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'translateY(20px)'
              }}>
                <Box sx={{
                  position: 'relative',
                  mb: 2
                }}>
                  <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    border: `4px solid ${getRankStyle(2).borderColor}`,
                    overflow: 'hidden',
                    boxShadow: `0 0 20px ${getRankStyle(2).glowColor}`,
                    background: 'white'
                  }}>
                    <BigHeadAvatar
                      name={leaderboardData[1].writer_name}
                      avatarSeed={leaderboardData[1].avatar_seed}
                      size={72}
                    />
                  </Box>
                  <Box sx={{
                    position: 'absolute',
                    bottom: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: getRankStyle(2).badgeColor,
                    color: 'white',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    2nd
                  </Box>
                </Box>
                <Typography variant="body2" sx={{
                  color: 'white',
                  fontWeight: 600,
                  textAlign: 'center',
                  mb: 0.5
                }}>
                  {leaderboardData[1].writer_name}
                </Typography>
                <Typography variant="caption" sx={{
                  color: '#667eea',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  {formatViews(leaderboardData[1].total_views)} VIEWS
                </Typography>
              </Box>
            )}

            {/* 1st Place */}
            {leaderboardData[0] && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Box sx={{
                  position: 'relative',
                  mb: 2
                }}>
                  <Box sx={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    border: `4px solid ${getRankStyle(1).borderColor}`,
                    overflow: 'hidden',
                    boxShadow: `0 0 30px ${getRankStyle(1).glowColor}`,
                    background: 'white'
                  }}>
                    <BigHeadAvatar
                      name={leaderboardData[0].writer_name}
                      avatarSeed={leaderboardData[0].avatar_seed}
                      size={92}
                    />
                  </Box>
                  <Box sx={{
                    position: 'absolute',
                    bottom: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: getRankStyle(1).badgeColor,
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700
                  }}>
                    1st
                  </Box>
                </Box>
                <Typography variant="body1" sx={{
                  color: 'white',
                  fontWeight: 700,
                  textAlign: 'center',
                  mb: 0.5
                }}>
                  {leaderboardData[0].writer_name}
                </Typography>
                <Typography variant="body2" sx={{
                  color: '#FFD700',
                  fontWeight: 700,
                  fontSize: '13px'
                }}>
                  👑 {formatViews(leaderboardData[0].total_views)} VIEWS
                </Typography>
              </Box>
            )}

            {/* 3rd Place */}
            {leaderboardData[2] && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'translateY(20px)'
              }}>
                <Box sx={{
                  position: 'relative',
                  mb: 2
                }}>
                  <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    border: `4px solid ${getRankStyle(3).borderColor}`,
                    overflow: 'hidden',
                    boxShadow: `0 0 20px ${getRankStyle(3).glowColor}`,
                    background: 'white'
                  }}>
                    <BigHeadAvatar
                      name={leaderboardData[2].writer_name}
                      avatarSeed={leaderboardData[2].avatar_seed}
                      size={72}
                    />
                  </Box>
                  <Box sx={{
                    position: 'absolute',
                    bottom: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: getRankStyle(3).badgeColor,
                    color: 'white',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    3rd
                  </Box>
                </Box>
                <Typography variant="body2" sx={{
                  color: 'white',
                  fontWeight: 600,
                  textAlign: 'center',
                  mb: 0.5
                }}>
                  {leaderboardData[2].writer_name}
                </Typography>
                <Typography variant="caption" sx={{
                  color: '#667eea',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  {formatViews(leaderboardData[2].total_views)} VIEWS
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Rest of the leaderboard */}
      {leaderboardData.length > 3 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{
            color: 'white',
            mb: 2,
            textAlign: 'center',
            fontWeight: 600
          }}>
            Other Writers
          </Typography>

          {leaderboardData.slice(3).map((writer, index) => {
            const rank = index + 4;
            return (
              <Box
                key={writer.writer_name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  p: 1.2,
                  mb: 1,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)'
                  }
                }}
              >
                {/* Rank */}
                <Box sx={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  #{rank}
                </Box>

                {/* Avatar */}
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255, 255, 255, 0.2)',
                  overflow: 'hidden',
                  mr: 1.5,
                  background: 'white'
                }}>
                  <BigHeadAvatar
                    name={writer.writer_name}
                    avatarSeed={writer.avatar_seed}
                    size={32}
                  />
                </Box>

                {/* Writer Name */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}>
                    {writer.writer_name}
                  </Typography>
                </Box>

                {/* Views on the right */}
                <Box sx={{
                  textAlign: 'right',
                  flexShrink: 0,
                  ml: 1.5
                }}>
                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    {formatViews(writer.total_views)}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.65rem'
                  }}>
                    views
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

        {/* Empty State */}
        {leaderboardData.length === 0 && !loading && (
          <Box sx={{
            textAlign: 'center',
            py: 6,
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              No data available
            </Typography>
            <Typography variant="body2">
              Try selecting a different time period
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default WriterLeaderboard;
