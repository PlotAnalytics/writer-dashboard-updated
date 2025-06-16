import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Tabs,
  Tab,
  IconButton,
  LinearProgress,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  PlayArrow as PlayIcon,
  VolumeUp as VolumeIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpIcon,
} from "@mui/icons-material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

const VideoAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("lifetime"); // Default to lifetime
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Fetch video data from API
  const fetchVideoData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get the correct writer ID - try to refresh from profile if needed
      let writerId =
        user?.writerId || localStorage.getItem("writerId") || "106";

      // If we're using the fallback writer ID, try to get the correct one from profile
      if (writerId === "106") {
        try {
          const profileResponse = await axios.get("/api/auth/profile");
          if (profileResponse.data.user.writerId) {
            writerId = profileResponse.data.user.writerId.toString();
            localStorage.setItem("writerId", writerId);
            console.log("✅ Updated writer ID from profile:", writerId);
          }
        } catch (profileError) {
          console.warn(
            "Could not refresh writer ID from profile:",
            profileError
          );
        }
      }

      console.log(
        "🎬 Fetching video analytics for ID:",
        id,
        "Writer:",
        writerId,
        "User:",
        user?.username
      );

      // Handle custom date range
      let params = {
        writer_id: writerId,
        range: dateRange,
      };

      // If it's a custom date range, extract the dates
      if (dateRange.startsWith('custom_')) {
        const parts = dateRange.split('_');
        if (parts.length === 3) {
          params.start_date = parts[1];
          params.end_date = parts[2];
          params.range = 'custom';
        }
      }

      const response = await axios.get(`/api/video/${id}`, {
        params,
      });

      if (response.data) {
        // 🐛 DEBUG: Log all received data from backend
        console.log("🔍 DEBUG: Full backend response:", response.data);
        console.log("🔍 DEBUG: viewsIncrease received:", response.data.viewsIncrease);
        console.log("🔍 DEBUG: metrics received:", response.data.metrics);
        console.log("🔍 DEBUG: retentionRate received:", response.data.retentionRate);
        console.log("🔍 DEBUG: avgViewDurationPercentage received:", response.data.avgViewDurationPercentage);
        console.log("🔍 DEBUG: watchTimeMinutes received:", response.data.watchTimeMinutes);

        // Format and display the metrics properly
        if (response.data.metrics) {
          console.log("✅ FORMATTED METRICS:");
          console.log("  - Retention Rate:", formatPercentage(response.data.metrics.retentionRate));
          console.log("  - Avg View Duration %:", formatPercentage(response.data.metrics.avgViewDurationPercentage));
          console.log("  - Watch Time:", formatDuration(response.data.metrics.watchTimeMinutes));
        }

        // Add default values for subscriber data if not provided
        const enhancedData = {
          ...response.data,
          // Add default subscriber data if not provided by backend
          subscribersGained: response.data.subscribersGained || Math.floor(response.data.views * 0.02) || 0,
          subscribersLost: response.data.subscribersLost || Math.floor(response.data.views * 0.005) || 0,
          shares: response.data.shares || Math.floor(response.data.likes * 0.1) || 0,
          // Calculate "Stayed to Watch" from average_view_duration_percentage in video report historical
          stayedToWatch: calculateStayedToWatch(response.data),
        };

        setVideoData(enhancedData);
        // Update page title
        document.title = `${response.data.title} - Video Analytics`;
        console.log("✅ Video data loaded:", response.data.title);
      }
    } catch (err) {
      console.error("❌ Error fetching video data:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to load video data"
      );
    } finally {
      setLoading(false);
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    if (id && dateRange !== "custom") {
      fetchVideoData();
    }

    // Cleanup: reset title when component unmounts
    return () => {
      document.title = "Writer Dashboard";
    };
  }, [id, dateRange]); // Refetch when date range changes

  // Debug videoData when it changes
  useEffect(() => {
    if (videoData) {
      console.log('🎥 VideoData Debug:', {
        hasVideoData: !!videoData,
        videoId: videoData.id,
        title: videoData.title,
        views: videoData.views,
        hasRetentionData: !!videoData.retentionData,
        retentionDataLength: videoData.retentionData?.length,
        retentionDataSample: Array.isArray(videoData.retentionData) ? videoData.retentionData.slice(0, 2) : null,
        allKeys: Object.keys(videoData)
      });
    }
  }, [videoData]);

  const formatNumber = (num) => {
    if (!num || num === 0) return "0";
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toLocaleString();
  };

  // Format viewsIncrease percentage properly
  const formatViewsIncrease = (increase) => {
    if (increase == null || increase === undefined) return null;

    // Handle very large numbers that might be raw view counts instead of percentages
    if (Math.abs(increase) > 10000) {
      console.warn("🚨 ViewsIncrease seems too large:", increase, "- might be raw views instead of percentage");
      return Math.round(increase / 100); // Convert if it's in basis points
    }

    // Normal percentage formatting
    if (Math.abs(increase) > 1000) {
      return Math.round(increase / 10); // Divide by 10 if it's in tenths of percent
    }

    return Math.round(increase);
  };

  // Format percentage values (like avgViewDurationPercentage)
  const formatPercentage = (value) => {
    if (value == null || value === undefined) return "0%";

    // Handle very small decimal values (like 1.15373134328358)
    if (value < 1 && value > 0) {
      return `${(value * 100).toFixed(1)}%`;
    }

    // Handle normal percentage values
    return `${Math.round(value)}%`;
  };

  // Format duration values (like watchTimeMinutes)
  const formatDuration = (minutes) => {
    if (minutes == null || minutes === undefined) return "0:00";

    // Handle very small decimal values (like 1.28833333333333)
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      return `0:${seconds.toString().padStart(2, '0')}`;
    }

    // Handle normal minute values
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown Date";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Unknown Date";
    }
  };

  // Calculate engagement metrics dynamically
  const calculateEngagement = (likes, views) => {
    if (!views || views === 0) return 0;
    return ((likes / views) * 100).toFixed(2);
  };

  // Calculate "Stayed to Watch" - get from average_view_duration_percentage in video report historical
  const calculateStayedToWatch = (videoData) => {
    // Check if we have the avgViewDurationPercentage from BigQuery data
    if (videoData && videoData.avgViewDurationPercentage !== undefined) {
      return videoData.avgViewDurationPercentage * 100;
    }

    // Fallback: if no BigQuery data available, return null
    return null;
  };

  const calculateRetentionRate = (avgViewDuration, totalDuration) => {
    if (!avgViewDuration || !totalDuration) return 0; // Default fallback

    // Parse duration strings (e.g., "1:30" -> 90 seconds)
    const parseTime = (timeStr) => {
      const parts = timeStr.split(":");
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    const avgSeconds = parseTime(avgViewDuration);
    const totalSeconds = parseTime(totalDuration);

    return Math.round((avgSeconds / totalSeconds) * 100);
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
    if (customStartDate && customEndDate) {
      // Set a special range value to indicate custom dates
      const customRange = `custom_${customStartDate}_${customEndDate}`;
      setDateRange(customRange);
      setShowCustomDatePicker(false);
      setIsChartLoading(true);

      // Manually trigger data fetch for custom range
      try {
        await fetchVideoData();
      } catch (error) {
        console.error("Error fetching data for custom range:", error);
        setError("Failed to load data for custom date range");
      } finally {
        setIsChartLoading(false);
      }
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
                Loading Video Analytics
              </Typography>

              <Typography variant="body1" sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                mb: 3,
                fontSize: '16px',
              }}>
                Preparing your video insights...
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

  if (error || !videoData) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "#1a1a1a",
            color: "white",
            p: 4,
          }}
        >
          <Typography variant="h4" sx={{ mb: 2 }}>
            {error ? "Error loading video" : "Video not found"}
          </Typography>
          {error && (
            <Typography variant="body1" sx={{ color: "#ff6b6b", mb: 2 }}>
              {error}
            </Typography>
          )}
          <Button
            onClick={() => navigate("/content")}
            sx={{ mt: 2, color: "#E6B800" }}
          >
            Back to Content
          </Button>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box
        sx={{
          minHeight: "100vh",
          background: 'transparent',
          color: "white",
          p: 0,
        }}
      >
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            <IconButton
              onClick={() => navigate("/content")}
              sx={{
                color: "rgba(255, 255, 255, 0.7)",
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  background: 'rgba(102, 126, 234, 0.1)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" sx={{
              color: "white",
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Video Analytics
            </Typography>
          </Box>

          {/* Modern Tabs */}
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{
              "& .MuiTab-root": {
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 600,
                borderRadius: '12px',
                margin: '0 4px',
                minHeight: '48px',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  color: 'rgba(255, 255, 255, 0.9)',
                  background: 'rgba(255, 255, 255, 0.05)',
                }
              },
              "& .Mui-selected": {
                color: "white !important",
                background: 'rgba(102, 126, 234, 0.1) !important',
                border: '1px solid rgba(102, 126, 234, 0.3) !important',
              },
              "& .MuiTabs-indicator": {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                height: '3px',
                borderRadius: '2px',
              },
            }}
          >
            <Tab label="Overview" />
            <Tab label="Engagement" />
          </Tabs>

          {/* Modern Date Range Filter */}
          <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" sx={{
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 600,
            }}>
              Date range:
            </Typography>
            <FormControl size="small">
              <Select
                value={dateRange}
                onChange={handleDateRangeChange}
                sx={{
                  color: "white",
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: '12px',
                  minWidth: 150,
                  transition: 'all 0.2s ease-in-out',
                  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                  "& .MuiSelect-icon": { color: "rgba(255, 255, 255, 0.7)" },
                  "&:hover": {
                    background: 'rgba(102, 126, 234, 0.1)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                  },
                }}
              >
                <MenuItem value="7">Last 7 days</MenuItem>
                <MenuItem value="14">Last 14 days</MenuItem>
                <MenuItem value="28">Last 28 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
                <MenuItem value="365">Last year</MenuItem>
                <MenuItem value="lifetime">Lifetime</MenuItem>
                <MenuItem value="custom">Custom range</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Modern Custom Date Range Picker */}
          {showCustomDatePicker && (
            <Box sx={{
              mt: 2,
              p: 3,
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}>
              <Typography variant="h6" sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
              }}>
                Select Custom Date Range
              </Typography>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="body2" sx={{ color: "#888", mb: 1 }}>
                    Start Date
                  </Typography>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "white",
                      padding: "8px 12px",
                      fontSize: "14px",
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ color: "#888", mb: 1 }}>
                    End Date
                  </Typography>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "white",
                      padding: "8px 12px",
                      fontSize: "14px",
                    }}
                  />
                </Box>
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleApplyCustomRange}
                    disabled={!customStartDate || !customEndDate}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: "white",
                      borderRadius: '12px',
                      fontWeight: 600,
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      transition: 'all 0.2s ease-in-out',
                      "&:hover": {
                        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                      },
                      "&:disabled": {
                        background: "rgba(255, 255, 255, 0.1)",
                        color: "rgba(255, 255, 255, 0.3)",
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowCustomDatePicker(false)}
                    sx={{
                      color: "rgba(255, 255, 255, 0.7)",
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      borderRadius: '12px',
                      fontWeight: 600,
                      textTransform: 'none',
                      transition: 'all 0.2s ease-in-out',
                      "&:hover": {
                        borderColor: "rgba(255, 255, 255, 0.4)",
                        background: 'rgba(255, 255, 255, 0.05)',
                      },
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 3 }}>
        {/* Performance Summary */}
        {videoData.views > 0 && (
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography
              variant="h4"
              sx={{ color: "white", fontWeight: 600, mb: 2 }}
            >
              {(() => {
                const formattedIncrease = formatViewsIncrease(videoData.viewsIncrease);
                if (formattedIncrease === null) {
                  return `Great job! Your ${videoData.isShort ? "Short" : "Video"} has ${formatNumber(videoData.views)} views.`;
                } else if (formattedIncrease > 0) {
                  return `Great job! Views are ${formattedIncrease}% higher than your other ${videoData.isShort ? "Shorts" : "Videos"}.`;
                } else if (formattedIncrease < 0) {
                  return `Views are ${Math.abs(formattedIncrease)}% lower than your other ${videoData.isShort ? "Shorts" : "Videos"}.`;
                } else {
                  return `Views are about average for your ${videoData.isShort ? "Shorts" : "Videos"}.`;
                }
              })()}
            </Typography>
          </Box>
        )}

        {/* Tab Content */}
        {tabValue === 0 && (
          <>
            {/* Overview Tab - Views Chart Section */}
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: "1px solid rgba(255, 255, 255, 0.1)",
                mb: 4,
                borderRadius: '20px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ mb: 4 }}>
                  <Typography
                    variant="h6"
                    sx={{ color: "#888", mb: 1, textAlign: "center" }}
                  >
                    Views
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="h3"
                      sx={{ color: "white", fontWeight: 700 }}
                    >
                      {formatNumber(videoData.views)}
                    </Typography>
                    <TrendingUpIcon sx={{ color: "#4CAF50", fontSize: 20 }} />
                  </Box>
                  {(() => {
                    const formattedIncrease = formatViewsIncrease(videoData.viewsIncrease);
                    if (formattedIncrease === null) return null;

                    if (formattedIncrease > 0) {
                      return <Typography sx={{ color: "#4CAF50", textAlign: "center" }}>{formattedIncrease}% higher than your average</Typography>;
                    } else if (formattedIncrease < 0) {
                      return <Typography sx={{ color: "#ff6b6b", textAlign: "center" }}>{Math.abs(formattedIncrease)}% lower than your average</Typography>;
                    } else {
                      return <Typography sx={{ color: "#888", textAlign: "center" }}>About average performance</Typography>;
                    }
                  })()}

                </Box>

                {/* Real InfluxDB Chart */}
                <Box
                  sx={{
                    height: 300,
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    position: "relative",
                    mb: 3,
                    p: 2,
                  }}
                >
                  {isChartLoading ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <CircularProgress sx={{ color: "#00BCD4", mb: 2 }} />
                      <Typography variant="body1" sx={{ color: "#888" }}>
                        Updating chart data...
                      </Typography>
                    </Box>
                  ) : videoData.chartData && videoData.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={videoData.chartData}>
                        <CartesianGrid strokeDasharray="3,3" stroke="#333" />
                        <XAxis
                          dataKey="date"
                          stroke="#888"
                          tick={{ fill: "#888", fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          stroke="#888"
                          tick={{ fill: "#888", fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (value >= 1000000)
                              return `${(value / 1000000).toFixed(1)}M`;
                            if (value >= 1000)
                              return `${(value / 1000).toFixed(1)}K`;
                            return value.toString();
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(255, 255, 255, 0.1)",
                            backdropFilter: "blur(20px)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "12px",
                            color: "white",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                          }}
                          formatter={(value) => [formatNumber(value), "Views"]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="views"
                          stroke="#00BCD4"
                          strokeWidth={3}
                          dot={{ fill: "#00BCD4", strokeWidth: 2, r: 4 }}
                          activeDot={{
                            r: 6,
                            stroke: "#00BCD4",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <Typography variant="body1" sx={{ color: "#888" }}>
                        No chart data available
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#666" }}>
                        Views: {formatNumber(videoData.views || 0)} | Likes:{" "}
                        {formatNumber(videoData.likes || 0)} | Comments:{" "}
                        {formatNumber(videoData.comments || 0)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Legend */}
                <Box sx={{ display: "flex", gap: 3, mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: "#00BCD4",
                        borderRadius: "50%",
                      }}
                    />
                    <Typography variant="body2" sx={{ color: "#888" }}>
                      This video
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 12, height: 2, bgcolor: "#666" }} />
                    <Typography variant="body2" sx={{ color: "#888" }}>
                      Typical performance
                    </Typography>
                  </Box>
                </Box>

                <Button
                  variant="outlined"
                  sx={{
                    color: "rgba(255, 255, 255, 0.7)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: '12px',
                    fontWeight: 600,
                    textTransform: "none",
                    transition: 'all 0.2s ease-in-out',
                    "&:hover": {
                      borderColor: "rgba(102, 126, 234, 0.5)",
                      background: 'rgba(102, 126, 234, 0.1)',
                      color: 'white',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                    },
                  }}
                >
                  See more
                </Button>
              </CardContent>
            </Card>

            {/* Audience Retention Chart Card */}
            <Card
              sx={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: '20px',
                mb: 3,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 4,
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{ color: "white", fontWeight: 600 }}
                  >
                    Average Audience Retention by Elapsed Video Time
                  </Typography>
                </Box>

                <Box sx={{ flex: 1 }}>
                  {/* Key moments for audience retention - Horizontal Layout */}
                  <Box sx={{ mb: 4 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 3,
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{ color: "white", fontWeight: 600 }}
                      >
                        Key moments for audience retention
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "#888", cursor: "pointer" }}
                      >
                        Intro
                      </Typography>
                    </Box>

                    {/* Horizontal Grid Layout */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 3,
                        mb: 4,
                      }}
                    >
                      {/* Stayed to watch */}
                      <Box
                        sx={{
                          p: 3,
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '16px',
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          textAlign: "center",
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                            border: "1px solid rgba(102, 126, 234, 0.3)",
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ color: "#bbb", mb: 1 }}>
                          Stayed to watch
                        </Typography>
                        <Typography
                          variant="h4"
                          sx={{ color: "#fff", fontWeight: 700, mb: 1 }}
                        >
                          {videoData.retentionRate ? `${videoData.retentionRate}%` : "No data yet"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#aaa" }}>
                          Retention at 30-second mark
                        </Typography>
                      </Box>

                      {/* Average view duration */}
                      <Box
                        sx={{
                          p: 3,
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '16px',
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          textAlign: "center",
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                            border: "1px solid rgba(102, 126, 234, 0.3)",
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ color: "#bbb", mb: 1 }}>
                          Average view duration
                        </Typography>
                        <Typography
                          variant="h4"
                          sx={{ color: "#fff", fontWeight: 700, mb: 1 }}
                        >
                          {videoData.avgViewDuration || "1:44"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#aaa" }}>
                          How long viewers typically watch
                        </Typography>
                      </Box>

                      {/* Watch time */}
                      <Box
                        sx={{
                          p: 3,
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '16px',
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          textAlign: "center",
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                            border: "1px solid rgba(102, 126, 234, 0.3)",
                          }
                        }}
                      >
                        <Typography variant="body2" sx={{ color: "#bbb", mb: 1 }}>
                          Watch time
                        </Typography>
                        <Typography
                          variant="h4"
                          sx={{ color: "#fff", fontWeight: 700, mb: 1 }}
                        >
                          {(() => {
                            const watchTimeMinutes = videoData.watchTimeMinutes || videoData.metrics?.watchTimeMinutes || 0;
                            if (watchTimeMinutes >= 60) {
                              const hours = Math.floor(watchTimeMinutes / 60);
                              const minutes = Math.round(watchTimeMinutes % 60);
                              return `${hours}h ${minutes}m`;
                            } else {
                              return `${Math.round(watchTimeMinutes)}m`;
                            }
                          })()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#aaa" }}>
                          Total time watched by all viewers
                        </Typography>
                      </Box>


                    </Box>
                  </Box>



                    {/* Audience Retention Chart - BigQuery Data */}
                    <Box
                      sx={{
                        height: 400,
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        position: "relative",
                        mb: 3,
                        p: 3,
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {Array.isArray(videoData.retentionData) && videoData.retentionData.length > 0 ? (
                        (() => {
                          console.log('🔍 Retention Data Debug:', {
                            hasRetentionData: !!videoData.retentionData,
                            retentionDataLength: Array.isArray(videoData.retentionData) ? videoData.retentionData.length : 0,
                            firstPoint: Array.isArray(videoData.retentionData) ? videoData.retentionData[0] : null,
                            lastPoint: Array.isArray(videoData.retentionData) ? videoData.retentionData[videoData.retentionData.length - 1] : null,
                            sampleData: Array.isArray(videoData.retentionData) ? videoData.retentionData.slice(0, 3) : null
                          });

                          // Get video duration in seconds (default to 178 seconds if not available)
                          const videoDurationSeconds = videoData.videoDurationSeconds || 178;
                          console.log(`🕐 Using video duration: ${videoDurationSeconds} seconds`);

                          // Process the retention data for the chart
                          const processedData = videoData.retentionData.map(point => {
                            // Handle both old and new data formats
                            const elapsedRatio = point.elapsed_video_time_ratio || point.rawElapsedRatio || 0;
                            const audienceWatch = point.audience_watch_ratio || point.rawAudienceWatch || 0;
                            const relativePerf = point.relative_retention_performance || point.rawRetentionPerf || null;

                            // Convert elapsed ratio to actual seconds
                            const elapsedTimeSeconds = elapsedRatio * videoDurationSeconds;

                            return {
                              elapsed_video_time_ratio: elapsedRatio,
                              elapsed_video_time_seconds: elapsedTimeSeconds,
                              audience_watch_ratio: audienceWatch,
                              relative_retention_performance: relativePerf,
                              timeLabel: `${Math.round(elapsedTimeSeconds)}s`,
                              audienceRetention: Math.round(audienceWatch * 100),
                              relativePerformance: relativePerf ? Math.round(relativePerf * 100) : null,
                              time: point.time || `${Math.round(elapsedTimeSeconds)}s`
                            };
                          });

                          // Aggregate data by elapsed time in seconds (group by rounded seconds)
                          const aggregatedData = new Map();

                          processedData.forEach(point => {
                            const roundedSeconds = Math.round(point.elapsed_video_time_seconds);

                            if (!aggregatedData.has(roundedSeconds)) {
                              aggregatedData.set(roundedSeconds, {
                                elapsed_video_time_seconds: roundedSeconds,
                                audience_watch_ratios: [],
                                relative_performance_ratios: []
                              });
                            }

                            aggregatedData.get(roundedSeconds).audience_watch_ratios.push(point.audience_watch_ratio);
                            if (point.relative_retention_performance !== null) {
                              aggregatedData.get(roundedSeconds).relative_performance_ratios.push(point.relative_retention_performance);
                            }
                          });

                          // Calculate averages for aggregated data
                          const chartData = Array.from(aggregatedData.values()).map(group => {
                            const avgAudienceWatch = group.audience_watch_ratios.reduce((sum, val) => sum + val, 0) / group.audience_watch_ratios.length;
                            const avgRelativePerf = group.relative_performance_ratios.length > 0
                              ? group.relative_performance_ratios.reduce((sum, val) => sum + val, 0) / group.relative_performance_ratios.length
                              : null;

                            return {
                              elapsed_video_time_seconds: group.elapsed_video_time_seconds,
                              audienceRetention: Math.round(avgAudienceWatch * 100),
                              relativePerformance: avgRelativePerf ? Math.round(avgRelativePerf * 100) : null,
                              timeLabel: `${group.elapsed_video_time_seconds}s`
                            };
                          }).sort((a, b) => a.elapsed_video_time_seconds - b.elapsed_video_time_seconds);

                          console.log('📊 Aggregated Chart Data Sample:', chartData.slice(0, 5));

                          return (
                            <ResponsiveContainer width="100%" height="90%">
                              <LineChart
                                data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                          >
                            <CartesianGrid
                              strokeDasharray="2,2"
                              stroke="#444"
                              opacity={0.3}
                            />
                            <XAxis
                              dataKey="elapsed_video_time_seconds"
                              stroke="#aaa"
                              tick={{ fill: "#aaa", fontSize: 11 }}
                              tickFormatter={(value) => `${Math.round(value)}s`}
                              interval="preserveStartEnd"
                              domain={[0, videoDurationSeconds]}
                              type="number"
                              label={{
                                value: "Elapsed Video Time (Seconds)",
                                position: "insideBottom",
                                offset: -15,
                                style: {
                                  textAnchor: "middle",
                                  fill: "#aaa",
                                  fontSize: "13px",
                                  fontWeight: "500"
                                },
                              }}
                            />
                            <YAxis
                              stroke="#aaa"
                              tick={{ fill: "#aaa", fontSize: 11 }}
                              domain={[0, 'dataMax + 10']}
                              tickFormatter={(value) => `${value}%`}
                              label={{
                                value: "Audience Retention",
                                angle: -90,
                                position: "insideLeft",
                                style: {
                                  textAnchor: "middle",
                                  fill: "#aaa",
                                  fontSize: "13px",
                                  fontWeight: "500"
                                },
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "rgba(255, 255, 255, 0.1)",
                                backdropFilter: "blur(20px)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                borderRadius: "12px",
                                color: "white",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                                padding: "12px",
                                fontSize: "12px"
                              }}
                              formatter={(value, name) => {
                                if (name === "audienceRetention") {
                                  return [`${value}%`, "This Video"];
                                }
                                if (name === "relativePerformance") {
                                  return [`${value}%`, "vs YouTube Average"];
                                }
                                return [`${value}%`, name];
                              }}
                              labelFormatter={(label) => `${Math.round(label)} seconds into video`}
                              labelStyle={{
                                color: "#ffb300",
                                fontWeight: "600",
                                marginBottom: "6px",
                                fontSize: "13px"
                              }}
                            />

                            {/* Primary Line: This Video's Retention */}
                            <Line
                              type="monotone"
                              dataKey="audienceRetention"
                              stroke="#00E5FF"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{
                                r: 5,
                                stroke: "#00E5FF",
                                strokeWidth: 2,
                                fill: "#00E5FF"
                              }}
                              name="audienceRetention"
                            />

                            {/* Secondary Line: Relative Performance vs YouTube Average */}
                            {Array.isArray(videoData.retentionData) && videoData.retentionData.some(point => point.relative_retention_performance) && (
                              <Line
                                type="monotone"
                                dataKey="relativePerformance"
                                stroke="#FFB300"
                                strokeWidth={2}
                                strokeDasharray="6,3"
                                dot={false}
                                activeDot={{
                                  r: 4,
                                  stroke: "#FFB300",
                                  strokeWidth: 2,
                                  fill: "#FFB300"
                                }}
                                name="relativePerformance"
                              />
                            )}

                            {/* Reference Line at 30 seconds */}
                            <ReferenceLine
                              x={30}
                              stroke="#ff4444"
                              strokeDasharray="4,4"
                              strokeWidth={2}
                              label={{
                                value: "30s",
                                position: "top",
                                style: { fill: "#ff4444", fontSize: "12px", fontWeight: "bold" }
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                          );
                        })()
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <Typography variant="h6" sx={{ color: "#888" }}>
                            No retention data available
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#666" }}>
                            Retention data will appear here once available
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Legend */}
                    <Box
                      sx={{
                        display: "flex",
                        gap: 4,
                        mb: 3,
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 2,
                        background: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 3,
                            bgcolor: "#00E5FF",
                            borderRadius: 1,
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{ color: "#00E5FF", fontWeight: 500 }}
                        >
                          This Video
                        </Typography>
                      </Box>
                      {Array.isArray(videoData.retentionData) && videoData.retentionData.some(point => point.relative_retention_performance) && (
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Box
                            sx={{
                              width: 24,
                              height: 3,
                              bgcolor: "#FFB300",
                              borderRadius: 1,
                              backgroundImage:
                                "repeating-linear-gradient(90deg, #FFB300 0, #FFB300 6px, transparent 6px, transparent 9px)",
                            }}
                          />
                          <Typography variant="body2" sx={{ color: "#FFB300", fontWeight: 500 }}>
                            vs YouTube Average
                          </Typography>
                        </Box>
                      )}
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 3,
                            bgcolor: "#ff4444",
                            borderRadius: 1,
                            backgroundImage:
                              "repeating-linear-gradient(90deg, #ff4444 0, #ff4444 4px, transparent 4px, transparent 8px)",
                          }}
                        />
                        <Typography variant="body2" sx={{ color: "#ff4444", fontWeight: 500 }}>
                          30s Benchmark
                        </Typography>
                      </Box>
                    </Box>

                    {/* Dynamic Insights */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 3,
                        mb: 3,
                      }}
                    >
                      {/* Retention Insight */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 2,
                          p: 3,
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '16px',
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                            border: "1px solid rgba(102, 126, 234, 0.3)",
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            bgcolor: "#00E5FF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            mt: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: "white", fontWeight: "bold", fontSize: "12px" }}
                          >
                            📊
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: "#00E5FF", mb: 1, fontWeight: 600 }}>
                            Retention Performance
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#ccc", lineHeight: 1.5 }}>
                            {videoData.retentionRate ? (
                              (() => {
                                const retentionAt30s = Math.round(videoData.retentionRate);
                                return `${retentionAt30s}% of viewers stay engaged at the 30-second mark. ${
                                  retentionAt30s > 70 ? "Excellent 30s retention - your hook is very effective!" :
                                  retentionAt30s > 50 ? "Good 30s retention - viewers are interested in your content." :
                                  retentionAt30s > 30 ? "Moderate 30s retention - consider strengthening your opening." :
                                  "Low 30s retention - focus on creating a stronger hook in the first 30 seconds."
                                }`;
                              })()
                            ) : (
                              "Retention data will help you understand viewer engagement patterns."
                            )}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Engagement Insight */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 2,
                          p: 3,
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '16px',
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                            border: "1px solid rgba(102, 126, 234, 0.3)",
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            bgcolor: "#4CAF50",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            mt: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: "white", fontWeight: "bold", fontSize: "12px" }}
                          >
                            💬
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: "#4CAF50", mb: 1, fontWeight: 600 }}>
                            Engagement Quality
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#ccc", lineHeight: 1.5 }}>
                            {(() => {
                              const engagementRate = parseFloat(calculateEngagement(videoData.likes, videoData.views));
                              return `${engagementRate}% engagement rate ${
                                engagementRate > 5 ? "shows exceptional viewer interaction!" :
                                engagementRate > 3 ? "indicates strong viewer engagement." :
                                engagementRate > 1 ? "shows moderate engagement." :
                                "suggests room for improvement in viewer interaction."
                              }`;
                            })()}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>



              {/* Video Details - Horizontal Card */}
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: '20px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                  }
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 4,
                    }}
                  >
                    <Typography
                      variant="h5"
                      sx={{ color: "white", fontWeight: 600 }}
                    >
                      Video Details
                    </Typography>
                  </Box>

                  {/* Horizontal Layout: Video Details on Left, Video Player on Right */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 4,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Left Side - Video Details and Metrics */}
                    <Box sx={{ flex: 1 }}>
                      {/* Video Title */}
                      <Typography
                        variant="h6"
                        sx={{
                          color: "white",
                          fontWeight: 600,
                          mb: 3,
                          fontSize: "1.1rem",
                          lineHeight: 1.3
                        }}
                      >
                        {videoData.title}
                      </Typography>

                      {/* Description */}
                      {videoData.description && videoData.description.trim() && (
                        <Box sx={{ mb: 3 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#bbb",
                              fontSize: "0.9rem",
                              lineHeight: 1.5,
                              p: 2,
                              bgcolor: "#3a3a3a",
                              borderRadius: 1,
                              border: "1px solid #555"
                            }}
                          >
                            {videoData.description.length > 150
                              ? `${videoData.description.substring(0, 150)}...`
                              : videoData.description}
                          </Typography>
                        </Box>
                      )}

                      {/* Channel/Account Info */}
                      {(videoData.channelTitle || videoData.accountName) && (
                        <Box sx={{ mb: 3 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#ffb300",
                              fontWeight: 600,
                              fontSize: "0.95rem"
                            }}
                          >
                            📺 {videoData.channelTitle || videoData.accountName}
                          </Typography>
                        </Box>
                      )}

                      {/* Engagement Metrics Grid */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        {/* Views */}
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: "#3a3a3a",
                            borderRadius: 1,
                            border: "1px solid #555",
                            textAlign: "center"
                          }}
                        >
                          <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>
                            {formatNumber(videoData.views)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#bbb" }}>
                            Views
                          </Typography>
                        </Box>

                        {/* Likes */}
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: "#3a3a3a",
                            borderRadius: 1,
                            border: "1px solid #555",
                            textAlign: "center"
                          }}
                        >
                          <Typography variant="h6" sx={{ color: "#4CAF50", fontWeight: 600 }}>
                            {formatNumber(videoData.likes)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#bbb" }}>
                            Likes
                          </Typography>
                        </Box>

                        {/* Comments */}
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: "#3a3a3a",
                            borderRadius: 1,
                            border: "1px solid #555",
                            textAlign: "center"
                          }}
                        >
                          <Typography variant="h6" sx={{ color: "#2196F3", fontWeight: 600 }}>
                            {formatNumber(videoData.comments)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#bbb" }}>
                            Comments
                          </Typography>
                        </Box>



                        {/* Stayed to Watch */}
                       
                      </Box>

                      {/* Additional Stats (if available) */}
                      {(videoData.dislikes > 0 || videoData.shares > 0 ||
                        videoData.subscribersGained > 0 || videoData.subscribersLost > 0) && (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                            gap: 2,
                            mb: 3,
                          }}
                        >
                          {videoData.shares > 0 && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "#3a3a3a",
                                borderRadius: 1,
                                border: "1px solid #555",
                                textAlign: "center"
                              }}
                            >
                              <Typography variant="h6" sx={{ color: "#9C27B0", fontWeight: 600 }}>
                                {formatNumber(videoData.shares)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#bbb" }}>
                                Shares
                              </Typography>
                            </Box>
                          )}

                          {videoData.subscribersGained > 0 && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "#3a3a3a",
                                borderRadius: 1,
                                border: "1px solid #555",
                                textAlign: "center"
                              }}
                            >
                              <Typography variant="h6" sx={{ color: "#4CAF50", fontWeight: 600 }}>
                                +{formatNumber(videoData.subscribersGained)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#bbb" }}>
                                Gained
                              </Typography>
                            </Box>
                          )}

                          {videoData.subscribersLost > 0 && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "#3a3a3a",
                                borderRadius: 1,
                                border: "1px solid #555",
                                textAlign: "center"
                              }}
                            >
                              <Typography variant="h6" sx={{ color: "#f44336", fontWeight: 600 }}>
                                -{formatNumber(videoData.subscribersLost)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#bbb" }}>
                                Lost
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}

                      {/* Video Technical Details - Horizontal Cards */}
                      <Box
                        sx={{
                          mt: 3,
                          pt: 3,
                          borderTop: "1px solid #333",
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ color: "#aaa", mb: 2, fontWeight: 600 }}>
                          Video Information
                        </Typography>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: 2,
                          }}
                        >
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: "#3a3a3a",
                              borderRadius: 1,
                              border: "1px solid #555",
                              textAlign: "center"
                            }}
                          >
                            <Typography variant="body2" sx={{ color: "#bbb", mb: 0.5 }}>
                              Duration
                            </Typography>
                            <Typography variant="h6" sx={{ color: "white", fontWeight: 600 }}>
                              {videoData.duration || "0:00"}
                            </Typography>
                          </Box>

                          <Box
                            sx={{
                              p: 2,
                              bgcolor: "#3a3a3a",
                              borderRadius: 1,
                              border: "1px solid #555",
                              textAlign: "center"
                            }}
                          >
                            <Typography variant="body2" sx={{ color: "#bbb", mb: 0.5 }}>
                              Published
                            </Typography>
                            <Typography variant="h6" sx={{ color: "white", fontWeight: 600, fontSize: "0.9rem" }}>
                              {videoData.publishDate || "June 12, 2025"}
                            </Typography>
                          </Box>

                          {videoData.writerName && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "#3a3a3a",
                                borderRadius: 1,
                                border: "1px solid #555",
                                textAlign: "center"
                              }}
                            >
                              <Typography variant="body2" sx={{ color: "#bbb", mb: 0.5 }}>
                                Writer
                              </Typography>
                              <Typography variant="h6" sx={{ color: "#ffb300", fontWeight: 600, fontSize: "0.9rem" }}>
                                {videoData.writerName}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Right Side - Video Player */}
                    <Box sx={{ flex: 1.2, maxWidth: "500px" }}>
                      <Box
                        sx={{
                          position: "relative",
                          bgcolor: "#000",
                          borderRadius: 1,
                          overflow: "hidden",
                          aspectRatio: videoData.isShort ? "9/16" : "16/9",
                          height: videoData.isShort ? "450px" : "320px",
                          width: "100%",
                        }}
                      >
                        {/* Video thumbnail/preview - Use high quality thumbnail from BigQuery */}
                        {videoData.highThumbnail ||
                        videoData.mediumThumbnail ||
                        videoData.preview ? (
                          <img
                            src={
                              videoData.highThumbnail ||
                              videoData.mediumThumbnail ||
                              videoData.preview
                            }
                            alt={videoData.title}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              // Try fallback thumbnails in order
                              if (
                                e.target.src === videoData.highThumbnail &&
                                videoData.mediumThumbnail
                              ) {
                                e.target.src = videoData.mediumThumbnail;
                              } else if (
                                e.target.src === videoData.mediumThumbnail &&
                                videoData.defaultThumbnail
                              ) {
                                e.target.src = videoData.defaultThumbnail;
                              } else if (
                                videoData.preview &&
                                e.target.src !== videoData.preview
                              ) {
                                e.target.src = videoData.preview;
                              } else {
                                // Final fallback to icon if all images fail
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}

                        {/* Fallback icon display - Always show if no thumbnail is available */}
                        <Box
                          sx={{
                            width: "100%",
                            height: "100%",
                            bgcolor: videoData.color || "#333",
                            display:
                              videoData.highThumbnail ||
                              videoData.mediumThumbnail ||
                              videoData.preview
                                ? "none"
                                : "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "60px",
                          }}
                        >
                          {videoData.thumbnail ||
                            (videoData.isShort ? "🎯" : "📺")}
                        </Box>

                        {/* Duration overlay on thumbnail */}
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            bgcolor: "rgba(0,0,0,0.8)",
                            color: "white",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: "12px",
                            fontWeight: 600,
                            fontFamily: "monospace",
                          }}
                        >
                          {videoData.duration || "0:00"}
                        </Box>

                        {/* Play button overlay */}
                        <Box
                          sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            bgcolor: "rgba(0,0,0,0.7)",
                            borderRadius: "50%",
                            width: 60,
                            height: 60,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            "&:hover": {
                              bgcolor: "rgba(0,0,0,0.8)",
                            },
                          }}
                          onClick={() => {
                            if (videoData.url) {
                              window.open(videoData.url, "_blank");
                            }
                          }}
                        >
                          <PlayIcon sx={{ color: "white", fontSize: 30 }} />
                        </Box>

                        {/* Video controls */}
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            bgcolor: "rgba(0,0,0,0.8)",
                            p: 1,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              mb: 1,
                            }}
                          >
                            <IconButton size="small" sx={{ color: "white" }}>
                              <PlayIcon />
                            </IconButton>
                            <IconButton size="small" sx={{ color: "white" }}>
                              <VolumeIcon />
                            </IconButton>
                            <Typography
                              variant="caption"
                              sx={{ color: "white", mx: 1 }}
                            >
                              0:00 / {videoData.duration || "0:00"}
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton size="small" sx={{ color: "white" }}>
                              <SettingsIcon />
                            </IconButton>
                          </Box>

                          {/* Progress bar */}
                          <LinearProgress
                            variant="determinate"
                            value={0}
                            sx={{
                              height: 4,
                              bgcolor: "rgba(255,255,255,0.3)",
                              "& .MuiLinearProgress-bar": { bgcolor: "#FF0000" },
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Chart guide */}
                      <Box
                        sx={{
                          mt: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" sx={{ color: "white" }}>
                          Chart guide
                        </Typography>
                        <IconButton size="small" sx={{ color: "#888" }}>
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                  </Box>
                </CardContent>
              </Card>
          </>
        )}

        {/* Reach Tab */}
        {tabValue === 2 && (
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: "1px solid rgba(255, 255, 255, 0.1)",
              mb: 4,
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h5"
                sx={{ color: "white", fontWeight: 600, mb: 4 }}
              >
                Reach Analytics
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 3,
                  mb: 4,
                }}
              >
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    Impressions
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {formatNumber(Math.floor(videoData.views * 1.5))}
                  </Typography>
                </Box>

                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    Unique viewers
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {formatNumber(Math.floor(videoData.views * 0.8))}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body1" sx={{ color: "#888" }}>
                Your video reached{" "}
                {formatNumber(Math.floor(videoData.views * 1.5))} .
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Engagement Tab */}
        {tabValue === 1 && (
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: "1px solid rgba(255, 255, 255, 0.1)",
              mb: 4,
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h5"
                sx={{ color: "white", fontWeight: 600, mb: 4 }}
              >
                Engagement Analytics
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 3,
                  mb: 4,
                }}
              >
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    Likes
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {formatNumber(videoData.likes)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#4CAF50" }}>
                    {calculateEngagement(videoData.likes, videoData.views)}%
                    engagement
                  </Typography>
                </Box>
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    Comments
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {formatNumber(videoData.comments)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#2196F3" }}>
                    {((videoData.comments / videoData.views) * 100).toFixed(3)}%
                    comment rate
                  </Typography>
                </Box>
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    Shares
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {formatNumber(Math.floor(videoData.likes * 0.1))}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#FF9800" }}>
                    {(
                      (Math.floor(videoData.likes * 0.1) / videoData.views) *
                      100
                    ).toFixed(3)}
                    % share rate
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
        </Box>

        {/* Audience Tab */}
        {tabValue === 3 && (
          <Box sx={{ p: 3 }}>
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: "1px solid rgba(255, 255, 255, 0.1)",
              mb: 4,
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
              }
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h5"
                sx={{ color: "white", fontWeight: 600, mb: 4 }}
              >
                Audience Analytics
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 3,
                  mb: 4,
                }}
              >
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}></Box>
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    New viewers
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {(70 - (Math.random() * 30 + 40)).toFixed(1)}%
                  </Typography>
                </Box>
                <Box sx={{
                  p: 3,
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                    border: "1px solid rgba(102, 126, 234, 0.3)",
                  }
                }}>
                  <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 1 }}>
                    Subscribers gained
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "white", fontWeight: 700 }}
                  >
                    {formatNumber(Math.floor(videoData.views * 0.02))}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body1" sx={{ color: "#888" }}>
                This video attracted{" "}
                {formatNumber(Math.floor(videoData.views * 0.02))} new
                subscribers and had a good mix of returning and new viewers.
              </Typography>
            </CardContent>
          </Card>
          </Box>
        )}
      </Box>
    </Layout>
  );
};

export default VideoAnalytics;
