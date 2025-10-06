import React, { useState } from "react";
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import BigHeadAvatar from "./BigHeadAvatar.jsx";
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
  Menu as MenuIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useNotifications } from "../contexts/NotificationContext.jsx";
import SendFeedback from "./SendFeedback.jsx";
import NotificationCenter from "./NotificationCenter.jsx";
import MilestoneCelebration from "./MilestoneCelebration.jsx";

const drawerWidth = 280;

const Layout = ({
  children,
  hideNavigation = false,
  hideSettings = false,
  hideFeedback = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [anchorEl, setAnchorEl] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Debug logging for user data (commented out to reduce console spam)
  // console.log('🔍 Layout - Current user:', user);
  // console.log('🔍 Layout - WriterId from localStorage:', localStorage.getItem('writerId'));

  // Check if user is retention master or master editor
  const isRetentionMaster = user?.role === "retention_master";
  const isMasterEditor = user?.role === "master_editor";
  const isFullTimeWriter = user?.secondaryRole === "Full Time";
  const isRegularWriter = !isFullTimeWriter && !isRetentionMaster && !isMasterEditor;

  const menuItems =
    isRetentionMaster || hideNavigation
      ? []
      : isMasterEditor
      ? [
          // Only show Trello for master_editor
          {
            text: "Trello",
            icon: <SettingsIcon />,
            path: "/writer-settings",
            description: "Writer settings",
            badge: null,
          },
        ]
      : [
          // Regular menu items for normal users
          {
            text: "Dashboard",
            icon: <DashboardIcon />,
            path: "/dashboard",
            description: "Overview & stats",
            badge: null,
          },
          // Conditionally show Analytics based on secondary_role
          ...(isFullTimeWriter
            ? [
                // Full Time writers see Analytics Updated as "Analytics"
                {
                  text: "Analytics",
                  icon: <InsightsIcon />,
                  path: "/analytics-updated",
                  description: "Performance insights",
                  badge: "New",
                }
              ]
            : isRegularWriter
            ? [
                // Regular writers (NULL/empty secondary_role) see only main Analytics
                {
                  text: "Analytics",
                  icon: <InsightsIcon />,
                  path: "/analytics",
                  description: "Performance insights",
                  badge: "New",
                }
              ]
            : []
          ),
          {
            text: "Content",
            icon: <VideoLibraryIcon />,
            path: "/content",
            description: "Manage videos",
            badge: null,
          },
        ];

  const bottomMenuItems =
    isRetentionMaster || isMasterEditor
      ? []
      : [
          ...(hideSettings
            ? []
            : [
                {
                  text: "Settings",
                  icon: <SettingsIcon />,
                  path: "/settings",
                  description: "Preferences",
                },
              ]),
          ...(hideFeedback
            ? []
            : [
                {
                  text: "Send Feedback",
                  icon: <BugReportIcon />,
                  path: "/support",
                  description: "Report issues",
                },
              ]),
        ];

  const handleMenuClick = (path) => {
    if (path === "/support") {
      setFeedbackOpen(true);
    } else {
      navigate(path);
    }
    // Close mobile drawer when navigating
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  // Drawer content component to avoid duplication
  const drawerContent = (
    <>
      {/* Modern Header with User Profile and Notification */}
      <Box
        sx={{
          p: isMobile ? 2 : 3,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {/* Mobile close button */}
          {isMobile && (
            <IconButton
              onClick={handleDrawerToggle}
              sx={{
                color: "white",
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 1,
              }}
            >
              <CloseIcon />
            </IconButton>
          )}

          {/* User Profile Section */}
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ position: "relative" }}>
              <Box
                sx={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                  borderRadius: "50%",
                  overflow: "hidden",
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
                  border: "2px solid rgba(255, 255, 255, 0.2)",
                  background: "white",
                }}
              >
                <BigHeadAvatar
                  name={user?.name || "User"}
                  avatarSeed={user?.avatarSeed}
                  size={isMobile ? 36 : 44}
                />
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: isMobile ? 12 : 16,
                  height: isMobile ? 12 : 16,
                  borderRadius: "50%",
                  bgcolor: "#4CAF50",
                  border: "2px solid #1a1a2e",
                  boxShadow: "0 2px 8px rgba(76, 175, 80, 0.4)",
                }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="body1"
                fontWeight="600"
                sx={{
                  color: "white",
                  mb: 0.5,
                  fontSize: isMobile ? "14px" : "16px",
                }}
              >
                {user?.name || "Writer"}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={`ID: ${
                    user?.writerId || localStorage.getItem("writerId") || "N/A"
                  }`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                    color: "rgba(255, 255, 255, 0.8)",
                    fontSize: isMobile ? "10px" : "11px",
                    height: isMobile ? "18px" : "20px",
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "#4CAF50",
                    boxShadow: "0 0 6px rgba(76, 175, 80, 0.6)",
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Notification Bell */}
          {!isMobile && (
            <Badge
              badgeContent={unreadCount > 0 ? unreadCount : null}
              sx={{
                "& .MuiBadge-badge": {
                  bgcolor: "#ff4757",
                  color: "white",
                  fontSize: "10px",
                  minWidth: "18px",
                  height: "18px",
                  animation: unreadCount > 0 ? "pulse 2s infinite" : "none",
                  "@keyframes pulse": {
                    "0%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.1)" },
                    "100%": { transform: "scale(1)" },
                  },
                },
              }}
            >
              <IconButton
                onClick={() => setNotificationOpen(true)}
                sx={{
                  color: "rgba(255, 255, 255, 0.7)",
                  "&:hover": {
                    color: "white",
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                  },
                }}
              >
                <NotificationsIcon />
              </IconButton>
            </Badge>
          )}
        </Box>
      </Box>

      {/* Modern Navigation */}
      {!isRetentionMaster && (
        <Box sx={{ px: isMobile ? 1.5 : 2, py: isMobile ? 2 : 3 }}>
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255, 255, 255, 0.5)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1px",
              mb: 2,
              display: "block",
              px: 1,
              fontSize: isMobile ? "10px" : "12px",
            }}
          >
            Navigation
          </Typography>
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={item.text}
                onClick={() => handleMenuClick(item.path)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: isMobile ? 1.5 : 2,
                  mb: 1,
                  borderRadius: isMobile ? "12px" : "16px",
                  cursor: "pointer",
                  position: "relative",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(102, 126, 234, 0.3)"
                    : "1px solid transparent",
                  color: isActive ? "white" : "rgba(255, 255, 255, 0.7)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isActive ? "translateX(4px)" : "translateX(0)",
                  "&:hover": {
                    background: isActive
                      ? "linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                    transform: "translateX(4px)",
                    boxShadow: isActive
                      ? "0 8px 25px rgba(102, 126, 234, 0.2)"
                      : "0 4px 15px rgba(0, 0, 0, 0.1)",
                  },
                  "&::before": isActive
                    ? {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "4px",
                        height: "60%",
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: "0 2px 2px 0",
                      }
                    : {},
                }}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  gap={isMobile ? 1.5 : 2}
                >
                  <Box
                    sx={{
                      color: "inherit",
                      fontSize: isMobile ? 18 : 20,
                      transition: "transform 0.3s ease",
                      transform: isActive ? "scale(1.1)" : "scale(1)",
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight="600"
                      sx={{
                        color: "inherit",
                        mb: 0.2,
                        fontSize: isMobile ? "14px" : "16px",
                      }}
                    >
                      {item.text}
                    </Typography>
                    {!isMobile && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: isActive
                            ? "rgba(255, 255, 255, 0.8)"
                            : "rgba(255, 255, 255, 0.5)",
                          fontSize: "11px",
                        }}
                      >
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        bgcolor: "#667eea",
                        color: "white",
                        fontSize: isMobile ? "9px" : "10px",
                        height: isMobile ? "16px" : "18px",
                        "& .MuiChip-label": { px: 0.8 },
                      }}
                    />
                  )}
                  {!isMobile && (
                    <ArrowIcon
                      sx={{
                        fontSize: 16,
                        color: "inherit",
                        opacity: isActive ? 1 : 0.3,
                        transition: "all 0.3s ease",
                      }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Retention Master Title */}
      {isRetentionMaster && (
        <Box sx={{ px: isMobile ? 1.5 : 2, py: isMobile ? 2 : 3 }}>
          <Typography
            variant="h6"
            sx={{
              color: "white",
              fontWeight: 600,
              textAlign: "center",
              background: "linear-gradient(45deg, #667eea 0%, #764ba2 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Retention Master
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255, 255, 255, 0.5)",
              textAlign: "center",
              display: "block",
              mt: 1,
            }}
          >
            All Video Retention Data
          </Typography>
        </Box>
      )}

      {/* Modern Bottom Navigation */}
      <Box sx={{ flexGrow: 1 }} />
      {!isRetentionMaster && !isMasterEditor && (
        <Box sx={{ px: isMobile ? 1.5 : 2, pb: isMobile ? 2 : 3 }}>
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255, 255, 255, 0.5)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1px",
              mb: 2,
              display: "block",
              px: 1,
              fontSize: isMobile ? "10px" : "12px",
            }}
          >
            Support
          </Typography>
          {bottomMenuItems.map((item) => (
            <Box
              key={item.text}
              onClick={() => handleMenuClick(item.path)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: isMobile ? 1.5 : 2,
                mb: 1,
                borderRadius: "12px",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.6)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  bgcolor: "rgba(255, 255, 255, 0.05)",
                  color: "rgba(255, 255, 255, 0.9)",
                  transform: "translateX(4px)",
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={isMobile ? 1.5 : 2}>
                <Box sx={{ color: "inherit", fontSize: isMobile ? 16 : 18 }}>
                  {item.icon}
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight="500"
                    sx={{
                      color: "inherit",
                      mb: 0.2,
                      fontSize: isMobile ? "14px" : "16px",
                    }}
                  >
                    {item.text}
                  </Typography>
                  {!isMobile && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255, 255, 255, 0.4)",
                        fontSize: "11px",
                      }}
                    >
                      {item.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ))}

          {/* Modern Logout Button */}
          <Box
            onClick={handleLogout}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: isMobile ? 1.5 : 2,
              mt: 2,
              borderRadius: "12px",
              cursor: "pointer",
              color: "rgba(255, 255, 255, 0.6)",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              pt: isMobile ? 2 : 3,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                bgcolor: "rgba(244, 67, 54, 0.1)",
                color: "#ff6b6b",
                transform: "translateX(4px)",
                boxShadow: "0 4px 15px rgba(244, 67, 54, 0.2)",
              },
            }}
          >
            <Box display="flex" alignItems="center" gap={isMobile ? 1.5 : 2}>
              <Box sx={{ color: "inherit", fontSize: isMobile ? 16 : 18 }}>
                <LogoutIcon />
              </Box>
              <Box>
                <Typography
                  variant="body2"
                  fontWeight="500"
                  sx={{
                    color: "inherit",
                    mb: 0.2,
                    fontSize: isMobile ? "14px" : "16px",
                  }}
                >
                  Logout
                </Typography>
                {!isMobile && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "rgba(255, 255, 255, 0.4)",
                      fontSize: "11px",
                    }}
                  >
                    Sign out securely
                  </Typography>
                )}
              </Box>
            </Box>
            {!isMobile && (
              <ArrowIcon
                sx={{
                  fontSize: 16,
                  color: "inherit",
                  opacity: 0.5,
                }}
              />
            )}
          </Box>
        </Box>
      )}
    </>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            background:
              "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
            zIndex: theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1 }}
            >
              Writer Studio
            </Typography>
            <Badge
              badgeContent={unreadCount > 0 ? unreadCount : null}
              sx={{
                "& .MuiBadge-badge": {
                  bgcolor: "#ff4757",
                  color: "white",
                  fontSize: "10px",
                  minWidth: "16px",
                  height: "16px",
                },
              }}
            >
              <IconButton
                color="inherit"
                onClick={() => setNotificationOpen(true)}
              >
                <NotificationsIcon />
              </IconButton>
            </Badge>
          </Toolbar>
        </AppBar>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              background:
                "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              borderRight: "none",
              boxShadow: "4px 0 20px rgba(0, 0, 0, 0.3)",
              "&::-webkit-scrollbar": {
                width: "0px",
                background: "transparent",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "transparent",
              },
              // For Firefox
              scrollbarWidth: "none",
              // For IE and Edge
              msOverflowStyle: "none",
            },
          }}
          variant="permanent"
          anchor="left"
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            "& .MuiDrawer-paper": {
              width: 280,
              boxSizing: "border-box",
              background:
                "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              borderRight: "none",
              boxShadow: "4px 0 20px rgba(0, 0, 0, 0.3)",
              "&::-webkit-scrollbar": {
                width: "0px",
                background: "transparent",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "transparent",
              },
              // For Firefox
              scrollbarWidth: "none",
              // For IE and Edge
              msOverflowStyle: "none",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Enhanced Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          background:
            "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)",
          minHeight: "100vh",
          position: "relative",
          marginTop: isMobile ? "64px" : 0, // Account for mobile app bar
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.5) 50%, transparent 100%)",
          },
        }}
      >
        <Box sx={{ p: isMobile ? 2 : 3 }}>{children}</Box>
      </Box>

      {/* Send Feedback Modal */}
      {!hideFeedback && (
        <SendFeedback
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {/* Notification Center */}
      <NotificationCenter
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
      />

      {/* Milestone Celebration */}
      <MilestoneCelebration />
    </Box>
  );
};

export default Layout;
