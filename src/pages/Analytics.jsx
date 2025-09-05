import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  FormControl,
  Select,
  MenuItem,
  Button,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Whatshot as WhatshotIcon,
  FlashOn as FlashOnIcon,
  ThumbUp as ThumbUpIcon,
  SentimentDissatisfied as SentimentDissatisfiedIcon
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import Layout from '../components/Layout.jsx';
import { buildApiUrl, API_CONFIG } from '../config/api.js';
import RealtimeWidget from '../components/RealtimeWidget';
import WriterLeaderboard from '../components/WriterLeaderboard.jsx';
import VideoDetailsModal from '../components/VideoDetailsModal.jsx';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { analyticsApi } from '../utils/simpleApi.js';
import { Scroll } from 'lucide-react';

// Badge assets
import level1Badge from '../assets/level_1.png';
import level2Badge from '../assets/level_2.png';
import level3Badge from '../assets/level_3.png';
import level4Badge from '../assets/level_4.png';
import level5Badge from '../assets/level_5.png';
import level6Badge from '../assets/level_6.png';

// Shimmer animation for progress bar
const shimmer = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

// Pulse animation for badge spotlight
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
`;

// Utility functions like WriterAnalytics.jsx
const formatNumber = (value) => {
  if (typeof value !== "number") return "N/A";
  return Math.round(value).toLocaleString(); // Round to the nearest integer and format with commas
};

// Function to get badge image based on level
const getBadgeImage = (level) => {
  const badges = {
    1: level1Badge,
    2: level2Badge,
    3: level3Badge,
    4: level4Badge,
    5: level5Badge,
    6: level6Badge
  };
  return badges[level] || level1Badge;
};




// Utility function to format dates for display
const formatDate = (date) => {
  const parsedDate = dayjs(date);
  return parsedDate.isValid()
    ? parsedDate.format("MMM D, YYYY")
    : "Invalid Date";
};

// Calendar Grid Component
const CalendarGrid = ({ startDate, endDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState(startDate);
  const [selectedEnd, setSelectedEnd] = useState(endDate);
  const [isSelecting, setIsSelecting] = useState(false);

  const today = new Date();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDateClick = (day) => {
    // Create date in local timezone to avoid UTC conversion issues
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Format date manually to avoid timezone issues
    const year = clickedDate.getFullYear();
    const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;

    console.log('📅 Calendar: Clicked day', day, 'formatted as', dateString);

    if (!isSelecting || !selectedStart) {
      // First click - set start date
      console.log('📅 Calendar: First click, setting start date to', dateString);
      setSelectedStart(dateString);
      setSelectedEnd(dateString);
      setIsSelecting(true);
    } else {
      // Second click - set end date
      const startDateObj = new Date(selectedStart);
      if (clickedDate < startDateObj) {
        // If clicked date is before start, swap them
        console.log('📅 Calendar: Second click before start, swapping dates');
        setSelectedStart(dateString);
        setSelectedEnd(selectedStart);
        onDateSelect(dateString, selectedStart);
      } else {
        console.log('📅 Calendar: Second click after start, setting end date');
        setSelectedEnd(dateString);
        onDateSelect(selectedStart, dateString);
      }
      setIsSelecting(false);
    }
  };

  const isDateInRange = (day) => {
    if (!selectedStart || !selectedEnd) return false;
    // Create date string manually to avoid timezone issues
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;

    return dateString >= selectedStart && dateString <= selectedEnd;
  };

  const isDateSelected = (day) => {
    // Create date string manually to avoid timezone issues
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;

    return dateString === selectedStart || dateString === selectedEnd;
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  return (
    <Box>
      {/* Month Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <IconButton
          onClick={() => navigateMonth(-1)}
          sx={{
            color: 'white',
            width: '32px',
            height: '32px',
            '&:hover': {
              background: 'rgba(102, 126, 234, 0.1)',
              transform: 'scale(1.1)'
            }
          }}
        >
          ◀
        </IconButton>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, fontSize: '16px' }}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Typography>
        <IconButton
          onClick={() => navigateMonth(1)}
          sx={{
            color: 'white',
            width: '32px',
            height: '32px',
            '&:hover': {
              background: 'rgba(102, 126, 234, 0.1)',
              transform: 'scale(1.1)'
            }
          }}
        >
          ▶
        </IconButton>
      </Box>

      {/* Day Headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {dayNames.map(day => (
          <Box key={day} sx={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            fontWeight: 600,
            padding: '8px 0'
          }}>
            {day}
          </Box>
        ))}
      </Box>

      {/* Calendar Days */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startingDayOfWeek }, (_, i) => (
          <Box key={`empty-${i}`} sx={{ height: '36px' }} />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isToday = today.getDate() === day &&
                         today.getMonth() === currentMonth.getMonth() &&
                         today.getFullYear() === currentMonth.getFullYear();
          const inRange = isDateInRange(day);
          const selected = isDateSelected(day);

          return (
            <Box
              key={day}
              onClick={() => handleDateClick(day)}
              sx={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: selected ? 600 : 400,
                color: selected ? 'white' : inRange ? 'white' : 'rgba(255, 255, 255, 0.8)',
                background: selected
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : inRange
                    ? 'rgba(102, 126, 234, 0.2)'
                    : isToday
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'transparent',
                border: isToday && !selected ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: selected
                    ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                    : 'rgba(102, 126, 234, 0.3)',
                  transform: 'scale(1.05)'
                }
              }}
            >
              {day}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const Analytics = () => {
  console.log('🎯 Analytics component is rendering!');

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { checkMilestones } = useNotifications();

  // Add CSS animations for gamification
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('last30days');
  const [tabValue, setTabValue] = useState(0);
  const [contentFilter, setContentFilter] = useState('all'); // 'all', 'content', 'shorts'
  const [customStartDate, setCustomStartDate] = useState(() => {
    // Default to 30 days ago
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [loadTime, setLoadTime] = useState(null);

  // Modal state for video details
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState(null);
  const [modalVideos, setModalVideos] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Quest progress state
  const [questProgress, setQuestProgress] = useState(0); // Track quest progress (0-2)

  // Function to increment quest progress
  const incrementQuestProgress = () => {
    if (questProgress < 2) {
      setQuestProgress(prev => prev + 1);
    }
  };

  // Function to reset quest progress (for testing or daily reset)
  const resetQuestProgress = () => {
    setQuestProgress(0);
  };

  const dateRangeOptions = [
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'last30days', label: 'Last 30 days' },
    { value: 'last90days', label: 'Last 90 days' },
    { value: 'last365days', label: 'Last 365 days' },
    { value: 'lifetime', label: 'Lifetime' },
    { value: '2025', label: '2025' },
    { value: '2024', label: '2024' },
    { value: 'may', label: 'May' },
    { value: 'april', label: 'April' },
    { value: 'march', label: 'March' },
    { value: 'custom', label: 'Custom' }
  ];

  const fetchAnalytics = async () => {
    const startTime = performance.now();
    console.log('🔥 fetchAnalytics function called with dateRange:', dateRange);

    setIsChartLoading(true);
    setError(null);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('⏰ Analytics fetch timeout after 30 seconds');
      setIsChartLoading(false);
      setError('Request timed out. Please try again.');
    }, 30000);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
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
            setError('Unable to load analytics. Please log out and log back in.');
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

      if (!token) {
        setError('Please log in to view analytics');
        setLoading(false);
        return;
      }

      console.log('📊 Fetching analytics data using BigQuery overview endpoint...');
      console.log('📊 Date range for BigQuery:', { dateRange, writerId });

      // Initialize data - will be populated from BigQuery overview endpoint
      let viewsData = [];
      let totalViews = 0;
      let chartData = [];

      console.log('📊 Will use BigQuery data from overview endpoint');

      // Use cached API for better performance
      let params = { range: dateRange };

      // If it's a custom date range, extract and add start_date and end_date parameters
      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          params.start_date = startDate;
          params.end_date = endDate;
          console.log(`📅 Adding custom date parameters: start_date=${startDate}, end_date=${endDate}`);
        }
      }

      console.log('📊 Fetching analytics via API');

      const overviewResult = await analyticsApi.getOverview({
        params: params
      });

      const overviewData = overviewResult.data;

      console.log('📊 BigQuery Overview data received:', {
        totalViews: overviewData.totalViews,
        totalSubmissions: overviewData.totalSubmissions,
        chartDataPoints: overviewData.chartData?.length || 0,
        aggregatedViewsDataPoints: overviewData.aggregatedViewsData?.length || 0
      });

        // Debug: Check for June 6th in the received data
        if (overviewData.aggregatedViewsData) {
          const june6th = overviewData.aggregatedViewsData.find(item => item.time === '2025-06-06');
          if (june6th) {
            console.log('🎯 June 6th found in API response:', june6th.views.toLocaleString(), 'views');
          } else {
            console.log('⚠️ June 6th NOT found in API response');
            console.log('📊 Available dates:', overviewData.aggregatedViewsData.slice(0, 5).map(item => item.time));
          }
        }

        // Use BigQuery DAILY TOTALS data (filtered in BigQuery query - last 2 days excluded)
        if (overviewData.aggregatedViewsData && overviewData.aggregatedViewsData.length > 0) {
          // Show what dates are in the BigQuery response (already filtered)
          const allDatesInResponse = overviewData.aggregatedViewsData.map(item => item.time).sort();
          console.log('📊 BigQuery response dates (already filtered):', allDatesInResponse);
          console.log('📊 Latest date in BigQuery:', allDatesInResponse[allDatesInResponse.length - 1]);
          console.log('📊 Total data points from BigQuery:', allDatesInResponse.length);
          // Use the daily totals data - already filtered in BigQuery (last 2 days excluded)
          viewsData = overviewData.aggregatedViewsData;

          // Transform daily totals for chart display - each point is daily total views
          chartData = overviewData.aggregatedViewsData.map(item => ({
            date: item.time,
            views: item.views,
            formattedDate: dayjs(item.time).format('MMM D, YYYY'),
            unique_videos: item.unique_videos || 0,
            source: item.source || 'BigQuery_Daily_Totals_Filtered_In_Query'
          }));

          totalViews = overviewData.totalViews || viewsData.reduce((acc, item) => acc + item.views, 0);

          console.log('✅ Using BigQuery DAILY TOTALS (YouTube Analytics Confirmed):', {
            dailyTotalsPoints: viewsData.length,
            chartDataPoints: chartData.length,
            totalViews: totalViews.toLocaleString(),
            sampleDailyTotal: viewsData[0],
            sampleChartData: chartData[0],
            dataTypes: [...new Set(viewsData.map(item => item.source))]
          });

          // Debug: Show sample of daily totals structure
          console.log('📊 DAILY TOTALS Sample (first 3 points):', chartData.slice(0, 3).map(item => ({
            date: item.date,
            views: item.views,
            unique_videos: item.unique_videos,
            source: item.source
          })));
        } else {
          console.log('⚠️ No daily totals data in overview response');
        }

      // Fetch top content and latest content using writer-specific endpoints
      console.log('📊 Fetching top content and latest content using writer-specific endpoints');
      const topVideosData = await fetchTopContent();
      console.log('📊 fetchTopContent returned:', topVideosData);
      const latestContentData = await fetchLatestContent();
      console.log('📊 fetchLatestContent returned:', latestContentData);

      // Fetch ALL videos for proper median calculation
      console.log('📊 Fetching ALL videos for median calculation');
      const allVideosData = await fetchAllVideosForMedian(dateRange);
      console.log('📊 fetchAllVideosForMedian returned:', allVideosData?.length || 0, 'videos');

      console.log('📊 Top content received:', topVideosData?.length || 0, 'videos');
      console.log('📊 Latest content received:', latestContentData?.title || 'None');

      // Combine all data - Use BigQuery data for views and chart
      const combinedData = {
        ...overviewData,
        // Use BigQuery data for views and chart
        totalViews: totalViews,
        chartData: chartData,
        aggregatedViewsData: viewsData, // This is what the chart component expects
        topVideos: topVideosData || [], // Ensure it's always an array
        latestContent: latestContentData,
        // Calculate additional metrics from BigQuery data
        avgDailyViews: chartData.length > 0 ? Math.round(totalViews / chartData.length) : 0,
        // Calculate average views per video: Total Views / Total Submissions
        avgVideoViews: overviewData.totalSubmissions > 0 ?
          Math.round(totalViews / overviewData.totalSubmissions) : 0,
        // Calculate median views from ALL videos in the time range
        medianVideoViews: allVideosData && allVideosData.length > 0 ?
          (() => {
            const sortedViews = allVideosData.map(video => video.views_total || video.views || 0).sort((a, b) => a - b);
            const mid = Math.floor(sortedViews.length / 2);
            return sortedViews.length % 2 === 0
              ? Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2)
              : sortedViews[mid];
          })() : 0,
        summary: {
          progressToTarget: (totalViews / 100000000) * 100, // Progress to 100M views
          highestDay: chartData.length > 0 ? Math.max(...chartData.map(d => d.views)) : 0,
          lowestDay: chartData.length > 0 ? Math.min(...chartData.map(d => d.views)) : 0
        },
        metadata: {
          source: 'NEW BigQuery Table (youtube_video_report_historical) + PostgreSQL',
          dataSource: 'BigQuery: youtube_video_report_historical (daily views) + InfluxDB fallback',
          lastUpdated: new Date().toISOString(),
          dateRange: dateRange,
          bigQueryIntegrated: true,
          postgresqlIntegrated: true,
          newTableImplemented: true,
          tableUsed: 'youtube_video_report_historical'
        }
      };

      // For STL writers with split data, override totalViews to show only shorts views
      if (combinedData.hasSplitData && combinedData.shortsData && isSTLWriter()) {
        const shortsOnlyViews = combinedData.shortsData.reduce((acc, item) => acc + (item.views || 0), 0);
        console.log(`📊 STL Writer detected with split data - overriding totalViews from ${combinedData.totalViews.toLocaleString()} to shorts only: ${shortsOnlyViews.toLocaleString()}`);

        combinedData.totalViews = shortsOnlyViews;
        combinedData.avgDailyViews = combinedData.shortsData.length > 0 ? Math.round(shortsOnlyViews / combinedData.shortsData.length) : 0;
        combinedData.avgVideoViews = overviewData.totalSubmissions > 0 ? Math.round(shortsOnlyViews / overviewData.totalSubmissions) : 0;
        combinedData.summary.progressToTarget = (shortsOnlyViews / 100000000) * 100;
      }

      console.log('📊 Final analytics data:', {
        totalViews: combinedData.totalViews,
        chartDataPoints: combinedData.chartData?.length || 0,
        aggregatedViewsDataPoints: combinedData.aggregatedViewsData?.length || 0,
        topVideosCount: combinedData.topVideos?.length || 0,
        hasLatestContent: !!combinedData.latestContent,
        progressToTarget: combinedData.summary?.progressToTarget,
        dataSource: 'BigQuery + PostgreSQL',
        sampleAggregatedData: combinedData.aggregatedViewsData?.[0],
        dateRange: dateRange,
        isCustomRange: dateRange.startsWith('custom_'),
        isSingleDate: dateRange.startsWith('custom_') && dateRange.split('_')[1] === dateRange.split('_')[2]
      });

      // Special logging for single date ranges
      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3 && parts[1] === parts[2]) {
          console.log('📅 SINGLE DATE DETECTED:', parts[1]);
          console.log('📊 Single date chart data:', combinedData.aggregatedViewsData);
          console.log('📊 Chart will show:', combinedData.aggregatedViewsData?.length || 0, 'data points');
        }
      }

      setAnalyticsData(combinedData);

      // Log successful data update for debugging
      console.log('🎉 FRONTEND: Analytics data updated successfully!');
      console.log('📊 FRONTEND: Chart should now display new BigQuery data');
      if (combinedData.aggregatedViewsData) {
        const june6th = combinedData.aggregatedViewsData.find(item => item.time === '2025-06-06');
        if (june6th) {
          console.log(`🎯 FRONTEND: June 6th will show ${june6th.views.toLocaleString()} views in chart`);
        }
      }
    } catch (err) {
      console.error('❌ Analytics API error:', err);
      setError(`Failed to load analytics data: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setIsChartLoading(false);
      const endTime = performance.now();
      const loadTimeMs = endTime - startTime;
      setLoadTime(loadTimeMs);
      console.log(`⚡ Analytics fetch completed in ${loadTimeMs.toFixed(2)}ms`);
    }
  };

  // Handle opening video details modal - now uses data already loaded
  const handleOpenVideoModal = (category) => {
    setModalCategory(category);
    setModalOpen(true);
    setModalLoading(false); // No loading needed since data is already available

    // Get videos for this category from already loaded data
    const categoryVideos = analyticsData?.categoryVideos || {};
    const videos = categoryVideos[category] || [];

    console.log(`🎬 Opening modal for ${category} with ${videos.length} videos from loaded data`);
    setModalVideos(videos);
  };

  const handleCloseVideoModal = () => {
    setModalOpen(false);
    setModalCategory(null);
    setModalVideos([]);
  };

  // Fetch analytics with specific date range (for calendar selections)
  const fetchAnalyticsWithDateRange = async (customRange, startDate, endDate) => {
    console.log('🔥 fetchAnalyticsWithDateRange called with:', { customRange, startDate, endDate });
    setIsChartLoading(true);
    setError(null);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('⏰ Analytics fetch timeout after 30 seconds');
      setIsChartLoading(false);
      setError('Request timed out. Please try again.');
    }, 30000);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
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
            setError('Unable to load analytics. Please log out and log back in.');
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

      if (!token) {
        setError('Please log in to view analytics');
        setLoading(false);
        return;
      }

      console.log('📊 Fetching analytics data for specific date range:', { startDate, endDate });

      // Initialize data - will be populated from BigQuery overview endpoint
      let viewsData = [];
      let totalViews = 0;
      let chartData = [];

      // Use clean API call with explicit custom date parameters
      const params = {
        range: 'custom',
        start_date: startDate,
        end_date: endDate
      };

      console.log('📊 Fetching analytics via API with custom dates:', params);

      const overviewResult = await analyticsApi.getOverview({
        params: params
      });

      const overviewData = overviewResult.data;

      // overviewData is from the API response

      console.log('📊 BigQuery Overview data received for custom range:', {
        totalViews: overviewData.totalViews,
        totalSubmissions: overviewData.totalSubmissions,
        chartDataPoints: overviewData.chartData?.length || 0,
        aggregatedViewsDataPoints: overviewData.aggregatedViewsData?.length || 0,
        dateRange: `${startDate} to ${endDate}`
      });

      // Use BigQuery DAILY TOTALS data for the specific date range (already filtered in query)
      if (overviewData.aggregatedViewsData && overviewData.aggregatedViewsData.length > 0) {
        // Use the daily totals data - already filtered in BigQuery (last 2 days excluded)
        viewsData = overviewData.aggregatedViewsData;

        // Transform daily totals for chart display
        chartData = overviewData.aggregatedViewsData.map(item => ({
          date: item.time,
          views: item.views,
          formattedDate: dayjs(item.time).format('MMM D, YYYY'),
          unique_videos: item.unique_videos || 0,
          source: item.source || 'BigQuery_Custom_Range_Filtered_In_Query'
        }));

        totalViews = overviewData.totalViews || viewsData.reduce((acc, item) => acc + item.views, 0);

        console.log('✅ Using BigQuery data for custom range (YouTube Analytics Confirmed):', {
          dailyTotalsPoints: viewsData.length,
          chartDataPoints: chartData.length,
          totalViews: totalViews.toLocaleString(),
          dateRange: `${startDate} to ${endDate}`,
          sampleData: chartData[0]
        });

        // Special logging for single date
        if (startDate === endDate) {
          console.log('📅 SINGLE DATE ANALYSIS:', {
            date: startDate,
            views: totalViews.toLocaleString(),
            chartPoints: chartData.length
          });
        }
      } else {
        console.log('⚠️ No daily totals data in overview response for custom range');
      }

      // Fetch top content for this specific date range
      console.log('📊 Fetching top content for custom date range');
      const topVideosData = await fetchTopContentWithCustomRange(contentFilter, customRange, startDate, endDate);
      const latestContentData = await fetchLatestContent();

      // Fetch ALL videos for proper median calculation
      console.log('📊 Fetching ALL videos for median calculation (custom range)');
      const allVideosData = await fetchAllVideosForMedian(customRange);
      console.log('📊 fetchAllVideosForMedian (custom) returned:', allVideosData?.length || 0, 'videos');

      // Combine all data
      const combinedData = {
        ...overviewData,
        totalViews: totalViews,
        chartData: chartData,
        aggregatedViewsData: viewsData,
        topVideos: topVideosData || [],
        latestContent: latestContentData,
        avgDailyViews: chartData.length > 0 ? Math.round(totalViews / chartData.length) : 0,
        // Calculate average views per video: Total Views / Total Submissions
        avgVideoViews: overviewData.totalSubmissions > 0 ?
          Math.round(totalViews / overviewData.totalSubmissions) : 0,
        // Calculate median views from ALL videos in the time range
        medianVideoViews: allVideosData && allVideosData.length > 0 ?
          (() => {
            const sortedViews = allVideosData.map(video => video.views_total || video.views || 0).sort((a, b) => a - b);
            const mid = Math.floor(sortedViews.length / 2);
            return sortedViews.length % 2 === 0
              ? Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2)
              : sortedViews[mid];
          })() : 0,
        summary: {
          progressToTarget: (totalViews / 100000000) * 100,
          highestDay: chartData.length > 0 ? Math.max(...chartData.map(d => d.views)) : 0,
          lowestDay: chartData.length > 0 ? Math.min(...chartData.map(d => d.views)) : 0
        },
        metadata: {
          source: 'BigQuery Custom Date Range',
          dataSource: 'BigQuery: youtube_video_report_historical (custom range)',
          lastUpdated: new Date().toISOString(),
          dateRange: customRange,
          startDate: startDate,
          endDate: endDate,
          bigQueryIntegrated: true
        }
      };

      // For STL writers with split data, override totalViews to show only shorts views
      if (combinedData.hasSplitData && combinedData.shortsData && isSTLWriter()) {
        const shortsOnlyViews = combinedData.shortsData.reduce((acc, item) => acc + (item.views || 0), 0);
        console.log(`📊 STL Writer detected with split data - overriding totalViews from ${combinedData.totalViews.toLocaleString()} to shorts only: ${shortsOnlyViews.toLocaleString()}`);

        combinedData.totalViews = shortsOnlyViews;
        combinedData.avgDailyViews = combinedData.shortsData.length > 0 ? Math.round(shortsOnlyViews / combinedData.shortsData.length) : 0;
        combinedData.avgVideoViews = overviewData.totalSubmissions > 0 ? Math.round(shortsOnlyViews / overviewData.totalSubmissions) : 0;
        combinedData.summary.progressToTarget = (shortsOnlyViews / 100000000) * 100;
      }

      console.log('📊 Final analytics data for custom range:', {
        totalViews: combinedData.totalViews,
        chartDataPoints: combinedData.chartData?.length || 0,
        dateRange: `${startDate} to ${endDate}`,
        isSingleDate: startDate === endDate
      });

      setAnalyticsData(combinedData);

      console.log('🎉 FRONTEND: Analytics data updated for custom date range!');
      console.log('📊 FRONTEND: Chart should now display data for:', startDate === endDate ? startDate : `${startDate} to ${endDate}`);

    } catch (err) {
      console.error('❌ Analytics API error for custom range:', err);
      setError(`Failed to load analytics data: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setIsChartLoading(false);
    }
  };

  // Writer-specific top content function with BigQuery enhancement
  const fetchTopContent = async (filterType = contentFilter) => {
    try {
      const token = localStorage.getItem('token');
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
            return;
          }
        } catch (profileError) {
          console.error('❌ SECURITY ERROR: Could not fetch writerId:', profileError);
          return;
        }
      }

      console.log('🏆 Fetching top content for writer with BigQuery enhancement');
      console.log('🔍 Debug info:', {
        writerId: writerId,
        filterType: filterType,
        dateRange: dateRange,
        hasToken: !!token
      });

      // Convert dateRange to range parameter and handle custom dates
      let range = '30';
      let startDate = null;
      let endDate = null;

      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          startDate = parts[1];
          endDate = parts[2];
          range = 'custom';
        }
      } else {
        switch (dateRange) {
          case 'last7days':
            range = '7';
            break;
          case 'last30days':
            range = '30';
            break;
          case 'last90days':
            range = '90';
            break;
          case 'last365days':
            range = '365';
            break;
          case 'lifetime':
            range = 'lifetime';
            break;
          default:
            range = '28';
        }
      }

      // Fix filter type mapping to match backend expectations
      let apiFilterType = filterType;
      if (filterType === 'videos') {
        apiFilterType = 'content'; // Backend expects 'content' for videos
      }

      // Build URL with proper parameters - like Content page with 20 videos
      let url = `${buildApiUrl('/api/analytics/writer/top-content')}?writer_id=${writerId}&range=${range}&limit=20&type=${apiFilterType}`;

      // Add custom date parameters if needed
      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }

      console.log('🔗 Top content URL (using writer-specific endpoint):', url);
      console.log('🔍 Debug - writerId:', writerId, 'range:', range, 'filterType:', filterType, 'apiFilterType:', apiFilterType, 'dates:', { startDate, endDate });

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Top content response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('📊 Top content API response:', result);

        let topContent = result.data || result || [];
        console.log('🏆 Top content found:', topContent.length, 'videos');

        if (topContent.length > 0) {
          console.log('📊 Sample top content:', topContent[0]);

          // Process the content to ensure proper video type detection and account names
          const processedContent = topContent.map(video => ({
            ...video,
            // Use channel_title as primary account name source
            account_name: video.channel_title || video.account_name || video.channelTitle || 'Unknown Account',
            // Trust backend type determination (backend already handles BigQuery duration properly)
            type: video.type || 'video', // Use backend type, fallback to video
            // Use backend-formatted duration if available, otherwise format from seconds
            duration: video.duration || (video.video_duration_seconds && video.video_duration_seconds > 0
              ? `${Math.floor(video.video_duration_seconds / 60)}:${Math.round(video.video_duration_seconds % 60).toString().padStart(2, '0')}`
              : '0:00')
          }));

          console.log('📊 Processed top content with proper types:', processedContent.map(v => ({
            title: v.title,
            views: v.views,
            account_name: v.account_name,
            type: v.type,
            duration_seconds: v.video_duration_seconds,
            duration: v.duration,
            writer_name: v.writer_name,
            backend_type: v.type, // Original backend type
            frontend_override: v.video_duration_seconds && v.video_duration_seconds > 0
              ? (v.video_duration_seconds < 183 ? 'short' : 'video')
              : 'no_override'
          })));

          return processedContent;
        }

        return [];
      } else {
        const errorText = await response.text();
        console.error('❌ Top content API error:', response.status, errorText);
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching top content:', error);
      return [];
    }
  };

  // Fetch ALL videos for median calculation
  const fetchAllVideosForMedian = async (dateRange) => {
    try {
      const token = localStorage.getItem('token');
      let writerId = user?.writerId || localStorage.getItem('writerId');

      if (!writerId) {
        console.error('❌ No writer ID available for fetching all videos');
        return [];
      }

      // Convert dateRange to range parameter
      let range = '30';
      let startDate = null;
      let endDate = null;

      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          startDate = parts[1];
          endDate = parts[2];
          range = 'custom';
        }
      } else {
        switch (dateRange) {
          case 'last7days':
            range = '7';
            break;
          case 'last30days':
            range = '30';
            break;
          case 'last90days':
            range = '90';
            break;
          case 'last365days':
            range = '365';
            break;
          case 'lifetime':
            range = 'lifetime';
            break;
          default:
            range = '28';
        }
      }

      // Build URL to get ALL videos (high limit)
      let url = `${buildApiUrl('/api/writer/videos')}?writer_id=${writerId}&range=${range}&limit=1000&type=all`;
      if (range === 'custom' && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }

      console.log('📊 Fetching ALL videos for median calculation:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const allVideos = result.videos || result.data || [];
        console.log('📊 Fetched ALL videos for median:', allVideos.length);
        return allVideos;
      } else {
        console.error('❌ Error fetching all videos for median:', response.status);
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching all videos for median:', error);
      return [];
    }
  };

  // Fetch top content with explicit custom range parameters
  const fetchTopContentWithCustomRange = async (filterType = contentFilter, customRange, startDate, endDate) => {
    try {
      const token = localStorage.getItem('token');
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
            return;
          }
        } catch (profileError) {
          console.error('❌ SECURITY ERROR: Could not fetch writerId:', profileError);
          return;
        }
      }

      console.log('🏆 Fetching top content with explicit custom range:', { customRange, startDate, endDate, filterType });

      // Fix filter type mapping to match backend expectations
      let apiFilterType = filterType;
      if (filterType === 'videos') {
        apiFilterType = 'content'; // Backend expects 'content' for videos
      }

      // Build URL with explicit custom date parameters
      let url = `${buildApiUrl('/api/analytics/writer/top-content')}?writer_id=${writerId}&range=custom&limit=20&type=${apiFilterType}`;
      url += `&start_date=${startDate}&end_date=${endDate}`;

      console.log('🔗 Top content URL with explicit custom range:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Top content response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('📊 Top content API response for custom range:', result);

        let topContent = result.data || result || [];
        console.log('🏆 Top content found for custom range:', topContent.length, 'videos');

        if (topContent.length > 0) {
          // Process the content to ensure proper video type detection and account names
          const processedContent = topContent.map(video => ({
            ...video,
            // Use channel_title as primary account name source
            account_name: video.channel_title || video.account_name || video.channelTitle || 'Unknown Account',
            // Trust backend type determination (backend already handles BigQuery duration properly)
            type: video.type || 'video', // Use backend type, fallback to video
            // Use backend-formatted duration if available, otherwise format from seconds
            duration: video.duration || (video.video_duration_seconds && video.video_duration_seconds > 0
              ? `${Math.floor(video.video_duration_seconds / 60)}:${Math.round(video.video_duration_seconds % 60).toString().padStart(2, '0')}`
              : '0:00')
          }));

          console.log('📊 Processed top content for custom range:', processedContent.map(v => ({
            title: v.title,
            views: v.views,
            account_name: v.account_name,
            type: v.type,
            duration: v.duration
          })));

          return processedContent;
        }

        return [];
      } else {
        const errorText = await response.text();
        console.error('❌ Top content API error for custom range:', response.status, errorText);
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching top content for custom range:', error);
      return [];
    }
  };

  const fetchLatestContent = async () => {
    try {
      const token = localStorage.getItem('token');
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
            return;
          }
        } catch (profileError) {
          console.error('❌ SECURITY ERROR: Could not fetch writerId:', profileError);
          return;
        }
      }

      console.log('📅 Fetching latest content for writer with BigQuery enhancement');

      // Use writer-specific latest content endpoint
      const url = `${buildApiUrl('/api/analytics/writer/latest-content')}?writer_id=${writerId}`;
      console.log('🔗 Latest content URL (using writer-specific endpoint):', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Latest content response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('📊 Latest content API response:', result);

        const latestContent = result.data || null;
        console.log('📅 Latest content found:', latestContent?.title || 'None');

        if (latestContent) {
          // Process latest content to use channel_title as primary account name
          const processedLatestContent = {
            ...latestContent,
            account_name: latestContent.channel_title || latestContent.account_name || latestContent.channelTitle || 'Unknown Account',
            // Trust backend type determination (backend already handles duration properly)
            type: latestContent.type || 'video'
          };

          console.log('📊 Processed latest content data:', {
            title: processedLatestContent.title,
            account_name: processedLatestContent.account_name,
            writer_name: processedLatestContent.writer_name,
            views: processedLatestContent.views,
            type: processedLatestContent.type
          });

          return processedLatestContent;
        }

        return latestContent;
      } else {
        const errorText = await response.text();
        console.error('❌ Latest content API error:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching latest content:', error);
      return null;
    }
  };





  useEffect(() => {
    console.log('🚀 Analytics useEffect triggered, dateRange:', dateRange);

    // Clear any potential localStorage cache for analytics
    const cacheKeys = Object.keys(localStorage).filter(key =>
      key.includes('analytics') || key.includes('cache') || key.includes('views')
    );
    cacheKeys.forEach(key => {
      console.log('🗑️ Clearing localStorage cache key:', key);
      localStorage.removeItem(key);
    });

    // Don't auto-fetch for "custom" (when picker is open) or custom ranges (when applied)
    if (dateRange !== "custom" && !dateRange.startsWith("custom_")) {
      fetchAnalytics();
    }
  }, [dateRange]);

  const formatNumber = (num) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  // Check if current user is an STL writer with different thresholds
  const isSTLWriter = () => {
    const stlWriters = ["Grace's STL", "LucisSTL", "Maebh STL", "Hannah STL", "Monica STL", "MyloSTL"];
    return stlWriters.includes(user?.name);
  };

  // Get category descriptions based on writer type
  const getCategoryDescriptions = () => {
    if (isSTLWriter()) {
      return {
        megaVirals: "1.5M+ Views",
        virals: "500K-1.5M Views",
        almostVirals: "250K-500K Views",
        decentVideos: "50K-250K Views",
        flops: "<50K Views"
      };
    } else {
      return {
        megaVirals: "3M+ Views",
        virals: "1M-3M Views",
        almostVirals: "500K-1M Views",
        decentVideos: "100K-500K Views",
        flops: "<100K Views"
      };
    }
  };

  const getDateRangeLabel = () => {
    // Handle custom date ranges
    if (dateRange.startsWith('custom_')) {
      const parts = dateRange.split('_');
      if (parts.length === 3) {
        const startDate = parts[1];
        const endDate = parts[2];
        // Format dates nicely
        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        };
        return `custom period (${formatDate(startDate)} - ${formatDate(endDate)})`;
      }
    }

    const option = dateRangeOptions.find(opt => opt.value === dateRange);
    return option ? option.label.toLowerCase() : dateRange;
  };

  const handleContentFilterChange = async (newFilter) => {
    setContentFilter(newFilter);
    console.log('📊 Content filter changed to:', newFilter);

    // Fetch new top content with the filter
    if (analyticsData) {
      const newTopContent = await fetchTopContent(newFilter);
      setAnalyticsData(prev => ({
        ...prev,
        topVideos: newTopContent
      }));
    }
  };

  // Handle date range change
  const handleDateRangeChange = (event) => {
    const value = event.target.value;

    if (value === "custom") {
      setShowCustomDatePicker(true);
      // Don't change dateRange yet, wait for user to apply custom dates
    } else {
      setShowCustomDatePicker(false);
      setIsChartLoading(true);
      setDateRange(value);
    }
  };

  // Handle custom date range application
  const handleApplyCustomRange = async () => {
    if (customStartDate) {
      // If no end date is provided, use start date as end date (single day)
      const endDate = customEndDate || customStartDate;
      const customRange = `custom_${customStartDate}_${endDate}`;

      console.log('📅 Applying custom date range:', customStartDate, 'to', endDate);
      console.log('📅 Custom range string:', customRange);

      setShowCustomDatePicker(false);
      setIsChartLoading(true);

      // Set the date range first
      setDateRange(customRange);

      // Use the same range function for consistency (no more dual endpoints!)
      try {
        await fetchAnalyticsWithDateRange(customRange, customStartDate, endDate);
        console.log('🎉 Custom range analytics data updated successfully!');
      } catch (error) {
        console.error("Error fetching data for custom range:", error);
        setError("Failed to load data for custom date range");
      } finally {
        setIsChartLoading(false);
      }
    }
  };

  // Removed fetchAnalyticsWithCustomRange - now using single fetchAnalyticsWithDateRange function for all cases



  if (loading) {
    return (
      <Layout>
        <Box sx={{
          minHeight: '100vh',
          background: 'transparent',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          '@keyframes float': {
            '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
            '33%': { transform: 'translateY(-20px) rotate(120deg)' },
            '66%': { transform: 'translateY(10px) rotate(240deg)' },
          },
          '@keyframes pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.8 },
            '50%': { transform: 'scale(1.1)', opacity: 1 },
          },
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          },
          '@keyframes wave': {
            '0%, 100%': { transform: 'scaleY(1)' },
            '50%': { transform: 'scaleY(1.5)' },
          },
          '@keyframes glow': {
            '0%, 100%': { boxShadow: '0 0 20px rgba(102, 126, 234, 0.5)' },
            '50%': { boxShadow: '0 0 40px rgba(102, 126, 234, 0.8), 0 0 60px rgba(118, 75, 162, 0.6)' },
          },
        }}>
          {/* Animated Background Elements */}
          <Box sx={{
            position: 'absolute',
            top: '20%',
            left: '15%',
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
            borderRadius: '20px',
            animation: 'float 4s ease-in-out infinite',
            animationDelay: '0s',
          }} />

          <Box sx={{
            position: 'absolute',
            top: '60%',
            right: '20%',
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, rgba(118, 75, 162, 0.4) 0%, rgba(102, 126, 234, 0.4) 100%)',
            borderRadius: '50%',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '1s',
          }} />

          <Box sx={{
            position: 'absolute',
            bottom: '25%',
            left: '25%',
            width: '40px',
            height: '40px',
            background: 'rgba(102, 126, 234, 0.5)',
            borderRadius: '8px',
            animation: 'spin 6s linear infinite',
            animationDelay: '2s',
          }} />

          {/* Main Loading Animation */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            zIndex: 1,
          }}>
            {/* Animated Chart Icon */}
            <Box sx={{
              position: 'relative',
              width: '120px',
              height: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
              backdropFilter: 'blur(20px)',
              borderRadius: '30px',
              border: '2px solid rgba(102, 126, 234, 0.3)',
              animation: 'glow 2s ease-in-out infinite',
            }}>
              {/* Animated Bars */}
              <Box sx={{ display: 'flex', alignItems: 'end', gap: 1 }}>
                {[1, 2, 3, 4, 5].map((bar, index) => (
                  <Box
                    key={bar}
                    sx={{
                      width: '8px',
                      height: `${20 + (index * 8)}px`,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '4px',
                      animation: 'wave 1.5s ease-in-out infinite',
                      animationDelay: `${index * 0.2}s`,
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Loading Text */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{
                fontWeight: 700,
                mb: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Loading Analytics
              </Typography>

              <Typography variant="body1" sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                mb: 3,
                fontSize: '16px',
              }}>
                Preparing your performance insights...
              </Typography>

              {/* Animated Dots */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                {[1, 2, 3].map((dot, index) => (
                  <Box
                    key={dot}
                    sx={{
                      width: '12px',
                      height: '12px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '50%',
                      animation: 'pulse 1.4s ease-in-out infinite',
                      animationDelay: `${index * 0.2}s`,
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{
        minHeight: '100vh',
        background: 'transparent',
        color: 'white',
        p: { xs: 2, lg: 4 }
      }}>


        {/* Header */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
              Channel analytics
            </Typography>
            {loadTime && (
              <Typography variant="caption" sx={{
                color: '#4CAF50',
                bgcolor: 'rgba(76, 175, 80, 0.1)',
                px: 1,
                py: 0.5,
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600
              }}>
                ⚡ {loadTime.toFixed(0)}ms
              </Typography>
            )}
          </Box>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            {/* Cool Calendar Date Range Picker */}
            <Box sx={{ position: 'relative' }}>
              <Button
                onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  height: '42px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textTransform: 'none',
                  padding: '10px 16px',
                  minWidth: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <Box sx={{ fontSize: '16px' }}>📅</Box>
                <Box sx={{ flex: 1, textAlign: 'left' }}>
                  {customStartDate === customEndDate ?
                    new Date(customStartDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) :
                    `${new Date(customStartDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })} - ${new Date(customEndDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}`
                  }
                </Box>
                <Box sx={{
                  fontSize: '12px',
                  opacity: 0.7,
                  transform: showCustomDatePicker ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  ▼
                </Box>
              </Button>

              {/* Calendar Dropdown */}
              {showCustomDatePicker && (
                <Box sx={{
                  position: 'absolute',
                  top: '50px',
                  left: 0,
                  zIndex: 1000,
                  background: 'rgba(42, 42, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                  minWidth: '320px'
                }}>
                  <Typography variant="h6" sx={{
                    color: 'white',
                    fontWeight: 600,
                    mb: 2,
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    Select Date Range
                  </Typography>

                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    mb: 3,
                    fontSize: '13px'
                  }}>
                    Click a date to start, click another to set range
                  </Typography>

                  {/* Calendar Grid */}
                  <CalendarGrid
                    startDate={customStartDate}
                    endDate={customEndDate}
                    onDateSelect={(start, end) => {
                      setCustomStartDate(start);
                      setCustomEndDate(end);

                      // Auto-apply the date range
                      const customRange = `custom_${start}_${end}`;
                      console.log('📅 Calendar: Applying date range:', customRange);
                      setIsChartLoading(true);
                      setDateRange(customRange);

                      // Fetch analytics with the specific date range
                      fetchAnalyticsWithDateRange(customRange, start, end).then(() => {
                        console.log('📅 Calendar: Analytics fetch completed for range:', customRange);
                        fetchTopContentWithCustomRange(contentFilter, customRange, start, end);
                      }).catch(error => {
                        console.error('📅 Calendar: Analytics fetch failed:', error);
                        setIsChartLoading(false);
                      });

                      // Close calendar after selection
                      setTimeout(() => setShowCustomDatePicker(false), 300);
                    }}
                  />
                </Box>
              )}
            </Box>

            {/* Modern Refresh Button */}
            <Tooltip title="Refresh Analytics Data" arrow>
              <IconButton
                onClick={() => {
                  console.log('🔄 FRONTEND: REFRESH - Fetching fresh data...');
                  setAnalyticsData(null);
                  setError(null);
                  fetchAnalytics();
                }}
                sx={{
                  width: '42px',
                  height: '42px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  },
                  '&:active': {
                    transform: 'translateY(0px)',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)'
                  }
                }}
              >
                <RefreshIcon sx={{ fontSize: '20px' }} />
              </IconButton>
            </Tooltip>


          </Box>
        </Box>



        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              bgcolor: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              '& .MuiAlert-message': { color: '#ff6b6b' }
            }}
            action={
              <Button color="inherit" size="small" onClick={fetchAnalytics}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ mb: 4 }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{
              '& .MuiTab-root': {
                color: '#888',
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 500
              },
              '& .Mui-selected': { color: 'white !important' },
              '& .MuiTabs-indicator': {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                height: 3
              }
            }}
          >
            <Tab label="Overview" />
            
          </Tabs>
        </Box>

        {analyticsData && (
          <>
            {/* Tab Content */}
            {tabValue === 0 && (
              <>
                {/* Ultra Compact Stats Bar */}
            <Box sx={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
              border: '1px solid rgba(102, 126, 234, 0.1)',
              borderRadius: 1,
              p: 0.5,
              mb: 0.75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 0.75,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
              }
            }}>
              {/* Modern KPI Performance Cards - Fixed Layout */}
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                flex: 1,
                minWidth: 0
              }}>
                {/* Top Row: 4 cards side by side */}
                <Box sx={{
                  display: 'flex',
                  gap: 0.75,
                  '& > *': {
                    flex: '1 1 0',
                    minWidth: 0,
                    maxWidth: 'calc(25% - 4.5px)'
                  }
                }}>
                  {/* Total Views Card - First position with circular progress */}
                  <Box sx={{
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.08) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(102, 126, 234, 0.25)',
                    borderRadius: 1,
                    p: 0.75,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.25)',
                      border: '1px solid rgba(102, 126, 234, 0.4)',
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.12) 100%)',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                      <Typography variant="h6" sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        lineHeight: 1,
                        filter: 'drop-shadow(0 2px 8px rgba(102, 126, 234, 0.4))'
                      }}>
                        {formatNumber(analyticsData.totalViews || 0)}
                      </Typography>

                      {/* Circular Progress Meter */}
                      {analyticsData.summary?.progressToTarget !== undefined && (
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 4,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 70,
                          height: 70
                        }}>
                          {/* Background Circle */}
                          <svg width="70" height="70" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="rgba(255, 255, 255, 0.1)"
                              strokeWidth="4"
                            />
                            {/* Progress Arc */}
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="url(#progressGradient)"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.min(analyticsData.summary.progressToTarget, 100) / 100)}`}
                              style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: 'drop-shadow(0 0 6px rgba(102, 126, 234, 0.6))'
                              }}
                            />
                            <defs>
                              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#667eea" />
                                <stop offset="100%" stopColor="#764ba2" />
                              </linearGradient>
                            </defs>
                          </svg>
                          {/* Percentage Text */}
                          <Typography sx={{
                            position: 'absolute',
                            color: '#667eea',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                          }}>
                            {analyticsData.summary.progressToTarget.toFixed(0)}%
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Box>
                      <Typography sx={{
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.6rem',
                        letterSpacing: '0.1px',
                        mb: 0.0625
                      }}>
                        TOTAL VIEWS
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.55rem',
                        display: 'block'
                      }}>
                        {getDateRangeLabel()}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Submissions Card */}
                  {(analyticsData.totalSubmissions !== undefined || analyticsData.topVideos?.length) && (
                    <Box sx={{
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.08) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(102, 126, 234, 0.25)',
                      borderRadius: 1,
                      p: 0.75,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: '30px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 16px rgba(102, 126, 234, 0.25)',
                        border: '1px solid rgba(102, 126, 234, 0.4)',
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.12) 100%)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #667eea, #764ba2)',
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.125 }}>
                        <Typography variant="h6" sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          filter: 'drop-shadow(0 2px 8px rgba(102, 126, 234, 0.4))'
                        }}>
                          {analyticsData.totalSubmissions || analyticsData.topVideos?.length || 50}
                        </Typography>
                        <Box sx={{
                          background: 'rgba(102, 126, 234, 0.2)',
                          borderRadius: 1,
                          p: 0.5,
                          backdropFilter: 'blur(5px)'
                        }}>
                          <TrendingUpIcon sx={{ color: '#667eea', fontSize: 16 }} />
                        </Box>
                      </Box>
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.6rem',
                          letterSpacing: '0.1px',
                          mb: 0.0625
                        }}>
                          SUBMISSIONS
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.55rem',
                          display: 'block'
                        }}>
                          Total Videos
                        </Typography>
                      </Box>
                    </Box>
                  )}



                  {/* Mega Virals Card - Third position in top row */}
                  {analyticsData && analyticsData.megaViralsCount !== undefined && analyticsData.megaViralsCount > 0 && (
                    <Box
                      onClick={() => handleOpenVideoModal('megaVirals')}
                      sx={{
                        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 193, 7, 0.08) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 215, 0, 0.25)',
                        borderRadius: 1,
                        p: 0.75,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': {
                          transform: 'translateY(-1px) scale(1.005)',
                          boxShadow: '0 6px 20px rgba(255, 215, 0, 0.3)',
                          border: '1px solid rgba(255, 215, 0, 0.5)',
                          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.25) 0%, rgba(255, 193, 7, 0.15) 100%)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: 'linear-gradient(90deg, #FFD700, #FFC107)',
                        }
                      }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                        <Typography variant="h6" sx={{
                          color: '#FFD700',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          textShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
                        }}>
                          {analyticsData.megaViralsCount}
                        </Typography>
                      </Box>
                      {/* Circular Progress for Hit Rate */}
                      {analyticsData.megaViralsPercentage !== undefined && analyticsData.totalSubmissions > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 4,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 70,
                          height: 70
                        }}>
                          <svg width="70" height="70" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="rgba(255, 215, 0, 0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="#FFD700"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - analyticsData.megaViralsPercentage / 100)}`}
                              style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))'
                              }}
                            />
                          </svg>
                          <Typography sx={{
                            position: 'absolute',
                            color: '#FFD700',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(255, 215, 0, 0.3)'
                          }}>
                            {analyticsData.megaViralsPercentage}%
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.6rem',
                          letterSpacing: '0.1px',
                          mb: 0.0625
                        }}>
                          MEGA VIRALS
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.55rem',
                          display: 'block'
                        }}>
                          {getCategoryDescriptions().megaVirals}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Virals Card */}
                  {analyticsData && analyticsData.viralsCount !== undefined && analyticsData.viralsCount > 0 && (
                    <Box
                      onClick={() => handleOpenVideoModal('virals')}
                      sx={{
                        background: 'linear-gradient(135deg, rgba(255, 87, 34, 0.15) 0%, rgba(244, 67, 54, 0.08) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 87, 34, 0.25)',
                        borderRadius: 1,
                        p: 0.75,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': {
                          transform: 'translateY(-1px) scale(1.005)',
                          boxShadow: '0 6px 20px rgba(255, 87, 34, 0.3)',
                          border: '1px solid rgba(255, 87, 34, 0.5)',
                          background: 'linear-gradient(135deg, rgba(255, 87, 34, 0.25) 0%, rgba(244, 67, 54, 0.15) 100%)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: 'linear-gradient(90deg, #FF5722, #F44336)',
                        }
                      }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                        <Typography variant="h6" sx={{
                          color: '#FF5722',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          textShadow: '0 2px 8px rgba(255, 87, 34, 0.4)'
                        }}>
                          {analyticsData.viralsCount}
                        </Typography>
                      </Box>
                      {/* Circular Progress for Hit Rate */}
                      {analyticsData.viralsPercentage !== undefined && analyticsData.totalSubmissions > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 4,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 70,
                          height: 70
                        }}>
                          <svg width="70" height="70" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="rgba(255, 87, 34, 0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="#FF5722"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - analyticsData.viralsPercentage / 100)}`}
                              style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: 'drop-shadow(0 0 6px rgba(255, 87, 34, 0.6))'
                              }}
                            />
                          </svg>
                          <Typography sx={{
                            position: 'absolute',
                            color: '#FF5722',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(255, 87, 34, 0.3)'
                          }}>
                            {analyticsData.viralsPercentage}%
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          letterSpacing: '0.2px',
                          mb: 0.125
                        }}>
                          VIRALS
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.6rem',
                          display: 'block'
                        }}>
                          {getCategoryDescriptions().virals}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Almost Virals Card - Fourth position in top row */}
                  {analyticsData && analyticsData.almostViralsCount !== undefined && analyticsData.almostViralsCount > 0 && (
                    <Box
                      onClick={() => handleOpenVideoModal('almostVirals')}
                      sx={{
                        background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 193, 7, 0.08) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 152, 0, 0.25)',
                        borderRadius: 1,
                        p: 0.75,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': {
                          transform: 'translateY(-1px) scale(1.005)',
                          boxShadow: '0 6px 20px rgba(255, 152, 0, 0.3)',
                          border: '1px solid rgba(255, 152, 0, 0.5)',
                          background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.25) 0%, rgba(255, 193, 7, 0.15) 100%)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: 'linear-gradient(90deg, #FF9800, #FFC107)',
                        }
                      }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                        <Typography variant="h6" sx={{
                          color: '#FF9800',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          textShadow: '0 2px 8px rgba(255, 152, 0, 0.4)'
                        }}>
                          {analyticsData.almostViralsCount}
                        </Typography>
                      </Box>
                      {/* Circular Progress for Hit Rate */}
                      {analyticsData.almostViralsPercentage !== undefined && analyticsData.totalSubmissions > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 4,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 70,
                          height: 70
                        }}>
                          <svg width="70" height="70" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="rgba(255, 152, 0, 0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="#FF9800"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - analyticsData.almostViralsPercentage / 100)}`}
                              style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: 'drop-shadow(0 0 6px rgba(255, 152, 0, 0.6))'
                              }}
                            />
                          </svg>
                          <Typography sx={{
                            position: 'absolute',
                            color: '#FF9800',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(255, 152, 0, 0.3)'
                          }}>
                            {analyticsData.almostViralsPercentage}%
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.6rem',
                          letterSpacing: '0.1px',
                          mb: 0.0625
                        }}>
                          ALMOST VIRALS
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.55rem',
                          display: 'block'
                        }}>
                          {getCategoryDescriptions().almostVirals}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                </Box>

                {/* Bottom Row: 4 cards side by side */}
                <Box sx={{
                  display: 'flex',
                  gap: 0.75,
                  '& > *': {
                    flex: '1 1 0',
                    minWidth: 0,
                    maxWidth: 'calc(25% - 4.5px)'
                  }
                }}>




                  {/* Decent Videos Card */}
                  {analyticsData && analyticsData.decentVideosCount !== undefined && analyticsData.decentVideosCount > 0 && (
                    <Box
                      onClick={() => handleOpenVideoModal('decentVideos')}
                      sx={{
                        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(139, 195, 74, 0.08) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(76, 175, 80, 0.25)',
                        borderRadius: 1,
                        p: 0.75,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': {
                          transform: 'translateY(-1px) scale(1.005)',
                          boxShadow: '0 6px 20px rgba(76, 175, 80, 0.3)',
                          border: '1px solid rgba(76, 175, 80, 0.5)',
                          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.25) 0%, rgba(139, 195, 74, 0.15) 100%)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
                        }
                      }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                        <Typography variant="h6" sx={{
                          color: '#4CAF50',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          textShadow: '0 2px 8px rgba(76, 175, 80, 0.4)'
                        }}>
                          {analyticsData.decentVideosCount}
                        </Typography>
                      </Box>
                      {/* Circular Progress for Hit Rate */}
                      {analyticsData.decentVideosPercentage !== undefined && analyticsData.totalSubmissions > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 4,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 70,
                          height: 70
                        }}>
                          <svg width="70" height="70" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="rgba(76, 175, 80, 0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="#4CAF50"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - analyticsData.decentVideosPercentage / 100)}`}
                              style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: 'drop-shadow(0 0 6px rgba(76, 175, 80, 0.6))'
                              }}
                            />
                          </svg>
                          <Typography sx={{
                            position: 'absolute',
                            color: '#4CAF50',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(76, 175, 80, 0.3)'
                          }}>
                            {analyticsData.decentVideosPercentage}%
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          letterSpacing: '0.2px',
                          mb: 0.125
                        }}>
                          DECENT VIDEOS
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.6rem',
                          display: 'block'
                        }}>
                          {getCategoryDescriptions().decentVideos}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Flops Card */}
                  {analyticsData && analyticsData.flopsCount !== undefined && analyticsData.flopsCount > 0 && (
                    <Box
                      onClick={() => handleOpenVideoModal('flops')}
                      sx={{
                        background: 'linear-gradient(135deg, rgba(158, 158, 158, 0.15) 0%, rgba(121, 121, 121, 0.08) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(158, 158, 158, 0.25)',
                        borderRadius: 1,
                        p: 0.75,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        '&:hover': {
                          transform: 'translateY(-1px) scale(1.005)',
                          boxShadow: '0 6px 20px rgba(158, 158, 158, 0.3)',
                          border: '1px solid rgba(158, 158, 158, 0.5)',
                          background: 'linear-gradient(135deg, rgba(158, 158, 158, 0.25) 0%, rgba(121, 121, 121, 0.15) 100%)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: 'linear-gradient(90deg, #9E9E9E, #757575)',
                        }
                      }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                        <Typography variant="h6" sx={{
                          color: '#9E9E9E',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          textShadow: '0 2px 8px rgba(158, 158, 158, 0.4)'
                        }}>
                          {analyticsData.flopsCount}
                        </Typography>
                      </Box>
                      {/* Circular Progress for Hit Rate */}
                      {analyticsData.flopsPercentage !== undefined && analyticsData.totalSubmissions > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          right: 4,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 70,
                          height: 70
                        }}>
                          <svg width="70" height="70" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="rgba(158, 158, 158, 0.2)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="35"
                              cy="35"
                              r="30"
                              fill="none"
                              stroke="#9E9E9E"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - analyticsData.flopsPercentage / 100)}`}
                              style={{
                                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: 'drop-shadow(0 0 6px rgba(158, 158, 158, 0.6))'
                              }}
                            />
                          </svg>
                          <Typography sx={{
                            position: 'absolute',
                            color: '#9E9E9E',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            lineHeight: 1,
                            textShadow: '0 2px 4px rgba(158, 158, 158, 0.3)'
                          }}>
                            {analyticsData.flopsPercentage}%
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          letterSpacing: '0.2px',
                          mb: 0.125
                        }}>
                          FLOPS
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.6rem',
                          display: 'block'
                        }}>
                          {getCategoryDescriptions().flops}
                        </Typography>
                      </Box>
                    </Box>
                  )}



                  {/* Daily Average Card */}
                  {analyticsData.avgDailyViews !== undefined && (
                    <Box sx={{
                      background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15) 0%, rgba(30, 136, 229, 0.08) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(33, 150, 243, 0.25)',
                      borderRadius: 1,
                      p: 0.75,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: '30px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 16px rgba(33, 150, 243, 0.25)',
                        border: '1px solid rgba(33, 150, 243, 0.4)',
                        background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.2) 0%, rgba(30, 136, 229, 0.12) 100%)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #2196F3, #1E88E5)',
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.125 }}>
                        <Typography variant="h6" sx={{
                          color: '#2196F3',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          textShadow: '0 2px 8px rgba(33, 150, 243, 0.4)'
                        }}>
                          {formatNumber(analyticsData.avgDailyViews)}
                        </Typography>
                        <Box sx={{
                          background: 'rgba(33, 150, 243, 0.2)',
                          borderRadius: 1,
                          p: 0.5,
                          backdropFilter: 'blur(5px)'
                        }}>
                          <TrendingUpIcon sx={{ color: '#2196F3', fontSize: 16 }} />
                        </Box>
                      </Box>
                      <Box>
                        <Typography sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.6rem',
                          letterSpacing: '0.1px',
                          mb: 0.0625
                        }}>
                          DAILY AVG
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.55rem',
                          display: 'block'
                        }}>
                          Views per Day
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Average Views Card */}
                  <Box sx={{
                    background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(139, 195, 74, 0.08) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(76, 175, 80, 0.25)',
                    borderRadius: 1,
                    p: 0.75,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 16px rgba(76, 175, 80, 0.25)',
                      border: '1px solid rgba(76, 175, 80, 0.4)',
                      background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.2) 0%, rgba(139, 195, 74, 0.12) 100%)',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                      <Typography variant="h6" sx={{
                        color: '#4CAF50',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        lineHeight: 1,
                        textShadow: '0 2px 8px rgba(76, 175, 80, 0.4)'
                      }}>
                        {formatNumber(analyticsData.avgVideoViews || 0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.6rem',
                        letterSpacing: '0.1px',
                        mb: 0.0625
                      }}>
                        AVERAGE VIEWS
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.55rem',
                        display: 'block'
                      }}>
                        Per Video
                      </Typography>
                    </Box>
                  </Box>

                  {/* Median Views Card */}
                  <Box sx={{
                    background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.15) 0%, rgba(142, 36, 170, 0.08) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(156, 39, 176, 0.25)',
                    borderRadius: 1,
                    p: 0.75,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 16px rgba(156, 39, 176, 0.25)',
                      border: '1px solid rgba(156, 39, 176, 0.4)',
                      background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.2) 0%, rgba(142, 36, 170, 0.12) 100%)',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #9C27B0, #8E24AA)',
                    }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', mb: 0.125, pr: 9 }}>
                      <Typography variant="h6" sx={{
                        color: '#9C27B0',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        lineHeight: 1,
                        textShadow: '0 2px 8px rgba(156, 39, 176, 0.4)'
                      }}>
                        {formatNumber(analyticsData.medianVideoViews || 0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.6rem',
                        letterSpacing: '0.1px',
                        mb: 0.0625
                      }}>
                        MEDIAN VIEWS
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.55rem',
                        display: 'block'
                      }}>
                        Per Video
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>






            </Box>

            {/* Data Source Indicator */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
              mt: 4,
              px: 1
            }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                Daily Views Chart
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Legend for line types */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: 20,
                      height: 2,
                      bgcolor: '#4fc3f7'
                    }} />
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '11px' }}>
                      YouTube Analytics
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: 20,
                      height: 2,
                      bgcolor: '#FF9800',
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #1a1a1a 2px, #1a1a1a 4px)'
                    }} />
                    <Typography variant="caption" sx={{ color: '#888', fontSize: '11px' }}>
                      Rough Estimate
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Charts Container */}
            <Box sx={{
              display: 'flex',
              gap: 3,
              width: '100%',
              height: '400px',
              '@media (max-width: 1200px)': {
                flexDirection: 'column',
                height: 'auto'
              }
            }}>
              {/* Main Line Chart */}
              <Box sx={{
                flex: '1 1 75%',
                height: '400px',
                minWidth: '600px',
                '@media (max-width: 1200px)': {
                  flex: '1 1 100%',
                  minWidth: 'auto'
                },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {isChartLoading ? (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      border: '4px solid #333',
                      borderTop: '4px solid #4fc3f7',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }} />
                    <Typography variant="body1" sx={{ color: '#888' }}>
                      Updating chart data...
                    </Typography>
                  </Box>
                ) : (
                  <ReactECharts
                  option={{
                    tooltip: {
                      trigger: 'axis',
                      backgroundColor: 'rgba(50, 50, 50, 0.9)',
                      borderColor: '#4fc3f7',
                      borderWidth: 1,
                      textStyle: { color: '#fff' },
                      formatter: (params) => {
                        if (!params || params.length === 0) return '';

                        const date = params[0]?.axisValue || 'N/A';

                        // Check if we have split data (shorts vs longs)
                        if (analyticsData.hasSplitData && params.length === 2) {
                          let shortsValue = 0;
                          let longsValue = 0;

                          params.forEach(param => {
                            if (param.seriesName === 'Shorts Videos') {
                              shortsValue = param.value || 0;
                            } else if (param.seriesName === 'Long Videos') {
                              longsValue = param.value || 0;
                            }
                          });

                          const totalValue = shortsValue + longsValue;

                          return `
                            <div style="padding: 12px; min-width: 200px;">
                              <div style="font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 8px; border-bottom: 1px solid #666; padding-bottom: 4px;">${date}</div>

                              <div style="margin-bottom: 6px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background-color: #4fc3f7; border-radius: 50%; margin-right: 8px;"></span>
                                <span style="color: #fff; font-weight: 500;">Shorts Videos:</span>
                                <span style="color: #4fc3f7; font-weight: 600; float: right;">${formatNumber(shortsValue)}</span>
                              </div>

                              <div style="margin-bottom: 8px;">
                                <span style="display: inline-block; width: 10px; height: 10px; background-color: #FF9800; border-radius: 50%; margin-right: 8px;"></span>
                                <span style="color: #fff; font-weight: 500;">Long Videos:</span>
                                <span style="color: #FF9800; font-weight: 600; float: right;">${formatNumber(longsValue)}</span>
                              </div>

                              <div style="border-top: 1px solid #666; padding-top: 6px; margin-top: 8px;">
                                <span style="color: #fff; font-weight: 600;">Total Views:</span>
                                <span style="color: #fff; font-weight: 700; font-size: 16px; float: right;">${formatNumber(totalValue)}</span>
                              </div>

                              <div style="font-size: 11px; color: #aaa; margin-top: 6px; text-align: center;">📊 BigQuery Daily Increases</div>
                            </div>
                          `;
                        } else {
                          // Original single line tooltip for non-split writers
                          const dataIndex = params[0]?.dataIndex;
                          const dailyTotalPoint = analyticsData.aggregatedViewsData?.[dataIndex];

                          if (!dailyTotalPoint) {
                            const value = params[0]?.value || 0;
                            const formattedValue = formatNumber(value);
                            return `
                              <div style="min-width: 200px;">
                                <div style="font-size: 12px; color: #ccc;">${date}</div>
                                <div style="font-size: 18px, font-weight: 600; color: #fff;">${formattedValue} views</div>
                              </div>
                            `;
                          }

                          const views = formatNumber(dailyTotalPoint.views);

                          // Check data source
                          const isBigQuery = dailyTotalPoint.source === 'BigQuery_Daily_Totals' || dailyTotalPoint.source === 'BigQuery_Daily_Totals_Filtered_In_Query' || !dailyTotalPoint.source?.includes('InfluxDB');
                          const isInfluxDB = dailyTotalPoint.source === 'InfluxDB_Hourly_Aggregation' || dailyTotalPoint.source?.includes('InfluxDB');

                          const statusIndicator = isInfluxDB
                            ? '<div style="font-size: 11px; color: #FF9800; margin-top: 4px;">📊 Rough Estimate (Real-time)</div>'
                            : '<div style="font-size: 11px; color: #4fc3f7; margin-top: 4px;">✅ YouTube Analytics (Confirmed)</div>';

                          return `
                            <div style="min-width: 250px; max-width: 350px;">
                              <div style="font-size: 12px; color: #ccc; margin-bottom: 4px;">${dayjs(dailyTotalPoint.time).format('MMM D, YYYY')}</div>
                              <div style="font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 6px;">${views} total views</div>
                              ${statusIndicator}
                            </div>
                          `;
                        }
                      },
                      extraCssText: 'box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);',
                    },
                    grid: {
                      left: '3%',
                      right: '4%',
                      bottom: '3%',
                      containLabel: true,
                      backgroundColor: 'transparent'
                    },
                    xAxis: {
                      type: 'category',
                      boundaryGap: false,
                      data: (() => {
                        // Use split data for x-axis if available, otherwise use aggregated data
                        if (analyticsData.hasSplitData && analyticsData.shortsData) {
                          return analyticsData.shortsData.map(item => formatDate(item.date));
                        }
                        return analyticsData.aggregatedViewsData?.map(item => formatDate(item.time)) || [];
                      })(),
                      axisLabel: {
                        // For single date, always show the label; for multiple dates, show every other
                        formatter: (value, index) => {
                          const dataLength = analyticsData.aggregatedViewsData?.length || 0;
                          return dataLength === 1 || index % 2 === 0 ? value : '';
                        },
                        color: '#9e9e9e'
                      },
                      axisLine: {
                        lineStyle: { color: '#424242' }
                      }
                    },
                    yAxis: {
                      type: 'value',
                      axisLabel: {
                        formatter: formatNumber,
                        color: '#9e9e9e'
                      },
                      axisLine: {
                        lineStyle: { color: '#424242' }
                      },
                      splitLine: {
                        lineStyle: { color: '#424242', type: 'dashed' }
                      }
                    },
                    series: (() => {
                      const data = analyticsData.aggregatedViewsData || [];
                      const isMultipleData = data.length > 1;
                      const isSingleDate = data.length === 1;

                      if (isSingleDate) {
                        // Single date - use bar chart
                        return [{
                          data: data.map(item => item.views),
                          type: 'bar',
                          itemStyle: {
                            color: '#4fc3f7'
                          }
                        }];
                      }

                      const series = [];

                      // Check if we have split data (shorts vs longs)
                      if (analyticsData.hasSplitData && analyticsData.shortsData && analyticsData.longsData) {
                        console.log('📊 Rendering split chart with shorts and longs data');

                        // Add Shorts series (blue line)
                        const shortsData = analyticsData.shortsData.map(item => item.views);
                        if (shortsData.some(val => val !== null)) {
                          series.push({
                            name: 'Shorts Videos',
                            data: shortsData,
                            type: 'line',
                            smooth: true,
                            lineStyle: {
                              color: '#4fc3f7',
                              width: 3,
                              type: 'solid'
                            },
                            areaStyle: {
                              color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                  { offset: 0, color: 'rgba(79, 195, 247, 0.3)' },
                                  { offset: 1, color: 'rgba(79, 195, 247, 0.05)' },
                                ],
                              },
                            },
                            symbol: 'circle',
                            symbolSize: 6,
                            itemStyle: {
                              color: '#4fc3f7',
                              borderColor: '#fff',
                              borderWidth: 1
                            },
                            connectNulls: false
                          });
                        }

                        // Add Long Videos series (orange line)
                        const longsData = analyticsData.longsData.map(item => item.views);
                        if (longsData.some(val => val !== null)) {
                          series.push({
                            name: 'Long Videos',
                            data: longsData,
                            type: 'line',
                            smooth: true,
                            lineStyle: {
                              color: '#FF9800',
                              width: 3,
                              type: 'solid'
                            },
                            areaStyle: {
                              color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                  { offset: 0, color: 'rgba(255, 152, 0, 0.3)' },
                                  { offset: 1, color: 'rgba(255, 152, 0, 0.05)' },
                                ],
                              },
                            },
                            symbol: 'circle',
                            symbolSize: 6,
                            itemStyle: {
                              color: '#FF9800',
                              borderColor: '#fff',
                              borderWidth: 1
                            },
                            connectNulls: false
                          });
                        }
                      } else {
                        // Original single line chart for non-split writers
                        const bigQueryData = data.map(item => item.views);

                        // Add BigQuery series (solid line) if there's data
                        if (bigQueryData.some(val => val !== null)) {
                          series.push({
                            name: 'YouTube Analytics',
                            data: bigQueryData,
                            type: 'line',
                            smooth: true,
                            lineStyle: {
                              color: '#4fc3f7',
                              width: 3,
                              type: 'solid'
                            },
                            areaStyle: {
                              color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 0,
                                y2: 1,
                                colorStops: [
                                  { offset: 0, color: 'rgba(79, 195, 247, 0.3)' },
                                  { offset: 1, color: 'rgba(79, 195, 247, 0.05)' },
                                ],
                              },
                            },
                            symbol: 'circle',
                            symbolSize: 6,
                            itemStyle: {
                              color: '#4fc3f7',
                              borderColor: '#fff',
                              borderWidth: 1
                            },
                            connectNulls: false
                          });
                        }
                      }

                      // COMMENTED OUT: InfluxDB series (dotted line) - now only used for real-time bar chart
                      // if (influxData.some(val => val !== null)) {
                      //   series.push({
                      //     name: 'Rough Estimate',
                      //     data: influxData,
                      //     type: 'line',
                      //     smooth: true,
                      //     lineStyle: {
                      //       color: '#FF9800',
                      //       width: 3,
                      //       type: 'dashed' // Dotted line for InfluxDB data
                      //     },
                      //     symbol: 'circle',
                      //     symbolSize: 8, // Slightly larger for InfluxDB data
                      //     itemStyle: {
                      //       color: '#FF9800', // Orange for InfluxDB data
                      //       borderColor: '#fff',
                      //       borderWidth: 1
                      //     },
                      //     connectNulls: true
                      //   });
                      // }

                      return series;
                    })()
                  }}
                  style={{ height: '100%', width: '100%' }}
                />
                )}
              </Box>

              {/* Realtime Hourly Views Bar Chart */}
              <Box sx={{
                flex: '1 1 25%',
                height: '400px',
                minWidth: '300px',
                '@media (max-width: 1200px)': {
                  flex: '1 1 100%',
                  minWidth: 'auto'
                }
              }}>
                <RealtimeWidget />
              </Box>
            </Box>

            {/* Writer Profile Section */}
            <Box sx={{ mt: 6, mb: 4 }}>
              <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                Writer Profile
              </Typography>

              {/* Profile Cards */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 3,
                mb: 4
              }}>
                {/* Experience Level Card */}
                <Box sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }
                }}>
                  {/* Badge Image - No background, bigger */}
                  <Box sx={{
                    width: 120,
                    height: 120,
                    mx: 'auto',
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={getBadgeImage((() => {
                        const views = analyticsData?.totalViews || 0;
                        // 100M split into 6 levels: 0-16.7M, 16.7-33.3M, 33.3-50M, 50-66.7M, 66.7-83.3M, 83.3M+
                        if (views >= 83333333) return 6;
                        if (views >= 66666666) return 5;
                        if (views >= 50000000) return 4;
                        if (views >= 33333333) return 3;
                        if (views >= 16666666) return 2;
                        return 1;
                      })())}
                      alt="Experience Badge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </Box>

                  {/* Writer Name */}
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'white',
                      fontWeight: 600,
                      textAlign: 'center',
                      mb: 1,
                      fontSize: '18px'
                    }}
                  >
                    {user?.username || 'Writer'}
                  </Typography>

                  {/* Level Information */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 2
                  }}>
                    <Box sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '20px',
                      px: 3,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}
                      >
                        Level {(() => {
                          const views = analyticsData?.totalViews || 0;
                          if (views >= 83333333) return 6;
                          if (views >= 66666666) return 5;
                          if (views >= 50000000) return 4;
                          if (views >= 33333333) return 3;
                          if (views >= 16666666) return 2;
                          return 1;
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                  {/* Progress Bar to 100M */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1
                    }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                        Progress to 100M
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                        {Math.min(100, ((analyticsData?.totalViews || 0) / 100000000 * 100)).toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{
                      width: '100%',
                      height: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <Box sx={{
                        width: `${Math.min(100, ((analyticsData?.totalViews || 0) / 100000000 * 100))}%`,
                        height: '100%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }} />
                    </Box>
                  </Box>
                </Box>

                {/* Badge Progress Card */}
                <Box sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }
                }}>
                  {/* Badge Carousel */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 4,
                    mb: 4,
                    position: 'relative',
                    height: 180
                  }}>
                    {(() => {
                      const views = analyticsData?.totalViews || 0;
                      let currentLevel = 1;
                      if (views >= 83333333) currentLevel = 6;
                      else if (views >= 66666666) currentLevel = 5;
                      else if (views >= 50000000) currentLevel = 4;
                      else if (views >= 33333333) currentLevel = 3;
                      else if (views >= 16666666) currentLevel = 2;

                      const leftLevel = currentLevel === 1 ? 6 : currentLevel - 1;
                      const rightLevel = currentLevel === 6 ? 1 : currentLevel + 1;

                      return (
                        <>
                          {/* Left Badge (Previous/Last level) */}
                          <Box sx={{
                            width: 120,
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 1,
                            transform: 'translateY(10px) scale(0.85)',
                            opacity: 0.65
                          }}>
                            <img
                              src={getBadgeImage(leftLevel)}
                              alt={`Level ${leftLevel} Badge`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'grayscale(40%)'
                              }}
                            />
                          </Box>

                          {/* Center Badge (Current level - Highlighted & Biggest) */}
                          <Box sx={{
                            width: 170,
                            height: 170,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 3,
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: -8,
                              left: -8,
                              right: -8,
                              bottom: -8,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: '50%',
                              opacity: 0.15,
                              animation: `${pulse} 3s ease-in-out infinite`,
                              zIndex: -1
                            }
                          }}>
                            <img
                              src={getBadgeImage(currentLevel)}
                              alt={`Level ${currentLevel} Badge`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 0 15px rgba(102, 126, 234, 0.3))'
                              }}
                            />
                          </Box>

                          {/* Right Badge (Next level) */}
                          <Box sx={{
                            width: 120,
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 1,
                            transform: 'translateY(10px) scale(0.85)',
                            opacity: 0.65
                          }}>
                            <img
                              src={getBadgeImage(rightLevel)}
                              alt={`Level ${rightLevel} Badge`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'grayscale(40%)'
                              }}
                            />
                          </Box>
                        </>
                      );
                    })()}
                  </Box>

                  <Typography variant="h5" sx={{
                    color: '#FFD700',
                    fontWeight: 800,
                    mb: 1,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
                  }}>
                    {(() => {
                      const views = analyticsData?.totalViews || 0;
                      let currentLevel = 1;
                      if (views >= 83333333) currentLevel = 6;
                      else if (views >= 66666666) currentLevel = 5;
                      else if (views >= 50000000) currentLevel = 4;
                      else if (views >= 33333333) currentLevel = 3;
                      else if (views >= 16666666) currentLevel = 2;

                      const badgeNames = {
                        1: 'BEGINNER',
                        2: 'APPRENTICE',
                        3: 'RISING STAR',
                        4: 'EXPERT',
                        5: 'MASTER',
                        6: 'LEGEND'
                      };

                      return badgeNames[currentLevel];
                    })()}
                  </Typography>
                  <Typography variant="body2" sx={{
                    color: '#888',
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }}>
                    Current Badge Level
                  </Typography>
                </Box>

                {/* Performance Card */}
                <Box sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                  p: 3,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }
                }}>
                  {/* Performance Title - Top Left */}
                  <Typography variant="body1" sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    mb: 2,
                    textAlign: 'left',
                    position: 'absolute',
                    top: 16,
                    left: 24,
                    zIndex: 2
                  }}>
                    Performance
                  </Typography>

                  {/* Bigger Radar Chart */}
                  <Box sx={{
                    height: 240,
                    width: '100%',
                    mt: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ReactECharts
                      option={{
                        backgroundColor: 'transparent',
                        radar: {
                          indicator: [
                            { name: 'Creativity', max: 100 },
                            { name: 'Teamwork', max: 100 },
                            { name: 'Problem Solving', max: 100 },
                            { name: 'Discipline', max: 100 },
                            { name: 'Curiosity', max: 100 }
                          ],
                          radius: 90,
                          center: ['50%', '50%'],
                          axisName: {
                            color: '#888',
                            fontSize: 11,
                            fontWeight: 500
                          },
                          splitLine: {
                            lineStyle: {
                              color: 'rgba(255, 255, 255, 0.15)',
                              width: 1
                            }
                          },
                          axisLine: {
                            lineStyle: {
                              color: 'rgba(255, 255, 255, 0.25)',
                              width: 1
                            }
                          },
                          splitArea: {
                            show: true,
                            areaStyle: {
                              color: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)']
                            }
                          }
                        },
                        series: [{
                          type: 'radar',
                          data: [{
                            value: [
                              Math.min(100, Math.max(20, (analyticsData?.avgVideoViews || 0) / 10000)),
                              Math.min(100, Math.max(20, (analyticsData?.totalSubmissions || 0) * 2)),
                              Math.min(100, Math.max(20, (analyticsData?.totalViews || 0) / 100000)),
                              Math.min(100, Math.max(20, 60 + Math.random() * 30)),
                              Math.min(100, Math.max(20, 50 + Math.random() * 40))
                            ],
                            areaStyle: {
                              color: {
                                type: 'radial',
                                x: 0.5,
                                y: 0.5,
                                r: 0.8,
                                colorStops: [
                                  { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                                  { offset: 1, color: 'rgba(118, 75, 162, 0.1)' }
                                ]
                              }
                            },
                            lineStyle: {
                              color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 1,
                                y2: 1,
                                colorStops: [
                                  { offset: 0, color: '#667eea' },
                                  { offset: 1, color: '#764ba2' }
                                ]
                              },
                              width: 3
                            },
                            symbol: 'circle',
                            symbolSize: 6,
                            itemStyle: {
                              color: {
                                type: 'linear',
                                x: 0,
                                y: 0,
                                x2: 1,
                                y2: 1,
                                colorStops: [
                                  { offset: 0, color: '#667eea' },
                                  { offset: 1, color: '#764ba2' }
                                ]
                              }
                            }
                          }]
                        }]
                      }}
                      style={{ height: '100%', width: '100%' }}
                    />
                  </Box>


                </Box>
              </Box>
            </Box>

            {/* Writer Leaderboard and Right Column Section */}
            <Box sx={{ mt: 6, mb: 4 }}>
              <Box sx={{
                display: 'flex',
                gap: 4,
                alignItems: 'flex-start',
                '@media (max-width: 960px)': {
                  flexDirection: 'column'
                }
              }}>
                {/* Writer Leaderboard */}
                <Box sx={{
                  flex: '1 1 45%',
                  '@media (max-width: 960px)': {
                    flex: '1 1 100%'
                  }
                }}>
                  <WriterLeaderboard currentWriterName={user?.name} />
                </Box>

                {/* Right Column - Daily Quest and Latest Content */}
                <Box sx={{
                  flex: '1 1 55%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  '@media (max-width: 960px)': {
                    flex: '1 1 100%'
                  }
                }}>
                  {/* Daily Quest */}
                  <Box sx={{
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                    overflow: 'hidden',
                    p: 2.5,
                    flex: '0 0 auto'
                  }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{
                        fontWeight: 700,
                        fontSize: '18px',
                        color: 'white'
                      }}>
                        Daily Quest
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{
                          color: '#667eea',
                          borderColor: '#667eea',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'none',
                          py: 0.5,
                          px: 1.5,
                          '&:hover': {
                            borderColor: '#764ba2',
                            color: '#764ba2',
                            background: 'rgba(102, 126, 234, 0.1)'
                          }
                        }}
                      >
                        Claim all
                      </Button>
                    </Box>

                    {/* Quest Item */}
                    <Box sx={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      p: 2,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.08)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        {/* Quest Icon */}
                        <Box sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Scroll size={20} color="white" />
                        </Box>

                        {/* Quest Content */}
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{
                            color: 'white',
                            fontWeight: 600,
                            mb: 0.5,
                            fontSize: '14px'
                          }}>
                            Complete 2 Scripts Today
                          </Typography>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <Typography variant="body2" sx={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              backgroundClip: 'text',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              fontWeight: 600,
                              fontSize: '12px'
                            }}>
                              +140 Exp
                            </Typography>

                            {/* Clickable Counter */}
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={incrementQuestProgress}
                              disabled={questProgress >= 2}
                              sx={{
                                minWidth: '32px',
                                width: '32px',
                                height: '24px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: questProgress >= 2 ? 'rgba(255, 255, 255, 0.5)' : '#667eea',
                                borderColor: questProgress >= 2 ? 'rgba(255, 255, 255, 0.3)' : '#667eea',
                                '&:hover': {
                                  borderColor: questProgress >= 2 ? 'rgba(255, 255, 255, 0.3)' : '#764ba2',
                                  color: questProgress >= 2 ? 'rgba(255, 255, 255, 0.5)' : '#764ba2',
                                  background: questProgress >= 2 ? 'transparent' : 'rgba(102, 126, 234, 0.1)'
                                }
                              }}
                            >
                              +
                            </Button>
                          </Box>

                          {/* Progress Bar */}
                          <Box sx={{ mb: 1.5 }}>
                            <Box sx={{
                              width: '100%',
                              height: 6,
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <Box sx={{
                                width: `${(questProgress / 2) * 100}%`, // Dynamic progress based on state
                                height: '100%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '3px',
                                transition: 'width 0.5s ease'
                              }} />
                            </Box>
                          </Box>

                          {/* Progress Text and Claim Button */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontSize: '12px'
                              }}>
                                {questProgress}/2 Completed
                              </Typography>

                              {/* Reset button for testing */}
                              <Button
                                variant="text"
                                size="small"
                                onClick={resetQuestProgress}
                                sx={{
                                  minWidth: 'auto',
                                  fontSize: '10px',
                                  color: 'rgba(255, 255, 255, 0.5)',
                                  textTransform: 'none',
                                  p: 0.5,
                                  '&:hover': {
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    background: 'rgba(255, 255, 255, 0.05)'
                                  }
                                }}
                              >
                                Reset
                              </Button>
                            </Box>

                            <Button
                              variant="contained"
                              size="small"
                              disabled={questProgress < 2} // Enabled when quest is complete
                              onClick={() => {
                                if (questProgress >= 2) {
                                  // Handle reward claim logic here
                                  console.log('Reward claimed!');
                                  // Could show notification, add to user stats, etc.
                                }
                              }}
                              sx={{
                                background: questProgress >= 2
                                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                  : 'rgba(255, 255, 255, 0.1)',
                                color: questProgress >= 2 ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'none',
                                borderRadius: '16px',
                                px: 1.5,
                                py: 0.5,
                                minWidth: 'auto',
                                '&:hover:not(:disabled)': {
                                  background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                                },
                                '&:disabled': {
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  color: 'rgba(255, 255, 255, 0.5)'
                                }
                              }}
                            >
                              ⭐ Claim Reward
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Latest Content */}
                  <Box sx={{
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                    overflow: 'hidden',
                    p: 2.5,
                    flex: '1 1 auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{
                          fontWeight: 700,
                          fontSize: '18px',
                          color: 'white'
                        }}>
                          Latest content
                        </Typography>
                        <Typography variant="body2" sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '14px',
                          ml: 0.5
                        }}>
                          ▶
                        </Typography>
                      </Box>
                    </Box>

                    {/* Content Area */}
                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {analyticsData.latestContent ? (
                      <>
                        {/* Compact Video Thumbnail */}
                        <Box sx={{ position: 'relative', mb: 2 }}>
                          {/* Viral indicator */}
                          {(analyticsData.latestContent.views || 0) >= 1000000 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: 'linear-gradient(45deg, #FFD700, #FF5722)',
                                zIndex: 10,
                                '&:before': {
                                  content: '"🎉"',
                                  position: 'absolute',
                                  top: -3,
                                  left: -3,
                                  fontSize: '12px'
                                }
                              }}
                            />
                          )}

                          <Box
                            component="img"
                            src={analyticsData.latestContent.highThumbnail || analyticsData.latestContent.mediumThumbnail || analyticsData.latestContent.thumbnail || analyticsData.latestContent.preview || `https://img.youtube.com/vi/${analyticsData.latestContent.url?.split('v=')[1] || analyticsData.latestContent.url?.split('/').pop()}/maxresdefault.jpg`}
                            sx={{
                              width: '100%',
                              height: 60,
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: (analyticsData.latestContent.views || 0) >= 3000000 ? '2px solid #FFD700' :
                                      (analyticsData.latestContent.views || 0) >= 1000000 ? '2px solid #FF5722' :
                                      (analyticsData.latestContent.views || 0) >= 500000 ? '2px solid #FF9800' : '2px solid #333',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer',
                              '&:hover': {
                                border: '2px solid #667eea',
                                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                                transform: 'scale(1.02)'
                              }
                            }}
                            onClick={() => analyticsData.latestContent.url && window.open(analyticsData.latestContent.url, '_blank')}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <Box
                            sx={{
                              width: '100%',
                              height: 60,
                              bgcolor: analyticsData.latestContent.type === 'short' ? '#4CAF50' : '#2196F3',
                              borderRadius: '8px',
                              border: '2px solid #333',
                              display: 'none',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '30px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                border: '2px solid #667eea',
                                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                                transform: 'scale(1.02)'
                              }
                            }}
                            onClick={() => analyticsData.latestContent.url && window.open(analyticsData.latestContent.url, '_blank')}
                          >
                            {analyticsData.latestContent.type === 'short' ? '🎯' : '📺'}
                          </Box>

                          {/* Compact Play Button */}
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #FFD700, #FFA000)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #FFA000, #FF8F00)',
                                transform: 'translate(-50%, -50%) scale(1.1)'
                              }
                            }}
                            onClick={() => analyticsData.latestContent.url && window.open(analyticsData.latestContent.url, '_blank')}
                          >
                            <Typography sx={{
                              color: 'white',
                              fontSize: '12px',
                              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                              marginLeft: '1px'
                            }}>
                              ▶
                            </Typography>
                          </Box>

                          {/* Duration Badge */}
                          {analyticsData.latestContent.duration && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 4,
                                right: 4,
                                bgcolor: 'rgba(0,0,0,0.9)',
                                color: 'white',
                                px: 1,
                                py: 0.25,
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600
                              }}
                            >
                              {analyticsData.latestContent.duration}
                            </Box>
                          )}

                          {/* Video Type Badge */}
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 4,
                              left: 4,
                              bgcolor: analyticsData.latestContent.type === 'short' ? '#4CAF50' : '#2196F3',
                              color: 'white',
                              px: 1,
                              py: 0.25,
                              borderRadius: '4px',
                              fontSize: '8px',
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}
                          >
                            {analyticsData.latestContent.type === 'short' ? 'SHORT' : 'VIDEO'}
                          </Box>
                        </Box>

                        {/* Compact Video Info */}
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="body2" sx={{
                            color: 'white',
                            fontWeight: 600,
                            mb: 1,
                            fontSize: '12px',
                            lineHeight: 1.2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {analyticsData.latestContent.title || 'Untitled Video'}
                          </Typography>

                          {/* Compact Stats */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="caption" sx={{ color: '#888', fontSize: '10px' }}>
                              👁 {(analyticsData.latestContent.views || 0).toLocaleString()}
                            </Typography>
                            {analyticsData.latestContent.engagement && (
                              <Typography variant="caption" sx={{ color: '#888', fontSize: '10px' }}>
                                💝 {analyticsData.latestContent.engagement.toFixed(1)}%
                              </Typography>
                            )}
                          </Box>

                          {/* Compact Achievement Badge */}
                          {(() => {
                            const views = analyticsData.latestContent.views || 0;
                            let badge = null;

                            if (views >= 3000000) badge = { icon: '👑', text: 'Mega Viral', color: '#FFD700' };
                            else if (views >= 1000000) badge = { icon: '🔥', text: 'Viral', color: '#FF5722' };
                            else if (views >= 500000) badge = { icon: '⭐', text: 'Rising', color: '#FF9800' };
                            else if (views >= 100000) badge = { icon: '📈', text: 'Growing', color: '#4CAF50' };

                            return badge ? (
                              <Box sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                bgcolor: `${badge.color}20`,
                                border: `1px solid ${badge.color}40`,
                                borderRadius: '12px',
                                px: 1,
                                py: 0.25,
                                mb: 1
                              }}>
                                <Typography sx={{ fontSize: '10px' }}>{badge.icon}</Typography>
                                <Typography variant="caption" sx={{
                                  color: badge.color,
                                  fontWeight: 600,
                                  fontSize: '9px'
                                }}>
                                  {badge.text}
                                </Typography>
                              </Box>
                            ) : null;
                          })()}
                        </Box>

                        {/* Compact Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate(`/content/video/${analyticsData.latestContent.id}`)}
                            sx={{
                              color: 'white',
                              borderColor: '#444',
                              textTransform: 'none',
                              flex: 1,
                              fontSize: '10px',
                              py: 0.5,
                              '&:hover': {
                                borderColor: '#667eea',
                                bgcolor: 'rgba(102, 126, 234, 0.1)'
                              }
                            }}
                          >
                            📊 Analytics
                          </Button>
                          {analyticsData.latestContent.url && (
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => window.open(analyticsData.latestContent.url, '_blank')}
                              sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                textTransform: 'none',
                                flex: 1,
                                fontSize: '10px',
                                py: 0.5,
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a5d87 100%)'
                                }
                              }}
                            >
                              🎬 Watch
                            </Button>
                          )}
                        </Box>
                      </>
                    ) : (
                      <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#888'
                      }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          No recent content found
                        </Typography>
                        <Typography variant="caption">
                          Upload a video to see it here
                        </Typography>
                      </Box>
                    )}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Top Content Section */}
            <Box sx={{ mt: 4 }}>
              <Box sx={{
                display: 'flex',
                gap: 4,
                alignItems: 'flex-start',
                '@media (max-width: 960px)': {
                  flexDirection: 'column'
                }
              }}>
                {/* Left Side - Your top content */}
                <Box sx={{
                  flex: '1 1 65%',
                  '@media (max-width: 960px)': {
                    flex: '1 1 100%'
                  }
                }}>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                    Your top content in this period
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Button
                      variant={contentFilter === 'all' ? 'contained' : 'outlined'}
                      onClick={() => handleContentFilterChange('all')}
                      sx={{
                        background: contentFilter === 'all' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: contentFilter === 'all' ? 'white' : '#888',
                        borderColor: contentFilter === 'all' ? 'transparent' : '#444',
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: contentFilter === 'all' ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                        '&:hover': {
                          bgcolor: contentFilter === 'all' ? '#D4A600' : 'rgba(255,255,255,0.05)',
                          borderColor: '#666'
                        }
                      }}
                    >
                      All Content
                    </Button>
                    <Button
                      variant={contentFilter === 'videos' ? 'contained' : 'outlined'}
                      onClick={() => handleContentFilterChange('videos')}
                      sx={{
                        background: contentFilter === 'videos' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: contentFilter === 'videos' ? 'white' : '#888',
                        borderColor: contentFilter === 'videos' ? 'transparent' : '#444',
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: contentFilter === 'videos' ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                        '&:hover': {
                          bgcolor: contentFilter === 'videos' ? '#D4A600' : 'rgba(255,255,255,0.05)',
                          borderColor: '#666'
                        }
                      }}
                    >
                      Videos
                    </Button>
                    <Button
                      variant={contentFilter === 'shorts' ? 'contained' : 'outlined'}
                      onClick={() => handleContentFilterChange('shorts')}
                      sx={{
                        background: contentFilter === 'shorts' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: contentFilter === 'shorts' ? 'white' : '#888',
                        borderColor: contentFilter === 'shorts' ? 'transparent' : '#444',
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: contentFilter === 'shorts' ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                        '&:hover': {
                          bgcolor: contentFilter === 'shorts' ? '#D4A600' : 'rgba(255,255,255,0.05)',
                          borderColor: '#666'
                        }
                      }}
                    >
                      Shorts
                    </Button>
                  </Box>

                  {/* Modern Content Grid */}
                  <Box>
                    {!analyticsData || !analyticsData.topVideos || analyticsData.topVideos.length === 0 ? (
                      <Box sx={{
                        textAlign: 'center',
                        py: 6,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                        borderRadius: '16px',
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Box sx={{
                          fontSize: '48px',
                          mb: 2,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}>
                          📊
                        </Box>
                        <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 600 }}>
                          {loading ? 'Loading your top content...' : 'No content available'}
                        </Typography>
                        {!loading && (
                          <Typography variant="body2" sx={{ color: '#888' }}>
                            Try adjusting the date range or check your content in the Content tab
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(analyticsData.topVideos || []).slice(0, 10).map((content, index) => (
                          <Box
                            key={content.id || index}
                            onClick={(event) => {
                              // Don't navigate if clicking on thumbnail
                              if (event.target.closest('.video-thumbnail-analytics')) {
                                return;
                              }
                              navigate(`/content/video/${content.id}`);
                            }}
                            sx={{
                              position: 'relative',
                              background: index === 0
                                ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                                : 'rgba(42, 42, 42, 0.8)',
                              borderRadius: '8px',
                              border: index === 0
                                ? '1px solid rgba(102, 126, 234, 0.3)'
                                : '1px solid #333',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              overflow: 'hidden',
                              backdropFilter: 'blur(10px)',
                              boxShadow: index === 0
                                ? '0 4px 16px rgba(102, 126, 234, 0.2)'
                                : '0 2px 8px rgba(0, 0, 0, 0.1)',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: index === 0
                                  ? '0 8px 24px rgba(102, 126, 234, 0.3)'
                                  : '0 6px 16px rgba(102, 126, 234, 0.2)',
                                border: '1px solid rgba(102, 126, 234, 0.4)',
                                '& .rank-badge': {
                                  transform: 'scale(1.05)'
                                },
                                '& .thumbnail': {
                                  transform: 'scale(1.02)'
                                },
                                '& .play-overlay': {
                                  opacity: 1
                                }
                              }
                            }}
                          >
                            {/* Top Performer Badge */}
                            {index === 0 && (
                              <Box sx={{
                                position: 'absolute',
                                top: -1,
                                right: 12,
                                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                color: '#000',
                                px: 1.5,
                                py: 0.25,
                                borderRadius: '0 0 8px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                zIndex: 2
                              }}>
                                🏆 #1
                              </Box>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, minHeight: '80px' }}>
                              {/* Compact Rank Badge */}
                              <Box
                                className="rank-badge"
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: index < 3
                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    : 'linear-gradient(135deg, #4a4a4a 0%, #2a2a2a 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  boxShadow: index < 3
                                    ? '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.2)',
                                  transition: 'all 0.2s ease',
                                  flexShrink: 0
                                }}
                              >
                                {index + 1}
                              </Box>

                              {/* Compact Thumbnail */}
                              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                                <Box
                                  className="video-thumbnail-analytics"
                                  component="img"
                                  src={content.highThumbnail || content.mediumThumbnail || content.thumbnail || content.preview || `https://img.youtube.com/vi/${content.url?.split('v=')[1] || content.url?.split('/').pop()}/maxresdefault.jpg`}
                                  sx={{
                                    width: 60,
                                    height: 34,
                                    borderRadius: '6px',
                                    objectFit: 'cover',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      transform: 'scale(1.05)',
                                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                                      border: '1px solid rgba(102, 126, 234, 0.5)'
                                    }
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (content.url) {
                                      window.open(content.url, '_blank');
                                    }
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <Box
                                  className="video-thumbnail-analytics"
                                  sx={{
                                    width: 60,
                                    height: 34,
                                    background: content.type === 'short'
                                      ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
                                      : 'linear-gradient(135deg, #2196F3 0%, #1976d2 100%)',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'none',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '16px',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      transform: 'scale(1.05)',
                                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                                      border: '1px solid rgba(102, 126, 234, 0.5)'
                                    }
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (content.url) {
                                      window.open(content.url, '_blank');
                                    }
                                  }}
                                >
                                  {content.type === 'short' ? '🎯' : '📺'}
                                </Box>

                                {/* Play Overlay */}
                                <Box
                                  className="play-overlay"
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.8)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'all 0.2s ease',
                                    backdropFilter: 'blur(10px)'
                                  }}
                                >
                                  <Typography sx={{ color: 'white', fontSize: '10px', ml: 0.25 }}>▶</Typography>
                                </Box>

                                {/* Duration Badge */}
                                {content.duration && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      right: 2,
                                      background: 'rgba(0, 0, 0, 0.9)',
                                      color: 'white',
                                      px: 0.5,
                                      py: 0.125,
                                      borderRadius: '3px',
                                      fontSize: '8px',
                                      fontWeight: 600
                                    }}
                                  >
                                    {content.duration}
                                  </Box>
                                )}

                                {/* Content Type Badge */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 2,
                                    left: 2,
                                    background: content.type === 'short'
                                      ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
                                      : 'linear-gradient(135deg, #2196F3 0%, #1976d2 100%)',
                                    color: 'white',
                                    px: 0.5,
                                    py: 0.125,
                                    borderRadius: '3px',
                                    fontSize: '7px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.25px'
                                  }}
                                >
                                  {content.type === 'short' ? 'S' : 'V'}
                                </Box>
                              </Box>

                              {/* Compact Content Info - Fixed Width */}
                              <Box sx={{
                                width: '220px',
                                minWidth: '220px',
                                maxWidth: '220px',
                                overflow: 'hidden'
                              }}>
                                <Typography variant="body2" sx={{
                                  color: 'white',
                                  fontWeight: 600,
                                  mb: 0.3,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: '12px',
                                  lineHeight: 1.2
                                }}>
                                  {content.title || 'Untitled Video'}
                                </Typography>

                                <Typography variant="caption" sx={{
                                  color: '#888',
                                  fontSize: '10px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'block'
                                }}>
                                  {content.type && (
                                    <Box component="span" sx={{ mr: 0.5 }}>
                                      {content.type === 'short' ? '📱' : '🎬'} •
                                    </Box>
                                  )}
                                  {content.account_name || 'Unknown Account'} • {content.posted_date ? new Date(content.posted_date).toLocaleDateString() : 'Unknown'}
                                </Typography>
                              </Box>

                              {/* Spacer */}
                              <Box sx={{ flex: 1 }} />

                              {/* Far Right Metrics - Compact */}
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                flexShrink: 0
                              }}>
                                {/* Views */}
                                <Box sx={{ textAlign: 'right', minWidth: 50 }}>
                                  <Typography variant="body2" sx={{
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                  }}>
                                    {formatNumber(content.views)}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '8px' }}>
                                    views
                                  </Typography>
                                </Box>

                                {/* Engagement */}
                                <Box sx={{ textAlign: 'right', minWidth: 55 }}>
                                  <Typography variant="body2" sx={{
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '11px'
                                  }}>
                                    {content.likes && content.views ?
                                      ((content.likes / content.views) * 100).toFixed(1) + '%' :
                                      'N/A'
                                    }
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#888', fontSize: '8px' }}>
                                    {content.likes?.toLocaleString() || '0'} likes
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* See More Button */}
                  <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <Button
                      variant="outlined"
                      onClick={() => window.location.href = '/content'}
                      sx={{
                        color: 'white',
                        borderColor: '#444',
                        textTransform: 'none',
                        '&:hover': { borderColor: '#666', bgcolor: 'rgba(255,255,255,0.05)' }
                      }}
                    >
                      See more in Content
                    </Button>
                  </Box>
                </Box>

                {/* Right Side - Empty for now */}
                <Box sx={{
                  flex: '1 1 35%',
                  '@media (max-width: 960px)': {
                    flex: '1 1 100%'
                  }
                }}>
                  {/* This space can be used for other widgets in the future */}
                </Box>
              </Box>
            </Box>
              </>
            )}

            {/* Trends Tab */}
            {tabValue === 1 && (
              <Box>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 4 }}>
                  Performance Trends
                </Typography>

                {/* Trend Cards */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
                  gap: 3,
                  mb: 4
                }}>
                  {/* Views Trend */}
                  <Card sx={{ bgcolor: '#2A2A2A', border: '1px solid #333' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
                        Views Trend
                      </Typography>
                      <Typography variant="h4" sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 1
                      }}>
                        {analyticsData.summary?.trend === 'up' ? '↗️' : '↘️'} {analyticsData.summary?.trend === 'up' ? '+' : '-'}
                        {Math.abs(((analyticsData.summary?.highestDay || 0) - (analyticsData.summary?.lowestDay || 0)) / (analyticsData.summary?.lowestDay || 1) * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#888' }}>
                        {analyticsData.summary?.trend === 'up' ? 'Trending upward' : 'Needs attention'}
                      </Typography>
                    </CardContent>
                  </Card>

                  {/* Daily Average */}
                  <Card sx={{ bgcolor: '#2A2A2A', border: '1px solid #333' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
                        Daily Average
                      </Typography>
                      <Typography variant="h4" sx={{ color: '#4CAF50', mb: 1 }}>
                        {formatNumber(analyticsData.avgDailyViews || 0)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#888' }}>
                        Views per day
                      </Typography>
                    </CardContent>
                  </Card>

                  {/* Best Performance */}
                  <Card sx={{ bgcolor: '#2A2A2A', border: '1px solid #333' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
                        Peak Day
                      </Typography>
                      <Typography variant="h4" sx={{ color: '#2196F3', mb: 1 }}>
                        {formatNumber(analyticsData.summary?.highestDay || 0)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#888' }}>
                        Best single day
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                {/* Monthly Submissions Chart */}
                {analyticsData.monthlySubmissions && analyticsData.monthlySubmissions.length > 0 && (
                  <Card sx={{ bgcolor: '#2A2A2A', border: '1px solid #333', mb: 4 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
                        Monthly Submissions Trend
                      </Typography>
                      <Box sx={{
                        display: 'flex',
                        gap: 2,
                        overflowX: 'auto',
                        pb: 2
                      }}>
                        {analyticsData.monthlySubmissions.map((month, index) => (
                          <Box key={index} sx={{
                            minWidth: 120,
                            textAlign: 'center',
                            p: 2,
                            bgcolor: '#333',
                            borderRadius: 1
                          }}>
                            <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                              {month.month}
                            </Typography>
                            <Typography variant="h5" sx={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              mb: 1
                            }}>
                              {month.submissions}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#4CAF50' }}>
                              {month.accepted} published
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Activity */}
                {analyticsData.recentActivity && analyticsData.recentActivity.length > 0 && (
                  <Card sx={{ bgcolor: '#2A2A2A', border: '1px solid #333' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
                        Recent Activity
                      </Typography>
                      <Box>
                        {analyticsData.recentActivity.map((activity, index) => (
                          <Box key={index} sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            p: 2,
                            mb: 1,
                            bgcolor: '#333',
                            borderRadius: 1
                          }}>
                            <Box sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: activity.action.includes('Published') ? '#4CAF50' : '#667eea'
                            }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ color: 'white' }}>
                                {activity.action}: {activity.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#888' }}>
                                {activity.date}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Video Details Modal */}
      <VideoDetailsModal
        open={modalOpen}
        onClose={handleCloseVideoModal}
        category={modalCategory}
        videos={modalVideos}
        loading={modalLoading}
      />
    </Layout>
  );
};

export default Analytics;
