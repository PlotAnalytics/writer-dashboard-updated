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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import Layout from '../components/Layout.jsx';
import { buildApiUrl, API_CONFIG } from '../config/api.js';
import RealtimeWidget from '../components/RealtimeWidget';

// Utility functions like WriterAnalytics.jsx
const formatNumber = (value) => {
  if (typeof value !== "number") return "N/A";
  return Math.round(value).toLocaleString(); // Round to the nearest integer and format with commas
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
      let writerId = localStorage.getItem('writerId') || '110';

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

      // Fetch overview data from BigQuery (includes chart data and total views)
      // Add strong cache-busting parameters to force fresh data
      const cacheBuster = Date.now();
      const randomId = Math.random().toString(36).substring(7);

      // Build URL with proper parameters for custom date ranges
      let apiUrl = `${buildApiUrl(API_CONFIG.ENDPOINTS.ANALYTICS.OVERVIEW)}?range=${dateRange}&_t=${cacheBuster}&_r=${randomId}&force_refresh=true`;

      // If it's a custom date range, extract and add start_date and end_date parameters
      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          apiUrl += `&start_date=${startDate}&end_date=${endDate}`;
          console.log(`📅 Adding custom date parameters: start_date=${startDate}, end_date=${endDate}`);
        }
      }

      console.log(`📊 Fetching from URL: ${apiUrl}`);

      const overviewResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      let overviewData = {};
      if (overviewResponse.ok) {
        overviewData = await overviewResponse.json();
        console.log('📊 BigQuery Overview data received:', {
          totalViews: overviewData.totalViews,
          totalSubmissions: overviewData.totalSubmissions,
          chartDataPoints: overviewData.chartData?.length || 0,
          aggregatedViewsDataPoints: overviewData.aggregatedViewsData?.length || 0
        });
      } else {
        const errorText = await overviewResponse.text();
        console.error('❌ Analytics API error:', {
          status: overviewResponse.status,
          statusText: overviewResponse.statusText,
          error: errorText
        });
        throw new Error(`API Error: ${overviewResponse.status} - ${errorText}`);
      }

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

          console.log('✅ Using BigQuery DAILY TOTALS (filtered in query - last 3 days excluded):', {
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
    }
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
      let writerId = localStorage.getItem('writerId') || '110';

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

      // Add strong cache-busting parameters to force fresh data
      const cacheBuster = Date.now();
      const randomId = Math.random().toString(36).substring(7);

      // Build URL with explicit custom date parameters
      let apiUrl = `${buildApiUrl(API_CONFIG.ENDPOINTS.ANALYTICS.OVERVIEW)}?range=custom&_t=${cacheBuster}&_r=${randomId}&force_refresh=true`;
      apiUrl += `&start_date=${startDate}&end_date=${endDate}`;

      console.log(`📊 Fetching from URL with custom dates: ${apiUrl}`);

      const overviewResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      let overviewData = {};
      if (overviewResponse.ok) {
        overviewData = await overviewResponse.json();
        console.log('📊 BigQuery Overview data received for custom range:', {
          totalViews: overviewData.totalViews,
          totalSubmissions: overviewData.totalSubmissions,
          chartDataPoints: overviewData.chartData?.length || 0,
          aggregatedViewsDataPoints: overviewData.aggregatedViewsData?.length || 0,
          dateRange: `${startDate} to ${endDate}`
        });
      } else {
        const errorText = await overviewResponse.text();
        console.error('❌ Analytics API error:', {
          status: overviewResponse.status,
          statusText: overviewResponse.statusText,
          error: errorText
        });
        throw new Error(`API Error: ${overviewResponse.status} - ${errorText}`);
      }

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

        console.log('✅ Using BigQuery data for custom range (filtered in query - last 3 days excluded):', {
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

      // Combine all data
      const combinedData = {
        ...overviewData,
        totalViews: totalViews,
        chartData: chartData,
        aggregatedViewsData: viewsData,
        topVideos: topVideosData || [],
        latestContent: latestContentData,
        avgDailyViews: chartData.length > 0 ? Math.round(totalViews / chartData.length) : 0,
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
      let writerId = localStorage.getItem('writerId') || '110';

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

  // Fetch top content with explicit custom range parameters
  const fetchTopContentWithCustomRange = async (filterType = contentFilter, customRange, startDate, endDate) => {
    try {
      const token = localStorage.getItem('token');
      let writerId = localStorage.getItem('writerId') || '110';

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
      let writerId = localStorage.getItem('writerId') || '110';

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

      // Immediately fetch analytics with the custom range (don't wait for state update)
      try {
        await fetchAnalyticsWithCustomRange(customRange, customStartDate, endDate);
        console.log('🎉 Custom range analytics data updated successfully!');
      } catch (error) {
        console.error("Error fetching data for custom range:", error);
        setError("Failed to load data for custom date range");
      } finally {
        setIsChartLoading(false);
      }
    }
  };

  // Fetch analytics with explicit custom range parameters
  const fetchAnalyticsWithCustomRange = async (customRange, startDate, endDate) => {
    console.log('🔥 fetchAnalyticsWithCustomRange called with:', { customRange, startDate, endDate });
    setError(null);

    try {
      const token = localStorage.getItem('token');
      let writerId = localStorage.getItem('writerId') || '110';

      if (!token) {
        setError('Please log in to view analytics');
        return;
      }

      console.log('📊 Fetching analytics data for custom range:', { customRange, startDate, endDate, writerId });

      // Build URL with custom date parameters
      const cacheBuster = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      let apiUrl = `${buildApiUrl(API_CONFIG.ENDPOINTS.ANALYTICS.OVERVIEW)}?range=${customRange}&_t=${cacheBuster}&_r=${randomId}&force_refresh=true`;
      apiUrl += `&start_date=${startDate}&end_date=${endDate}`;

      console.log(`📊 Fetching from custom URL: ${apiUrl}`);

      const overviewResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json();
        console.log('📊 Custom range BigQuery Overview data received:', {
          totalViews: overviewData.totalViews,
          chartDataPoints: overviewData.chartData?.length || 0,
          aggregatedViewsDataPoints: overviewData.aggregatedViewsData?.length || 0
        });

        // Fetch top content with custom date range (pass the custom range explicitly)
        const topVideosData = await fetchTopContentWithCustomRange(contentFilter, customRange, startDate, endDate);
        const latestContentData = await fetchLatestContent();

        // Combine data
        const combinedData = {
          ...overviewData,
          topVideos: topVideosData || [],
          latestContent: latestContentData,
          avgDailyViews: overviewData.aggregatedViewsData?.length > 0 ?
            Math.round(overviewData.totalViews / overviewData.aggregatedViewsData.length) : 0,
          summary: {
            progressToTarget: (overviewData.totalViews / 100000000) * 100,
            highestDay: overviewData.aggregatedViewsData?.length > 0 ?
              Math.max(...overviewData.aggregatedViewsData.map(d => d.views)) : 0,
            lowestDay: overviewData.aggregatedViewsData?.length > 0 ?
              Math.min(...overviewData.aggregatedViewsData.map(d => d.views)) : 0
          }
        };

        setAnalyticsData(combinedData);
        console.log('🎉 Custom range analytics data updated successfully!');

        // Special logging for single date ranges
        if (startDate === endDate) {
          console.log('📅 SINGLE DATE APPLIED:', startDate);
          console.log('📊 Single date chart data:', combinedData.aggregatedViewsData);
          console.log('📊 Chart will show:', combinedData.aggregatedViewsData?.length || 0, 'data points');
          console.log('📊 Top content filtered for date:', topVideosData?.length || 0, 'videos');
        }
      } else {
        throw new Error(`API responded with status ${overviewResponse.status}`);
      }
    } catch (err) {
      console.error('❌ Custom range Analytics API error:', err);
      setError(`Failed to load analytics data: ${err.message}`);
    }
  };



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
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Channel analytics
          </Typography>

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
                  console.log('🔄 FRONTEND: FORCE REFRESH - Clearing all caches and fetching new data...');
                  console.log('🔄 FRONTEND: Using NEW SIMPLIFIED Analytics with duplicate date summing');
                  // Clear any cached data
                  setAnalyticsData(null);
                  setError(null);
                  // Force refresh with new data
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
                {/* Main Stats */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h3" sx={{
                color: 'white',
                fontWeight: 700,
                mb: 1,
                textAlign: 'center'
              }}>
                You got {formatNumber(analyticsData.totalViews || 0)} views in the {getDateRangeLabel()}
              </Typography>

              {/* Progress to Target */}
              {analyticsData.summary?.progressToTarget !== undefined && (
                <Box sx={{ maxWidth: 600, mx: 'auto', mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Progress to 100M views
                    </Typography>
                    <Typography variant="body2" sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: 600
                    }}>
                      {analyticsData.summary.progressToTarget.toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(analyticsData.summary.progressToTarget, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: '#333',
                      '& .MuiLinearProgress-bar': {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 4
                      }
                    }}
                  />
                </Box>
              )}

             
              {/* Additional Stats Row */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 4,
                mb: 3,
                flexWrap: 'wrap'
              }}>
                {analyticsData.totalLikes !== undefined && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#E91E63', fontWeight: 600 }}>
                      {formatNumber(analyticsData.totalLikes)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Total Likes
                    </Typography>
                  </Box>
                )}
                {analyticsData.totalComments !== undefined && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#9C27B0', fontWeight: 600 }}>
                      {formatNumber(analyticsData.totalComments)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Total Comments
                    </Typography>
                  </Box>
                )}
                {(analyticsData.totalSubmissions !== undefined || analyticsData.topVideos?.length) && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: 600
                    }}>
                      {analyticsData.totalSubmissions || analyticsData.topVideos?.length || 50}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Total Submissions
                    </Typography>
                  </Box>
                )}
                {(analyticsData.acceptedSubmissions !== undefined || analyticsData.topVideos?.length) && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                      {analyticsData.acceptedSubmissions || analyticsData.topVideos?.length || 50}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Published Videos
                    </Typography>
                  </Box>
                )}
                {(analyticsData.acceptanceRate !== undefined || analyticsData.topVideos?.length) && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#2196F3', fontWeight: 600 }}>
                      {analyticsData.acceptanceRate ||
                        (analyticsData.topVideos?.length && analyticsData.totalSubmissions ?
                          Math.round((analyticsData.topVideos.length / analyticsData.totalSubmissions) * 100) :
                          100)}%
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Success Rate
                    </Typography>
                  </Box>
                )}
                {analyticsData.avgDailyViews !== undefined && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: '#FF9800', fontWeight: 600 }}>
                      {formatNumber(analyticsData.avgDailyViews)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      Daily Average
                    </Typography>
                  </Box>
                )}
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
                        const dataIndex = params[0]?.dataIndex;
                        const dailyTotalPoint = analyticsData.aggregatedViewsData?.[dataIndex];

                        if (!dailyTotalPoint) {
                          const date = params[0]?.axisValue || 'N/A';
                          const value = params[0]?.value || 0;
                          const formattedValue = formatNumber(value);
                          return `
                            <div style="min-width: 200px;">
                              <div style="font-size: 12px; color: #ccc;">${date}</div>
                              <div style="font-size: 18px, font-weight: 600; color: #fff;">${formattedValue} views</div>
                            </div>
                          `;
                        }

                        const date = dailyTotalPoint.time;
                        const views = formatNumber(dailyTotalPoint.views);
                        const uniqueVideos = dailyTotalPoint.unique_videos || 0;

                        // Check data source
                        const isBigQuery = dailyTotalPoint.source === 'BigQuery_Daily_Totals' || dailyTotalPoint.source === 'BigQuery_Daily_Totals_Filtered_In_Query' || !dailyTotalPoint.source?.includes('InfluxDB');
                        const isInfluxDB = dailyTotalPoint.source === 'InfluxDB_Hourly_Aggregation' || dailyTotalPoint.source?.includes('InfluxDB');

                        const statusIndicator = isInfluxDB
                          ? '<div style="font-size: 11px; color: #FF9800; margin-top: 4px;">📊 Rough Estimate (Real-time)</div>'
                          : '<div style="font-size: 11px; color: #4fc3f7; margin-top: 4px;">✅ YouTube Analytics (Confirmed)</div>';

                        return `
                          <div style="min-width: 250px; max-width: 350px;">
                            <div style="font-size: 12px; color: #ccc; margin-bottom: 4px;">${dayjs(date).format('MMM D, YYYY')}</div>
                            <div style="font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 6px;">${views} total views</div>
                            <div style="font-size: 12px; color: #888;">${uniqueVideos} videos posted</div>
                            ${statusIndicator}
                          </div>
                        `;
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
                      data: analyticsData.aggregatedViewsData?.map(item => formatDate(item.time)) || [],
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

                      // Multiple dates - separate BigQuery and InfluxDB data
                      const bigQueryData = [];
                      const influxData = [];

                      // Find the split point between BigQuery and InfluxDB data
                      let splitIndex = -1;
                      for (let i = 0; i < data.length; i++) {
                        const isInfluxDB = data[i].source === 'InfluxDB_Hourly_Aggregation' || data[i].source?.includes('InfluxDB');
                        if (isInfluxDB) {
                          splitIndex = i;
                          break;
                        }
                      }

                      data.forEach((item, index) => {
                        const isBigQuery = item.source === 'BigQuery_Daily_Totals' || item.source === 'BigQuery_Daily_Totals_Filtered_In_Query' || !item.source?.includes('InfluxDB');
                        const isInfluxDB = item.source === 'InfluxDB_Hourly_Aggregation' || item.source?.includes('InfluxDB');

                        if (isBigQuery) {
                          // BigQuery data (solid line)
                          bigQueryData.push(item.views);
                          // For InfluxDB array: put null except for the last BigQuery point to connect
                          if (splitIndex !== -1 && index === splitIndex - 1) {
                            influxData.push(item.views); // Connect the lines at transition point
                          } else {
                            influxData.push(null);
                          }
                        } else if (isInfluxDB) {
                          // InfluxDB data (dotted line)
                          influxData.push(item.views);
                          bigQueryData.push(null); // null to break the solid line
                        } else {
                          // Default to BigQuery if source is unclear
                          bigQueryData.push(item.views);
                          influxData.push(null);
                        }
                      });

                      const series = [];

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

                      // Add InfluxDB series (dotted line) if there's data
                      if (influxData.some(val => val !== null)) {
                        series.push({
                          name: 'Rough Estimate',
                          data: influxData,
                          type: 'line',
                          smooth: true,
                          lineStyle: {
                            color: '#FF9800',
                            width: 3,
                            type: 'dashed' // Dotted line for InfluxDB data
                          },
                          symbol: 'circle',
                          symbolSize: 8, // Slightly larger for InfluxDB data
                          itemStyle: {
                            color: '#FF9800', // Orange for InfluxDB data
                            borderColor: '#fff',
                            borderWidth: 1
                          },
                          connectNulls: true
                        });
                      }

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

            {/* Top Content Section */}
            <Box sx={{ mt: 6 }}>
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

                {/* Right Side - Podcasts and Latest Content */}
                <Box sx={{
                  flex: '1 1 35%',
                  '@media (max-width: 960px)': {
                    flex: '1 1 100%'
                  }
                }}>
                  {/* Performance Summary Section */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                      Performance Summary
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: '#2A2A2A',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        p: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Average Daily Views
                        </Typography>
                        <Typography variant="body2" sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          fontWeight: 600
                        }}>
                          {formatNumber(analyticsData.avgDailyViews || 0)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Best Day
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                          {formatNumber(analyticsData.summary?.highestDay || 0)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Total Likes
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#E91E63', fontWeight: 600 }}>
                          {formatNumber(analyticsData.totalLikes || 0)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Total Comments
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#9C27B0', fontWeight: 600 }}>
                          {formatNumber(analyticsData.totalComments || 0)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Total Videos
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#2196F3', fontWeight: 600 }}>
                          {analyticsData.topVideos?.length || analyticsData.totalSubmissions || 0}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          Progress to Target
                        </Typography>
                        <Typography variant="body2" sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          fontWeight: 600
                        }}>
                          {analyticsData.summary?.progressToTarget?.toFixed(1) || 0}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Latest Content Section */}
                  <Box>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                      Latest content
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: '#2A2A2A',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        p: 2
                      }}
                    >
                      {analyticsData.latestContent ? (
                        <>
                          {/* Enhanced Video Thumbnail with Preview */}
                          <Box sx={{ position: 'relative', mb: 3 }}>
                            <Box
                              className="video-thumbnail-analytics-large"
                              component="img"
                              src={analyticsData.latestContent.highThumbnail || analyticsData.latestContent.mediumThumbnail || analyticsData.latestContent.thumbnail || analyticsData.latestContent.preview || `https://img.youtube.com/vi/${analyticsData.latestContent.url?.split('v=')[1] || analyticsData.latestContent.url?.split('/').pop()}/maxresdefault.jpg`}
                              sx={{
                                width: '100%',
                                height: 140,
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '2px solid #333',
                                transition: 'all 0.2s ease',
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
                              className="video-thumbnail-analytics-large"
                              sx={{
                                width: '100%',
                                height: 140,
                                bgcolor: analyticsData.latestContent.type === 'short' ? '#4CAF50' : '#2196F3',
                                borderRadius: '8px',
                                border: '2px solid #333',
                                display: 'none',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '50px',
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

                            {/* Play Button Overlay */}
                            <Box
                              sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 50,
                                height: 50,
                                bgcolor: 'rgba(0,0,0,0.8)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  bgcolor: 'rgba(228,184,0,0.9)',
                                  transform: 'translate(-50%, -50%) scale(1.1)'
                                }
                              }}
                              onClick={() => analyticsData.latestContent.url && window.open(analyticsData.latestContent.url, '_blank')}
                            >
                              <Typography sx={{ color: 'white', fontSize: '20px' }}>▶</Typography>
                            </Box>

                            {/* Duration Badge */}
                            {analyticsData.latestContent.duration && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 8,
                                  right: 8,
                                  bgcolor: 'rgba(0,0,0,0.9)',
                                  color: 'white',
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: '6px',
                                  fontSize: '12px',
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
                                top: 8,
                                left: 8,
                                bgcolor: analyticsData.latestContent.type === 'short' ? '#4CAF50' : '#2196F3',
                                color: 'white',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'uppercase'
                              }}
                            >
                              {analyticsData.latestContent.type === 'short' ? 'SHORT' : 'VIDEO'}
                            </Box>
                          </Box>

                          {/* Video Title */}
                          <Typography variant="body2" sx={{
                            color: 'white',
                            fontWeight: 600,
                            mb: 2,
                            fontSize: '15px',
                            lineHeight: 1.4
                          }}>
                            {analyticsData.latestContent.title || 'Untitled Video'}
                          </Typography>

                          {/* Video Stats - matching Content tab format */}
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: '#888' }}>Account</Typography>
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                {analyticsData.latestContent.account_name || 'Unknown Account'}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: '#888' }}>Views</Typography>
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                {formatNumber(analyticsData.latestContent.views || 0)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: '#888' }}>Engagement</Typography>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, display: 'block' }}>
                                  {analyticsData.latestContent.likes && analyticsData.latestContent.views ?
                                    ((analyticsData.latestContent.likes / analyticsData.latestContent.views) * 100).toFixed(1) + '%' :
                                    'N/A'
                                  }
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#888' }}>
                                  {analyticsData.latestContent.likes?.toLocaleString() || '0'} likes
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: '#888' }}>Stayed to Watch</Typography>
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                {analyticsData.latestContent.stayedToWatch ?
                                  `${analyticsData.latestContent.stayedToWatch.toFixed(1)}%` :
                                  'N/A'
                                }
                              </Typography>
                            </Box>
                          </Box>

                          {/* YouTube URL */}
                          {analyticsData.latestContent.url && (
                            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#333', borderRadius: '6px' }}>
                              <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                                YouTube URL:
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  '&:hover': { textDecoration: 'underline' }
                                }}
                                onClick={() => window.open(analyticsData.latestContent.url, '_blank')}
                              >
                                {analyticsData.latestContent.url.length > 40 ?
                                  analyticsData.latestContent.url.substring(0, 40) + '...' :
                                  analyticsData.latestContent.url
                                }
                              </Typography>
                            </Box>
                          )}

                          {/* Publication Date */}
                          <Typography variant="caption" sx={{ color: '#888', mb: 3, display: 'block' }}>
                            {analyticsData.latestContent.posted_date ?
                              `Published ${new Date(analyticsData.latestContent.posted_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}` :
                              'Recently published'
                            }
                          </Typography>

                          {/* Action Buttons */}
                          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => navigate(`/content/video/${analyticsData.latestContent.id}`)}
                              sx={{
                                color: 'white',
                                borderColor: '#444',
                                textTransform: 'none',
                                flex: 1,
                                '&:hover': { borderColor: '#666', bgcolor: 'rgba(255,255,255,0.05)' }
                              }}
                            >
                              Analytics
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
                                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                                  '&:hover': { bgcolor: '#D4A600' }
                                }}
                              >
                                Watch
                              </Button>
                            )}
                          </Box>

                          {/* Footer Info */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#888' }}>
                              Latest of {analyticsData.totalSubmissions || 0} videos
                            </Typography>
                            <Typography variant="caption" sx={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              fontWeight: 600
                            }}>
                              LATEST
                            </Typography>
                          </Box>
                        </>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                            No recent content available
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            Latest videos will appear here when posted
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
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
    </Layout>
  );
};

export default Analytics;
