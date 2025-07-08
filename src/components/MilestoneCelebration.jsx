import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Fade,
  Zoom,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Celebration as CelebrationIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { useNotifications } from '../contexts/NotificationContext';

const MilestoneCelebration = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { uncebratedNotifications, markAsCelebrated } = useNotifications();
  const [currentNotification, setCurrentNotification] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('enter'); // enter, celebrate, exit

  // Show celebration for the first uncelebrated notification
  useEffect(() => {
    if (uncebratedNotifications.length > 0 && !currentNotification) {
      setCurrentNotification(uncebratedNotifications[0]);
      setShowConfetti(true);
      setAnimationPhase('enter');
      
      // Auto-transition to celebrate phase
      setTimeout(() => setAnimationPhase('celebrate'), 500);
    }
  }, [uncebratedNotifications, currentNotification]);

  const handleClose = async () => {
    if (!currentNotification) return;
    
    setAnimationPhase('exit');
    
    // Mark as celebrated
    await markAsCelebrated(currentNotification.id);
    
    // Clear current notification after animation
    setTimeout(() => {
      setCurrentNotification(null);
      setShowConfetti(false);
      setAnimationPhase('enter');
    }, 300);
  };

  const handleWatchVideo = () => {
    if (currentNotification?.video_url) {
      window.open(currentNotification.video_url, '_blank');
    }
    handleClose();
  };

  if (!currentNotification) return null;

  const milestoneText = currentNotification.milestone_type?.replace('_', ' ').replace('VIEWS', 'Views');

  return (
    <>
      {/* Confetti Animation */}
      {showConfetti && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9999,
            overflow: 'hidden'
          }}
        >
          {[...Array(50)].map((_, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                width: '10px',
                height: '10px',
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 6],
                borderRadius: '50%',
                left: `${Math.random() * 100}%`,
                animationName: 'confetti-fall',
                animationDuration: `${2 + Math.random() * 3}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                animationDelay: `${Math.random() * 2}s`,
                '@keyframes confetti-fall': {
                  '0%': {
                    transform: 'translateY(-100vh) rotate(0deg)',
                    opacity: 1
                  },
                  '100%': {
                    transform: 'translateY(100vh) rotate(720deg)',
                    opacity: 0
                  }
                }
              }}
            />
          ))}
        </Box>
      )}

      {/* Celebration Dialog */}
      <Dialog
        open={true}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            overflow: 'hidden',
            position: 'relative',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }
        }}
        TransitionComponent={Zoom}
        transitionDuration={500}
      >
        {/* Animated Background Elements */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        >
          {[...Array(20)].map((_, i) => (
            <StarIcon
              key={i}
              sx={{
                position: 'absolute',
                color: 'rgba(255, 255, 255, 0.1)',
                fontSize: `${20 + Math.random() * 30}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
                '@keyframes twinkle': {
                  '0%, 100%': { opacity: 0.1, transform: 'scale(1)' },
                  '50%': { opacity: 0.3, transform: 'scale(1.2)' }
                }
              }}
            />
          ))}
        </Box>

        <DialogContent sx={{ p: 0, position: 'relative', zIndex: 1 }}>
          {/* Close Button */}
          <IconButton
            onClick={handleClose}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              },
              zIndex: 2
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Main Content */}
          <Box
            sx={{
              textAlign: 'center',
              p: isMobile ? 3 : 4,
              pt: isMobile ? 4 : 5
            }}
          >
            {/* Celebration Icon */}
            <Fade in={animationPhase !== 'exit'} timeout={800}>
              <Box
                sx={{
                  mb: 3,
                  animation: animationPhase === 'celebrate' ? 'bounce 1s ease-in-out infinite' : 'none',
                  '@keyframes bounce': {
                    '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
                    '40%': { transform: 'translateY(-20px)' },
                    '60%': { transform: 'translateY(-10px)' }
                  }
                }}
              >
                <CelebrationIcon
                  sx={{
                    fontSize: isMobile ? 60 : 80,
                    color: '#FFD700',
                    filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.5))'
                  }}
                />
              </Box>
            </Fade>

            {/* Milestone Achievement Text */}
            <Fade in={animationPhase !== 'exit'} timeout={1000}>
              <Typography
                variant={isMobile ? "h4" : "h3"}
                sx={{
                  color: 'white',
                  fontWeight: 800,
                  mb: 2,
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                  background: 'linear-gradient(45deg, #FFD700, #FFA500)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                🎉 {milestoneText}! 🎉
              </Typography>
            </Fade>

            <Fade in={animationPhase !== 'exit'} timeout={1200}>
              <Typography
                variant="h6"
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  mb: 1,
                  fontWeight: 600
                }}
              >
                Congratulations!
              </Typography>
            </Fade>

            <Fade in={animationPhase !== 'exit'} timeout={1400}>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  mb: 3,
                  maxWidth: '400px',
                  mx: 'auto',
                  lineHeight: 1.6
                }}
              >
                Your video "{currentNotification.video_title?.substring(0, 50)}
                {currentNotification.video_title?.length > 50 ? '...' : ''}" 
                has reached <strong>{milestoneText}</strong>!
              </Typography>
            </Fade>

            {/* Action Buttons */}
            <Fade in={animationPhase !== 'exit'} timeout={1600}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                {currentNotification.video_url && (
                  <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={handleWatchVideo}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      fontWeight: 600,
                      px: 3,
                      py: 1.5,
                      borderRadius: '25px',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.3)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Watch Video
                  </Button>
                )}
                
                <Button
                  variant="outlined"
                  onClick={handleClose}
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: 600,
                    px: 3,
                    py: 1.5,
                    borderRadius: '25px',
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Continue
                </Button>
              </Box>
            </Fade>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MilestoneCelebration;
