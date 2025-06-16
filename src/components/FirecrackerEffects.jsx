import React from 'react';
import { Box } from '@mui/material';

const FirecrackerEffects = () => {
  return (
    <Box sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      {/* Firecracker 1 - Top Left */}
      <Box sx={{
        position: 'absolute',
        top: '10%',
        left: '15%',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#FFD700',
        animation: 'firecracker1 1.2s ease-out',
        '@keyframes firecracker1': {
          '0%': { opacity: 0, transform: 'scale(0)' },
          '20%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 20px #FFD700' },
          '40%': { 
            opacity: 1, 
            transform: 'scale(1.5)',
            boxShadow: '0 0 30px #FFD700, 0 0 40px #FF6B35, 0 0 50px #FF1744'
          },
          '60%': { opacity: 0.8, transform: 'scale(0.8)' },
          '100%': { opacity: 0, transform: 'scale(0)' }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-4px',
          left: '-4px',
          right: '-4px',
          bottom: '-4px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, transparent 70%)',
          animation: 'sparkle1 1.2s ease-out',
          '@keyframes sparkle1': {
            '0%': { opacity: 0, transform: 'scale(0)' },
            '30%': { opacity: 1, transform: 'scale(2)' },
            '100%': { opacity: 0, transform: 'scale(4)' }
          }
        }
      }} />

      {/* Firecracker 2 - Top Right */}
      <Box sx={{
        position: 'absolute',
        top: '15%',
        right: '20%',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#FF6B35',
        animation: 'firecracker2 1.4s ease-out 0.3s both',
        '@keyframes firecracker2': {
          '0%': { opacity: 0, transform: 'scale(0)' },
          '25%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 15px #FF6B35' },
          '50%': { 
            opacity: 1, 
            transform: 'scale(1.8)',
            boxShadow: '0 0 25px #FF6B35, 0 0 35px #FFD700, 0 0 45px #FF1744'
          },
          '75%': { opacity: 0.6, transform: 'scale(0.6)' },
          '100%': { opacity: 0, transform: 'scale(0)' }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-3px',
          left: '-3px',
          right: '-3px',
          bottom: '-3px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,53,0.6) 0%, transparent 70%)',
          animation: 'sparkle2 1.4s ease-out 0.3s both',
          '@keyframes sparkle2': {
            '0%': { opacity: 0, transform: 'scale(0)' },
            '40%': { opacity: 1, transform: 'scale(2.5)' },
            '100%': { opacity: 0, transform: 'scale(5)' }
          }
        }
      }} />

      {/* Firecracker 3 - Bottom Left */}
      <Box sx={{
        position: 'absolute',
        bottom: '20%',
        left: '10%',
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: '#FF1744',
        animation: 'firecracker3 1.6s ease-out 0.6s both',
        '@keyframes firecracker3': {
          '0%': { opacity: 0, transform: 'scale(0)' },
          '30%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 18px #FF1744' },
          '60%': { 
            opacity: 1, 
            transform: 'scale(2)',
            boxShadow: '0 0 28px #FF1744, 0 0 38px #FFD700, 0 0 48px #FF6B35'
          },
          '80%': { opacity: 0.7, transform: 'scale(0.7)' },
          '100%': { opacity: 0, transform: 'scale(0)' }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-3px',
          left: '-3px',
          right: '-3px',
          bottom: '-3px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,23,68,0.6) 0%, transparent 70%)',
          animation: 'sparkle3 1.6s ease-out 0.6s both',
          '@keyframes sparkle3': {
            '0%': { opacity: 0, transform: 'scale(0)' },
            '50%': { opacity: 1, transform: 'scale(3)' },
            '100%': { opacity: 0, transform: 'scale(6)' }
          }
        }
      }} />

      {/* Firecracker 4 - Bottom Right */}
      <Box sx={{
        position: 'absolute',
        bottom: '25%',
        right: '15%',
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        background: '#9C27B0',
        animation: 'firecracker4 1.3s ease-out 0.9s both',
        '@keyframes firecracker4': {
          '0%': { opacity: 0, transform: 'scale(0)' },
          '20%': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 22px #9C27B0' },
          '45%': { 
            opacity: 1, 
            transform: 'scale(1.6)',
            boxShadow: '0 0 32px #9C27B0, 0 0 42px #FFD700, 0 0 52px #FF6B35'
          },
          '70%': { opacity: 0.8, transform: 'scale(0.9)' },
          '100%': { opacity: 0, transform: 'scale(0)' }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-4px',
          left: '-4px',
          right: '-4px',
          bottom: '-4px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(156,39,176,0.6) 0%, transparent 70%)',
          animation: 'sparkle4 1.3s ease-out 0.9s both',
          '@keyframes sparkle4': {
            '0%': { opacity: 0, transform: 'scale(0)' },
            '35%': { opacity: 1, transform: 'scale(2.2)' },
            '100%': { opacity: 0, transform: 'scale(4.5)' }
          }
        }
      }} />

      {/* Firecracker 5 - Center Top */}
      <Box sx={{
        position: 'absolute',
        top: '5%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        background: '#00E676',
        animation: 'firecracker5 1.1s ease-out 1.2s both',
        '@keyframes firecracker5': {
          '0%': { opacity: 0, transform: 'translateX(-50%) scale(0)' },
          '25%': { opacity: 1, transform: 'translateX(-50%) scale(1)', boxShadow: '0 0 16px #00E676' },
          '50%': { 
            opacity: 1, 
            transform: 'translateX(-50%) scale(1.4)',
            boxShadow: '0 0 26px #00E676, 0 0 36px #FFD700'
          },
          '75%': { opacity: 0.7, transform: 'translateX(-50%) scale(0.7)' },
          '100%': { opacity: 0, transform: 'translateX(-50%) scale(0)' }
        }
      }} />
    </Box>
  );
};

export default FirecrackerEffects;
