import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Fab,
  Popover,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  Button
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  Minimize as MinimizeIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import chatbotLogo from '../assets/chatbot_logo.png';
import '../styles/chat-widget.css';

const ChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [anchorEl, setAnchorEl] = useState(null);

  const chatButtonRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle dragging functionality
  const handleMouseDown = (e) => {
    if (isOpen) return; // Don't drag when chat is open
    
    setIsDragging(true);
    const rect = chatButtonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep button within viewport bounds
    const maxX = window.innerWidth - 56; // 56px is the button width
    const maxY = window.innerHeight - 56;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Send message to n8n webhook
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Sending message to n8n webhook...');
      console.log('📝 Message payload:', {
        message: userMessage.text,
        userId: user.id || user.writerId,
        userName: user.name || user.username,
        timestamp: userMessage.timestamp.toISOString()
      });

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const webhookUrl = 'https://plotpointe-ai.app.n8n.cloud/webhook/1c0d0-8f0-abd0-4bdc-beef-370c27aae1a0';
      console.log('🌐 Webhook URL:', webhookUrl);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.text,
          userId: user.id || user.writerId,
          userName: user.name || user.username,
          timestamp: userMessage.timestamp.toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('❌ HTTP Error Response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Received response data:', data);

      const botMessage = {
        id: Date.now() + 1,
        text: data.response || data.message || 'I received your message!',
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      console.log('✅ Message sent successfully!');
    } catch (err) {
      console.error('❌ Chat API Error Details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        cause: err.cause
      });

      // Check for specific error types
      let errorText = 'Sorry, I\'m having trouble connecting to the AI service right now. Please try again in a moment.';

      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        console.error('🚫 CORS or Network Error detected');
        errorText = 'Connection blocked by CORS policy. The AI service needs to be configured to allow requests from this domain.';
      } else if (err.name === 'AbortError') {
        console.error('⏰ Request timeout');
        errorText = 'Request timed out. The AI service is taking too long to respond.';
      } else if (err.message.includes('HTTP error')) {
        console.error('🌐 HTTP Error');
        errorText = `Server error: ${err.message}`;
      }

      const errorMessage = {
        id: Date.now() + 1,
        text: errorText,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChatOpen = (event) => {
    if (!isDragging) {
      setAnchorEl(event.currentTarget);
      setIsOpen(true);
      // Add welcome message if it's the first time opening
      if (messages.length === 0) {
        setMessages([{
          id: 1,
          text: `Hi ${user.name || user.username}! 👋\n\nI'm your analytics assistant. I can help you with questions about your videos, submissions, and performance data.\n\nFeel free to ask me anything!`,
          sender: 'bot',
          timestamp: new Date()
        }]);
      }
    }
  };

  const handleChatClose = () => {
    setIsOpen(false);
    setAnchorEl(null);
  };

  const handleRefresh = () => {
    setMessages([{
      id: Date.now(),
      text: `Hi there! Nice to see you 😊\nWe have a 10% promo code for new customers! Would you like to get one now? 🎁`,
      sender: 'bot',
      timestamp: new Date()
    }]);
  };

  const handleQuickReply = (replyText) => {
    // Add user message
    const userMessage = {
      id: Date.now(),
      text: replyText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate bot response
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: "I'm here to help you with your analytics! You can ask me questions like:\n\n• What's the Google doc for this video?\n• When was this video posted?\n• Show me my performance metrics\n• What are my viral videos?\n• How many submissions did I make this month?\n\nFeel free to ask me anything! 📊",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  // Don't render if user is not logged in
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Button */}
      <Fab
        ref={chatButtonRef}
        className="chat-fab-hover"
        aria-label="chat"
        onMouseDown={handleMouseDown}
        onClick={handleChatOpen}
        sx={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 1300,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'all 0.3s ease',
          width: 60,
          height: 60,
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)'
          },
          background: '#ffffff',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
          border: '2px solid rgba(0, 0, 0, 0.1)'
        }}
      >
        <img
          src={chatbotLogo}
          alt="Chatbot"
          draggable={false}
          onMouseDown={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />
      </Fab>

      {/* Chat Popover */}
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleChatClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 380,
            height: 500,
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: '#ffffff !important'
          }
        }}
      >
        {/* Chat Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={chatbotLogo}
              sx={{ width: 40, height: 40 }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                Plotpointe Bot
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.8rem' }}>
                Analytics Assistant
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={handleRefresh}
              sx={{ color: 'white', p: 0.5 }}
              size="small"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={handleChatClose}
              sx={{ color: 'white', p: 0.5 }}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        {/* Messages Area */}
        <Box
          className="chat-messages-container"
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            backgroundColor: '#ffffff',
            minHeight: 350,
            maxHeight: 350
          }}
        >
          {/* Date Header */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="caption" sx={{
              color: '#666',
              backgroundColor: 'white',
              px: 2,
              py: 0.5,
              borderRadius: '12px',
              fontSize: '0.75rem'
            }}>
              October 15, 2024
            </Typography>
          </Box>
          {messages.map((message) => (
            <Box key={message.id} sx={{ mb: 2 }}>
              {message.sender === 'bot' && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Avatar
                    src={chatbotLogo}
                    sx={{ width: 32, height: 32, mt: 0.5 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Paper
                      sx={{
                        p: 2,
                        backgroundColor: '#e8f5e8',
                        borderRadius: '18px 18px 18px 4px',
                        maxWidth: '85%',
                        border: '1px solid #d4edda'
                      }}
                    >
                      <Typography variant="body2" sx={{
                        color: '#333333 !important',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {message.text}
                      </Typography>
                    </Paper>

                    {/* Quick Reply Buttons */}
                    {message.id === 1 && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label="Show my viral videos"
                          onClick={() => handleQuickReply("Show my viral videos")}
                          className="quick-reply-chip"
                          sx={{
                            backgroundColor: '#667eea',
                            color: 'white',
                            fontSize: '0.75rem',
                            height: 28,
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#5a6fd8' }
                          }}
                        />
                        <Chip
                          label="My performance this month"
                          onClick={() => handleQuickReply("My performance this month")}
                          className="quick-reply-chip"
                          variant="outlined"
                          sx={{
                            borderColor: '#667eea',
                            color: '#667eea',
                            fontSize: '0.75rem',
                            height: 28,
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        />
                      </Box>
                    )}

                    {/* Suggested Reply */}
                    {message.id === 1 && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label="What's the Google doc for this video?"
                          onClick={() => handleQuickReply("What's the Google doc for this video?")}
                          className="quick-reply-chip"
                          variant="outlined"
                          sx={{
                            borderColor: '#ddd',
                            color: '#667eea',
                            fontSize: '0.75rem',
                            height: 28,
                            borderRadius: '14px',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        />
                        <Chip
                          label="When was this video posted?"
                          onClick={() => handleQuickReply("When was this video posted?")}
                          className="quick-reply-chip"
                          variant="outlined"
                          sx={{
                            borderColor: '#ddd',
                            color: '#667eea',
                            fontSize: '0.75rem',
                            height: 28,
                            borderRadius: '14px',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {message.sender === 'user' && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: '#667eea',
                      color: 'white',
                      borderRadius: '18px 18px 4px 18px',
                      maxWidth: '85%'
                    }}
                  >
                    <Typography variant="body2" sx={{
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {message.text}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          ))}
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
              <Avatar
                src={chatbotLogo}
                sx={{ width: 32, height: 32, mt: 0.5 }}
              />
              <Paper className="chat-loading-container typing-indicator">
                <CircularProgress size={16} />
                <Typography variant="body2">Thinking...</Typography>
              </Paper>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid #e0e0e0',
            backgroundColor: 'white',
            borderRadius: '0 0 20px 20px'
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Emoji/Attachment buttons */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" sx={{ color: '#999' }}>
                <Typography sx={{ fontSize: '1.2rem' }}>😊</Typography>
              </IconButton>
              <IconButton size="small" sx={{ color: '#999' }}>
                <Typography sx={{ fontSize: '1.2rem' }}>📎</Typography>
              </IconButton>
            </Box>

            <TextField
              className="chat-input-field"
              fullWidth
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter message"
              variant="outlined"
              size="small"
              disabled={isLoading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '25px',
                  backgroundColor: '#ffffff !important',
                  border: 'none',
                  color: '#333333 !important',
                  '& fieldset': {
                    border: 'none'
                  },
                  '&:hover fieldset': {
                    border: 'none'
                  },
                  '&.Mui-focused fieldset': {
                    border: '1px solid #667eea'
                  }
                },
                '& .MuiInputBase-input': {
                  padding: '12px 16px',
                  color: '#333333 !important',
                  '&::placeholder': {
                    color: '#999999 !important',
                    opacity: '1 !important'
                  }
                }
              }}
            />

            <IconButton
              className="chat-send-button"
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              sx={{
                backgroundColor: '#667eea',
                color: 'white',
                width: 40,
                height: 40,
                '&:hover': {
                  backgroundColor: '#5a6fd8'
                },
                '&:disabled': {
                  backgroundColor: '#e0e0e0',
                  color: '#999'
                }
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default ChatWidget;
