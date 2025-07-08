import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Button,
  Divider,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  Notifications as NotificationsIcon,
  PlayArrow as PlayIcon,
  Star as StarIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationCenter = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    formatMilestoneType,
    formatNumber
  } = useNotifications();

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load notifications when opened
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchNotifications(20, notifications.length);
      setHasMore(result?.hasMore || false);
    } catch (error) {
      console.error('Error loading more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Open video if URL exists
    if (notification.video_url) {
      window.open(notification.video_url, '_blank');
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    
    return date.toLocaleDateString();
  };

  const getMilestoneColor = (milestoneType) => {
    const colorMap = {
      '1M_VIEWS': '#FFD700',
      '5M_VIEWS': '#FF6B6B',
      '10M_VIEWS': '#4ECDC4',
      '50M_VIEWS': '#45B7D1',
      '100M_VIEWS': '#96CEB4'
    };
    return colorMap[milestoneType] || '#FFD700';
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100vw' : 400,
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          color: 'white'
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsIcon sx={{ color: '#667eea' }} />
          <Typography variant="h6" fontWeight={600}>
            Notifications
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => fetchNotifications()}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Mark All Read Button */}
      {notifications.some(n => !n.is_read) && (
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button
            size="small"
            startIcon={<CheckIcon />}
            onClick={markAllAsRead}
            sx={{
              color: '#667eea',
              '&:hover': {
                bgcolor: 'rgba(102, 126, 234, 0.1)'
              }
            }}
          >
            Mark all as read
          </Button>
        </Box>
      )}

      {/* Notifications List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && notifications.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#667eea' }} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 2 }} />
            <Typography variant="body1" color="rgba(255, 255, 255, 0.6)">
              No notifications yet
            </Typography>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.4)" sx={{ mt: 1 }}>
              You'll see milestone achievements here
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    py: 2,
                    px: 2,
                    bgcolor: notification.is_read ? 'transparent' : 'rgba(102, 126, 234, 0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)'
                    },
                    cursor: 'pointer'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: getMilestoneColor(notification.milestone_type),
                        width: 48,
                        height: 48
                      }}
                    >
                      <StarIcon sx={{ color: 'white' }} />
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={600} color="white">
                          {formatMilestoneType(notification.milestone_type)}
                        </Typography>
                        {!notification.is_read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: '#667eea'
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          color="rgba(255, 255, 255, 0.8)"
                          sx={{ mb: 1, lineHeight: 1.4 }}
                        >
                          {notification.video_title?.substring(0, 60)}
                          {notification.video_title?.length > 60 ? '...' : ''}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={formatNumber(notification.current_views)}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              fontSize: '11px',
                              height: 20
                            }}
                          />
                          <Typography
                            variant="caption"
                            color="rgba(255, 255, 255, 0.5)"
                          >
                            {formatTimeAgo(notification.achieved_at)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  
                  {notification.video_url && (
                    <IconButton
                      size="small"
                      sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
                    >
                      <PlayIcon />
                    </IconButton>
                  )}
                </ListItem>
                
                {index < notifications.length - 1 && (
                  <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
                )}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Load More Button */}
        {hasMore && notifications.length > 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Button
              onClick={handleLoadMore}
              disabled={loadingMore}
              sx={{
                color: '#667eea',
                '&:hover': {
                  bgcolor: 'rgba(102, 126, 234, 0.1)'
                }
              }}
            >
              {loadingMore ? (
                <CircularProgress size={20} sx={{ color: '#667eea' }} />
              ) : (
                'Load More'
              )}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default NotificationCenter;
