import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';

const RealtimeWidget = () => {
  const [realtimeData, setRealtimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatNumber = (value) => {
    if (typeof value !== 'number') return 'N/A';
    return Math.round(value).toLocaleString();
  };

  const fetchRealtimeData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await axios.get('/api/analytics/realtime', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          hours: 72
        }
      });

      if (response.data) {
        setRealtimeData(response.data);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching realtime data:', err);
      setError('Failed to load realtime data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealtimeData();
    
    // Update every 5 minutes
    const interval = setInterval(fetchRealtimeData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box sx={{
        bgcolor: '#2A2A2A',
        borderRadius: '12px',
        border: '1px solid #333',
        p: 3,
        width: '280px',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <CircularProgress size={30} sx={{ color: '#4fc3f7' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{
        bgcolor: '#2A2A2A',
        borderRadius: '12px',
        border: '1px solid #333',
        p: 3,
        width: '280px',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography variant="body2" sx={{ color: '#888', textAlign: 'center' }}>
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      bgcolor: '#2A2A2A',
      borderRadius: '12px',
      border: '1px solid #333',
      p: 3,
      width: '280px',
      height: '400px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ 
          color: 'white', 
          fontWeight: 600, 
          fontSize: '18px',
          mb: 1
        }}>
          Realtime
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: '#4CAF50',
            animation: 'pulse 2s infinite'
          }} />
          <Typography variant="body2" sx={{ color: '#888', fontSize: '12px' }}>
            Updating live
          </Typography>
        </Box>
      </Box>

      {/* Main Number */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" sx={{ 
          color: 'white', 
          fontWeight: 700,
          fontSize: '48px',
          lineHeight: 1,
          mb: 0.5
        }}>
          {formatNumber(realtimeData?.totalViews || 0)}
        </Typography>
        <Typography variant="body2" sx={{ color: '#888', fontSize: '14px' }}>
          Views • Last 72 hours
        </Typography>
      </Box>

      {/* Mini Dotted Line Chart */}
      <Box sx={{ flex: 1, minHeight: '120px' }}>
        <ReactECharts
          option={{
            grid: {
              left: 0,
              right: 0,
              bottom: 20,
              top: 10,
              containLabel: false
            },
            xAxis: {
              type: 'category',
              data: realtimeData?.chartData?.map((_, index) => '') || [],
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: { show: false },
              splitLine: { show: false }
            },
            yAxis: {
              type: 'value',
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: { show: false },
              splitLine: { show: false }
            },
            series: [{
              data: realtimeData?.chartData?.map(item => item.views) || [],
              type: 'line',
              lineStyle: {
                color: '#4fc3f7',
                width: 2,
                type: 'dashed' // Makes the line dotted/dashed
              },
              itemStyle: {
                color: '#4fc3f7',
                borderColor: '#fff',
                borderWidth: 2
              },
              symbol: 'circle',
              symbolSize: 6,
              emphasis: {
                itemStyle: {
                  color: '#29B6F6',
                  borderColor: '#fff',
                  borderWidth: 2
                },
                lineStyle: {
                  color: '#29B6F6',
                  width: 3
                }
              }
            }],
            tooltip: {
              trigger: 'axis',
              backgroundColor: 'rgba(50, 50, 50, 0.9)',
              borderColor: '#4fc3f7',
              borderWidth: 1,
              textStyle: { color: '#fff' },
              formatter: (params) => {
                const dataIndex = params[0]?.dataIndex;
                const dataPoint = realtimeData?.chartData?.[dataIndex];

                if (!dataPoint) return '';

                return `
                  <div style="min-width: 120px;">
                    <div style="font-size: 12px; color: #ccc;">${dataPoint.time}</div>
                    <div style="font-size: 14px; font-weight: 600; color: #fff;">${formatNumber(dataPoint.views)} views</div>
                  </div>
                `;
              }
            }
          }}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </Box>

      {/* Now indicator */}
      <Box sx={{ textAlign: 'right', mt: 1 }}>
        <Typography variant="caption" sx={{ color: '#666', fontSize: '11px' }}>
          Now
        </Typography>
      </Box>

      {/* CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default RealtimeWidget;
