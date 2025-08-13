import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, Button, IconButton } from '@mui/material';
import { Close as CloseIcon, TrendingUp, Whatshot, Star } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const MotivationalPopup = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [todaysAffirmation, setTodaysAffirmation] = useState('');

  // Professional viral-focused motivational affirmations
  const affirmations = [
    "{name}, today is the day you create the next viral sensation. Your creativity knows no bounds.",
    "{name}, you have the power to captivate millions. Every script you write has viral potential.",
    "{name}, your unique voice is exactly what the world needs to see. Today you break new ground.",
    "{name}, you're not just a writer - you're a viral content creator. Today's script could change everything.",
    "{name}, millions of viewers are waiting for your story. Make today the day they remember forever.",
    "{name}, you have the magic touch. Every word you write brings you closer to your next viral hit.",
    "{name}, your creativity is unstoppable. Today is the perfect day to create something legendary.",
    "{name}, you're building an empire one viral video at a time. Keep pushing those boundaries.",
    "{name}, your scripts don't just tell stories - they create movements. What will you inspire today?",
    "{name}, you have the Midas touch for viral content. Turn today's ideas into tomorrow's sensations.",
    "{name}, you're not just writing scripts - you're crafting the next big cultural moment.",
    "{name}, your passion for storytelling is infectious. Channel that energy into today's masterpiece.",
    "{name}, every great viral video started with someone believing in their vision. Today is your day.",
    "{name}, you have the power to make people laugh, cry, and share. Use that superpower today.",
    "{name}, your creativity is the secret ingredient to viral success. Mix it up and watch the magic happen.",
    "{name}, you're not just creating content - you're creating connections with millions. Make them count.",
    "{name}, your next script could be the one that breaks all records. Write like the world is watching.",
    "{name}, you have the storytelling DNA of viral legends. Let that genius flow through your fingers today.",
    "{name}, every viral video needs a visionary writer behind it - that's you. Make today extraordinary.",
    "{name}, your words have the power to trend worldwide. Write with the confidence of a viral superstar.",
    "{name}, your imagination is the birthplace of tomorrow's viral hits. Dream big and write bigger.",
    "{name}, you're not following trends - you're creating them. Today's script sets the new standard.",
    "{name}, every keystroke brings you closer to viral greatness. Type with purpose and passion.",
    "{name}, your stories have the power to unite millions. Create content that brings the world together.",
    "{name}, you're a viral architect building bridges between hearts and minds. Construct something beautiful today.",
    "{name}, your creative energy is contagious. Spread it through every word you write.",
    "{name}, you don't just write scripts - you write history. Make today's chapter unforgettable.",
    "{name}, your talent is a gift to the world. Unwrap it and share it with millions today.",
    "{name}, you're the secret ingredient that turns ordinary ideas into viral phenomena.",
    "{name}, your perspective is unique and powerful. Let it shine through every line you create.",
    "{name}, you have the rare ability to touch souls through screens. Use that gift wisely today.",
    "{name}, your creativity is limitless. Today is the perfect day to prove it to the world.",
    "{name}, you're not just a writer - you're a digital storyteller changing lives one view at a time.",
    "{name}, your words are seeds that grow into viral forests. Plant something magnificent today.",
    "{name}, you have the power to make strangers feel like family. Create that connection today.",
    "{name}, your scripts are time capsules of human emotion. Fill today's with pure inspiration.",
    "{name}, you're a master of the modern narrative. Craft a story that defines this generation.",
    "{name}, your creativity flows like a river - unstoppable and life-giving. Let it flood the internet today.",
    "{name}, you don't just create content - you create culture. Shape tomorrow's conversations today.",
    "{name}, your vision is crystal clear and your execution is flawless. Today's script will prove it.",
    "{name}, you're a viral alchemist turning simple words into digital gold. Work your magic today.",
    "{name}, your storytelling prowess is unmatched. Today's the day to showcase your legendary skills.",
    "{name}, you have the rare gift of making the complex simple and the simple profound.",
    "{name}, your creative spirit burns bright enough to light up millions of screens worldwide.",
    "{name}, you're not just writing for today - you're creating tomorrow's classic viral content.",
    "{name}, your ability to capture human truth in bite-sized stories is pure genius. Share it today.",
    "{name}, you're a digital poet painting emotions across the canvas of the internet.",
    "{name}, your scripts are love letters to humanity. Write one that makes the world fall in love today.",
    "{name}, you have the power to turn ordinary moments into extraordinary viral experiences.",
    "{name}, your creative intuition is your superpower. Trust it completely as you write today.",
    "{name}, you're building a legacy one viral video at a time. Add another masterpiece today.",
    "{name}, your words have the power to heal, inspire, and unite. Use that power for good today.",
    "{name}, you're not just creating entertainment - you're creating hope, joy, and connection.",
    "{name}, your storytelling DNA is encoded with viral success. Let it express itself fully today.",
    "{name}, you have the gift of seeing stories where others see ordinary life. Share that vision today.",
    "{name}, your creative courage inspires others to dream bigger. Be that inspiration today.",
    "{name}, you're a viral visionary with the power to predict what the world needs to see.",
    "{name}, your scripts are bridges connecting diverse hearts across the digital divide.",
    "{name}, you have the rare talent of making every viewer feel seen and understood.",
    "{name}, your creativity is a renewable resource that grows stronger with every use. Use it abundantly today.",
    "{name}, you're not just a content creator - you're a happiness distributor spreading joy worldwide."
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
        width: { xs: '90%', sm: 420 },
        bgcolor: 'white',
        borderRadius: '24px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
        p: 0,
        outline: 'none',
        overflow: 'hidden'
      }}>
        {/* Close button */}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            zIndex: 2,
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.3)',
              transform: 'scale(1.1)'
            },
            transition: 'all 0.3s ease'
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Content */}
        <Box sx={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 5,
          position: 'relative'
        }}>
          {/* Opening quote */}
          <Typography sx={{
            fontSize: '60px',
            color: 'rgba(255, 255, 255, 0.3)',
            fontFamily: 'Georgia, serif',
            lineHeight: 0.5,
            mb: 2,
            fontWeight: 'normal'
          }}>
            "
          </Typography>

          {/* Affirmation */}
          <Typography variant="body1" sx={{
            color: 'white',
            fontSize: '20px',
            lineHeight: 1.5,
            mb: 3,
            fontWeight: 'bold',
            maxWidth: '300px',
            mx: 'auto',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            {todaysAffirmation.replace(/🔥|⚡|🚀|💎|🌟|🎯|⭐|💫|🎬|💪/g, '').trim().split('{name}').map((part, index, array) => (
              index < array.length - 1 ? (
                <span key={index}>
                  {part}
                  <strong>{userName}</strong>
                </span>
              ) : part
            ))}
          </Typography>

          {/* Closing quote */}
          <Typography sx={{
            fontSize: '60px',
            color: 'rgba(255, 255, 255, 0.3)',
            fontFamily: 'Georgia, serif',
            lineHeight: 0.5,
            mb: 3,
            fontWeight: 'normal'
          }}>
            "
          </Typography>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
            <Button
              onClick={handleGetMotivated}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                px: 3,
                py: 1.5,
                borderRadius: '25px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Let's Create Magic ✨
            </Button>

            <Button
              onClick={handleClose}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.8)',
                px: 3,
                py: 1.5,
                borderRadius: '25px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: '500',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Maybe Later 😔
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default MotivationalPopup;
