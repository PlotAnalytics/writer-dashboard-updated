import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  LinearProgress
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  TableChart as TableChartIcon,
  Fullscreen as FullscreenIcon,
  GetApp as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts';

const ChannelChart = ({ data, totalViews, progressToTarget, avgDailyViews, dateRange }) => {
  const [chartType, setChartType] = useState('line');
  const [viewMode, setViewMode] = useState('chart');

  if (!data || !data.length) {
    return (
      <Card sx={{
        bgcolor: 'transparent',
        border: 'none',
        borderRadius: '12px',
        boxShadow: 'none'
      }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            Channel Performance
          </Typography>
          <Box sx={{
            height: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography sx={{ color: '#888' }}>
              No chart data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

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

  // Dynamic date formatting based on date range
  const formatXAxisDate = (value) => {
    const date = new Date(value);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Determine format based on date range
    if (dateRange === '7d' || dateRange === '28d' || dateRange === '30d') {
      // For short ranges, show month/day
      return `${months[date.getMonth()]} ${date.getDate()}`;
    } else if (dateRange === '90d' || dateRange === '365d') {
      // For medium ranges, show month/year
      return `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
    } else {
      // For lifetime/long ranges, show year only or month/year for recent data
      if (date.getFullYear() === new Date().getFullYear()) {
        return `${months[date.getMonth()]} ${date.getDate()}`;
      }
      return date.getFullYear().toString();
    }
  };

  // Calculate dynamic tick count based on data length
  const getTickCount = () => {
    if (!data || data.length === 0) return 5;

    if (data.length <= 7) return data.length;
    if (data.length <= 30) return 7;
    if (data.length <= 90) return 10;
    return 12;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Format the date for tooltip display - avoid timezone conversion
      // Parse the date string directly to avoid timezone issues
      const dateStr = label; // Should be in YYYY-MM-DD format
      const [year, month, day] = dateStr.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedDate = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;

      return (
        <Box sx={{
          bgcolor: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '8px',
          p: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
            {formattedDate}
          </Typography>
          {payload.map((entry, index) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ color: entry.color }}
            >
              {entry.name}: {formatNumber(entry.value)}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (chartType === 'line') {
      return (
        <AreaChart data={data}>
          <defs>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4FC3F7" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#4FC3F7" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#4FC3F7" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="date"
            stroke="#888"
            fontSize={12}
            tickFormatter={formatXAxisDate}
            interval="preserveStartEnd"
            tickCount={getTickCount()}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#888"
            fontSize={12}
            tickFormatter={formatNumber}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#4FC3F7"
            strokeWidth={3}
            fill="url(#blueGradient)"
            dot={{ fill: '#4FC3F7', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#4FC3F7', strokeWidth: 2 }}
          />
        </AreaChart>
      );
    } else {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="date"
            stroke="#888"
            fontSize={12}
            tickFormatter={formatXAxisDate}
            interval="preserveStartEnd"
            tickCount={getTickCount()}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#888"
            fontSize={12}
            tickFormatter={formatNumber}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Bar dataKey="views" fill="#4FC3F7" />
        </BarChart>
      );
    }
  };

  const renderTable = () => (
    <Box sx={{
      maxHeight: 400,
      overflow: 'auto',
      border: '1px solid #444',
      borderRadius: '8px'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#333' }}>
            <th style={{
              padding: '12px',
              textAlign: 'left',
              color: 'white',
              borderBottom: '1px solid #444'
            }}>
              Date
            </th>
            <th style={{
              padding: '12px',
              textAlign: 'right',
              color: 'white',
              borderBottom: '1px solid #444'
            }}>
              Views
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} style={{
              backgroundColor: index % 2 === 0 ? '#2A2A2A' : '#1a1a1a'
            }}>
              <td style={{
                padding: '12px',
                color: 'white',
                borderBottom: '1px solid #444'
              }}>
                {(() => {
                  const [year, month, day] = row.date.split('-');
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
                })()}
              </td>
              <td style={{
                padding: '12px',
                textAlign: 'right',
                color: 'white',
                borderBottom: '1px solid #444'
              }}>
                {formatNumber(row.views)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );

  return (
    <Card sx={{
      bgcolor: 'transparent',
      border: 'none',
      borderRadius: '12px',
      boxShadow: 'none'
    }}>
      <CardContent>
        {/* Chart Header */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}>
          <Typography variant="h6" sx={{ color: 'white' }}>
            Channel Performance
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* View Mode Toggle */}
            <ButtonGroup size="small">
              <Button
                variant={viewMode === 'chart' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('chart')}
                sx={{
                  color: viewMode === 'chart' ? 'black' : 'white',
                  bgcolor: viewMode === 'chart' ? '#E6B800' : 'transparent',
                  borderColor: '#444',
                  '&:hover': {
                    bgcolor: viewMode === 'chart' ? '#D4A600' : '#333'
                  }
                }}
              >
                Chart
              </Button>
              <Button
                variant={viewMode === 'table' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('table')}
                sx={{
                  color: viewMode === 'table' ? 'black' : 'white',
                  bgcolor: viewMode === 'table' ? '#E6B800' : 'transparent',
                  borderColor: '#444',
                  '&:hover': {
                    bgcolor: viewMode === 'table' ? '#D4A600' : '#333'
                  }
                }}
              >
                Table
              </Button>
            </ButtonGroup>

            {/* Chart Type Toggle (only show for chart view) */}
            {viewMode === 'chart' && (
              <ButtonGroup size="small">
                <Tooltip title="Line Chart">
                  <IconButton
                    onClick={() => setChartType('line')}
                    sx={{
                      color: chartType === 'line' ? '#E6B800' : 'white',
                      bgcolor: chartType === 'line' ? 'rgba(230, 184, 0, 0.1)' : 'transparent',
                      border: '1px solid #444',
                      '&:hover': { bgcolor: '#333' }
                    }}
                  >
                    <LineChartIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Bar Chart">
                  <IconButton
                    onClick={() => setChartType('bar')}
                    sx={{
                      color: chartType === 'bar' ? '#E6B800' : 'white',
                      bgcolor: chartType === 'bar' ? 'rgba(230, 184, 0, 0.1)' : 'transparent',
                      border: '1px solid #444',
                      '&:hover': { bgcolor: '#333' }
                    }}
                  >
                    <BarChartIcon />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
            )}

            {/* Action Buttons */}
            <Tooltip title="Download Data">
              <IconButton sx={{
                color: 'white',
                border: '1px solid #444',
                '&:hover': { bgcolor: '#333' }
              }}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Views Data Section - Compact and Centered */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mb: 4,
          p: 2,
          bgcolor: 'transparent',
          borderRadius: '8px',
          maxWidth: '600px',
          mx: 'auto'
        }}>
          {/* Views Section */}
          <Box sx={{ flex: 1, textAlign: 'center', mr: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ color: '#888', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Views
              </Typography>
              <TrendingUpIcon sx={{ color: '#888', fontSize: '0.9rem' }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                {formatNumber(totalViews || 0)}
              </Typography>
              <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: '1.2rem' }} />
            </Box>
            <Typography variant="caption" sx={{ color: '#888', fontStyle: 'italic' }}>
              {avgDailyViews ? `${formatNumber(avgDailyViews)} daily average` : 'About the same as usual'}
            </Typography>
          </Box>

          {/* Progress Section */}
          <Box sx={{ flex: 1, textAlign: 'center', ml: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 0.5 }}>
              <Typography variant="body2" sx={{ color: '#888', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Progress
              </Typography>
              <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
                {Math.round(progressToTarget || 0)}%
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', maxWidth: '200px', mx: 'auto' }}>
              <LinearProgress
                variant="determinate"
                value={progressToTarget || 0}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: '#444',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: progressToTarget >= 100 ? '#4CAF50' : progressToTarget >= 50 ? '#8BC34A' : '#FFC107',
                    borderRadius: 5
                  }
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Chart/Table Content */}
        <Box sx={{
          height: 400,
          maxWidth: '900px',
          mx: 'auto',
          width: '100%'
        }}>
          {viewMode === 'chart' ? (
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          ) : (
            renderTable()
          )}
        </Box>

        {/* Chart Footer with Latest Data Point */}
        {data.length > 0 && (
          <Box sx={{
            mt: 3,
            pt: 2,
            borderTop: '1px solid #444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Latest: {(() => {
                const dateStr = data[data.length - 1]?.date;
                if (!dateStr) return 'N/A';
                const [year, month, day] = dateStr.split('-');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
              })()}
            </Typography>
            <Typography variant="h6" sx={{ color: '#4FC3F7' }}>
              {formatNumber(data[data.length - 1]?.views || 0)}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ChannelChart;
