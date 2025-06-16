import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Button,
  Chip,
  Badge,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  Article as ContentIcon,
  Settings as SettingsIcon,
  BugReport as BugReportIcon,
  Logout as LogoutIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  VideoLibrary as VideoLibraryIcon,
  Insights as InsightsIcon,
  Notifications as NotificationsIcon,
  KeyboardArrowRight as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import SendFeedback from './SendFeedback.jsx';

const drawerWidth = 280;

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      description: 'Overview & stats',
      badge: null
    },
    {
      text: 'Analytics',
      icon: <InsightsIcon />,
      path: '/analytics',
      description: 'Performance insights',
      badge: 'New'
    },
    {
      text: 'Content',
      icon: <VideoLibraryIcon />,
      path: '/content',
      description: 'Manage videos',
      badge: null
    },
  ];

  const bottomMenuItems = [
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', description: 'Preferences' },
    { text: 'Send Feedback', icon: <BugReportIcon />, path: '/support', description: 'Report issues' },
  ];

  const handleMenuClick = (path) => {
    if (path === '/support') {
      setFeedbackOpen(true);
    } else {
      navigate(path);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex' }}>

      {/* Modern Sidebar */}
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
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255, 255, 255, 0.1)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '3px',
            },
          },
        }}
        variant="permanent"
        anchor="left"
      >
        {/* Modern Header with User Profile and Notification */}
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            {/* User Profile Section */}
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '20px',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {user?.avatar || user?.name?.charAt(0) || 'U'}
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: '#4CAF50',
                    border: '2px solid #1a1a2e',
                    boxShadow: '0 2px 8px rgba(76, 175, 80, 0.4)',
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" fontWeight="600" sx={{ color: 'white', mb: 0.5 }}>
                  {user?.name || 'Writer'}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={`ID: ${user?.writerId || 'N/A'}`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: '11px',
                      height: '20px',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: '#4CAF50',
                      boxShadow: '0 0 6px rgba(76, 175, 80, 0.6)',
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Notification Bell */}
            <Badge
              badgeContent={3}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: '#ff4757',
                  color: 'white',
                  fontSize: '10px',
                  minWidth: '18px',
                  height: '18px',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.1)' },
                    '100%': { transform: 'scale(1)' },
                  },
                },
              }}
            >
              <IconButton
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <NotificationsIcon />
              </IconButton>
            </Badge>
          </Box>
        </Box>



        {/* Modern Navigation */}
        <Box sx={{ px: 2, py: 3 }}>
          <Typography variant="caption" sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            mb: 2,
            display: 'block',
            px: 1
          }}>
            Navigation
          </Typography>
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={item.text}
                onClick={() => handleMenuClick(item.path)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  mb: 1,
                  borderRadius: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(102, 126, 234, 0.3)'
                    : '1px solid transparent',
                  color: isActive ? 'white' : 'rgba(255, 255, 255, 0.7)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isActive ? 'translateX(4px)' : 'translateX(0)',
                  '&:hover': {
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)'
                      : 'rgba(255, 255, 255, 0.05)',
                    transform: 'translateX(4px)',
                    boxShadow: isActive
                      ? '0 8px 25px rgba(102, 126, 234, 0.2)'
                      : '0 4px 15px rgba(0, 0, 0, 0.1)',
                  },
                  '&::before': isActive ? {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '4px',
                    height: '60%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '0 2px 2px 0',
                  } : {},
                }}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{
                    color: 'inherit',
                    fontSize: 20,
                    transition: 'transform 0.3s ease',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  }}>
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="600" sx={{ color: 'inherit', mb: 0.2 }}>
                      {item.text}
                    </Typography>
                    <Typography variant="caption" sx={{
                      color: isActive ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)',
                      fontSize: '11px'
                    }}>
                      {item.description}
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        bgcolor: '#667eea',
                        color: 'white',
                        fontSize: '10px',
                        height: '18px',
                        '& .MuiChip-label': { px: 0.8 },
                      }}
                    />
                  )}
                  <ArrowIcon sx={{
                    fontSize: 16,
                    color: 'inherit',
                    opacity: isActive ? 1 : 0.3,
                    transition: 'all 0.3s ease',
                  }} />
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Modern Bottom Navigation */}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ px: 2, pb: 3 }}>
          <Typography variant="caption" sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            mb: 2,
            display: 'block',
            px: 1
          }}>
            Support
          </Typography>
          {bottomMenuItems.map((item) => (
            <Box
              key={item.text}
              onClick={() => handleMenuClick(item.path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                mb: 1,
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
                  {item.icon}
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight="500" sx={{ color: 'inherit', mb: 0.2 }}>
                    {item.text}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '11px'
                  }}>
                    {item.description}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}

          {/* Modern Logout Button */}
          <Box
            onClick={handleLogout}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              mt: 2,
              borderRadius: '12px',
              cursor: 'pointer',
              color: 'rgba(255, 255, 255, 0.6)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              pt: 3,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: 'rgba(244, 67, 54, 0.1)',
                color: '#ff6b6b',
                transform: 'translateX(4px)',
                boxShadow: '0 4px 15px rgba(244, 67, 54, 0.2)',
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ color: 'inherit', fontSize: 18 }}>
                <LogoutIcon />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight="500" sx={{ color: 'inherit', mb: 0.2 }}>
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
            <ArrowIcon sx={{
              fontSize: 16,
              color: 'inherit',
              opacity: 0.5,
            }} />
          </Box>
        </Box>
      </Drawer>

      {/* Enhanced Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
          minHeight: '100vh',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.5) 50%, transparent 100%)',
          }
        }}
      >
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>

      {/* Send Feedback Modal */}
      <SendFeedback
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
};

export default Layout;
