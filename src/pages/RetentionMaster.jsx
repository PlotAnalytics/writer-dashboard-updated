import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Link,
  Card,
  CardContent,
  Pagination,
  Stack,
  Drawer,
  Avatar,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Logout as LogoutIcon } from '@mui/icons-material';
import BigHeadAvatar from '../components/BigHeadAvatar.jsx';

const drawerWidth = 280;

const RetentionMaster = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_videos: 0,
    videos_per_page: 200,
    has_next_page: false,
    has_prev_page: false
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchRetentionData(currentPage);
  }, [currentPage]);

  const fetchRetentionData = async (page = 1) => {
    try {
      setLoading(true);
      console.log(`🎯 Fetching retention master data for page ${page}...`);

      const response = await axios.get('/api/analytics/retention-master', {
        params: { page },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('✅ Retention master data received:', response.data);
      setVideos(response.data.videos || []);
      setPagination(response.data.pagination || {});
      setError('');
    } catch (err) {
      console.error('❌ Error fetching retention data:', err);
      setError('Failed to load retention data: ' + (err.response?.data?.details || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderRetentionChart = (video) => {
    if (!video.retention_data || video.retention_data.length === 0) {
      return (
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#888', fontSize: '0.8rem' }}>
            No retention data available
          </Typography>
        </Box>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={video.retention_data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2,2" stroke="#444" opacity={0.3} />
          <XAxis
            dataKey="elapsed_video_time_seconds"
            stroke="#aaa"
            tick={{ fill: "#aaa", fontSize: 8 }}
            tickFormatter={(value) => `${Math.round(value)}s`}
            interval="preserveStartEnd"
            domain={[0, video.video_duration_seconds]}
            type="number"
          />
          <YAxis
            stroke="#aaa"
            tick={{ fill: "#aaa", fontSize: 8 }}
            tickFormatter={(value) => `${Math.round(value)}%`}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff'
            }}
            labelFormatter={(label) => `${Math.round(label)} seconds`}
            formatter={(value) => [`${Math.round(value)}%`, 'Retention']}
          />
          <Line
            type="monotone"
            dataKey="audienceRetention"
            stroke="#00E5FF"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 3,
              stroke: "#00E5FF",
              strokeWidth: 1,
              fill: "#00E5FF"
            }}
          />
          <ReferenceLine
            x={30}
            stroke="#ff4444"
            strokeDasharray="4,4"
            strokeWidth={1}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column'
        }}
      >
        <CircularProgress sx={{ color: "#00BCD4", mb: 2 }} size={60} />
        <Typography variant="h6" sx={{ color: "white" }}>
          Loading retention data...
        </Typography>
      </Box>
    );
  }

  // Sidebar content
  const sidebarContent = (
    <>
      {/* User Profile Section */}
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              background: 'white',
            }}
          >
            <BigHeadAvatar
              name="Retention Master"
              size={44}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1" fontWeight="600" sx={{
              color: 'white',
              mb: 0.5,
            }}>
              Retention Master
            </Typography>
            <Chip
              label="Admin Access"
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '11px',
                height: '20px',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Logout Section */}
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ px: 2, pb: 3 }}>
        <Box
          onClick={handleLogout}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderRadius: '12px',
            cursor: 'pointer',
            color: 'rgba(255, 255, 255, 0.6)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.9)',
              transform: 'translateX(4px)',
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ color: 'inherit', fontSize: 18 }}>
              <LogoutIcon />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight="500" sx={{
                color: 'inherit',
                mb: 0.2,
              }}>
                Logout
              </Typography>
              <Typography variant="caption" sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px'
              }}>
                Sign out securely
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              borderRight: 'none',
              boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
            },
          }}
          variant="permanent"
          anchor="left"
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        <Box sx={{ p: 2, px: 3, maxWidth: '100%' }}>
        {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{
            color: 'white',
            fontWeight: 600,
            textAlign: 'center',
            mb: 2,
            background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Retention Master Dashboard
        </Typography>

      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <Card
        sx={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '100%'
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <TableContainer
            sx={{
              maxHeight: 'calc(100vh - 180px)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '4px',
              },
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      fontWeight: 600,
                      borderBottom: '2px solid #333',
                      width: '200px'
                    }}
                  >
                    Video Title
                  </TableCell>
                  <TableCell
                    sx={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      fontWeight: 600,
                      borderBottom: '2px solid #333',
                      width: '300px'
                    }}
                  >
                    URL
                  </TableCell>
                  <TableCell
                    sx={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      fontWeight: 600,
                      borderBottom: '2px solid #333',
                      width: '120px'
                    }}
                  >
                    Writer
                  </TableCell>
                  <TableCell
                    sx={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      fontWeight: 600,
                      borderBottom: '2px solid #333',
                      minWidth: '400px'
                    }}
                  >
                    Retention Chart
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {videos.map((video, index) => (
                  <TableRow
                    key={video.video_id}
                    sx={{
                      '&:nth-of-type(odd)': {
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      },
                      '&:nth-of-type(even)': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                      },
                    }}
                  >
                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333', py: 1, px: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.3 }}>
                        {video.title}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333', py: 1, px: 2 }}>
                      <Link
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: '#00E5FF',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {video.url.replace('https://www.youtube.com/watch?v=', 'youtube.com/watch?v=')}
                        </Typography>
                      </Link>
                    </TableCell>
                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333', py: 1, px: 2 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {video.writer_name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid #333', py: 0.5, px: 1 }}>
                      {renderRetentionChart(video)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <Stack spacing={2} alignItems="center">
              <Pagination
                count={pagination.total_pages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: '#00BCD4',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: '#00ACC1',
                      },
                    },
                  },
                }}
              />
              <Typography variant="body2" sx={{ color: '#888' }}>
                {pagination.total_videos} total videos across all writers
              </Typography>
            </Stack>
          </Box>
        )}
      </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default RetentionMaster;
