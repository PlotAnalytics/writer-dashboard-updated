import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  FormControl,
  Select,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  KeyboardArrowDown as ArrowDownIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import axios from 'axios';
import { contentApi } from '../utils/simpleApi.js';

const Content = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [selectedItems, setSelectedItems] = useState([]);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [contentData, setContentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('lifetime');
  const [videoTypeFilter, setVideoTypeFilter] = useState('short'); // 'short', 'video', 'full_to_short' - start with shorts
  const [currentPage, setCurrentPage] = useState(1);
  const [videosPerPage] = useState(20);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalVideos: 0,
    videosPerPage: 20,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Modern search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch writer-specific videos from InfluxDB and PostgreSQL
  const fetchContentData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get writer ID from user context or localStorage - NO FALLBACK for security
      let writerId = user?.writerId || localStorage.getItem('writerId');

      // SECURITY: If no writerId, fetch from profile endpoint
      if (!writerId) {
        try {
          console.log('🔒 No writerId found, fetching from profile for security...');
          const profileResponse = await axios.get('/api/auth/profile');
          if (profileResponse.data.user.writerId) {
            writerId = profileResponse.data.user.writerId.toString();
            localStorage.setItem('writerId', writerId);
            console.log('✅ Security: Got writerId from profile:', writerId);
          } else {
            console.error('❌ SECURITY ERROR: No writerId available for user');
            setError('Unable to load your content. Please log out and log back in.');
            setLoading(false);
            return;
          }
        } catch (profileError) {
          console.error('❌ SECURITY ERROR: Could not fetch writerId:', profileError);
          setError('Authentication error. Please log out and log back in.');
          setLoading(false);
          return;
        }
      }

      console.log('🎬 Fetching content for writer:', writerId, 'Range:', dateRange, 'Type:', videoTypeFilter, 'Tab:', tabValue);

      // Try InfluxDB first, then PostgreSQL fallback
      let responseData;
      try {
        const { data } = await contentApi.getVideos({
          writer_id: writerId,
          range: dateRange,
          page: currentPage,
          limit: videosPerPage,
          type: videoTypeFilter
        });
        responseData = data;
        console.log('✅ Got response from /api/writer/videos:', data);
      } catch (influxError) {
        console.log('⚠️ InfluxDB API failed, trying PostgreSQL fallback');
        const response = await axios.get(`/api/writer/analytics`, {
          params: {
            writer_id: writerId,
            page: currentPage,
            limit: videosPerPage,
            type: videoTypeFilter
          }
        });
        responseData = response.data;
        console.log('✅ Got response from PostgreSQL fallback:', response.data);
      }

      // Handle paginated response
      if (responseData) {
        let videos, paginationData;

        if (responseData.videos && responseData.pagination) {
          // Paginated response
          videos = responseData.videos;
          paginationData = responseData.pagination;
          setPagination(paginationData);
        } else if (Array.isArray(responseData)) {
          // Legacy non-paginated response
          videos = responseData;
          setPagination({
            currentPage: 1,
            totalPages: 1,
            totalVideos: videos.length,
            videosPerPage: videos.length,
            hasNextPage: false,
            hasPrevPage: false
          });
        } else {
          videos = [];
        }

        // Apply sorting
        videos = sortVideos(videos, sortBy, sortOrder);

        // Apply filtering (video type filtering is now done server-side)
        if (filterStatus !== 'all') {
          videos = videos.filter(video =>
            video.status?.toLowerCase() === filterStatus.toLowerCase()
          );
        }

        // Apply search filtering
        if (searchQuery.trim()) {
          videos = videos.filter(video => {
            const title = video.title?.toLowerCase() || '';
            const url = video.url?.toLowerCase() || '';
            const query = searchQuery.toLowerCase();
            return title.includes(query) || url.includes(query);
          });
        }

        setContentData(videos);
        console.log('📺 Writer videos loaded:', videos.length, 'videos for writer', writerId, 'Page:', currentPage, 'Type filter:', videoTypeFilter, 'Tab:', tabValue);

        // Debug: Log video types in the response
        if (videos.length > 0) {
          const typeBreakdown = videos.reduce((acc, video) => {
            acc[video.type || 'unknown'] = (acc[video.type || 'unknown'] || 0) + 1;
            return acc;
          }, {});
          console.log('🔍 Video type breakdown in response:', typeBreakdown);
          console.log('🔍 Sample videos:', videos.slice(0, 3).map(v => ({ title: v.title, type: v.type, isShort: v.isShort, url: v.url })));
        }

        // Debug: Log sample video data to see account names
        if (videos.length > 0) {
          console.log('🔍 Sample video data:', {
            title: videos[0].title,
            account_name: videos[0].account_name,
            writer_name: videos[0].writer_name,
            views: videos[0].views,
            url: videos[0].url
          });
        }
      } else {
        console.log('⚠️ No video data received, using mock data');
        setContentData(getMockData());
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalVideos: 2,
          videosPerPage: 2,
          hasNextPage: false,
          hasPrevPage: false
        });
      }
    } catch (err) {
      console.error('❌ Error fetching writer videos:', err);
      setError(err.message);
      // Fallback to mock data
      setContentData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  // Sort videos function
  const sortVideos = (videos, sortField, order) => {
    return [...videos].sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'date':
          aVal = new Date(a.posted_date);
          bVal = new Date(b.posted_date);
          break;
        case 'views':
          aVal = a.views || 0;
          bVal = b.views || 0;
          break;
        case 'title':
          aVal = a.title?.toLowerCase() || '';
          bVal = b.title?.toLowerCase() || '';
          break;
        case 'likes':
          aVal = a.likes || 0;
          bVal = b.likes || 0;
          break;
        default:
          aVal = a.posted_date;
          bVal = b.posted_date;
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Mock data function
  const getMockData = () => {
    return [
      {
        id: 1,
        url: "https://youtube.com/shorts/sample1",
        title: "[Short] Quick Story - Epic Adventure",
        writer_name: "Test Writer",
        account_name: "StoryChannel",
        preview: "https://img.youtube.com/vi/sample1/maxresdefault.jpg",
        views: 125000,
        likes: 4500,
        comments: 320,
        posted_date: new Date(Date.now() - 86400000 * 2).toISOString(),
        duration: "0:45",
        type: "short",
        status: "Published"
      },
      {
        id: 2,
        url: "https://youtube.com/watch?v=sample2",
        title: "[Original] My Creative Writing Journey - Behind the Scenes",
        writer_name: "Test Writer",
        account_name: "CreativeStories",
        preview: "https://img.youtube.com/vi/sample2/maxresdefault.jpg",
        views: 89000,
        likes: 3200,
        comments: 180,
        posted_date: new Date(Date.now() - 86400000 * 5).toISOString(),
        duration: "12:30",
        type: "video",
        status: "Published"
      },
      {
        id: 3,
        url: "https://youtube.com/watch?v=sample3",
        title: "[Full to Short] Epic Story Condensed - The Ultimate Version",
        writer_name: "Test Writer",
        account_name: "ConvertedStories",
        preview: "https://img.youtube.com/vi/sample3/maxresdefault.jpg",
        views: 156000,
        likes: 7800,
        comments: 420,
        posted_date: new Date(Date.now() - 86400000 * 3).toISOString(),
        duration: "1:15",
        type: "full_to_short",
        status: "Published"
      }
    ];
  };

  useEffect(() => {
    fetchContentData();
  }, [sortBy, sortOrder, filterStatus, dateRange, currentPage, videoTypeFilter, searchQuery]);

  // Handle sort change
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Handle filter change
  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setFilterAnchor(null);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';

    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown Date';
    }
  };

  // Format views count
  const formatViews = (views) => {
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    }
    return views?.toString() || '0';
  };

  // Calculate engagement rate
  const calculateEngagement = (likes, views) => {
    if (!views || views === 0) return '0';
    return ((likes / views) * 100).toFixed(1);
  };

  

  // Get current content based on selected tab (for now, show all content in both tabs)
  const currentContent = contentData;

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedItems(currentContent.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const isSelected = (id) => selectedItems.includes(id);
  const isAllSelected = selectedItems.length === contentData.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < contentData.length;

  const handleVideoClick = (videoId, event) => {
    // Don't navigate if clicking on checkbox or more options
    if (event.target.closest('input[type="checkbox"]') || event.target.closest('[data-testid="MoreVertIcon"]')) {
      return;
    }
    // Don't navigate if clicking on thumbnail (it should go to YouTube)
    if (event.target.closest('.video-thumbnail')) {
      return;
    }
    navigate(`/content/video/${videoId}`);
  };

  const handleThumbnailClick = (videoUrl, event) => {
    event.stopPropagation(); // Prevent card click
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  return (
    <Layout>
      <Box sx={{
        minHeight: '100vh',
        background: 'transparent',
        color: 'white',
        p: 0
      }}>
        {/* Modern Header */}
        <Box sx={{
          p: 3,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: -1,
            left: 24,
            width: '60px',
            height: '2px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '2px',
          }
        }}>
          <Typography variant="h4" sx={{
            color: 'white',
            fontWeight: 700,
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Channel Content
          </Typography>

          {/* Tabs */}
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => {
              console.log('🔄 Tab changed from', tabValue, 'to', newValue);
              setTabValue(newValue);
              setSelectedItems([]); // Reset selections when switching tabs
              // Update video type filter based on tab
              if (newValue === 0) {
                console.log('🔄 Setting filter to: short');
                setVideoTypeFilter('short'); // Shorts tab
              } else if (newValue === 1) {
                console.log('🔄 Setting filter to: video');
                setVideoTypeFilter('video'); // Videos tab
              }
              setCurrentPage(1); // Reset to first page when changing tabs
            }}
            sx={{
              '& .MuiTab-root': {
                color: '#888',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                minWidth: 'auto',
                px: 0,
                mr: 4
              },
              '& .Mui-selected': { color: 'white !important' },
              '& .MuiTabs-indicator': {
                backgroundColor: 'white',
                height: 2
              }
            }}
          >
            <Tab label="Shorts" />
            <Tab label="Videos" />
           
          </Tabs>
        </Box>

        {/* Filter Bar */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderBottom: '1px solid #333'
        }}>
          <IconButton
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            sx={{ color: '#888' }}
          >
            <FilterIcon />
          </IconButton>
          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowDownIcon />}
            sx={{
              color: '#888',
              borderColor: '#444',
              textTransform: 'none',
              '&:hover': { borderColor: '#666' }
            }}
          >
            Filter: {filterStatus === 'all' ? 'All content' : filterStatus}
          </Button>

          {/* Date Range Selector */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              sx={{
                color: '#888',
                borderColor: '#444',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb300' },
                '& .MuiSvgIcon-root': { color: '#888' }
              }}
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="14">Last 14 days</MenuItem>
              <MenuItem value="28">Last 28 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
              <MenuItem value="lifetime">Lifetime</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" sx={{ color: '#888', ml: 'auto' }}>
            {pagination.totalVideos} videos found • Page {pagination.currentPage} of {pagination.totalPages}
          </Typography>

          <Menu
            anchorEl={filterAnchor}
            open={Boolean(filterAnchor)}
            onClose={() => setFilterAnchor(null)}
            PaperProps={{
              sx: {
                bgcolor: '#2a2a2a',
                border: '1px solid #444',
                '& .MuiMenuItem-root': {
                  color: 'white',
                  '&:hover': { bgcolor: '#3a3a3a' }
                }
              }
            }}
          >
            <MenuItem onClick={() => handleFilterChange('all')}>
              All content
            </MenuItem>
            <MenuItem onClick={() => handleFilterChange('published')}>
              Published
            </MenuItem>
            <MenuItem onClick={() => handleFilterChange('unlisted')}>
              Unlisted
            </MenuItem>
            <MenuItem onClick={() => handleFilterChange('private')}>
              Private
            </MenuItem>
          </Menu>
        </Box>

        {/* Modern Search Bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
          <TextField
            fullWidth
            placeholder="Search content by title or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: '#667eea' // fallback for browsers that don't support gradient text
                    }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              maxWidth: 500,
              '& .MuiOutlinedInput-root': {
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(5px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                transition: 'all 0.2s ease-in-out',
                '& fieldset': { border: 'none' },
                '&:hover': {
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                },
                '&.Mui-focused': {
                  border: '1px solid rgba(102, 126, 234, 0.5)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)',
                },
              },
              '& .MuiInputBase-input': {
                color: 'white',
                fontSize: '0.95rem',
                '&::placeholder': {
                  color: 'rgba(255, 255, 255, 0.5)',
                  opacity: 1,
                },
              },
            }}
          />
        </Box>

        {/* Content Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ borderBottom: '1px solid #333' }}>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}>
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={handleSelectAll}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.4)',
                      '&.Mui-checked': {
                        color: '#667eea',
                      },
                      '&.MuiCheckbox-indeterminate': {
                        color: '#667eea',
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}>
                  <Button
                    onClick={() => handleSort('title')}
                    sx={{
                      color: '#888',
                      textTransform: 'none',
                      p: 0,
                      minWidth: 'auto',
                      '&:hover': { color: 'white' }
                    }}
                  >
                    {tabValue === 0 ? 'Short' : tabValue === 1 ? 'Video' : 'Full to Short'}
                    {sortBy === 'title' && (
                      <ArrowDownIcon
                        sx={{
                          fontSize: 16,
                          ml: 0.5,
                          transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none'
                        }}
                      />
                    )}
                  </Button>
                </TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}>Account</TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}>
                  <Button
                    onClick={() => handleSort('date')}
                    sx={{
                      color: '#888',
                      textTransform: 'none',
                      p: 0,
                      minWidth: 'auto',
                      '&:hover': { color: 'white' }
                    }}
                  >
                    Date
                    {sortBy === 'date' && (
                      <ArrowDownIcon
                        sx={{
                          fontSize: 16,
                          ml: 0.5,
                          transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none'
                        }}
                      />
                    )}
                  </Button>
                </TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}>
                  <Button
                    onClick={() => handleSort('views')}
                    sx={{
                      color: '#888',
                      textTransform: 'none',
                      p: 0,
                      minWidth: 'auto',
                      '&:hover': { color: 'white' }
                    }}
                  >
                    Views
                    {sortBy === 'views' && (
                      <ArrowDownIcon
                        sx={{
                          fontSize: 16,
                          ml: 0.5,
                          transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none'
                        }}
                      />
                    )}
                  </Button>
                </TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}>
                  <Button
                    onClick={() => handleSort('likes')}
                    sx={{
                      color: '#888',
                      textTransform: 'none',
                      p: 0,
                      minWidth: 'auto',
                      '&:hover': { color: 'white' }
                    }}
                  >
                    Engagement
                    {sortBy === 'likes' && (
                      <ArrowDownIcon
                        sx={{
                          fontSize: 16,
                          ml: 0.5,
                          transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none'
                        }}
                      />
                    )}
                  </Button>
                </TableCell>
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                    <CircularProgress sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '50%',
                      '& .MuiCircularProgress-circle': {
                        stroke: 'url(#gradient)',
                      },
                      '& svg': {
                        filter: 'drop-shadow(0 0 8px rgba(102, 126, 234, 0.3))',
                      }
                    }} />
                    <svg width="0" height="0">
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#667eea" />
                          <stop offset="100%" stopColor="#764ba2" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <Typography variant="body2" sx={{
                      color: '#888',
                      mt: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      Loading your content...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#ff6b6b', mb: 1 }}>
                      Error loading content: {error}
                    </Typography>
                    <Button
                      onClick={fetchContentData}
                      sx={{ color: '#ffb300', textTransform: 'none' }}
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : currentContent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      No content found for this writer
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                currentContent.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={(event) => handleVideoClick(item.id, event)}
                  sx={{
                    borderBottom: '1px solid #333',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#2a2a2a' }
                  }}
                >
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Checkbox
                      checked={isSelected(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.4)',
                        '&.Mui-checked': {
                          color: '#667eea',
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {/* Thumbnail */}
                      <Box sx={{ position: 'relative' }}>
                        <Box
                          className="video-thumbnail"
                          component="img"
                          src={item.preview || `https://img.youtube.com/vi/${item.url?.split('v=')[1]}/maxresdefault.jpg`}
                          sx={{
                            width: 60,
                            height: 40,
                            borderRadius: '4px',
                            objectFit: 'cover',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                            }
                          }}
                          onClick={(event) => handleThumbnailClick(item.url, event)}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <Box
                          className="video-thumbnail"
                          sx={{
                            width: 60,
                            height: 40,
                            bgcolor: '#333',
                            borderRadius: '4px',
                            display: 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: '#888',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                            }
                          }}
                          onClick={(event) => handleThumbnailClick(item.url, event)}
                        >
                          🎬
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            bgcolor: 'rgba(0,0,0,0.8)',
                            color: 'white',
                            px: 0.5,
                            borderRadius: '2px',
                            fontSize: '10px'
                          }}
                        >
                          {item.duration || '0:30'}
                        </Box>
                      </Box>

                      {/* Sleek Link Button */}
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          window.open(item.url, '_blank');
                        }}
                        sx={{
                          minWidth: '50px',
                          height: '28px',
                          px: 1.5,
                          py: 0.5,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          textTransform: 'none',
                          borderRadius: '6px',
                          border: 'none',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                          },
                          '&:active': {
                            transform: 'translateY(0)',
                            boxShadow: '0 2px 6px rgba(102, 126, 234, 0.3)',
                          }
                        }}
                      >
                        Link
                      </Button>
                      {/* Title and Description */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, mb: 0.5 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          {item.writer_name || 'Writer'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: item.account_name ? 'white' : '#888',
                        fontStyle: item.account_name ? 'normal' : 'italic'
                      }}
                    >
                      {item.account_name || `[No Account] ${item.writer_name || 'Writer'}`}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'white', mb: 0.5 }}>
                        {formatDate(item.posted_date)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#888' }}>
                        {item.status || 'Published'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      {formatViews(item.views)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'white', mb: 0.5 }}>
                        {calculateEngagement(item.likes, item.views)}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#888' }}>
                        {item.likes?.toLocaleString() || '0'} likes
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ border: 'none', py: 2 }}>
                    <IconButton sx={{ color: '#888' }}>
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderTop: '1px solid #333'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Rows per page:
            </Typography>
            <Button
              variant="text"
              size="small"
              endIcon={<ArrowDownIcon />}
              sx={{ color: '#888', textTransform: 'none' }}
            >
              30
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#888' }}>
              {((pagination.currentPage - 1) * pagination.videosPerPage) + 1}-{Math.min(pagination.currentPage * pagination.videosPerPage, pagination.totalVideos)} of {pagination.totalVideos}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                sx={{
                  color: pagination.hasPrevPage ? '#888' : '#444',
                  '&:hover': { color: pagination.hasPrevPage ? 'white' : '#444' }
                }}
                disabled={!pagination.hasPrevPage || loading}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <PrevIcon />
              </IconButton>
              <IconButton
                sx={{
                  color: pagination.hasNextPage ? '#888' : '#444',
                  '&:hover': { color: pagination.hasNextPage ? 'white' : '#444' }
                }}
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              >
                <NextIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default Content;
