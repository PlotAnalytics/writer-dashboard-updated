import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Switch,
  Button,
  Divider,
  FormControlLabel,
  Card,
  CardContent,
  IconButton,
  useTheme,
  useMediaQuery,
  Chip,
  Stack
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Close as CloseIcon,
  DarkMode as DarkModeIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Save as SaveIcon,
  Palette as PaletteIcon
} from '@mui/icons-material';
import Layout from '../components/Layout.jsx';

const Settings = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(false);

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };

  const handleSave = () => {
    // In a real app, this would save settings to backend/localStorage
    console.log('Settings saved:', { darkMode, notifications, autoSave });
    navigate(-1);
  };

  const handleDarkModeChange = (event) => {
    setDarkMode(event.target.checked);
  };

  const handleNotificationsChange = (event) => {
    setNotifications(event.target.checked);
  };

  const handleAutoSaveChange = (event) => {
    setAutoSave(event.target.checked);
  };

  return (
    <Layout>
      <Box sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
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
      }}>
        {/* Modern Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
          p: isMobile ? 2 : 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <SettingsIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant={isMobile ? "h5" : "h4"} sx={{
              color: 'white',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Settings
            </Typography>
          </Box>

          <IconButton
            onClick={handleClose}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Settings Cards Container */}
        <Box sx={{ px: isMobile ? 2 : 3, pb: 4 }}>
          <Stack spacing={3}>

            {/* General Settings Card */}
            <Card sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <PaletteIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                    General
                  </Typography>
                </Box>

                {/* Dark Mode Setting */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 2,
                  px: 1,
                  borderRadius: '12px',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)'
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <DarkModeIcon sx={{ color: '#667eea', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
                        Dark Mode
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Toggle dark theme appearance
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={darkMode ? 'ON' : 'OFF'}
                      size="small"
                      sx={{
                        bgcolor: darkMode ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: darkMode ? '#667eea' : 'rgba(255, 255, 255, 0.7)',
                        border: `1px solid ${darkMode ? '#667eea' : 'rgba(255, 255, 255, 0.2)'}`,
                        fontWeight: 600
                      }}
                    />
                    <Switch
                      checked={darkMode}
                      onChange={handleDarkModeChange}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#667eea',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#667eea',
                        },
                        '& .MuiSwitch-track': {
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        }
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Notifications Settings Card */}
            <Card sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <NotificationsIcon sx={{ color: '#ff6b6b', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                    Notifications
                  </Typography>
                </Box>

                {/* Milestone Notifications */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 2,
                  px: 1,
                  borderRadius: '12px',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)'
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <NotificationsIcon sx={{ color: '#ff6b6b', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
                        Milestone Notifications
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Get notified when videos reach milestones
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={notifications ? 'ON' : 'OFF'}
                      size="small"
                      sx={{
                        bgcolor: notifications ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: notifications ? '#ff6b6b' : 'rgba(255, 255, 255, 0.7)',
                        border: `1px solid ${notifications ? '#ff6b6b' : 'rgba(255, 255, 255, 0.2)'}`,
                        fontWeight: 600
                      }}
                    />
                    <Switch
                      checked={notifications}
                      onChange={handleNotificationsChange}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#ff6b6b',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#ff6b6b',
                        },
                        '& .MuiSwitch-track': {
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        }
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Preferences Settings Card */}
            <Card sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <LanguageIcon sx={{ color: '#4ecdc4', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                    Preferences
                  </Typography>
                </Box>

                {/* Language Setting */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 2,
                  px: 1,
                  borderRadius: '12px',
                  mb: 2
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <LanguageIcon sx={{ color: '#4ecdc4', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
                        Language
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Interface language preference
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label="English (US)"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(78, 205, 196, 0.2)',
                      color: '#4ecdc4',
                      border: '1px solid #4ecdc4',
                      fontWeight: 600
                    }}
                  />
                </Box>

                {/* Auto-save Setting */}
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 2,
                  px: 1,
                  borderRadius: '12px',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)'
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <SaveIcon sx={{ color: '#4ecdc4', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
                        Auto-save
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Automatically save changes
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={autoSave ? 'Enabled' : 'Disabled'}
                      size="small"
                      sx={{
                        bgcolor: autoSave ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: autoSave ? '#4ecdc4' : 'rgba(255, 255, 255, 0.7)',
                        border: `1px solid ${autoSave ? '#4ecdc4' : 'rgba(255, 255, 255, 0.2)'}`,
                        fontWeight: 600
                      }}
                    />
                    <Switch
                      checked={autoSave}
                      onChange={handleAutoSaveChange}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#4ecdc4',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#4ecdc4',
                        },
                        '& .MuiSwitch-track': {
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        }
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Action Buttons Card */}
            <Card sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              mt: 2
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={handleClose}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      textTransform: 'none',
                      px: 3,
                      py: 1.5,
                      borderRadius: '12px',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        color: 'white'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    startIcon={<SaveIcon />}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      textTransform: 'none',
                      px: 3,
                      py: 1.5,
                      borderRadius: '12px',
                      fontWeight: 600,
                      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                        transform: 'translateY(-2px)'
                      },
                      '&:active': {
                        transform: 'translateY(0px)'
                      }
                    }}
                  >
                    Save Changes
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>
    </Layout>
  );
};

export default Settings;
