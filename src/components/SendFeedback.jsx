import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Send as SendIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import axios from 'axios';

const SendFeedback = ({ open, onClose }) => {
  const [problemDescription, setProblemDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSubmit = async () => {
    if (!problemDescription.trim()) return;

    setIsSubmitting(true);

    try {
      // Send to backend which will forward to Slack
      await axios.post('/api/feedback', {
        problem: problemDescription,
        screenshot: screenshot,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });

      setShowSuccess(true);

      // Reset form
      setProblemDescription('');
      setScreenshot(null);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to send feedback:', error);
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCaptureScreenshot = async () => {
    try {
      // In a real app, this would use screen capture API
      // For now, we'll just simulate the action
      console.log('Screenshot capture initiated');
      
      // Simulate screenshot capture
      setScreenshot('screenshot_captured.png');
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(15, 15, 35, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            color: 'white',
            overflow: 'hidden'
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)'
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {/* Modern Header with Gradient */}
          <Box sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            p: 3,
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)'
            }
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <BugIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '18px',
                    mb: 0.5
                  }}>
                    Send Feedback
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontWeight: 600,
                      letterSpacing: '0.5px'
                    }}>
                      PLOT
                    </Typography>
                    <Box sx={{
                      width: 6,
                      height: 6,
                      bgcolor: '#ff6b6b',
                      borderRadius: '50%'
                    }} />
                    <Typography variant="body2" sx={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontWeight: 600,
                      letterSpacing: '0.5px'
                    }}>
                      POINTE
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <IconButton
                onClick={onClose}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  '&:hover': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ p: 4 }}>
            {/* Problem Description */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{
                color: 'white',
                mb: 3,
                fontWeight: 600,
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <BugIcon sx={{ fontSize: 20, color: '#ff6b6b' }} />
                Describe your problem
              </Typography>
              <TextField
                multiline
                rows={6}
                fullWidth
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Tell us the problem! ex: wrong video uploaded (send video uploaded + the script)"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    color: 'white',
                    borderRadius: '12px',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(102, 126, 234, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: '2px'
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '14px',
                    lineHeight: 1.6
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* Screenshot Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="body1" sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                mb: 3,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <CameraIcon sx={{ fontSize: 18, color: '#4ecdc4' }} />
                A screenshot will help us better understand your problem (optional)
              </Typography>

              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={handleCaptureScreenshot}
                fullWidth
                sx={{
                  color: '#4ecdc4',
                  borderColor: 'rgba(78, 205, 196, 0.3)',
                  background: 'rgba(78, 205, 196, 0.05)',
                  textTransform: 'none',
                  py: 2.5,
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    borderColor: '#4ecdc4',
                    background: 'rgba(78, 205, 196, 0.1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(78, 205, 196, 0.2)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Capture screenshot
              </Button>

              {screenshot && (
                <Box sx={{
                  mt: 3,
                  p: 3,
                  background: 'rgba(76, 175, 80, 0.1)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography variant="body2" sx={{
                    color: '#4CAF50',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    ✓ Screenshot captured: {screenshot}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
              <Button
                variant="outlined"
                onClick={onClose}
                disabled={isSubmitting}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  textTransform: 'none',
                  px: 4,
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
                onClick={handleSubmit}
                disabled={!problemDescription.trim() || isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  textTransform: 'none',
                  px: 4,
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
                  },
                  '&:disabled': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.5)',
                    boxShadow: 'none'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccess(false)}
          severity="success"
          sx={{
            background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' }
          }}
        >
          Feedback sent successfully! Thank you for helping us improve.
        </Alert>
      </Snackbar>

      <Snackbar
        open={showError}
        autoHideDuration={5000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowError(false)}
          severity="error"
          sx={{
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' }
          }}
        >
          Failed to send feedback. Please try again or contact support.
        </Alert>
      </Snackbar>
    </>
  );
};

export default SendFeedback;
