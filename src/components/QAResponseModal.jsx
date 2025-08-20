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
  Description as DocIcon,
  Send as SendIcon,
  QuestionAnswer as QAIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import axios from 'axios';

const QAResponseModal = ({ 
  open, 
  onClose, 
  submission,
  onResponseSent 
}) => {
  const [qaResponse, setQaResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenDoc = () => {
    if (submission?.google_doc_link) {
      window.open(submission.google_doc_link, '_blank');
    }
    onClose();
  };

  const handleSubmitResponse = async () => {
    if (!qaResponse.trim()) {
      setErrorMessage('Please enter a response before submitting.');
      setShowError(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Debug: Log the data being sent
      const requestData = {
        script_id: submission.id,
        trello_card_id: submission.trello_card_id,
        response: qaResponse.trim(),
        title: submission.title
      };
      console.log('🔍 Sending QA response data:', requestData);

      // Send QA response to backend
      await axios.post('/api/qa-response', requestData);

      setShowSuccess(true);
      setQaResponse('');

      // Notify parent component that response was sent
      if (onResponseSent) {
        onResponseSent(submission.id);
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to send QA response:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to send response. Please try again.');
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setQaResponse('');
      setErrorMessage('');
      onClose();
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
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
          {/* Header */}
          <Box sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            p: 3,
            position: 'relative',
            borderRadius: '20px 20px 0 0'
          }}>
            <IconButton
              onClick={handleClose}
              disabled={isSubmitting}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'scale(1.05)'
                },
                '&:disabled': {
                  opacity: 0.5
                },
                transition: 'all 0.2s ease'
              }}
            >
              <CloseIcon />
            </IconButton>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pr: 6 }}>
              <QAIcon sx={{ fontSize: 28, color: 'white' }} />
              <Box>
                <Typography variant="h6" sx={{
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '18px',
                  mb: 0.5
                }}>
                  Quick Edits Response
                </Typography>
                <Typography variant="body2" sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '14px'
                }}>
                  {submission?.title || 'Script submission'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ p: 4 }}>
            <Typography variant="body1" sx={{
              color: 'rgba(255, 255, 255, 0.9)',
              mb: 3,
              fontSize: '14px',
              lineHeight: 1.6
            }}>
              This script is in <strong>Quick Edits</strong> status. You can either open the document to make edits, 
              or respond to the QA team with your notes.
            </Typography>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
              <Button
                startIcon={<OpenIcon />}
                onClick={handleOpenDoc}
                disabled={isSubmitting}
                sx={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: '500',
                  fontSize: '14px',
                  borderRadius: '10px',
                  py: 1.2,
                  textTransform: 'none',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  },
                  '&:disabled': {
                    opacity: 0.6
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                Open Document
              </Button>
            </Box>

            <Divider sx={{ 
              borderColor: 'rgba(255, 255, 255, 0.1)', 
              mb: 3,
              '&::before, &::after': {
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}>
              <Typography sx={{ 
                color: 'rgba(255, 255, 255, 0.6)', 
                fontSize: '12px',
                px: 2
              }}>
                OR
              </Typography>
            </Divider>

            {/* QA Response Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{
                color: 'white',
                mb: 2,
                fontWeight: 600,
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <SendIcon sx={{ fontSize: 20, color: '#4CAF50' }} />
                Respond to QA Team
              </Typography>
              <TextField
                multiline
                rows={4}
                fullWidth
                value={qaResponse}
                onChange={(e) => setQaResponse(e.target.value)}
                placeholder="Enter your response to the QA team here..."
                disabled={isSubmitting}
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
                      borderColor: 'rgba(102, 126, 234, 0.4)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                      borderWidth: '2px'
                    },
                    '&.Mui-disabled': {
                      opacity: 0.6
                    }
                  },
                  '& .MuiInputBase-input': {
                    color: 'white',
                    '&::placeholder': {
                      color: 'rgba(255, 255, 255, 0.5)',
                      opacity: 1
                    }
                  }
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              fullWidth
              startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              onClick={handleSubmitResponse}
              disabled={isSubmitting || !qaResponse.trim()}
              sx={{
                background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                borderRadius: '12px',
                py: 1.5,
                textTransform: 'none',
                boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #45a049 0%, #388e3c 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)'
                },
                '&:disabled': {
                  opacity: 0.6,
                  transform: 'none'
                },
                transition: 'all 0.2s ease'
              }}
            >
              {isSubmitting ? 'Sending Response...' : 'Send Response to QA'}
            </Button>
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
          Response sent successfully! The card has been moved to the appropriate QA list.
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
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default QAResponseModal;
