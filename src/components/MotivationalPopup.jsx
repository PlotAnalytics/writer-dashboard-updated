import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, Button, IconButton } from '@mui/material';
import { Close as CloseIcon, TrendingUp, Whatshot, Star } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const MotivationalPopup = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [todaysAffirmation, setTodaysAffirmation] = useState('');

  // Viral-focused motivational affirmations with placeholders for names
  const affirmations = [
    "🔥 {name}, today is the day you create the next MEGA VIRAL! Your creativity knows no bounds!",
    "⚡ {name}, you have the power to captivate millions! Every script you write has viral potential!",
    "🚀 {name}, your unique voice is exactly what the world needs to see! Let's break the internet today!",
    "💎 {name}, you're not just a writer - you're a viral content creator! Today's script could change everything!",
    "🌟 {name}, millions of viewers are waiting for YOUR story! Make today the day they remember forever!",
    "🎯 {name}, you have the magic touch! Every word you write brings you closer to your next viral hit!",
    "🔥 {name}, your creativity is unstoppable! Today's the perfect day to create something LEGENDARY!",
    "⭐ {name}, you're building an empire one viral video at a time! Keep pushing those boundaries!",
    "🚀 {name}, your scripts don't just tell stories - they create movements! What will you inspire today?",
    "💫 {name}, you have the Midas touch for viral content! Turn today's ideas into tomorrow's sensations!",
    "🎬 {name}, you're not just writing scripts - you're crafting the next big cultural moment!",
    "🔥 {name}, your passion for storytelling is infectious! Channel that energy into today's masterpiece!",
    "⚡ {name}, every great viral video started with someone like you believing in their vision! Today is YOUR day!",
    "🌟 {name}, you have the power to make people laugh, cry, and share! Use that superpower today!",
    "🚀 {name}, your creativity is the secret ingredient to viral success! Mix it up and watch the magic happen!",
    "💎 {name}, you're not just creating content - you're creating connections with millions! Make them count!",
    "🔥 {name}, your next script could be the one that breaks all records! Write like the world is watching!",
    "⭐ {name}, you have the storytelling DNA of viral legends! Let that genius flow through your fingers today!",
    "🎯 {name}, every viral video needs a visionary writer behind it - that's YOU! Make today extraordinary!",
    "🚀 {name}, your words have the power to trend worldwide! Write with the confidence of a viral superstar!"
  ];

  // Check if popup should be shown today
  useEffect(() => {
    if (!user || !user.username) return;

    // Only show for regular writers (not special roles)
    const specialRoles = ['master_editor', 'retention_master'];
    if (specialRoles.includes(user.role)) return;

    const today = new Date().toDateString();
    const lastShownDate = localStorage.getItem(`motivational_popup_${user.username}`);

    // Show popup if not shown today
    if (lastShownDate !== today) {
      // Get today's affirmation based on date
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
      const affirmationIndex = dayOfYear % affirmations.length;
      const personalizedAffirmation = affirmations[affirmationIndex].replace('{name}', user.username);
      
      setTodaysAffirmation(personalizedAffirmation);
      setOpen(true);
    }
  }, [user]);

  const handleClose = () => {
    setOpen(false);
    // Mark as shown for today
    const today = new Date().toDateString();
    localStorage.setItem(`motivational_popup_${user.username}`, today);
  };

  const handleGetMotivated = () => {
    handleClose();
    // Optional: Could trigger additional actions like navigating to submission form
  };

  if (!user || !user.username) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="motivational-popup-title"
      aria-describedby="motivational-popup-description"
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '90%', sm: 450 },
        bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: '2px solid #fff',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        p: 4,
        outline: 'none',
        overflow: 'hidden'
      }}>
        {/* Background decoration */}
        <Box sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          zIndex: 0
        }} />
        
        <Box sx={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          zIndex: 0
        }} />

        {/* Close button */}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'white',
            zIndex: 2
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Content */}
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* Icon */}
          <Box sx={{ mb: 2 }}>
            <Whatshot sx={{ fontSize: 48, color: '#FFD700', mb: 1 }} />
            <TrendingUp sx={{ fontSize: 32, color: '#FF6B6B', ml: 1 }} />
            <Star sx={{ fontSize: 40, color: '#4ECDC4', ml: 1 }} />
          </Box>

          {/* Title */}
          <Typography variant="h5" sx={{
            color: 'white',
            fontWeight: 'bold',
            mb: 2,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            Daily Viral Motivation! 🚀
          </Typography>

          {/* Affirmation */}
          <Typography variant="body1" sx={{
            color: 'white',
            fontSize: '18px',
            lineHeight: 1.6,
            mb: 3,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            fontWeight: 500
          }}>
            {todaysAffirmation}
          </Typography>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              onClick={handleGetMotivated}
              sx={{
                bgcolor: '#FF6B6B',
                color: 'white',
                fontWeight: 'bold',
                px: 3,
                py: 1,
                borderRadius: '25px',
                textTransform: 'none',
                fontSize: '16px',
                boxShadow: '0 4px 15px rgba(255,107,107,0.4)',
                '&:hover': {
                  bgcolor: '#FF5252',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(255,107,107,0.6)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Let's Create Magic! ✨
            </Button>
            
            <Button
              variant="outlined"
              onClick={handleClose}
              sx={{
                color: 'white',
                borderColor: 'white',
                fontWeight: 'bold',
                px: 3,
                py: 1,
                borderRadius: '25px',
                textTransform: 'none',
                fontSize: '16px',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderColor: 'white'
                }
              }}
            >
              Maybe Later
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default MotivationalPopup;
