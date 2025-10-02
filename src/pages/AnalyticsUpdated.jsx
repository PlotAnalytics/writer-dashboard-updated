import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  Select,
  MenuItem,
  Button,
  Alert,
  useMediaQuery,
  useTheme,
  LinearProgress,
  Grid,
  GlobalStyles,
  IconButton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import Layout from '../components/Layout.jsx';
import { buildApiUrl } from '../config/api.js';
import RealtimeWidget from '../components/RealtimeWidget.jsx';
import WriterLeaderboard from '../components/WriterLeaderboard.jsx';
import TopContentCarousel from '../components/TopContentCarousel.jsx';
import BigHeadAvatar from '../components/BigHeadAvatar.jsx';
import VideoDetailsModal from '../components/VideoDetailsModal.jsx';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi } from '../utils/simpleApi.js';

// Glassmorphism Animation Styles
const glassmorphismStyles = (
  <GlobalStyles
    styles={{
      '@keyframes shimmer': {
        '0%': {
          transform: 'translateX(-100%)'
        },
        '100%': {
          transform: 'translateX(100%)'
        }
      },
      '@keyframes float': {
        '0%, 100%': {
          transform: 'translateY(0px)'
        },
        '50%': {
          transform: 'translateY(-10px)'
        }
      }
    }}
  />
);

// Badge assets
import level1Badge from '../assets/level_1.png';
import level2Badge from '../assets/level_2.png';
import level3Badge from '../assets/level_3.png';
import level4Badge from '../assets/level_4.png';
import level5Badge from '../assets/level_5.png';
import level6Badge from '../assets/level_6.png';

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

// Utility function to format numbers
const formatNumber = (value) => {
  if (typeof value !== "number") return "N/A";
  return Math.round(value).toLocaleString();
};

const getDateRangeLabel = () => {
  const option = dateRangeOptions.find(opt => opt.value === dateRange);
  return option ? option.label : dateRange;
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
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const year = clickedDate.getFullYear();
    const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;

    if (!isSelecting || !selectedStart) {
      setSelectedStart(dateString);
      setSelectedEnd(dateString);
      setIsSelecting(true);
    } else {
      const startDateObj = new Date(selectedStart);
      if (clickedDate < startDateObj) {
        setSelectedStart(dateString);
        setSelectedEnd(selectedStart);
        onDateSelect(dateString, selectedStart);
      } else {
        setSelectedEnd(dateString);
        onDateSelect(selectedStart, dateString);
      }
      setIsSelecting(false);
    }
  };

  const isDateInRange = (day) => {
    if (!selectedStart || !selectedEnd) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const start = new Date(selectedStart);
    const end = new Date(selectedEnd);
    return date >= start && date <= end;
  };

  const isDateSelected = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateString === selectedStart || dateString === selectedEnd;
  };

  const isToday = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === today.toDateString();
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<Box key={`empty-${i}`} sx={{ height: '36px' }} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const selected = isDateSelected(day);
      const inRange = isDateInRange(day);
      const isCurrentDay = isToday(day);

      days.push(
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
                : isCurrentDay
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'transparent',
            border: isCurrentDay && !selected ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
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
    }

    return days;
  };

  return (
    <Box sx={{
      background: 'rgba(30, 30, 50, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      p: 3,
      minWidth: '320px'
    }}>
      {/* Month Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button
          onClick={() => navigateMonth(-1)}
          sx={{ color: 'white', minWidth: 'auto', p: 1 }}
        >
          ←
        </Button>
        <Typography sx={{ color: 'white', fontWeight: 600 }}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Typography>
        <Button
          onClick={() => navigateMonth(1)}
          sx={{ color: 'white', minWidth: 'auto', p: 1 }}
        >
          →
        </Button>
      </Box>

      {/* Day Headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {dayNames.map(day => (
          <Box key={day} sx={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            fontWeight: 500,
            py: 1
          }}>
            {day}
          </Box>
        ))}
      </Box>

      {/* Calendar Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {renderCalendarDays()}
      </Box>
    </Box>
  );
};

const AnalyticsUpdated = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();

  // State management
  const [analyticsData, setAnalyticsData] = useState(null);
  const [realtimeData, setRealtimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('last30days');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [leaderboardPeriod, setLeaderboardPeriod] = useState('7d');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [contentFilter, setContentFilter] = useState('all'); // 'all', 'videos', 'shorts'
  const [streakStats, setStreakStats] = useState({ streak: 0, postedScripts: 0 });
  const [hoveredBar, setHoveredBar] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [progressAnimation, setProgressAnimation] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false); // Track if animation has started
  const [pageFullyLoaded, setPageFullyLoaded] = useState(false); // Track if page is fully loaded
  const animationTimerRef = useRef(null); // Track animation timer

  // Debug: Track progressAnimation changes
  useEffect(() => {
    console.log('🎯 State: progressAnimation changed to', progressAnimation, '%');
  }, [progressAnimation]);

  // Track when page is fully loaded (loading screen disappears)
  useEffect(() => {
    if (!loading && !pageFullyLoaded) {
      console.log('🎯 Page: Loading screen disappeared, page is now fully loaded');
      setPageFullyLoaded(true);
    }
  }, [loading, pageFullyLoaded]);
  const [monthlyBonusData, setMonthlyBonusData] = useState({ totalBonus: 0, progress: 0, nextMilestone: 55 });
  const [scriptSubmissionData, setScriptSubmissionData] = useState({});







  // Modal states for video details
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Date range options
  const dateRangeOptions = [
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'last30days', label: 'Last 30 days' },
    { value: 'last90days', label: 'Last 90 days' },
    { value: 'last365days', label: 'Last 365 days' },
    { value: 'lifetime', label: 'Lifetime' },
    { value: '2025', label: '2025' },
    { value: '2024', label: '2024' },
    { value: 'custom', label: 'Custom' }
  ];

  const getDateRangeLabel = () => {
    // Handle custom date ranges
    if (dateRange.startsWith('custom_')) {
      const parts = dateRange.split('_');
      if (parts.length === 3) {
        const startDate = parts[1];
        const endDate = parts[2];
        // Format dates nicely - USE UTC TO AVOID TIMEZONE ISSUES
        const formatDate = (dateStr) => {
          // Parse date string as UTC to ensure consistency across timezones
          const parts = dateStr.split('-');
          const date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));

          // Use UTC methods to avoid timezone conversion
          const month = date.getUTCMonth();
          const day = date.getUTCDate();
          const year = date.getUTCFullYear();

          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

          return `${monthNames[month]} ${day}, ${year}`;
        };
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      }
    }

    const option = dateRangeOptions.find(opt => opt.value === dateRange);
    return option ? option.label : dateRange;
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

      // Add cache-busting parameter to force fresh data
      url += `&_t=${Date.now()}`;

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

  // Calculate bonus based on monthly views
  const calculateBonus = (monthlyViews) => {
    const viewsInMillions = monthlyViews / 1000000;
    let totalBonus = 0;
    let nextMilestone = 55;
    let progress = 0;

    // Bonus tiers
    const tiers = [
      { threshold: 55, bonus: 250, cumulative: 250 },
      { threshold: 60, bonus: 250, cumulative: 500 },
      { threshold: 65, bonus: 275, cumulative: 775 },
      { threshold: 70, bonus: 300, cumulative: 1075 },
      { threshold: 75, bonus: 350, cumulative: 1425 },
      { threshold: 80, bonus: 375, cumulative: 1800 }
    ];

    // Check standard tiers
    for (let i = 0; i < tiers.length; i++) {
      if (viewsInMillions >= tiers[i].threshold) {
        totalBonus = tiers[i].cumulative;
        if (i < tiers.length - 1) {
          nextMilestone = tiers[i + 1].threshold;
        } else {
          // After 80M, every 5M adds $375
          nextMilestone = Math.ceil(viewsInMillions / 5) * 5;
          if (nextMilestone <= viewsInMillions) {
            nextMilestone += 5;
          }
        }
      }
    }

    // Handle bonuses after 80M (every 5M adds $375)
    if (viewsInMillions > 80) {
      const additionalMilestones = Math.floor((viewsInMillions - 80) / 5);
      totalBonus = 1800 + (additionalMilestones * 375);
      nextMilestone = 80 + ((additionalMilestones + 1) * 5);
    }

    // Calculate progress to next milestone
    if (viewsInMillions < nextMilestone) {
      let previousMilestone;
      let milestoneRange;

      if (nextMilestone === 55) {
        // First milestone: 0M to 55M
        previousMilestone = 0;
        milestoneRange = 55;
      } else {
        // Subsequent milestones: 5M intervals
        previousMilestone = nextMilestone - 5;
        milestoneRange = 5;
      }

      const progressInRange = viewsInMillions - previousMilestone;
      progress = Math.max(0, (progressInRange / milestoneRange) * 100);
    } else {
      progress = 100;
    }

    return { totalBonus, progress, nextMilestone, currentViews: viewsInMillions };
  };

  // Calculate target average daily views needed for next bonus tier
  const calculateTargetDailyViews = () => {
    console.log('🎯 Target calculation debug:', {
      monthlyBonusData,
      nextMilestone: monthlyBonusData?.nextMilestone
    });

    if (!monthlyBonusData?.nextMilestone) {
      console.log('🎯 No target milestone found, returning 0');
      return 0;
    }

    // Get current date and calculate days remaining in month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = daysInMonth - currentDay + 1; // Include today

    // Convert next milestone from millions to actual views
    const targetMonthlyViews = monthlyBonusData.nextMilestone * 1000000;

    // Calculate current monthly views (from bonus data)
    const currentMonthlyViews = (monthlyBonusData.currentViews || 0) * 1000000;

    // Calculate remaining views needed
    const remainingViewsNeeded = Math.max(0, targetMonthlyViews - currentMonthlyViews);

    // Calculate target daily average for remaining days
    const targetDailyViews = daysRemaining > 0 ? remainingViewsNeeded / daysRemaining : 0;

    console.log('🎯 Target calculation:', {
      nextMilestone: monthlyBonusData.nextMilestone,
      targetMonthlyViews,
      currentMonthlyViews,
      remainingViewsNeeded,
      daysRemaining,
      targetDailyViews
    });

    return targetDailyViews;
  };

  // Fetch monthly bonus data (always current calendar month, independent of date filter)
  const fetchMonthlyBonusData = async () => {
    try {
      const token = localStorage.getItem('token');
      let writerId = user?.writerId || localStorage.getItem('writerId');

      if (!token || !writerId) return;

      // Always get current calendar month date range for bonus calculation (independent of main filter)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatDate = (date) => {
        // Use local date formatting to avoid timezone conversion issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const params = {
        start_date: formatDate(startOfMonth),
        end_date: formatDate(endOfMonth)
      };

      console.log('🎯 Bonus Progress: Fetching calendar month data from', formatDate(startOfMonth), 'to', formatDate(endOfMonth));

      const overviewResult = await analyticsApi.getOverview({
        params: params
      });

      const monthlyViews = overviewResult.data?.totalViews || 0;
      console.log('🎯 Bonus Progress: Calendar month views =', monthlyViews);

      const bonusData = calculateBonus(monthlyViews);
      console.log('🎯 Bonus Data:', {
        monthlyViews,
        totalBonus: bonusData.totalBonus,
        progress: bonusData.progress,
        nextMilestone: bonusData.nextMilestone,
        currentViews: bonusData.currentViews
      });

      setMonthlyBonusData(bonusData);

      // Update progress animation with calculated progress - start from 0 for cool effect (only once and after page loads)
      if (!hasAnimated && bonusData.progress > 0 && pageFullyLoaded) {
        console.log('🎯 Animation: Starting progress animation from 0% to', bonusData.progress, '% (page fully loaded)');
        setHasAnimated(true);
        setProgressAnimation(0);
        setTimeout(() => {
          console.log('🎯 Animation: Setting progress to', bonusData.progress, '% after 1.2s delay');
          setProgressAnimation(bonusData.progress);
        }, 1200); // Longer delay for more anticipation
      }

    } catch (error) {
      console.error('Error fetching monthly bonus data:', error);
    }
  };

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      let writerId = user?.writerId || localStorage.getItem('writerId');

      if (!writerId && user?.username) {
        try {
          const profileResponse = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const profileData = await profileResponse.json();
          writerId = profileData.writerId;
          localStorage.setItem('writerId', writerId);
        } catch (profileError) {
          console.error('Could not fetch writerId:', profileError);
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

      let params = { range: dateRange };

      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          const startDate = parts[1];
          const endDate = parts[2];
          params.start_date = startDate;
          params.end_date = endDate;
        }
      }

      const overviewResult = await analyticsApi.getOverview({
        params: params
      });

      const overviewData = overviewResult.data;

      // Fetch top content and ALL videos for proper median calculation (same as main Analytics page)
      console.log('📊 Fetching top content and ALL videos for median calculation');
      const topVideosData = await fetchTopContent();
      console.log('📊 fetchTopContent returned:', topVideosData?.length || 0, 'videos');
      console.log('📊 Sample top video data:', topVideosData?.[0]);

      // Add detailed debugging for the API response
      if (topVideosData && topVideosData.length > 0) {
        console.log('📊 Top videos data structure check:');
        console.log('📊 First video keys:', Object.keys(topVideosData[0]));
        console.log('📊 First video values:', Object.values(topVideosData[0]));
        console.log('📊 First 3 videos:', topVideosData.slice(0, 3));
      } else {
        console.log('📊 ❌ No top videos data received from API');
      }
      const allVideosData = await fetchAllVideosForMedian(dateRange);
      console.log('📊 fetchAllVideosForMedian returned:', allVideosData?.length || 0, 'videos');

      // Process the data for our components - Use server-calculated viral counts like main analytics page
      const totalViews = overviewData.totalViews || 0;
      const chartData = overviewData.chartData || [];
      const topVideos = topVideosData || []; // Use fetched top videos data

      console.log('📊 About to set combinedData with topVideos:', topVideos?.length || 0);

      const combinedData = {
        ...overviewData, // Spread all server data including viral counts
        totalViews: totalViews,
        totalSubmissions: overviewData.totalSubmissions || 0,
        avgDailyViews: chartData.length > 0 ? Math.round(totalViews / chartData.length) : 0,
        // Calculate average views per video: Total Views / Total Submissions (same as main Analytics page)
        avgVideoViews: overviewData.totalSubmissions > 0 ?
          Math.round(totalViews / overviewData.totalSubmissions) : 0,
        // Calculate median views from ALL videos in the time range (same as main Analytics page)
        medianVideoViews: allVideosData && allVideosData.length > 0 ?
          (() => {
            const sortedViews = allVideosData.map(video => video.views_total || video.views || 0).sort((a, b) => a - b);
            const mid = Math.floor(sortedViews.length / 2);
            return sortedViews.length % 2 === 0
              ? Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2)
              : sortedViews[mid];
          })() : 0,
        chartData: chartData,
        aggregatedViewsData: overviewData.aggregatedViewsData || [],
        topVideos: topVideos,
        latestContent: overviewData.latestContent || null,
        // Use server-calculated viral counts (same as main analytics page)
        megaViralsCount: overviewData.megaViralsCount || 0,
        viralsCount: overviewData.viralsCount || 0,
        almostViralsCount: overviewData.almostViralsCount || 0,
        decentVideosCount: overviewData.decentVideosCount || 0,
        flopsCount: overviewData.flopsCount || 0,
        // Use server-calculated percentages if available
        megaViralsPercentage: overviewData.megaViralsPercentage || 0,
        viralsPercentage: overviewData.viralsPercentage || 0,
        almostViralsPercentage: overviewData.almostViralsPercentage || 0,
        decentVideosPercentage: overviewData.decentVideosPercentage || 0,
        flopsPercentage: overviewData.flopsPercentage || 0,
        summary: {
          progressToTarget: (overviewData.totalViews / 100000000) * 100,
          highestDay: overviewData.chartData?.length > 0 ? Math.max(...overviewData.chartData.map(d => d.views)) : 0,
          lowestDay: overviewData.chartData?.length > 0 ? Math.min(...overviewData.chartData.map(d => d.views)) : 0
        }
      };

      // Calculate performance rates for the KPI cards
      if (combinedData.totalSubmissions > 0) {
        combinedData.viralRate = Math.round(((combinedData.megaViralsCount + combinedData.viralsCount) / combinedData.totalSubmissions) * 100);
        combinedData.decentRate = Math.round(((combinedData.decentVideosCount + combinedData.almostViralsCount) / combinedData.totalSubmissions) * 100);
        combinedData.flopRate = Math.round((combinedData.flopsCount / combinedData.totalSubmissions) * 100);
      } else {
        combinedData.viralRate = 0;
        combinedData.decentRate = 0;
        combinedData.flopRate = 0;
      }

      setAnalyticsData(combinedData);
      console.log('📊 Analytics data set successfully');
      console.log('📊 Final analyticsData.topVideos:', combinedData.topVideos?.length || 0);
      setLoading(false);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data. Please try again.');
      setLoading(false);
    }
  };

  // Handle date range change
  const handleDateRangeChange = (event) => {
    const value = event.target.value;

    if (value === "custom") {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      setDateRange(value);
    }
  };

  // Handle custom date apply
  const handleCustomDateApply = () => {
    const customRange = `custom_${customStartDate}_${customEndDate}`;
    setDateRange(customRange);
    setShowCustomDatePicker(false);
  };

  // Handle leaderboard period change
  const handleLeaderboardPeriodChange = (event) => {
    setLeaderboardPeriod(event.target.value);
  };

  // Fetch leaderboard data
  const fetchLeaderboardData = async () => {
    try {
      console.log('🏆 Starting leaderboard fetch for period:', leaderboardPeriod);
      setLeaderboardLoading(true);

      const url = `/api/analytics/writer/leaderboard?period=${leaderboardPeriod}&limit=20`;
      console.log('🏆 Fetching from URL:', url);

      // Get auth token from localStorage
      const token = localStorage.getItem('token');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🏆 Leaderboard API Response:', data);

      // Extract the actual data array from the response
      const leaderboardArray = data.data || data || [];
      console.log('🏆 Leaderboard Array:', leaderboardArray);

      // Filter out excluded writers
      const excludedWriters = [
        "Jamez Garcia",
        "Alexander 'the' Kazarian",
        "Steven Abreu",
        "A/B testing writer",
        "ludo",
        "gianmarco",
        "AIwriter"
      ];

      const filteredLeaderboard = leaderboardArray.filter(writer =>
        !excludedWriters.includes(writer.writer_name)
      );

      console.log('🏆 Filtered Leaderboard (excluded writers removed):', filteredLeaderboard);

      setLeaderboardData(filteredLeaderboard);
    } catch (err) {
      console.error('❌ Error fetching leaderboard data:', err);
      setLeaderboardData([]); // Set empty array on error
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Format number for display
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  // Format views for leaderboard
  const formatViews = (views) => {
    if (views >= 1000000000) return `${(views / 1000000000).toFixed(1)}B`;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views?.toString() || '0';
  };

  // Format time for tooltip - USE UTC TO AVOID TIMEZONE ISSUES
  const formatTimeForTooltip = (timeString) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      // Use UTC methods to avoid timezone conversion
      let hours = date.getUTCHours();
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      return `${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return timeString;
    }
  };

  // Fetch script submission data for tooltip
  const fetchScriptSubmissionData = async () => {
    try {
      if (!user?.writerId) return;

      let startDate, endDate;

      // Handle custom date ranges
      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          startDate = parts[1];
          endDate = parts[2];
        }
      } else {
        // For non-custom ranges, calculate the date range
        endDate = new Date().toISOString().split('T')[0];

        switch (dateRange) {
          case 'last7days':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'last30days':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'last90days':
            startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'last365days':
            startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          default:
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
      }

      const response = await fetch(buildApiUrl('/api/analytics/script-submissions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          writerId: user.writerId,
          startDate,
          endDate
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Convert array to object with date as key for easy lookup
        const submissionsByDate = {};
        data.forEach(item => {
          submissionsByDate[item.date] = item.count;
        });
        setScriptSubmissionData(submissionsByDate);
      }
    } catch (error) {
      console.error('Error fetching script submission data:', error);
    }
  };

  // Format date for display - USE UTC TO AVOID TIMEZONE ISSUES
  const formatDate = (dateStr) => {
    // Parse date string and format using UTC to ensure consistency across timezones
    let date;
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      // If it's already in YYYY-MM-DD format, parse it as UTC
      const parts = dateStr.split('T')[0].split('-');
      date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    } else {
      date = new Date(dateStr);
    }

    // Use UTC methods to avoid timezone conversion
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${monthNames[month]} ${day}`;
  };



  // Handle content filter change (same as main analytics)
  const handleContentFilterChange = async (newFilter) => {
    console.log('🎯 Content filter changing to:', newFilter);
    setContentFilter(newFilter);

    // Fetch new top content with the filter (same as main analytics)
    if (analyticsData) {
      console.log('🎯 Fetching new top content with filter:', newFilter);
      console.log('🎯 Current analyticsData exists:', !!analyticsData, 'topVideos count:', analyticsData?.topVideos?.length || 0);
      const newTopContent = await fetchTopContent(newFilter);
      console.log('🎯 New top content received:', newTopContent?.length || 0, 'items');
      setAnalyticsData(prev => ({
        ...prev,
        topVideos: newTopContent
      }));
    } else {
      console.log('🎯 No analyticsData available, skipping filter change');
    }
  };





  // Writer-specific top content function (same as main analytics)
  const fetchTopContent = async (filterType = contentFilter) => {
    try {
      const token = localStorage.getItem('token');
      let writerId = user?.writerId || localStorage.getItem('writerId');

      console.log('🎯 fetchTopContent: Starting with:', {
        filterType,
        userId: user?.id,
        userWriterId: user?.writerId,
        localStorageWriterId: localStorage.getItem('writerId'),
        finalWriterId: writerId
      });

      // SECURITY: If no writerId, fetch from profile endpoint
      if (!writerId && user?.username) {
        try {
          const profileResponse = await fetch('/api/auth/profile', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            writerId = profileData.writerId;
            localStorage.setItem('writerId', writerId);
            console.log('🔐 Writer ID fetched from profile:', writerId);
          }
        } catch (profileError) {
          console.error('🔐 Error fetching profile for writer ID:', profileError);
        }
      }

      if (!writerId) {
        console.error('❌ No writer ID available for top content');
        return [];
      }

      console.log('📊 Fetching top content for writer:', writerId, 'filter:', filterType);

      // Determine range parameter based on current dateRange (same as main Analytics)
      let range = '30'; // default
      let startDate, endDate;

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

      // Fix filter type mapping to match backend expectations (same as main Analytics)
      let apiFilterType = filterType;
      if (filterType === 'videos') {
        apiFilterType = 'content'; // Backend expects 'content' for videos
      }

      // Build URL with proper parameters - like main Analytics page with 20 videos
      let url = `${buildApiUrl('/api/analytics/writer/top-content')}?writer_id=${writerId}&range=${range}&limit=20&type=${apiFilterType}`;

      // Add custom date parameters if needed
      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }

      // Add cache-busting parameter to force fresh data (like main Analytics)
      url += `&_t=${Date.now()}`;

      console.log('🎯 fetchTopContent: API URL:', url);
      console.log('🎯 fetchTopContent: Filter mapping:', filterType, '→', apiFilterType);
      console.log('🎯 fetchTopContent: Date range info:', { dateRange, range, startDate, endDate });

      console.log('🎯 fetchTopContent: Making API call to:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🎯 fetchTopContent: API response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        let topContent = result.data || result || [];

        console.log('🎯 fetchTopContent: Raw API response:', result);
        console.log('🎯 fetchTopContent: Processed data:', {
          filterType,
          apiFilterType,
          resultLength: topContent?.length || 0,
          sampleData: topContent?.[0] ? {
            title: topContent[0].title?.substring(0, 50),
            type: topContent[0].type,
            duration: topContent[0].duration,
            isShort: topContent[0].isShort
          } : null
        });

        if (topContent.length > 0) {

          // Process the content to ensure proper video type detection and account names
          const processedContent = topContent.map(video => ({
            ...video,
            // Use channel_title as primary account name source
            account_name: video.channel_title || video.account_name || video.channelTitle || 'Unknown Account',
            // Trust backend type determination (backend already handles BigQuery duration properly)
            type: video.type || 'video', // Use backend type, fallback to video
            // Ensure we have proper view counts
            views: parseInt(video.views) || 0,
            // Add other fields that might be missing
            likes: parseInt(video.likes) || 0,
            comments: parseInt(video.comments) || 0,
            // Format posted date
            posted_date: video.posted_date || video.snippet_published_at || video.publishedAt
          }));

          // Sort by views in descending order (highest first)
          const sortedContent = processedContent.sort((a, b) => (b.views || 0) - (a.views || 0));
          return sortedContent;
        }
      } else {
        console.error('❌ Top content API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching top content:', error);
    }

    return [];
  };

  // Check if user is STL writer
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

  // Handle opening video details modal
  const handleOpenVideoModal = (category) => {
    setModalCategory(category);
    setModalOpen(true);
    setModalLoading(false);
  };

  // Fetch realtime data
  const fetchRealtimeData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/analytics/realtime?hours=24', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRealtimeData(data);
      }
    } catch (err) {
      console.error('Error fetching realtime data:', err);
    }
  };

  // Fetch streak and script stats
  const fetchStreakStats = async (startDate = null, endDate = null) => {
    try {
      const token = localStorage.getItem('token');
      let url = '/api/analytics/writer/streak-stats';

      // Add date parameters for script count filtering
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Streak stats received:', data);
        setStreakStats({
          streak: data.streak || 0,
          postedScripts: data.postedScripts || 0
        });
      } else {
        console.error('❌ Failed to fetch streak stats:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching streak stats:', error);
    }
  };

  // Calculate badge level based on monthly views
  const getBadgeLevel = (monthlyViews) => {
    if (monthlyViews >= 125000000) return 6; // 125M+ monthly (future level)
    if (monthlyViews >= 100000000) return 5; // 100M+ monthly
    if (monthlyViews >= 75000000) return 4;  // 75M+ monthly
    if (monthlyViews >= 50000000) return 3;  // 50M+ monthly
    if (monthlyViews >= 30000000) return 2;  // 30M+ monthly
    if (monthlyViews >= 15000000) return 1;  // 15M+ monthly
    return 0; // No badge if under 15M monthly
  };

  // Rank styling function (from main analytics)
  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return {
          borderColor: '#FFD700',
          glowColor: 'rgba(255, 215, 0, 0.4)',
          badgeColor: '#FFD700'
        };
      case 2:
        return {
          borderColor: '#C0C0C0',
          glowColor: 'rgba(192, 192, 192, 0.4)',
          badgeColor: '#C0C0C0'
        };
      case 3:
        return {
          borderColor: '#CD7F32',
          glowColor: 'rgba(205, 127, 50, 0.4)',
          badgeColor: '#CD7F32'
        };
      default:
        return {
          borderColor: '#666',
          glowColor: 'rgba(102, 102, 102, 0.4)',
          badgeColor: '#666'
        };
    }
  };

  useEffect(() => {
    // Fetch analytics for all date ranges except when showing the custom picker
    if (dateRange !== "custom") {
      fetchAnalytics();
    }
    fetchRealtimeData();
    fetchMonthlyBonusData(); // Always fetch current calendar month for bonus (independent of date filter)
    fetchScriptSubmissionData(); // Fetch script submission data for tooltip

    // Fetch streak stats with date filtering for script count
    if (dateRange.startsWith('custom_')) {
      const parts = dateRange.split('_');
      if (parts.length === 3) {
        fetchStreakStats(parts[1], parts[2]);
      }
    } else {
      // For non-custom ranges, calculate the date range
      const endDate = new Date().toISOString().split('T')[0];
      let startDate;

      switch (dateRange) {
        case 'last7days':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last30days':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last90days':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      fetchStreakStats(startDate, endDate);
    }
  }, [dateRange]);

  // Fetch leaderboard data when period changes
  useEffect(() => {
    fetchLeaderboardData();
  }, [leaderboardPeriod]);

  // Progress bar animation effect - triggers only once when page is fully loaded
  useEffect(() => {
    console.log('🎯 useEffect: Progress animation effect triggered', {
      monthlyBonusData,
      hasAnimated,
      pageFullyLoaded
    });

    // Initial animation on mount (only if we have bonus data, haven't animated yet, and page is fully loaded)
    if (monthlyBonusData.progress > 0 && !hasAnimated && pageFullyLoaded) {
      console.log('🎯 Initial: Starting initial animation, progress =', monthlyBonusData.progress);
      setHasAnimated(true);
      setProgressAnimation(0);

      const targetProgress = monthlyBonusData.progress; // Capture the value

      // Use a separate timeout that won't be cleaned up by useEffect re-runs
      const timer = setTimeout(() => {
        console.log('🎯 Initial: Setting progress to', targetProgress, '% after initial delay');
        setProgressAnimation(targetProgress);
      }, 500); // 0.5 second delay for quicker animation start

      // Store timer reference for cleanup on unmount only
      animationTimerRef.current = timer;
    }
  }, [monthlyBonusData.progress, hasAnimated, pageFullyLoaded]); // Trigger when bonus data changes or page loads

  // Reset animation state when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      console.log('🎯 Cleanup: Component unmounting, resetting animation state');
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      setHasAnimated(false);
      setProgressAnimation(0);
      setPageFullyLoaded(false);
    };
  }, []);



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
            '0%, 100%': {
              boxShadow: '0 0 20px rgba(102, 126, 234, 0.3), 0 0 40px rgba(102, 126, 234, 0.1)',
            },
            '50%': {
              boxShadow: '0 0 30px rgba(102, 126, 234, 0.5), 0 0 60px rgba(102, 126, 234, 0.2)',
            },
          },
        }}>
          {/* Animated Background Elements */}
          {[...Array(6)].map((_, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                width: '100px',
                height: '100px',
                background: `linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)`,
                borderRadius: '50%',
                animation: 'float 6s ease-in-out infinite',
                animationDelay: `${i * 1}s`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                zIndex: 0,
              }}
            />
          ))}

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

              {/* Progress Dots */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                {[0, 1, 2].map((dot) => (
                  <Box
                    key={dot}
                    sx={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                      animationDelay: `${dot * 0.3}s`,
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

  if (error) {
    return (
      <Layout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ color: 'white', mb: 3 }}>
            Writer Analytics
          </Typography>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      {glassmorphismStyles}
      <Box sx={{ p: isMobile ? 2 : 3 }}>
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
              Writer Analytics
            </Typography>
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
            <CalendarIcon sx={{ fontSize: '18px', opacity: 0.8 }} />
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
              position: 'fixed',
              top: '120px',
              right: '20px',
              zIndex: 1000
            }}>
              {/* Calendar Grid */}
              <CalendarGrid
                startDate={customStartDate}
                endDate={customEndDate}
                onDateSelect={async (start, end) => {
                  setCustomStartDate(start);
                  setCustomEndDate(end);

                  // Auto-apply the date range
                  const customRange = `custom_${start}_${end}`;
                  setDateRange(customRange);
                  setShowCustomDatePicker(false);

                  // Fetch analytics data with the new date range
                  setLoading(true);
                  try {
                    const token = localStorage.getItem('token');
                    let writerId = user?.writerId || localStorage.getItem('writerId');

                    let params = {
                      range: customRange,
                      start_date: start,
                      end_date: end
                    };

                    const overviewResult = await analyticsApi.getOverview({
                      params: params
                    });

                    const overviewData = overviewResult.data;

                    // Fetch top content and ALL videos for proper median calculation (same as main Analytics page)
                    console.log('📊 Fetching top content and ALL videos for median calculation (custom range)');
                    const topVideosData = await fetchTopContent();
                    console.log('📊 fetchTopContent (custom) returned:', topVideosData?.length || 0, 'videos');

                    // Add detailed debugging for the API response
                    if (topVideosData && topVideosData.length > 0) {
                      console.log('📊 Custom range - Top videos data structure check:');
                      console.log('📊 Custom range - First video keys:', Object.keys(topVideosData[0]));
                      console.log('📊 Custom range - First video values:', Object.values(topVideosData[0]));
                    } else {
                      console.log('📊 ❌ Custom range - No top videos data received from API');
                    }

                    const allVideosData = await fetchAllVideosForMedian(customRange);
                    console.log('📊 fetchAllVideosForMedian (custom) returned:', allVideosData?.length || 0, 'videos');

                    // Process the data for our components - Use server-calculated viral counts like main analytics page
                    const totalViews = overviewData.totalViews || 0;
                    const chartData = overviewData.chartData || [];
                    const topVideos = topVideosData || []; // Use fetched top videos data

                    const combinedData = {
                      ...overviewData, // Spread all server data including viral counts
                      totalViews: totalViews,
                      totalSubmissions: overviewData.totalSubmissions || 0,
                      avgDailyViews: chartData.length > 0 ? Math.round(totalViews / chartData.length) : 0,
                      // Calculate average views per video: Total Views / Total Submissions (same as main Analytics page)
                      avgVideoViews: overviewData.totalSubmissions > 0 ?
                        Math.round(totalViews / overviewData.totalSubmissions) : 0,
                      // Calculate median views from ALL videos in the time range (same as main Analytics page)
                      medianVideoViews: allVideosData && allVideosData.length > 0 ?
                        (() => {
                          const sortedViews = allVideosData.map(video => video.views_total || video.views || 0).sort((a, b) => a - b);
                          const mid = Math.floor(sortedViews.length / 2);
                          return sortedViews.length % 2 === 0
                            ? Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2)
                            : sortedViews[mid];
                        })() : 0,
                      chartData: chartData,
                      aggregatedViewsData: overviewData.aggregatedViewsData || [],
                      topVideos: topVideos,
                      latestContent: overviewData.latestContent || null,
                      // Use server-calculated viral counts (same as main analytics page)
                      megaViralsCount: overviewData.megaViralsCount || 0,
                      viralsCount: overviewData.viralsCount || 0,
                      almostViralsCount: overviewData.almostViralsCount || 0,
                      decentVideosCount: overviewData.decentVideosCount || 0,
                      flopsCount: overviewData.flopsCount || 0,
                      // Use server-calculated percentages if available
                      megaViralsPercentage: overviewData.megaViralsPercentage || 0,
                      viralsPercentage: overviewData.viralsPercentage || 0,
                      almostViralsPercentage: overviewData.almostViralsPercentage || 0,
                      decentVideosPercentage: overviewData.decentVideosPercentage || 0,
                      flopsPercentage: overviewData.flopsPercentage || 0,
                      summary: {
                        progressToTarget: (overviewData.totalViews / 100000000) * 100,
                        highestDay: overviewData.chartData?.length > 0 ? Math.max(...overviewData.chartData.map(d => d.views)) : 0,
                        lowestDay: overviewData.chartData?.length > 0 ? Math.min(...overviewData.chartData.map(d => d.views)) : 0
                      }
                    };

                    // Calculate performance rates for the KPI cards
                    if (combinedData.totalSubmissions > 0) {
                      combinedData.viralRate = Math.round(((combinedData.megaViralsCount + combinedData.viralsCount) / combinedData.totalSubmissions) * 100);
                      combinedData.decentRate = Math.round(((combinedData.decentVideosCount + combinedData.almostViralsCount) / combinedData.totalSubmissions) * 100);
                      combinedData.flopRate = Math.round((combinedData.flopsCount / combinedData.totalSubmissions) * 100);
                    } else {
                      combinedData.viralRate = 0;
                      combinedData.decentRate = 0;
                      combinedData.flopRate = 0;
                    }

                    setAnalyticsData(combinedData);
                    setLoading(false);

                    // Fetch streak stats with custom date range
                    fetchStreakStats(start, end);

                    // Fetch script submission data for tooltip with custom date range
                    fetchScriptSubmissionData();
                  } catch (error) {
                    console.error('Error fetching analytics for custom date range:', error);
                    setError('Failed to load analytics data. Please try again.');
                    setLoading(false);
                  }

                  // Close calendar after selection
                  setTimeout(() => setShowCustomDatePicker(false), 300);
                }}
              />
            </Box>
          )}
        </Box>
          </Box>
        </Box>

        {/* Incentives Progress - Overall Container - Full Height Hero Section */}
        <Box sx={{ mb: 4 }}>
          {/* Main Container - Full Viewport Height */}
          <Box sx={{
            bgcolor: 'transparent',
            borderRadius: '20px',
            p: { xs: 1, md: 2 },
            border: 'none',
            backdropFilter: 'none',
            height: { xs: 'auto', md: 'calc(100vh - 120px)' }, // Auto height on mobile
            minHeight: { xs: '400px', md: '600px' }, // Smaller minimum height on mobile
            overflow: 'hidden'
          }}>


            {/* Two Column Layout - Full Height */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
              gap: 2,
              height: { xs: 'auto', md: '100%' }, // Auto height on mobile
              overflow: 'hidden'
            }}>

              {/* LEFT CONTAINER - Milestone Progress */}
              <Box sx={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
                backdropFilter: 'blur(15px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.2)',
                p: { xs: 2, md: 3 },
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                position: 'relative',
                boxShadow: '0 8px 32px rgba(255, 255, 255, 0.1)'
              }}>
                {/* Level Badge - Top Right Corner */}
                <Box sx={{
                  position: 'absolute',
                  top: { xs: 12, md: 16 },
                  right: { xs: 12, md: 16 },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 1
                }}>
                  <Box sx={{
                    width: { xs: 60, md: 90 },
                    height: { xs: 60, md: 90 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 0.5
                  }}>
                    <img
                      src={getBadgeImage((() => {
                        const monthlyViews = monthlyBonusData?.currentViews ? monthlyBonusData.currentViews * 1000000 : 0;
                        const badgeLevel = getBadgeLevel(monthlyViews);
                        return badgeLevel > 0 ? badgeLevel : 1; // Show Level 1 badge if no badge earned
                      })())}
                      alt="Experience Badge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    {(() => {
                      const monthlyViews = monthlyBonusData?.currentViews ? monthlyBonusData.currentViews * 1000000 : 0;
                      const badgeLevel = getBadgeLevel(monthlyViews);

                      if (badgeLevel === 0) return "No Badge — Need 15M+";

                      const thresholds = {
                        1: "15M+",
                        2: "30M+",
                        3: "50M+",
                        4: "75M+",
                        5: "100M+",
                        6: "125M+"
                      };

                      return `Level ${badgeLevel} — ${thresholds[badgeLevel]}`;
                    })()}
                  </Typography>
                </Box>

                {/* Milestone Progress Title */}
                <Typography variant="h6" sx={{
                  color: 'white',
                  fontWeight: 600,
                  mb: { xs: 1, md: 1.5 },
                  fontSize: { xs: '14px', md: '16px' }
                }}>
                  {isMobile ? 'Progress' : 'Milestone Progress'}
                </Typography>

                {/* Hero Section: Shorts Views + Total Bonus Earned + Progress Bar */}
                <Box sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'flex-start', md: 'center' },
                  mb: { xs: 2, md: 4 },
                  mt: { xs: 1, md: 3 }, // Move lower
                  pr: { xs: 4, md: 8 }, // Add padding to avoid overlap with badge
                  gap: { xs: 2, md: 8 } // Better spacing between elements
                }}>
                  {/* Left: Shorts Views */}
                  <Box>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255,255,255,0.7)',
                      mb: 1,
                      fontSize: { xs: '12px', md: '14px' }
                    }}>
                      Shorts Views
                    </Typography>
                    <Typography variant="h4" sx={{
                      color: 'white',
                      fontWeight: 700,
                      fontSize: { xs: '20px', md: '32px' }
                    }}>
                      {formatNumber(analyticsData?.totalViews || 66100000)}
                    </Typography>
                  </Box>

                  {/* Center: Total Bonus Earned */}
                  <Box sx={{ textAlign: { xs: 'left', md: 'center' } }}>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255,255,255,0.7)',
                      mb: 1,
                      fontSize: { xs: '12px', md: '14px' }
                    }}>
                      Total Bonus Earned
                    </Typography>
                    <Typography variant="h4" sx={{
                      color: 'white',
                      fontWeight: 700,
                      fontSize: { xs: '20px', md: '32px' }
                    }}>
                      ${monthlyBonusData.totalBonus.toLocaleString()}
                    </Typography>
                  </Box>

                  {/* Right: Bonus Progress */}
                  <Box sx={{ minWidth: { xs: '100%', md: '200px' } }}>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255,255,255,0.7)',
                      mb: 1,
                      fontSize: { xs: '12px', md: '14px' },
                      textAlign: { xs: 'left', md: 'center' }
                    }}>
                      Bonus Progress
                    </Typography>
                    <Typography variant="h6" sx={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '16px',
                      mb: 1,
                      textAlign: 'center'
                    }}>
                      {monthlyBonusData.currentViews?.toFixed(1) || '0.0'}<Typography component="span" sx={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}>M</Typography> / {monthlyBonusData.nextMilestone}
                      <Typography component="span" sx={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}> M → +${monthlyBonusData.nextMilestone >= 80 ? '375' : (() => {
                        const tiers = { 55: '250', 60: '250', 65: '275', 70: '300', 75: '350', 80: '375' };
                        return tiers[monthlyBonusData.nextMilestone] || '375';
                      })()} next</Typography>
                    </Typography>

                    {/* Progress Bar */}
                    <Box sx={{
                      width: '100%',
                      height: '12px', // Made thicker
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <Box sx={{
                        width: `${progressAnimation}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #00E5FF 0%, #12c2e9 50%, #00E5FF 100%)',
                        borderRadius: '6px',
                        transition: 'width 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Slightly faster, smooth animation
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: '-100%',
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                          animation: 'shimmer 3s ease-in-out infinite',
                        },
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: '2px',
                          left: '2px',
                          right: '2px',
                          height: '4px',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)',
                          borderRadius: '4px',
                        }
                      }} />
                    </Box>
                  </Box>
                </Box>

                {/* Line Chart Section */}
                <Box sx={{ mb: 2 }}>
                  {/* Chart Container - Full Width */}
                  <Box sx={{
                    height: '320px', // Increased height to cover more space
                    overflow: 'hidden',
                    mb: 2
                  }}>
                    {analyticsData?.aggregatedViewsData && analyticsData.aggregatedViewsData.length > 0 ? (
                      <ReactECharts
                        option={{
                          backgroundColor: 'transparent',
                          legend: {
                            show: true,
                            top: '0%',
                            right: '2%',
                            textStyle: {
                              color: '#9e9e9e',
                              fontSize: 11
                            },
                            itemWidth: 20,
                            itemHeight: 12,
                            data: [
                              {
                                name: 'Daily Views',
                                icon: 'circle'
                              }
                            ]
                          },
                          tooltip: {
                            trigger: 'axis',
                            backgroundColor: 'rgba(50, 50, 50, 0.9)',
                            borderColor: '#4fc3f7',
                            borderWidth: 1,
                            textStyle: { color: '#fff' },
                            formatter: (params) => {
                              if (!params || params.length === 0) return '';

                              let tooltipContent = '';
                              const date = params[0]?.axisValue || 'N/A';

                              // Process each series in the tooltip
                              params.forEach((param, index) => {
                                if (param.seriesName === 'Daily Views') {
                                  const views = param.value || 0;

                                  // Get script submission data using UTC date processing
                                  const dataIndex = param.dataIndex;
                                  let submissions = 0;
                                  if (dataIndex !== undefined && analyticsData?.aggregatedViewsData?.[dataIndex]) {
                                    const originalDate = analyticsData.aggregatedViewsData[dataIndex].time;
                                    // Convert to YYYY-MM-DD format using UTC to avoid timezone issues
                                    let dateKey;
                                    if (typeof originalDate === 'string' && originalDate.includes('-')) {
                                      dateKey = originalDate.split('T')[0];
                                    } else {
                                      const date = new Date(originalDate);
                                      // Use UTC methods to ensure consistent date formatting across timezones
                                      const year = date.getUTCFullYear();
                                      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                      const day = String(date.getUTCDate()).padStart(2, '0');
                                      dateKey = `${year}-${month}-${day}`;
                                    }
                                    submissions = scriptSubmissionData[dateKey] || 0;
                                  }

                                  tooltipContent = `${date}<br/>Views: ${formatNumber(views)}<br/>Script Submissions: ${submissions}`;
                                } else if (param.seriesName === 'Next Bonus Target') {
                                  const targetViews = param.value || 0;
                                  tooltipContent += `<br/><span style="color: #FFA726;">Target: ${formatNumber(targetViews)}/day for next bonus tier</span>`;
                                }
                              });

                              return tooltipContent;
                            }
                          },
                          grid: {
                            left: '0%',
                            right: '1%',
                            bottom: '10%',
                            top: '5%',
                            containLabel: true
                          },
                          xAxis: {
                            type: 'category',
                            boundaryGap: false,
                            data: analyticsData.aggregatedViewsData.map(item => formatDate(item.time)),
                            axisLabel: {
                              color: '#9e9e9e',
                              fontSize: 10
                            },
                            axisLine: {
                              lineStyle: { color: '#424242' }
                            },
                            splitLine: { show: false }
                          },
                          yAxis: {
                            type: 'value',
                            scale: true, // Enable auto-scaling
                            min: (value) => {
                              // Calculate min/max based on views data, but include target line if reasonable
                              const viewsData = analyticsData.aggregatedViewsData.map(item => item.views);
                              const minViews = Math.min(...viewsData);
                              return Math.max(0, Math.floor(minViews * 0.9));
                            },
                            max: (value) => {
                              // Only scale based on actual views data, not target line
                              const viewsData = analyticsData.aggregatedViewsData.map(item => item.views);
                              const maxViews = Math.max(...viewsData);
                              return Math.ceil(maxViews * 1.1);
                            },
                            axisLabel: {
                              formatter: (value) => {
                                if (value >= 1000000) {
                                  return Math.round(value / 1000000) + 'M';
                                } else if (value >= 1000) {
                                  return Math.round(value / 1000) + 'K';
                                }
                                return value;
                              },
                              color: '#9e9e9e',
                              fontSize: 10
                            },
                            axisLine: {
                              lineStyle: { color: '#424242' }
                            },
                            splitLine: {
                              lineStyle: { color: 'rgba(66, 66, 66, 0.3)', type: 'dashed' }
                            }
                          },
                          series: [
                            // Main views line chart with target line as markLine
                            {
                              name: 'Daily Views',
                              data: analyticsData.aggregatedViewsData.map(item => item.views),
                              type: 'line',
                              smooth: true,
                              lineStyle: {
                                color: '#4fc3f7',
                                width: 3
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
                                borderWidth: 2
                              },
                              connectNulls: false,
                              // Add target line as markLine if target exists
                              markLine: (() => {
                                const targetDailyViews = calculateTargetDailyViews();
                                console.log('🎯 MarkLine creation:', { targetDailyViews, monthlyBonusData });

                                if (targetDailyViews > 0) {
                                  // Position the line at 90% of the chart height for visibility
                                  const viewsData = analyticsData.aggregatedViewsData.map(item => item.views);
                                  const maxViews = Math.max(...viewsData);
                                  const linePosition = maxViews * 0.9; // 90% of max views

                                  return {
                                    silent: true,
                                    lineStyle: {
                                      color: '#FFA726',
                                      width: 2,
                                      type: 'dashed'
                                    },
                                    label: {
                                      show: true,
                                      position: 'middle',
                                      formatter: `Daily ${formatNumber(targetDailyViews)}`,
                                      color: '#FFA726',
                                      fontSize: 11,
                                      fontWeight: 'bold'
                                    },
                                    data: [{
                                      yAxis: linePosition,
                                      name: 'Next Bonus Target'
                                    }]
                                  };
                                }
                                return null;
                              })()
                            }
                          ]
                        }}
                        style={{ height: '100%', width: '100%' }}
                      />
                    ) : (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#888',
                        fontSize: '14px'
                      }}>
                        No chart data available
                      </Box>
                    )}
                  </Box>

                  {/* Streak Chips Row - Under Chart (smaller) */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    p: 1.5
                  }}>
                    {/* Left: Submission Streak */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {/* Animated Fire Icon */}
                      <Box sx={{
                        position: 'relative',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {streakStats.streak > 0 ? (
                          <Box sx={{
                            position: 'relative',
                            fontSize: '14px',
                            filter: 'hue-rotate(0deg)',
                            animation: streakStats.streak >= 5 ? 'fireFlicker 1.5s ease-in-out infinite alternate' : 'none',
                            '@keyframes fireFlicker': {
                              '0%': {
                                filter: 'hue-rotate(0deg) brightness(1)',
                                transform: 'scale(1)'
                              },
                              '50%': {
                                filter: 'hue-rotate(10deg) brightness(1.2)',
                                transform: 'scale(1.05)'
                              },
                              '100%': {
                                filter: 'hue-rotate(-5deg) brightness(1.1)',
                                transform: 'scale(1.02)'
                              }
                            }
                          }}>
                            🔥
                            {/* Fire Fill Overlay */}
                            <Box sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${Math.min(100, (streakStats.streak / 10) * 100)}%`,
                              background: streakStats.streak >= 10
                                ? 'linear-gradient(to top, #FF6B35, #F7931E, #FFD700)'
                                : streakStats.streak >= 7
                                ? 'linear-gradient(to top, #FF6B35, #F7931E)'
                                : streakStats.streak >= 4
                                ? 'linear-gradient(to top, #FF8C42, #FF6B35)'
                                : 'linear-gradient(to top, #FFA500, #FF8C42)',
                              borderRadius: '50%',
                              opacity: 0.7,
                              mixBlendMode: 'multiply',
                              transition: 'all 0.8s ease-in-out',
                              animation: streakStats.streak >= 8 ? 'fireGlow 2s ease-in-out infinite alternate' : 'none',
                              '@keyframes fireGlow': {
                                '0%': {
                                  boxShadow: '0 0 5px rgba(255, 107, 53, 0.5)',
                                  opacity: 0.7
                                },
                                '100%': {
                                  boxShadow: '0 0 15px rgba(255, 107, 53, 0.8)',
                                  opacity: 0.9
                                }
                              }
                            }} />
                          </Box>
                        ) : (
                          <Box sx={{ fontSize: '14px', color: '#FF5722' }}>
                            💤
                          </Box>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{
                        color: 'white',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}>
                        Submission Streak
                      </Typography>
                      <Typography variant="body1" sx={{
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '16px',
                        ml: 0.5
                      }}>
                        {streakStats.streak} {streakStats.streak === 1 ? 'day' : 'days'}
                      </Typography>
                    </Box>

                    {/* Right: Posted Scripts */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{
                        color: '#00E5FF',
                        fontSize: '14px'
                      }}>
                        📝
                      </Box>
                      <Typography variant="body2" sx={{
                        color: 'white',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}>
                        Posted Scripts
                      </Typography>
                      <Typography variant="body1" sx={{
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '16px',
                        ml: 0.5
                      }}>
                        {streakStats.postedScripts}
                      </Typography>
                    </Box>
                  </Box>


                </Box>
              </Box>

              {/* RIGHT COLUMN - Stacked Cards */}
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflow: 'hidden'
              }}>

                {/* TOP: Leaderboard Card */}
                <Box sx={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
                  backdropFilter: 'blur(15px)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  p: { xs: 2, md: 3 },
                  flex: 1,
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Header with title, date filter, and expand arrow */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2
                  }}>
                    <Typography variant="h6" sx={{
                      color: 'white',
                      fontWeight: 600,
                      fontSize: { xs: '14px', md: '16px' }
                    }}>
                      Leaderboard
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* Date Filter */}
                      <FormControl size="small" sx={{ minWidth: 40 }}>
                        <Select
                          value={leaderboardPeriod}
                          onChange={handleLeaderboardPeriodChange}
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
                              boxShadow: 'none !important',
                              '& fieldset': {
                                border: 'none !important',
                                outline: 'none !important',
                                boxShadow: 'none !important'
                              },
                              '&:hover fieldset': {
                                border: 'none !important',
                                outline: 'none !important',
                                boxShadow: 'none !important'
                              },
                              '&.Mui-focused fieldset': {
                                border: 'none !important',
                                outline: 'none !important',
                                boxShadow: 'none !important'
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
                    '&::-webkit-scrollbar': { display: 'none' },
                    '-ms-overflow-style': 'none',
                    'scrollbar-width': 'none'
                  }}>
                    {/* Always Show Top 3 Icons */}
                    {leaderboardLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <LinearProgress sx={{ width: '200px' }} />
                      </Box>
                    ) : leaderboardData.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Top 3 Icons */}
                      <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-evenly',
                        alignItems: 'end',
                        gap: 1,
                        mb: 2,
                        px: 1,
                        transform: 'translateX(-8px)'
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
                              mb: 1
                            }}>
                              <Box sx={{
                                width: 55,
                                height: 55,
                                borderRadius: '50%',
                                border: `3px solid ${getRankStyle(2).borderColor}`,
                                overflow: 'hidden',
                                boxShadow: `0 0 15px ${getRankStyle(2).glowColor}`,
                                background: 'white'
                              }}>
                                <BigHeadAvatar
                                  name={leaderboardData[1].writer_name}
                                  avatarSeed={leaderboardData[1].avatar_seed}
                                  size={49}
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
                            <Typography variant="body1" sx={{
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '14px',
                              textAlign: 'center'
                            }}>
                              {leaderboardData[1].writer_name}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: '12px',
                              textAlign: 'center'
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
                              mb: 1
                            }}>
                              <Box sx={{
                                width: 65,
                                height: 65,
                                borderRadius: '50%',
                                border: `3px solid ${getRankStyle(1).borderColor}`,
                                overflow: 'hidden',
                                boxShadow: `0 0 20px ${getRankStyle(1).glowColor}`,
                                background: 'white'
                              }}>
                                <BigHeadAvatar
                                  name={leaderboardData[0].writer_name}
                                  avatarSeed={leaderboardData[0].avatar_seed}
                                  size={59}
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
                              fontSize: '16px',
                              textAlign: 'center'
                            }}>
                              {leaderboardData[0].writer_name}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: '12px',
                              textAlign: 'center'
                            }}>
                              {formatViews(leaderboardData[0].total_views)} VIEWS
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
                              mb: 1
                            }}>
                              <Box sx={{
                                width: 55,
                                height: 55,
                                borderRadius: '50%',
                                border: `3px solid ${getRankStyle(3).borderColor}`,
                                overflow: 'hidden',
                                boxShadow: `0 0 15px ${getRankStyle(3).glowColor}`,
                                background: 'white'
                              }}>
                                <BigHeadAvatar
                                  name={leaderboardData[2].writer_name}
                                  avatarSeed={leaderboardData[2].avatar_seed}
                                  size={49}
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
                            <Typography variant="body1" sx={{
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '14px',
                              textAlign: 'center'
                            }}>
                              {leaderboardData[2].writer_name}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: '12px',
                              textAlign: 'center'
                            }}>
                              {formatViews(leaderboardData[2].total_views)} VIEWS
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* List for 4th+ Ranked Writers */}
                      {leaderboardData.length > 3 && (
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {leaderboardData.slice(3).map((writer, index) => (
                              <Box key={index + 3} sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                py: 0.5,
                                px: 1,
                                borderRadius: '6px',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  background: 'rgba(255,255,255,0.05)',
                                  transform: 'translateX(2px)'
                                }
                              }}>
                                {/* Rank Number */}
                                <Typography variant="caption" sx={{
                                  color: 'rgba(255,255,255,0.6)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  minWidth: '20px'
                                }}>
                                  #{index + 4}
                                </Typography>

                                {/* Avatar */}
                                <Box sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  background: 'white'
                                }}>
                                  <BigHeadAvatar
                                    name={writer.writer_name}
                                    avatarSeed={writer.avatar_seed}
                                    size={24}
                                  />
                                </Box>

                                {/* Name and Views */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="caption" sx={{
                                    color: 'white',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {writer.writer_name}
                                  </Typography>
                                  <Typography variant="caption" sx={{
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: '10px'
                                  }}>
                                    {formatViews(writer.total_views)} views
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          No leaderboard data available
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* BOTTOM: Realtime Card - Simplified */}
                <Box sx={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
                  backdropFilter: 'blur(15px)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  p: 3,
                  boxShadow: '0 8px 32px rgba(255, 255, 255, 0.1)'
                }}>
                  {/* Realtime title */}
                  <Typography variant="h6" sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '16px',
                    mb: 1
                  }}>
                    Realtime
                  </Typography>

                  {/* Big number */}
                  <Typography variant="h4" sx={{
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '32px',
                    mb: 0.5
                  }}>
                    {realtimeData?.totalViews ? realtimeData.totalViews.toLocaleString() : 'Loading...'}
                  </Typography>

                  {/* Views text */}
                  <Typography variant="body2" sx={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    mb: 2
                  }}>
                    Views • Last 24 hours
                  </Typography>

                  {/* Simple bars visualization - Full Width */}
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'end',
                    gap: 0.5,
                    height: 110,
                    width: '100%',
                    position: 'relative'
                  }}>
                    {realtimeData?.chartData ? realtimeData.chartData.slice(-24).map((item, index) => {
                      const maxViews = Math.max(...realtimeData.chartData.slice(-24).map(d => d.views));
                      const minViews = Math.min(...realtimeData.chartData.slice(-24).map(d => d.views));
                      const range = maxViews - minViews;
                      // Better height calculation for more visible trends
                      const normalizedHeight = range > 0 ? ((item.views - minViews) / range) : 0.5;
                      const height = Math.max(8, 20 + (normalizedHeight * 140)); // Min 20px, max 160px
                      const isLast = index === realtimeData.chartData.slice(-24).length - 1;
                      const isHovered = hoveredBar === index;

                      return (
                        <Box
                          key={index}
                          onMouseEnter={(e) => {
                            setHoveredBar(index);
                          }}
                          onMouseLeave={() => {
                            setHoveredBar(null);
                          }}
                          sx={{
                            flex: 1,
                            height: `${height}px`,
                            background: isLast
                              ? '#00E5FF'
                              : isHovered
                                ? 'rgba(0, 229, 255, 0.8)'
                                : `rgba(0, 229, 255, ${0.2 + normalizedHeight * 0.6})`, // Dynamic opacity based on value
                            borderRadius: '3px',
                            minWidth: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            border: isLast ? '1px solid rgba(0, 229, 255, 0.5)' : 'none',
                            boxShadow: isHovered ? '0 2px 8px rgba(0, 229, 255, 0.4)' : 'none',
                            transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                            transformOrigin: 'bottom'
                          }}
                        />
                      );
                    }) : (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Loading chart data...
                      </Typography>
                    )}

                    {/* Custom Tooltip */}
                    {hoveredBar !== null && realtimeData?.chartData && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${(hoveredBar / 23) * 100}%`,
                          bottom: '120px',
                          transform: 'translateX(-50%)',
                          background: 'rgba(0, 0, 0, 0.9)',
                          border: '1px solid #00E5FF',
                          borderRadius: '6px',
                          p: 1,
                          zIndex: 9999,
                          pointerEvents: 'none',
                          minWidth: '100px',
                          textAlign: 'center',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                        }}
                      >
                        <Typography variant="body2" sx={{
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '12px',
                          lineHeight: 1.2
                        }}>
                          {realtimeData.chartData.slice(-24)[hoveredBar]?.views?.toLocaleString()} views
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>


          </Box>
        </Box>

        {/* KPI Performance Cards Container - Below Hero Section */}
        <Box sx={{
          px: { xs: 1, md: 3 },
          py: { xs: 2, md: 4 },
          pt: { xs: 2, md: 4 },
          mb: { xs: 2, md: 4 },
          mt: 0, // Remove negative margin to separate from hero section
          overflow: 'hidden'
        }}>
          {/* Compact KPI Performance Cards - 4 Grouped Cards */}
          <Box sx={{
            display: { xs: 'grid', md: 'flex' },
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: { xs: 1.5, md: 2 },
            flex: 1,
            minWidth: 0,
            '& > *': {
              flex: { md: '1 1 0' },
              minWidth: 0
            }
          }}>

            {/* Performance Overview Card - Total Views + Submissions */}
            <Box sx={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.15) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(102, 126, 234, 0.4)',
              borderRadius: 1,
              p: { xs: 0.75, md: 1 },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 12px 40px rgba(102, 126, 234, 0.3)',
                border: '1px solid rgba(102, 126, 234, 0.6)',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.35) 0%, rgba(118, 75, 162, 0.2) 100%)',
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
              <Typography sx={{
                color: 'white',
                fontWeight: 700,
                fontSize: { xs: '0.65rem', md: '0.75rem' },
                letterSpacing: '0.5px',
                mb: 1,
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {isMobile ? 'PERF OVERVIEW' : 'PERFORMANCE OVERVIEW'}
              </Typography>

              {/* Total Views */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="h5" sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800,
                  fontSize: { xs: '1.2rem', md: '1.8rem' },
                  lineHeight: 1,
                  textAlign: 'center',
                  filter: 'drop-shadow(0 2px 8px rgba(102, 126, 234, 0.4))'
                }}>
                  {formatNumber(analyticsData?.totalViews || 0)}
                </Typography>
                <Typography sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: { xs: '0.55rem', md: '0.7rem' },
                  textAlign: 'center',
                  mt: 0.25,
                  lineHeight: 1.2
                }}>
                  Total Views
                </Typography>
              </Box>

              {/* Submissions */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 1,
                p: 0.75
              }}>
                <Box>
                  <Typography sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.65rem'
                  }}>
                    SUBMISSIONS
                  </Typography>
                  <Typography sx={{
                    color: '#667eea',
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}>
                    {analyticsData?.totalSubmissions || analyticsData?.topVideos?.length || 0}
                  </Typography>
                </Box>
                {analyticsData?.summary?.progressToTarget !== undefined && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '0.6rem'
                    }}>
                      TARGET
                    </Typography>
                    <Typography sx={{
                      color: '#667eea',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}>
                      {analyticsData.summary.progressToTarget.toFixed(0)}%
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Viral Performance Card - Mega Virals + Virals + Almost Virals */}
            <Box
              onClick={() => handleOpenVideoModal('virals')}
              sx={{
                background: 'linear-gradient(135deg, rgba(255, 87, 34, 0.25) 0%, rgba(255, 215, 0, 0.15) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 87, 34, 0.4)',
                borderRadius: 1,
                p: { xs: 0.75, md: 1 },
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 32px rgba(255, 87, 34, 0.2)',
                '&:hover': {
                  transform: 'translateY(-1px) scale(1.005)',
                  boxShadow: '0 12px 40px rgba(255, 87, 34, 0.4)',
                  border: '1px solid rgba(255, 87, 34, 0.6)',
                  background: 'linear-gradient(135deg, rgba(255, 87, 34, 0.35) 0%, rgba(255, 215, 0, 0.2) 100%)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #FF5722, #FFD700)',
                }
              }}>
              <Typography sx={{
                color: 'white',
                fontWeight: 700,
                fontSize: { xs: '0.65rem', md: '0.75rem' },
                letterSpacing: '0.5px',
                mb: 1,
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {isMobile ? 'VIRALS' : 'VIRAL PERFORMANCE'}
              </Typography>

              {/* Viral Categories */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {/* Mega Virals */}
                {analyticsData?.megaViralsCount > 0 && (
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: 0.5,
                    p: 0.5
                  }}>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.55rem', md: '0.65rem' } }}>
                      {isMobile ? 'MEGA' : 'MEGA VIRALS'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ color: '#FFD700', fontWeight: 700, fontSize: { xs: '0.75rem', md: '0.9rem' } }}>
                        {analyticsData.megaViralsCount}
                      </Typography>
                      <Typography sx={{ color: '#FFD700', fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                        {analyticsData.megaViralsPercentage}%
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Virals */}
                {analyticsData?.viralsCount > 0 && (
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 87, 34, 0.1)',
                    borderRadius: 0.5,
                    p: 0.5
                  }}>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                      VIRALS
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ color: '#FF5722', fontWeight: 700, fontSize: '0.9rem' }}>
                        {analyticsData.viralsCount}
                      </Typography>
                      <Typography sx={{ color: '#FF5722', fontSize: '0.7rem' }}>
                        {analyticsData.viralsPercentage}%
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Almost Virals */}
                {analyticsData?.almostViralsCount > 0 && (
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 152, 0, 0.1)',
                    borderRadius: 0.5,
                    p: 0.5
                  }}>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                      ALMOST VIRALS
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ color: '#FF9800', fontWeight: 700, fontSize: '0.9rem' }}>
                        {analyticsData.almostViralsCount}
                      </Typography>
                      <Typography sx={{ color: '#FF9800', fontSize: '0.7rem' }}>
                        {analyticsData.almostViralsPercentage}%
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Total Viral Rate */}
              <Box sx={{
                mt: 1,
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 1,
                p: 0.5
              }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.6rem' }}>
                  TOTAL VIRAL RATE
                </Typography>
                <Typography sx={{ color: '#FF5722', fontWeight: 800, fontSize: '1.2rem' }}>
                  {((analyticsData?.megaViralsCount || 0) + (analyticsData?.viralsCount || 0) + (analyticsData?.almostViralsCount || 0) > 0 && analyticsData?.totalSubmissions > 0)
                    ? Math.round(((analyticsData.megaViralsCount + analyticsData.viralsCount + analyticsData.almostViralsCount) / analyticsData.totalSubmissions) * 100)
                    : 0}%
                </Typography>
              </Box>
            </Box>

            {/* Content Quality Card - Decent Videos + Flops */}
            <Box
              onClick={() => handleOpenVideoModal('decentVideos')}
              sx={{
                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.25) 0%, rgba(158, 158, 158, 0.15) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                borderRadius: 1,
                p: { xs: 0.75, md: 1 },
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 32px rgba(76, 175, 80, 0.2)',
                '&:hover': {
                  transform: 'translateY(-1px) scale(1.005)',
                  boxShadow: '0 12px 40px rgba(76, 175, 80, 0.4)',
                  border: '1px solid rgba(76, 175, 80, 0.6)',
                  background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.35) 0%, rgba(158, 158, 158, 0.2) 100%)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #4CAF50, #9E9E9E)',
                }
              }}>
              <Typography sx={{
                color: 'white',
                fontWeight: 700,
                fontSize: { xs: '0.65rem', md: '0.75rem' },
                letterSpacing: '0.5px',
                mb: 1,
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {isMobile ? 'CONTENT' : 'CONTENT QUALITY'}
              </Typography>

              {/* Decent Videos */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(76, 175, 80, 0.1)',
                borderRadius: 0.5,
                p: 0.75,
                mb: 0.75
              }}>
                <Box>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                    DECENT VIDEOS
                  </Typography>
                  <Typography sx={{ color: '#4CAF50', fontWeight: 700, fontSize: '1.2rem' }}>
                    {analyticsData?.decentVideosCount || 0}
                  </Typography>
                </Box>
                <Typography sx={{ color: '#4CAF50', fontSize: '0.8rem', fontWeight: 600 }}>
                  {analyticsData?.decentVideosPercentage || 0}%
                </Typography>
              </Box>

              {/* Flops */}
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(158, 158, 158, 0.1)',
                borderRadius: 0.5,
                p: 0.75
              }}>
                <Box>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                    FLOPS
                  </Typography>
                  <Typography sx={{ color: '#9E9E9E', fontWeight: 700, fontSize: '1.2rem' }}>
                    {analyticsData?.flopsCount || 0}
                  </Typography>
                </Box>
                <Typography sx={{ color: '#9E9E9E', fontSize: '0.8rem', fontWeight: 600 }}>
                  {analyticsData?.flopsPercentage || 0}%
                </Typography>
              </Box>

              {/* Quality Score */}
              <Box sx={{
                mt: 1,
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 1,
                p: 0.5
              }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.6rem' }}>
                  QUALITY SCORE
                </Typography>
                <Typography sx={{ color: '#4CAF50', fontWeight: 800, fontSize: '1.2rem' }}>
                  {analyticsData?.totalSubmissions > 0
                    ? Math.round(((analyticsData?.decentVideosCount || 0) / analyticsData.totalSubmissions) * 100)
                    : 0}%
                </Typography>
              </Box>
            </Box>

            {/* Analytics Insights Card - Daily Avg + Average Views + Median Views */}
            <Box sx={{
              background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.25) 0%, rgba(156, 39, 176, 0.15) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(33, 150, 243, 0.4)',
              borderRadius: 1,
              p: { xs: 0.75, md: 1 },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 32px rgba(33, 150, 243, 0.15)',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 12px 40px rgba(33, 150, 243, 0.3)',
                border: '1px solid rgba(33, 150, 243, 0.6)',
                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.35) 0%, rgba(156, 39, 176, 0.2) 100%)',
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, #2196F3, #9C27B0)',
              }
            }}>
              <Typography sx={{
                color: 'white',
                fontWeight: 700,
                fontSize: { xs: '0.65rem', md: '0.75rem' },
                letterSpacing: '0.5px',
                mb: 1,
                textAlign: 'center',
                lineHeight: 1.2
              }}>
                {isMobile ? 'ANALYTICS' : 'ANALYTICS INSIGHTS'}
              </Typography>

              {/* Analytics Metrics */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {/* Daily Average */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(33, 150, 243, 0.1)',
                  borderRadius: 0.5,
                  p: 0.5
                }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                    DAILY AVG
                  </Typography>
                  <Typography sx={{ color: '#2196F3', fontWeight: 700, fontSize: '0.9rem' }}>
                    {formatNumber(analyticsData?.avgDailyViews || 0)}
                  </Typography>
                </Box>

                {/* Average Views */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(76, 175, 80, 0.1)',
                  borderRadius: 0.5,
                  p: 0.5
                }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                    AVG VIEWS
                  </Typography>
                  <Typography sx={{ color: '#4CAF50', fontWeight: 700, fontSize: '0.9rem' }}>
                    {formatNumber(analyticsData?.avgVideoViews || 0)}
                  </Typography>
                </Box>

                {/* Median Views */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(156, 39, 176, 0.1)',
                  borderRadius: 0.5,
                  p: 0.5
                }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.65rem' }}>
                    MEDIAN VIEWS
                  </Typography>
                  <Typography sx={{ color: '#9C27B0', fontWeight: 700, fontSize: '0.9rem' }}>
                    {formatNumber(analyticsData?.medianVideoViews || 0)}
                  </Typography>
                </Box>
              </Box>

              {/* Performance Indicator */}
              <Box sx={{
                mt: 1,
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 1,
                p: 0.5
              }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.6rem' }}>
                  PERFORMANCE TREND
                </Typography>
                <Typography sx={{
                  color: analyticsData?.avgVideoViews > analyticsData?.medianVideoViews ? '#4CAF50' : '#FF9800',
                  fontWeight: 800,
                  fontSize: '0.8rem'
                }}>
                  {analyticsData?.avgVideoViews > analyticsData?.medianVideoViews ? '↗ ABOVE MEDIAN' : '↘ BELOW MEDIAN'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Top Content Section */}
        <Box sx={{ mt: 4, px: 3 }}>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
            Top Content
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



          {/* Top Content Carousel */}
          {analyticsData?.topVideos && analyticsData.topVideos.length > 0 ? (
            <TopContentCarousel
              videos={analyticsData.topVideos}
              onVideoClick={(video) => {
                // Handle video click if needed
                console.log('Video clicked:', video);
              }}
            />
          ) : (
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
          )}
        </Box>

        {/* Video Details Modal */}
        <VideoDetailsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          category={modalCategory}
          loading={modalLoading}
          analyticsData={analyticsData}
        />
      </Box>
    </Layout>
  );
};

export default AnalyticsUpdated;
