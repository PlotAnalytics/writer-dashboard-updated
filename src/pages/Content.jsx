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
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Search as SearchIcon,
  Description as DescriptionIcon,
  Chat as ChatIcon,
  Article as ArticleIcon
} from '@mui/icons-material';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import axios from 'axios';
import { contentApi } from '../utils/simpleApi.js';
import { buildApiUrl } from '../config/api.js';
import claudeIcon from '../assets/claude.png';
import googleDocIcon from '../assets/google_doc.png';

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

  // STL (Script To Link) specific state
  const [stlUrl, setStlUrl] = useState('');
  const [stlResult, setStlResult] = useState(null);
  const [stlLoading, setStlLoading] = useState(false);
  const [stlError, setStlError] = useState(null);

  // Core concept titles state
  const [coreConceptTitles, setCoreConceptTitles] = useState({});
  const [coreConceptFilter, setCoreConceptFilter] = useState('');
  const [availableCoreConceptTitles, setAvailableCoreConceptTitles] = useState([]);

  // Function to extract video ID from YouTube URL
  const extractVideoId = (url) => {
    if (!url) return null;

    // Handle different YouTube URL formats
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,  // youtu.be/VIDEO_ID
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,  // youtube.com/watch?v=VIDEO_ID
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,  // youtube.com/shorts/VIDEO_ID
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,  // youtube.com/embed/VIDEO_ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  // Function to search for script using video ID
  const searchScript = async () => {
    if (!stlUrl.trim()) {
      setStlError('Please enter a YouTube URL');
      return;
    }

    const videoId = extractVideoId(stlUrl.trim());
    console.log('🔍 STL Search - URL:', stlUrl.trim(), 'Extracted Video ID:', videoId);

    if (!videoId) {
      setStlError('Invalid YouTube URL. Please enter a valid YouTube URL.');
      return;
    }

    setStlLoading(true);
    setStlError(null);
    setStlResult(null);

    try {
      // Use the buildApiUrl helper to construct the proper API URL
      const apiUrl = buildApiUrl(`/api/search-script?videoId=${encodeURIComponent(videoId)}`);
      console.log('🌐 STL API Call:', apiUrl);

      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log('📡 STL API Response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search for script');
      }

      if (data.success && data.googleDocLink) {
        console.log('✅ STL Success - Found script:', data.googleDocLink);
        setStlResult({
          videoId: videoId,
          googleDocLink: data.googleDocLink,
          trelloCardId: data.trelloCardId,
          writerName: data.writerName
        });
      } else {
        console.log('❌ STL No Results - Data:', data);
        setStlError('No script found for this video. The video might not be in our database or might not have an associated script.');
      }
    } catch (error) {
      console.error('Error searching for script:', error);
      setStlError(error.message || 'An error occurred while searching for the script');
    } finally {
      setStlLoading(false);
    }
  };

  // Function to fetch core concept titles from Google Sheets
  const fetchCoreConceptTitles = async () => {
    try {
      console.log('📊 Fetching core concept titles...');
      const apiUrl = buildApiUrl('/api/analytics/core-concept-titles');
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.success) {
        setCoreConceptTitles(data.titleMapping);
        console.log(`✅ Loaded ${data.count} core concept titles`);
      } else {
        console.error('❌ Failed to fetch core concept titles:', data.message);
      }
    } catch (error) {
      console.error('❌ Error fetching core concept titles:', error);
    }
  };

  // Function to extract document ID from core concept URL
  const extractDocumentId = (url) => {
    if (!url) return null;
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Function to get core concept title from URL
  const getCoreConceptTitle = (coreConceptUrl) => {
    if (!coreConceptUrl) return null;
    const docId = extractDocumentId(coreConceptUrl);
    return docId ? coreConceptTitles[docId] : null;
  };

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

      // Use same data source for all tabs (including virals)
      let responseData;
      try {
        const { data } = await contentApi.getVideos({
          writer_id: videoTypeFilter === 'virals' ? null : writerId, // No writer filter for virals
          range: dateRange,
          page: currentPage,
          limit: videosPerPage,
          type: videoTypeFilter // Pass virals type directly to backend
        });
        responseData = data;
        console.log('✅ Got response from /api/writer/videos:', data);
      } catch (influxError) {
        console.log('⚠️ InfluxDB API failed, trying PostgreSQL fallback');
        const response = await axios.get(`/api/writer/analytics`, {
          params: {
            writer_id: videoTypeFilter === 'virals' ? null : writerId, // No writer filter for virals
            page: currentPage,
            limit: videosPerPage,
            type: videoTypeFilter // Pass virals type directly to backend
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
        videos = sortVideos(videos, sortBy, sortOrder, videoTypeFilter);

        // Virals filtering is now handled by the backend

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

        // Apply core concept filter if provided (only for virals tab)
        if (coreConceptFilter.trim() && videoTypeFilter === 'virals') {
          videos = videos.filter(video => {
            if (!video.core_concept_doc) return false;
            const title = getCoreConceptTitle(video.core_concept_doc);
            return title === coreConceptFilter;
          });
        }

        // Apply virals-specific filtering: only show videos with 500k+ views and core concept titles
        if (videoTypeFilter === 'virals') {
          videos = videos.filter(video => {
            // Must have views over 500,000
            const views = video.views || 0;
            if (views <= 500000) return false;

            // Must have a core concept title
            if (!video.core_concept_doc) return false;
            const title = getCoreConceptTitle(video.core_concept_doc);
            if (!title) return false;

            return true;
          });
          console.log('🔥 Virals filtered: showing', videos.length, 'videos with 500k+ views and core concepts');
        }

        setContentData(videos);
        console.log('📺 Writer videos loaded:', videos.length, 'videos for writer', writerId, 'Page:', currentPage, 'Type filter:', videoTypeFilter, 'Tab:', tabValue);

        // Extract available core concept titles for filtering
        const uniqueTitles = new Set();
        videos.forEach(video => {
          if (video.core_concept_doc) {
            const title = getCoreConceptTitle(video.core_concept_doc);
            if (title) {
              uniqueTitles.add(title);
            }
          }
        });
        // Sort core concept titles numerically by the number at the beginning
        const sortedTitles = Array.from(uniqueTitles).sort((a, b) => {
          const extractNumber = (title) => {
            if (!title) return 0;
            const match = title.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };

          const numA = extractNumber(a);
          const numB = extractNumber(b);

          // If both have numbers, sort by number
          if (numA && numB) {
            return numA - numB;
          }

          // If only one has a number, prioritize the one with number
          if (numA && !numB) return -1;
          if (!numA && numB) return 1;

          // If neither has numbers, sort alphabetically
          return a.localeCompare(b);
        });

        setAvailableCoreConceptTitles(sortedTitles);

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
  const sortVideos = (videos, sortField, order, currentVideoTypeFilter) => {
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
          // For virals tab, sort by core concept numbers if available
          if (currentVideoTypeFilter === 'virals') {
            const extractCoreConceptNumber = (video) => {
              if (!video.core_concept_doc) return 0;
              const title = getCoreConceptTitle(video.core_concept_doc);
              if (!title) return 0;
              const match = title.match(/^(\d+)/);
              const number = match ? parseInt(match[1], 10) : 0;
              console.log(`🔍 Core concept for video "${video.title}": title="${title}", number=${number}`);
              return number;
            };

            aVal = extractCoreConceptNumber(a);
            bVal = extractCoreConceptNumber(b);
            console.log(`📊 Comparing: ${aVal} vs ${bVal} (order: ${order})`);

            // If no core concept numbers found, fall back to video title sorting
            if (aVal === 0 && bVal === 0) {
              aVal = a.title?.toLowerCase() || '';
              bVal = b.title?.toLowerCase() || '';
            }
          } else {
            // For other tabs, extract numbers from video titles for numerical sorting
            const extractNumber = (title) => {
              if (!title) return 0;
              const match = title.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            };

            aVal = extractNumber(a.title);
            bVal = extractNumber(b.title);

            // If no numbers found, fall back to alphabetical sorting
            if (aVal === 0 && bVal === 0) {
              aVal = a.title?.toLowerCase() || '';
              bVal = b.title?.toLowerCase() || '';
            }
          }
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
  }, [sortBy, sortOrder, filterStatus, dateRange, currentPage, videoTypeFilter, searchQuery, coreConceptFilter]);

  // Fetch core concept titles on component mount
  useEffect(() => {
    fetchCoreConceptTitles();
  }, []);

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
              } else if (newValue === 2) {
                console.log('🔄 Setting filter to: stl');
                setVideoTypeFilter('stl'); // STL tab
                // Reset STL state when switching to STL tab
                setStlUrl('');
                setStlResult(null);
                setStlError(null);
              } else if (newValue === 3) {
                console.log('🔄 Setting filter to: virals');
                setVideoTypeFilter('virals'); // Virals tab
                setSortBy('title'); // Default sort by core concept numbers for virals
                setSortOrder('asc'); // Ascending order for numerical sorting
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
            <Tab label="Script to Link" />
            <Tab label="Virals" />

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

        {/* Modern Search Bar and Filters */}
        <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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

          {/* Core Concept Filter - Only show for virals tab */}
          {availableCoreConceptTitles.length > 0 && videoTypeFilter === 'virals' && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={coreConceptFilter}
                onChange={(e) => setCoreConceptFilter(e.target.value)}
                displayEmpty
                sx={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  transition: 'all 0.2s ease-in-out',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
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
                  '& .MuiSelect-icon': {
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#1a1a1a',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      '& .MuiMenuItem-root': {
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(102, 126, 234, 0.1)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(102, 126, 234, 0.2)',
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                    All Core Concepts
                  </Typography>
                </MenuItem>
                {availableCoreConceptTitles.map((title) => (
                  <MenuItem key={title} value={title}>
                    <Typography sx={{ color: 'white' }}>
                      {title}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          </Box>
        </Box>

        {/* Virals Content */}
        {videoTypeFilter === 'virals' ? (
          <>
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
                    Viral Video
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
                <TableCell sx={{ color: '#888', border: 'none', py: 1 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
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
                      WebkitTextFillColor: 'transparent'
                    }}>
                      Loading viral videos...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#ff6b6b', mb: 1 }}>
                      Error loading viral videos: {error}
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
                  <TableCell colSpan={5} sx={{ border: 'none', py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      No viral videos found (1M+ views)
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                currentContent.map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={videoTypeFilter === 'virals' ? undefined : (event) => handleVideoClick(item.id, event)}
                    sx={{
                      borderBottom: '1px solid #333',
                      cursor: videoTypeFilter === 'virals' ? 'default' : 'pointer',
                      '&:hover': { bgcolor: videoTypeFilter === 'virals' ? 'transparent' : '#2a2a2a' }
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, maxWidth: '100%' }}>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'white',
                                fontWeight: 500,
                                maxWidth: item.core_concept_doc && getCoreConceptTitle(item.core_concept_doc) && videoTypeFilter === 'virals' ? '350px' : '500px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.85rem'
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </Typography>
                            {item.core_concept_doc && getCoreConceptTitle(item.core_concept_doc) && videoTypeFilter === 'virals' && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#667eea',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  border: '1px solid rgba(102, 126, 234, 0.3)',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                                title={getCoreConceptTitle(item.core_concept_doc)}
                              >
                                {getCoreConceptTitle(item.core_concept_doc)}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: '#888' }}>
                            {item.writer_name || 'Writer'}
                          </Typography>
                        </Box>
                      </Box>
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {item.google_doc_link && (
                        <IconButton
                          size="small"
                          sx={{ color: '#888', '&:hover': { color: 'white' } }}
                          onClick={(event) => {
                            event.stopPropagation(); // Prevent row click
                            window.open(item.google_doc_link, '_blank');
                          }}
                          title="Open Google Doc"
                        >
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              backgroundColor: '#4285f4', // Google blue color
                              mask: `url(${googleDocIcon}) no-repeat center`,
                              maskSize: 'contain',
                              WebkitMask: `url(${googleDocIcon}) no-repeat center`,
                              WebkitMaskSize: 'contain',
                              '&:hover': {
                                backgroundColor: '#5a95f5',
                                transform: 'scale(1.1)'
                              }
                            }}
                          />
                        </IconButton>
                      )}
                      {item.ai_chat_url && (
                        <IconButton
                          size="small"
                          sx={{ color: '#888', '&:hover': { color: 'white' } }}
                          onClick={(event) => {
                            event.stopPropagation(); // Prevent row click
                            window.open(item.ai_chat_url, '_blank');
                          }}
                          title="Open AI Chat"
                        >
                          <Box
                            component="img"
                            src={claudeIcon}
                            sx={{
                              width: 16,
                              height: 16,
                              backgroundColor: 'transparent',
                              objectFit: 'contain',
                              filter: 'brightness(1.2) contrast(1.1)', // Make it fully bright and crisp
                              '&:hover': {
                                filter: 'brightness(1.4) contrast(1.2)',
                                transform: 'scale(1.1)'
                              }
                            }}
                          />
                        </IconButton>
                      )}
                      {item.core_concept_doc && videoTypeFilter === 'virals' && (
                        <IconButton
                          size="small"
                          sx={{ color: '#888', '&:hover': { color: 'white' } }}
                          onClick={(event) => {
                            event.stopPropagation(); // Prevent row click
                            window.open(item.core_concept_doc, '_blank');
                          }}
                          title="Open Core Concept Doc"
                        >
                          <ArticleIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
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
        </>
        ) : videoTypeFilter === 'stl' ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
              Script to Link
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', mb: 3 }}>
              Enter a YouTube URL to find the associated script document.
            </Typography>

            {/* URL Input */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Enter YouTube URL (e.g., https://youtu.be/a8-VQUH489I or https://youtube.com/shorts/Ozt2mn5nJ3Y)"
                value={stlUrl}
                onChange={(e) => setStlUrl(e.target.value)}
                size="small"
                slotProps={{
                  input: {
                    sx: {
                      color: 'white',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      '&:hover': {
                        border: '1px solid rgba(102, 126, 234, 0.5)',
                        background: 'rgba(255, 255, 255, 0.08)',
                      },
                      '&.Mui-focused': {
                        border: '1px solid rgba(102, 126, 234, 0.7)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.2)',
                      },
                      '& .MuiInputBase-input': {
                        color: 'white',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.5)',
                          opacity: 1,
                        },
                      },
                    },
                  },
                }}
              />
              <Button
                onClick={searchScript}
                disabled={stlLoading}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  px: 3,
                  py: 1,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                  minWidth: '100px',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  },
                  '&:disabled': {
                    background: 'rgba(102, 126, 234, 0.3)',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }
                }}
              >
                {stlLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Search'}
              </Button>
            </Box>

            {/* Error Display */}
            {stlError && (
              <Box sx={{
                p: 2,
                mb: 3,
                borderRadius: '8px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)'
              }}>
                <Typography sx={{ color: '#f44336', fontSize: '14px' }}>
                  {stlError}
                </Typography>
              </Box>
            )}

            {/* Results Display */}
            {stlResult && (
              <Box sx={{
                p: 3,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.3)'
              }}>
                <Typography variant="h6" sx={{ color: 'white', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  📄 Script Found
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#888', mb: 0.5 }}>
                      Video ID:
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'white' }}>
                      {stlResult.videoId}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ color: '#888', mb: 0.5 }}>
                      Writer:
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#667eea' }}>
                      {stlResult.writerName || 'Unknown Writer'}
                    </Typography>
                  </Box>

                  {stlResult.googleDocLink && (
                    <Box>
                      <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                        Google Doc:
                      </Typography>
                      <Button
                        href={stlResult.googleDocLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          px: 2,
                          py: 1,
                          borderRadius: '6px',
                          textTransform: 'none',
                          fontWeight: 500,
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                          }
                        }}
                      >
                        📄 Open Google Doc
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        ) : videoTypeFilter === 'stl' ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
              Script to Link
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', mb: 3 }}>
              Enter a YouTube URL to find the associated script document.
            </Typography>

            {/* URL Input */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Enter YouTube URL (e.g., https://youtu.be/a8-VQUH489I or https://youtube.com/shorts/Ozt2mn5nJ3Y)"
                value={stlUrl}
                onChange={(e) => setStlUrl(e.target.value)}
                size="small"
                slotProps={{
                  input: {
                    sx: {
                      color: 'white',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      '&:hover': {
                        border: '1px solid rgba(102, 126, 234, 0.5)',
                        background: 'rgba(255, 255, 255, 0.08)',
                      },
                      '&.Mui-focused': {
                        border: '1px solid rgba(102, 126, 234, 0.7)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.2)',
                      },
                      '& .MuiInputBase-input': {
                        color: 'white',
                        '&::placeholder': {
                          color: 'rgba(255, 255, 255, 0.5)',
                          opacity: 1,
                        },
                      },
                    },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={searchScript}
                disabled={stlLoading || !stlUrl.trim()}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  px: 3,
                  py: 1,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  minWidth: '120px',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {stlLoading ? 'Searching...' : 'Search'}
              </Button>
            </Box>

            {/* Error Message */}
            {stlError && (
              <Box sx={{
                p: 2,
                mb: 3,
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                borderRadius: '8px',
              }}>
                <Typography variant="body2" sx={{ color: '#f44336' }}>
                  {stlError}
                </Typography>
              </Box>
            )}

            {/* Result */}
            {stlResult && (
              <Box sx={{
                p: 3,
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '8px',
              }}>
                <Typography variant="h6" sx={{ color: '#4caf50', mb: 2 }}>
                  Script Found!
                </Typography>
                <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                  Video ID: <span style={{ color: 'white', fontFamily: 'monospace' }}>{stlResult.videoId}</span>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ color: '#888' }}>
                    Google Doc:
                  </Typography>
                  <Button
                    variant="outlined"
                    href={stlResult.googleDocLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: '#4caf50',
                      borderColor: '#4caf50',
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderColor: '#66bb6a',
                      },
                    }}
                  >
                    Open Script Document
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        ) : videoTypeFilter !== 'virals' ? (
          <>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, maxWidth: '100%' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'white',
                              fontWeight: 500,
                              maxWidth: item.core_concept_doc && getCoreConceptTitle(item.core_concept_doc) && videoTypeFilter === 'virals' ? '350px' : '500px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '0.85rem'
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </Typography>
                          {item.core_concept_doc && getCoreConceptTitle(item.core_concept_doc) && videoTypeFilter === 'virals' && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#667eea',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                border: '1px solid rgba(102, 126, 234, 0.3)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              title={getCoreConceptTitle(item.core_concept_doc)}
                            >
                              {getCoreConceptTitle(item.core_concept_doc)}
                            </Typography>
                          )}
                        </Box>
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
        </>
        ) : null}
      </Box>
    </Layout>
  );
};

export default Content;
